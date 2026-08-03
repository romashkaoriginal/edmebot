// Postgres (Supabase) access layer. Uses a single pooled connection.
// Schema is migrated on startup (CREATE TABLE IF NOT EXISTS) and seeded idempotently.
const { Pool } = require("pg");
const seed = require("./data/seed");
const { SUBJECT_VARIANTS } = require("./subjects");
const { buildDatabaseConfig } = require("./utils/databaseConfig");

const connectionString = process.env.DATABASE_URL;
// Bump whenever SCHEMA changes. init() skips the whole schema block when the
// recorded version is already current, so a new CREATE/ALTER never reaches an
// existing database unless this number moves.
const SCHEMA_VERSION = 3;
const databaseConfig = buildDatabaseConfig(connectionString);
const pool = new Pool(databaseConfig);

async function query(text, params) {
  return pool.query(text, params);
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  id          BIGSERIAL PRIMARY KEY,
  tg_id       TEXT UNIQUE,
  name        TEXT NOT NULL,
  grade       INTEGER,
  subject     TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active')),
  access_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The first deployed version used full_name and did not store Telegram ids.
-- CREATE TABLE IF NOT EXISTS leaves an existing table untouched, therefore
-- upgrade that schema before any query below refers to the current columns.
ALTER TABLE students ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS tg_id TEXT UNIQUE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'full_name'
  ) THEN
    UPDATE students SET name = full_name WHERE name IS NULL;
    ALTER TABLE students ALTER COLUMN full_name DROP NOT NULL;
  END IF;
END $$;
UPDATE students SET name = 'Без имени' WHERE name IS NULL;
ALTER TABLE students ALTER COLUMN name SET NOT NULL;

-- Legacy columns were NOT NULL; self-serve onboarding creates a student
-- before a subject/grade is chosen, so both must be nullable.
ALTER TABLE students ALTER COLUMN grade DROP NOT NULL;
ALTER TABLE students ALTER COLUMN subject DROP NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'tutor_id'
  ) THEN
    ALTER TABLE students ALTER COLUMN tutor_id DROP NOT NULL;
  END IF;
END $$;

-- First/last name split. The name column stays populated ("Имя Фамилия") for
-- back-compat with everything that reads students.name (pet, homework joins,
-- student app), while these columns are the source of truth for the form.
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name TEXT;
-- Backfill: split the existing single name on the first space.
UPDATE students
   SET first_name = split_part(name, ' ', 1),
       last_name  = NULLIF(trim(substring(name from position(' ' in name))), '')
 WHERE first_name IS NULL AND name IS NOT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE students ADD COLUMN IF NOT EXISTS access_until TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS access_kind TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check CHECK (status IN ('pending', 'active'));
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_access_kind_check;
ALTER TABLE students ADD CONSTRAINT students_access_kind_check
  CHECK (access_kind IS NULL OR access_kind IN ('trial', 'assigned'));
UPDATE students
   SET access_kind = 'trial',
       trial_used = TRUE,
       trial_started_at = COALESCE(trial_started_at, access_until - interval '30 days')
 WHERE access_until IS NOT NULL AND access_kind IS NULL;
UPDATE students SET access_kind = 'assigned'
 WHERE status = 'active' AND access_until IS NULL AND access_kind IS NULL;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_grade_check;
ALTER TABLE students ADD CONSTRAINT students_grade_check
  CHECK (grade IS NULL OR grade BETWEEN 6 AND 11) NOT VALID;

-- Multi-subject enrollment. students.grade/subject stay as the "primary"
-- (first-chosen) subject for display/back-compat; this table is the source
-- of truth for which subjects a student actually has access to.
CREATE TABLE IF NOT EXISTS student_subjects (
  student_id  BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  grade       INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, subject)
);
ALTER TABLE student_subjects DROP CONSTRAINT IF EXISTS student_subjects_grade_check;
ALTER TABLE student_subjects ADD CONSTRAINT student_subjects_grade_check
  CHECK (grade BETWEEN 6 AND 11) NOT VALID;

