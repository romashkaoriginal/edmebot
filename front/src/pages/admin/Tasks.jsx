import { useEffect, useState, useCallback } from "react";
import {
  ListChecks, Plus, Trash2, X, Upload, Download, ChevronLeft, ChevronRight,
  Calculator, PenLine, Folder, Eye, EyeOff, Pencil, CheckCircle2,
} from "lucide-react";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import ImportModal from "../../components/admin/ImportModal";
import FormModal from "../../components/admin/FormModal";
import { adminApi } from "../../api/admin";
import "./admin.css";

const TASK_IMPORT_FIELDS = [
  { key: "grade", desc: "класс, число 5–11" },
  { key: "subject", desc: "Русский или Математика" },
  { key: "topic", desc: "название темы, напр. Дроби" },
  { key: "prompt", desc: "текст задания" },
  { key: "option_a … option_f", desc: "варианты ответа (минимум a и b)" },
  { key: "correct", desc: "буква правильного варианта: a–f" },
  { key: "difficulty", desc: "easy / medium / hard" },
  { key: "explanation", desc: "необязательно: почему ответ верный" },
  { key: "hint_1, hint_2", desc: "необязательно: подсказки «Намекни»" },
];

const SUBJECTS = [
  { name: "Математика", icon: Calculator, tone: "primary" },
  { name: "Русский", icon: PenLine, tone: "accent" },
];
const GRADES = [6, 7, 8, 9, 10, 11];
const DIFFICULTIES = [
  { id: "easy", label: "Лёгкое" },
  { id: "medium", label: "Среднее" },
  { id: "hard", label: "Сложное" },
];
const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d.label]));

function emptyForm(grade, subject, topic = "") {
  return {
    grade,
    subject,
    topic,
    prompt: "",
    options: ["", ""],
    correct: 0,
    explanation: "",
    difficulty: "medium",
    hints: [],
  };
}

