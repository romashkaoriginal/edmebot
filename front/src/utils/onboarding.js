// Onboarding only ever moves forward server-side: subject → diagnostic → pet →
// (trial →) complete. Several sections return the whole profile and some of
// those responses are cached, so a replayed payload could otherwise walk a
// student back to a step they already finished.
export const ONBOARDING_ORDER = ["subject", "diagnostic", "pet", "trial", "complete"];

// Keeping the furthest of the two steps makes a stale payload harmless without
// every caller having to know whether its response came from a cache.
export function laterOnboardingStep(current, next) {
  if (next === undefined) return current;
  const currentIndex = ONBOARDING_ORDER.indexOf(current);
  const nextIndex = ONBOARDING_ORDER.indexOf(next);
  // An unrecognised step is not ordered against anything — take it as given
  // rather than silently pinning the student to a stale one.
  if (currentIndex < 0 || nextIndex < 0) return next;
  return nextIndex > currentIndex ? next : current;
}
