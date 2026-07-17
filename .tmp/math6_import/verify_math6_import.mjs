import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const path = "C:/Users/trank/edmebot/outputs/math6_tasks_import/matematika_6_gerasimov_import.xlsx";
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const overview = await wb.inspect({ kind: "workbook,sheet,table", maxChars: 4500, tableMaxRows: 5, tableMaxCols: 16 });
console.log(overview.ndjson);
const tasks = await wb.inspect({ kind: "table", range: "Задания!A1:O8", include: "values", tableMaxRows: 8, tableMaxCols: 15 });
console.log(tasks.ndjson);
const bad = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 20 }, summary: "formula errors" });
console.log(bad.ndjson);
for (const [sheetName, range, filename] of [["Задания", "A1:O12", "preview_tasks.png"], ["Инструкция", "A1:B10", "preview_instruction.png"], ["Покрытие тем", "A1:C38", "preview_coverage.png"]]) {
  try {
    const image = await wb.render({ sheetName, range, scale: 1.0, format: "png" });
    await fs.writeFile(`C:/Users/trank/edmebot/outputs/math6_tasks_import/${filename}`, new Uint8Array(await image.arrayBuffer()));
    console.log(`rendered ${filename}`);
  } catch (error) {
    console.error(`render failed for ${sheetName}: ${error?.stack || error}`);
  }
}
