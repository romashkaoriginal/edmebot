const test = require("node:test");
const assert = require("node:assert/strict");
const state = require("../src/studentState");
const db = require("../src/db");

const PROFILE = (overrides = {}) => ({
  student_id: 1, xp: 25, coins: 13, level: 1, xp_from_level: 0, xp_for_next: 440,
  streak: 1, streak_freeze_used: false, pet_species: "fox", pet_name: "Рыжик",
  pet_bond: 0, pet_satiety: 80, pet_mood: 80, pet_selected: true,
  onboarding_step: "complete", food_inventory: {}, owned_items: [], worn_items: {},
  diagnostic_done: true, pet_decay_checked_at: new Date().toISOString(),
  ...overrides,
});

// Runs gradePractice against a stubbed db, returning the graded outcome plus
// every statement/param pair the code issued.
async function runGrading({ optionOrder, selected, taskCorrect, streakLastDoneOn }) {
  const statements = [];
  const originalQuery = db.query;
  const originalTransaction = db.transaction;
  const handle = async (text, params) => {
    const first = String(text).trim().split("\n")[0];
    statements.push({ text: first, params });
    if (/^SELECT \* FROM practice_question_instances/.test(first)) {
      return { rows: [{
        id: params[0], student_id: params[1], task_id: params[2], hints_revealed: 0,
        answered_at: null, expires_at: new Date(Date.now() + 3600e3).toISOString(),
        option_order: optionOrder, selected: null, correct: null,
        award_xp: 0, award_coins: 0, leveled_up: false,
      }], rowCount: 1 };
    }
    if (/AT TIME ZONE/.test(text)) return { rows: [{ today: "2026-08-02" }], rowCount: 1 };
    if (/^SELECT \* FROM student_profiles/.test(first)) {
      return { rows: [PROFILE({ streak_last_done_on: streakLastDoneOn })], rowCount: 1 };
    }
    if (/^INSERT INTO student_profiles/.test(first) && /RETURNING/i.test(text)) {
      return { rows: [PROFILE({ streak_last_done_on: streakLastDoneOn })], rowCount: 1 };
    }
    if (/^SELECT mastery/.test(first)) return { rows: [{ mastery: 40 }], rowCount: 1 };
    if (/^INSERT INTO practice_daily_awards/.test(first)) return { rows: [{ task_id: params[1] }], rowCount: 1 };
    if (/consecutive/.test(text)) return { rows: [{ consecutive: false }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  db.query = handle;
  db.transaction = async (fn) => fn({ query: handle });
  try {
    const student = { id: 1, status: "active", name: "Тест", subject: "Математика", grade: 7 };
    const task = { id: 10, subject: "Математика", topic: "functions", correct: taskCorrect, difficulty: "medium" };
    const result = await state.gradePractice(student, task, selected, "3b1f2c9a-1111-4222-8333-444455556666");
    return { result, statements };
  } finally {
    db.query = originalQuery;
    db.transaction = originalTransaction;
  }
}

test("grades against the shuffled position the student actually saw", async () => {
  // Stored option 2 is correct; it was shown in position 0.
  const optionOrder = [2, 0, 3, 1];
  const right = await runGrading({ optionOrder, selected: 0, taskCorrect: 2 });
  assert.equal(right.result.correct, true);
  assert.equal(right.result.correctIndex, 0, "correct answer reported in shown coordinates");

  // Position 1 holds stored option 0, which is wrong.
  const wrong = await runGrading({ optionOrder, selected: 1, taskCorrect: 2 });
  assert.equal(wrong.result.correct, false);
  assert.equal(wrong.result.correctIndex, 0);
});

test("records the mistake against the stored option, not the shown position", async () => {
  const { statements } = await runGrading({ optionOrder: [2, 0, 3, 1], selected: 1, taskCorrect: 2 });
  const mistake = statements.find((s) => /^INSERT INTO student_mistakes/.test(s.text));
  assert.ok(mistake, "records a mistake");
  // Shown position 1 maps to stored option 0.
  assert.equal(mistake.params[4], 0);
});

test("still grades instances created before option shuffling", async () => {
  const { result } = await runGrading({ optionOrder: null, selected: 3, taskCorrect: 3 });
  assert.equal(result.correct, true);
  assert.equal(result.correctIndex, 3);
});

// Regression: a DATE column comes back as a JS Date, and String(date).slice(0,10)
// produced "Sun Aug 02", which Postgres rejected with
// `invalid input syntax for type date`, 500ing every answer for a student who
// already had a streak.
test("sends a valid ISO date when comparing against a stored streak day", async () => {
  const { statements } = await runGrading({
    optionOrder: null, selected: 0, taskCorrect: 0,
    streakLastDoneOn: new Date("2026-08-01T00:00:00Z"),
  });
  const dateCompare = statements.find((s) => /consecutive/.test(s.text));
  assert.ok(dateCompare, "compares the previous streak day");
  const previousDay = dateCompare.params[1];
  assert.match(previousDay, /^\d{4}-\d{2}-\d{2}$/, `expected ISO date, got ${previousDay}`);
});
