import { useEffect, useState, useCallback } from "react";
import { UserCog, Plus, Pencil, Trash2, X, Search, MessageCircle } from "lucide-react";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import ContactPickerModal from "../../components/admin/ContactPickerModal";
import FormModal from "../../components/admin/FormModal";
import { adminApi } from "../../api/admin";
import { useAdminAuth } from "../../context/AdminAuth";
import "./admin.css";

const EMPTY = { name: "", tgId: "", role: "tutor" };

export default function Users() {
  const { user: me } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [{ users }, contactsResponse] = await Promise.all([
        adminApi.listUsers(),
        adminApi.telegramContacts("user").catch(() => ({ contacts: [] })),
      ]);
      setUsers(users);
      setContacts(contactsResponse.contacts);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  function reset() {
    setForm(EMPTY);
    setSelectedContact(null);
    setPickerOpen(false);
    setEditingId(null);
    setFormOpen(false);
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
      setNotice(editingId ? "Роль пользователя обновлена" : "Пользователь добавлен");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function edit(u) {
    setEditingId(u.id);
    setForm({ name: u.name, tgId: u.tg_id, role: u.role });
    setFormOpen(true);
  }

  const visibleUsers = users.filter((user) => (
    (roleFilter === "all" || user.role === roleFilter)
    && `${user.name} ${user.role} ${user.tg_id}`.toLowerCase().includes(search.trim().toLowerCase())
  ));

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
        <span className="apage__head-icon apage__head-icon--users">
          <UserCog size={24} strokeWidth={2.4} />
        </span>
        <div className="apage__head-text">
          <h1>Пользователи</h1>
          <p className="apage__sub">Роли сотрудников и доступ к панели управления</p>
        </div>
        <Button type="button" icon={Plus} onClick={() => { reset(); setFormOpen(true); }}>Добавить</Button>
      </header>

      {formOpen && (
      <FormModal
        title={editingId ? "Редактирование пользователя" : "Новый пользователь"}
        eyebrow={{ icon: UserCog, text: "Доступ к панели" }}
        onClose={reset}
      >
        <form className="aform" onSubmit={submit}>
          {!editingId && (
            <div className="afield acontact-field">
              <span><MessageCircle size={15} /> 1. Выберите человека из чата бота</span>
              <div className="acontact-field__selection">
                <div>
                  <strong>{selectedContact ? selectedContact.name : "Контакт ещё не выбран"}</strong>
                  <small>{selectedContact ? `${selectedContact.username ? `@${selectedContact.username} · ` : ""}TG ${selectedContact.tg_id}` : "Поиск по имени, username или Telegram ID"}</small>
                </div>
                <Button type="button" size="sm" variant="soft" icon={MessageCircle} onClick={() => setPickerOpen(true)}>
                  {selectedContact ? "Изменить" : "Выбрать из чата"}
                </Button>
              </div>
              <small>{contacts.length ? `Доступно новых контактов: ${contacts.length}` : "Новых контактов пока нет"}</small>
            </div>
          )}
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
          {notice && <p className="anotice">{notice}</p>}
          <div className="aform__actions">
            <Button type="submit" icon={editingId ? Pencil : Plus}>
              {editingId ? "Сохранить" : "Добавить пользователя"}
            </Button>
            <Button type="button" variant="soft" icon={X} onClick={reset}>
              Отмена
            </Button>
          </div>
        </form>
      </FormModal>
      )}
      <ContactPickerModal
        contacts={contacts}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(contact) => {
          setSelectedContact(contact);
          setForm({ ...form, name: contact.name, tgId: contact.tg_id, role: form.role });
          setPickerOpen(false);
        }}
        title="Выберите сотрудника из чата бота"
      />

      {notice && <div className="atoast" role="status">{notice}</div>}

      <div className="asection">
        <div className="asection__head">
          <SectionTitle>Список ({visibleUsers.length})</SectionTitle>
          <div className="alist__filters">
            <label className="asearch"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени или Telegram ID" /></label>
            <select className="aselect afilter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Роль пользователя">
              <option value="all">Все роли</option>
              <option value="admin">Админы</option>
              <option value="tutor">Репетиторы</option>
            </select>
          </div>
        </div>
        {loading ? (
          <p className="aempty">Загрузка…</p>
        ) : users.length === 0 ? (
          <p className="aempty">Пока нет пользователей.</p>
        ) : visibleUsers.length === 0 ? (
          <p className="aempty">По этому запросу пользователей нет.</p>
        ) : (
          <div className="alist">
            {visibleUsers.map((u) => (
              <div className="arow" key={u.id}>
                <div className="arow__main">
                  <div className="arow__title">{u.name}</div>
                  <div className="arow__meta">
                    {u.role === "admin" ? "Админ" : "Репетитор"} · TG {u.tg_id}
                  </div>
                </div>
                <div className="arow__actions">
                  <button className="aicon-btn aicon-btn--edit" onClick={() => edit(u)} aria-label="Редактировать">
                    <Pencil size={17} strokeWidth={2.4} />
                  </button>
                  <button
                    className="aicon-btn aicon-btn--delete"
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
