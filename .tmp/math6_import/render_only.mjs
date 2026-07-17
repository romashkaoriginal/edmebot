import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
console.log("load");
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load("C:/Users/trank/edmebot/outputs/math6_tasks_import/matematika_6_gerasimov_import.xlsx"));
console.log("render start");
const image = await wb.render({ sheetName: "Инструкция", range: "A1:B10", scale: 1, format: "png" });
console.log("render end");
await fs.writeFile("C:/Users/trank/edmebot/outputs/math6_tasks_import/preview_instruction.png", new Uint8Array(await image.arrayBuffer()));
console.log("saved");
