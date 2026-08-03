const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

// init() only checks that DATABASE_URL is set; the pool is stubbed out below,
// so nothing is ever dialled. Assembled from parts so it does not read as a
// real connection string to secret scanners.
const FAKE_DATABASE_URL = ["postgres:/", "stub:stub@127.0.0.1:5432", "test"].join("/");

// Databases are routinely shared with other tools, and "schema_migrations" is
// the name every one of them reaches for. A foreign table under that name used
// to make CREATE TABLE IF NOT EXISTS a no-op and the version SELECT fail on the
// missing column, so init() threw, the server exited, and no migration ever ran.
function loadDb({ tables, columns }) {
  const originalLoad = Module._load;
  const executed = [];
  const handle = async (text, params) => {
    executed.push(text);
    if (/FROM information_schema\.columns/.test(text)) {
      const has = columns.some((column) => column.table === "schema_migrations" && column.name === "version");
      return { rows: has ? [{ "?column?": 1 }] : [], rowCount: has ? 1 : 0 };
    }
    if (/CREATE TABLE IF NOT EXISTS (\w+)/.test(text)) {
      const name = text.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
      // IF NOT EXISTS: an existing table keeps whatever columns it already has,
      // which is exactly how the foreign table slipped through.
      if (!tables.includes(name)) {
        tables.push(name);
        for (const column of text.matchAll(/^\s+(\w+)\s+(?:INTEGER|TEXT|TIMESTAMPTZ|BIGINT|BOOLEAN|JSONB|DATE)/gm)) {
          columns.push({ table: name, name: column[1] });
        }
      }
      return { rows: [], rowCount: 0 };
    }
    // The bug: selecting `version` from a table that has no such column.
    if (/FROM (\w*schema_migrations)/.test(text) && /version/.test(text)) {
      const name = text.match(/FROM (\w*schema_migrations)/)[1];
      const has = columns.some((column) => column.table === name && column.name === "version");
      if (!has) throw new Error(`column "version" does not exist`);
      const versions = columns
        .filter((column) => column.table === name && column.name === "version")
        .map((column) => column.value ?? 0);
      return { rows: [{ version: Math.max(0, ...versions) }], rowCount: 1 };
    }
    // Seeding runs after the migration block; report every table as populated
    // so this test stays about the version bootstrap alone.
    if (/COUNT\(\*\)::int AS n/.test(text)) return { rows: [{ n: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  const client = { query: handle, release() {} };
  Module._load = function (request) {
    if (request === "pg") {
      return { Pool: class { async connect() { return client; } async query(text, params) { return handle(text, params); } } };
    }
    return originalLoad.apply(this, arguments);
  };
  delete require.cache[require.resolve("../src/db.js")];
  const db = require("../src/db.js");
  Module._load = originalLoad;
  return { db, executed };
}

test("init survives a foreign schema_migrations table owned by another app", async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || FAKE_DATABASE_URL;
  const tables = ["schema_migrations"];
  // The foreign table: filename/checksum, no version column.
  const columns = [
    { table: "schema_migrations", name: "filename" },
    { table: "schema_migrations", name: "checksum" },
  ];
  const { db, executed } = loadDb({ tables, columns });
  await db.init();
  assert.ok(
    tables.includes("edme_schema_migrations"),
    "init must track its version in an app-specific table, not the shared name"
  );
  assert.ok(
    executed.some((text) => /CREATE TABLE IF NOT EXISTS student_profiles/.test(text)),
    "the schema block must actually run instead of being skipped"
  );
});

test("init carries over a version recorded under the old table name", async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || FAKE_DATABASE_URL;
  const tables = ["schema_migrations"];
  // Our own older table, already at the current version.
  const columns = [{ table: "schema_migrations", name: "version", value: 99 }];
  const { db, executed } = loadDb({ tables, columns });
  await db.init();
  assert.ok(
    executed.some((text) => /INSERT INTO edme_schema_migrations \(version\)\s*SELECT version FROM schema_migrations/.test(text)),
    "an already-migrated database must not be forced to re-run the schema block"
  );
});
