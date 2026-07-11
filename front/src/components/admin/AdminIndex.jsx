import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuth";

// Default landing page for /admin, chosen by role so a tutor (blocked from
// /admin/students by RequireRole) doesn't bounce in a redirect loop.
export default function AdminIndex() {
  const { user } = useAdminAuth();
  const target = user?.role === "admin" ? "students" : "tasks";
  return <Navigate to={target} replace />;
}
