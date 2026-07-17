const db = require("./db");
const seed = require("./data/seed");

const XP_BY_DIFFICULTY = { easy: 10, medium: 15, hard: 25 };
const PET_DECAY_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PET_DECAY_MAX_STEPS = 16;

function statusFromMastery(mastery) {
  return mastery >= 75 ? "green" : mastery >= 50 ? "yellow" : "red";
}

function clampStat(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function foodEffect(item) {
  return item?.effect ?? { satiety: 24, mood: 6 };
}

function petDecay(row) {
  const lastChecked = row.pet_decay_checked_at ? new Date(row.pet_decay_checked_at).getTime() : Date.now();
  const steps = Math.min(PET_DECAY_MAX_STEPS, Math.floor((Date.now() - lastChecked) / PET_DECAY_INTERVAL_MS));
  if (steps <= 0) return null;
  const satiety = clampStat((row.pet_satiety ?? 80) - steps * 4);
  const hungerPenalty = satiety < 30 ? steps * 2 : 0;
  const mood = clampStat((row.pet_mood ?? 80) - steps * 2 - hungerPenalty);
  return { steps, satiety, mood };
}

function profileDefaults() {
  return {
    xp: 0,
    coins: 0,
    level: 1,
    xpFromLevel: 0,
    xpForNext: 400,
    streak: 0,
    streakFreezeUsed: false,
    pet: { species: "fox", name: "Рыжик" },
    petBond: 0,
    petStats: { satiety: 80, mood: 80 },
    foodInventory: {},
    ownedItems: [],
    wornItems: {},
    diagnosticDone: false,
  };
}

function toProfile(row, student) {
  return {
    ...profileDefaults(),
    name: student.name,
    grade: student.grade,
    subject: student.subject,
    status: student.status,
    accessUntil: student.access_until ? student.access_until.toISOString?.() ?? String(student.access_until) : null,
    xp: row.xp,
    coins: row.coins,
    level: row.level,
    xpFromLevel: row.xp_from_level,
    xpForNext: row.xp_for_next,
    streak: row.streak,
    streakLastDoneOn: row.streak_last_done_on ? row.streak_last_done_on.toISOString?.().slice(0, 10) ?? String(row.streak_last_done_on) : null,
    streakFreezeUsed: row.streak_freeze_used,
    pet: { species: row.pet_species, name: row.pet_name },
    petBond: row.pet_bond ?? 0,
    petStats: {
      satiety: clampStat(row.pet_satiety ?? 80),
      mood: clampStat(row.pet_mood ?? 80),
    },
    petSelected: row.pet_selected,
    onboardingStep: row.onboarding_step,
    foodInventory: row.food_inventory ?? {},
    ownedItems: row.owned_items ?? [],
    wornItems: row.worn_items ?? {},
    diagnosticDone: row.diagnostic_done,
  };
}

async function ensure(student) {
  // Only the profile row is created up front. Topic mastery is NOT pre-seeded:
  // a student's knowledge map stays empty until a diagnostic or practice
  // actually assesses a topic, so nothing fake is ever shown.
  await db.query(
    `INSERT INTO student_profiles (student_id, onboarding_step)
     VALUES ($1, 'subject') ON CONFLICT (student_id) DO NOTHING`,
    [student.id]
  );
}

// Curriculum taxonomy ("subject:topicId" → display name) lives in seed;
// mastery is per-student. Keyed by subject too since two subjects could
// reuse the same topic id.
const TOPIC_NAME = new Map(seed.topics.map((topic) => [`${topic.subject}:${topic.id}`, topic.name]));

// `subject` filters the knowledge map to one subject's topics (used by
// Practice/Diagnostic, which need to know which task bank they're in).
// Omitted = topics across every subject the student has been assessed on
// (used by Profile/Dashboard's combined view).
async function getState(student, subject = null) {
  await ensure(student);
  const { rows: profiles } = await db.query("SELECT * FROM student_profiles WHERE student_id = $1", [student.id]);
  let profileRow = profiles[0];
  const decay = petDecay(profileRow);
  if (decay) {
    const { rows: decayed } = await db.query(
      `UPDATE student_profiles
       SET pet_satiety = $2,
           pet_mood = $3,
           pet_decay_checked_at = now(),
           updated_at = now()
       WHERE student_id = $1
       RETURNING *`,
      [student.id, decay.satiety, decay.mood]
    );
    profileRow = decayed[0] ?? profileRow;
  }
  const params = subject ? [student.id, subject] : [student.id];
  const { rows: topicRows } = await db.query(
    `SELECT * FROM student_topics WHERE student_id = $1 ${subject ? "AND subject = $2" : ""} ORDER BY mastery ASC`,
    params
  );
  // Return only topics the student has actually been assessed on.
  const topics = topicRows.map((row) => ({
    id: row.topic_id,
    name: TOPIC_NAME.get(`${row.subject}:${row.topic_id}`) ?? row.topic_id,
    subject: row.subject,
    mastery: row.mastery,
    status: row.status,
  }));
  return { profile: toProfile(profileRow, student), topics };
}

async function updateTopics(studentId, subject, updates) {
  for (const update of updates) {
    const mastery = Math.max(0, Math.min(100, update.mastery));
    // UPSERT: the first assessment of a topic creates its row.
    await db.query(
      `INSERT INTO student_topics (student_id, subject, topic_id, mastery, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id, subject, topic_id)
       DO UPDATE SET mastery = EXCLUDED.mastery, status = EXCLUDED.status, updated_at = now()`,
      [studentId, subject, update.topicId, mastery, statusFromMastery(mastery)]
    );
  }
}

async function submitDiagnostic(student, answers, subject, questions = null) {
  const activeSubject = subject || student.subject || "Математика";
  const byTopic = new Map();
  const source = questions ?? seed.diagnostic;
  for (const answer of answers) {
    const question = source.find((item) => String(item.id) === String(answer.id));
    if (!question || question.subject !== activeSubject) continue;
    // A remembered rule is useful learning support, but it also signals that
    // this topic should stay in the student's practice route.
    const correct = answer.selected === question.correct && !answer.usedHelp;
    // Diagnostic only discovers gaps. A correct one-off answer is not enough
    // evidence to add a topic to the knowledge map; practice builds mastery.
    if (!correct) {
      const stat = byTopic.get(question.topic) ?? { correct: 0, total: 0 };
      stat.total += 1;
      byTopic.set(question.topic, stat);
    }
    await recordMistake(student.id, question, answer.selected, correct);
  }
  await ensure(student);
  await updateTopics(student.id, activeSubject, [...byTopic].map(([topicId, stat]) => ({
    topicId,
    // A single lucky answer must not mark a whole topic as mastered. The
    // neutral prior keeps 1/1 at 67%, while repeated evidence can reach green.
    mastery: Math.round(((stat.correct + 1) / (stat.total + 2)) * 100),
  })));
  await db.query("UPDATE student_profiles SET diagnostic_done = TRUE, onboarding_step = 'pet', updated_at = now() WHERE student_id = $1", [student.id]);
  return getState(student, activeSubject);
}

async function recordMistake(studentId, task, selected, correct) {
  if (correct) {
    await db.query(
      `UPDATE student_mistakes
       SET correct_count = correct_count + 1, updated_at = now()
       WHERE student_id = $1 AND task_id = $2`,
      [studentId, task.id]
    );
    return;
  }
  await db.query(
    `INSERT INTO student_mistakes
       (student_id, task_id, subject, topic, wrong_count, last_selected)
     VALUES ($1, $2, $3, $4, 1, $5)
     ON CONFLICT (student_id, task_id) DO UPDATE
       SET wrong_count = student_mistakes.wrong_count + 1,
           last_selected = EXCLUDED.last_selected,
           last_wrong_at = now(), updated_at = now()`,
    [studentId, task.id, task.subject, task.topic, Number.isInteger(selected) ? selected : null]
  );
}

async function gradePractice(student, task, selected, hintsUsed, attempts) {
  await ensure(student);
  const correct = selected === task.correct;
  await db.query(
    "INSERT INTO attempts (student_id, task_id, selected, correct) VALUES ($1,$2,$3,$4)",
    [student.id, task.id, selected, correct]
  );
  await recordMistake(student.id, task, selected, correct);
  const state = await getState(student, task.subject);
  const topic = state.topics.find((item) => item.id === task.topic);
  const nextMastery = Math.max(0, Math.min(100, (topic?.mastery ?? 0) + (correct ? 6 - hintsUsed : -4)));
  await updateTopics(student.id, task.subject, [{ topicId: task.topic, mastery: nextMastery }]);

  let award = { gained: 0, coins: 0, leveledUp: false };
  const satietyDelta = correct ? -1 : -2;
  const moodDelta = correct ? 3 : -3;
  if (correct) {
    const gained = Math.max(3, (XP_BY_DIFFICULTY[task.difficulty] ?? 10) - hintsUsed * 3 - attempts * 2);
    const coins = Math.round(gained / 2);
    const profile = state.profile;
    let xp = profile.xp + gained;
    let level = profile.level;
    let xpFromLevel = profile.xpFromLevel;
    let xpForNext = profile.xpForNext;
    let leveledUp = false;
    while (xp >= xpForNext) {
      level += 1;
      leveledUp = true;
      xpFromLevel = xpForNext;
      xpForNext += 400 + level * 40;
    }
    const today = new Date().toISOString().slice(0, 10);
    const previousDay = profile.streakLastDoneOn;
    let streak = profile.streak;
    if (previousDay !== today) streak = previousDay ? (new Date(`${today}T00:00:00Z`) - new Date(`${previousDay}T00:00:00Z`) === 86400000 ? streak + 1 : 1) : 1;
    await db.query(
      `UPDATE student_profiles
       SET xp=$2, coins=coins+$3, level=$4, xp_from_level=$5, xp_for_next=$6,
           streak=$7, streak_last_done_on=$8,
           pet_bond=pet_bond+$9,
           pet_satiety=LEAST(100, GREATEST(0, pet_satiety+$10)),
           pet_mood=LEAST(100, GREATEST(0, pet_mood+$11)),
           pet_decay_checked_at=now(),
           updated_at=now()
       WHERE student_id=$1`,
      [student.id, xp, coins, level, xpFromLevel, xpForNext, streak, today, { easy: 1, medium: 2, hard: 3 }[task.difficulty] ?? 1, satietyDelta, moodDelta]
    );
    award = { gained, coins, leveledUp };
  } else {
    await db.query(
      `UPDATE student_profiles
       SET pet_satiety=LEAST(100, GREATEST(0, pet_satiety+$2)),
           pet_mood=LEAST(100, GREATEST(0, pet_mood+$3)),
           pet_decay_checked_at=now(),
           updated_at=now()
       WHERE student_id=$1`,
      [student.id, satietyDelta, moodDelta]
    );
  }
  return { correct, award, state: await getState(student, task.subject) };
}

async function buyItem(student, item) {
  const state = await getState(student);
  if (item.category === "food") {
    if (state.profile.coins < item.price) return { error: "not_enough_coins" };
    const foodInventory = {
      ...(state.profile.foodInventory ?? {}),
      [item.id]: Number(state.profile.foodInventory?.[item.id] ?? 0) + 1,
    };
    await db.query(
      "UPDATE student_profiles SET coins = coins - $2, food_inventory = $3, updated_at = now() WHERE student_id = $1",
      [student.id, item.price, JSON.stringify(foodInventory)]
    );
    return { state: await getState(student) };
  }
  if (state.profile.ownedItems.includes(item.id)) return { error: "already_owned" };
  if (state.profile.coins < item.price) return { error: "not_enough_coins" };
  const ownedItems = [...state.profile.ownedItems, item.id];
  await db.query(
    "UPDATE student_profiles SET coins = coins - $2, owned_items = $3, updated_at = now() WHERE student_id = $1",
    [student.id, item.price, JSON.stringify(ownedItems)]
  );
  return { state: await getState(student) };
}

async function feedPet(student, itemId) {
  const item = seed.shopItems.find((entry) => entry.id === itemId && entry.category === "food");
  if (!item) return { error: "item_not_found" };
  const state = await getState(student);
  const currentAmount = Number(state.profile.foodInventory?.[item.id] ?? 0);
  if (currentAmount <= 0) return { error: "food_not_available" };
  const foodInventory = { ...(state.profile.foodInventory ?? {}) };
  if (currentAmount <= 1) delete foodInventory[item.id];
  else foodInventory[item.id] = currentAmount - 1;
  const effect = foodEffect(item);
  await db.query(
    `UPDATE student_profiles
     SET food_inventory = $2,
         pet_satiety = LEAST(100, GREATEST(0, pet_satiety + $3)),
         pet_mood = LEAST(100, GREATEST(0, pet_mood + $4)),
         pet_bond = pet_bond + 1,
         pet_decay_checked_at = now(),
         updated_at = now()
     WHERE student_id = $1`,
    [student.id, JSON.stringify(foodInventory), effect.satiety ?? 24, effect.mood ?? 6]
  );
  return { state: await getState(student) };
}

async function renamePet(student, name) {
  const trimmed = String(name ?? "").trim().slice(0, 24);
  if (!trimmed) return { error: "name_required" };
  await ensure(student);
  await db.query(
    "UPDATE student_profiles SET pet_name = $2, updated_at = now() WHERE student_id = $1",
    [student.id, trimmed]
  );
  return { state: await getState(student) };
}

async function updatePet(student, { species, wornItems, name } = {}) {
  const allowedSpecies = new Set(["fox", "raccoon", "squirrel", "owl", "cat"]);
  if (species !== undefined && !allowedSpecies.has(species)) return { error: "invalid_species" };
  const state = await getState(student);
  const nextSpecies = species ?? state.profile.pet.species;
  const changesSpecies = species !== undefined && species !== state.profile.pet.species;
  const changePrice = state.profile.petSelected && changesSpecies ? 100 : 0;
  if (changePrice && state.profile.coins < changePrice) return { error: "not_enough_coins" };
  const nextName = name === undefined ? state.profile.pet.name : String(name).trim().slice(0, 24);
  if (!nextName) return { error: "name_required" };
  let nextWorn = state.profile.wornItems;
  if (wornItems && typeof wornItems === "object" && !Array.isArray(wornItems)) {
    const ownedLooks = seed.shopItems.filter((item) =>
      state.profile.ownedItems.includes(item.id) && item.slot && item.accessory
    );
    nextWorn = Object.fromEntries(
      Object.entries(wornItems).filter(([slot, accessory]) =>
        accessory === null || ownedLooks.some((item) => item.slot === slot && item.accessory === accessory)
      )
    );
  }
  await db.query(
    `UPDATE student_profiles
     SET pet_species = $2, worn_items = $3, pet_name = $4,
         pet_selected = pet_selected OR $5,
         onboarding_step = CASE WHEN $5 THEN 'complete' ELSE onboarding_step END,
         coins = coins - $6, updated_at = now()
     WHERE student_id = $1`,
    [student.id, nextSpecies, JSON.stringify(nextWorn), nextName, species !== undefined, changePrice]
  );
  return { state: await getState(student) };
}

module.exports = { ensure, getState, submitDiagnostic, gradePractice, buyItem, feedPet, renamePet, updatePet };
