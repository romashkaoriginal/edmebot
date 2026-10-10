const { gradeAnswer } = require("./questionTypes");

function assembleHomeworkTasks(homework, bankRows, ownRows) {
  const taskIds = Array.isArray(homework.task_ids) ? homework.task_ids : [];
  const bankById = new Map(bankRows.map((task) => [String(task.id), task]));

  const bankTasks = taskIds
    .map((id) => bankById.get(String(id)))
    .filter(Boolean)
    .map((task) => ({
      ...task,
      id: String(task.id),
      correctIndex: Number(task.correctIndex ?? task.correct),
      questionType: task.questionType ?? task.question_type ?? "choice",
      acceptedAnswers: task.acceptedAnswers ?? task.accepted_answers ?? [],
      source: "bank",
    }));

  const ownTasks = ownRows.map((question) => ({
    id: `hq-${question.id}`,
    topic: null,
    subject: homework.subject,
    prompt: question.prompt,
    options: question.options,
    difficulty: "medium",
    hints: [],
    correctIndex: Number(question.correctIndex ?? question.correct),
    questionType: question.questionType ?? question.question_type ?? "choice",
    acceptedAnswers: question.acceptedAnswers ?? question.accepted_answers ?? [],
    explanation: question.explanation ?? null,
    source: "own",
  }));

  return [...bankTasks, ...ownTasks];
}

function gradeHomeworkAnswers(tasks, answers) {
  if (!Array.isArray(answers) || answers.length !== tasks.length) {
    return { error: "invalid_answers" };
  }

  const submitted = new Map();
  for (const answer of answers) {
    const taskId = String(answer?.taskId ?? "");
    if (!taskId || submitted.has(taskId)) {
      return { error: "invalid_answers" };
    }
    submitted.set(taskId, answer);
  }

  const graded = [];
  for (const task of tasks) {
    const result = gradeAnswer(task, submitted.get(task.id));
    if (result.error) return { error: "invalid_answers" };
    graded.push({
      taskId: task.id,
      selected: result.selected,
      answer: result.answer,
      correct: result.correct,
      correctIndex: task.questionType === "choice" ? task.correctIndex : null,
      acceptedAnswers: task.questionType === "choice" ? undefined : task.acceptedAnswers,
      explanation: task.explanation ?? null,
      topic: task.source === "own" ? null : task.topic ?? null,
    });
  }

  return { graded };
}

module.exports = { assembleHomeworkTasks, gradeHomeworkAnswers };
