import { useEffect, useState, useCallback } from "react";
import {
  Users, Plus, Pencil, Trash2, X, Coins, Search, MessageCircle,
  BookMarked, ChevronDown,
} from "lucide-react";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import ContactPickerModal from "../../components/admin/ContactPickerModal";
import FormModal from "../../components/admin/FormModal";
import { adminApi } from "../../api/admin";
import "./admin.css";

const SUBJECTS = ["Математика", "Русский"];
const GRADES = [5, 6, 7, 8, 9, 10, 11];
const EMPTY = {
  firstName: "",
  lastName: "",
  tgId: "",
  subjects: [{ subject: "Математика", grade: 7 }],
};

export default function Students() {
  const [students, setStudents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [panel, setPanel] = useState(null); // 'bonus' | 'subjects'

  const load = useCallback(async () => {
    try {
      const [{ students }, contactsResponse] = await Promise.all([
        adminApi.listStudents(),
        adminApi.telegramContacts("student").catch(() => ({ contacts: [] })),
      ]);
      setStudents(students);
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
    const subjects = form.subjects.filter((s) => s.subject && s.grade);
    if (!editingId && subjects.length === 0) {
      setError("Добавьте хотя бы один предмет");
      return;
    }
    try {
      if (editingId) {
        // On edit we only touch name/tg/primary subject; per-subject changes
        // happen in the expandable "Предметы" panel of the row.
        await adminApi.updateStudent(editingId, {
          firstName: form.firstName,
          lastName: form.lastName,
          tgId: form.tgId,
          subject: subjects[0]?.subject,
          grade: subjects[0]?.grade,
        });
      } else {
        await adminApi.createStudent({
          firstName: form.firstName,
          lastName: form.lastName,
          tgId: form.tgId,
          subjects,
        });
      }
      reset();
      setNotice(editingId ? "Данные ученика сохранены" : "Ученик добавлен и привязан к Telegram");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function edit(s) {
    setEditingId(s.id);
    setForm({
      firstName: s.first_name || s.name || "",
      lastName: s.last_name || "",
      tgId: s.is_demo ? "демо" : s.tg_id || "",
      subjects: [{ subject: s.subject || "Математика", grade: s.grade || 7 }],
    });
    setFormOpen(true);
  }

  function setSubjectRow(i, patch) {
    setForm((f) => {
      const subjects = f.subjects.map((row, idx) => (idx === i ? { ...row, ...patch } : row));
      return { ...f, subjects };
    });
  }
  function addSubjectRow() {
    setForm((f) => {
      const used = new Set(f.subjects.map((s) => s.subject));
      const next = SUBJECTS.find((s) => !used.has(s));
      if (!next) return f; // all subjects already added
      return { ...f, subjects: [...f.subjects, { subject: next, grade: 7 }] };
    });
  }
  function removeSubjectRow(i) {
    setForm((f) => (f.subjects.length <= 1 ? f : { ...f, subjects: f.subjects.filter((_, idx) => idx !== i) }));
  }

  const visibleStudents = students.filter((student) => {
    if (statusFilter !== "all" && student.status !== statusFilter) return false;
    if (gradeFilter !== "all" && String(student.grade) !== gradeFilter) return false;
    if (subjectFilter !== "all" && student.subject !== subjectFilter) return false;
    const value = `${student.name} ${student.subject} ${student.tg_id ?? ""}`.toLowerCase();
    return value.includes(search.trim().toLowerCase());
  });

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

  function togglePanel(id, which) {
    setExpandedId((curId) => {
      if (curId === id && panel === which) {
        setPanel(null);
        return null;
      }
      setPanel(which);
      return id;
    });
  }

  const filtersActive =
    statusFilter !== "all" || gradeFilter !== "all" || subjectFilter !== "all" || search.trim();

  return (
    <div className="apage">
      <header className="apage__head">
        <span className="apage__head-icon apage__head-icon--students">
          <Users size={24} strokeWidth={2.4} />
        </span>
        <div className="apage__head-text">
          <h1>Ученики</h1>
          <p className="apage__sub">Профили, доступы, предметы и тестовые аккаунты</p>
        </div>
        <Button type="button" icon={Plus} onClick={() => { reset(); setFormOpen(true); }}>Добавить</Button>
      </header>

      {formOpen && (
      <FormModal
        title={editingId ? "Редактирование ученика" : "Новый ученик"}
        eyebrow={{ icon: Users, text: editingId ? "Профиль ученика" : "Привязка к Telegram" }}
        onClose={reset}
      >
        <form className="aform" onSubmit={submit}>
          {!editingId && (
            <div className="afield acontact-field">
              <span><MessageCircle size={15} /> Выберите человека из чата бота</span>
              <div className="acontact-field__selection">
                <div>
                  <strong>{selectedContact ? selectedContact.name : "Контакт ещё не выбран"}</strong>
                  <small>{selectedContact ? `${selectedContact.username ? `@${selectedContact.username} · ` : ""}TG ${selectedContact.tg_id}` : "Поиск по имени, username или Telegram ID"}</small>
                </div>
                <Button type="button" size="sm" variant="soft" icon={MessageCircle} onClick={() => setPickerOpen(true)}>
                  {selectedContact ? "Изменить" : "Выбрать из чата"}
                </Button>
              </div>
              <small>{contacts.length ? `Доступно новых контактов: ${contacts.length}` : "Новых контактов пока нет: попросите ученика написать боту /start"}</small>
            </div>
          )}
          <div className="aform__row aform__row--student">
            <label className="afield">
              <span>Имя</span>
              <input
                className="ainput"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Артём"
                required
              />
            </label>
            <label className="afield">
              <span>Фамилия</span>
              <input
                className="ainput"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Иванов"
              />
            </label>
            <label className="afield">
              <span>Telegram ID</span>
              <input
                className="ainput"
                value={form.tgId}
                onChange={(e) => setForm({ ...form, tgId: e.target.value })}
                placeholder="123456789 или демо"
                autoCapitalize="none"
                spellCheck="false"
                required
              />
              {!editingId && <small className="afield__hint">Для тестового профиля введите «демо». Система создаст отдельный безопасный демо-аккаунт.</small>}
            </label>
          </div>

          {!editingId && (
            <div className="afield">
              <span>Предметы и классы</span>
              <div className="asubject-rows">
                {form.subjects.map((row, i) => (
                  <div className="asubject-row" key={i}>
                    <select
                      className="aselect"
                      value={row.subject}
                      onChange={(e) => setSubjectRow(i, { subject: e.target.value })}
                    >
                      {SUBJECTS.map((s) => (
                        <option
                          key={s}
                          value={s}
                          disabled={s !== row.subject && form.subjects.some((r) => r.subject === s)}
                        >
                          {s}
                        </option>
                      ))}
                    </select>
                    <select
                      className="aselect"
                      value={row.grade}
                      onChange={(e) => setSubjectRow(i, { grade: Number(e.target.value) })}
                    >
                      {GRADES.map((g) => (
                        <option key={g} value={g}>{g} класс</option>
                      ))}
                    </select>
                    {form.subjects.length > 1 && (
                      <button type="button" className="aopt__del" onClick={() => removeSubjectRow(i)} aria-label="Убрать предмет">
                        <X size={16} strokeWidth={2.6} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {form.subjects.length < SUBJECTS.length && (
                <Button type="button" variant="soft" size="sm" icon={Plus} onClick={addSubjectRow}>
                  Ещё предмет
                </Button>
              )}
            </div>
          )}

          {editingId && (
            <label className="afield">
              <span>Основной предмет и класс</span>
              <div className="asubject-row">
                <select
                  className="aselect"
                  value={form.subjects[0].subject}
                  onChange={(e) => setSubjectRow(0, { subject: e.target.value })}
                >
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  className="aselect"
                  value={form.subjects[0].grade}
                  onChange={(e) => setSubjectRow(0, { grade: Number(e.target.value) })}
                >
                  {GRADES.map((g) => <option key={g} value={g}>{g} класс</option>)}
                </select>
              </div>
            </label>
          )}

          {error && <p className="aerror">{error}</p>}
          <div className="aform__actions">
            <Button type="submit" icon={editingId ? Pencil : Plus}>
              {editingId ? "Сохранить" : "Добавить ученика"}
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
          const [first, ...rest] = String(contact.name || "").split(/\s+/);
          setForm({ ...form, firstName: first || contact.name, lastName: rest.join(" "), tgId: contact.tg_id });
          setPickerOpen(false);
        }}
        title="Выберите ученика из чата бота"
      />

      {notice && <div className="atoast" role="status">{notice}</div>}

      <div className="asection">
        <div className="asection__head">
          <SectionTitle>Список ({visibleStudents.length})</SectionTitle>
        </div>
        <div className="afilters">
          <label className="asearch">
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по имени или Telegram ID" />
          </label>
          <select className="aselect afilter" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} aria-label="Предмет">
            <option value="all">Все предметы</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="aselect afilter" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} aria-label="Класс">
            <option value="all">Все классы</option>
            {GRADES.map((g) => <option key={g} value={g}>{g} класс</option>)}
          </select>
          <select className="aselect afilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Статус">
            <option value="all">Любой статус</option>
            <option value="active">Активные</option>
            <option value="pending">Без предмета</option>
          </select>
        </div>

        {loading ? (
          <p className="aempty">Загрузка…</p>
        ) : students.length === 0 ? (
          <p className="aempty">Пока нет учеников. Добавьте первого кнопкой «Добавить».</p>
        ) : visibleStudents.length === 0 ? (
          <p className="aempty">
            По этому запросу учеников нет.{" "}
            {filtersActive && (
              <button
                className="alink"
                onClick={() => { setSearch(""); setStatusFilter("all"); setGradeFilter("all"); setSubjectFilter("all"); }}
              >
                Сбросить фильтры
              </button>
            )}
          </p>
        ) : (
          <div className="alist">
            {visibleStudents.map((s) => {
              const open = expandedId === s.id;
              const isDemo = Boolean(s.is_demo || /^demo(?::|$)/i.test(s.tg_id || ""));
              return (
                <div className={`arow arow--card${open ? " is-open" : ""}`} key={s.id}>
                  <div className="arow__lead">
                    <span className="aavatar" aria-hidden="true">{initials(s.name)}</span>
                    <div className="arow__main">
                      <div className="arow__title">
                        {s.name}
                        {s.status === "pending" && (
                          <span className="atag atag--pending" title="Ученик написал боту, но ему ещё не назначен предмет — назначьте его кнопкой «Предметы»">
                            без предмета
                          </span>
                        )}
                        {isDemo && <span className="atag atag--demo">демо</span>}
                      </div>
                      <div className="arow__meta">
                        {s.grade ? `${s.grade} класс` : "класс не задан"} · {s.subject || "без предмета"}
                        {s.tg_id && !isDemo ? ` · TG ${s.tg_id}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="arow__actions">
                    <button
                      className={`aicon-btn aicon-btn--bonus${open && panel === "bonus" ? " is-active" : ""}`}
                      onClick={() => togglePanel(s.id, "bonus")}
                      aria-label="Бонусы"
                      aria-expanded={open && panel === "bonus"}
                    >
                      <Coins size={17} strokeWidth={2.4} />
                    </button>
                    <button
                      className={`aicon-btn aicon-btn--subjects${open && panel === "subjects" ? " is-active" : ""}`}
                      onClick={() => togglePanel(s.id, "subjects")}
                      aria-label="Предметы"
                      aria-expanded={open && panel === "subjects"}
                    >
                      <BookMarked size={17} strokeWidth={2.4} />
                      <ChevronDown size={13} strokeWidth={2.6} className="aicon-btn__chev" />
                    </button>
                    <button className="aicon-btn aicon-btn--edit" onClick={() => edit(s)} aria-label="Редактировать">
                      <Pencil size={17} strokeWidth={2.4} />
                    </button>
                    <button className="aicon-btn aicon-btn--delete" onClick={() => remove(s.id)} aria-label="Удалить">
                      <Trash2 size={17} strokeWidth={2.4} />
                    </button>
                  </div>
                  {open && panel === "bonus" && <BonusPanel studentId={s.id} />}
                  {open && panel === "subjects" && <SubjectsPanel studentId={s.id} onAssigned={load} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
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

function SubjectsPanel({ studentId, onAssigned }) {
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("Математика");
  const [grade, setGrade] = useState(7);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.studentSubjects(studentId);
      setSubjects(data.subjects ?? []);
    } catch (e) {
      setError(e.message);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await adminApi.assignSubject(studentId, { subject, grade });
      await load();
      await onAssigned();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const has = (name) => subjects.some((item) => item.subject === name);

  return (
    <div className="arow__panel">
      <div className="arow__panel-title">Предметы ученика</div>
      <div className="asubjects">
        {subjects.length ? subjects.map((item) => (
          <span className="achip achip--subject" key={item.subject}>
            {item.subject} · {item.grade} класс
          </span>
        )) : <span className="arow__meta">Пока ни одного предмета. Назначьте первый ниже.</span>}
      </div>
      <form className="aform aform--inline" onSubmit={submit}>
        <select className="aselect" value={subject} onChange={(event) => setSubject(event.target.value)}>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}{has(s) ? " (уже есть)" : ""}</option>
          ))}
        </select>
        <select className="aselect" value={grade} onChange={(event) => setGrade(Number(event.target.value))}>
          {GRADES.map((value) => <option key={value} value={value}>{value} класс</option>)}
        </select>
        <Button type="submit" icon={Plus} disabled={busy}>
          {has(subject) ? "Обновить класс" : "Назначить"}
        </Button>
      </form>
      {error && <p className="aerror">{error}</p>}
    </div>
  );
}

function BonusPanel({ studentId }) {
  const [data, setData] = useState(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.bonusHistory(studentId);
      setData(res);
    } catch (e) {
      setError(e.message);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function award(e) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt === 0) {
      setError("Введите ненулевую сумму");
      return;
    }
    setBusy(true);
    try {
      await adminApi.awardBonus(studentId, { amount: amt, reason });
      setAmount("");
      setReason("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="arow__panel">
      <div className="arow__panel-title">
        Баллы · баланс <strong className="abalance">{data ? data.balance : "…"}</strong>
      </div>

      <form className="aform aform--inline" onSubmit={award}>
        <input
          className="ainput"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Сумма (можно −)"
        />
        <input
          className="ainput"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина (необязательно)"
        />
        <Button type="submit" icon={Coins} disabled={busy}>
          Начислить
        </Button>
      </form>
      {error && <p className="aerror">{error}</p>}

      {data && data.transactions.length > 0 && (
        <div className="arow__bonus-history">
          {data.transactions.map((t) => (
            <div className="arow__bonus-item" key={t.id}>
              <span className={t.amount > 0 ? "abonus-plus" : "abonus-minus"}>
                {t.amount > 0 ? "+" : ""}
                {t.amount}
              </span>
              {t.reason ? <span> · {t.reason}</span> : null}
              <span className="arow__meta"> · {new Date(t.created_at).toLocaleString("ru-RU")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
