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
    const selected = answer?.selected;
    if (!taskId || submitted.has(taskId) || !Number.isInteger(selected)) {
      return { error: "invalid_answers" };
    }
    submitted.set(taskId, selected);
  }

  const graded = [];
  for (const task of tasks) {
    const selected = submitted.get(task.id);
    if (
      !Number.isInteger(selected) ||
      !Array.isArray(task.options) ||
      selected < 0 ||
      selected >= task.options.length
    ) {
      return { error: "invalid_answers" };
    }
    graded.push({
      taskId: task.id,
      selected,
      correct: task.correctIndex === selected,
      correctIndex: task.correctIndex,
      explanation: task.explanation ?? null,
      topic: task.source === "own" ? null : task.topic ?? null,
    });
  }

  return { graded };
}

module.exports = { assembleHomeworkTasks, gradeHomeworkAnswers };
