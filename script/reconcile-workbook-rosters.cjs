const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { Client } = require("pg");

const LEAGUE_ID = 2;
const SEASON = 2025;
const MLB_FILE = "attached_assets/cbl_rosters.xlsx";
const MILB_FILE = "attached_assets/cbl_minors_rosters.xlsx";
const OUT_REPORT = "attached_assets/roster-reconcile-report.json";
const OUT_UNRESOLVED = "attached_assets/roster-reconcile-unresolved.csv";
const OUT_ASSIGNMENT_BACKUP = "attached_assets/roster-assignments-backup-before-replace.json";
const OUT_NORMALIZED_UPLOAD = "attached_assets/roster-normalized-upload.csv";

const TEAM_ALIAS = {
  SFS: "PHO",
};

const MLB_ABBR_KEYWORDS = {
  ARI: ["arizona", "diamondbacks"],
  ATL: ["atlanta", "braves"],
  BAL: ["baltimore", "orioles"],
  BOS: ["boston", "red sox"],
  CHC: ["chicago", "cubs"],
  CHW: ["chicago", "white sox"],
  CIN: ["cincinnati", "reds"],
  CLE: ["cleveland", "guardians"],
  COL: ["colorado", "rockies"],
  DET: ["detroit", "tigers"],
  HOU: ["houston", "astros"],
  KC: ["kansas city", "royals"],
  LAA: ["angels", "los angeles"],
  LAD: ["dodgers", "los angeles"],
  MIA: ["miami", "marlins"],
  MIL: ["milwaukee", "brewers"],
  MIN: ["minnesota", "twins"],
  NYM: ["mets", "new york"],
  NYY: ["yankees", "new york"],
  ATH: ["athletics", "oakland", "sacramento"],
  PHI: ["philadelphia", "phillies"],
  PIT: ["pittsburgh", "pirates"],
  SD: ["san diego", "padres"],
  SDP: ["san diego", "padres"],
  SF: ["san francisco", "giants"],
  SFN: ["san francisco", "giants"],
  SEA: ["seattle", "mariners"],
  STL: ["st louis", "cardinals"],
  TB: ["tampa bay", "rays"],
  TEX: ["texas", "rangers"],
  TOR: ["toronto", "blue jays"],
  WSH: ["washington", "nationals"],
};

function normalizeName(value) {
  if (!value) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[®©]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/gi, " ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

function parseSalary(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/[$,]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function findHeaderRow(rows, requiredHeaders) {
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const normalized = (rows[i] || []).map((x) => String(x || "").trim().toLowerCase());
    const ok = requiredHeaders.every((h) => normalized.includes(h));
    if (ok) return i;
  }
  return -1;
}

function toRowObject(headers, row) {
  const out = {};
  headers.forEach((h, idx) => {
    out[h] = row[idx] == null ? "" : String(row[idx]).trim();
  });
  return out;
}

function parseMlbWorkbook(filePath, knownAbbr) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const records = [];
  for (const sheetName of wb.SheetNames) {
    if (sheetName === "Teams") continue;
    const mappedAbbr = TEAM_ALIAS[sheetName] || sheetName;
    if (!knownAbbr.has(mappedAbbr)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, blankrows: false });
    const headerIdx = findHeaderRow(rows, ["last name", "first name", "status"]);
    if (headerIdx < 0) continue;
    const headers = (rows[headerIdx] || []).map((x) => String(x || "").trim().toLowerCase());
    const idx = (name) => headers.findIndex((h) => h === name);
    const cblIdx = idx("cbl");
    const lastIdx = idx("last name");
    const firstIdx = idx("first name");
    const mlbIdx = idx("mlb");
    const statusIdx = idx("status");
    const salaryIdx = idx("2026 salary");
    const rosterIdx = idx("roster");
    const fgIdx = idx("fangraphs id");
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (cblIdx >= 0) {
        const cblAbbr = String(row[cblIdx] || "").trim().toUpperCase();
        if (cblAbbr && cblAbbr !== mappedAbbr) continue;
      }
      const last = String(row[lastIdx] || "").trim();
      const first = String(row[firstIdx] || "").trim();
      if (!last && !first) continue;
      const roster = String(row[rosterIdx] || "").trim().toUpperCase();
      if (!roster || roster === "R") continue;
      const playerName = `${first} ${last}`.trim();
      records.push({
        source: "mlb",
        teamAbbreviation: mappedAbbr,
        playerName,
        firstName: first,
        lastName: last,
        rosterType: "mlb",
        mlbHint: String(row[mlbIdx] || "").trim().toUpperCase() || null,
        status: String(row[statusIdx] || "").trim() || null,
        salary2026: parseSalary(row[salaryIdx]),
        fangraphsId: String(row[fgIdx] || "").trim() || null,
      });
    }
  }
  return records;
}

