const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDeadline, parseAccess, desiredTagNames } = require("../src/integrations/moyklassAccess");

function user({ enabled = true, until = "2026-10-09", kind = "Платный", subject = 11 } = {}) {
  return { attributes: [
    { attributeAlias: "bot__dostup", value: enabled },
    { attributeAlias: "bot__dostup_do", value: until },
    { attributeAlias: "bot__tip_dostupa", value: kind },
    { attributeAlias: "bot__predmety", valueId: subject },
  ] };
}

test("CRM date-only access ends at 23:59:59.999 Minsk time", () => {
  assert.equal(parseDeadline("2026-10-09").toISOString(), "2026-10-09T20:59:59.999Z");
  assert.equal(parseDeadline("2026-02-30"), null);
  assert.equal(parseDeadline("2026-10-09T12:30").toISOString(), "2026-10-09T09:30:00.000Z");
  assert.equal(parseDeadline("next Friday"), null);
});

test("active paid access follows stable CRM subject option IDs", () => {
  const previous = process.env.MOYKLASS_SUBJECT_MAP;
  process.env.MOYKLASS_SUBJECT_MAP = '{"11":"Математика","12":"Физика"}';
  try {
    const access = parseAccess(user({ subject: 12 }), new Date("2026-10-09T20:59:59.998Z"));
    assert.equal(access.active, true);
    assert.deepEqual(access.subjects, ["Физика"]);
    assert.deepEqual(desiredTagNames(access), ["Подписка есть", "Бот оплачен"]);
    assert.equal(parseAccess(user(), new Date("2026-10-09T21:00:00Z")).active, false);
    assert.deepEqual(desiredTagNames(parseAccess(user({ enabled: false }))), ["Бот не оплачен"]);
  } finally {
    if (previous === undefined) delete process.env.MOYKLASS_SUBJECT_MAP;
    else process.env.MOYKLASS_SUBJECT_MAP = previous;
  }
});

test("missing settings and unmapped options cannot grant access", () => {
  const previous = process.env.MOYKLASS_SUBJECT_MAP;
  process.env.MOYKLASS_SUBJECT_MAP = '{"11":"Математика"}';
  try {
    assert.equal(parseAccess(user({ until: null })).active, false);
    assert.equal(parseAccess(user({ subject: null })).active, false);
    assert.equal(parseAccess(user({ kind: "unknown" })).active, false);
    assert.match(parseAccess(user({ subject: 99 })).error, /Unknown CRM subject/);
  } finally {
    if (previous === undefined) delete process.env.MOYKLASS_SUBJECT_MAP;
    else process.env.MOYKLASS_SUBJECT_MAP = previous;
  }
});
