const db = require("./db");
const seed = require("./data/seed");

const XP_BY_DIFFICULTY = { easy: 10, medium: 15, hard: 25 };
const PET_DECAY_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PRACTICE_ANSWER_GRACE_MS = 12 * 60 * 60 * 1000;
const PET_DECAY_MAX_STEPS = 16;
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Europe/Moscow";

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
  if (!row) return null;
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
    accessKind: student.access_kind ?? null,
    trialStartedAt: student.trial_started_at ? student.trial_started_at.toISOString?.() ?? String(student.trial_started_at) : null,
    trialUsed: Boolean(student.trial_used),
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

async function ensure(student, executor = db) {
  // Only the profile row is created up front. Topic mastery is NOT pre-seeded:
  // a student's knowledge map stays empty until a diagnostic or practice
  // actually assesses a topic, so nothing fake is ever shown.
  await executor.query(
    `INSERT INTO student_profiles (student_id, onboarding_step)
     VALUES ($1, $2) ON CONFLICT (student_id) DO NOTHING`,
    [student.id, student.status === "active" && student.subject && student.grade ? "complete" : "subject"]
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
  if (!profileRow) {
    // ensure() upserts with ON CONFLICT DO NOTHING and this SELECT may land on a
    // different pooled connection, so a freshly created row can still be missing
    // here. Insert-returning rather than reading a half-built profile.
    const { rows: created } = await db.query(
      `INSERT INTO student_profiles (student_id, onboarding_step)
       VALUES ($1, $2)
       ON CONFLICT (student_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [student.id, student.status === "active" && student.subject && student.grade ? "complete" : "subject"]
    );
    profileRow = created[0];
  }
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
  const { rows: subjectRows } = await db.query(
    "SELECT subject, grade FROM student_subjects WHERE student_id = $1 ORDER BY created_at ASC",
    [student.id]
  );
  const profile = toProfile(profileRow, student);
  return {
    profile: {
      ...profile,
      // The legacy subject/grade fields remain the student's primary subject.
      // `subjects` is the source of truth for navigation in multi-subject accounts.
      subjects: subjectRows.length ? subjectRows : profile.subject ? [{ subject: profile.subject, grade: profile.grade }] : [],
    },
    topics,
  };
}

async function updateTopics(studentId, subject, updates, executor = db) {
  for (const update of updates) {
    const mastery = Math.max(0, Math.min(100, update.mastery));
    // UPSERT: the first assessment of a topic creates its row.
    await executor.query(
      `INSERT INTO student_topics (student_id, subject, topic_id, mastery, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id, subject, topic_id)
       DO UPDATE SET mastery = EXCLUDED.mastery, status = EXCLUDED.status, updated_at = now()`,
      [studentId, subject, update.topicId, mastery, statusFromMastery(mastery)]
    );
  }
}

async function submitDiagnostic(student, answers, subject, questions = null, executor = db) {
  const activeSubject = subject || student.subject || "Математика";
  const byTopic = new Map();
  const source = questions ?? seed.diagnostic;
  for (const answer of answers) {
    const question = source.find((item) => String(item.id) === String(answer.id));
    if (!question || question.subject !== activeSubject) continue;
    // A remembered rule is useful learning support, but it also signals that
    // this topic should stay in the student's practice route.
    const correct = answer.selected === question.correct && !answer.usedHelp;
    const stat = byTopic.get(question.topic) ?? { correct: 0, total: 0 };
    stat.total += 1;
    if (correct) stat.correct += 1;
    byTopic.set(question.topic, stat);
    await recordMistake(student.id, question, answer.selected, correct, executor);
  }
  await ensure(student, executor);
  await updateTopics(student.id, activeSubject, [...byTopic].map(([topicId, stat]) => ({
    topicId,
    // A single lucky answer must not mark a whole topic as mastered. The
    // neutral prior keeps 1/1 at 67%, while repeated evidence can reach green.
    mastery: Math.round(((stat.correct + 1) / (stat.total + 2)) * 100),
  })), executor);
  await executor.query("UPDATE student_profiles SET diagnostic_done = TRUE, onboarding_step = 'pet', updated_at = now() WHERE student_id = $1", [student.id]);
}

async function recordMistake(studentId, task, selected, correct, executor = db) {
  if (correct) {
    await executor.query(
      `UPDATE student_mistakes
       SET correct_count = correct_count + 1, updated_at = now()
       WHERE student_id = $1 AND task_id = $2`,
      [studentId, task.id]
    );
    return;
  }
  await executor.query(
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

async function gradePractice(student, task, selected, instanceId) {
  const outcome = await db.transaction(async (client) => {
    await ensure(student, client);
    const { rows: instances } = await client.query(
      `SELECT * FROM practice_question_instances
        WHERE id = $1 AND student_id = $2 AND task_id = $3
        FOR UPDATE`,
      [instanceId, student.id, task.id]
    );
    if (!instances.length) return { error: "practice_instance_invalid" };
    const instance = instances[0];
    if (instance.answered_at) {
      if (instance.selected !== selected) return { error: "practice_instance_already_answered" };
      return {
        correct: instance.correct,
        award: {
          gained: instance.award_xp,
          coins: instance.award_coins,
          leveledUp: instance.leveled_up,
          replayed: true,
        },
      };
    }
    // An instance is single-use and grading is idempotent, so a late answer is
    // harmless. Allow a grace period past expiry: a student who leaves a long
    // endless run open should not lose a correct answer to a clock boundary.
    const expiredAt = new Date(instance.expires_at).getTime();
    if (Date.now() > expiredAt + PRACTICE_ANSWER_GRACE_MS) {
      return { error: "practice_instance_expired" };
    }
    const hintsUsed = instance.hints_revealed;
    const correct = selected === task.correct;

    await client.query(
      `INSERT INTO attempts (student_id, task_id, selected, correct, practice_instance_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [student.id, task.id, selected, correct, instanceId]
    );
    await recordMistake(student.id, task, selected, correct, client);

    const { rows: topicRows } = await client.query(
      `SELECT mastery FROM student_topics
        WHERE student_id = $1 AND subject = $2 AND topic_id = $3
        FOR UPDATE`,
      [student.id, task.subject, task.topic]
    );
    const nextMastery = Math.max(
      0,
      Math.min(100, Number(topicRows[0]?.mastery ?? 0) + (correct ? Math.max(1, 6 - hintsUsed) : -4))
    );
    await updateTopics(student.id, task.subject, [{ topicId: task.topic, mastery: nextMastery }], client);

    const { rows: profileRows } = await client.query(
      "SELECT * FROM student_profiles WHERE student_id = $1 FOR UPDATE",
      [student.id]
    );
    const profile = profileRows[0];
    let award = { gained: 0, coins: 0, leveledUp: false, alreadyRewarded: false };
    const satietyDelta = correct ? -1 : -2;
    const moodDelta = correct ? 3 : -3;

    if (correct) {
      const { rows: dayRows } = await client.query(
        "SELECT (now() AT TIME ZONE $1)::date::text AS today",
        [APP_TIME_ZONE]
      );
      const today = dayRows[0].today;
      const rewardInsert = await client.query(
        `INSERT INTO practice_daily_awards (student_id, task_id, activity_day)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING task_id`,
        [student.id, task.id, today]
      );
      const rewardEligible = rewardInsert.rowCount === 1;
      const gained = rewardEligible
        ? Math.max(3, (XP_BY_DIFFICULTY[task.difficulty] ?? 10) - hintsUsed * 3)
        : 0;
      const coins = rewardEligible ? Math.round(gained / 2) : 0;
      let xp = profile.xp + gained;
      let level = profile.level;
      let xpFromLevel = profile.xp_from_level;
      let xpForNext = profile.xp_for_next;
      let leveledUp = false;
      while (xp >= xpForNext) {
        level += 1;
        leveledUp = true;
        xpFromLevel = xpForNext;
        xpForNext += 400 + level * 40;
      }
      const previousDay = profile.streak_last_done_on
        ? String(profile.streak_last_done_on).slice(0, 10)
        : null;
      const { rows: consecutiveRows } = previousDay
        ? await client.query("SELECT ($1::date - $2::date) = 1 AS consecutive", [today, previousDay])
        : { rows: [{ consecutive: false }] };
      const streak = previousDay === today
        ? profile.streak
        : previousDay && consecutiveRows[0].consecutive
          ? profile.streak + 1
          : 1;
      await client.query(
        `UPDATE student_profiles
         SET xp=$2, coins=coins+$3, level=$4, xp_from_level=$5, xp_for_next=$6,
             streak=$7, streak_last_done_on=$8,
             pet_bond=pet_bond+$9,
             pet_satiety=LEAST(100, GREATEST(0, pet_satiety+$10)),
             pet_mood=LEAST(100, GREATEST(0, pet_mood+$11)),
             pet_decay_checked_at=now(),
             updated_at=now()
         WHERE student_id=$1`,
        [student.id, xp, coins, level, xpFromLevel, xpForNext, streak, today,
          rewardEligible ? ({ easy: 1, medium: 2, hard: 3 }[task.difficulty] ?? 1) : 0,
          satietyDelta, moodDelta]
      );
      award = { gained, coins, leveledUp, alreadyRewarded: !rewardEligible };
    } else {
      await client.query(
        `UPDATE student_profiles
         SET pet_satiety=LEAST(100, GREATEST(0, pet_satiety+$2)),
             pet_mood=LEAST(100, GREATEST(0, pet_mood+$3)),
             pet_decay_checked_at=now(),
             updated_at=now()
         WHERE student_id=$1`,
        [student.id, satietyDelta, moodDelta]
      );
    }
    await client.query(
      `UPDATE practice_question_instances
          SET answered_at = now(), selected = $2, correct = $3,
              award_xp = $4, award_coins = $5, leveled_up = $6
        WHERE id = $1`,
      [instanceId, selected, correct, award.gained, award.coins, award.leveledUp]
    );
    return { correct, award };
  });
  if (outcome.error) return outcome;
  return { ...outcome, state: await getState(student, task.subject) };
}

async function buyItem(student, item) {
  const result = await db.transaction(async (client) => {
    await ensure(student, client);
    const { rows } = await client.query(
      "SELECT * FROM student_profiles WHERE student_id = $1 FOR UPDATE",
      [student.id]
    );
    const profile = rows[0];
    if (profile.coins < item.price) return { error: "not_enough_coins" };
    if (item.category === "food") {
      const foodInventory = {
        ...(profile.food_inventory ?? {}),
        [item.id]: Number(profile.food_inventory?.[item.id] ?? 0) + 1,
      };
      await client.query(
        `UPDATE student_profiles
            SET coins = coins - $2, food_inventory = $3, updated_at = now()
          WHERE student_id = $1 AND coins >= $2`,
        [student.id, item.price, JSON.stringify(foodInventory)]
      );
      return {};
    }
    const ownedItems = Array.isArray(profile.owned_items) ? profile.owned_items : [];
    if (ownedItems.includes(item.id)) return { error: "already_owned" };
    await client.query(
      `UPDATE student_profiles
          SET coins = coins - $2, owned_items = $3, updated_at = now()
        WHERE student_id = $1 AND coins >= $2`,
      [student.id, item.price, JSON.stringify([...ownedItems, item.id])]
    );
    return {};
  });
  if (result.error) return result;
  return { state: await getState(student) };
}

async function feedPet(student, itemId) {
  const item = seed.shopItems.find((entry) => entry.id === itemId && entry.category === "food");
  if (!item) return { error: "item_not_found" };
  const result = await db.transaction(async (client) => {
    await ensure(student, client);
    const { rows } = await client.query(
      "SELECT food_inventory FROM student_profiles WHERE student_id = $1 FOR UPDATE",
      [student.id]
    );
    const currentInventory = rows[0]?.food_inventory ?? {};
    const currentAmount = Number(currentInventory[item.id] ?? 0);
    if (currentAmount <= 0) return { error: "food_not_available" };
    const foodInventory = { ...currentInventory };
    if (currentAmount <= 1) delete foodInventory[item.id];
    else foodInventory[item.id] = currentAmount - 1;
    const effect = foodEffect(item);
    await client.query(
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
    return {};
  });
  if (result.error) return result;
  return { state: await getState(student) };
}

async function renamePet(student, name) {
  const trimmed = String(name ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24);
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
  const result = await db.transaction(async (client) => {
    await ensure(student, client);
    const { rows } = await client.query(
      "SELECT * FROM student_profiles WHERE student_id = $1 FOR UPDATE",
      [student.id]
    );
    const profile = rows[0];
    const nextSpecies = species ?? profile.pet_species;
    const changesSpecies = species !== undefined && species !== profile.pet_species;
    const changePrice = profile.pet_selected && changesSpecies ? 100 : 0;
    if (changePrice && profile.coins < changePrice) return { error: "not_enough_coins" };
    const nextName = name === undefined
      ? profile.pet_name
      : String(name).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24);
    if (!nextName) return { error: "name_required" };
    let nextWorn = profile.worn_items ?? {};
    if (wornItems && typeof wornItems === "object" && !Array.isArray(wornItems)) {
      const ownedItems = Array.isArray(profile.owned_items) ? profile.owned_items : [];
      const ownedLooks = seed.shopItems.filter((item) =>
        ownedItems.includes(item.id) && item.slot && item.accessory
      );
      const allowedSlots = new Set(seed.shopItems.map((item) => item.slot).filter(Boolean));
      nextWorn = Object.fromEntries(
        Object.entries(wornItems).filter(([slot, accessory]) =>
          allowedSlots.has(slot) &&
          (accessory === null || ownedLooks.some((item) => item.slot === slot && item.accessory === accessory))
        )
      );
    }
    const nextOnboarding = species !== undefined && !profile.pet_selected
      ? (student.status === "active" ? "complete" : "trial")
      : profile.onboarding_step;
    const updated = await client.query(
      `UPDATE student_profiles
       SET pet_species = $2, worn_items = $3, pet_name = $4,
           pet_selected = pet_selected OR $5,
           onboarding_step = $7,
           coins = coins - $6, updated_at = now()
       WHERE student_id = $1 AND coins >= $6
       RETURNING student_id`,
      [student.id, nextSpecies, JSON.stringify(nextWorn), nextName, species !== undefined, changePrice, nextOnboarding]
    );
    return updated.rowCount ? {} : { error: "not_enough_coins" };
  });
  if (result.error) return result;
  return { state: await getState(student) };
}

module.exports = { ensure, getState, submitDiagnostic, gradePractice, buyItem, feedPet, renamePet, updatePet };
