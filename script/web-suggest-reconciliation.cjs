const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const IN_PATH = path.join(process.cwd(), "attached_assets", "roster-reconcile-latest.json");
const OUT_JSON = path.join(process.cwd(), "attached_assets", "web-reconcile-suggestions.json");
const OUT_CSV = path.join(process.cwd(), "attached_assets", "web-reconcile-suggestions.csv");
const OUT_RES = path.join(process.cwd(), "attached_assets", "web-reconcile-resolutions.json");

const TEAM_HINT_ALIASES = {
  ATH: ["athletics", "oakland", "sacramento", "a's"],
  OAK: ["athletics", "oakland", "sacramento", "a's"],
  TBR: ["rays", "tampa bay"],
  TBA: ["rays", "tampa bay"],
  CHW: ["white sox", "chicago white sox"],
  CWS: ["white sox", "chicago white sox"],
  KCR: ["royals", "kansas city"],
  SFG: ["giants", "san francisco"],
  SDP: ["padres", "san diego"],
  SD: ["padres", "san diego"],
  WSN: ["nationals", "washington"],
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripParen(value) {
  return String(value || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

function extractMiddleHint(rawName) {
  const text = String(rawName || "");
  const matches = text.match(/\(([^)]+)\)/g) || [];
  for (const token of matches) {
    const inner = token.replace(/[()]/g, "").trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(inner)) continue;
    if (/^[a-zA-Z.'-]+$/.test(inner)) return inner;
  }
  return null;
}

function expandTeamHints(rawHint) {
  const hint = String(rawHint || "").trim();
  if (!hint) return [];
  const key = hint.toUpperCase();
  const out = [hint.toLowerCase(), ...(TEAM_HINT_ALIASES[key] || [])];
  return Array.from(new Set(out.map((x) => x.toLowerCase())));
}

function parseName(raw) {
  const stripped = stripParen(raw);
  const parts = stripped.split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";
  return { stripped, first, last };
}

function scoreCandidate(row, person) {
  const name = parseName(row.playerName);
  const rowNorm = normalize(name.stripped);
  const personNorm = normalize(person.fullName);
  const pFirst = normalize(person.firstName || "");
  const pLast = normalize(person.lastName || "");
  const rFirst = normalize(name.first);
  const rLast = normalize(name.last);
  let score = 0;

  if (personNorm === rowNorm) score += 120;
  if (personNorm.includes(rowNorm) || rowNorm.includes(personNorm)) score += 25;
  if (rLast && pLast === rLast) score += 45;
  if (rFirst && pFirst === rFirst) score += 30;
  if (rFirst && pFirst.startsWith(rFirst)) score += 12;

  const hints = expandTeamHints(row.mlbTeamHint || row.orgHint);
  const teamName = normalize(person.currentTeam?.name || "");
  if (hints.length && hints.some((h) => teamName.includes(normalize(h)))) score += 30;

  const middleHint = normalize(row.middleNameHint || extractMiddleHint(row.playerName) || "");
  const personMiddle = normalize(person.middleName || "");
  if (middleHint && personMiddle) {
    if (middleHint === personMiddle) score += 25;
    else if (personMiddle.startsWith(middleHint) || middleHint.startsWith(personMiddle)) score += 12;
  }

  if (row.ageHint != null && person.currentAge != null) {
    const diff = Math.abs(Number(row.ageHint) - Number(person.currentAge));
    if (diff === 0) score += 15;
    else if (diff === 1) score += 8;
  }

  return score;
}

async function searchPeople(name) {
  const url = `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.people) ? data.people : [];
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((v) => {
          const s = v == null ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

async function main() {
  if (!fs.existsSync(IN_PATH)) {
    throw new Error(`Missing ${IN_PATH}`);
  }
  const payload = JSON.parse(fs.readFileSync(IN_PATH, "utf8"));
  const unresolved = Array.isArray(payload.unresolved) ? payload.unresolved : [];

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    const results = [];
    const resolutions = {};

    for (let i = 0; i < unresolved.length; i++) {
      const row = unresolved[i];
      const rawName = String(row.playerName || "").trim();
      if (!rawName) continue;
      const stripped = stripParen(rawName);

      const merged = new Map();
      for (const query of Array.from(new Set([rawName, stripped].filter(Boolean)))) {
        const people = await searchPeople(query);
        for (const p of people) {
          if (p?.id) merged.set(Number(p.id), p);
        }
      }

      const candidates = Array.from(merged.values())
        .map((p) => ({ p, score: scoreCandidate(row, p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const top = candidates[0];
      const second = candidates[1];
      const highConfidence =
        top &&
        ((top.score >= 110) ||
          (top.score >= 90 && (!second || top.score - second.score >= 12)) ||
          (top.score >= 80 && candidates.length === 1));

      let existsInDb = false;
      if (top) {
        const check = await db.query(
          `select 1 from mlb_players where mlb_id = $1 and season <= 2025 order by season desc limit 1`,
          [Number(top.p.id)],
        );
        existsInDb = check.rowCount > 0;
      }

      const summary = {
        rowNum: row.rowNum,
        playerName: rawName,
        mlbTeamHint: row.mlbTeamHint || null,
        topCandidateMlbId: top ? Number(top.p.id) : null,
        topCandidateName: top ? top.p.fullName : null,
        topCandidateTeam: top ? (top.p.currentTeam?.name || null) : null,
        topScore: top ? top.score : 0,
        secondScore: second ? second.score : 0,
        highConfidence: Boolean(highConfidence),
        existsInDb,
        candidates: candidates.map((c) => ({
          mlbId: Number(c.p.id),
          fullName: c.p.fullName,
          currentTeam: c.p.currentTeam?.name || null,
          currentAge: c.p.currentAge ?? null,
          score: c.score,
        })),
      };
      results.push(summary);

      if (highConfidence && top) {
        resolutions[String(row.rowNum)] = Number(top.p.id);
      }

      if ((i + 1) % 25 === 0) {
        console.log(`[web-suggest] processed ${i + 1}/${unresolved.length}`);
      }
    }

    const outPayload = {
      generatedAt: new Date().toISOString(),
      unresolvedCount: unresolved.length,
      suggestedCount: Object.keys(resolutions).length,
      suggestions: results,
      resolutions,
    };
    fs.writeFileSync(OUT_JSON, JSON.stringify(outPayload, null, 2), "utf8");
    fs.writeFileSync(OUT_RES, JSON.stringify(resolutions, null, 2), "utf8");

    const csvRows = [
      [
        "row_num",
        "player_name",
        "mlb_team_hint",
        "top_candidate_mlb_id",
        "top_candidate_name",
        "top_candidate_team",
        "top_score",
        "second_score",
        "high_confidence",
        "auto_suggested",
      ],
      ...results.map((r) => [
        r.rowNum,
        r.playerName,
        r.mlbTeamHint || "",
        r.topCandidateMlbId || "",
        r.topCandidateName || "",
        r.topCandidateTeam || "",
        r.topScore,
        r.secondScore,
        r.highConfidence ? "yes" : "no",
        resolutions[String(r.rowNum)] ? "yes" : "no",
      ]),
    ];
    fs.writeFileSync(OUT_CSV, toCsv(csvRows), "utf8");

    console.log(
      JSON.stringify(
        {
          unresolved: unresolved.length,
          suggested: Object.keys(resolutions).length,
          outJson: OUT_JSON,
          outCsv: OUT_CSV,
          outRes: OUT_RES,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
