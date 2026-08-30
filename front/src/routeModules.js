// Split by role, not by page. Once a role bundle resolves, every section for
// that role is ready and tab changes cannot trigger another dynamic import.
export const loadRoleGate = () => import("./pages/RoleGate");
export const loadStudentRoutes = () => import("./StudentRoutes");
export const loadAdminRoutes = () => import("./AdminRoutes");

let studentPreload;
let adminPreload;

export function preloadStudentRoutes() {
  studentPreload ??= loadStudentRoutes();
  return studentPreload;
}

export function preloadAdminRoutes() {
  adminPreload ??= loadAdminRoutes();
  return adminPreload;
}
