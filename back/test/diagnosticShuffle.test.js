const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const Module = require("node:module");

// Load the diagnostic router against stubbed db/auth so the route's real
// shuffling and grading logic can be exercised over HTTP.
function loadRouter({ optionOrders, capture }) {
  const originalLoad = Module._load;
  const task = {
    id: 7, topic: "functions", subject: "Математика", prompt: "p",
    options: ["верно", "нет", "тоже нет", "и это нет"], hints: [],
    correctIndex: 0, correct: 0, explanation: "e",
  };
  const handle = async (text, params) => {
    if (/FROM student_subjects/.test(text)) return { rows: [{ grade: 7 }], rowCount: 1 };
    if (/FROM tasks WHERE grade/.test(text)) {
      return { rows: Array.from({ length: 10 }, (_, i) => ({ ...task, id: 7 + i })), rowCount: 10 };
    }
    if (/INSERT INTO diagnostic_sessions/.test(text)) {
      if (capture) capture.optionOrders = JSON.parse(params[4]);
      return { rows: [], rowCount: 1 };
    }
    if (/FROM diagnostic_sessions/.test(text)) {
      return { rows: [{ option_orders: optionOrders }], rowCount: 1 };
    }
    if (/FROM tasks WHERE id = \$1/.test(text)) return { rows: [task], rowCount: 1 };
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

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test("diagnostic serves options in a shuffled order, not storage order", async () => {
  const capture = {};
  const app = loadRouter({ optionOrders: null, capture });
  const body = await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/diagnostic/?subject=${encodeURIComponent("Математика")}`);
    assert.equal(res.status, 200);
    return res.json();
  });
  assert.equal(body.questions.length, 10);
  for (const question of body.questions) {
    const order = capture.optionOrders[String(question.id)];
    assert.ok(Array.isArray(order), "stores an order per question");
    // The option shown at correctIndex must be the stored correct answer.
    assert.equal(question.options[question.correctIndex], "верно");
  }
  // Across ten questions the answer must not sit in position 0 every time.
  assert.ok(
    body.questions.some((question) => question.correctIndex !== 0),
    "correct answer is not always the first option"
  );
});

test("check grades the shuffled position the student saw", async () => {
  // Stored option 0 is correct and was shown in position 2.
  const app = loadRouter({ optionOrders: { 7: [1, 3, 0, 2] } });
  const [right, wrong] = await withServer(app, async (base) => {
    const post = (selected) => fetch(`${base}/api/diagnostic/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: 7, sessionId: "3b1f2c9a-1111-4222-8333-444455556666", selected }),
    }).then((res) => res.json());
    return Promise.all([post(2), post(0)]);
  });
  assert.equal(right.correct, true, "position 2 holds the correct answer");
  assert.equal(right.correctIndex, 2, "correct index reported in shown coordinates");
  assert.equal(wrong.correct, false, "position 0 holds a wrong answer");
});

test("check still grades sessions created before shuffling", async () => {
  const app = loadRouter({ optionOrders: null });
  const body = await withServer(app, async (base) => fetch(`${base}/api/diagnostic/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: 7, sessionId: "3b1f2c9a-1111-4222-8333-444455556666", selected: 0 }),
  }).then((res) => res.json()));
  assert.equal(body.correct, true);
  assert.equal(body.correctIndex, 0);
});
