const test = require("node:test");
const assert = require("node:assert/strict");
const { buildDatabaseConfig } = require("../src/utils/databaseConfig");

test("uses no TLS for a local database", () => {
  const config = buildDatabaseConfig("postgresql://localhost:5432/app");
  assert.equal(config.ssl, false);
});

test("uses encrypted compatibility mode for Supabase poolers by default", () => {
  const config = buildDatabaseConfig(
    "postgresql://aws-0.pooler.supabase.com:6543/postgres"
  );
  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
  assert.equal(config.sslVerified, false);
});

test("verifies certificates for other remote databases by default", () => {
  const config = buildDatabaseConfig(
    "postgresql://database.example.com:5432/app"
  );
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(config.sslVerified, true);
});

test("removes URL SSL options so they cannot replace the explicit TLS config", () => {
  const config = buildDatabaseConfig(
    "postgresql://example.com:5432/app?sslmode=require&uselibpqcompat=true"
  );
  assert.equal(new URL(config.connectionString).searchParams.has("sslmode"), false);
  assert.equal(new URL(config.connectionString).searchParams.has("uselibpqcompat"), false);
});

test("uses strict verification when a CA is provided", () => {
  const config = buildDatabaseConfig(
    "postgresql://example.com:5432/app?sslmode=require",
    { DATABASE_SSL_MODE: "verify-full", DATABASE_SSL_CA: "ROOT\\nCERT" }
  );
  assert.deepEqual(config.ssl, {
    rejectUnauthorized: true,
    ca: "ROOT\nCERT",
  });
  assert.equal(config.sslVerified, true);
});

test("rejects unsupported remote TLS modes", () => {
  assert.throws(
    () => buildDatabaseConfig(
      "postgresql://example.com:5432/app",
      { DATABASE_SSL_MODE: "disable" }
    ),
    /DATABASE_SSL_MODE/
  );
});
