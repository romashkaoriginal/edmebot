// Keep every route loader in one place. React.lazy and the preload helpers use
// the same import() promise, so a background download is reused on navigation
// instead of showing the global Suspense fallback for an already-known route.
export const loadRoleGate = () => import("./pages/RoleGate");

export const loadStudentOnboarding = () => import("./pages/StudentOnboarding");
export const loadTrialStart = () => import("./pages/TrialStart");
export const loadPractice = () => import("./pages/Practice");
export const loadPracticeRun = () => import("./pages/PracticeRun");
export const loadDiagnostic = () => import("./pages/Diagnostic");
export const loadDiagnosticRun = () => import("./pages/DiagnosticRun");
export const loadHomework = () => import("./pages/Homework");
export const loadHomeworkRun = () => import("./pages/HomeworkRun");
export const loadPet = () => import("./pages/Pet");
export const loadProfile = () => import("./pages/Profile");

export const loadStudents = () => import("./pages/admin/Students");
export const loadUsers = () => import("./pages/admin/Users");
export const loadTasks = () => import("./pages/admin/Tasks");
export const loadHomeworkAdmin = () => import("./pages/admin/HomeworkAdmin");
export const loadStats = () => import("./pages/admin/Stats");

const studentLoaders = [
  loadProfile,
  loadPractice,
  loadPracticeRun,
  loadHomework,
  loadHomeworkRun,
  loadPet,
  loadDiagnostic,
  loadDiagnosticRun,
  loadStudentOnboarding,
  loadTrialStart,
];
const sharedAdminLoaders = [loadTasks, loadHomeworkAdmin, loadStats];

let studentPreload;
const adminPreloads = new Map();

export function preloadStudentRoutes() {
  studentPreload ??= Promise.allSettled(studentLoaders.map((load) => load()));
  return studentPreload;
}

export function preloadAdminRoutes(role) {
  const cacheKey = role === "admin" ? "admin" : "tutor";
  if (!adminPreloads.has(cacheKey)) {
    const loaders = role === "admin"
      ? [loadStudents, loadUsers, ...sharedAdminLoaders]
      : sharedAdminLoaders;
    adminPreloads.set(cacheKey, Promise.allSettled(loaders.map((load) => load())));
  }
  return adminPreloads.get(cacheKey);
}
