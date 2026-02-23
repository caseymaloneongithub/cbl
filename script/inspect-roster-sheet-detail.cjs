const XLSX = require("xlsx");

const [file, sheet] = process.argv.slice(2);
if (!file || !sheet) {
  console.error("Usage: node script/inspect-roster-sheet-detail.cjs <xlsx-file> <sheet-name>");
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets[sheet];
if (!ws) {
  console.error(`Sheet not found: ${sheet}`);
  process.exit(1);
}
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: false });
for (let i = 0; i < Math.min(rows.length, 80); i++) {
  const row = (rows[i] || []).slice(0, 20).map((v) => String(v ?? ""));
  const nonEmpty = row.filter((x) => x.trim().length > 0).length;
  if (nonEmpty >= 2 || /name|player|status|2026|fg|fangraphs|age/i.test(row.join(" "))) {
    console.log(`${String(i + 1).padStart(3, "0")}|${row.join("|")}`);
  }
}