CREATE TABLE IF NOT EXISTS tasks (
  id           BIGSERIAL PRIMARY KEY,
  grade        INTEGER NOT NULL,
  subject      TEXT NOT NULL,
  topic        TEXT NOT NULL,
  prompt       TEXT NOT NULL,
  options      JSONB NOT NULL,
  correct      INTEGER NOT NULL,
  explanation  TEXT,
  difficulty   TEXT NOT NULL DEFAULT 'medium',
  hints        JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Existing deployments may have been created before difficulty and hints
-- were added to the task model. CREATE TABLE IF NOT EXISTS does not add
-- missing columns, so keep these migrations explicit and idempotent.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hints JSONB NOT NULL DEFAULT '[]';
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_difficulty_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_difficulty_check
  CHECK (difficulty IN ('easy', 'medium', 'hard')) NOT VALID;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_grade_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_grade_check CHECK (grade BETWEEN 5 AND 11) NOT VALID;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_correct_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_correct_check
  CHECK (correct >= 0 AND correct < jsonb_array_length(options)) NOT VALID;

CREATE TABLE IF NOT EXISTS homework (
  id           BIGSERIAL PRIMARY KEY,
  student_id   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  due          TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'active',
  task_ids     JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Homework must belong to a subject so that multi-subject students do not
-- see Russian and Mathematics assignments mixed in one list.
ALTER TABLE homework ADD COLUMN IF NOT EXISTS subject TEXT;
UPDATE homework hw
   SET subject = s.subject
  FROM students s
 WHERE hw.student_id = s.id AND hw.subject IS NULL;

-- Homework is now solved question-by-question (like practice) instead of a
-- manual "mark as done" toggle, so it needs its own attempt budget/counter.
ALTER TABLE homework ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE homework ADD COLUMN IF NOT EXISTS attempts_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE homework DROP CONSTRAINT IF EXISTS homework_status_check;
ALTER TABLE homework ADD CONSTRAINT homework_status_check
  CHECK (status IN ('active', 'done')) NOT VALID;
ALTER TABLE homework DROP CONSTRAINT IF EXISTS homework_attempts_check;
ALTER TABLE homework ADD CONSTRAINT homework_attempts_check
  CHECK (max_attempts BETWEEN 1 AND 20 AND attempts_used BETWEEN 0 AND max_attempts) NOT VALID;
ALTER TABLE homework DROP CONSTRAINT IF EXISTS homework_subject_required;
ALTER TABLE homework ADD CONSTRAINT homework_subject_required
  CHECK (subject IS NOT NULL AND length(trim(subject)) > 0) NOT VALID;

-- Normalized task membership keeps homework valid when the shared task bank
-- changes. The legacy JSON column remains for backwards-compatible responses.
CREATE TABLE IF NOT EXISTS homework_tasks (
  homework_id BIGINT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  task_id     BIGINT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (homework_id, task_id)
);
INSERT INTO homework_tasks (homework_id, task_id, position)
SELECT hw.id, t.id, item.ordinality - 1
  FROM homework hw
 CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(hw.task_ids, '[]'::jsonb))
   WITH ORDINALITY AS item(task_id, ordinality)
  JOIN tasks t ON t.id = CASE WHEN item.task_id ~ '^\\d+$' THEN item.task_id::bigint END
ON CONFLICT (homework_id, task_id) DO NOTHING;

-- One row per homework submission attempt, storing the per-question outcome
-- so the results screen can show right/wrong + explanation after the fact.
CREATE TABLE IF NOT EXISTS homework_attempts (
  id           BIGSERIAL PRIMARY KEY,
  homework_id  BIGINT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL DEFAULT '[]',
  correct      INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE homework_attempts ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE INDEX IF NOT EXISTS idx_homework_attempts_homework ON homework_attempts (homework_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_homework_attempts_idempotency
  ON homework_attempts (homework_id, student_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Questions written specifically for one homework assignment — separate from
-- the shared practice task bank (tasks). No topic/subject/grade: they only
-- ever exist within their homework and never appear in the practice picker.
CREATE TABLE IF NOT EXISTS homework_questions (
  id           BIGSERIAL PRIMARY KEY,
  homework_id  BIGINT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  prompt       TEXT NOT NULL,
  options      JSONB NOT NULL,
  correct      INTEGER NOT NULL,
  explanation  TEXT,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_homework_questions_homework ON homework_questions (homework_id, position);

CREATE TABLE IF NOT EXISTS attempts (
  id           BIGSERIAL PRIMARY KEY,
  student_id   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id      BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  selected     INTEGER NOT NULL,
  correct      BOOLEAN NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS practice_instance_id UUID UNIQUE;

CREATE TABLE IF NOT EXISTS practice_question_instances (
  id             UUID PRIMARY KEY,
  student_id     BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id        BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  hints_revealed INTEGER NOT NULL DEFAULT 0 CHECK (hints_revealed >= 0),
  answered_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT now() + interval '6 hours'
);
ALTER TABLE practice_question_instances ADD COLUMN IF NOT EXISTS selected INTEGER;
ALTER TABLE practice_question_instances ADD COLUMN IF NOT EXISTS correct BOOLEAN;
ALTER TABLE practice_question_instances ADD COLUMN IF NOT EXISTS award_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practice_question_instances ADD COLUMN IF NOT EXISTS award_coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE practice_question_instances ADD COLUMN IF NOT EXISTS leveled_up BOOLEAN NOT NULL DEFAULT FALSE;
-- Per-instance answer order: option_order[i] is the index in tasks.options that
-- was shown to the student in position i. Lets grading map the position the
-- student picked back to the stored option.
ALTER TABLE practice_question_instances ADD COLUMN IF NOT EXISTS option_order JSONB;
CREATE INDEX IF NOT EXISTS idx_practice_instances_student
  ON practice_question_instances (student_id, expires_at);

CREATE TABLE IF NOT EXISTS practice_daily_awards (
  student_id   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id      BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  activity_day DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, task_id, activity_day)
);

CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id            UUID PRIMARY KEY,
  student_id    BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  question_ids  JSONB NOT NULL,
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + interval '6 hours'
);
-- Per-question answer order, keyed by task id: option_orders[taskId][i] is the
-- index in tasks.options shown in position i. Mirrors option_order on practice
-- instances so the diagnostic can shuffle answers too.
ALTER TABLE diagnostic_sessions ADD COLUMN IF NOT EXISTS option_orders JSONB;
CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_student
  ON diagnostic_sessions (student_id, expires_at);

-- Persistent mistake history powers the dedicated "work on mistakes" mode.
-- Keep one aggregate row per student/task: repetitions are useful signal,
-- while the last timestamp keeps recent gaps ahead of old ones.
CREATE TABLE IF NOT EXISTS student_mistakes (
  student_id    BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id       BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  topic         TEXT NOT NULL,
  wrong_count   INTEGER NOT NULL DEFAULT 1,
  correct_count INTEGER NOT NULL DEFAULT 0,
  last_selected INTEGER,
  last_wrong_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, task_id)
);

CREATE TABLE IF NOT EXISTS student_profiles (
  student_id           BIGINT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  xp                   INTEGER NOT NULL DEFAULT 0,
  coins                INTEGER NOT NULL DEFAULT 0,
  level                INTEGER NOT NULL DEFAULT 1,
  xp_from_level        INTEGER NOT NULL DEFAULT 0,
  xp_for_next          INTEGER NOT NULL DEFAULT 400,
  streak               INTEGER NOT NULL DEFAULT 0,
  streak_last_done_on  DATE,
  streak_freeze_used   BOOLEAN NOT NULL DEFAULT FALSE,
  pet_species          TEXT NOT NULL DEFAULT 'fox',
  pet_selected         BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step      TEXT NOT NULL DEFAULT 'complete',
  pet_name             TEXT NOT NULL DEFAULT 'Рыжик',
  pet_bond             INTEGER NOT NULL DEFAULT 0,
  pet_satiety          INTEGER NOT NULL DEFAULT 80,
  pet_mood             INTEGER NOT NULL DEFAULT 80,
  pet_decay_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  food_inventory       JSONB NOT NULL DEFAULT '{}',
  owned_items          JSONB NOT NULL DEFAULT '[]',
  worn_items           JSONB NOT NULL DEFAULT '{}',
  diagnostic_done      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS pet_selected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS onboarding_step TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS pet_bond INTEGER NOT NULL DEFAULT 0;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS pet_satiety INTEGER NOT NULL DEFAULT 80;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS pet_mood INTEGER NOT NULL DEFAULT 80;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS pet_decay_checked_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS food_inventory JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS student_topics (
  student_id   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic_id     TEXT NOT NULL,
  mastery      INTEGER NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 100),
  status       TEXT NOT NULL DEFAULT 'red' CHECK (status IN ('red', 'yellow', 'green')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, topic_id)
);

-- Topic ids alone are ambiguous once more than one subject exists (a
-- Russian topic could reuse a math topic's key). Scope mastery by subject.
ALTER TABLE student_topics ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Математика';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'student_topics'::regclass
       AND contype = 'p'
       AND pg_get_constraintdef(oid) = 'PRIMARY KEY (student_id, subject, topic_id)'
  ) THEN
    ALTER TABLE student_topics DROP CONSTRAINT IF EXISTS student_topics_pkey;
    ALTER TABLE student_topics ADD PRIMARY KEY (student_id, subject, topic_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS telegram_contacts (
  tg_id        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  username     TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  tg_id       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','tutor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bonus_transactions (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  reason      TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_grade_subject ON tasks (grade, subject);
CREATE INDEX IF NOT EXISTS idx_homework_student ON homework (student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts (student_id);
CREATE INDEX IF NOT EXISTS idx_student_mistakes_priority ON student_mistakes (student_id, subject, last_wrong_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonus_student ON bonus_transactions (student_id);
CREATE INDEX IF NOT EXISTS idx_student_topics_student ON student_topics (student_id);
CREATE INDEX IF NOT EXISTS idx_telegram_contacts_seen ON telegram_contacts (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_subjects_student ON student_subjects (student_id);
CREATE INDEX IF NOT EXISTS idx_homework_tasks_task ON homework_tasks (task_id);

ALTER TABLE student_profiles DROP CONSTRAINT IF EXISTS student_profiles_nonnegative_check;
ALTER TABLE student_profiles ADD CONSTRAINT student_profiles_nonnegative_check
  CHECK (xp >= 0 AND coins >= 0 AND level >= 1 AND streak >= 0) NOT VALID;
ALTER TABLE bonus_transactions DROP CONSTRAINT IF EXISTS bonus_amount_check;
ALTER TABLE bonus_transactions ADD CONSTRAINT bonus_amount_check
  CHECK (amount BETWEEN -100000 AND 100000 AND amount <> 0) NOT VALID;

-- Backfill: every pre-existing student's single subject/grade becomes their
-- first enrollment row, so nothing already active loses access.
INSERT INTO student_subjects (student_id, subject, grade)
SELECT id, subject, grade FROM students WHERE subject IS NOT NULL AND grade IS NOT NULL
ON CONFLICT (student_id, subject) DO NOTHING;
`;

// Map the current hardcoded task bank to grade 7 / Математика so the demo
// student sees something immediately.
const SEED_GRADE = 7;
const SEED_SUBJECT = "Математика";

async function seedIfEmpty() {
  const { rows: taskCount } = await query("SELECT COUNT(*)::int AS n FROM tasks");
  if (taskCount[0].n === 0) {
    for (const t of seed.taskBank) {
      await query(
        `INSERT INTO tasks (grade, subject, topic, prompt, options, correct, explanation, difficulty, hints)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          SEED_GRADE,
          SEED_SUBJECT,
          t.topic,
          t.prompt,
          JSON.stringify(t.options),
          t.correct,
          t.explanation ?? null,
          t.difficulty ?? "medium",
          JSON.stringify(t.hints ?? []),
        ]
      );
    }
    console.log(`Seeded ${seed.taskBank.length} tasks.`);
  }

  const { rows: studentCount } = await query("SELECT COUNT(*)::int AS n FROM students");
  if (studentCount[0].n === 0) {
    await query(
      `INSERT INTO students (tg_id, name, grade, subject) VALUES ($1,$2,$3,$4)`,
      ["demo", seed.profile.name, seed.profile.grade, seed.profile.subject]
    );
    console.log("Seeded demo student.");
  }

  // Bootstrap the first admin so someone can get into the panel at all.
  // Without this, requireAuth would lock everyone out on a fresh DB.
  const { rows: userCount } = await query("SELECT COUNT(*)::int AS n FROM users");
  if (userCount[0].n === 0 && process.env.SEED_ADMIN_TG_ID) {
    await query(
      `INSERT INTO users (tg_id, name, role) VALUES ($1,$2,'admin') ON CONFLICT (tg_id) DO NOTHING`,
      [process.env.SEED_ADMIN_TG_ID, "Admin"]
    );
    console.log("Seeded initial admin user.");
  }
}

async function normalizeTaskSubjects() {
  for (const { canonical, aliases } of SUBJECT_VARIANTS) {
    const { rowCount } = await query(
      `UPDATE tasks
          SET subject = $1
        WHERE lower(trim(subject)) = ANY($2::text[])
          AND subject <> $1`,
      [canonical, aliases]
    );
    if (rowCount) console.log(`Normalized ${rowCount} task subject value(s) to ${canonical}.`);
  }
}

// The demo student is the fallback identity when no real Telegram id is bound.
async function getDemoStudent() {
  const { rows } = await query("SELECT * FROM students ORDER BY id ASC LIMIT 1");
  return rows[0] ?? null;
}

async function init() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase connection string to back/.env"
    );
  }
  if (databaseConfig.ssl && !databaseConfig.sslVerified) {
    console.warn(
      "Database TLS is encrypted but the server certificate is not verified. " +
      "Set DATABASE_SSL_CA and DATABASE_SSL_MODE=verify-full for strict verification."
    );
  }
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(402021)");
    // The version table is named for this app rather than the generic
    // "schema_migrations": databases are routinely shared with other tools that
    // already own that name with a different shape (filename/checksum columns).
    // CREATE TABLE IF NOT EXISTS silently accepts the foreign table, and the
    // version SELECT then fails on the missing column, so every migration is
    // skipped and startup dies with "column version does not exist".
    await client.query(
      `CREATE TABLE IF NOT EXISTS edme_schema_migrations (
         version INTEGER PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );
    // Carry over the version recorded under the old name, but only when that
    // table is really ours. The column check runs first: naming it in a query
    // against a foreign table fails at plan time, which would abort this
    // transaction even if the statement were guarded by a WHERE clause.
    const { rows: legacy } = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'schema_migrations'
          AND column_name = 'version'`
    );
    if (legacy.length) {
      await client.query(
        `INSERT INTO edme_schema_migrations (version)
         SELECT version FROM schema_migrations ON CONFLICT DO NOTHING`
      );
    }
    const { rows } = await client.query(
      "SELECT COALESCE(MAX(version), 0)::int AS version FROM edme_schema_migrations"
    );
    if (rows[0].version < SCHEMA_VERSION) {
      await client.query(SCHEMA);
      await client.query(
        "INSERT INTO edme_schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
        [SCHEMA_VERSION]
      );
    }
  });
  await normalizeTaskSubjects();
  await seedIfEmpty();
  console.log("Database ready.");
}

module.exports = { pool, query, transaction, init, getDemoStudent };
