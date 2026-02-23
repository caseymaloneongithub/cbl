const XLSX = require("xlsx");

const files = [
  "attached_assets/cbl_rosters.xlsx",
  "attached_assets/cbl_minors_rosters.xlsx",
];

for (const file of files) {
  const wb = XLSX.readFile(file, { cellDates: true });
  console.log(`WORKBOOK|${file}|SHEETS=${wb.SheetNames.length}`);
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: false });
    console.log(`SHEET|${sheetName}|ROWS=${rows.length}`);
    for (let i = 0; i < Math.min(4, rows.length); i++) {
      const row = (rows[i] || []).slice(0, 16).map((v) => String(v ?? "").replace(/\|/g, "/"));
      console.log(`ROW${i + 1}|${row.join("|")}`);
    }
  }
}
