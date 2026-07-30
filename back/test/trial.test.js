const test = require("node:test");
const assert = require("node:assert/strict");
const { trialStartError } = require("../src/utils/trial");

const readyProfile = { diagnostic_done: true, pet_selected: true };
const pendingStudent = { status: "pending", access_kind: null, trial_used: false };

test("allows only a first explicit trial after onboarding", () => {
  assert.equal(trialStartError(pendingStudent, readyProfile), null);
  assert.equal(
    trialStartError(pendingStudent, { ...readyProfile, diagnostic_done: false }),
    "trial_prerequisites_incomplete"
  );
  assert.equal(
    trialStartError({ ...pendingStudent, trial_used: true }, readyProfile),
    "trial_already_used"
  );
});

test("never replaces assigned access with a trial", () => {
  assert.equal(
    trialStartError({ ...pendingStudent, status: "active", access_kind: "assigned" }, readyProfile),
    "trial_not_available"
  );
});
