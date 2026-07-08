import { Link } from "react-router-dom";
import { Target, Clock, ListChecks, HelpCircle, ArrowRight } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import KnowledgeMap from "../components/shared/KnowledgeMap";
import SectionTitle from "../components/ui/SectionTitle";
import { useApp } from "../store/AppStore";
import { diagnostic } from "../data/mock";
import "./Diagnostic.css";

export default function Diagnostic() {
  const { topics, profile } = useApp();

  return (
    <div className="diag">
      <Card className="diag__intro" pad="lg">
        <div className="diag__intro-icon">
          <Target size={30} strokeWidth={2.4} />
        </div>
        <h1>Входной тест</h1>
        <p className="diag__lead">
          Короткий тест по предмету «{profile.subject}», чтобы понять твой уровень и собрать
          персональную карту знаний. Результат можно передать репетитору.
        </p>
        <ul className="diag__facts">
          <li>
            <ListChecks size={18} strokeWidth={2.4} />
            <span>{diagnostic.length} вопросов</span>
          </li>
          <li>
            <Clock size={18} strokeWidth={2.4} />
            <span>5–7 минут</span>
          </li>
          <li>
            <HelpCircle size={18} strokeWidth={2.4} />
            <span>Можно ответить «не знаю»</span>
          </li>
        </ul>
        <Button as={Link} to="/diagnostic/run" size="lg" icon={ArrowRight}>
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
