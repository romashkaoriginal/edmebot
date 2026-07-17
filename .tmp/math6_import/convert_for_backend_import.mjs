import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { createRequire } from "node:module";

const require = createRequire("C:/Users/trank/edmebot/back/package.json");
const ExcelJS = require("exceljs");

const source = "C:/Users/trank/edmebot/outputs/math6_tasks_import/matematika_6_gerasimov_import.xlsx";
const target = "C:/Users/trank/edmebot/outputs/math6_tasks_import/matematika_6_gerasimov_import_compatible.xlsx";
const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const rows = sourceWorkbook.worksheets.getItem("Задания").getRange("A1:O186").values;

const workbook = new ExcelJS.Workbook();
workbook.creator = "EDME bot";
const sheet = workbook.addWorksheet("Задания", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
sheet.addRows(rows);
sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF352667" } };
sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
sheet.getRow(1).height = 30;
for (let row = 2; row <= sheet.rowCount; row++) {
  sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
  sheet.getRow(row).height = 42;
}
const widths = [8,16,38,50,21,21,21,21,10,10,10,12,55,38,38];
widths.forEach((width, i) => { sheet.getColumn(i + 1).width = width; });
sheet.autoFilter = { from: "A1", to: "O1" };
sheet.getColumn(12).eachCell({ includeEmpty: false }, (cell) => {
  if (cell.value === "easy") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDF3E4" } };
  if (cell.value === "medium") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF0C9" } };
  if (cell.value === "hard") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE0E0" } };
});
await workbook.xlsx.writeFile(target);
console.log(JSON.stringify({ target, rows: rows.length - 1 }));
