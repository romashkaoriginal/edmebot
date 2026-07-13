// Postgres (Supabase) access layer. Uses a single pooled connection.
// Schema is migrated on startup (CREATE TABLE IF NOT EXISTS) and seeded idempotently.
const { Pool } = require("pg");
const seed = require("./data/seed");

const connectionString = process.env.DATABASE_URL;

// Supabase requires SSL. On the pooler the cert chain isn't always verifiable
// from serverless hosts, so we accept it without strict verification.
const pool = new Pool({
  connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  return pool.query(text, params);
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
  END IF;
END $$;
UPDATE students SET name = 'Без имени' WHERE name IS NULL;
ALTER TABLE students ALTER COLUMN name SET NOT NULL;

-- Legacy columns were NOT NULL; self-serve onboarding creates a student
-- before a subject/grade is chosen, so both must be nullable.
ALTER TABLE students ALTER COLUMN grade DROP NOT NULL;
ALTER TABLE students ALTER COLUMN subject DROP NOT NULL;

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
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check CHECK (status IN ('pending', 'active'));

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

CREATE TABLE IF NOT EXISTS attempts (
  id           BIGSERIAL PRIMARY KEY,
  student_id   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id      BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  selected     INTEGER NOT NULL,
  correct      BOOLEAN NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  owned_items          JSONB NOT NULL DEFAULT '[]',
  worn_items           JSONB NOT NULL DEFAULT '{}',
  diagnostic_done      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS pet_selected BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS onboarding_step TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS pet_bond INTEGER NOT NULL DEFAULT 0;

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
ALTER TABLE student_topics DROP CONSTRAINT IF EXISTS student_topics_pkey;
ALTER TABLE student_topics ADD PRIMARY KEY (student_id, subject, topic_id);

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
  await query(SCHEMA);
  await seedIfEmpty();
  console.log("Database ready.");
}

module.exports = { pool, query, init, getDemoStudent };