export default function Tasks() {
  // Wizard position: subject → class → topic → questions.
  const [subject, setSubject] = useState(null);
  const [grade, setGrade] = useState(null);
  const [topic, setTopic] = useState(null);

  const [topics, setTopics] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [newTopic, setNewTopic] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => emptyForm(7, "Математика"));
  const [expanded, setExpanded] = useState(() => new Set());
  const [notice, setNotice] = useState("");

  const loadTopics = useCallback(async () => {
    if (!subject || !grade) return;
    setLoading(true);
    setError("");
    try {
      const { topics } = await adminApi.taskTopics({ grade, subject });
      setTopics(topics);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [subject, grade]);

  const loadTasks = useCallback(async () => {
    if (!subject || !grade || !topic) return;
    setLoading(true);
    setError("");
    try {
      const { tasks } = await adminApi.listTasks({ grade, subject, topic });
      setTasks(tasks);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [subject, grade, topic]);

  useEffect(() => { if (subject && grade && !topic) loadTopics(); }, [subject, grade, topic, loadTopics]);
  useEffect(() => { if (topic) loadTasks(); }, [topic, loadTasks]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  // ---- Task form helpers ----
  function setOption(i, value) {
    setForm((f) => {
      const options = [...f.options];
      options[i] = value;
      return { ...f, options };
    });
  }
  function addOption() {
    setForm((f) => (f.options.length >= 6 ? f : { ...f, options: [...f.options, ""] }));
  }
  function removeOption(i) {
    setForm((f) => {
      if (f.options.length <= 2) return f;
      const options = f.options.filter((_, idx) => idx !== i);
      let correct = f.correct;
      if (i === correct) correct = 0;
      else if (i < correct) correct -= 1;
      return { ...f, options, correct };
    });
  }
  function setHint(i, value) {
    setForm((f) => {
      const hints = [...f.hints];
      hints[i] = value;
      return { ...f, hints };
    });
  }
  function addHint() {
    setForm((f) => (f.hints.length >= 2 ? f : { ...f, hints: [...f.hints, ""] }));
  }
  function removeHint(i) {
    setForm((f) => ({ ...f, hints: f.hints.filter((_, idx) => idx !== i) }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(grade, subject, topic));
    setFormOpen(true);
  }
  function openEdit(t) {
    setEditingId(t.id);
    setForm({
      grade: t.grade,
      subject: t.subject,
      topic: t.topic,
      prompt: t.prompt,
      options: [...t.options],
      correct: t.correct,
      explanation: t.explanation || "",
      difficulty: t.difficulty || "medium",
      hints: Array.isArray(t.hints) ? [...t.hints] : [],
    });
    setFormOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const options = form.options.map((o) => o.trim());
    if (options.some((o) => !o)) {
      setError("Заполните все варианты ответа");
      return;
    }
    try {
      const hints = form.hints.map((h) => h.trim()).filter(Boolean);
      const payload = { ...form, options, hints };
      if (editingId) {
        await adminApi.updateTask(editingId, payload);
        setNotice("Вопрос обновлён");
      } else {
        await adminApi.createTask(payload);
        setNotice("Вопрос добавлен");
      }
      setFormOpen(false);
      setEditingId(null);
      await loadTasks();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeTask(id) {
    if (!confirm("Удалить вопрос?")) return;
    try {
      await adminApi.deleteTask(id);
      await loadTasks();
    } catch (e) {
      setError(e.message);
    }
  }

  function toggleExpand(id) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openTopic(name) {
    setTopic(name);
    setExpanded(new Set());
  }

  function createTopic(e) {
    e.preventDefault();
    const name = newTopic.trim();
    if (!name) return;
    setTopicModalOpen(false);
    setNewTopic("");
    // Open the (empty) question list for the new topic — the tutor adds
    // questions when they choose to, via the "Вопрос" button.
    openTopic(name);
  }

  // ---------- Step 1: subject ----------
  if (!subject) {
    return (
      <div className="apage">
        <WizardHeader step={1} />
        <div className="apick-grid">
          {SUBJECTS.map(({ name, icon: Icon, tone }) => (
            <button
              key={name}
              className={`apick apick--${tone}`}
              onClick={() => { setSubject(name); setGrade(null); setTopic(null); }}
            >
              <span className="apick__icon"><Icon size={30} strokeWidth={2.2} /></span>
              <span className="apick__label">{name}</span>
              <ChevronRight className="apick__go" size={20} strokeWidth={2.6} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Step 2: class ----------
  if (!grade) {
    return (
      <div className="apage">
        <WizardHeader step={2} subject={subject} onBack={() => setSubject(null)} />
        <div className="agrade-grid">
          {GRADES.map((g) => (
            <button key={g} className="agrade" onClick={() => { setGrade(g); setTopic(null); }}>
              <span className="agrade__num">{g}</span>
              <span className="agrade__cap">класс</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Step 3: topics ----------
  if (!topic) {
    return (
      <div className="apage">
        <WizardHeader
          step={3}
          subject={subject}
          grade={grade}
          onBack={() => setGrade(null)}
        />
        <div className="asection__head">
          <SectionTitle>Темы ({topics.length})</SectionTitle>
          <div className="apage__head-actions">
            <Button type="button" variant="soft" size="sm" icon={Download} onClick={() => adminApi.downloadTaskTemplate().catch((e) => setError(e.message))}>Шаблон</Button>
            <Button type="button" variant="soft" size="sm" icon={Upload} onClick={() => setImportOpen(true)}>Импорт</Button>
            <Button type="button" size="sm" icon={Plus} onClick={() => { setNewTopic(""); setTopicModalOpen(true); }}>Тема</Button>
          </div>
        </div>

        {notice && <div className="atoast" role="status">{notice}</div>}
        {error && <p className="aerror">{error}</p>}

        {loading ? (
          <p className="aempty">Загрузка…</p>
        ) : topics.length === 0 ? (
          <div className="aempty aempty--rich">
            <Folder size={30} strokeWidth={1.8} />
            <p>Для {grade} класса по предмету «{subject}» тем ещё нет.</p>
            <Button type="button" icon={Plus} onClick={() => { setNewTopic(""); setTopicModalOpen(true); }}>Создать первую тему</Button>
          </div>
        ) : (
          <div className="atopic-grid">
            {topics.map((t) => (
              <button key={t.topic} className="atopic" onClick={() => openTopic(t.topic)}>
                <span className="atopic__icon"><Folder size={20} strokeWidth={2.2} /></span>
                <span className="atopic__body">
                  <span className="atopic__name">{t.topic}</span>
                  <span className="atopic__count">{t.count} {plural(t.count, "вопрос", "вопроса", "вопросов")}</span>
                </span>
                <ChevronRight size={18} strokeWidth={2.6} className="atopic__go" />
              </button>
            ))}
          </div>
        )}

        {topicModalOpen && (
          <FormModal title="Новая тема" eyebrow={{ icon: Folder, text: `${subject} · ${grade} класс` }} onClose={() => setTopicModalOpen(false)}>
            <form className="aform" onSubmit={createTopic}>
              <label className="afield">
                <span>Название темы</span>
                <input
                  className="ainput"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="Дроби"
                  autoFocus
                  required
                />
              </label>
              <div className="aform__actions">
                <Button type="submit" icon={ChevronRight}>Создать</Button>
                <Button type="button" variant="soft" onClick={() => setTopicModalOpen(false)}>Отмена</Button>
              </div>
            </form>
          </FormModal>
        )}

        {importOpen && (
          <ImportModal
            title="Импорт заданий"
            eyebrow="Задания"
            fields={TASK_IMPORT_FIELDS}
            onDownload={adminApi.downloadTaskTemplate}
            onImport={adminApi.importTasks}
            onClose={() => setImportOpen(false)}
            onImported={loadTopics}
          />
        )}
      </div>
    );
  }

  // ---------- Step 4: questions ----------
  return (
    <div className="apage">
      <WizardHeader
        step={4}
        subject={subject}
        grade={grade}
        topic={topic}
        onBack={() => setTopic(null)}
      />
      <div className="asection__head">
        <SectionTitle>Вопросы ({tasks.length})</SectionTitle>
        <div className="apage__head-actions">
          <Button type="button" variant="soft" size="sm" icon={Upload} onClick={() => setImportOpen(true)}>Импорт</Button>
          <Button type="button" size="sm" icon={Plus} onClick={openCreate}>Вопрос</Button>
        </div>
      </div>

      {notice && <div className="atoast" role="status">{notice}</div>}
      {error && <p className="aerror">{error}</p>}

      {loading ? (
        <p className="aempty">Загрузка…</p>
      ) : tasks.length === 0 ? (
        <div className="aempty aempty--rich">
          <ListChecks size={30} strokeWidth={1.8} />
          <p>В теме «{topic}» пока нет вопросов.</p>
          <Button type="button" icon={Plus} onClick={openCreate}>Добавить вопрос</Button>
        </div>
      ) : (
        <div className="alist">
          {tasks.map((t) => {
            const open = expanded.has(t.id);
            return (
              <div className={`arow arow--card arow--q${open ? " is-open" : ""}`} key={t.id}>
                <div className="arow__main">
                  <div className="aq__prompt">{t.prompt}</div>
                  <div className="arow__meta">
                    <span className={`achip achip--${t.difficulty}`}>{DIFFICULTY_LABEL[t.difficulty] || t.difficulty}</span>
                    {" · "}{t.options.length} {plural(t.options.length, "вариант", "варианта", "вариантов")}
                  </div>
                  {open && (
                    <div className="aq__detail">
                      <ul className="aq__options">
                        {t.options.map((opt, i) => (
                          <li key={i} className={i === t.correct ? "is-correct" : ""}>
                            {i === t.correct
                              ? <CheckCircle2 size={15} strokeWidth={2.6} />
                              : <span className="aq__bullet">{String.fromCharCode(1040 + i)}</span>}
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>
                      {t.explanation && <p className="aq__explain"><b>Пояснение:</b> {t.explanation}</p>}
                      {Array.isArray(t.hints) && t.hints.length > 0 && (
                        <p className="aq__explain"><b>Подсказки:</b> {t.hints.join(" • ")}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="arow__actions">
                  <button className="aicon-btn" onClick={() => toggleExpand(t.id)} aria-label={open ? "Свернуть" : "Показать"} aria-expanded={open}>
                    {open ? <EyeOff size={17} strokeWidth={2.4} /> : <Eye size={17} strokeWidth={2.4} />}
                  </button>
                  <button className="aicon-btn aicon-btn--edit" onClick={() => openEdit(t)} aria-label="Изменить">
                    <Pencil size={17} strokeWidth={2.4} />
                  </button>
                  <button className="aicon-btn aicon-btn--delete" onClick={() => removeTask(t.id)} aria-label="Удалить">
                    <Trash2 size={17} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <FormModal
          title={editingId ? "Изменить вопрос" : "Новый вопрос"}
          eyebrow={{ icon: ListChecks, text: `${subject} · ${grade} кл. · ${topic}` }}
          onClose={() => { setFormOpen(false); setEditingId(null); }}
          size="lg"
        >
          <form className="aform" onSubmit={submit}>
            <div className="aform__row">
              <label className="afield">
                <span>Тема</span>
                <input
                  className="ainput"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  required
                />
              </label>
              <label className="afield">
                <span>Сложность</span>
                <select
                  className="aselect"
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="afield">
              <span>Условие вопроса</span>
              <textarea
                className="atextarea"
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Сложи дроби: 1/4 + 1/4"
                required
              />
            </label>

            <div className="afield">
              <span>Варианты ответа (отметьте правильный)</span>
              {form.options.map((opt, i) => (
                <div className="aopt" key={i}>
                  <label className="aopt__radio">
                    <input
                      type="radio"
                      name="correct"
                      checked={form.correct === i}
                      onChange={() => setForm({ ...form, correct: i })}
                    />
                  </label>
                  <input
                    className="ainput"
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Вариант ${i + 1}`}
                    required
                  />
                  {form.options.length > 2 && (
                    <button type="button" className="aopt__del" onClick={() => removeOption(i)} aria-label="Убрать вариант">
                      <X size={16} strokeWidth={2.6} />
                    </button>
                  )}
                </div>
              ))}
              {form.options.length < 6 && (
                <Button type="button" variant="soft" size="sm" icon={Plus} onClick={addOption}>
                  Добавить вариант
                </Button>
              )}
            </div>

            <label className="afield">
              <span>Пояснение (необязательно)</span>
              <textarea
                className="atextarea"
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                placeholder="Почему этот ответ верный…"
              />
            </label>

            <div className="afield">
              <span>Подсказки «Намекни» (не более 2, необязательно)</span>
              {form.hints.map((h, i) => (
                <div className="aopt" key={i}>
                  <input
                    className="ainput"
                    value={h}
                    onChange={(e) => setHint(i, e.target.value)}
                    placeholder={`Подсказка ${i + 1}`}
                  />
                  <button type="button" className="aopt__del" onClick={() => removeHint(i)} aria-label="Убрать подсказку">
                    <X size={16} strokeWidth={2.6} />
                  </button>
                </div>
              ))}
              {form.hints.length < 2 && (
                <Button type="button" variant="soft" size="sm" icon={Plus} onClick={addHint}>
                  Добавить подсказку
                </Button>
              )}
            </div>

            {error && <p className="aerror">{error}</p>}
            <div className="aform__actions">
              <Button type="submit" icon={editingId ? Pencil : Plus}>
                {editingId ? "Сохранить" : "Создать вопрос"}
              </Button>
              <Button type="button" variant="soft" onClick={() => { setFormOpen(false); setEditingId(null); }}>
                Отмена
              </Button>
            </div>
          </form>
        </FormModal>
      )}

      {importOpen && (
        <ImportModal
          title="Импорт заданий"
          eyebrow="Задания"
          fields={TASK_IMPORT_FIELDS}
          onDownload={adminApi.downloadTaskTemplate}
          onImport={adminApi.importTasks}
          onClose={() => setImportOpen(false)}
          onImported={loadTasks}
        />
      )}
    </div>
  );
}

function WizardHeader({ step, subject, grade, topic, onBack }) {
  const crumbs = ["Предмет", "Класс", "Тема", "Вопросы"];
  return (
    <header className="awizard">
      <div className="awizard__top">
        <span className="apage__head-icon apage__head-icon--tasks">
          <ListChecks size={24} strokeWidth={2.4} />
        </span>
        <div className="apage__head-text">
          <h1>Задания</h1>
        </div>
        {onBack && (
          <Button type="button" variant="soft" size="sm" icon={ChevronLeft} onClick={onBack}>Назад</Button>
        )}
      </div>
      <div className="awizard__steps" aria-label="Шаги">
        {crumbs.map((c, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          const label =
            n === 1 ? (subject || c)
            : n === 2 ? (grade ? `${grade} класс` : c)
            : n === 3 ? (topic || c)
            : c;
          return (
            <span key={c} className={`awizard__step${active ? " is-active" : ""}${done ? " is-done" : ""}`}>
              <span className="awizard__step-num">{n}</span>
              <span className="awizard__step-label">{label}</span>
            </span>
          );
        })}
      </div>
    </header>
  );
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
