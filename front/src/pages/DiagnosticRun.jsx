import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight, CircleHelp, PartyPopper } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import KnowledgeMap from "../components/shared/KnowledgeMap";
import { studentApi } from "../api/student";
import { useApp } from "../store/AppStore";
import "./RunMode.css";

export default function DiagnosticRun() {
  const navigate = useNavigate();
  const { hydrate } = useApp();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [resultTopics, setResultTopics] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    studentApi.diagnostic().then((data) => setQuestions(data.questions ?? [])).catch(() => setQuestions([]));
  }, []);

  const q = questions?.[idx];
  const progress = questions?.length ? ((idx + (done ? 1 : 0)) / questions.length) * 100 : 0;

  async function next(answer) {
    const nextAnswers = [...answers, { id: q.id, selected: answer }];
    setAnswers(nextAnswers);
    setSelected(null);
    if (idx + 1 >= questions.length) {
      const result = await studentApi.submitDiagnostic(nextAnswers);
      setResultTopics(result.knowledgeMap ?? []);
      hydrate({ profile: result.profile, topics: result.knowledgeMap });
      setDone(true);
    }
    else setIdx(idx + 1);
  }

  if (questions === null) return <div className="run"><div className="run__body"><Card pad="lg">Загрузка диагностики…</Card></div></div>;
  if (!questions.length) return <div className="run"><div className="run__body"><Card pad="lg">Нет вопросов для диагностики.</Card></div></div>;

  if (done) {
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
          {idx + 1}/{questions.length}
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
        <Button variant="ghost" icon={CircleHelp} onClick={() => next(null)}>
          Не знаю
        </Button>
        <Button
          icon={ArrowRight}
          disabled={selected === null}
          onClick={() => next(selected)}
        >
          {idx + 1 >= questions.length ? "Завершить" : "Дальше"}
        </Button>
      </footer>
    </div>
  );
}
