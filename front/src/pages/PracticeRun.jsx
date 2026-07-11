import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Check, Info, RefreshCw, Home, Lightbulb } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import { useApp } from "../store/AppStore";
import { topics as allTopics } from "../data/mock";
import { studentApi } from "../api/student";
import "./RunMode.css";
import "./PracticeRun.css";

// Practice series + grading now come from the backend (DB-backed). Tasks
// created in the admin panel appear here automatically.
export default function PracticeRun() {
  const navigate = useNavigate();
  const { hydrate } = useApp();

  const [tasks, setTasks] = useState(null); // null = loading
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null); // null | "correct" | "wrong"
  const [feedback, setFeedback] = useState(null); // { explanation, commonMistake }
  const [attempts, setAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    studentApi.practiceSeries()
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => setTasks([]));
  }, []);

  if (tasks === null) {
    return (
      <div className="run">
        <div className="run__body">
          <Card pad="lg">
            <p style={{ textAlign: "center", color: "var(--muted)" }}>Загружаем задания…</p>
          </Card>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="run">
        <div className="run__body">
          <Card pad="lg">
            <h2 className="run__prompt">Заданий пока нет</h2>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>
              Учитель ещё не добавил задания для твоего класса. Загляни позже.
            </p>
            <div style={{ marginTop: 16 }}>
              <Button icon={Home} onClick={() => navigate("/app")}>
                На главную
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (done) return <Summary results={results} onExit={() => navigate("/app")} />;

  const task = tasks[idx];
  const progress = ((idx + (graded ? 1 : 0)) / tasks.length) * 100;

  async function check() {
    if (checking) return;
    setChecking(true);
    try {
      const data = await studentApi.answer({ taskId: task.id, selected, attempts, hintsUsed });
      hydrate({ profile: data.profile, topics: data.topics });

      if (data.correct) {
        setGraded("correct");
        setFeedback({ explanation: data.explanation, commonMistake: null, correctIndex: data.correctIndex });
        setResults((r) => [...r, { taskId: task.id, correct: true, topic: task.topic }]);
      } else {
        // First wrong attempt lets them retry; second locks the explanation.
        if (attempts === 0) {
          setAttempts(1);
          setSelected(null);
          return;
        }
        setGraded("wrong");
        setFeedback({ explanation: data.explanation, commonMistake: data.commonMistake, correctIndex: data.correctIndex });
        setResults((r) => [...r, { taskId: task.id, correct: false, topic: task.topic }]);
      }
    } finally {
      setChecking(false);
    }
  }

  function nextTask() {
    if (idx + 1 >= tasks.length) {
      setDone(true);
      return;
    }
    setIdx(idx + 1);
    setSelected(null);
    setGraded(null);
    setFeedback(null);
    setAttempts(0);
    setHintsUsed(0);
  }

  return (
    <div className="run">
      <header className="run__top">
        <button className="run__close" onClick={() => navigate("/app/practice")} aria-label="Выйти">
          <X size={22} strokeWidth={2.4} />
        </button>
        <div className="run__progress">
          <div className="run__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="run__counter font-display">
          {idx + 1}/{tasks.length}
        </span>
      </header>

      <div className="run__body">
        <Card className="run__question" pad="lg">
          <div className="pr__qhead">
            <span className="run__qlabel">{topicName(task.topic)}</span>
            <span className={`pr__diff pr__diff--${task.difficulty}`}>{diffLabel(task.difficulty)}</span>
          </div>
          <h2 className="run__prompt">{task.prompt}</h2>

          {attempts === 1 && !graded && (
            <div className="pr__retry">
              <Info size={16} strokeWidth={2.4} /> Не совсем. Попробуй ещё раз — у тебя получится!
            </div>
          )}

          <OptionList
            options={task.options}
            selected={selected}
            onSelect={setSelected}
            state={graded}
            correctIndex={feedback?.correctIndex}
            disabled={!!graded}
          />

          <AnimatePresence>
            {hintsUsed > 0 && !graded && (
              <motion.div
                className="pr__hints"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {(task.hints ?? []).slice(0, hintsUsed).map((h, i) => (
                  <div key={i} className="pr__hint">
                    <Lightbulb size={16} strokeWidth={2.4} />
                    <span>{h}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {graded && (
              <motion.div
                className={`pr__feedback pr__feedback--${graded}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="pr__feedback-head">
                  {graded === "correct" ? (
                    <>
                      <Check size={18} strokeWidth={3} /> Верно!
                    </>
                  ) : (
                    <>
                      <Info size={18} strokeWidth={2.6} /> Разберём ошибку
                    </>
                  )}
                </div>
                {feedback?.explanation && <p className="pr__feedback-text">{feedback.explanation}</p>}
                {graded === "wrong" && feedback?.commonMistake && (
                  <p className="pr__mistake">{feedback.commonMistake}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      <footer className="run__footer">
        {!graded ? (
          <>
            {(task.hints ?? []).length > 0 && (
              <Button
                variant="ghost"
                icon={Lightbulb}
                disabled={hintsUsed >= task.hints.length}
                onClick={() => setHintsUsed((h) => h + 1)}
              >
                Намекни {task.hints.length - hintsUsed > 0 ? `(${task.hints.length - hintsUsed})` : ""}
              </Button>
            )}
            <Button icon={ArrowRight} disabled={selected === null || checking} onClick={check}>
              Проверить
            </Button>
          </>
        ) : (
          <Button icon={ArrowRight} full onClick={nextTask}>
            {idx + 1 >= tasks.length ? "Завершить" : "Следующее задание"}
          </Button>
        )}
      </footer>
    </div>
  );
}

/* ---------------- Summary ---------------- */
function Summary({ results, onExit }) {
  const navigate = useNavigate();
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const errors = total - correct;
  const errorTopics = [...new Set(results.filter((r) => !r.correct).map((r) => r.topic))];
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const mastery = pct >= 80 ? "Отличное усвоение" : pct >= 50 ? "Хорошо, но есть над чем поработать" : "Тему стоит повторить";

  return (
    <div className="run run--result">
      <Card className="run__result-card" pad="lg">
        <div className={`pr__score-ring pr__score-ring--${pct >= 80 ? "good" : pct >= 50 ? "mid" : "low"}`}>
          <span className="font-display">{pct}%</span>
        </div>
        <h1>Практика завершена!</h1>
        <p className="run__result-lead">{mastery}</p>

        <div className="pr__stats">
          <div className="pr__stat">
            <span className="pr__stat-num font-display">{correct}</span>
            <span className="pr__stat-label">верно</span>
          </div>
          <div className="pr__stat">
            <span className="pr__stat-num font-display pr__stat-num--err">{errors}</span>
            <span className="pr__stat-label">ошибок</span>
          </div>
          <div className="pr__stat">
            <span className="pr__stat-num font-display">{total}</span>
            <span className="pr__stat-label">всего</span>
          </div>
        </div>

        {errorTopics.length > 0 && (
          <div className="pr__recap">
            <div className="pr__recap-title">Темы, где были ошибки:</div>
            <div className="pr__recap-topics">
              {errorTopics.map((t) => (
                <span key={t} className="pr__recap-chip">
                  {topicName(t)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="run__result-actions">
          <Button variant="soft" icon={Home} onClick={onExit}>
            На главную
          </Button>
          <Button icon={RefreshCw} onClick={() => navigate(0)}>
            Ещё серия
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function topicName(id) {
  return allTopics.find((t) => t.id === id)?.name ?? id;
}
function diffLabel(d) {
  return { easy: "Лёгкий", medium: "Средний", hard: "Сложный" }[d] ?? d;
}
