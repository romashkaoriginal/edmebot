import { useState } from "react";
import { BookOpen, Clock, Check, Upload, MessageCircleQuestion, Paperclip, CircleAlert } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useApp } from "../store/AppStore";
import "./Homework.css";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "overdue", label: "Просрочено" },
  { id: "done", label: "Выполнено" },
];

export default function Homework() {
  const { homework, completeHomework } = useApp();
  const [filter, setFilter] = useState("all");

  const list = filter === "all" ? homework : homework.filter((h) => h.status === filter);
  const counts = {
    active: homework.filter((h) => h.status === "active").length,
    overdue: homework.filter((h) => h.status === "overdue").length,
  };

  return (
    <div className="hw">
      <header className="hw__head">
        <div className="hw__head-icon">
          <BookOpen size={26} strokeWidth={2.4} />
        </div>
        <div>
          <h1>Домашние задания</h1>
          <p className="hw__sub">
            {counts.active} активных
            {counts.overdue > 0 && <span className="hw__sub-warn"> · {counts.overdue} просрочено</span>}
          </p>
        </div>
      </header>

      <div className="hw__filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`hw__filter ${filter === f.id ? "hw__filter--on" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card pad="lg" className="hw__empty">
          <span className="hw__empty-emoji">🎉</span>
          <p>Здесь пусто. Все задания в этой категории закрыты!</p>
        </Card>
      ) : (
        <div className="hw__list">
          {list.map((h) => (
            <HomeworkCard key={h.id} hw={h} onComplete={() => completeHomework(h.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function HomeworkCard({ hw, onComplete }) {
  const notice = deadlineNotice(hw);
  return (
    <Card className={`hwcard hwcard--${hw.status}`} pad="md">
      <div className="hwcard__top">
        <Badge tone="primary">{hw.topic}</Badge>
        <span className={`hwcard__due hwcard__due--${notice.tone}`}>
          {notice.icon}
          {notice.text}
        </span>
      </div>
      <h3 className="hwcard__title">{hw.title}</h3>
      <p className="hwcard__desc">{hw.description}</p>

      {hw.materials.length > 0 && (
        <div className="hwcard__materials">
          {hw.materials.map((m) => (
            <a key={m.label} href={m.url} className="hwcard__material">
              <Paperclip size={14} strokeWidth={2.4} />
              {m.label}
            </a>
          ))}
        </div>
      )}

      {hw.status === "done" ? (
        <div className="hwcard__done">
          <Check size={16} strokeWidth={3} /> Выполнено
        </div>
      ) : (
        <div className="hwcard__actions">
          <Button size="sm" icon={Check} onClick={onComplete}>
            Выполнено
          </Button>
          <Button size="sm" variant="soft" icon={Upload}>
            Загрузить ответ
          </Button>
          <Button size="sm" variant="ghost" icon={MessageCircleQuestion}>
            Вопрос
          </Button>
        </div>
      )}
    </Card>
  );
}

// Rule-based deadline notifications (module 8): 24h before / due today / overdue.
function deadlineNotice(hw) {
  if (hw.status === "done") return { tone: "done", text: "сдано", icon: <Check size={14} strokeWidth={2.6} /> };
  const now = new Date();
  const due = new Date(hw.due);
  const hours = (due - now) / 36e5;
  if (hours < 0) return { tone: "danger", text: "просрочено", icon: <CircleAlert size={14} strokeWidth={2.6} /> };
  if (hours <= 24) return { tone: "danger", text: "сдать сегодня", icon: <Clock size={14} strokeWidth={2.6} /> };
  if (hours <= 48) return { tone: "warning", text: "завтра дедлайн", icon: <Clock size={14} strokeWidth={2.6} /> };
  return {
    tone: "muted",
    text: `до ${due.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`,
    icon: <Clock size={14} strokeWidth={2.6} />,
  };
}
