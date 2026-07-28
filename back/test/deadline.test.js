const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMoscowDeadline } = require("../src/utils/deadline");

test("interprets a date and time as Moscow time", () => {
  assert.equal(parseMoscowDeadline("2026-07-28 18:30"), "2026-07-28T15:30:00.000Z");
});

test("interprets a date without time as the end of the Moscow day", () => {
  assert.equal(parseMoscowDeadline("2026-07-28"), "2026-07-28T20:59:00.000Z");
});

test("interprets Excel date components as Moscow time", () => {
  assert.equal(
    parseMoscowDeadline(new Date("2026-07-28T18:30:00.000Z")),
    "2026-07-28T15:30:00.000Z"
  );
});

test("rejects malformed and impossible deadlines", () => {
  assert.equal(parseMoscowDeadline("2026-02-31 12:00"), null);
  assert.equal(parseMoscowDeadline("28.07.2026"), null);
});