function parseMilbWorkbook(filePath, knownAbbr) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const records = [];
  const ALLOWED_MILB_STATUSES = new Set(["MH", "MC", "FA"]);
  for (const sheetName of wb.SheetNames) {
    if (sheetName === "Teams") continue;
    const mappedAbbr = TEAM_ALIAS[sheetName] || sheetName;
    if (!knownAbbr.has(mappedAbbr)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, blankrows: false });
    const headerIdx = findHeaderRow(rows, ["last name", "first name", "mlb", "status"]);
    if (headerIdx < 0) continue;
    const headers = (rows[headerIdx] || []).map((x) => String(x || "").trim().toLowerCase());
    const idx = (name) => headers.findIndex((h) => h === name);
    const cblIdx = idx("cbl");
    const lastIdx = idx("last name");
    const firstIdx = idx("first name");
    const mlbIdx = idx("mlb");
    const statusIdx = idx("status");
    const yearIdx = idx("year");
    // Parse optional summary quotas from "Totals" row near top of sheet.
    // Typical layout provides: total, MH, MC, FA counts.
    let quotaTotal = null;
    const quotaByStatus = { MH: null, MC: null, FA: null };
    for (let q = 0; q < Math.min(headerIdx, 40); q++) {
      const row = rows[q] || [];
      const normalized = row.map((x) => String(x || "").trim().toLowerCase());
      if (!normalized.includes("totals")) continue;
      const nums = row
        .map((x) => {
          const raw = String(x || "").trim();
          if (!/[0-9]/.test(raw)) return NaN;
          return Number(raw.replace(/[^0-9.-]/g, ""));
        })
        .filter((n) => Number.isFinite(n) && n >= 0);
      if (nums.length >= 1) quotaTotal = nums[0];
      if (nums.length >= 4) {
        quotaByStatus.MH = nums[1];
        quotaByStatus.MC = nums[2];
        quotaByStatus.FA = nums[3];
      }
      break;
    }
    const usedByStatus = { MH: 0, MC: 0, FA: 0 };
    let usedTotal = 0;
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (cblIdx >= 0) {
        const cblAbbr = String(row[cblIdx] || "").trim().toUpperCase();
        if (cblAbbr && cblAbbr !== mappedAbbr) continue;
      }
      const last = String(row[lastIdx] || "").trim();
      const first = String(row[firstIdx] || "").trim();
      if (!last && !first) continue;
      const status = String(row[statusIdx] || "").trim().toUpperCase();
      if (!ALLOWED_MILB_STATUSES.has(status)) continue;
      if (quotaTotal != null && usedTotal >= quotaTotal) continue;
      if (quotaByStatus[status] != null && usedByStatus[status] >= quotaByStatus[status]) continue;
      const playerName = `${first} ${last}`.trim();
      records.push({
        source: "milb",
        teamAbbreviation: mappedAbbr,
        playerName,
        firstName: first,
        lastName: last,
        rosterType: "milb",
        mlbHint: String(row[mlbIdx] || "").trim().toUpperCase() || null,
        status: status || null,
        yearHint: String(row[yearIdx] || "").trim() || null,
      });
      usedTotal += 1;
      usedByStatus[status] += 1;
    }
  }
  return records;
}

