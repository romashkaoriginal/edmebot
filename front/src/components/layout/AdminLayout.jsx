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
          <span className="admin__brandmark"><Logo height={32} /></span>
          <div className="admin__brandcopy">
            <strong>Панель управления</strong>
            <span>EDme workspace</span>
          </div>
        </div>
        <nav className="admin__nav" aria-label="Навигация админ‑панели">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="admin__navitem">
              <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin__account">
          <div className="admin__profile">
            <span className="admin__avatar" aria-hidden="true">{initials(user.name)}</span>
            <span className="admin__profilecopy">
              <strong>{user.name}</strong>
              <small>{user.role === "admin" ? "Администратор" : "Репетитор"}</small>
            </span>
          </div>
          <Link to="/" className="admin__exit" aria-label="Выйти из панели">
            <LogOut size={18} strokeWidth={2.2} />
          </Link>
        </div>
      </aside>

      <div className="admin__main">
        <header className="admin__mobile-head">
          <Logo height={30} />
          <span className="admin__badge">{user.role === "admin" ? "Админ" : "Репетитор"}</span>
        </header>
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

function initials(name) {
  return String(name || "ED")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}
