import { useEffect, useState, useCallback } from "react";
import { ListChecks, Plus, Trash2, X, Upload, Download } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import { adminApi } from "../../api/admin";
import "./admin.css";

const GRADES = [5, 6, 7, 8, 9, 10, 11];
const DIFFICULTIES = [
  { id: "easy", label: "Лёгкое" },
  { id: "medium", label: "Среднее" },
  { id: "hard", label: "Сложное" },
];

function emptyForm(grade, subject) {
  return {
    grade,
    subject,
    topic: "",
    prompt: "",
    options: ["", ""],
    correct: 0,
    explanation: "",
    difficulty: "medium",
    hints: [],
  };
}

export default function Tasks() {
  const [grade, setGrade] = useState(7);
  const [subject, setSubject] = useState("Математика");
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(() => emptyForm(7, "Математика"));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { tasks } = await adminApi.listTasks({ grade, subject });
      setTasks(tasks);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [grade, subject]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the form's class/subject in sync with the current filter.
  useEffect(() => {
    setForm((f) => ({ ...f, grade, subject }));
  }, [grade, subject]);

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
      await adminApi.createTask({ ...form, options, hints });
      setForm(emptyForm(grade, subject));
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    if (!confirm("Удалить задание?")) return;
    try {
      await adminApi.deleteTask(id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="apage">
      <header className="apage__head">
        <span className="apage__head-icon">
          <ListChecks size={24} strokeWidth={2.4} />
        </span>
        <div>
          <h1>Задания</h1>
          <p className="apage__sub">Создавайте задания с вариантами ответа для класса и предмета</p>
        </div>
      </header>

      <Card pad="md">
        <SectionTitle>Класс и предмет</SectionTitle>
        <div className="aform__row">
          <label className="afield">
            <span>Класс</span>
            <select className="aselect" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g} класс
                </option>
              ))}
            </select>
          </label>
          <label className="afield">
            <span>Предмет</span>
            <input className="ainput" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
        </div>
      </Card>

      <Card className="asection" pad="md">
        <div className="asection__head">
          <SectionTitle>Новое задание</SectionTitle>
          <Button type="button" variant="soft" size="sm" icon={Upload} onClick={() => setImportOpen(true)}>Импорт из Excel</Button>
        </div>
        <form className="aform" onSubmit={submit}>
          <div className="aform__row">
            <label className="afield">
              <span>Тема (ключ)</span>
              <input
                className="ainput"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="fractions"
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
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="afield">
            <span>Условие задания</span>
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
            <Button type="submit" icon={Plus}>
              Создать задание
            </Button>
          </div>
        </form>
      </Card>

      {importOpen && <ImportTasksModal onClose={() => setImportOpen(false)} onImported={load} />}

      <div className="asection">
        <SectionTitle>
          Задания: {grade} класс · {subject} ({tasks.length})
        </SectionTitle>
        {loading ? (
          <p className="aempty">Загрузка…</p>
        ) : tasks.length === 0 ? (
          <p className="aempty">Для этого класса и предмета заданий пока нет.</p>
        ) : (
          <div className="alist">
            {tasks.map((t) => (
              <div className="arow" key={t.id}>
                <div className="arow__main">
                  <div className="arow__title">{t.prompt}</div>
                  <div className="arow__meta">
                    <span className="achip">{t.topic}</span>{" "}
                    {t.options.length} вар. · верный: «{t.options[t.correct]}» · {t.difficulty}
                  </div>
                </div>
                <div className="arow__actions">
                  <button className="aicon-btn" onClick={() => remove(t.id)} aria-label="Удалить">
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

function ImportTasksModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function downloadTemplate() {
    setError("");
    try {
      await adminApi.downloadTaskTemplate();
    } catch (e) {
      setError(e.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) return setError("Выберите файл .xlsx");
    setBusy(true);
    setError("");
    try {
      const imported = await adminApi.importTasks(file);
      setResult(imported);
      await onImported();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contact-picker" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="contact-picker__dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header className="contact-picker__head">
          <div>
            <p className="contact-picker__eyebrow"><Upload size={15} /> Задания</p>
            <h2 id="import-title">Импорт из Excel</h2>
          </div>
          <button className="aicon-btn aicon-btn--close" type="button" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </header>
        <form className="aform admin-import" onSubmit={submit}>
          <Button type="button" variant="soft" icon={Download} onClick={downloadTemplate}>Скачать шаблон</Button>
          <label className="afield">
            <span>Файл Excel</span>
            <input className="ainput" type="file" accept=".xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          {error && <p className="aerror">{error}</p>}
          {result && <div className="anotice">Добавлено: {result.imported}. Пропущено: {result.skipped}.{result.errors?.length ? ` Ошибки в строках: ${result.errors.map((item) => item.row).join(", ")}.` : ""}</div>}
          <div className="aform__actions">
            <Button type="button" variant="soft" onClick={onClose}>Закрыть</Button>
            <Button type="submit" icon={Upload} disabled={busy || !file}>{busy ? "Загрузка…" : "Загрузить"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
