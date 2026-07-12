import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Target, Dumbbell, PawPrint, BookOpen, User, Zap } from "lucide-react";
import Logo from "../brand/Logo";
import StatPill, { StreakPill } from "../ui/StatPill";
import RewardOverlay from "./RewardOverlay";
import { useApp } from "../../store/AppStore";
import { studentApi } from "../../api/student";
import "./AppLayout.css";

const NAV = [
  { to: "/app/practice", label: "Практика", icon: Dumbbell },
  { to: "/app/diagnostic", label: "Диагностика", icon: Target },
  { to: "/app/homework", label: "Домашка", icon: BookOpen },
  { to: "/app/pet", label: "Питомец", icon: PawPrint },
  { to: "/app/profile", label: "Кабинет", icon: User },
];

export default function AppLayout() {
  const { profile, hydrate } = useApp();
  const { pathname } = useLocation();
  // Practice/diagnostic run in a focused mode — hide chrome distractions there.
  const focus = pathname.startsWith("/practice/run") || pathname.startsWith("/diagnostic/run");
  const todayISO = new Date().toISOString().slice(0, 10);
  const doneToday = profile.streakLastDoneOn === todayISO;

  useEffect(() => {
    studentApi.profile().then(hydrate).catch(() => undefined);
  }, [hydrate]);

  return (
    <div className={`app ${focus ? "app--focus" : ""}`}>
      <aside className="app__sidebar">
        <div className="app__brand">
          <Logo height={34} />
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
            <Logo height={34} />
          </div>
          <div className="app__stats">
            <StreakPill value={profile.streak} doneToday={doneToday} />
            <StatPill icon={Zap} value={`${profile.xp} XP`} tone="primary" label="Опыт" />
            <div className="app__level" title={`Уровень ${profile.level}`}>
              <span className="app__level-tag">ур.</span>
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
