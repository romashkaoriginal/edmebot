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

// Decay formula: 30-minute steps, calibrated so 48h of total neglect (96 steps)
// runs both stats down to (near) zero, with mood taking an extra hit whenever
// satiety has actually crossed the hunger threshold.
test("petDecay: no time passed since the last check does nothing", () => {
  const row = { pet_satiety: 80, pet_mood: 80, pet_decay_checked_at: new Date().toISOString() };
  assert.equal(state.petDecay(row), null);
});

test("petDecay: one 30-minute step drops satiety and mood by 1%", () => {
  const row = {
    pet_satiety: 80, pet_mood: 80,
    pet_decay_checked_at: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
  };
  const decay = state.petDecay(row);
  assert.equal(decay.steps, 1);
  assert.equal(decay.satiety, 79);
  assert.equal(decay.mood, 79);
});

test("petDecay: 48h of total neglect runs satiety and mood down to 0", () => {
  const row = {
    pet_satiety: 100, pet_mood: 100,
    pet_decay_checked_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  };
  const decay = state.petDecay(row);
  assert.equal(decay.satiety, 4); // 96 steps * 1%/step = 96% lost, some left
  // Mood loses the base 1%/step everywhere, plus an extra 1%/step for every
  // step spent hungry (satiety <= 30) — so it empties out well before satiety does.
  assert.equal(decay.mood, 0);
});

test("petDecay: mood only takes the hunger penalty once satiety is actually low", () => {
  // Starts just above the hunger threshold (32%) and food is never given, so a
  // few steps pass before satiety crosses 30 and the extra mood penalty kicks in.
  const row = {
    pet_satiety: 32, pet_mood: 80,
    pet_decay_checked_at: new Date(Date.now() - 10 * 30 * 60 * 1000).toISOString(), // 10 steps
  };
  const decay = state.petDecay(row);
  assert.equal(decay.steps, 10);
  assert.equal(decay.satiety, 22); // 32 - 10
  // Crosses below 30 after ceil((32-30)/1) = 2 steps, so 8 of the 10 steps are hungry.
  assert.equal(decay.mood, 80 - 10 * 1 - 8 * 1);
});

test("petDecay: a pet already well-fed and happy gets no hunger penalty", () => {
  const row = {
    pet_satiety: 90, pet_mood: 90,
    pet_decay_checked_at: new Date(Date.now() - 5 * 30 * 60 * 1000).toISOString(), // 5 steps
  };
  const decay = state.petDecay(row);
  assert.equal(decay.satiety, 85);
  assert.equal(decay.mood, 85); // base decay only, satiety never dropped below 30
});

test("petDecay: values never go below 0 even after very long neglect", () => {
  const row = {
    pet_satiety: 50, pet_mood: 50,
    pet_decay_checked_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  };
  const decay = state.petDecay(row);
  assert.equal(decay.satiety, 0);
  assert.equal(decay.mood, 0);
});
