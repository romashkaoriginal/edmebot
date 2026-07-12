const db = require("./db");
const seed = require("./data/seed");

const XP_BY_DIFFICULTY = { easy: 10, medium: 15, hard: 25 };

function statusFromMastery(mastery) {
  return mastery >= 75 ? "green" : mastery >= 50 ? "yellow" : "red";
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
    xp: row.xp,
    coins: row.coins,
    level: row.level,
    xpFromLevel: row.xp_from_level,
    xpForNext: row.xp_for_next,
    streak: row.streak,
    streakLastDoneOn: row.streak_last_done_on ? row.streak_last_done_on.toISOString?.().slice(0, 10) ?? String(row.streak_last_done_on) : null,
    streakFreezeUsed: row.streak_freeze_used,
    pet: { species: row.pet_species, name: row.pet_name },
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
    `INSERT INTO student_profiles (student_id)
     VALUES ($1) ON CONFLICT (student_id) DO NOTHING`,
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
  return { profile: toProfile(profiles[0], student), topics };
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

async function submitDiagnostic(student, answers, subject) {
  const activeSubject = subject || student.subject || "Математика";
  const byTopic = new Map();
  for (const answer of answers) {
    const question = seed.diagnostic.find((item) => item.id === answer.id);
    if (!question || question.subject !== activeSubject) continue;
    const stat = byTopic.get(question.topic) ?? { correct: 0, total: 0 };
    stat.total += 1;
    if (answer.selected === question.correct) stat.correct += 1;
    byTopic.set(question.topic, stat);
  }
  await ensure(student);
  await updateTopics(student.id, activeSubject, [...byTopic].map(([topicId, stat]) => ({
    topicId,
    mastery: Math.round((stat.correct / stat.total) * 100),
  })));
  await db.query("UPDATE student_profiles SET diagnostic_done = TRUE, updated_at = now() WHERE student_id = $1", [student.id]);
  return getState(student, activeSubject);
}

async function gradePractice(student, task, selected, hintsUsed, attempts) {
  await ensure(student);
  const correct = selected === task.correct;
  await db.query(
    "INSERT INTO attempts (student_id, task_id, selected, correct) VALUES ($1,$2,$3,$4)",
    [student.id, task.id, selected, correct]
  );
  const state = await getState(student, task.subject);
  const topic = state.topics.find((item) => item.id === task.topic);
  const nextMastery = Math.max(0, Math.min(100, (topic?.mastery ?? 0) + (correct ? 6 - hintsUsed : -4)));
  await updateTopics(student.id, task.subject, [{ topicId: task.topic, mastery: nextMastery }]);

  let award = { gained: 0, coins: 0, leveledUp: false };
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
           streak=$7, streak_last_done_on=$8, updated_at=now()
       WHERE student_id=$1`,
      [student.id, xp, coins, level, xpFromLevel, xpForNext, streak, today]
    );
    award = { gained, coins, leveledUp };
  }
  return { correct, award, state: await getState(student, task.subject) };
}

async function buyItem(student, item) {
  const state = await getState(student);
  if (state.profile.ownedItems.includes(item.id)) return { error: "already_owned" };
  if (state.profile.coins < item.price) return { error: "not_enough_coins" };
  const ownedItems = [...state.profile.ownedItems, item.id];
  await db.query(
    "UPDATE student_profiles SET coins = coins - $2, owned_items = $3, updated_at = now() WHERE student_id = $1",
    [student.id, item.price, JSON.stringify(ownedItems)]
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

module.exports = { ensure, getState, submitDiagnostic, gradePractice, buyItem, renamePet };
