import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, Target, Dumbbell, PawPrint, BookOpen, User, Flame, Zap } from "lucide-react";
import Logo from "../brand/Logo";
import StatPill from "../ui/StatPill";
import RewardOverlay from "./RewardOverlay";
import { useApp } from "../../store/AppStore";
import "./AppLayout.css";

const NAV = [
  { to: "/app", label: "Главная", icon: Home, end: true },
  { to: "/app/practice", label: "Практика", icon: Dumbbell },
  { to: "/app/diagnostic", label: "Диагностика", icon: Target },
  { to: "/app/homework", label: "Домашка", icon: BookOpen },
  { to: "/app/pet", label: "Питомец", icon: PawPrint },
  { to: "/app/profile", label: "Кабинет", icon: User },
];

export default function AppLayout() {
  const { profile } = useApp();
  const { pathname } = useLocation();
  // Practice/diagnostic run in a focused mode — hide chrome distractions there.
  const focus = pathname.startsWith("/practice/run") || pathname.startsWith("/diagnostic/run");

  return (
    <div className={`app ${focus ? "app--focus" : ""}`}>
      <aside className="app__sidebar">
        <div className="app__brand">
          <Logo height={30} />
        </div>
        <nav className="app__nav" aria-label="Основная навигация">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="navitem">
              <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app__sidebar-foot">
          <div className="app__subject">{profile.subject}</div>
        </div>
      </aside>

      <div className="app__main">
        <header className="app__header">
          <div className="app__header-brand">
            <Logo height={26} />
          </div>
          <div className="app__stats">
            <StatPill icon={Flame} value={profile.streak} tone="accent" label="Стрик" />
            <StatPill icon={Zap} value={profile.xp} tone="primary" label="XP" />
            <div className="app__level" title="Уровень">
              <span className="app__level-num font-display">{profile.level}</span>
            </div>
          </div>
        </header>

        <main className="app__content">
          <Outlet />
        </main>
      </div>

      <nav className="app__tabbar" aria-label="Мобильная навигация">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabitem" aria-label={label}>
            <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <RewardOverlay />
    </div>
  );
}
