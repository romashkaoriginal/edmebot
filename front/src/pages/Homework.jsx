import { useCallback, useEffect, useState } from "react";
import { BookOpen, Check, CircleAlert, Clock, RefreshCw, RotateCcw } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { studentApi } from "../api/student";
import { plural } from "../utils/format";
import "./Homework.css";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "done", label: "Выполнено" },
];

export default function Homework() {
  const cachedHomework = studentApi.peekHomework();
  const [homework, setHomework] = useState(() => cachedHomework?.homework ?? []);
  const [counts, setCounts] = useState(() => cachedHomework?.counts ?? { active: 0, overdue: 0 });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(() => !cachedHomework);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [undoItem, setUndoItem] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const data = await studentApi.homework();
      const next = { homework: data.homework ?? [], counts: data.counts ?? { active: 0, overdue: 0 } };
      setHomework(next.homework);
      setCounts(next.counts);
    } catch {
      setError("Не удалось загрузить домашние задания. Проверь соединение и повтори попытку.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ quiet: Boolean(studentApi.peekHomework()) });
  }, [load]);

  async function complete(item) {
    setBusyId(item.id);
    setError("");
    try {
      await studentApi.completeHomework(item.id);
      setUndoItem(item);
      await load({ quiet: true });
    } catch {
      setError(`Не удалось отметить «${item.title}» выполненным. Попробуй ещё раз.`);
    } finally {
      setBusyId(null);
    }
  }

  async function undoComplete() {
    if (!undoItem) return;
    setBusyId(undoItem.id);
    setError("");
    try {
      await studentApi.reopenHomework(undoItem.id);
      setUndoItem(null);
      await load({ quiet: true });
    } catch {
      setError("Не удалось вернуть задание в активные. Попробуй ещё раз.");
    } finally {
      setBusyId(null);
    }
  }

  const list = filter === "all" ? homework : homework.filter((item) => item.status === filter);
  const emptyCopy = filter === "done"
    ? "Выполненных заданий пока нет."
    : filter === "active"
      ? "Активных заданий нет — можно перейти к практике."
      : "Учитель пока не назначил домашних заданий.";

  return (
    <div className="hw">
      <header className="hw__head">
        <div className="hw__head-icon" aria-hidden="true"><BookOpen size={26} strokeWidth={2.4} /></div>
        <div>
          <h1>Домашние задания</h1>
          <p className="hw__sub">
            {counts.active} {plural(counts.active, "активное задание", "активных задания", "активных заданий")}
            {counts.overdue > 0 && <span className="hw__sub-warn"> · {counts.overdue} просрочено</span>}
          </p>
        </div>
      </header>

      <div className="hw__filters" aria-label="Фильтр домашних заданий">
        {FILTERS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`hw__filter ${filter === item.id ? "hw__filter--on" : ""}`}
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      {undoItem && (
        <div className="hw__undo" role="status">
          <Check size={18} aria-hidden="true" />
          <span>«{undoItem.title}» отмечено выполненным.</span>
          <Button size="sm" variant="ghost" icon={RotateCcw} loading={busyId === undoItem.id} onClick={undoComplete}>
            Отменить
          </Button>
        </div>
      )}

      {error && (
        <div className="hw__error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{error}</span>
          {!homework.length && (
            <Button size="sm" variant="soft" icon={RefreshCw} onClick={() => load()}>
              Повторить
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="hw__skeleton" aria-label="Загружаем домашние задания">
          {[0, 1, 2].map((item) => <span key={item} />)}
        </div>
      ) : !error && list.length === 0 ? (
        <Card pad="lg" className="hw__empty">
          <BookOpen size={30} aria-hidden="true" />
          <h2>{filter === "active" ? "На сегодня всё" : "Здесь пока пусто"}</h2>
          <p>{emptyCopy}</p>
        </Card>
      ) : (
        <div className="hw__list">
          {list.map((item) => (
            <HomeworkCard
              key={item.id}
              hw={item}
              busy={busyId === item.id}
              onComplete={() => complete(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HomeworkCard({ hw, busy, onComplete }) {
  const notice = deadlineNotice(hw);
  const taskCount = Array.isArray(hw.task_ids) ? hw.task_ids.length : 0;
  return (
    <Card className={`hwcard hwcard--${hw.status}`} pad="md">
      <div className="hwcard__top">
        {taskCount > 0 && <Badge tone="primary">{taskCount} {plural(taskCount, "задание", "задания", "заданий")}</Badge>}
        <span className={`hwcard__due hwcard__due--${notice.tone}`}>{notice.icon}{notice.text}</span>
      </div>
      <h2 className="hwcard__title">{hw.title}</h2>
      {hw.description && <p className="hwcard__desc">{hw.description}</p>}
      {hw.status === "done" ? (
        <div className="hwcard__done"><Check size={16} strokeWidth={3} /> Выполнено</div>
      ) : (
        <div className="hwcard__actions">
          <Button size="sm" icon={Check} loading={busy} onClick={onComplete}>Отметить выполненным</Button>
        </div>
      )}
    </Card>
  );
}

function deadlineNotice(hw) {
  if (hw.status === "done") return { tone: "done", text: "сдано", icon: <Check size={14} strokeWidth={2.6} /> };
  if (!hw.due) return { tone: "muted", text: "без срока", icon: <Clock size={14} strokeWidth={2.6} /> };
  const hours = (new Date(hw.due) - new Date()) / 36e5;
  if (hours < 0) return { tone: "danger", text: "просрочено", icon: <CircleAlert size={14} strokeWidth={2.6} /> };
  if (hours <= 24) return { tone: "danger", text: "сдать сегодня", icon: <Clock size={14} strokeWidth={2.6} /> };
  if (hours <= 48) return { tone: "warning", text: "завтра дедлайн", icon: <Clock size={14} strokeWidth={2.6} /> };
  return {
    tone: "muted",
    text: `до ${new Date(hw.due).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`,
    icon: <Clock size={14} strokeWidth={2.6} />,
  };
}