function scoreCandidate(candidate, record) {
  let score = 0;
  if (candidate.normFull === record.normFull) score += 120;
  if (candidate.normLast === record.normLast) score += 45;
  if (candidate.normFirst === record.normFirst) score += 35;
  if (`${candidate.normFirst} ${candidate.normLast}`.trim() === `${record.normFirst} ${record.normLast}`.trim()) score += 40;
  if (candidate.normFull.includes(record.normFull) || record.normFull.includes(candidate.normFull)) score += 20;
  if (record.mlbHint && MLB_ABBR_KEYWORDS[record.mlbHint]) {
    const keywords = MLB_ABBR_KEYWORDS[record.mlbHint];
    const cur = (candidate.current_team_name || "").toLowerCase();
    const org = (candidate.parent_org_name || "").toLowerCase();
    for (const kw of keywords) {
      if (cur.includes(kw)) score += 18;
      if (org.includes(kw)) score += 18;
    }
  }
  if (record.rosterType === "mlb" && candidate.sport_level === "MLB") score += 12;
  if (record.rosterType === "milb" && candidate.sport_level !== "MLB") score += 10;
  return score;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const membersRes = await client.query(
      `select user_id, team_abbreviation from league_members where league_id=$1 and is_archived=false and team_abbreviation is not null`,
      [LEAGUE_ID],
    );
    const abbrToUser = new Map(
      membersRes.rows.map((r) => [String(r.team_abbreviation).toUpperCase(), String(r.user_id)]),
    );
    const knownAbbr = new Set(abbrToUser.keys());

    const rawMlb = parseMlbWorkbook(MLB_FILE, knownAbbr);
    const rawMilb = parseMilbWorkbook(MILB_FILE, knownAbbr);

    const byKey = new Map();
    for (const rec of [...rawMilb, ...rawMlb]) {
      const key = `${rec.teamAbbreviation}|${normalizeName(rec.playerName)}`;
      const existing = byKey.get(key);
      if (!existing || rec.rosterType === "mlb") byKey.set(key, rec);
    }
    const records = Array.from(byKey.values()).map((r) => ({
      ...r,
      normFull: normalizeName(r.playerName),
      normFirst: normalizeName(r.firstName),
      normLast: normalizeName(r.lastName),
    }));
    const normalizedRows = [
      ["mlb_api_id", "player_name", "middle_name", "team_abbreviation", "roster_type", "age", "mlb_team", "org", "fangraphs_id", "status", "2026"],
      ...records.map((r) => [
        "",
        r.playerName,
        "",
        r.teamAbbreviation,
        r.rosterType,
        "",
        r.mlbHint || "",
        "",
        r.fangraphsId || "",
        r.rosterType === "mlb" ? (r.status || "") : "",
        r.rosterType === "mlb" && r.salary2026 != null ? String(r.salary2026) : "",
      ]),
    ];
    fs.writeFileSync(OUT_NORMALIZED_UPLOAD, toCsv(normalizedRows));

    const playersRes = await client.query(
      `select id, mlb_id, full_name, first_name, last_name, age, current_team_name, parent_org_name, sport_level, season
       from mlb_players
       where season between 2021 and 2025`,
    );
    const players = playersRes.rows.map((p) => ({
      ...p,
      normFull: normalizeName(p.full_name),
      normFirst: normalizeName(p.first_name || String(p.full_name || "").split(" ").slice(0, -1).join(" ")),
      normLast: normalizeName(p.last_name || String(p.full_name || "").split(" ").slice(-1).join(" ")),
    }));
    const playersByLast = new Map();
    for (const p of players) {
      if (!playersByLast.has(p.normLast)) playersByLast.set(p.normLast, []);
      playersByLast.get(p.normLast).push(p);
    }

    const matched = [];
    const unresolved = [];
    const lowConfidence = [];
    for (const rec of records) {
      const userId = abbrToUser.get(rec.teamAbbreviation);
      if (!userId) {
        unresolved.push({ ...rec, reason: "unknown_team_abbreviation" });
        continue;
      }
      const pool = playersByLast.get(rec.normLast) || players;
      let best = null;
      let second = null;
      for (const p of pool) {
        const s = scoreCandidate(p, rec);
        if (!best || s > best.score) {
          second = best;
          best = { player: p, score: s };
        } else if (!second || s > second.score) {
          second = { player: p, score: s };
        }
      }
      if (!best || best.score < 50) {
        unresolved.push({
          ...rec,
          reason: "no_confident_match",
          topCandidates: [best, second].filter(Boolean).map((x) => ({
            mlbId: x.player.mlb_id,
            fullName: x.player.full_name,
            score: x.score,
            level: x.player.sport_level,
            currentTeam: x.player.current_team_name,
            org: x.player.parent_org_name,
          })),
        });
        continue;
      }
      if (best.score < 85) {
        lowConfidence.push({
          ...rec,
          matchMlbId: best.player.mlb_id,
          matchName: best.player.full_name,
          score: best.score,
          secondScore: second ? second.score : null,
        });
      }
      matched.push({
        ...rec,
        userId,
        mlbPlayerId: best.player.id,
        mlbId: best.player.mlb_id,
        matchedName: best.player.full_name,
        score: best.score,
      });
    }

    const existingRes = await client.query(
      `select id, league_id, user_id, mlb_player_id, roster_type, contract_status, salary_2026, season, created_at
       from league_roster_assignments where league_id=$1 and season=$2`,
      [LEAGUE_ID, SEASON],
    );
    fs.writeFileSync(OUT_ASSIGNMENT_BACKUP, JSON.stringify(existingRes.rows, null, 2));

    let inserted = 0;
    let updated = 0;
    await client.query("begin");
    try {
      await client.query(`delete from league_roster_assignments where league_id=$1 and season=$2`, [LEAGUE_ID, SEASON]);
      for (const row of matched) {
        const contractStatus = row.rosterType === "mlb" ? row.status : null;
        const salary2026 = row.rosterType === "mlb" ? row.salary2026 : null;
        await client.query(
          `insert into league_roster_assignments (league_id, user_id, mlb_player_id, roster_type, contract_status, salary_2026, season)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [LEAGUE_ID, row.userId, row.mlbPlayerId, row.rosterType, contractStatus, salary2026, SEASON],
        );
        inserted++;
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }

    const report = {
      leagueId: LEAGUE_ID,
      season: SEASON,
      inputRecords: records.length,
      matched: matched.length,
      inserted,
      updated,
      unresolved: unresolved.length,
      lowConfidence: lowConfidence.length,
      backup: OUT_ASSIGNMENT_BACKUP,
      unresolvedRows: unresolved,
      lowConfidenceRows: lowConfidence,
    };
    fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2));

    const unresolvedCsvRows = [
      ["team_abbreviation", "player_name", "roster_type", "mlb_hint", "status", "fangraphs_id", "reason", "top_candidate_1", "top_candidate_2"],
      ...unresolved.map((u) => [
        u.teamAbbreviation,
        u.playerName,
        u.rosterType,
        u.mlbHint || "",
        u.status || "",
        u.fangraphsId || "",
        u.reason || "",
        u.topCandidates?.[0] ? `${u.topCandidates[0].fullName} (${u.topCandidates[0].mlbId}) score=${u.topCandidates[0].score}` : "",
        u.topCandidates?.[1] ? `${u.topCandidates[1].fullName} (${u.topCandidates[1].mlbId}) score=${u.topCandidates[1].score}` : "",
      ]),
    ];
    fs.writeFileSync(OUT_UNRESOLVED, toCsv(unresolvedCsvRows));

    console.log(
      JSON.stringify(
        {
          inputRecords: records.length,
          matched: matched.length,
          inserted,
          updated,
          unresolved: unresolved.length,
          lowConfidence: lowConfidence.length,
          report: OUT_REPORT,
          unresolvedCsv: OUT_UNRESOLVED,
          normalizedCsv: OUT_NORMALIZED_UPLOAD,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
