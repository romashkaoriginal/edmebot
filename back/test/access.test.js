const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAccessUntilDay } = require("../src/utils/access");

test("parseAccessUntilDay: omitted field means 'leave untouched'", () => {
  assert.equal(parseAccessUntilDay(undefined), undefined);
});

test("parseAccessUntilDay: null or empty string means 'бессрочно'", () => {
  assert.equal(parseAccessUntilDay(null), null);
  assert.equal(parseAccessUntilDay(""), null);
});

test("parseAccessUntilDay: a calendar day resolves to the end of that day in the app timezone", () => {
  const date = parseAccessUntilDay("2026-09-30", "Europe/Moscow");
  assert.ok(date instanceof Date);
  assert.equal(date.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }), "30.09.2026, 23:59:59");
});

test("parseAccessUntilDay: rejects malformed input instead of silently guessing", () => {
  assert.equal(parseAccessUntilDay("not-a-date"), "invalid");
  assert.equal(parseAccessUntilDay("2026-13-40"), "invalid");
  assert.equal(parseAccessUntilDay("30-09-2026"), "invalid");
});

test("parseAccessUntilDay: a past day still parses — callers decide what a past cutoff means", () => {
  const date = parseAccessUntilDay("2000-01-01", "Europe/Moscow");
  assert.ok(date instanceof Date);
  assert.ok(date.getTime() < Date.now());
});
