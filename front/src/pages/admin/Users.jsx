import { useEffect, useState, useCallback } from "react";
import { UserCog, Plus, Pencil, Trash2, X } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import { adminApi } from "../../api/admin";
import { useAdminAuth } from "../../context/AdminAuth";
import "./admin.css";

const EMPTY = { name: "", tgId: "", role: "tutor" };

export default function Users() {
  const { user: me } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { users } = await adminApi.listUsers();
      setUsers(users);
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
        await adminApi.updateUser(editingId, { name: form.name, role: form.role });
      } else {
        await adminApi.createUser(form);
      }
      reset();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function edit(u) {
    setEditingId(u.id);
    setForm({ name: u.name, tgId: u.tg_id, role: u.role });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id) {
    if (!confirm("Удалить пользователя? Он потеряет доступ к админ-панели.")) return;
    try {
      await adminApi.deleteUser(id);
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
          <UserCog size={24} strokeWidth={2.4} />
        </span>
        <div>
          <h1>Пользователи</h1>
          <p className="apage__sub">Назначайте роли: репетитор или админ</p>
        </div>
      </header>

      <Card pad="md">
        <SectionTitle>{editingId ? "Редактирование пользователя" : "Новый пользователь"}</SectionTitle>
        <form className="aform" onSubmit={submit}>
          <div className="aform__row">
            <label className="afield">
              <span>Имя</span>
              <input
                className="ainput"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Иван Петров"
                required
              />
            </label>
            <label className="afield">
              <span>Telegram ID</span>
              <input
                className="ainput"
                value={form.tgId}
                onChange={(e) => setForm({ ...form, tgId: e.target.value })}
                placeholder="123456789"
                required
                disabled={!!editingId}
              />
            </label>
            <label className="afield">
              <span>Роль</span>
              <select
                className="aselect"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="tutor">Репетитор</option>
                <option value="admin">Админ</option>
              </select>
            </label>
          </div>
          {error && <p className="aerror">{error}</p>}
          <div className="aform__actions">
            <Button type="submit" icon={editingId ? Pencil : Plus}>
              {editingId ? "Сохранить" : "Добавить пользователя"}
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
        <SectionTitle>Список ({users.length})</SectionTitle>
        {loading ? (
          <p className="aempty">Загрузка…</p>
        ) : users.length === 0 ? (
          <p className="aempty">Пока нет пользователей.</p>
        ) : (
          <div className="alist">
            {users.map((u) => (
              <div className="arow" key={u.id}>
                <div className="arow__main">
                  <div className="arow__title">{u.name}</div>
                  <div className="arow__meta">
                    {u.role === "admin" ? "Админ" : "Репетитор"} · TG {u.tg_id}
                  </div>
                </div>
                <div className="arow__actions">
                  <button className="aicon-btn" onClick={() => edit(u)} aria-label="Редактировать">
                    <Pencil size={17} strokeWidth={2.4} />
                  </button>
                  <button
                    className="aicon-btn"
                    onClick={() => remove(u.id)}
                    aria-label="Удалить"
                    disabled={me && String(me.id) === String(u.id)}
                    title={me && String(me.id) === String(u.id) ? "Нельзя удалить самого себя" : undefined}
                  >
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
