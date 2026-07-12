import { useEffect, useState, useCallback } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import { adminApi } from "../../api/admin";
import "./admin.css";

const EMPTY = { title: "", description: "", due: "", taskIds: [] };

export default function HomeworkAdmin() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [homework, setHomework] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  // Load students once.
  useEffect(() => {
    adminApi
      .listStudents()
      .then(({ students }) => {
        setStudents(students);
        if (students[0]) setStudentId(String(students[0].id));
      })
      .catch((e) => setError(e.message));
  }, []);

  const student = students.find((s) => String(s.id) === String(studentId));

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
        <span className="apage__head-icon">
          <BookOpen size={24} strokeWidth={2.4} />
        </span>
        <div>
          <h1>Домашка</h1>
          <p className="apage__sub">Выдавайте домашние задания конкретному ученику</p>
        </div>
        <Button type="button" icon={Plus} disabled={!student} onClick={() => setFormOpen(true)}>Добавить</Button>
      </header>

      <Card pad="md">
        <SectionTitle>Ученик</SectionTitle>
        {students.length === 0 ? (
          <p className="aempty">Сначала добавьте учеников в разделе «Ученики».</p>
        ) : (
          <label className="afield">
            <span>Кому выдаём</span>
            <select className="aselect" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.grade} класс · {s.subject}
                </option>
              ))}
            </select>
          </label>
        )}
      </Card>

      {student && (
        <>
          {formOpen && <div className="contact-picker" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setFormOpen(false)}>
          <Card className="asection" pad="md">
            <SectionTitle>Новая домашка</SectionTitle>
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
                  type="datetime-local"
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
              </div>
            </form>
          </Card>
          </div>}

          <div className="asection">
            <SectionTitle>Выданная домашка ({homework.length})</SectionTitle>
            {homework.length === 0 ? (
              <p className="aempty">Этому ученику ещё ничего не выдано.</p>
            ) : (
              <div className="alist">
                {homework.map((h) => (
                  <div className="arow" key={h.id}>
                    <div className="arow__main">
                      <div className="arow__title">{h.title}</div>
                      <div className="arow__meta">
                        {h.status === "done" ? "✓ сдано" : "активно"}
                        {h.due ? ` · до ${new Date(h.due).toLocaleString("ru-RU")}` : ""}
                        {Array.isArray(h.task_ids) && h.task_ids.length ? ` · ${h.task_ids.length} заданий` : ""}
                      </div>
                    </div>
                    <div className="arow__actions">
                      <button className="aicon-btn" onClick={() => remove(h.id)} aria-label="Удалить">
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
