import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./components/layout/AdminLayout";
import RequireRole from "./components/admin/RequireRole";
import AdminIndex from "./components/admin/AdminIndex";
import { AdminAuthProvider } from "./context/AdminAuth";
import RoleGate from "./pages/RoleGate";
import Dashboard from "./pages/Dashboard";
import Practice from "./pages/Practice";
import PracticeRun from "./pages/PracticeRun";
import Diagnostic from "./pages/Diagnostic";
import DiagnosticRun from "./pages/DiagnosticRun";
import Homework from "./pages/Homework";
import Pet from "./pages/Pet";
import Profile from "./pages/Profile";
import Students from "./pages/admin/Students";
import Users from "./pages/admin/Users";
import Tasks from "./pages/admin/Tasks";
import HomeworkAdmin from "./pages/admin/HomeworkAdmin";
import Stats from "./pages/admin/Stats";

export default function App() {
  return (
    <Routes>
      {/* Entry: choose admin or demo student */}
      <Route index element={<RoleGate />} />

      {/* Student app */}
      <Route path="app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="practice" element={<Practice />} />
        <Route path="practice/run" element={<PracticeRun />} />
        <Route path="diagnostic" element={<Diagnostic />} />
        <Route path="diagnostic/run" element={<DiagnosticRun />} />
        <Route path="homework" element={<Homework />} />
        <Route path="pet" element={<Pet />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Admin panel */}
      <Route
        path="admin"
        element={
          <AdminAuthProvider>
            <AdminLayout />
          </AdminAuthProvider>
        }
      >
        <Route index element={<AdminIndex />} />
        <Route
          path="students"
          element={
            <RequireRole roles={["admin"]}>
              <Students />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole roles={["admin"]}>
              <Users />
            </RequireRole>
          }
        />
        <Route path="tasks" element={<Tasks />} />
        <Route path="homework" element={<HomeworkAdmin />} />
        <Route path="stats" element={<Stats />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
