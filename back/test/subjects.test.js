const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSubject } = require("../src/subjects");

test("normalizes supported subject aliases used by imports", () => {
  assert.equal(normalizeSubject("Русский язык"), "Русский");
  assert.equal(normalizeSubject("  русский  "), "Русский");
  assert.equal(normalizeSubject("МАТЕМАТИКА"), "Математика");
});

test("preserves an unknown subject instead of silently changing it", () => {
  assert.equal(normalizeSubject("Литература"), "Литература");
});
