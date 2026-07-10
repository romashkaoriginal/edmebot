import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Zap, Play, ChevronRight, BookOpen, Sparkles } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import ProgressBar from "../components/ui/ProgressBar";
import Badge from "../components/ui/Badge";
import SectionTitle from "../components/ui/SectionTitle";
import PetAvatar from "../components/pet/PetAvatar";
import KnowledgeMap from "../components/shared/KnowledgeMap";
import { useApp } from "../store/AppStore";
import { apiUrl } from "../api/base";
import "./Dashboard.css";

export default function Dashboard() {
  const { profile, topics } = useApp();
  const xpInLevel = profile.xp - profile.xpFromLevel;
  const xpNeeded = profile.xpForNext - profile.xpFromLevel;
  const weakest = [...topics].sort((a, b) => a.mastery - b.mastery)[0];

  // Homework preview comes from the backend (assigned via admin panel).
  const [activeHw, setActiveHw] = useState([]);
  useEffect(() => {
    fetch(apiUrl("/api/homework?status=active"))
      .then((r) => r.json())
      .then((d) => setActiveHw((d.homework ?? []).slice(0, 2)))
      .catch(() => setActiveHw([]));
  }, []);

  return (
    <div className="dash">
      {/* Hero: greeting + pet + streak */}
      <Card className="dash__hero" pad="lg">
        <div className="dash__hero-text">
          <p className="dash__greeting">Привет, {profile.name}! 👋</p>
          <h1>Готов потренироваться сегодня?</h1>
          <div className="dash__streak">
            <span className="dash__streak-flame">
              <Flame size={20} strokeWidth={2.6} />
            </span>
            <span>
              Стрик <b className="font-display">{profile.streak}</b> дней — не потеряй его!
            </span>
          </div>
          <div className="dash__cta">
            <Button as={Link} to="/app/practice/run" size="lg" icon={Play}>
              Начать практику
            </Button>
          </div>
        </div>
        <div className="dash__pet">
          <PetAvatar species={profile.pet.species} mood="happy" size={148} />
          <span className="dash__pet-name">{profile.pet.name}</span>
        </div>
      </Card>

      {/* Level progress */}
      <Card className="dash__level" pad="md">
        <div className="dash__level-head">
          <div className="dash__level-badge">
            <span className="font-display">{profile.level}</span>
          </div>
          <div>
            <div className="dash__level-title">Уровень {profile.level}</div>
            <div className="dash__level-sub">
              До уровня {profile.level + 1} осталось{" "}
              <b>{xpNeeded - xpInLevel} XP</b>
            </div>
          </div>
          <Badge tone="accent" icon={Zap}>
            {profile.xp} XP
          </Badge>
        </div>
        <ProgressBar value={xpInLevel} max={xpNeeded} tone="xp" />
      </Card>

      <div className="dash__grid">
        {/* Knowledge map */}
        <section className="dash__col">
          <SectionTitle
            action={
              <Link to="/app/diagnostic" className="dash__link">
                Пройти диагностику <ChevronRight size={16} />
              </Link>
            }
          >
            Карта знаний
          </SectionTitle>
          <KnowledgeMap topics={topics} />

          <Card className="dash__recommend" pad="md">
            <Sparkles size={20} strokeWidth={2.4} className="dash__recommend-icon" />
            <div>
              <div className="dash__recommend-title">Рекомендуем повторить</div>
              <p className="dash__recommend-text">
                «{weakest.name}» — самая слабая тема. Несколько заданий помогут закрыть пробел.
              </p>
            </div>
            <Button as={Link} to="/app/practice/run" variant="soft" size="sm">
              Тренировать
            </Button>
          </Card>
        </section>

        {/* Homework preview */}
        <section className="dash__col">
          <SectionTitle
            action={
              <Link to="/app/homework" className="dash__link">
                Все <ChevronRight size={16} />
              </Link>
            }
          >
            Домашка
          </SectionTitle>
          {activeHw.length === 0 ? (
            <Card pad="md">
              <p className="dash__empty">Нет активных заданий 🎉</p>
            </Card>
          ) : (
            <div className="dash__hw-list">
              {activeHw.map((h) => (
                <Card key={h.id} className="dash__hw" pad="md">
                  <span className="dash__hw-icon">
                    <BookOpen size={18} strokeWidth={2.4} />
                  </span>
                  <div className="dash__hw-body">
                    <div className="dash__hw-title">{h.title}</div>
                    {h.description && <div className="dash__hw-topic">{h.description}</div>}
                  </div>
                  {h.due && <Badge tone="warning">до {formatDue(h.due)}</Badge>}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatDue(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
