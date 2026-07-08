import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb, ArrowRight, Check, Zap, Info, RefreshCw, Home } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import { useApp } from "../store/AppStore";
import { taskBank, topics as allTopics } from "../data/mock";
import "./RunMode.css";
import "./PracticeRun.css";

const SERIES_LEN = 5;
const XP_BY_DIFFICULTY = { easy: 10, medium: 15, hard: 25 };

export default function PracticeRun() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { awardXp, setTopicMastery } = useApp();

  const tasks = useMemo(() => buildSeries(params), []); // rule-based selection

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null); // null | "correct" | "wrong"
  const [hintsUsed, setHintsUsed] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [results, setResults] = useState([]); // {taskId, correct, hints, topic}
  const [done, setDone] = useState(false);

  const task = tasks[idx];
  const progress = ((idx + (graded ? 1 : 0)) / tasks.length) * 100;

  function check() {
    const isCorrect = selected === task.correct;
    if (isCorrect) {
      // XP: base by difficulty, minus hint penalty (3/hint), minus retry penalty.
      const base = XP_BY_DIFFICULTY[task.difficulty] ?? 10;
      const gained = Math.max(3, base - hintsUsed * 3 - attempts * 2);
      awardXp(gained, Math.round(gained / 2));
      setTopicMastery(task.topic, 6 - hintsUsed);
      setGraded("correct");
      setResults((r) => [...r, { taskId: task.id, correct: true, hints: hintsUsed, topic: task.topic }]);
    } else {
      // First wrong attempt lets them retry; second locks the explanation.
      if (attempts === 0) {
        setAttempts(1);
        setSelected(null);
        return;
      }
      setTopicMastery(task.topic, -4);
      setGraded("wrong");
      setResults((r) => [...r, { taskId: task.id, correct: false, hints: hintsUsed, topic: task.topic }]);
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
    setHintsUsed(0);
    setAttempts(0);
  }

  if (done) return <Summary results={results} onExit={() => navigate("/")} />;

  const canHint = hintsUsed < task.hints.length && !graded;

  return (
    <div className="run">
      <header className="run__top">
        <button className="run__close" onClick={() => navigate("/practice")} aria-label="Выйти">
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
            correctIndex={task.correct}
            disabled={!!graded}
          />

          {/* Hints revealed so far */}
          <AnimatePresence>
            {hintsUsed > 0 && !graded && (
              <motion.div
                className="pr__hints"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {task.hints.slice(0, hintsUsed).map((h, i) => (
                  <div key={i} className="pr__hint">
                    <Lightbulb size={16} strokeWidth={2.4} />
                    <span>{h}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feedback after grading */}
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
                <p className="pr__feedback-text">{task.explanation}</p>
                {graded === "wrong" && (
                  <p className="pr__mistake">{task.commonMistake}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      <footer className="run__footer">
        {!graded ? (
          <>
            <Button
              variant="ghost"
              icon={Lightbulb}
              disabled={!canHint}
              onClick={() => setHintsUsed((h) => h + 1)}
            >
              Намекни {task.hints.length - hintsUsed > 0 ? `(${task.hints.length - hintsUsed})` : ""}
            </Button>
            <Button icon={ArrowRight} disabled={selected === null} onClick={check}>
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
            <p className="pr__recap-hint">
              Эти темы добавлены в план повторения. Порекомендуем их в следующей практике.
            </p>
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

/* ---------------- Rule-based helpers ---------------- */
function buildSeries(params) {
  const mode = params.get("mode") ?? "weak";
  const topicFilter = params.get("topic");
  let pool = [...taskBank];
  if (mode === "topic" && topicFilter) {
    pool = pool.filter((t) => t.topic === topicFilter);
  } else if (mode === "weak") {
    const weak = allTopics.filter((t) => t.status !== "green").map((t) => t.id);
    const weakPool = pool.filter((t) => weak.includes(t.topic));
    if (weakPool.length) pool = weakPool;
  }
  // repeat pool to reach series length, keep variety
  const series = [];
  let i = 0;
  while (series.length < SERIES_LEN && pool.length) {
    series.push(pool[i % pool.length]);
    i++;
  }
  return series;
}

function topicName(id) {
  return allTopics.find((t) => t.id === id)?.name ?? id;
}
function diffLabel(d) {
  return { easy: "Лёгкий", medium: "Средний", hard: "Сложный" }[d] ?? d;
}
