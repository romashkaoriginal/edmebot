import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell, AlertCircle, GraduationCap, ListTree, Play } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import SectionTitle from "../components/ui/SectionTitle";
import { useApp } from "../store/AppStore";
import "./Practice.css";

const MODES = [
  {
    id: "weak",
    icon: AlertCircle,
    title: "По слабым темам",
    desc: "Акцент на темах с ошибками из диагностики",
    tone: "danger",
  },
  {
    id: "exam",
    icon: GraduationCap,
    title: "Подготовка к контрольной",
    desc: "Тематический тренинг по выбранному разделу",
    tone: "primary",
  },
  {
    id: "topic",
    icon: ListTree,
    title: "По конкретной теме",
    desc: "Свободный выбор темы",
    tone: "accent",
  },
];

const LEVELS = [
  { id: "easy", label: "Лёгкий", desc: "Базовые задания" },
  { id: "medium", label: "Средний", desc: "Стандартные" },
  { id: "hard", label: "Сложный", desc: "Повышенная" },
  { id: "auto", label: "Автоподбор", desc: "Бот подстроит" },
];

export default function Practice() {
  const navigate = useNavigate();
  const { topics } = useApp();
  const [mode, setMode] = useState("weak");
  const [level, setLevel] = useState("auto");
  const [topic, setTopic] = useState(topics[0].id);

  function start() {
    const params = new URLSearchParams({ mode, level });
    if (mode === "topic") params.set("topic", topic);
    navigate(`/practice/run?${params}`);
  }

  return (
    <div className="prac">
      <header className="prac__head">
        <div className="prac__head-icon">
          <Dumbbell size={26} strokeWidth={2.4} />
        </div>
        <div>
          <h1>Практика</h1>
          <p className="prac__sub">Настрой тренировку под себя</p>
        </div>
      </header>

      <section>
        <SectionTitle>Режим</SectionTitle>
        <div className="prac__modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`prac__mode ${mode === m.id ? "prac__mode--on" : ""}`}
              onClick={() => setMode(m.id)}
            >
              <span className={`prac__mode-icon prac__mode-icon--${m.tone}`}>
                <m.icon size={20} strokeWidth={2.4} />
              </span>
              <span className="prac__mode-title">{m.title}</span>
              <span className="prac__mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {mode === "topic" && (
        <section>
          <SectionTitle>Тема</SectionTitle>
          <div className="prac__topics">
            {topics.map((t) => (
              <button
                key={t.id}
                className={`prac__chip ${topic === t.id ? "prac__chip--on" : ""}`}
                onClick={() => setTopic(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Уровень сложности</SectionTitle>
        <div className="prac__levels">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              className={`prac__level ${level === l.id ? "prac__level--on" : ""}`}
              onClick={() => setLevel(l.id)}
            >
              <span className="prac__level-label">{l.label}</span>
              <span className="prac__level-desc">{l.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <Card className="prac__start" pad="md">
        <Button size="lg" full icon={Play} onClick={start}>
          Поехали!
        </Button>
      </Card>
    </div>
  );
}
