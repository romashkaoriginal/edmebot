import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "../router";
import { BookOpen, Check, CircleAlert, Clock, Pencil, RefreshCw } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { studentApi } from "../api/student";
import { useApp } from "../store/AppStore";
import SubjectPicker from "../components/shared/SubjectPicker";
import { enrolledSubjects, subjectLabel } from "../utils/subjects";
import { plural } from "../utils/format";
import "./Homework.css";

function filterByCachedAll(allData, subject) {
  if (!allData || !subject) return null;
  const homework = (allData.homework ?? []).filter((item) => item.subject === subject);
  return {
    homework,
    counts: {
      active: homework.filter((item) => item.status === "active").length,
      overdue: homework.filter((item) => item.due && new Date(item.due) < new Date() && item.status !== "done").length,
    },
  };
}

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "done", label: "Выполнено" },
];

export default function Homework() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useApp();
  const subjects = enrolledSubjects(profile);
  const subject = searchParams.get("subject");
  const selectedSubject = subjects.find((item) => item.subject === subject);

  if (subjects.length > 1 && !selectedSubject) {
    return <SubjectPicker subjects={subjects} section="домашнее задание" onSelect={(nextSubject) => navigate(`/app/homework?subject=${encodeURIComponent(nextSubject)}`)} />;
  }
  if (!selectedSubject && subjects.length === 1) {
    return <HomeworkList key={subjects[0].subject} subject={subjects[0].subject} />;
  }
  return selectedSubject ? <HomeworkList key={selectedSubject.subject} subject={selectedSubject.subject} /> : null;
}

function HomeworkList({ subject }) {
  const navigate = useNavigate();
  // Prefer the cache keyed by this exact subject; fall back to the
  // all-subjects prefetch (filtered client-side) so a student who only sees
  // this one subject in the sidebar doesn't hit a blank first paint just
  // because the two caches were populated separately.
  const cachedHomework = studentApi.peekHomework(subject) ?? filterByCachedAll(studentApi.peekHomework(), subject);
  const [homework, setHomework] = useState(() => cachedHomework?.homework ?? []);
  const [counts, setCounts] = useState(() => cachedHomework?.counts ?? { active: 0, overdue: 0 });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(() => !cachedHomework);
  const [error, setError] = useState("");

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const data = await studentApi.homework({ subject, fresh: true });
      const next = { homework: data.homework ?? [], counts: data.counts ?? { active: 0, overdue: 0 } };
      setHomework(next.homework);
      setCounts(next.counts);
    } catch {
      setError("Не удалось загрузить домашние задания. Проверь соединение и повтори попытку.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [subject]);

  useEffect(() => {
    load({ quiet: Boolean(cachedHomework) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const list = filter === "all" ? homework : homework.filter((item) => item.status === filter);
  const emptyCopy = filter === "done"
    ? "Выполненных заданий пока нет."
    : filter === "active"
      ? "Активных заданий нет — можно перейти к практике."
      : "Репетитор пока не назначил домашних заданий.";

  return (
    <div className="hw">
      <header className="hw__head">
        <div className="hw__head-icon" aria-hidden="true"><BookOpen size={26} strokeWidth={2.4} /></div>
        <div>
          <h1>Домашние задания</h1>
          <p className="hw__sub">
            {subjectLabel(subject)} · {" "}
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
              onOpen={() => navigate(`/app/homework/run?id=${item.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HomeworkCard({ hw, onOpen }) {
  const notice = deadlineNotice(hw);
  const taskCount = Number.isInteger(hw.question_count)
    ? hw.question_count
    : (Array.isArray(hw.task_ids) ? hw.task_ids.length : 0) + (Number(hw.own_question_count) || 0);
  const maxAttempts = hw.max_attempts ?? 1;
  const attemptsUsed = hw.attempts_used ?? 0;
  const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed);
  const canRun = hw.status !== "done" && taskCount > 0 && attemptsLeft > 0;
  return (
    <Card className={`hwcard hwcard--${hw.status}`} pad="md">
      <div className="hwcard__top">
        {taskCount > 0 && <Badge tone="primary">{taskCount} {plural(taskCount, "задание", "задания", "заданий")}</Badge>}
        <span className={`hwcard__due hwcard__due--${notice.tone}`}>{notice.icon}{notice.text}</span>
      </div>
      <h2 className="hwcard__title">{hw.title}</h2>
      {hw.description && <p className="hwcard__desc">{hw.description}</p>}
      {taskCount > 0 && (
        <p className="hwcard__attempts">
          Попытки: {attemptsUsed}/{maxAttempts}
        </p>
      )}
      {hw.status === "done" ? (
        <div className="hwcard__done"><Check size={16} strokeWidth={3} /> Выполнено</div>
      ) : (
        <div className="hwcard__actions">
          {taskCount > 0 ? (
            <Button size="sm" icon={Pencil} disabled={!canRun} onClick={onOpen}>
              {attemptsLeft > 0 ? "Сделать домашку" : "Попытки закончились"}
            </Button>
          ) : (
            <span className="hwcard__desc">В этой домашке пока нет заданий.</span>
          )}
        </div>
      )}
    </Card>
  );
}

function deadlineNotice(hw) {
  const notice = hw.notice ?? { tone: "muted", text: "без срока" };
  const icon = notice.tone === "done"
    ? <Check size={14} strokeWidth={2.6} />
    : notice.tone === "danger" && notice.text === "просрочено"
      ? <CircleAlert size={14} strokeWidth={2.6} />
      : <Clock size={14} strokeWidth={2.6} />;
  const text = notice.text === "предстоит" && hw.due
    ? `до ${new Date(hw.due).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`
    : notice.text;
  return { ...notice, text, icon };
}
