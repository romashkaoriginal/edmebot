import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Pencil, Trash2, X, Coins, ChevronDown, ChevronUp } from "lucide-react";
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
  const [bonusOpenId, setBonusOpenId] = useState(null);

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

  function toggleBonus(id) {
    setBonusOpenId((cur) => (cur === id ? null : id));
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
              <span>Telegram ID</span>
              <input
                className="ainput"
                value={form.tgId}
                onChange={(e) => setForm({ ...form, tgId: e.target.value })}
                placeholder="123456789"
                required
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
                  <button
                    className="aicon-btn"
                    onClick={() => toggleBonus(s.id)}
                    aria-label="Бонусы"
                    aria-expanded={bonusOpenId === s.id}
                  >
                    <Coins size={17} strokeWidth={2.4} />
                    {bonusOpenId === s.id ? (
                      <ChevronUp size={14} strokeWidth={2.4} />
                    ) : (
                      <ChevronDown size={14} strokeWidth={2.4} />
                    )}
                  </button>
                  <button className="aicon-btn" onClick={() => edit(s)} aria-label="Редактировать">
                    <Pencil size={17} strokeWidth={2.4} />
                  </button>
                  <button className="aicon-btn" onClick={() => remove(s.id)} aria-label="Удалить">
                    <Trash2 size={17} strokeWidth={2.4} />
                  </button>
                </div>
                {bonusOpenId === s.id && <BonusPanel studentId={s.id} />}
              </div>
            ))}
          </div>
        )}
      </div>
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
      setError("amount_required");
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
    <div className="arow__bonus">
      <div className="arow__bonus-balance">
        Баланс: <strong>{data ? data.balance : "…"}</strong>
      </div>

      <form className="aform aform--inline" onSubmit={award}>
        <input
          className="ainput"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Сумма (можно отрицательную)"
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
