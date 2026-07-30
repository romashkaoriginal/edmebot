import { Navigate } from "../../router";
import { useAdminAuth } from "../../context/AdminAuth";

// Default landing page for /admin, chosen by role so a tutor (blocked from
// /admin/students by RequireRole) doesn't bounce in a redirect loop.
export default function AdminIndex() {
  const { user } = useAdminAuth();
  const target = user?.role === "admin" ? "/admin/students" : "/admin/tasks";
  return <Navigate to={target} replace />;
}
