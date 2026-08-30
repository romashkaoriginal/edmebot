import { Navigate } from "./router";
import RequireRole from "./components/admin/RequireRole";
import AdminIndex from "./components/admin/AdminIndex";
import Students from "./pages/admin/Students";
import Users from "./pages/admin/Users";
import Tasks from "./pages/admin/Tasks";
import HomeworkAdmin from "./pages/admin/HomeworkAdmin";
import Stats from "./pages/admin/Stats";

// Keep the whole staff area in one role-level chunk. The first rendered admin
// page proves this chunk has loaded, so subsequent section changes are local
// renders instead of additional Suspense pauses.
export default function AdminRoutes({ pathname }) {
  const routes = {
    "/admin": <AdminIndex />,
    "/admin/students": <RequireRole roles={["admin"]}><Students /></RequireRole>,
    "/admin/users": <RequireRole roles={["admin"]}><Users /></RequireRole>,
    "/admin/tasks": <Tasks />,
    "/admin/homework": <HomeworkAdmin />,
    "/admin/stats": <Stats />,
  };
  return routes[pathname] ?? <Navigate to="/admin" replace />;
}
