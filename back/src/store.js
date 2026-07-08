// In-memory store with rule-based game logic. No AI, no database — demo state.
const seed = require("./data/seed");

const state = {
  profile: { ...seed.profile, ownedItems: [...seed.profile.ownedItems] },
  topics: seed.topics.map((t) => ({ ...t })),
  homework: seed.homework.map((h) => ({ ...h })),
};

const XP_BY_DIFFICULTY = { easy: 10, medium: 15, hard: 25 };

function statusFromMastery(m) {
  return m >= 75 ? "green" : m >= 50 ? "yellow" : "red";
}

function adjustMastery(topicId, delta) {
  const t = state.topics.find((x) => x.id === topicId);
  if (!t) return;
  t.mastery = Math.max(0, Math.min(100, t.mastery + delta));
  t.status = statusFromMastery(t.mastery);
}

// Award XP with level-up handling; returns the resulting profile snapshot + flags.
function awardXp(amount, coins = 0) {
  const p = state.profile;
  p.xp += amount;
  p.coins += coins;
  let leveledUp = false;
  while (p.xp >= p.xpForNext) {
    p.level += 1;
    leveledUp = true;
    p.xpFromLevel = p.xpForNext;
    p.xpForNext = p.xpForNext + 400 + p.level * 40;
  }
  return { leveledUp, xp: p.xp, level: p.level, coins: p.coins };
}

// Grade a practice answer. Rule-based XP: base by difficulty minus hint/attempt penalties.
function gradeAnswer({ taskId, selected, hintsUsed = 0, attempts = 0 }) {
  const task = seed.taskBank.find((t) => t.id === taskId);
  if (!task) return { error: "task_not_found" };
  const correct = selected === task.correct;

  let award = { leveledUp: false, gained: 0, coins: 0 };
  if (correct) {
    const base = XP_BY_DIFFICULTY[task.difficulty] ?? 10;
    const gained = Math.max(3, base - hintsUsed * 3 - attempts * 2);
    const coins = Math.round(gained / 2);
    const res = awardXp(gained, coins);
    award = { ...res, gained, coins };
    adjustMastery(task.topic, 6 - hintsUsed);
    state.profile.solvedTotal += 1;
  } else {
    adjustMastery(task.topic, -4);
  }

  return {
    correct,
    correctIndex: task.correct,
    explanation: task.explanation,
    commonMistake: correct ? null : task.commonMistake,
    award,
    profile: publicProfile(),
  };
}

// Rule-based practice series builder (no AI).
function buildSeries({ mode = "weak", topic = null, length = 5 } = {}) {
  let pool = [...seed.taskBank];
  if (mode === "topic" && topic) {
    pool = pool.filter((t) => t.topic === topic);
  } else if (mode === "weak") {
    const weak = state.topics.filter((t) => t.status !== "green").map((t) => t.id);
    const weakPool = pool.filter((t) => weak.includes(t.topic));
    if (weakPool.length) pool = weakPool;
  }
  if (!pool.length) pool = [...seed.taskBank];
  const series = [];
  for (let i = 0; series.length < length; i++) series.push(pool[i % pool.length]);
  // Strip answers/explanations from the payload sent before grading.
  return series.map(({ correct, explanation, commonMistake, ...rest }) => rest);
}

// Score a full diagnostic → knowledge map.
function scoreDiagnostic(answers) {
  // answers: [{ id, selected|null }]
  const byTopic = {};
  for (const a of answers) {
    const q = seed.diagnostic.find((d) => d.id === a.id);
    if (!q) continue;
    byTopic[q.topic] ??= { correct: 0, total: 0 };
    byTopic[q.topic].total += 1;
    if (a.selected === q.correct) byTopic[q.topic].correct += 1;
  }
  const map = state.topics.map((t) => {
    const s = byTopic[t.id];
    if (!s || !s.total) return { ...t };
    const mastery = Math.round((s.correct / s.total) * 100);
    return { ...t, mastery, status: statusFromMastery(mastery) };
  });
  // Persist the new map + mark diagnostic done.
  state.topics = map.map((t) => ({ ...t }));
  state.profile.diagnosticDone = true;
  return map;
}

function buyItem(itemId) {
  const item = seed.shopItems.find((s) => s.id === itemId);
  if (!item) return { error: "item_not_found" };
  const p = state.profile;
  if (p.ownedItems.includes(itemId)) return { error: "already_owned" };
  if (p.coins < item.price) return { error: "not_enough_coins" };
  p.coins -= item.price;
  p.ownedItems.push(itemId);
  return { ok: true, coins: p.coins, ownedItems: p.ownedItems };
}

function completeHomework(id) {
  const h = state.homework.find((x) => x.id === id);
  if (!h) return { error: "not_found" };
  h.status = "done";
  return { ok: true, homework: h };
}

function publicProfile() {
  return { ...state.profile };
}

module.exports = {
  state,
  publicProfile,
  gradeAnswer,
  buildSeries,
  scoreDiagnostic,
  buyItem,
  completeHomework,
  awardXp,
};
