import { useEffect, useState, useCallback } from "react";
import { BookOpen, Plus, Trash2, Upload, CheckCircle2, Search, ChevronRight, ChevronLeft } from "lucide-react";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import ImportModal from "../../components/admin/ImportModal";
import FormModal from "../../components/admin/FormModal";
import { adminApi } from "../../api/admin";
import "./admin.css";

const SUBJECTS = ["Математика", "Русский"];
const GRADES = [6, 7, 8, 9, 10, 11];
const EMPTY = { title: "", description: "", due: "", taskIds: [] };

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
  const [tasks, setTasks] = useState([]);
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

  const loadForStudent = useCallback(async () => {
    if (!student) return;
    try {
      const [{ tasks }, { homework }] = await Promise.all([
        adminApi.listTasks({ grade: student.grade, subject: student.subject }),
        adminApi.listHomework(student.id),
      ]);
      setTasks(tasks);
      setHomework(homework);
      setForm(EMPTY);
    } catch (e) {
      setError(e.message);
    }
  }, [student]);

  useEffect(() => {
    loadForStudent();
  }, [loadForStudent]);

  function toggleTask(id) {
    setForm((f) => {
      const has = f.taskIds.includes(id);
      return { ...f, taskIds: has ? f.taskIds.filter((x) => x !== id) : [...f.taskIds, id] };
    });
  }

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
      <header className="apage__head">
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
              <label className="afield">
                <span>Срок сдачи</span>
                <input
                  className="ainput"
                  type="date"
                  value={form.due}
                  onChange={(e) => setForm({ ...form, due: e.target.value })}
                />
              </label>

              <div className="afield">
                <span>Задания из базы ({student.grade} класс · {student.subject})</span>
                {tasks.length === 0 ? (
                  <p className="arow__meta">Нет заданий для этого класса/предмета — создайте в разделе «Задания».</p>
                ) : (
                  <div className="alist">
                    {tasks.map((t) => (
                      <label className="arow" key={t.id} style={{ cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={form.taskIds.includes(t.id)}
                          onChange={() => toggleTask(t.id)}
                          style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
                        />
                        <div className="arow__main">
                          <div className="arow__title">{t.prompt}</div>
                          <div className="arow__meta">
                            <span className="achip">{t.topic}</span> {t.difficulty}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
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
                        {Array.isArray(h.task_ids) && h.task_ids.length ? ` · ${h.task_ids.length} заданий` : ""}
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
