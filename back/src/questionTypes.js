const TYPES = new Set(["choice", "text", "blanks"]);

function normalizeAnswer(value) {
  return String(value).normalize("NFKC").trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ").toLocaleLowerCase("en-US").replace(/[.?!]+$/, "");
}

function cleanQuestionAnswer(body) {
  const questionType = body?.questionType ?? body?.question_type ?? "choice";
  if (!TYPES.has(questionType)) return { error: "invalid_question_type" };
  if (questionType === "choice") {
    const options = Array.isArray(body?.options) ? body.options.map((value) => String(value ?? "").trim()) : [];
    const correct = Number(body?.correct);
    if (options.length < 2 || options.length > 6 || options.some((value) => !value || value.length > 1000)) return { error: "invalid_options" };
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return { error: "correct_index_out_of_range" };
    return { value: { questionType, options, correct, acceptedAnswers: [] } };
  }
  const options = [];
  const correct = 0;
  const acceptedAnswers = Array.isArray(body?.acceptedAnswers) ? body.acceptedAnswers : [];
  if (acceptedAnswers.length < 1 || acceptedAnswers.length > (questionType === "text" ? 1 : 12)) return { error: "invalid_accepted_answers" };
  if (questionType === "blanks" && (String(body?.prompt ?? "").match(/_/g) ?? []).length !== acceptedAnswers.length) return { error: "blank_count_mismatch" };
  const clean = [];
  for (const variants of acceptedAnswers) {
    if (!Array.isArray(variants) || variants.length < 1 || variants.length > 10) return { error: "invalid_accepted_answers" };
    const values = variants.map((value) => String(value ?? "").trim());
    if (values.some((value) => !value || value.length > 500) || new Set(values.map(normalizeAnswer)).size !== values.length) return { error: "invalid_accepted_answers" };
    clean.push(values);
  }
  return { value: { questionType, options, correct, acceptedAnswers: clean } };
}

function gradeAnswer(task, submitted) {
  const type = task.questionType ?? task.question_type ?? "choice";
  if (type === "choice") {
    const selected = submitted?.selected;
    if (!Number.isInteger(selected) || selected < 0 || (Array.isArray(task.options) && selected >= task.options.length)) return { error: "invalid_answers" };
    return { selected, correct: selected === Number(task.correctIndex ?? task.correct) };
  }
  const answer = submitted?.answer;
  const values = type === "text" && typeof answer === "string" ? [answer] : answer;
  if (!Array.isArray(values) || values.length !== task.acceptedAnswers?.length || values.some((value) => typeof value !== "string" || !value.trim() || value.length > 500)) return { error: "invalid_answers" };
  return {
    answer: values,
    selected: -1,
    correct: values.every((value, index) => task.acceptedAnswers[index].some((accepted) => normalizeAnswer(value) === normalizeAnswer(accepted))),
  };
}

module.exports = { cleanQuestionAnswer, gradeAnswer, normalizeAnswer };
