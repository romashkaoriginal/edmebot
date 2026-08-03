const test = require("node:test");
const assert = require("node:assert/strict");

// Mirrors the redirect ladder in front/src/components/layout/AppLayout.jsx.
// The frontend has no runner of its own, so the routing rules are asserted
// here the same way the other pure-logic regressions are.
function redirectFor({ onboardingStep, isActive, pathname, focus = false }) {
  const onboardingIncomplete = onboardingStep !== "complete";

  if (onboardingStep === "subject" && !pathname.startsWith("/app/onboarding")) return "/app/onboarding";
  if (onboardingStep === "diagnostic" && !pathname.startsWith("/app/diagnostic")) return "/app/diagnostic";
  if (onboardingStep === "pet" && !pathname.startsWith("/app/pet")) return "/app/pet";
  if (onboardingStep === "trial" && !pathname.startsWith("/app/trial")) return "/app/trial";
  // The guarded line: a self-serve student stays "pending" for the whole of
  // onboarding, so this must not fire until the steps are finished.
  if (!onboardingIncomplete && !isActive && !focus && !pathname.startsWith("/app/trial")) return "/app/trial";
  return null;
}

// Follows the redirects the way the router does, and reports a cycle rather
// than looping forever.
function settle(state, start, limit = 12) {
  const seen = [start];
  let pathname = start;
  for (let step = 0; step < limit; step += 1) {
    const next = redirectFor({ ...state, pathname });
    if (!next || next === pathname) return { settledAt: pathname, visited: seen };
    if (seen.includes(next)) return { cycle: [...seen, next] };
    seen.push(next);
    pathname = next;
  }
  return { cycle: seen };
}

// The reported bug: opening the Mini App never painted. A pending student on
// the "subject" step was sent to /app/onboarding by the step check, then the
// pending check sent them to /app/trial, then the step check sent them back —
// forever. Chrome eventually gave up with "Throttling navigation to prevent
// the browser from hanging" and #root stayed empty.
test("a pending student mid-onboarding lands on their step instead of ping-ponging", () => {
  const student = { onboardingStep: "subject", isActive: false };

  const fromEntry = settle(student, "/app/profile");
  assert.equal(fromEntry.cycle, undefined, `redirects must not cycle: ${JSON.stringify(fromEntry.cycle)}`);
  assert.equal(fromEntry.settledAt, "/app/onboarding");

  // Already on the right screen: nothing should move them off it.
  assert.equal(redirectFor({ ...student, pathname: "/app/onboarding" }), null);
});

test("every onboarding step settles for a pending student", () => {
  for (const [onboardingStep, expected] of [
    ["subject", "/app/onboarding"],
    ["diagnostic", "/app/diagnostic"],
    ["pet", "/app/pet"],
    ["trial", "/app/trial"],
  ]) {
    const result = settle({ onboardingStep, isActive: false }, "/app/profile");
    assert.equal(result.cycle, undefined, `${onboardingStep} cycles: ${JSON.stringify(result.cycle)}`);
    assert.equal(result.settledAt, expected, `${onboardingStep} must settle on ${expected}`);
  }
});

test("a finished student without access is still sent to the trial screen", () => {
  // The guard must not cost the pending check its real job.
  const result = settle({ onboardingStep: "complete", isActive: false }, "/app/profile");
  assert.equal(result.cycle, undefined);
  assert.equal(result.settledAt, "/app/trial");
});

test("an active student is left where they are", () => {
  const result = settle({ onboardingStep: "complete", isActive: true }, "/app/profile");
  assert.equal(result.cycle, undefined);
  assert.equal(result.settledAt, "/app/profile");
});
