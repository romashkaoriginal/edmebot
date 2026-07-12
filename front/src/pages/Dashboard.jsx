import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, ChevronRight, Target, Flame, Zap } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import PetAvatar from "../components/pet/PetAvatar";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import { plural, formatDue } from "../utils/format";
import "./Dashboard.css";

const STATUS_META = {
  red: { glyph: "🔴", color: "var(--danger)", label: "Слабая" },
  yellow: { glyph: "🟡", color: "var(--warning)", label: "Повторить" },
  green: { glyph: "🟢", color: "var(--success)", label: "Освоено" },
};

export default function Dashboard() {
  const { profile, topics } = useApp();
  const xpInLevel = profile.xp - profile.xpFromLevel;
  const xpNeeded = profile.xpForNext - profile.xpFromLevel;
  const xpLeft = Math.max(0, xpNeeded - xpInLevel);

  const assessed = topics.length > 0;
  // Weakest assessed topics first (backend already sorts by mastery asc).
  const weak = topics.filter((t) => t.status !== "green").slice(0, 5);

  // Homework comes from the backend (assigned via admin panel).
  const [activeHw, setActiveHw] = useState([]);
  useEffect(() => {
    studentApi.homework()
      .then((d) => setActiveHw((d.homework ?? []).slice(0, 3)))
      .catch(() => setActiveHw([]));
  }, []);

  // Real donut: distribution of the student's assessed topics by status.
  const donutSlices = assessed
    ? ["green", "yellow", "red"]
        .map((s) => ({ value: topics.filter((t) => t.status === s).length, color: STATUS_META[s].color }))
        .filter((s) => s.value > 0)
    : [];

  return (
    <div className="dash">
      {/* Hero: name · grade + circular pet */}
      <header className="dash__top">
        <h1 className="display-title dash__title">
          {profile.name ? `${profile.name}` : "Привет!"}
          {profile.grade ? <span className="dash__grade"> · {profile.grade} класс</span> : null}
        </h1>
        <div className="dash__pet-ring">
          <PetAvatar species={profile.pet.species} mood="happy" size={120} />
        </div>
      </header>

      {/* Progress hero — real streak / XP, with a real status donut once assessed */}
      <Card className="dash__practice card--lav" pad="lg">
        <div className="dash__practice-body">
          <div className="dash__practice-head">
            <h2 className="dash__practice-title">Уровень {profile.level}</h2>
            <p className="dash__practice-sub">
              До уровня {profile.level + 1} осталось {xpLeft} XP
            </p>
          </div>
          <div className="dash__practice-stats">
            <span className="dash__stat">
              <Zap size={16} strokeWidth={2.6} className="dash__stat-icon dash__stat-icon--xp" />
              <b className="font-display">{profile.xp}</b> XP
            </span>
            <span className="dash__stat">
              <Flame size={16} strokeWidth={2.6} className="dash__stat-icon dash__stat-icon--streak" />
              Стрик <b className="font-display">{profile.streak}</b>{" "}
              {plural(profile.streak, "день", "дня", "дней")}
            </span>
          </div>
        </div>
        {donutSlices.length > 0 && <Donut slices={donutSlices} size={120} />}
      </Card>

      {/* Knowledge: real weak topics, or an onboarding nudge to the diagnostic */}
      {assessed ? (
        <Card className="dash__weak" pad="md">
          <div className="dash__weak-head">
            <h2 className="dash__weak-title">Над чем поработать</h2>
            <Link to="/app/profile" className="dash__link">
              Вся карта <ChevronRight size={16} />
            </Link>
          </div>
          {weak.length > 0 ? (
            <ul className="dash__weak-list">
              {weak.map((t) => (
                <li key={t.id} className="dash__weak-item">
                  <span className="dash__weak-glyph" aria-hidden="true">
                    {STATUS_META[t.status].glyph}
                  </span>
                  <span className="dash__weak-name">{t.name}</span>
                  <span className="dash__weak-bar" aria-hidden="true">
                    <span className="dash__weak-fill" style={{ width: `${t.mastery}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dash__weak-empty">Все темы освоены — так держать! 🎉</p>
          )}
        </Card>
      ) : (
        <Card className="dash__onb" pad="lg">
          <span className="dash__onb-icon" aria-hidden="true">
            <Target size={26} strokeWidth={2.4} />
          </span>
          <h2 className="dash__onb-title">Собери карту знаний</h2>
          <p className="dash__onb-text">
            Пройди короткий входной тест — он покажет твои сильные и слабые темы,
            и практика будет подбираться под тебя.
          </p>
          <Button as={Link} to="/app/diagnostic" size="lg" icon={Target}>
            Пройти диагностику
          </Button>
        </Card>
      )}

      {/* Homework preview (backend-driven) */}
      {activeHw.length > 0 && (
        <Card className="dash__weak" pad="md">
          <div className="dash__weak-head">
            <h2 className="dash__weak-title">Домашка</h2>
            <Link to="/app/homework" className="dash__link">
              Все <ChevronRight size={16} />
            </Link>
          </div>
          <ul className="dash__weak-list">
            {activeHw.map((h) => (
              <li key={h.id} className="dash__weak-item">
                <span className="dash__weak-glyph" aria-hidden="true">📝</span>
                <span className="dash__weak-name">{h.title}</span>
                {h.due && <span className="dash__hw-due">до {formatDue(h.due)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Button as={Link} to="/app/practice/run" size="lg" icon={Play} className="dash__cta">
        Начать практику
      </Button>
    </div>
  );
}

/** Donut built from real status counts. */
function Donut({ slices, size = 120 }) {
  const stroke = size * 0.26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <svg className="dash__donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {slices.map((s, i) => {
          const len = (s.value / total) * c;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </g>
      <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 - 3} fill="oklch(1 0 0 / 0.85)" />
    </svg>
  );
}

