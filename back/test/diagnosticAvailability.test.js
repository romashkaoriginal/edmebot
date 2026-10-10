const test = require("node:test");
const assert = require("node:assert/strict");
const { getDiagnosticAvailability, MIN_DIAGNOSTIC_QUESTIONS } = require("../src/utils/diagnosticAvailability");

test("diagnostic availability marks only combinations with the required question count", async () => {
  let sql = "";
  const result = await getDiagnosticAvailability({
    query: async (query) => {
      sql = query;
      return {
        rows: [
          { grade: 5, subject: "Английский язык", question_count: MIN_DIAGNOSTIC_QUESTIONS },
          { grade: 6, subject: "Математика", question_count: MIN_DIAGNOSTIC_QUESTIONS - 1 },
          { grade: 7, subject: "Физика", question_count: 10 },
        ],
      };
    },
  });

  assert.match(sql, /question_type = 'choice'/);
  assert.equal(result.minimumQuestions, 5);
  assert.equal(result.combinations.length, result.grades.length * result.subjects.length);
  assert.deepEqual(
    result.combinations.find((item) => item.grade === 5 && item.subject === "Английский язык"),
    { grade: 5, subject: "Английский язык", questionCount: 5, ready: true }
  );
  assert.equal(result.combinations.find((item) => item.grade === 6 && item.subject === "Математика").ready, false);
  assert.equal(result.combinations.find((item) => item.grade === 7 && item.subject === "Физика").ready, true);
  assert.equal(result.combinations.find((item) => item.grade === 5 && item.subject === "Математика").questionCount, 0);
});
