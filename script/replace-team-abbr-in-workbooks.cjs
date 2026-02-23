const path = require("path");
const XLSX = require("xlsx");

const targets = [
  path.join("attached_assets", "cbl_rosters.xlsx"),
  path.join("attached_assets", "cbl_minors_rosters.xlsx"),
];

const FROM = "SFS";
const TO = "PHO";

function replaceInWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  let replacedCells = 0;

  for (const sheetName of [...wb.SheetNames]) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws["!ref"]) continue;

    if (sheetName === FROM) {
      wb.Sheets[TO] = ws;
      delete wb.Sheets[sheetName];
      const idx = wb.SheetNames.indexOf(sheetName);
      if (idx >= 0) wb.SheetNames[idx] = TO;
    }

    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        if (typeof cell.v === "string" && cell.v.trim().toUpperCase() === FROM) {
          cell.v = TO;
          cell.w = TO;
          replacedCells++;
        }
      }
    }
  }

  XLSX.writeFile(wb, filePath);
  return { filePath, replacedCells };
}

function main() {
  const results = targets.map(replaceInWorkbook);
  console.log(JSON.stringify({ from: FROM, to: TO, results }, null, 2));
}

main();

