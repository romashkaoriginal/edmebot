const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanQuestionAnswer, gradeAnswer } = require("../src/questionTypes");
const { assembleHomeworkTasks, gradeHomeworkAnswers } = require("../src/homeworkQuestions");
const english = require("../src/data/english-grade5.json");

test("accepts written answers with case, apostrophe and final punctuation differences", () => {
  const spec = cleanQuestionAnswer({ questionType: "text", acceptedAnswers: [["at my granny’s"]] });
  assert.equal(spec.error, undefined);
  assert.equal(gradeAnswer(spec.value, { answer: " At my granny's. " }).correct, true);
});

test("checks every blank and rejects incomplete submissions", () => {
  const spec = cleanQuestionAnswer({ questionType: "blanks", prompt: "Liz _ 10, now she _ 11.", acceptedAnswers: [["was"], ["is"]] }).value;
  assert.equal(gradeAnswer(spec, { answer: ["was", "is"] }).correct, true);
  assert.equal(gradeAnswer(spec, { answer: ["was", "are"] }).correct, false);
  assert.equal(gradeAnswer(spec, { answer: ["was"] }).error, "invalid_answers");
});

test("grades a written question in homework", () => {
  const rows = [{ id: 4, prompt: "В горах", questionType: "text", acceptedAnswers: [["in the mountains"]], options: [], correctIndex: 0 }];
  const tasks = assembleHomeworkTasks({ subject: "Английский язык", task_ids: [] }, [], rows);
  assert.equal(gradeHomeworkAnswers(tasks, [{ taskId: "hq-4", answer: "In the mountains" }]).graded[0].correct, true);
});

test("English grade 5 data covers all exercises with valid answer shapes", () => {
  assert.equal(english.length, 196);
  assert.equal(new Set(english.map((item) => item.sourceKey)).size, english.length);
  for (const item of english) {
    assert.equal(cleanQuestionAnswer(item).error, undefined, item.sourceKey);
    if (item.questionType === "blanks") assert.equal(item.prompt.split("_").length - 1, item.acceptedAnswers.length, item.sourceKey);
  }
});

test("word tiles preserve duplicates and reject words outside the bank", () => {
  const task = cleanQuestionAnswer({ questionType: "order", acceptedAnswers: [["I think I can."]] }).value;
  assert.equal(gradeAnswer(task, { answer: ["I", "think", "I", "can."] }).correct, true);
  assert.equal(gradeAnswer(task, { answer: ["I", "I", "think", "can."] }).correct, false);
  assert.equal(gradeAnswer(task, { answer: ["I", "think", "you", "can."] }).error, "invalid_answers");
});

test("matching checks each left label, rejects ambiguous pairs, and works in homework", () => {
  const spec = cleanQuestionAnswer({ questionType: "match", options: ["play", "pick"], acceptedAnswers: [["football"], ["berries"]] });
  assert.equal(spec.error, undefined);
  assert.equal(gradeAnswer(spec.value, { answer: ["football", "berries"] }).correct, true);
  assert.equal(gradeAnswer(spec.value, { answer: ["berries", "football"] }).correct, false);
  assert.equal(gradeAnswer(spec.value, { answer: ["football"] }).error, "invalid_answers");
  assert.equal(cleanQuestionAnswer({ questionType: "match", options: ["a", "b"], acceptedAnswers: [["same"], ["same"]] }).error, "invalid_pairs");
  const tasks = assembleHomeworkTasks({ task_ids: [] }, [], [{ id: 1, ...spec.value }]);
  assert.equal(gradeHomeworkAnswers(tasks, [{ taskId: "hq-1", answer: ["football", "berries"] }]).graded[0].correct, true);
});
