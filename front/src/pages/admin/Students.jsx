import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Pencil, Trash2, X } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import { adminApi } from "../../api/admin";
import "./admin.css";

const EMPTY = { name: "", grade: 7, subject: "Математика", tgId: "" };

export default function Students() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { students } = await adminApi.listStudents();
      setStudents(students);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await adminApi.updateStudent(editingId, form);
      } else {
        await adminApi.createStudent(form);
      }
      reset();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function edit(s) {
    setEditingId(s.id);
    setForm({ name: s.name, grade: s.grade, subject: s.subject, tgId: s.tg_id || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id) {
    if (!confirm("Удалить ученика? Его домашка и статистика тоже удалятся.")) return;
    try {
      await adminApi.deleteStudent(id);
      if (editingId === id) reset();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="apage">
      <header className="apage__head">
        <span className="apage__head-icon">
          <Users size={24} strokeWidth={2.4} />
        </span>
        <div>
          <h1>Ученики</h1>
          <p className="apage__sub">Добавляйте, изменяйте и удаляйте учеников</p>
        </div>
      </header>

      <Card pad="md">
        <SectionTitle>{editingId ? "Редактирование ученика" : "Новый ученик"}</SectionTitle>
        <form className="aform" onSubmit={submit}>
          <div className="aform__row">
            <label className="afield">
              <span>Имя</span>
              <input
                className="ainput"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Артём"
                required
              />
            </label>
            <label className="afield">
              <span>Класс</span>
              <select
                className="aselect"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}
              >
                {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                  <option key={g} value={g}>
                    {g} класс
                  </option>
                ))}
              </select>
            </label>
            <label className="afield">
              <span>Предмет</span>
              <input
                className="ainput"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Математика"
                required
              />
            </label>
            <label className="afield">
              <span>Telegram ID (необязательно)</span>
              <input
                className="ainput"
                value={form.tgId}
                onChange={(e) => setForm({ ...form, tgId: e.target.value })}
                placeholder="123456789"
              />
            </label>
          </div>
          {error && <p className="aerror">{error}</p>}
          <div className="aform__actions">
            <Button type="submit" icon={editingId ? Pencil : Plus}>
              {editingId ? "Сохранить" : "Добавить ученика"}
            </Button>
            {editingId && (
              <Button type="button" variant="soft" icon={X} onClick={reset}>
                Отмена
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div className="asection">
        <SectionTitle>Список ({students.length})</SectionTitle>
        {loading ? (
          <p className="aempty">Загрузка…</p>
        ) : students.length === 0 ? (
          <p className="aempty">Пока нет учеников. Добавьте первого выше.</p>
        ) : (
          <div className="alist">
            {students.map((s) => (
              <div className="arow" key={s.id}>
                <div className="arow__main">
                  <div className="arow__title">{s.name}</div>
                  <div className="arow__meta">
                    {s.grade} класс · {s.subject}
                    {s.tg_id && s.tg_id !== "demo" ? ` · TG ${s.tg_id}` : ""}
                    {s.tg_id === "demo" ? " · демо" : ""}
                  </div>
                </div>
                <div className="arow__actions">
                  <button className="aicon-btn" onClick={() => edit(s)} aria-label="Редактировать">
                    <Pencil size={17} strokeWidth={2.4} />
                  </button>
                  <button className="aicon-btn" onClick={() => remove(s.id)} aria-label="Удалить">
                    <Trash2 size={17} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
