const test = require("node:test");
const assert = require("node:assert/strict");
const state = require("../src/studentState");

// Regression: grading a practice answer 500'd because getState read the profile
// on a fresh pooled connection that could not yet see the row ensure() had just
// upserted, and petDecay dereferenced the undefined result.
test("getState rebuilds the profile when the first select finds no row", async () => {
  const seen = [];
  const profileRow = {
    student_id: 1, xp: 25, coins: 13, level: 1, xp_from_level: 0, xp_for_next: 440,
    streak: 1, streak_last_done_on: "2026-08-02", streak_freeze_used: false,
    pet_species: "fox", pet_name: "Рыжик", pet_bond: 0, pet_satiety: 80, pet_mood: 80,
    pet_selected: true, onboarding_step: "complete", food_inventory: {}, owned_items: [],
    worn_items: {}, diagnostic_done: true, pet_decay_checked_at: new Date().toISOString(),
  };
  const db = require("../src/db");
  const originalQuery = db.query;
  db.query = async (text, params) => {
    const first = String(text).trim().split("\n")[0];
    seen.push(first);
    if (/^SELECT \* FROM student_profiles/.test(first)) return { rows: [], rowCount: 0 };
    if (/^INSERT INTO student_profiles/.test(first) && /RETURNING/i.test(text)) {
      return { rows: [{ ...profileRow, student_id: params[0] }], rowCount: 1 };
    }
    if (/AT TIME ZONE/.test(text)) return { rows: [{ today: "2026-08-02" }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  try {
    const student = { id: 1, status: "active", name: "Тест", subject: "Математика", grade: 7 };
    const result = await state.getState(student, "Математика");
    assert.equal(result.profile.xp, 25);
    assert.ok(seen.some((sql) => /^INSERT INTO student_profiles/.test(sql)));
  } finally {
    db.query = originalQuery;
  }
});
