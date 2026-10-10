const TYPES = new Set(["choice", "text", "blanks", "order", "match"]);

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
  let options = [];
  const correct = 0;
  const acceptedAnswers = Array.isArray(body?.acceptedAnswers) ? body.acceptedAnswers : [];
  if (acceptedAnswers.length < 1 || acceptedAnswers.length > (["text", "order"].includes(questionType) ? 1 : 12)) return { error: "invalid_accepted_answers" };
  if (questionType === "blanks" && (String(body?.prompt ?? "").match(/_/g) ?? []).length !== acceptedAnswers.length) return { error: "blank_count_mismatch" };
  const clean = [];
  for (const variants of acceptedAnswers) {
    if (!Array.isArray(variants) || variants.length < 1 || variants.length > 10) return { error: "invalid_accepted_answers" };
    const values = variants.map((value) => String(value ?? "").trim());
    if (values.some((value) => !value || value.length > 500) || new Set(values.map(normalizeAnswer)).size !== values.length) return { error: "invalid_accepted_answers" };
    clean.push(values);
  }
  if (questionType === "order") {
    options = clean[0][0].split(/\s+/);
    if (options.length < 2 || options.length > 24 || clean[0].some((variant) => JSON.stringify(variant.split(/\s+/).sort()) !== JSON.stringify([...options].sort()))) return { error: "invalid_word_bank" };
  }
  if (questionType === "match") {
    options = Array.isArray(body.options) ? body.options.map((item) => String(item ?? "").trim()) : [];
    if (options.length < 2 || options.length > 8 || options.length !== clean.length || options.some((item) => !item || item.length > 200) || new Set(options.map(normalizeAnswer)).size !== options.length || clean.some((variants) => variants.length !== 1) || new Set(clean.map((variants) => normalizeAnswer(variants[0]))).size !== clean.length) return { error: "invalid_pairs" };
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
  if (type === "order") {
    if (!Array.isArray(answer) || answer.length !== task.options?.length || answer.some((word) => typeof word !== "string") || JSON.stringify([...answer].sort()) !== JSON.stringify([...task.options].sort())) return { error: "invalid_answers" };
    return { answer, selected: -1, correct: task.acceptedAnswers[0].some((variant) => normalizeAnswer(answer.join(" ")) === normalizeAnswer(variant)) };
  }
  const values = type === "text" && typeof answer === "string" ? [answer] : answer;
  if (!Array.isArray(values) || values.length !== task.acceptedAnswers?.length || values.some((value) => typeof value !== "string" || !value.trim() || value.length > 500)) return { error: "invalid_answers" };
  return {
    answer: values,
    selected: -1,
    correct: values.every((value, index) => task.acceptedAnswers[index].some((accepted) => normalizeAnswer(value) === normalizeAnswer(accepted))),
  };
}

module.exports = { cleanQuestionAnswer, gradeAnswer, normalizeAnswer };
