const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSubject } = require("../src/subjects");

test("normalizes supported subject aliases used by imports", () => {
  assert.equal(normalizeSubject("Русский"), "Русский язык");
  assert.equal(normalizeSubject("Русский язык"), "Русский язык");
  assert.equal(normalizeSubject("  русский  "), "Русский язык");
  assert.equal(normalizeSubject("МАТЕМАТИКА"), "Математика");
});

test("preserves an unknown subject instead of silently changing it", () => {
  assert.equal(normalizeSubject("Литература"), "Литература");
});
