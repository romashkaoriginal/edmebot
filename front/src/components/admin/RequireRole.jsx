import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuth";

// Guards a single admin route by role. AdminLayout already blocks unauthenticated
// users; this additionally stops a tutor from reaching admin-only pages by typing
// the URL directly (nav already hides the links, this is the route-level backstop).
export default function RequireRole({ roles, children }) {
  const { user } = useAdminAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
