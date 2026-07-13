import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { Target, Dumbbell, PawPrint, BookOpen, User, RefreshCw, Coins } from "lucide-react";
import Button from "../ui/Button";
import Logo from "../brand/Logo";
import { StreakPill } from "../ui/StatPill";
import RewardOverlay from "./RewardOverlay";
import { useApp } from "../../store/AppStore";
import { studentApi } from "../../api/student";
import "./AppLayout.css";

const FULL_NAV = [
  { to: "/app/practice", label: "Практика", icon: Dumbbell },
  { to: "/app/homework", label: "Домашка", icon: BookOpen },
  { to: "/app/pet", label: "Питомец", icon: PawPrint },
  { to: "/app/profile", label: "Профиль", icon: User },
];
// A self-serve student who hasn't been assigned a subject by staff yet
// only gets the diagnostic — everything else 403s server-side anyway.
const PENDING_NAV = [{ to: "/app/diagnostic", label: "Диагностика", icon: Target }];

export default function AppLayout() {
  const { profile, hydrate, hydrated } = useApp();
  const { pathname } = useLocation();
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [statInfo, setStatInfo] = useState(null);
  // Practice/diagnostic run in a focused mode — hide chrome distractions there.
  const focus = pathname.startsWith("/app/practice/run") || pathname.startsWith("/app/diagnostic/run");
  const todayISO = new Date().toISOString().slice(0, 10);
  const doneToday = profile.streakLastDoneOn === todayISO;
  const isActive = profile.status === "active";
  const onboardingStep = profile.onboardingStep ?? "complete";
  const onboardingIncomplete = onboardingStep !== "complete";
  const NAV = isActive ? FULL_NAV : PENDING_NAV;
  const xpInLevel = Math.max(0, profile.xp - profile.xpFromLevel);
  const xpNeeded = Math.max(1, profile.xpForNext - profile.xpFromLevel);
  const xpProgress = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

  const loadProfile = useCallback(() => {
    setLoadError("");
    studentApi.profile()
      .then(hydrate)
      .catch(() => setLoadError("Не удалось загрузить профиль. Проверь соединение и попробуй ещё раз."));
  }, [hydrate]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, loadAttempt]);

  useEffect(() => {
    if (!hydrated || !isActive || pathname !== "/app/profile") return undefined;
    const preload = () => {
      void Promise.allSettled([
        import("../../pages/Practice"),
        import("../../pages/PracticeRun"),
        import("../../pages/Homework"),
        import("../../pages/Pet"),
      ]);
      void studentApi.prefetchStudentSections();
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preload, { timeout: 900 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 120);
    return () => window.clearTimeout(id);
  }, [hydrated, isActive, pathname]);

  if (loadError && !hydrated) {
    return (
      <main className="app__load-state" role="alert">
        <div className="app__load-state-card">
          <h1>Профиль не загрузился</h1>
          <p>{loadError}</p>
          <Button icon={RefreshCw} onClick={() => setLoadAttempt((value) => value + 1)}>
            Повторить
          </Button>
        </div>
      </main>
    );
  }

  if (!hydrated) {
    return <div className="app__loading">Загрузка приложения…</div>;
  }

  // A pending student who lands anywhere but the diagnostic (typed URL,
  // stale link) gets bounced to the one thing they can actually do.
  if (onboardingStep === "subject" && !pathname.startsWith("/app/onboarding")) {
    return <Navigate to="/app/onboarding" replace />;
  }
  if (onboardingStep === "diagnostic" && !pathname.startsWith("/app/diagnostic")) {
    return <Navigate to="/app/diagnostic" replace />;
  }
  if (onboardingStep === "pet" && !pathname.startsWith("/app/pet")) {
    return <Navigate to="/app/pet" replace />;
  }
  if (hydrated && !isActive && !onboardingIncomplete && !focus && !pathname.startsWith("/app/diagnostic")) {
    return <Navigate to="/app/diagnostic" replace />;
  }

  return (
    <div className={`app ${focus ? "app--focus" : ""} ${onboardingIncomplete ? "app--onboarding" : ""} ${onboardingStep === "pet" ? "app--pet-choice" : ""} ${!isActive ? "app--pending" : ""}`}>
      {!onboardingIncomplete && <aside className="app__sidebar">
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
      </aside>}

      <div className="app__main">
        {!onboardingIncomplete && <header className="app__header">
          <div className="app__header-brand">
            <Logo height={34} />
          </div>
          {isActive && <div className="app__stats">
            <StreakPill value={profile.streak} doneToday={doneToday} />
            <div className="app__stat-wrap">
              <button
                type="button"
                className="app__coins"
                onClick={() => setStatInfo((value) => value === "coins" ? null : "coins")}
                aria-expanded={statInfo === "coins"}
                aria-label={`${profile.coins} монет: как заработать`}
              >
                <Coins size={16} aria-hidden="true" /><b>{profile.coins}</b>
              </button>
              {statInfo === "coins" && (
                <div className="app__stat-popover" role="status">
                  Монеты начисляются за верные ответы в практике, диагностике и домашке. Больше сложность и меньше подсказок — больше награда.
                </div>
              )}
            </div>
            <div className="app__stat-wrap app__stat-wrap--level">
            <button
              type="button"
              className="app__level"
              onClick={() => setStatInfo((value) => value === "level" ? null : "level")}
              aria-expanded={statInfo === "level"}
              aria-label={`Уровень ${profile.level}, осталось ${Math.max(0, xpNeeded - xpInLevel)} XP`}
            >
              <span className="app__level-copy"><span className="app__level-tag">ур. {profile.level}</span><span className="app__level-sep">·</span><span className="app__level-num font-display">{profile.xp} XP</span></span>
              <span className="app__level-track" aria-label={`Осталось ${Math.max(0, xpNeeded - xpInLevel)} XP`}><i style={{ width: `${xpProgress}%` }} /></span>
            </button>
              {statInfo === "level" && (
                <div className="app__stat-popover app__stat-popover--right" role="status">
                  Уровень растёт от XP. XP дают за верные задания; подсказки и повторные попытки уменьшают награду.
                </div>
              )}
            </div>
          </div>}
        </header>}

        <main className="app__content">
          <Outlet />
        </main>
      </div>

      {isActive && !onboardingIncomplete && <nav className="app__tabbar" aria-label="Мобильная навигация">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabitem" aria-label={label}>
            <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>}

      <RewardOverlay />
    </div>
  );
}
