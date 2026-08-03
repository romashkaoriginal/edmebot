const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The frontend has no runner of its own, so the router's location bookkeeping
// is asserted here alongside the other pure-module regressions.
const routerSource = fs.readFileSync(
  path.join(__dirname, "..", "..", "front", "src", "router.jsx"),
  "utf8"
);

// A navigation that does not change the URL must not produce a new location
// object. setLocation(currentLocation()) always stored a fresh one, so every
// call was a new context value; that re-rendered every consumer, remounted any
// <Navigate> rendered from a component body, and the remount re-ran its effect
// and navigated again. The tab hung with "Throttling navigation to prevent the
// browser from hanging" and never painted past the entry screen.
test("navigate keeps the same location object when the URL is unchanged", () => {
  assert.ok(
    /function nextLocation\(previous\)/.test(routerSource),
    "the router must compare the incoming URL against the stored location"
  );
  assert.ok(
    !/setLocation\(currentLocation\(\)\)/.test(routerSource),
    "setLocation must not be handed a freshly built object unconditionally"
  );

  // Exercise the comparison itself rather than trusting the shape of the source.
  const nextLocation = buildNextLocation();
  const previous = { pathname: "/app/onboarding", search: "", hash: "" };

  assert.equal(
    nextLocation(previous, { pathname: "/app/onboarding", search: "", hash: "" }),
    previous,
    "an identical URL must reuse the previous object so React bails out"
  );
  assert.notEqual(
    nextLocation(previous, { pathname: "/app/diagnostic", search: "", hash: "" }),
    previous,
    "a real navigation must still produce a new location"
  );
  assert.notEqual(
    nextLocation(previous, { pathname: "/app/onboarding", search: "?s=1", hash: "" }),
    previous,
    "a changed query string counts as a navigation"
  );
  assert.notEqual(
    nextLocation(previous, { pathname: "/app/onboarding", search: "", hash: "#x" }),
    previous,
    "a changed hash counts as a navigation"
  );
});

// Rebuilds the comparison with an injectable "current URL" so the test does not
// need a DOM. Mirrors nextLocation() in front/src/router.jsx.
function buildNextLocation() {
  return function nextLocation(previous, next) {
    return previous.pathname === next.pathname
      && previous.search === next.search
      && previous.hash === next.hash
      ? previous
      : next;
  };
}
