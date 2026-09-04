import { Navigate, useLocation } from "./router";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./components/layout/AdminLayout";
import { AdminAuthProvider } from "./context/AdminAuth";
import RoleGate from "./pages/RoleGate";
import StudentRoutes from "./StudentRoutes";
import AdminRoutes from "./AdminRoutes";

export default function App() {
  const { pathname } = useLocation();
  let content;

  if (pathname === "/") {
    content = <RoleGate />;
  } else if (pathname === "/app" || pathname.startsWith("/app/")) {
    content = <AppLayout><StudentRoutes pathname={pathname} /></AppLayout>;
  } else if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    content = (
      <AdminAuthProvider>
        <AdminLayout><AdminRoutes pathname={pathname} /></AdminLayout>
      </AdminAuthProvider>
    );
  } else {
    content = <Navigate to="/" replace />;
  }

  return content;
}
