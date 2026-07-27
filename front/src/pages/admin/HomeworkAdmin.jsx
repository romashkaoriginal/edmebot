import { useEffect, useState, useCallback } from "react";
import { BookOpen, Plus, Trash2, Upload, CheckCircle2, Search, ChevronRight, ChevronLeft, ChevronDown, Folder, ListChecks, X } from "lucide-react";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import ImportModal from "../../components/admin/ImportModal";
import FormModal from "../../components/admin/FormModal";
import { adminApi } from "../../api/admin";
import "./admin.css";

const SUBJECTS = ["Математика", "Русский"];
const GRADES = [6, 7, 8, 9, 10, 11];
const DIFFICULTIES = [
  { id: "easy", label: "Лёгкое" },
  { id: "medium", label: "Среднее" },
  { id: "hard", label: "Сложное" },
];
const EMPTY = { title: "", description: "", due: "", subject: "", taskIds: [], maxAttempts: 1 };

function emptyTaskForm(grade, subject, topic) {
  return { grade, subject, topic, prompt: "", options: ["", ""], correct: 0, explanation: "", difficulty: "medium" };
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

const HW_IMPORT_FIELDS = [
  { key: "student_tg_id", desc: "Telegram ID ученика (обязательно)" },
  { key: "title", desc: "заголовок домашки (обязательно)" },
  { key: "description", desc: "необязательно: что нужно сделать" },
  { key: "due", desc: "необязательно: срок, ГГГГ-ММ-ДД или ГГГГ-ММ-ДД ЧЧ:ММ" },
  { key: "task_ids", desc: "необязательно: ID заданий через запятую, напр. 12, 15, 18" },
];

export default function HomeworkAdmin() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [topics, setTopics] = useState([]);
  const [tasksByTopic, setTasksByTopic] = useState({});
  const [loadingTopic, setLoadingTopic] = useState(null);
  const [expandedTopics, setExpandedTopics] = useState(() => new Set());
  const [tasksPanelOpen, setTasksPanelOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState(null);
  const [newTaskError, setNewTaskError] = useState("");
  const [homework, setHomework] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");

  // Load students once. The tutor picks one from the list below (no auto-select
  // so the list stays the entry point).
  useEffect(() => {
    adminApi
      .listStudents()
      .then(({ students }) => setStudents(students))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const student = students.find((s) => String(s.id) === String(studentId));

  const visibleStudents = students.filter((s) => {
    if (s.status !== "active") return false;
    if (subjectFilter !== "all" && s.subject !== subjectFilter) return false;
    if (gradeFilter !== "all" && String(s.grade) !== gradeFilter) return false;
    return `${s.name} ${s.subject ?? ""} ${s.tg_id ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
  });

  const loadTopicsFor = useCallback(async (grade, subject) => {
    try {
      const { topics } = await adminApi.taskTopics({ grade, subject });
      setTopics(topics);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadForStudent = useCallback(async () => {
    if (!student) return;
    try {
      const [, { homework }] = await Promise.all([
        loadTopicsFor(student.grade, student.subject),
        adminApi.listHomework(student.id),
      ]);
      setHomework(homework);
      setTasksByTopic({});
      setExpandedTopics(new Set());
      setTasksPanelOpen(false);
      setNewTaskOpen(false);
      setNewTaskForm(null);
      setForm({ ...EMPTY, subject: student.subject });
    } catch (e) {
      setError(e.message);
    }
  }, [student, loadTopicsFor]);

  useEffect(() => {
    loadForStudent();
  }, [loadForStudent]);

  // Topics are collapsed by default — the question list for a topic (and the
  // full task bank behind it) only loads once the tutor actually expands it.
  async function toggleTopic(topicName) {
    setExpandedTopics((cur) => {
      const next = new Set(cur);
      if (next.has(topicName)) next.delete(topicName);
      else next.add(topicName);
      return next;
    });
    if (tasksByTopic[topicName] || !student) return;
    setLoadingTopic(topicName);
    try {
      const { tasks } = await adminApi.listTasks({ grade: student.grade, subject: form.subject, topic: topicName });
      setTasksByTopic((cur) => ({ ...cur, [topicName]: tasks }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingTopic(null);
    }
  }

  function toggleTask(id) {
    setForm((f) => {
      const has = f.taskIds.includes(id);
      return { ...f, taskIds: has ? f.taskIds.filter((x) => x !== id) : [...f.taskIds, id] };
    });
  }

  function toggleNewTask() {
    setNewTaskOpen((v) => {
      const next = !v;
      if (next) {
        setNewTaskError("");
        setNewTaskForm(emptyTaskForm(student.grade, form.subject, ""));
      }
      return next;
    });
  }

  function setNewTaskOption(i, value) {
    setNewTaskForm((f) => {
      const options = [...f.options];
      options[i] = value;
      return { ...f, options };
    });
  }
  function addNewTaskOption() {
    setNewTaskForm((f) => (f.options.length >= 6 ? f : { ...f, options: [...f.options, ""] }));
  }
  function removeNewTaskOption(i) {
    setNewTaskForm((f) => {
      if (f.options.length <= 2) return f;
      const options = f.options.filter((_, idx) => idx !== i);
      let correct = f.correct;
      if (i === correct) correct = 0;
      else if (i < correct) correct -= 1;
      return { ...f, options, correct };
    });
  }

  async function submitNewTask(e) {
    e.preventDefault();
    setNewTaskError("");
    const topicName = newTaskForm.topic.trim();
    if (!topicName) {
      setNewTaskError("Укажите тему вопроса");
      return;
    }
    const options = newTaskForm.options.map((o) => o.trim());
    if (options.some((o) => !o)) {
      setNewTaskError("Заполните все варианты ответа");
      return;
    }
    try {
      const { task } = await adminApi.createTask({ ...newTaskForm, topic: topicName, options });
      setTasksByTopic((cur) => ({ ...cur, [topicName]: [task, ...(cur[topicName] ?? [])] }));
      setExpandedTopics((cur) => new Set(cur).add(topicName));
      setTopics((cur) => {
        const exists = cur.some((t) => t.topic === topicName);
        return exists
          ? cur.map((t) => (t.topic === topicName ? { ...t, count: t.count + 1 } : t))
          : [...cur, { topic: topicName, count: 1 }];
      });
      setForm((f) => ({ ...f, taskIds: [...f.taskIds, task.id] }));
      setNewTaskOpen(false);
      setNewTaskForm(null);
    } catch (e) {
      setNewTaskError(e.message);
    }
  }

  const selectedCountByTopic = Object.fromEntries(
    Object.entries(tasksByTopic).map(([topic, tasks]) => [
      topic,
      tasks.filter((t) => form.taskIds.includes(t.id)).length,
    ])
  );
  const totalSelected = form.taskIds.length;

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await adminApi.createHomework({
        studentId: student.id,
        title: form.title,
        description: form.description,
        due: form.due ? new Date(form.due).toISOString() : null,
        taskIds: form.taskIds,
        subject: form.subject,
        maxAttempts: form.maxAttempts,
      });
      await loadForStudent();
      setFormOpen(false);
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    if (!confirm("Удалить домашку?")) return;
    try {
      await adminApi.deleteHomework(id);
      await loadForStudent();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="apage">
      <header className="apage__head apage__head--compact">
        <span className="apage__head-icon apage__head-icon--homework">
          <BookOpen size={24} strokeWidth={2.4} />
        </span>
        <div className="apage__head-text">
          <h1>Домашка</h1>
          <p className="apage__sub">Выдача, дедлайны и контроль выполнения</p>
        </div>
        <div className="apage__head-actions">
          {!student && (
            <Button type="button" variant="soft" icon={Upload} onClick={() => setImportOpen(true)}>Импорт</Button>
          )}
          {student && (
            <>
              <Button type="button" variant="soft" icon={ChevronLeft} onClick={() => setStudentId("")}>К списку</Button>
              <Button type="button" icon={Plus} onClick={() => setFormOpen(true)}>Добавить</Button>
            </>
          )}
        </div>
      </header>

      {importOpen && (
        <ImportModal
          title="Импорт домашки"
          eyebrow="Домашка"
          fields={HW_IMPORT_FIELDS}
          onDownload={adminApi.downloadHomeworkTemplate}
          onImport={adminApi.importHomework}
          onClose={() => setImportOpen(false)}
          onImported={() => { if (student) loadForStudent(); }}
        />
      )}

      {/* Student picker — filtered list, shown until one is chosen. */}
      {!student && (
        <div className="asection">
          <div className="afilters">
            <label className="asearch">
              <Search size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск ученика" />
            </label>
            <select className="aselect afilter" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} aria-label="Предмет">
              <option value="all">Все предметы</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="aselect afilter" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} aria-label="Класс">
              <option value="all">Все классы</option>
              {GRADES.map((g) => <option key={g} value={g}>{g} класс</option>)}
            </select>
          </div>

          {loading ? (
            <p className="aempty">Загрузка…</p>
          ) : students.length === 0 ? (
            <p className="aempty">Сначала добавьте учеников в разделе «Ученики».</p>
          ) : visibleStudents.length === 0 ? (
            <p className="aempty">По этому запросу учеников нет.</p>
          ) : (
            <div className="alist">
              {visibleStudents.map((s) => (
                <button key={s.id} className="arow arow--card arow--pick" onClick={() => setStudentId(String(s.id))}>
                  <span className="aavatar" aria-hidden="true">{initials(s.name)}</span>
                  <div className="arow__main">
                    <div className="arow__title">{s.name}</div>
                    <div className="arow__meta">{s.grade} класс · {s.subject}</div>
                  </div>
                  <ChevronRight size={18} strokeWidth={2.6} className="atopic__go" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {student && (
        <>
          <div className="astudent-banner">
            <span className="aavatar aavatar--lg" aria-hidden="true">{initials(student.name)}</span>
            <div>
              <div className="astudent-banner__name">{student.name}</div>
              <div className="arow__meta">{student.grade} класс · {student.subject}</div>
            </div>
          </div>

          {formOpen && (
          <FormModal
            title="Новая домашка"
            eyebrow={{ icon: BookOpen, text: `${student.name} · ${student.grade} класс` }}
            onClose={() => setFormOpen(false)}
            size="lg"
          >
            <form className="aform" onSubmit={submit}>
              <label className="afield">
                <span>Заголовок</span>
                <input
                  className="ainput"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Сложение и вычитание дробей"
                  required
                />
              </label>
              <label className="afield">
                <span>Описание</span>
                <textarea
                  className="atextarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Что нужно сделать…"
                />
              </label>
              <div className="aform__row aform__row--due">
                <label className="afield">
                  <span>Срок сдачи</span>
                  <input
                    className="ainput"
                    type="datetime-local"
                    value={form.due}
                    onChange={(e) => setForm({ ...form, due: e.target.value })}
                  />
                </label>
                <label className="afield">
                  <span>Попыток на прохождение</span>
                  <input
                    className="ainput"
                    type="number"
                    min={1}
                    max={20}
                    value={form.maxAttempts}
                    onChange={(e) => setForm({ ...form, maxAttempts: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                  />
                </label>
              </div>

              <label className="afield">
                <span>Предмет</span>
                <select
                  className="aselect"
                  value={form.subject}
                  onChange={async (e) => {
                    const subject = e.target.value;
                    setForm((current) => ({ ...current, subject, taskIds: [] }));
                    setTasksByTopic({});
                    setExpandedTopics(new Set());
                    await loadTopicsFor(student.grade, subject);
                  }}
                >
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <div className="afield">
                <span>Задания домашки</span>
                <div className="arow arow--card arow--q">
                  <button
                    type="button"
                    className="arow__main hwtopic__toggle"
                    onClick={() => setTasksPanelOpen((v) => !v)}
                    aria-expanded={tasksPanelOpen}
                    style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", width: "100%", textAlign: "left", cursor: "pointer" }}
                  >
                    <ListChecks size={18} strokeWidth={2.2} style={{ flexShrink: 0, color: "var(--primary)" }} />
                    <span style={{ flex: 1 }}>
                      <span className="arow__title">Задания из практики</span>
                      <span className="arow__meta">
                        {student.grade} класс · {form.subject}
                        {totalSelected > 0 && ` · выбрано ${totalSelected}`}
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2.6}
                      style={{ flexShrink: 0, transition: "transform 160ms ease", transform: tasksPanelOpen ? "rotate(180deg)" : "none" }}
                    />
                  </button>

                  {tasksPanelOpen && (
                    <div className="aq__detail" style={{ width: "100%" }}>
                      {topics.length === 0 ? (
                        <p className="arow__meta">Нет тем для этого класса/предмета — создайте в разделе «Задания».</p>
                      ) : (
                        <div className="alist">
                          {topics.map((t) => {
                            const open = expandedTopics.has(t.topic);
                            const topicTasks = tasksByTopic[t.topic];
                            const picked = selectedCountByTopic[t.topic] || 0;
                            return (
                              <div className="arow arow--card arow--q" key={t.topic}>
                                <button
                                  type="button"
                                  className="arow__main hwtopic__toggle"
                                  onClick={() => toggleTopic(t.topic)}
                                  aria-expanded={open}
                                  style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", width: "100%", textAlign: "left", cursor: "pointer" }}
                                >
                                  <Folder size={18} strokeWidth={2.2} style={{ flexShrink: 0, color: "var(--primary)" }} />
                                  <span style={{ flex: 1 }}>
                                    <span className="arow__title">{t.topic}</span>
                                    <span className="arow__meta">
                                      {t.count} {plural(t.count, "вопрос", "вопроса", "вопросов")}
                                      {picked > 0 && ` · выбрано ${picked}`}
                                    </span>
                                  </span>
                                  <ChevronDown
                                    size={18}
                                    strokeWidth={2.6}
                                    style={{ flexShrink: 0, transition: "transform 160ms ease", transform: open ? "rotate(180deg)" : "none" }}
                                  />
                                </button>
                                {open && (
                                  <div className="aq__detail" style={{ width: "100%" }}>
                                    {loadingTopic === t.topic ? (
                                      <p className="arow__meta">Загрузка…</p>
                                    ) : (
                                      <>
                                        {(topicTasks ?? []).length === 0 && (
                                          <p className="arow__meta">В этой теме пока нет вопросов.</p>
                                        )}
                                        {(topicTasks ?? []).map((task) => (
                                          <label className="arow" key={task.id} style={{ cursor: "pointer" }}>
                                            <input
                                              type="checkbox"
                                              checked={form.taskIds.includes(task.id)}
                                              onChange={() => toggleTask(task.id)}
                                              style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
                                            />
                                            <div className="arow__main">
                                              <div className="arow__title">{task.prompt}</div>
                                              <div className="arow__meta">{task.difficulty}</div>
                                            </div>
                                          </label>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="arow arow--card arow--q" style={{ marginTop: "var(--sp-2)" }}>
                  <button
                    type="button"
                    className="arow__main hwtopic__toggle"
                    onClick={toggleNewTask}
                    aria-expanded={newTaskOpen}
                    style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", width: "100%", textAlign: "left", cursor: "pointer" }}
                  >
                    <Plus size={18} strokeWidth={2.4} style={{ flexShrink: 0, color: "var(--primary)" }} />
                    <span style={{ flex: 1 }}>
                      <span className="arow__title">Создание вопроса</span>
                      <span className="arow__meta">Добавить новый вопрос в базу для {form.subject}</span>
                    </span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2.6}
                      style={{ flexShrink: 0, transition: "transform 160ms ease", transform: newTaskOpen ? "rotate(180deg)" : "none" }}
                    />
                  </button>
                  {newTaskOpen && newTaskForm && (
                    <div className="aq__detail" style={{ width: "100%" }}>
                      <NewTaskForm
                        form={newTaskForm}
                        topics={topics}
                        error={newTaskError}
                        onTopic={(topic) => setNewTaskForm((f) => ({ ...f, topic }))}
                        onOption={setNewTaskOption}
                        onAddOption={addNewTaskOption}
                        onRemoveOption={removeNewTaskOption}
                        onDifficulty={(difficulty) => setNewTaskForm((f) => ({ ...f, difficulty }))}
                        onPrompt={(prompt) => setNewTaskForm((f) => ({ ...f, prompt }))}
                        onCorrect={(correct) => setNewTaskForm((f) => ({ ...f, correct }))}
                        onSubmit={submitNewTask}
                        onCancel={() => { setNewTaskOpen(false); setNewTaskForm(null); }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="aerror">{error}</p>}
              <div className="aform__actions">
                <Button type="submit" icon={Plus}>
                  Выдать домашку
                </Button>
                <Button type="button" variant="soft" onClick={() => setFormOpen(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          </FormModal>
          )}

          <div className="asection">
            <SectionTitle>Выданная домашка ({homework.length})</SectionTitle>
            {homework.length === 0 ? (
              <p className="aempty">Этому ученику ещё ничего не выдано.</p>
            ) : (
              <div className="alist">
                {homework.map((h) => (
                  <div className="arow arow--card" key={h.id}>
                    <div className="arow__main">
                      <div className="arow__title">
                        {h.title}
                        {h.status === "done"
                          ? <span className="atag atag--done"><CheckCircle2 size={13} strokeWidth={2.6} /> сдано</span>
                          : <span className="atag atag--active">активно</span>}
                      </div>
                      <div className="arow__meta">
                        {h.due ? `до ${new Date(h.due).toLocaleString("ru-RU")}` : "без срока"}
                        {h.subject ? ` · ${h.subject}` : ""}
                        {Array.isArray(h.task_ids) && h.task_ids.length ? ` · ${h.task_ids.length} заданий` : ""}
                        {` · ${h.attempts_used ?? 0}/${h.max_attempts ?? 1} попыток`}
                      </div>
                    </div>
                    <div className="arow__actions">
                      <button className="aicon-btn aicon-btn--delete" onClick={() => remove(h.id)} aria-label="Удалить">
                        <Trash2 size={17} strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Compact question-creation form embedded inside the homework picker, so the
// tutor doesn't have to leave homework creation and go to "Задания" just
// because the bank is missing a question.
function NewTaskForm({ form, topics, error, onTopic, onOption, onAddOption, onRemoveOption, onDifficulty, onPrompt, onCorrect, onSubmit, onCancel }) {
  return (
    <form className="aform" onSubmit={onSubmit} style={{ padding: "var(--sp-3)", background: "var(--surface-2)", borderRadius: "var(--r-md)" }}>
      <label className="afield">
        <span>Тема</span>
        <input
          className="ainput"
          list="hwq-topics"
          value={form.topic}
          onChange={(e) => onTopic(e.target.value)}
          placeholder="Выберите существующую или введите новую"
          required
          autoFocus
        />
        <datalist id="hwq-topics">
          {topics.map((t) => <option key={t.topic} value={t.topic} />)}
        </datalist>
      </label>
      <label className="afield">
        <span>Условие вопроса</span>
        <textarea
          className="atextarea"
          value={form.prompt}
          onChange={(e) => onPrompt(e.target.value)}
          placeholder="Сложи дроби: 1/4 + 1/4"
          required
        />
      </label>
      <label className="afield">
        <span>Сложность</span>
        <select className="aselect" value={form.difficulty} onChange={(e) => onDifficulty(e.target.value)}>
          {DIFFICULTIES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </label>
      <div className="afield">
        <span>Варианты ответа (отметьте правильный)</span>
        {form.options.map((opt, i) => (
          <div className="aopt" key={i}>
            <label className="aopt__radio">
              <input type="radio" name="hwq-correct" checked={form.correct === i} onChange={() => onCorrect(i)} />
            </label>
            <input
              className="ainput"
              value={opt}
              onChange={(e) => onOption(i, e.target.value)}
              placeholder={`Вариант ${i + 1}`}
              required
            />
            {form.options.length > 2 && (
              <button type="button" className="aopt__del" onClick={() => onRemoveOption(i)} aria-label="Убрать вариант">
                <X size={16} strokeWidth={2.6} />
              </button>
            )}
          </div>
        ))}
        {form.options.length < 6 && (
          <Button type="button" variant="soft" size="sm" icon={Plus} onClick={onAddOption}>Добавить вариант</Button>
        )}
      </div>
      {error && <p className="aerror">{error}</p>}
      <div className="aform__actions">
        <Button type="submit" size="sm" icon={Plus}>Создать вопрос</Button>
        <Button type="button" variant="soft" size="sm" onClick={onCancel}>Отмена</Button>
      </div>
    </form>
  );
}
