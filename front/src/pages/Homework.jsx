import { useEffect, useState, useCallback } from "react";
import { BookOpen, Clock, Check, Upload, MessageCircleQuestion, CircleAlert } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { studentApi } from "../api/student";
import "./Homework.css";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "done", label: "Выполнено" },
];

// Homework is now assigned by the teacher via the admin panel and read from
// the backend (DB-backed). No more mock list.
export default function Homework() {
  const [homework, setHomework] = useState([]);
  const [counts, setCounts] = useState({ active: 0, overdue: 0 });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await studentApi.homework();
      setHomework(data.homework ?? []);
      setCounts(data.counts ?? { active: 0, overdue: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function complete(id) {
    await studentApi.completeHomework(id);
    await load();
  }

  const list = filter === "all" ? homework : homework.filter((h) => h.status === filter);

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

      {loading ? (
        <Card pad="lg" className="hw__empty">
          <p>Загрузка…</p>
        </Card>
      ) : list.length === 0 ? (
        <Card pad="lg" className="hw__empty">
          <span className="hw__empty-emoji">🎉</span>
          <p>Здесь пусто. Учитель пока ничего не задал в этой категории!</p>
        </Card>
      ) : (
        <div className="hw__list">
          {list.map((h) => (
            <HomeworkCard key={h.id} hw={h} onComplete={() => complete(h.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function HomeworkCard({ hw, onComplete }) {
  const notice = deadlineNotice(hw);
  const taskCount = Array.isArray(hw.task_ids) ? hw.task_ids.length : 0;
  return (
    <Card className={`hwcard hwcard--${hw.status}`} pad="md">
      <div className="hwcard__top">
        {taskCount > 0 && <Badge tone="primary">{taskCount} заданий</Badge>}
        <span className={`hwcard__due hwcard__due--${notice.tone}`}>
          {notice.icon}
          {notice.text}
        </span>
      </div>
      <h3 className="hwcard__title">{hw.title}</h3>
      {hw.description && <p className="hwcard__desc">{hw.description}</p>}

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

// Rule-based deadline notifications: 24h before / due today / overdue.
function deadlineNotice(hw) {
  if (hw.status === "done") return { tone: "done", text: "сдано", icon: <Check size={14} strokeWidth={2.6} /> };
  if (!hw.due) return { tone: "muted", text: "без срока", icon: <Clock size={14} strokeWidth={2.6} /> };
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
