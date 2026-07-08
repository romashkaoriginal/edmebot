import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Practice from "./pages/Practice";
import PracticeRun from "./pages/PracticeRun";
import Diagnostic from "./pages/Diagnostic";
import DiagnosticRun from "./pages/DiagnosticRun";
import Homework from "./pages/Homework";
import Pet from "./pages/Pet";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="practice" element={<Practice />} />
        <Route path="practice/run" element={<PracticeRun />} />
        <Route path="diagnostic" element={<Diagnostic />} />
        <Route path="diagnostic/run" element={<DiagnosticRun />} />
        <Route path="homework" element={<Homework />} />
        <Route path="pet" element={<Pet />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}
