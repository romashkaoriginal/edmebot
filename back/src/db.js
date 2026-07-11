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
  grade       INTEGER NOT NULL,
  subject     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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
  pet_name             TEXT NOT NULL DEFAULT 'Рыжик',
  owned_items          JSONB NOT NULL DEFAULT '[]',
  worn_items           JSONB NOT NULL DEFAULT '{}',
  diagnostic_done      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_topics (
  student_id   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic_id     TEXT NOT NULL,
  mastery      INTEGER NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 100),
  status       TEXT NOT NULL DEFAULT 'red' CHECK (status IN ('red', 'yellow', 'green')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, topic_id)
);

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
CREATE INDEX IF NOT EXISTS idx_bonus_student ON bonus_transactions (student_id);
CREATE INDEX IF NOT EXISTS idx_student_topics_student ON student_topics (student_id);
CREATE INDEX IF NOT EXISTS idx_telegram_contacts_seen ON telegram_contacts (last_seen_at DESC);
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
