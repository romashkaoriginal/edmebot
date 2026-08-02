import { useEffect } from "react";
import { Link } from "../router";
import { Target, Clock, ListChecks, HelpCircle, ArrowRight } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import KnowledgeMap from "../components/shared/KnowledgeMap";
import SectionTitle from "../components/ui/SectionTitle";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import { enrolledSubjects } from "../utils/subjects";
import "./Diagnostic.css";

export default function Diagnostic() {
  const { topics, profile } = useApp();
  // One diagnostic covers every enrolled subject, 10 questions each.
  const subjectCount = Math.max(1, enrolledSubjects(profile).length);

  useEffect(() => {
    // Warm the whole diagnostic while the student reads the intro. The run
    // screen reuses this promise, so opening question one needs no new fetch.
    studentApi.prefetchDiagnostic().catch(() => {});
  }, []);

  return (
    <div className="diag">
      <Card className="diag__intro" pad="lg">
        <div className="diag__intro-icon">
          <Target size={30} strokeWidth={2.4} />
        </div>
        <h1>Входной тест</h1>
        <p className="diag__lead">
          Ответь на несколько заданий без оценки и таймера.
          По результату соберём карту знаний для занятий с репетитором.
        </p>
        <ul className="diag__facts">
          <li>
            <ListChecks size={18} strokeWidth={2.4} />
            <span>До {subjectCount * 10} вопросов{subjectCount > 1 ? " — по 10 на предмет" : ""}</span>
          </li>
          <li>
            <Clock size={18} strokeWidth={2.4} />
            <span>{subjectCount > 1 ? "10–15 минут" : "5–7 минут"}</span>
          </li>
          <li>
            <HelpCircle size={18} strokeWidth={2.4} />
            <span>Можно ответить «не знаю»</span>
          </li>
        </ul>
        <Button as={Link} to="/app/diagnostic/run" size="lg" icon={ArrowRight}>
          {profile.diagnosticDone ? "Пройти заново" : "Начать тест"}
        </Button>
      </Card>

      {profile.diagnosticDone && (
        <section>
          <SectionTitle>Твоя карта знаний</SectionTitle>
          <KnowledgeMap topics={topics} />
        </section>
      )}
    </div>
  );
}
