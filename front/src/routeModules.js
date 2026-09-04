// Telegram's iOS WebView may retain an old app shell while a release replaces
// lazy route chunks. Keeping routes in the entry bundle prevents a mixed
// release from throwing "failed to fetch dynamically imported module" during
// the first switch to a student view.
const alreadyAvailable = Promise.resolve();

export function preloadStudentRoutes() {
  return alreadyAvailable;
}

export function preloadAdminRoutes() {
  return alreadyAvailable;
}
