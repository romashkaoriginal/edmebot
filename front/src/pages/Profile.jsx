import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Zap, Target, CheckCircle2, Lightbulb, Trophy, RefreshCw } from "lucide-react";
import Card from "../components/ui/Card";
import ProgressBar from "../components/ui/ProgressBar";
import SectionTitle from "../components/ui/SectionTitle";
import PetAvatar from "../components/pet/PetAvatar";
import KnowledgeMap from "../components/shared/KnowledgeMap";
import Achievements from "../components/shared/Achievements";
import Button from "../components/ui/Button";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import { plural } from "../utils/format";
import "./Profile.css";

export default function Profile() {
  const { profile, topics } = useApp();
  const xpInLevel = profile.xp - profile.xpFromLevel;
  const xpNeeded = profile.xpForNext - profile.xpFromLevel;
  const weak = topics.filter((t) => t.status === "red");
  const strong = topics.filter((t) => t.status === "green");

  // All analytics (solved, accuracy, weekly activity, achievements) come from
  // the backend and reflect real activity — nothing is fabricated.
  const [analyticsState, setAnalyticsState] = useState({ status: "loading", data: null });
  const loadAnalytics = useCallback(() => {
    setAnalyticsState((state) => ({ ...state, status: "loading" }));
    studentApi.analytics()
      .then((data) => setAnalyticsState({ status: "ready", data }))
      .catch(() => setAnalyticsState({ status: "error", data: null }));
  }, []);
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const dbStats = analyticsState.data;
  const solvedTotal = dbStats?.stats?.solvedTotal;
  const accuracy = dbStats?.stats?.accuracy;
  const weekActivity = dbStats?.weekActivity ?? [];
  const achievements = dbStats?.achievements ?? [];
  const maxTasks = Math.max(1, ...weekActivity.map((d) => d.tasks));
  const earned = achievements.filter((a) => a.earned);
  const hasActivity = weekActivity.some((d) => d.tasks > 0);

  return (
    <div className="prof">
      {/* Header card: student identity is the clear headline; the pet is a
          labeled companion strip below it, so nothing reads as "the pet's
          level" or "the pet's name". */}
      <Card className="prof__hero" pad="lg">
        <div className="prof__hero-top">
          <div className="prof__hero-info">
            <h1>{profile.name || "Ученик"}</h1>
            {(profile.grade || profile.subject) && (
              <p className="prof__hero-sub">
                {[profile.grade ? `${profile.grade} класс` : null, profile.subject]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="prof__level">
            <div className="prof__level-badge font-display">{profile.level}</div>
            <span className="prof__level-label">уровень</span>
          </div>
        </div>

        <div className="prof__hero-pills">
          <span className="prof__pill">
            <Flame size={15} strokeWidth={2.6} /> {profile.streak}{" "}
            {plural(profile.streak, "день", "дня", "дней")} подряд
          </span>
          <span className="prof__pill">
            <Trophy size={15} strokeWidth={2.6} /> {earned.length}{" "}
            {plural(earned.length, "награда", "награды", "наград")}
          </span>
        </div>

        <Link to="/app/pet" className="prof__companion">
          <PetAvatar species={profile.pet.species} mood="happy" size={48} />
          <span className="prof__companion-text">
            Награда за учёбу — <b>{profile.pet.name}</b>
          </span>
        </Link>
      </Card>

      {/* Level progress */}
      <Card pad="md">
        <div className="prof__xp-head">
          <span className="prof__xp-title">
            <Zap size={16} strokeWidth={2.6} /> {profile.xp} XP
          </span>
          <span className="prof__xp-sub">до уровня {profile.level + 1}: {xpNeeded - xpInLevel} XP</span>
        </div>
        <ProgressBar value={xpInLevel} max={xpNeeded} tone="xp" ariaLabel={`Прогресс уровня: ${xpInLevel} из ${xpNeeded} XP`} />
      </Card>

      {analyticsState.status === "loading" ? (
        <div className="prof__stats prof__stats--loading" aria-label="Загружаем статистику"><span /><span /><span /></div>
      ) : analyticsState.status === "error" ? (
        <Card className="prof__analytics-error" pad="md" role="alert">
          <p>Не удалось загрузить статистику. Прогресс не потерян.</p>
          <Button size="sm" variant="soft" icon={RefreshCw} onClick={loadAnalytics}>Повторить</Button>
        </Card>
      ) : (
        <div className="prof__stats">
          <StatTile icon={CheckCircle2} value={solvedTotal} label="решено заданий" tone="primary" />
          <StatTile icon={Target} value={`${accuracy}%`} label="правильных" tone="success" />
          <StatTile icon={Trophy} value={earned.length} label="наград" tone="accent" />
        </div>
      )}

      {/* Weekly activity — only when there is real activity */}
      {hasActivity && (
        <section>
          <SectionTitle>Активность за неделю</SectionTitle>
          <Card pad="md">
            <div className="prof__chart" role="list" aria-label="Количество решённых заданий по дням">
              {weekActivity.map((d) => (
                <div key={d.day} className="prof__bar-col" role="listitem" aria-label={`${d.day}: ${d.tasks} заданий`}>
                  <div className="prof__bar-wrap">
                    <div
                      className="prof__bar"
                      style={{ height: `${(d.tasks / maxTasks) * 100}%` }}
                      aria-hidden="true"
                    >
                      <span className="prof__bar-val">{d.tasks}</span>
                    </div>
                  </div>
                  <span className="prof__bar-day">{d.day}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Knowledge map — only after the diagnostic has assessed topics */}
      {topics.length > 0 ? (
        <section>
          <SectionTitle>Карта знаний</SectionTitle>
          <KnowledgeMap topics={topics} />
        </section>
      ) : (
        <Card className="prof__nomap" pad="md">
          <Target size={20} strokeWidth={2.4} className="prof__nomap-icon" />
          <p>
            Карта знаний появится после входного теста.{" "}
            <Link to="/app/diagnostic" className="prof__nomap-link">Пройти диагностику</Link>
          </p>
        </Card>
      )}

      {/* Recommendations — only when there is something real to recommend */}
      {(weak.length > 0 || strong.length > 0) && (
        <section>
          <SectionTitle>Рекомендации</SectionTitle>
          <Card className="prof__rec" pad="md">
            <Lightbulb size={22} strokeWidth={2.4} className="prof__rec-icon" />
            <ul className="prof__rec-list">
              {weak.length > 0 && (
                <li>
                  Повторить: <b>{weak.map((t) => t.name).join(", ")}</b> — самые слабые темы.
                </li>
              )}
              {strong.length > 0 && (
                <li>
                  Хорошо освоено: <b>{strong.map((t) => t.name).join(", ")}</b>. Можно усложнить.
                </li>
              )}
            </ul>
          </Card>
        </section>
      )}

      {/* Achievements — only earned ones (backend returns real ones) */}
      {earned.length > 0 && (
        <section>
          <SectionTitle>Достижения</SectionTitle>
          <Achievements items={earned} />
        </section>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, value, label, tone }) {
  return (
    <Card className={`stile stile--${tone}`} pad="md">
      <span className="stile__icon">
        <Icon size={20} strokeWidth={2.4} />
      </span>
      <span className="stile__value font-display">{value}</span>
      <span className="stile__label">{label}</span>
    </Card>
  );
}
