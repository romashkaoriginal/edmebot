import { useEffect, useState } from "react";
import {
  Flame,
  Zap,
  Target,
  Clock,
  CheckCircle2,
  TrendingUp,
  Lightbulb,
  FileText,
  Trophy,
} from "lucide-react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import ProgressBar from "../components/ui/ProgressBar";
import SectionTitle from "../components/ui/SectionTitle";
import PetAvatar from "../components/pet/PetAvatar";
import KnowledgeMap from "../components/shared/KnowledgeMap";
import Achievements from "../components/shared/Achievements";
import { useApp } from "../store/AppStore";
import { achievements, weekActivity } from "../data/mock";
import { apiUrl } from "../api/base";
import "./Profile.css";

export default function Profile() {
  const { profile, topics } = useApp();
  const xpInLevel = profile.xp - profile.xpFromLevel;
  const xpNeeded = profile.xpForNext - profile.xpFromLevel;
  const weak = topics.filter((t) => t.status === "red");
  const strong = topics.filter((t) => t.status === "green");
  const maxTasks = Math.max(...weekActivity.map((d) => d.tasks));
  const earned = achievements.filter((a) => a.earned);

  // Real practice stats from the DB (solved/accuracy/topic mastery), fetched
  // via the admin stats endpoint for the demo student.
  const [dbStats, setDbStats] = useState(null);
  useEffect(() => {
    fetch(apiUrl("/api/admin/stats"))
      .then((r) => r.json())
      .then(({ students }) => students?.[0]?.id)
      .then((id) => (id ? fetch(apiUrl(`/api/admin/stats/${id}`)).then((r) => r.json()) : null))
      .then((data) => data && setDbStats(data))
      .catch(() => setDbStats(null));
  }, []);

  const solvedTotal = dbStats?.stats.attempts ?? profile.solvedTotal;
  const accuracy = dbStats?.stats.accuracy ?? profile.accuracy;

  return (
    <div className="prof">
      {/* Header card */}
      <Card className="prof__hero" pad="lg">
        <PetAvatar species={profile.pet.species} mood="happy" size={92} />
        <div className="prof__hero-info">
          <h1>{profile.name}</h1>
          <p className="prof__hero-sub">
            {profile.grade} класс · {profile.subject}
          </p>
          <div className="prof__hero-pills">
            <span className="prof__pill">
              <Flame size={15} strokeWidth={2.6} /> {profile.streak} дней
            </span>
            <span className="prof__pill">
              <Trophy size={15} strokeWidth={2.6} /> {earned.length} наград
            </span>
          </div>
        </div>
        <div className="prof__level">
          <div className="prof__level-badge font-display">{profile.level}</div>
          <span className="prof__level-label">уровень</span>
        </div>
      </Card>

      {/* Level progress */}
      <Card pad="md">
        <div className="prof__xp-head">
          <span className="prof__xp-title">
            <Zap size={16} strokeWidth={2.6} /> {profile.xp} XP
          </span>
          <span className="prof__xp-sub">до уровня {profile.level + 1}: {xpNeeded - xpInLevel} XP</span>
        </div>
        <ProgressBar value={xpInLevel} max={xpNeeded} tone="xp" />
      </Card>

      {/* Stat tiles */}
      <div className="prof__stats">
        <StatTile icon={CheckCircle2} value={solvedTotal} label="решено заданий" tone="primary" />
        <StatTile icon={Target} value={`${accuracy}%`} label="правильных" tone="success" />
        <StatTile icon={Clock} value={`${profile.avgTimeSec}с`} label="среднее время" tone="accent" />
      </div>

      {/* Weekly activity chart */}
      <section>
        <SectionTitle>Активность за неделю</SectionTitle>
        <Card pad="md">
          <div className="prof__chart">
            {weekActivity.map((d) => (
              <div key={d.day} className="prof__bar-col">
                <div className="prof__bar-wrap">
                  <div
                    className="prof__bar"
                    style={{ height: `${(d.tasks / maxTasks) * 100}%` }}
                    title={`${d.tasks} заданий`}
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

      {/* Knowledge map */}
      <section>
        <SectionTitle>Карта знаний</SectionTitle>
        <KnowledgeMap topics={topics} />
      </section>

      {/* Recommendations (rule-based) */}
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
            <li>На занятии с репетитором стоит разобрать: <b>{weak[0]?.name ?? topics[0].name}</b>.</li>
          </ul>
        </Card>
      </section>

      {/* Achievements */}
      <section>
        <SectionTitle>Достижения</SectionTitle>
        <Achievements items={achievements} />
      </section>

      {/* Weekly report */}
      <section>
        <Card className="prof__report" pad="md">
          <div className="prof__report-head">
            <FileText size={20} strokeWidth={2.4} />
            <div>
              <div className="prof__report-title">Еженедельный отчёт</div>
              <div className="prof__report-sub">для ученика и родителя</div>
            </div>
            <Badge tone="accent" icon={TrendingUp}>+12% за неделю</Badge>
          </div>
          <ul className="prof__report-list">
            <li>Выполнено <b>46</b> заданий</li>
            <li>Потрачено на обучение <b>3 ч 20 мин</b></li>
            <li>Улучшена тема <b>«Проценты»</b> (жёлтая → почти зелёная)</li>
            <li>На следующей неделе: подтянуть <b>«Дроби»</b> и <b>«Текстовые задачи»</b></li>
          </ul>
        </Card>
      </section>
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
