const db = require("../db");
const { SUBJECT_VARIANTS } = require("../subjects");

const MIN_DIAGNOSTIC_QUESTIONS = 5;
const DIAGNOSTIC_GRADES = [5, 6, 7, 8, 9, 10, 11];
const DIAGNOSTIC_SUBJECTS = SUBJECT_VARIANTS.map(({ canonical }) => canonical);

async function getDiagnosticAvailability(executor = db) {
  const { rows } = await executor.query(
    `SELECT grade, subject, COUNT(*)::int AS question_count
       FROM tasks
      WHERE question_type = 'choice'
      GROUP BY grade, subject`
  );
  const counts = new Map(rows.map((row) => [`${row.grade}:${row.subject}`, row.question_count]));
  const combinations = DIAGNOSTIC_GRADES.flatMap((grade) => DIAGNOSTIC_SUBJECTS.map((subject) => {
    const questionCount = counts.get(`${grade}:${subject}`) ?? 0;
    return {
      grade,
      subject,
      questionCount,
      ready: questionCount >= MIN_DIAGNOSTIC_QUESTIONS,
    };
  }));

  return {
    minimumQuestions: MIN_DIAGNOSTIC_QUESTIONS,
    grades: DIAGNOSTIC_GRADES,
    subjects: DIAGNOSTIC_SUBJECTS,
    combinations,
  };
}

module.exports = { MIN_DIAGNOSTIC_QUESTIONS, getDiagnosticAvailability };
