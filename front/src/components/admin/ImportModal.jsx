import { useState } from "react";
import { Upload, Download } from "lucide-react";
import Button from "../ui/Button";
import FormModal from "./FormModal";
import "../../pages/admin/admin.css";

/**
 * Shared Excel-import dialog for the admin panel. Every import flow (tasks,
 * homework, …) reuses this so they all offer the same three things:
 *   1. a downloadable .xlsx template,
 *   2. an inline explanation of every column ("что к чему"),
 *   3. a per-row result summary after upload.
 *
 * Props:
 *   title       — dialog heading, e.g. "Импорт заданий"
 *   eyebrow     — small label above the heading, e.g. "Задания"
 *   fields      — [{ key, desc }] rows for the format hint
 *   onDownload  — async () => void, fetches + saves the template
 *   onImport    — async (file) => { imported, skipped, errors }
 *   onClose     — () => void
 *   onImported  — async () => void, called after a successful import (refresh)
 */
export default function ImportModal({ title, eyebrow, fields, onDownload, onImport, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function download() {
    setError("");
    try {
      await onDownload();
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
      const imported = await onImport(file);
      setResult(imported);
      await onImported?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal title={title} eyebrow={{ icon: Upload, text: eyebrow }} onClose={onClose} size="lg">
        <form className="aform admin-import" onSubmit={submit}>
          <div className="import-format">
            <strong className="import-format__title">Формат файла (.xlsx)</strong>
            <ul className="import-format__list">
              {fields.map((f) => (
                <li key={f.key}>
                  <code className="import-format__key">{f.key}</code> — {f.desc}
                </li>
              ))}
            </ul>
          </div>

          <Button type="button" variant="soft" icon={Download} onClick={download}>Скачать шаблон</Button>

          <label className="afield">
            <span>Файл Excel</span>
            <input className="ainput" type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); }} />
          </label>

          {error && <p className="aerror">{error}</p>}
          {result && (
            <div className="anotice">
              Добавлено: {result.imported}. Пропущено: {result.skipped}.
              {result.errors?.length ? (
                <div className="import-errors">
                  {result.errors.map((item, i) => (
                    <div key={i}>Строка {item.row}: {item.reason}</div>
                  ))}
                </div>
              ) : ""}
            </div>
          )}

          <div className="aform__actions">
            <Button type="button" variant="soft" onClick={onClose}>Закрыть</Button>
            <Button type="submit" icon={Upload} disabled={busy || !file}>{busy ? "Загрузка…" : "Загрузить"}</Button>
          </div>
        </form>
    </FormModal>
  );
}
