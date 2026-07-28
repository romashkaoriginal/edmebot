const test = require("node:test");
const assert = require("node:assert/strict");
const { assembleHomeworkTasks, gradeHomeworkAnswers } = require("../src/homeworkQuestions");

const homework = { subject: "Математика", task_ids: [12] };
const bankRows = [{
  id: 12,
  topic: "fractions",
  subject: "Математика",
  prompt: "1/2 + 1/2",
  options: ["0", "1"],
  difficulty: "easy",
  hints: [],
  correctIndex: 1,
  explanation: "Две половины составляют целое.",
}];
const ownRows = [{
  id: 7,
  prompt: "2 + 2",
  options: ["3", "4"],
  correctIndex: 1,
  explanation: "Складываем два и два.",
}];

test("assembles own questions without a difficulty column", () => {
  const tasks = assembleHomeworkTasks(
    { subject: "Математика", task_ids: [] },
    [],
    ownRows
  );
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, "hq-7");
  assert.equal(tasks[0].difficulty, "medium");
  assert.equal(tasks[0].correctIndex, 1);
});

test("assembles mixed homework in tutor-selected order", () => {
  const tasks = assembleHomeworkTasks(homework, bankRows, ownRows);
  assert.deepEqual(tasks.map((task) => task.id), ["12", "hq-7"]);
  assert.deepEqual(tasks.map((task) => task.source), ["bank", "own"]);
});

test("grades a complete mixed homework", () => {
  const tasks = assembleHomeworkTasks(homework, bankRows, ownRows);
  const result = gradeHomeworkAnswers(tasks, [
    { taskId: "12", selected: 1 },
    { taskId: "hq-7", selected: 0 },
  ]);
  assert.deepEqual(result.graded.map((answer) => answer.correct), [true, false]);
});

test("rejects missing, duplicate and out-of-range answers", () => {
  const tasks = assembleHomeworkTasks(homework, bankRows, ownRows);
  assert.equal(
    gradeHomeworkAnswers(tasks, [{ taskId: "12", selected: 1 }]).error,
    "invalid_answers"
  );
  assert.equal(
    gradeHomeworkAnswers(tasks, [
      { taskId: "12", selected: 1 },
      { taskId: "12", selected: 1 },
    ]).error,
    "invalid_answers"
  );
  assert.equal(
    gradeHomeworkAnswers(tasks, [
      { taskId: "12", selected: 8 },
      { taskId: "hq-7", selected: 1 },
    ]).error,
    "invalid_answers"
  );
});
