import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight, CircleHelp, PartyPopper } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import KnowledgeMap from "../components/shared/KnowledgeMap";
import { diagnostic, topics as topicSeed } from "../data/mock";
import "./RunMode.css";

export default function DiagnosticRun() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState({}); // topicId -> {correct, total}
  const [done, setDone] = useState(false);

  const q = diagnostic[idx];
  const progress = ((idx + (done ? 1 : 0)) / diagnostic.length) * 100;

  function record(isCorrect) {
    setAnswers((a) => {
      const cur = a[q.topic] ?? { correct: 0, total: 0 };
      return { ...a, [q.topic]: { correct: cur.correct + (isCorrect ? 1 : 0), total: cur.total + 1 } };
    });
  }

  function next(isCorrect) {
    record(isCorrect);
    setSelected(null);
    if (idx + 1 >= diagnostic.length) setDone(true);
    else setIdx(idx + 1);
  }

  if (done) {
    const resultTopics = buildKnowledgeMap(answers);
    return (
      <div className="run run--result">
        <Card className="run__result-card" pad="lg">
          <div className="run__result-icon">
            <PartyPopper size={32} strokeWidth={2.4} />
          </div>
          <h1>Тест пройден!</h1>
          <p className="run__result-lead">
            Вот твоя персональная карта знаний. Красные темы — с них и начнём.
          </p>
          <div className="run__result-map">
            <KnowledgeMap topics={resultTopics} />
          </div>
          <div className="run__result-actions">
            <Button variant="soft" onClick={() => navigate("/app")}>
              На главную
            </Button>
            <Button icon={ArrowRight} onClick={() => navigate("/app/practice/run")}>
              Начать практику
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="run">
      <header className="run__top">
        <button className="run__close" onClick={() => navigate("/app/diagnostic")} aria-label="Выйти">
          <X size={22} strokeWidth={2.4} />
        </button>
        <div className="run__progress">
          <div className="run__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="run__counter font-display">
          {idx + 1}/{diagnostic.length}
        </span>
      </header>

      <div className="run__body">
        <Card className="run__question" pad="lg">
          <span className="run__qlabel">Вопрос {idx + 1}</span>
          <h2 className="run__prompt">{q.prompt}</h2>
          <OptionList options={q.options} selected={selected} onSelect={setSelected} />
        </Card>
      </div>

      <footer className="run__footer">
        <Button variant="ghost" icon={CircleHelp} onClick={() => next(false)}>
          Не знаю
        </Button>
        <Button
          icon={ArrowRight}
          disabled={selected === null}
          onClick={() => next(selected === q.correct)}
        >
          {idx + 1 >= diagnostic.length ? "Завершить" : "Дальше"}
        </Button>
      </footer>
    </div>
  );
}

// Rule-based knowledge map: ratio of correct answers per topic → status.
function buildKnowledgeMap(answers) {
  return topicSeed.map((t) => {
    const a = answers[t.id];
    if (!a || a.total === 0) return t;
    const mastery = Math.round((a.correct / a.total) * 100);
    const status = mastery >= 75 ? "green" : mastery >= 50 ? "yellow" : "red";
    return { ...t, mastery, status };
  });
}
