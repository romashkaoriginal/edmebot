const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "db.js"), "utf8");

// Regression: option_order was added to SCHEMA but SCHEMA_VERSION stayed at 1.
// init() only runs the schema block when the recorded version is behind, so the
// ALTER never reached production and /practice/series 500'd with
// `column "option_order" does not exist`. Every column the code writes to must
// be covered by a version that is ahead of what deployed databases recorded.
test("SCHEMA_VERSION is ahead of the first release", () => {
  const declared = source.match(/const SCHEMA_VERSION = (\d+)/);
  assert.ok(declared, "db.js declares SCHEMA_VERSION");
  assert.ok(
    Number(declared[1]) >= 2,
    "SCHEMA_VERSION must be bumped past 1 so schema changes reach existing databases"
  );
});

test("columns the practice flow writes to are declared in SCHEMA", () => {
  // Written by routes/practice.js when creating question instances.
  for (const column of ["option_order", "selected", "correct", "award_xp", "award_coins", "leveled_up"]) {
    assert.ok(
      new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`).test(source),
      `${column} must be declared in SCHEMA`
    );
  }
});

test("schema changes are gated behind a version bump", () => {
  // Guards the gate itself: if this check is ever loosened, a future ALTER
  // could silently never run again.
  assert.match(source, /rows\[0\]\.version < SCHEMA_VERSION/);
});
