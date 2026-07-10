import { NavLink, Outlet, Link } from "react-router-dom";
import { Users, ListChecks, BookOpen, BarChart3, LogOut } from "lucide-react";
import Logo from "../brand/Logo";
import "./AdminLayout.css";

const NAV = [
  { to: "/admin/students", label: "Ученики", icon: Users },
  { to: "/admin/tasks", label: "Задания", icon: ListChecks },
  { to: "/admin/homework", label: "Домашка", icon: BookOpen },
  { to: "/admin/stats", label: "Статистика", icon: BarChart3 },
];

export default function AdminLayout() {
  return (
    <div className="admin">
      <aside className="admin__sidebar">
        <div className="admin__brand">
          <Logo height={28} />
          <span className="admin__badge">Админ</span>
        </div>
        <nav className="admin__nav" aria-label="Навигация админ‑панели">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="admin__navitem">
              <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <Link to="/" className="admin__exit">
          <LogOut size={18} strokeWidth={2.2} />
          <span>Выйти</span>
        </Link>
      </aside>

      <div className="admin__main">
        <nav className="admin__tabbar" aria-label="Мобильная навигация">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="admin__tabitem" aria-label={label}>
              <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="admin__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
