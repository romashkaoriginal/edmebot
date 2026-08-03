const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// The frontend has no runner of its own; this pure module is imported directly
// so the regression stays covered by `npm test` in back/.
const modulePath = pathToFileURL(
  path.join(__dirname, "..", "..", "front", "src", "utils", "onboarding.js")
).href;

test("a stale profile payload cannot walk a student back a step", async () => {
  const { laterOnboardingStep } = await import(modulePath);

  // The reported bug: GET /api/pet is prefetched while the student is still on
  // the diagnostic, then replayed on the pet screen after the diagnostic
  // advanced them to "pet". Hydrating that snapshot sent them to the subject
  // picker, where /profile/onboard 409'd and the test could not be retaken.
  assert.equal(laterOnboardingStep("pet", "diagnostic"), "pet");
  assert.equal(laterOnboardingStep("pet", "subject"), "pet");
  assert.equal(laterOnboardingStep("complete", "pet"), "complete");
});

test("real progress still moves the student forward", async () => {
  const { laterOnboardingStep } = await import(modulePath);

  assert.equal(laterOnboardingStep("subject", "diagnostic"), "diagnostic");
  assert.equal(laterOnboardingStep("diagnostic", "pet"), "pet");
  assert.equal(laterOnboardingStep("pet", "trial"), "trial");
  assert.equal(laterOnboardingStep("trial", "complete"), "complete");
  assert.equal(laterOnboardingStep("pet", "complete"), "complete");
});

test("a payload without a step leaves the current one alone", async () => {
  const { laterOnboardingStep } = await import(modulePath);

  assert.equal(laterOnboardingStep("pet", undefined), "pet");
});

test("an unrecognised step is taken as given rather than pinning the student", async () => {
  const { laterOnboardingStep } = await import(modulePath);

  // A step this client does not know about must not be discarded: doing so
  // would strand the student on a screen the server has already moved past.
  assert.equal(laterOnboardingStep("pet", "something-new"), "something-new");
  assert.equal(laterOnboardingStep("something-old", "pet"), "pet");
});
