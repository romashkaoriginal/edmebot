// Shared answer logic for the run screens (practice, homework, diagnostic).
// Pure functions only, so they stay testable under `node --test`.

const WRITTEN_TYPES = ["text", "blanks", "order", "match"];

export function isWritten(task) {
  return WRITTEN_TYPES.includes(task?.questionType);
}

/** True once the student has given enough of an answer to be checked. */
export function isAnswerComplete(task, value) {
  switch (task?.questionType) {
    case "text":
      return typeof value === "string" && value.trim().length > 0;
    case "blanks":
      return Array.isArray(value) && value.length === (task.blankCount || 1) && value.every((item) => String(item ?? "").trim());
    case "order":
      return Array.isArray(value) && value.length === (task.options?.length ?? 0) && value.length > 0;
    case "match":
      return Array.isArray(value) && (task.options?.length ?? 0) > 0 && task.options.every((_, index) => !!value[index]);
    default:
      return Number.isInteger(value);
  }
}

/** Loose comparison used only to colour individual blanks/pairs after grading. */
export function sameAnswer(left, right) {
  const clean = (value) => String(value ?? "").normalize("NFKC").trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ").toLocaleLowerCase("en-US").replace(/[.?!]+$/, "");
  return clean(left) === clean(right);
}

/**
 * Per-part verdicts for blanks and pairs: [true, false, ...] or null when the
 * server has not told us the accepted answers (e.g. homework before submit).
 */
export function partVerdicts(graded, values, acceptedAnswers) {
  if (graded === "correct") return values.map(() => true);
  if (graded !== "wrong" || !Array.isArray(acceptedAnswers)) return null;
  return values.map((value, index) => (acceptedAnswers[index] ?? []).some((accepted) => sameAnswer(value, accepted)));
}

/** Human-readable correct answer shown after a wrong attempt. */
export function correctAnswerText(task, { correctIndex, acceptedAnswers } = {}) {
  if (!isWritten(task)) {
    return Number.isInteger(correctIndex) ? task?.options?.[correctIndex] ?? "" : "";
  }
  if (!Array.isArray(acceptedAnswers) || !acceptedAnswers.length) return "";
  if (task.questionType === "match") {
    return acceptedAnswers.map((variants, index) => `${task.options?.[index] ?? ""} — ${variants[0]}`).join("; ");
  }
  return acceptedAnswers.map((variants) => variants.join(" / ")).join("; ");
}

/** Number of correct answers in a row ending at `index`. */
export function comboAt(marks, index) {
  let combo = 0;
  for (let i = index; i >= 0 && marks[i] === "correct"; i -= 1) combo += 1;
  return combo;
}

/** Confetti is a rare celebration: 3 in a row, then every 5th. */
export function isComboMilestone(combo) {
  return combo === 3 || (combo >= 5 && combo % 5 === 0);
}

const PRAISE = ["Верно!", "Точно!", "Отлично!", "Так держать!", "В точку!"];
const NOT_YET = ["Пока не так", "Почти получилось", "Разберём ошибку"];

/** Varied but stable per question, so the title never changes on re-render. */
export function feedbackTitle(status, seed = 0, { skipped = false } = {}) {
  if (status === "correct") return PRAISE[Math.abs(seed) % PRAISE.length];
  if (status === "answered") return "Ответ записан";
  if (skipped) return "Пропущено";
  return NOT_YET[Math.abs(seed) % NOT_YET.length];
}

export function answerPrompt(task) {
  return {
    text: "Напиши ответ",
    blanks: "Заполни пропуски",
    order: "Собери предложение из слов",
    match: "Соедини пары",
  }[task?.questionType] ?? "Выбери ответ";
}
