import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import ProgressBar from "../ui/ProgressBar";
import "./KnowledgeMap.css";

const META = {
  green: { icon: CheckCircle2, label: "Освоено", tone: "success" },
  yellow: { icon: AlertTriangle, label: "Повторить", tone: "warning" },
  red: { icon: XCircle, label: "Слабая тема", tone: "danger" },
};

export default function KnowledgeMap({ topics, onPick }) {
  return (
    <ul className="kmap">
      {topics.map((t) => {
        const m = META[t.status];
        const Icon = m.icon;
        const Row = onPick ? "button" : "div";
        return (
          <li key={`${t.subject ?? "subject"}:${t.id}`}>
            <Row
              className={`kmap__row kmap__row--${t.status}`}
              onClick={onPick ? () => onPick(t) : undefined}
              type={onPick ? "button" : undefined}
            >
              <span className={`kmap__dot kmap__dot--${t.status}`}>
                <Icon size={16} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <span className="kmap__name">{t.name}</span>
              <span className={`kmap__status kmap__status--${t.status}`}>{m.label}</span>
              <span className="kmap__bar">
                <ProgressBar value={t.mastery} tone={m.tone} size="sm" ariaLabel={`${t.name}: освоено ${t.mastery}%`} />
              </span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}
