const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMoscowDeadline, deadlineNotice, dateParts } = require("../src/utils/deadline");

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

test("classifies deadlines by Moscow calendar day instead of a rolling 24-hour window", () => {
  const now = new Date("2026-07-28T20:30:00.000Z"); // 23:30 in Moscow
  assert.deepEqual(
    deadlineNotice({ status: "active", due: "2026-07-28T20:45:00.000Z" }, now),
    { tone: "danger", text: "сдать сегодня" }
  );
  assert.deepEqual(
    deadlineNotice({ status: "active", due: "2026-07-28T21:30:00.000Z" }, now),
    { tone: "warning", text: "завтра дедлайн" }
  );
});

test("uses the configured product timezone for date keys", () => {
  assert.equal(dateParts(new Date("2026-07-28T21:30:00.000Z")), "2026-07-29");
});
