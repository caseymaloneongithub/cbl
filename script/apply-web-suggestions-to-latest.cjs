const fs = require("fs");
const path = require("path");

const SNAPSHOT = path.join(process.cwd(), "attached_assets", "roster-reconcile-latest.json");
const SUGGESTIONS = path.join(process.cwd(), "attached_assets", "web-reconcile-suggestions.json");
const RESOLUTIONS = path.join(process.cwd(), "attached_assets", "web-reconcile-resolutions.json");

function main() {
  if (!fs.existsSync(SNAPSHOT) || !fs.existsSync(SUGGESTIONS) || !fs.existsSync(RESOLUTIONS)) {
    throw new Error("Missing required files for applying web suggestions.");
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
  const suggestions = JSON.parse(fs.readFileSync(SUGGESTIONS, "utf8"));
  const resolutions = JSON.parse(fs.readFileSync(RESOLUTIONS, "utf8"));
  const byRow = new Map((suggestions.suggestions || []).map((s) => [Number(s.rowNum), s]));

  let patched = 0;
  for (const row of snapshot.unresolved || []) {
    const rowNum = Number(row.rowNum);
    const suggestedId = Number(resolutions[String(rowNum)]);
    if (!Number.isInteger(suggestedId) || suggestedId <= 0) continue;
    const suggestion = byRow.get(rowNum);
    if (!row.candidates) row.candidates = [];
    const exists = row.candidates.some((c) => Number(c.mlbApiId) === suggestedId);
    if (!exists) {
      row.candidates.unshift({
        mlbApiId: suggestedId,
        fullName: suggestion?.topCandidateName || `MLB ID ${suggestedId}`,
        age: null,
        currentTeamName: suggestion?.topCandidateTeam || null,
        parentOrgName: null,
        sportLevel: "WEB",
        score: 999,
      });
    }
    row.resolutionHint = `${row.resolutionHint || ""} Web-assisted suggestion added: MLB ID ${suggestedId}.`.trim();
    patched++;
  }

  fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(JSON.stringify({ patchedRows: patched }, null, 2));
}

main();

