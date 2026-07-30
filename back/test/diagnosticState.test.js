const test = require("node:test");
const assert = require("node:assert/strict");
const state = require("../src/studentState");

test("diagnostic records both strong and weak assessed topics", async () => {
  const calls = [];
  const executor = {
    async query(text, params) {
      calls.push({ text, params });
      return { rows: [], rowCount: 1 };
    },
  };
  const student = { id: 42, status: "pending", subject: "Математика", grade: 7 };
  const questions = [
    { id: 1, subject: "Математика", topic: "fractions", correct: 0 },
    { id: 2, subject: "Математика", topic: "equations", correct: 1 },
  ];
  await state.submitDiagnostic(
    student,
    [
      { id: 1, selected: 0, usedHelp: false },
      { id: 2, selected: 0, usedHelp: false },
    ],
    "Математика",
    questions,
    executor
  );
  const topicUpserts = calls.filter((call) => call.text.includes("INSERT INTO student_topics"));
  assert.equal(topicUpserts.length, 2);
  assert.deepEqual(topicUpserts.map((call) => call.params[2]).sort(), ["equations", "fractions"]);
  assert.ok(topicUpserts.find((call) => call.params[2] === "fractions").params[3] >
    topicUpserts.find((call) => call.params[2] === "equations").params[3]);
});
