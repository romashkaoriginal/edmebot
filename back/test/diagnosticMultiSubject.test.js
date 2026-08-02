const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const Module = require("node:module");
const state = require("../src/studentState");

// A student enrolled in two subjects must get one diagnostic covering both,
// rather than being sent back to a subject picker after the first test.
function loadRouter({ enrollments, capture }) {
  const originalLoad = Module._load;
  const makeTask = (id, subject) => ({
    id, topic: `${subject}-topic`, subject, prompt: "p",
    options: ["верно", "нет", "тоже нет", "и это нет"], hints: [],
    correctIndex: 0, correct: 0, explanation: "e",
  });
  const handle = async (text, params) => {
    if (/FROM student_subjects/.test(text)) return { rows: enrollments, rowCount: enrollments.length };
    if (/FROM tasks WHERE grade/.test(text)) {
      const subject = params[1];
      const base = subject === "Математика" ? 100 : 200;
      return { rows: Array.from({ length: 10 }, (_, i) => makeTask(base + i, subject)), rowCount: 10 };
    }
    if (/INSERT INTO diagnostic_sessions/.test(text)) {
      if (capture) capture.questionIds = JSON.parse(params[3]);
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  Module._load = function (request) {
    if (request === "../db") return { query: handle, transaction: async (fn) => fn({ query: handle }) };
    if (request === "../studentState") {
      return { getState: async () => ({ profile: { onboardingStep: "diagnostic" }, topics: [] }), submitDiagnostic: async () => {} };
    }
    if (request === "../middleware/auth") {
      return { requireStudent: (req, _res, next) => { req.student = { id: 1, subject: "Математика", grade: 7, status: "pending" }; next(); } };
    }
    return originalLoad.apply(this, arguments);
  };
  delete require.cache[require.resolve("../src/routes/diagnostic.js")];
  const router = require("../src/routes/diagnostic.js");
  Module._load = originalLoad;
  const app = express();
  app.use(express.json());
  app.use("/api/diagnostic", router);
  return app;
}

async function get(app, path) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

test("two enrolled subjects produce one 20-question diagnostic", async () => {
  const capture = {};
  const app = loadRouter({
    enrollments: [{ subject: "Математика", grade: 7 }, { subject: "Русский", grade: 7 }],
    capture,
  });
  const { status, body } = await get(app, "/api/diagnostic/");
  assert.equal(status, 200);
  assert.equal(body.questions.length, 20, "10 questions per subject in a single run");
  assert.deepEqual(body.subjects.sort(), ["Математика", "Русский"]);
  assert.equal(capture.questionIds.length, 20, "the session records every question");
  const bySubject = body.questions.reduce((acc, q) => {
    acc[q.subject] = (acc[q.subject] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(bySubject, { "Математика": 10, "Русский": 10 });
});

test("a single enrolled subject still gets a 10-question diagnostic", async () => {
  const app = loadRouter({ enrollments: [{ subject: "Математика", grade: 7 }] });
  const { body } = await get(app, "/api/diagnostic/");
  assert.equal(body.questions.length, 10);
  assert.deepEqual(body.subjects, ["Математика"]);
});

test("?subject= narrows the run to one subject for a retake", async () => {
  const app = loadRouter({ enrollments: [{ subject: "Русский", grade: 7 }] });
  const { body } = await get(app, `/api/diagnostic/?subject=${encodeURIComponent("Русский")}`);
  assert.equal(body.questions.length, 10);
  assert.deepEqual(body.subjects, ["Русский"]);
});

test("submitting a mixed diagnostic maps every topic to its own subject", async () => {
  const calls = [];
  const executor = {
    async query(text, params) {
      calls.push({ text: String(text).trim().split("\n")[0], params });
      return { rows: [], rowCount: 1 };
    },
  };
  const student = { id: 1, status: "pending", subject: "Математика", grade: 7 };
  const questions = [
    { id: 100, subject: "Математика", topic: "fractions", correct: 0 },
    { id: 200, subject: "Русский", topic: "spelling", correct: 1 },
  ];
  await state.submitDiagnostic(
    student,
    [{ id: 100, selected: 0, usedHelp: false }, { id: 200, selected: 0, usedHelp: false }],
    "Математика",
    questions,
    executor
  );
  const upserts = calls.filter((call) => call.text.includes("INSERT INTO student_topics"));
  assert.equal(upserts.length, 2, "records a topic for each subject");
  // params: [student_id, subject, topic_id, ...]
  const pairs = upserts.map((call) => [call.params[1], call.params[2]]).sort();
  assert.deepEqual(pairs, [["Математика", "fractions"], ["Русский", "spelling"]]);
});
