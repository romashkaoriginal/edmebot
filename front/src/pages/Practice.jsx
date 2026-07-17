import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrainCircuit, AlertCircle, Infinity as InfinityIcon, ListTree, Play } from "lucide-react";
import Button from "../components/ui/Button";
import SectionTitle from "../components/ui/SectionTitle";
import { useApp } from "../store/AppStore";
import "./Practice.css";

const MODES = [
  {
    id: "endless",
    icon: InfinityIcon,
    title: "Бесконечная практика",
    desc: "Решай без финального экрана: задания будут подгружаться дальше",
    tone: "primary",
  },
  {
    id: "weak",
    icon: AlertCircle,
    title: "Работа над ошибками",
    desc: "В приоритете слабые темы и места, где чаще всего ошибаешься",
    tone: "danger",
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
  const hasTopics = topics.length > 0;
  const stored = readPracticePrefs();
  const [mode, setMode] = useState(stored.mode ?? "endless");
  const [level, setLevel] = useState(stored.level ?? "auto");
  const [topic, setTopic] = useState(stored.topic ?? topics[0]?.id ?? null);

  useEffect(() => {
    if (topics[0] && !topics.some((item) => item.id === topic)) setTopic(topics[0].id);
  }, [topic, topics]);

  useEffect(() => {
    localStorage.setItem("edme:practice:prefs", JSON.stringify({ mode, level, topic }));
  }, [level, mode, topic]);

  function start() {
    const params = new URLSearchParams({ mode, level });
    if (mode === "topic" && topic) params.set("topic", topic);
    navigate(`/app/practice/run?${params}`);
  }

  return (
    <div className="prac">
      <header className="prac__head">
        <div className="prac__head-icon">
          <BrainCircuit size={26} strokeWidth={2.4} />
        </div>
        <div>
          <h1>Практика</h1>
          <p className="prac__sub">Настрой тренировку под себя</p>
        </div>
      </header>

      <section>
        <SectionTitle>Режим</SectionTitle>
        <div className="prac__modes">
          {MODES.map((m) => {
            const disabled = m.id === "topic" && !hasTopics;
            return (
              <button
                key={m.id}
                className={`prac__mode ${mode === m.id ? "prac__mode--on" : ""}`}
                onClick={() => !disabled && setMode(m.id)}
                disabled={disabled}
                aria-pressed={mode === m.id}
              >
                <span className={`prac__mode-icon prac__mode-icon--${m.tone}`}>
                  <m.icon size={20} strokeWidth={2.4} />
                </span>
                <span className="prac__mode-title">{m.title}</span>
                <span className="prac__mode-desc">
                  {disabled ? "Доступно после диагностики" : m.desc}
                </span>
              </button>
            );
          })}
        </div>
        {!hasTopics && (
          <p className="prac__diagnostic-note">
            Выбор темы откроется после диагностики. <Link to="/app/diagnostic">Пройти её сейчас</Link>
          </p>
        )}
      </section>

      {mode === "topic" && hasTopics && (
        <section>
          <SectionTitle>Тема</SectionTitle>
          <label className="prac__topic-select">
            <span className="sr-only">Выбери тему</span>
            <select value={topic ?? ""} onChange={(event) => setTopic(event.target.value)}>
              {topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="prac__topics prac__topics--desktop">
            {topics.map((t) => (
              <button
                key={t.id}
                className={`prac__chip ${topic === t.id ? "prac__chip--on" : ""}`}
                onClick={() => setTopic(t.id)}
                aria-pressed={topic === t.id}
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
              aria-pressed={level === l.id}
            >
              <span className="prac__level-label">{l.label}</span>
              <span className="prac__level-desc">{l.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="prac__start">
        <Button size="lg" full variant="accent" icon={Play} onClick={start}>
          Начать серию
        </Button>
      </div>
    </div>
  );
}

function readPracticePrefs() {
  try {
    return JSON.parse(localStorage.getItem("edme:practice:prefs") || "{}");
  } catch {
    return {};
  }
}
