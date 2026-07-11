import { NavLink, Outlet, Link } from "react-router-dom";
import { Users, UserCog, ListChecks, BookOpen, BarChart3, LogOut, ShieldAlert } from "lucide-react";
import Logo from "../brand/Logo";
import { useAdminAuth } from "../../context/AdminAuth";
import "./AdminLayout.css";

const NAV = [
  { to: "/admin/students", label: "Ученики", icon: Users, roles: ["admin"] },
  { to: "/admin/users", label: "Пользователи", icon: UserCog, roles: ["admin"] },
  { to: "/admin/tasks", label: "Задания", icon: ListChecks, roles: ["admin", "tutor"] },
  { to: "/admin/homework", label: "Домашка", icon: BookOpen, roles: ["admin", "tutor"] },
  { to: "/admin/stats", label: "Статистика", icon: BarChart3, roles: ["admin", "tutor"] },
];

export default function AdminLayout() {
  const { loading, user, error } = useAdminAuth();

  if (loading) {
    return <div className="admin admin--center">Загрузка…</div>;
  }

  if (error || !user) {
    return (
      <div className="admin admin--center">
        <div className="admin__denied">
          <ShieldAlert size={32} strokeWidth={2.2} />
          <h2>Доступ запрещён</h2>
          <p>Ваш Telegram‑аккаунт не привязан к роли в системе. Обратитесь к администратору.</p>
          <Link to="/" className="admin__exit">Вернуться назад</Link>
        </div>
      </div>
    );
  }

  const nav = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="admin">
      <aside className="admin__sidebar">
        <div className="admin__brand">
          <Logo height={28} />
          <span className="admin__badge">{user.role === "admin" ? "Админ" : "Репетитор"}</span>
        </div>
        <nav className="admin__nav" aria-label="Навигация админ‑панели">
          {nav.map(({ to, label, icon: Icon }) => (
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
          {nav.map(({ to, label, icon: Icon }) => (
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
