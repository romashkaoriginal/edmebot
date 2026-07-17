import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const wb = await SpreadsheetFile.importXlsx(await FileBlob.load("C:/Users/trank/edmebot/outputs/math6_tasks_import/matematika_6_gerasimov_import.xlsx"));
const sheet = wb.worksheets.getItem("Задания");
const values = sheet.getRange("A1:O186").values;
const expected = ["grade","subject","topic","prompt","option_a","option_b","option_c","option_d","option_e","option_f","correct","difficulty","explanation","hint_1","hint_2"];
const headers = values[0];
const issues = [];
if (JSON.stringify(headers) !== JSON.stringify(expected)) issues.push("Неверные заголовки");
const counts = new Map();
const diffCounts = new Map();
for (let i = 1; i < values.length; i++) {
  const r = values[i];
  const [grade, subject, topic, prompt, a,b,c,d,e,f, correct, difficulty] = r;
  if (grade !== 6 || subject !== "Математика" || !topic || !prompt) issues.push(`Строка ${i+1}: обязательное поле`);
  const options = [a,b,c,d,e,f].filter(Boolean);
  if (options.length < 2 || !"abcdef".includes(correct) || !options["abcdef".indexOf(correct)]) issues.push(`Строка ${i+1}: варианты/правильный ответ`);
  if (!["easy","medium","hard"].includes(difficulty)) issues.push(`Строка ${i+1}: сложность`);
  counts.set(topic, (counts.get(topic) || 0) + 1);
  const key = `${topic}|${difficulty}`;
  diffCounts.set(key, (diffCounts.get(key) || 0) + 1);
}
if (values.length - 1 !== 185) issues.push("Неверное число заданий");
if (counts.size !== 37) issues.push("Неверное число тем");
for (const [topic, count] of counts) {
  if (count !== 5) issues.push(`Тема ${topic}: ${count} заданий`);
  for (const [difficulty, expectedCount] of [["easy",2],["medium",2],["hard",1]]) {
    if (diffCounts.get(`${topic}|${difficulty}`) !== expectedCount) issues.push(`Тема ${topic}: баланс ${difficulty}`);
  }
}
console.log(JSON.stringify({ rows: values.length - 1, topics: counts.size, issues }, null, 2));
if (issues.length) process.exitCode = 1;
