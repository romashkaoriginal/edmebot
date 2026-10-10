import assert from "node:assert/strict";
import test from "node:test";
import { comboAt, correctAnswerText, feedbackTitle, isAnswerComplete, isComboMilestone, partVerdicts } from "../src/utils/answers.js";

test("a choice answer is complete once an option index is picked", () => {
  const task = { questionType: "choice", options: ["a", "b"] };
  assert.equal(isAnswerComplete(task, null), false);
  assert.equal(isAnswerComplete(task, 0), true);
  assert.equal(isAnswerComplete({ options: ["a", "b"] }, 1), true);
});

test("written answers are complete only when every part is filled", () => {
  assert.equal(isAnswerComplete({ questionType: "text" }, "  "), false);
  assert.equal(isAnswerComplete({ questionType: "text" }, "went"), true);
  assert.equal(isAnswerComplete({ questionType: "blanks", blankCount: 2 }, ["a", ""]), false);
  assert.equal(isAnswerComplete({ questionType: "blanks", blankCount: 2 }, ["a", "b"]), true);
  assert.equal(isAnswerComplete({ questionType: "order", options: ["I", "am"] }, ["I"]), false);
  assert.equal(isAnswerComplete({ questionType: "order", options: ["I", "am"] }, ["am", "I"]), true);
  assert.equal(isAnswerComplete({ questionType: "match", options: ["cat", "dog"] }, ["кот", ""]), false);
  assert.equal(isAnswerComplete({ questionType: "match", options: ["cat", "dog"] }, ["кот", "пёс"]), true);
});

test("part verdicts mark each blank against the accepted variants", () => {
  assert.deepEqual(partVerdicts("correct", ["a", "b"], null), [true, true]);
  assert.deepEqual(partVerdicts("wrong", ["Went ", "go"], [["went"], ["gone", "been"]]), [true, false]);
  assert.equal(partVerdicts("wrong", ["a"], undefined), null);
  assert.equal(partVerdicts("answered", ["a"], [["a"]]), null);
});

test("the correct answer text follows the question type", () => {
  assert.equal(correctAnswerText({ questionType: "choice", options: ["x", "y"] }, { correctIndex: 1 }), "y");
  assert.equal(correctAnswerText({ questionType: "text" }, { acceptedAnswers: [["went", "has gone"]] }), "went / has gone");
  assert.equal(correctAnswerText({ questionType: "match", options: ["cat", "dog"] }, { acceptedAnswers: [["кот"], ["пёс"]] }), "cat — кот; dog — пёс");
  assert.equal(correctAnswerText({ questionType: "text" }, {}), "");
});

test("combo counts consecutive correct answers ending at the current one", () => {
  assert.equal(comboAt(["correct", "wrong", "correct", "correct"], 3), 2);
  assert.equal(comboAt(["correct", "wrong"], 1), 0);
  assert.equal(comboAt([], 0), 0);
  assert.equal(isComboMilestone(2), false);
  assert.equal(isComboMilestone(3), true);
  assert.equal(isComboMilestone(5), true);
  assert.equal(isComboMilestone(7), false);
  assert.equal(isComboMilestone(10), true);
});

test("feedback titles are stable for a given seed and never shame", () => {
  assert.equal(feedbackTitle("correct", 2), feedbackTitle("correct", 2));
  assert.equal(feedbackTitle("answered", 5), "Ответ записан");
  assert.equal(feedbackTitle("wrong", 1, { skipped: true }), "Пропущено");
  assert.notEqual(feedbackTitle("wrong", 0), "");
});
