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
  await db.query(
    `INSERT INTO student_profiles (student_id)
     VALUES ($1) ON CONFLICT (student_id) DO NOTHING`,
    [student.id]
  );
  for (const topic of seed.topics) {
    await db.query(
      `INSERT INTO student_topics (student_id, topic_id, mastery, status)
       VALUES ($1,$2,$3,$4) ON CONFLICT (student_id, topic_id) DO NOTHING`,
      [student.id, topic.id, topic.mastery, topic.status]
    );
  }
}

async function getState(student) {
  await ensure(student);
  const { rows: profiles } = await db.query("SELECT * FROM student_profiles WHERE student_id = $1", [student.id]);
  const { rows: topicRows } = await db.query("SELECT * FROM student_topics WHERE student_id = $1", [student.id]);
  const byId = new Map(topicRows.map((topic) => [topic.topic_id, topic]));
  const topics = seed.topics.map((topic) => ({ ...topic, ...byId.get(topic.id), id: topic.id }));
  return { profile: toProfile(profiles[0], student), topics };
}

async function updateTopics(studentId, updates) {
  for (const update of updates) {
    const mastery = Math.max(0, Math.min(100, update.mastery));
    await db.query(
      `UPDATE student_topics SET mastery = $3, status = $4, updated_at = now()
       WHERE student_id = $1 AND topic_id = $2`,
      [studentId, update.topicId, mastery, statusFromMastery(mastery)]
    );
  }
}

async function submitDiagnostic(student, answers) {
  const byTopic = new Map();
  for (const answer of answers) {
    const question = seed.diagnostic.find((item) => item.id === answer.id);
    if (!question) continue;
    const stat = byTopic.get(question.topic) ?? { correct: 0, total: 0 };
    stat.total += 1;
    if (answer.selected === question.correct) stat.correct += 1;
    byTopic.set(question.topic, stat);
  }
  await ensure(student);
  await updateTopics(student.id, [...byTopic].map(([topicId, stat]) => ({
    topicId,
    mastery: Math.round((stat.correct / stat.total) * 100),
  })));
  await db.query("UPDATE student_profiles SET diagnostic_done = TRUE, updated_at = now() WHERE student_id = $1", [student.id]);
  return getState(student);
}

async function gradePractice(student, task, selected, hintsUsed, attempts) {
  await ensure(student);
  const correct = selected === task.correct;
  await db.query(
    "INSERT INTO attempts (student_id, task_id, selected, correct) VALUES ($1,$2,$3,$4)",
    [student.id, task.id, selected, correct]
  );
  const state = await getState(student);
  const topic = state.topics.find((item) => item.id === task.topic);
  const nextMastery = Math.max(0, Math.min(100, (topic?.mastery ?? 0) + (correct ? 6 - hintsUsed : -4)));
  await updateTopics(student.id, [{ topicId: task.topic, mastery: nextMastery }]);

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
  return { correct, award, state: await getState(student) };
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

module.exports = { ensure, getState, submitDiagnostic, gradePractice, buyItem };
