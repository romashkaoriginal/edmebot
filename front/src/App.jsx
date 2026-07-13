import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./components/layout/AdminLayout";
import RequireRole from "./components/admin/RequireRole";
import AdminIndex from "./components/admin/AdminIndex";
import { AdminAuthProvider } from "./context/AdminAuth";

const RoleGate = lazy(() => import("./pages/RoleGate"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Practice = lazy(() => import("./pages/Practice"));
const PracticeRun = lazy(() => import("./pages/PracticeRun"));
const Diagnostic = lazy(() => import("./pages/Diagnostic"));
const DiagnosticRun = lazy(() => import("./pages/DiagnosticRun"));
const Homework = lazy(() => import("./pages/Homework"));
const Pet = lazy(() => import("./pages/Pet"));
const Profile = lazy(() => import("./pages/Profile"));
const Students = lazy(() => import("./pages/admin/Students"));
const Users = lazy(() => import("./pages/admin/Users"));
const Tasks = lazy(() => import("./pages/admin/Tasks"));
const HomeworkAdmin = lazy(() => import("./pages/admin/HomeworkAdmin"));
const Stats = lazy(() => import("./pages/admin/Stats"));

export default function App() {
  return (
    <Suspense fallback={<div className="app__loading" role="status">Загружаем раздел…</div>}>
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
    </Suspense>
  );
}
