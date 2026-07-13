import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Flame,
  Play,
  RefreshCw,
  Target,
  Zap,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import PetAvatar from "../components/pet/PetAvatar";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import { formatDue, plural } from "../utils/format";
import "./Dashboard.css";

export default function Dashboard() {
  const { profile, topics } = useApp();
  const [homeworkState, setHomeworkState] = useState({ status: "loading", items: [], counts: { active: 0, overdue: 0 } });

  const loadHomework = useCallback(async () => {
    setHomeworkState((state) => ({ ...state, status: "loading" }));
    try {
      const data = await studentApi.homework();
      setHomeworkState({
        status: "ready",
        items: (data.homework ?? []).filter((item) => item.status !== "done").slice(0, 3),
        counts: data.counts ?? { active: 0, overdue: 0 },
      });
    } catch {
      setHomeworkState((state) => ({ ...state, status: "error" }));
    }
  }, []);

  useEffect(() => {
    loadHomework();
  }, [loadHomework]);

  const weakTopics = topics.filter((topic) => topic.status !== "green").slice(0, 3);
  const xpInLevel = Math.max(0, profile.xp - profile.xpFromLevel);
  const xpNeeded = Math.max(1, profile.xpForNext - profile.xpFromLevel);
  const xpProgress = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
  const needsDiagnostic = !profile.diagnosticDone || topics.length === 0;
  const primaryPath = needsDiagnostic ? "/app/diagnostic" : "/app/practice/run";
  const primaryLabel = needsDiagnostic ? "Пройти диагностику" : "Начать практику";
  const firstName = profile.name?.trim().split(/\s+/)[0];

  return (
    <div className="dash">
      <header className="dash__heading">
        <div>
          <p className="dash__welcome">{firstName ? `Привет, ${firstName}` : "Привет"}</p>
          <h1>Что сделаем сегодня?</h1>
          <p className="dash__context">
            {[profile.subject, profile.grade ? `${profile.grade} класс` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Link className="dash__profile-link" to="/app/profile">
          Открыть прогресс <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </header>

      <section className="dash__today" aria-labelledby="today-title">
        <div className="dash__today-copy">
          <p className="dash__today-label">План на сегодня</p>
          <h2 id="today-title">
            {needsDiagnostic ? "Собери персональную карту знаний" : "Продолжи с тем, что требует внимания"}
          </h2>
          <p>
            {needsDiagnostic
              ? "Короткий тест определит сильные темы и подберёт подходящие задания."
              : weakTopics.length > 0
                ? `Начнём с темы «${weakTopics[0].name}». Серия займёт около пяти минут.`
                : "Закрепи результат короткой персональной серией заданий."}
          </p>
          <Button as={Link} to={primaryPath} size="lg" variant="accent" icon={needsDiagnostic ? Target : Play}>
            {primaryLabel}
          </Button>
        </div>
        <div className="dash__today-progress" aria-label={`Уровень ${profile.level}, прогресс ${xpProgress}%`}>
          <div className="dash__level-row">
            <span>Уровень {profile.level}</span>
            <strong>{profile.xp} XP</strong>
          </div>
          <div className="dash__xp-track" aria-hidden="true">
            <span style={{ width: `${xpProgress}%` }} />
          </div>
          <div className="dash__streak">
            <Flame size={17} aria-hidden="true" />
            <span>{profile.streak} {plural(profile.streak, "день", "дня", "дней")} подряд</span>
          </div>
        </div>
      </section>

      <Link to="/app/pet" className="dash__pet-reward">
        <div className="dash__pet-avatar" aria-hidden="true">
          <PetAvatar species={profile.pet.species} mood="happy" size={88} />
        </div>
        <div className="dash__pet-copy">
          <span className="dash__pet-title">{profile.pet.name} — твоя награда за учёбу</span>
          <span className="dash__pet-text">Зарабатывай баллы в практике и открывай предметы для питомца.</span>
        </div>
        <span className="dash__coins"><Zap size={15} aria-hidden="true" /> {profile.coins}</span>
        <ArrowRight className="dash__pet-arrow" size={20} aria-hidden="true" />
      </Link>

      <div className="dash__grid">
        <Card className="dash__panel" pad="md">
          <div className="dash__panel-head">
            <div>
              <p className="dash__panel-kicker">Учебный фокус</p>
              <h2>Темы для повторения</h2>
            </div>
            <Link to="/app/profile" aria-label="Открыть всю карту знаний"><ChevronRight size={20} /></Link>
          </div>
          {topics.length === 0 ? (
            <div className="dash__empty-block">
              <Target size={22} aria-hidden="true" />
              <p>Темы появятся после диагностики.</p>
            </div>
          ) : weakTopics.length === 0 ? (
            <div className="dash__empty-block dash__empty-block--success">
              <Target size={22} aria-hidden="true" />
              <p>Все оценённые темы освоены. Можно повысить сложность.</p>
            </div>
          ) : (
            <ul className="dash__topic-list">
              {weakTopics.map((topic) => (
                <li key={`${topic.subject ?? "subject"}:${topic.id}`}>
                  <div className="dash__topic-row">
                    <span>{topic.name}</span>
                    <strong>{topic.mastery}%</strong>
                  </div>
                  <div className="dash__topic-track" aria-label={`${topic.name}: освоено ${topic.mastery}%`}>
                    <span style={{ width: `${topic.mastery}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="dash__panel" pad="md">
          <div className="dash__panel-head">
            <div>
              <p className="dash__panel-kicker">Домашняя работа</p>
              <h2>
                {homeworkState.counts.active > 0
                  ? `${homeworkState.counts.active} ${plural(homeworkState.counts.active, "задание", "задания", "заданий")}`
                  : "Новых заданий нет"}
              </h2>
            </div>
            <Link to="/app/homework" aria-label="Открыть домашние задания"><ChevronRight size={20} /></Link>
          </div>
          {homeworkState.status === "loading" ? (
            <div className="dash__skeleton" aria-label="Загружаем домашние задания"><span /><span /><span /></div>
          ) : homeworkState.status === "error" ? (
            <div className="dash__inline-error" role="alert">
              <p>Не удалось загрузить домашние задания.</p>
              <button type="button" onClick={loadHomework}><RefreshCw size={16} /> Повторить</button>
            </div>
          ) : homeworkState.items.length === 0 ? (
            <div className="dash__empty-block dash__empty-block--success">
              <BookOpen size={22} aria-hidden="true" />
              <p>На сегодня всё выполнено.</p>
            </div>
          ) : (
            <ul className="dash__homework-list">
              {homeworkState.items.map((item) => (
                <li key={item.id}>
                  <span className="dash__homework-title">{item.title}</span>
                  <span className={item.notice?.tone === "danger" ? "dash__due dash__due--danger" : "dash__due"}>
                    {item.due ? formatDue(item.due) : "без срока"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
