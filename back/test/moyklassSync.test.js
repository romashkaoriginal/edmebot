const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");

const WEBHOOK_SECRET = "s".repeat(40);
const DAY = 24 * 60 * 60 * 1000;
const VARIANTS = {
  kind: [{ id: 279800, name: "Пробный" }, { id: 279801, name: "Платный" }],
  subjects: [
    { id: 279802, name: "Математика" }, { id: 279803, name: "Химия" }, { id: 279804, name: "Физика" },
    { id: 279805, name: "Русский язык" }, { id: 279806, name: "Английский язык" },
  ],
};
const DEFINITIONS = [
  { alias: "bot__dostup", name: "Бот — Доступ", type: "boolean" },
  { alias: "bot__dostup_do", name: "Бот — Доступ до", type: "string" },
  { alias: "bot__tip_dostupa", name: "Бот — Тип доступа", type: "select", variants: VARIANTS.kind },
  { alias: "bot__predmety", name: "Бот — Предметы", type: "select", variants: VARIANTS.subjects },
  { alias: "bot__posledniy_vhod", name: "Бот — Последний вход", type: "string" },
  { alias: "bot__telegram_id", name: "Бот — Telegram ID", type: "string" },
  { alias: "bot__id_polzovatelya", name: "Бот — ID пользователя", type: "string" },
  { alias: "bot__poslednyaya_sinhronizaciya", name: "Бот — Последняя синхронизация", type: "string" },
  { alias: "bot__oshibka_sinhronizacii", name: "Бот — Ошибка синхронизации", type: "string" },
];
const TAGS = ["Пробный период", "Подписка есть", "Бот оплачен", "Бот не оплачен"].map((name, index) => ({ id: 100 + index, name }));

// An in-memory stand-in for the CRM HTTP API; `crm.user.attributes` is what the real card holds.
function createCrm() {
  const crm = {
    definitions: structuredClone(DEFINITIONS),
    user: { id: 10713467, name: "Бабочкин Иван", attributes: [], tags: [] },
    writes: [],
    getUserCalls: 0,
    failGetUserAfter: Infinity,
    failAttributes: false,
    set(alias, fields) {
      const existing = crm.user.attributes.find((item) => item.attributeAlias === alias);
      if (existing) Object.assign(existing, fields);
      else crm.user.attributes.push({ attributeAlias: alias, ...fields });
    },
    value(alias) { return crm.user.attributes.find((item) => item.attributeAlias === alias)?.value; },
  };
  crm.fetch = async (url, init = {}) => {
    const { pathname, search } = new URL(url);
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    const reply = (data, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(data) });
    if (pathname.endsWith("/auth/getToken")) return reply({ accessToken: "t", expiresAt: new Date(Date.now() + 30 * DAY).toISOString() });
    if (pathname.endsWith("/userAttributes")) return crm.failAttributes ? reply({ message: "down" }, 400) : reply(crm.definitions);
    if (pathname.endsWith("/userTags") && method === "GET") return reply(TAGS);
    let match = pathname.match(/\/users\/(\d+)\/attribute\/([^/]+)$/);
    if (match && method === "POST") {
      const alias = decodeURIComponent(match[2]);
      const definition = crm.definitions.find((item) => item.alias === alias);
      const fields = { value: body.value };
      if (body.valueId != null) {
        fields.valueId = body.valueId;
        fields.value = definition.variants.find((variant) => variant.id === body.valueId).name;
      } else if (typeof body.value === "boolean") fields.value = String(body.value);
      crm.set(alias, fields);
      crm.writes.push([alias, body]);
      return reply(null);
    }
    match = pathname.match(/\/users\/(\d+)\/tags$/);
    if (match && method === "POST") {
      crm.user.tags = body.tags.map((id) => TAGS.find((tag) => tag.id === id));
      return reply(null);
    }
    if (/\/users\/\d+$/.test(pathname)) {
      crm.getUserCalls += 1;
      if (crm.getUserCalls > crm.failGetUserAfter) return reply({ message: "boom" }, 400);
      return reply(structuredClone(crm.user));
    }
    if (pathname.endsWith("/users") && search.includes("userIds=")) return reply({ users: [structuredClone(crm.user)] });
    throw new Error(`Unexpected CRM request ${method} ${pathname}`);
  };
  return crm;
}

// Only the SQL the CRM integration issues is understood; anything else fails loudly.
function createDb(overrides = {}) {
  const store = {
    student: {
      id: 7, tg_id: "427373273", name: "Roman", grade: 6, status: "pending", moyklass_user_id: null,
      crm_access_enabled: false, access_until: null, access_kind: null, crm_access_fingerprint: null,
      crm_source_updated_at: null, last_opened_at: null, crm_last_opened_synced_at: null,
      crm_last_error: null, crm_last_synced_at: null, subject: null, ...overrides,
    },
    others: [],
    subjects: [],
    profileComplete: false,
  };
  const handle = async (text, params = []) => {
    const sql = text.replace(/\s+/g, " ").trim();
    if (/^SELECT \* FROM students WHERE id = \$1/.test(sql)) return { rows: [store.student] };
    if (/^SELECT moyklass_user_id FROM students WHERE id/.test(sql)) return { rows: [store.student] };
    if (/^SELECT id FROM students WHERE moyklass_user_id = \$1 AND id <> \$2/.test(sql)) {
      return { rows: store.others.filter((row) => String(row.moyklass_user_id) === String(params[0])) };
    }
    if (/^SELECT id FROM students WHERE moyklass_user_id = \$1/.test(sql)) {
      return { rows: String(store.student.moyklass_user_id) === String(params[0]) ? [store.student] : [] };
    }
    if (/^SELECT id, moyklass_user_id FROM students/.test(sql)) {
      return { rows: store.student.moyklass_user_id ? [store.student] : [] };
    }
    if (/^UPDATE students SET moyklass_user_id/.test(sql)) {
      const free = store.student.moyklass_user_id == null || String(store.student.moyklass_user_id) === String(params[1]);
      if (free) store.student.moyklass_user_id = params[1];
      return { rows: [], rowCount: free ? 1 : 0 };
    }
    if (/^UPDATE students SET crm_access_enabled/.test(sql)) {
      const [, enabled, deadline, kind, status, error, hash, sourceUpdatedAt] = params;
      Object.assign(store.student, {
        crm_access_enabled: enabled, access_until: deadline, access_kind: kind, status,
        crm_last_error: error, crm_access_fingerprint: hash,
        crm_source_updated_at: sourceUpdatedAt ?? store.student.crm_source_updated_at,
      });
      return { rows: [], rowCount: 1 };
    }
    if (/^UPDATE student_profiles SET onboarding_step = 'complete'/.test(sql)) { store.profileComplete = true; return { rows: [], rowCount: 1 }; }
    if (/^DELETE FROM student_subjects/.test(sql)) {
      store.subjects = store.subjects.filter((subject) => params[1].includes(subject));
      return { rows: [], rowCount: 1 };
    }
    if (/^INSERT INTO student_subjects/.test(sql)) {
      if (!store.subjects.includes(params[1])) store.subjects.push(params[1]);
      return { rows: [], rowCount: 1 };
    }
    if (/^UPDATE students SET subject = \$2/.test(sql)) { store.student.subject = params[1]; return { rows: [], rowCount: 1 }; }
    if (/^UPDATE students SET crm_last_error = \$2/.test(sql)) { store.student.crm_last_error = params[1]; return { rows: [], rowCount: 1 }; }
    if (/^UPDATE students SET crm_last_opened_synced_at/.test(sql)) { store.student.crm_last_opened_synced_at = params[1]; return { rows: [], rowCount: 1 }; }
    if (/^UPDATE students SET crm_last_synced_at = now\(\)/.test(sql)) {
      store.student.crm_last_synced_at = new Date();
      store.student.crm_last_error = params[1];
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const db = { query: handle, transaction: async (work) => work({ query: handle }) };
  return { db, store };
}

const quiet = () => {
  const original = console.info;
  console.info = () => {};
  return () => { console.info = original; };
};

function load({ crm = createCrm(), student = {} } = {}) {
  const { db, store } = createDb(student);
  const srcDir = path.join(__dirname, "..", "src");
  const dbPath = require.resolve(path.join(srcDir, "db.js"));
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(srcDir)) delete require.cache[key];
  }
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
  process.env.MOYKLASS_API_KEY = "test-key";
  process.env.MOYKLASS_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const realFetch = global.fetch;
  global.fetch = crm.fetch;
  let integration;
  try { integration = require(path.join(srcDir, "integrations", "moyklass.js")); }
  finally { global.fetch = realFetch; }
  return { crm, store, integration, srcDir };
}

function grant(crm, { until = new Date(Date.now() + DAY).toISOString(), kind = 279800, subject = 279802, access = "true" } = {}) {
  crm.set("bot__dostup", { value: access });
  crm.set("bot__dostup_do", { value: until });
  crm.set("bot__tip_dostupa", { valueId: kind, value: VARIANTS.kind.find((v) => v.id === kind).name });
  crm.set("bot__predmety", { valueId: subject, value: VARIANTS.subjects.find((v) => v.id === subject).name });
}

function link(crm, store) {
  crm.set("bot__telegram_id", { value: store.student.tg_id });
  crm.set("bot__id_polzovatelya", { value: String(store.student.id) });
  store.student.moyklass_user_id = crm.user.id;
}

test("sync turns a trial card into active trial access with subject, tags and write-back", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm);
    link(crm, store);
    await integration.syncStudent(7);
    assert.equal(store.student.status, "active");
    assert.equal(store.student.access_kind, "trial");
    assert.equal(store.student.crm_access_enabled, true);
    assert.equal(store.student.crm_last_error, null);
    assert.deepEqual(store.subjects, ["Математика"]);
    assert.equal(store.student.subject, "Математика");
    assert.equal(store.profileComplete, true);
    assert.deepEqual(crm.user.tags.map((tag) => tag.name), ["Пробный период"]);
    assert.ok(crm.value("bot__poslednyaya_sinhronizaciya"));
  } finally { restore(); }
});

test("paid access gets the subscription tags and a changed subject replaces the old enrollment", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm, { kind: 279801, subject: 279802 });
    link(crm, store);
    await integration.syncStudent(7);
    assert.equal(store.student.access_kind, "assigned");
    assert.deepEqual(crm.user.tags.map((tag) => tag.name).sort(), ["Бот оплачен", "Подписка есть"]);
    grant(crm, { kind: 279801, subject: 279803 });
    await integration.syncStudent(7);
    assert.deepEqual(store.subjects, ["Химия"]);
    assert.equal(store.student.subject, "Химия");
  } finally { restore(); }
});

test("switching access off in the CRM revokes access and marks the card unpaid", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm);
    link(crm, store);
    await integration.syncStudent(7);
    assert.equal(store.student.status, "active");
    crm.set("bot__dostup", { value: "false" });
    await integration.syncStudent(7);
    assert.equal(store.student.status, "pending");
    assert.equal(store.student.crm_access_enabled, false);
    assert.deepEqual(crm.user.tags.map((tag) => tag.name), ["Бот не оплачен"]);
  } finally { restore(); }
});

test("an expired deadline closes the grant in the CRM and keeps the student pending", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm, { until: new Date(Date.now() - 60_000).toISOString() });
    link(crm, store);
    await integration.syncStudent(7);
    assert.equal(store.student.status, "pending");
    assert.equal(crm.value("bot__dostup"), "false");
    assert.deepEqual(crm.user.tags.map((tag) => tag.name), ["Бот не оплачен"]);
  } finally { restore(); }
});

test("extending the deadline of a still-enabled grant keeps access without any other change", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm, { until: new Date(Date.now() + DAY).toISOString() });
    link(crm, store);
    await integration.syncStudent(7);
    const first = store.student.access_until;
    grant(crm, { until: new Date(Date.now() + 10 * DAY).toISOString() });
    await integration.syncStudent(7);
    assert.equal(store.student.status, "active");
    assert.ok(store.student.access_until > first);
  } finally { restore(); }
});

test("after expiry the bot clears the access flag, so a renewal needs the flag switched on again", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm, { until: new Date(Date.now() - 60_000).toISOString() });
    link(crm, store);
    await integration.syncStudent(7);
    assert.equal(crm.value("bot__dostup"), "false");
    // Only the deadline is extended: access stays closed on purpose.
    crm.set("bot__dostup_do", { value: new Date(Date.now() + 10 * DAY).toISOString() });
    await integration.syncStudent(7);
    assert.equal(store.student.status, "pending");
    crm.set("bot__dostup", { value: "true" });
    await integration.syncStudent(7);
    assert.equal(store.student.status, "active");
    assert.deepEqual(crm.user.tags.map((tag) => tag.name), ["Пробный период"]);
  } finally { restore(); }
});

test("a student without a grade cannot become active and the reason is reported to the CRM", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load({ student: { grade: null } });
    grant(crm);
    link(crm, store);
    await integration.syncStudent(7);
    assert.equal(store.student.status, "pending");
    assert.equal(store.student.crm_last_error, "Student grade is missing");
    assert.equal(crm.value("bot__oshibka_sinhronizacii"), "Student grade is missing");
  } finally { restore(); }
});

test("an unknown subject option never grants access and records the error", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm);
    crm.user.attributes.find((item) => item.attributeAlias === "bot__predmety").valueId = 999999;
    link(crm, store);
    await integration.syncStudent(7);
    assert.equal(store.student.status, "pending");
    assert.match(store.student.crm_last_error, /Unknown CRM subject variant ID: 999999/);
  } finally { restore(); }
});

test("identity fields that disagree with the link are rejected without touching access", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm);
    link(crm, store);
    crm.set("bot__telegram_id", { value: "1" });
    await assert.rejects(() => integration.syncStudent(7), /identity fields disagree/);
    assert.equal(store.student.status, "pending");
    assert.match(store.student.crm_last_error, /identity fields disagree/);
  } finally { restore(); }
});

test("options added in the CRM are picked up after the field cache expires", async () => {
  const restore = quiet();
  const realNow = Date.now;
  try {
    const { crm, store, integration } = load();
    grant(crm);
    link(crm, store);
    await integration.syncStudent(7);
    assert.equal(store.student.status, "active");
    const subjects = crm.definitions.find((item) => item.alias === "bot__predmety");
    subjects.variants = [...VARIANTS.subjects, { id: 279900, name: "Информатика" }, { id: 279901, name: "Биология" }];
    // Option 279900 now means "Физика" in the CRM; the cached definitions still do not know it.
    subjects.variants = VARIANTS.subjects.map((variant) => (variant.name === "Физика" ? { id: 279900, name: "Физика" } : variant));
    crm.user.attributes.find((item) => item.attributeAlias === "bot__predmety").valueId = 279900;
    await integration.syncStudent(7);
    assert.match(store.student.crm_last_error, /Unknown CRM subject variant ID: 279900/, "cached fields are still used inside the TTL");
    const later = realNow() + 6 * 60_000;
    Date.now = () => later;
    await integration.syncStudent(7);
    assert.equal(store.student.crm_last_error, null);
    assert.deepEqual(store.subjects, ["Физика"]);
  } finally { Date.now = realNow; restore(); }
});

test("a CRM outage during the field refresh keeps using the last good fields", async () => {
  const restore = quiet();
  const realNow = Date.now;
  try {
    const { crm, store, integration } = load();
    grant(crm);
    link(crm, store);
    await integration.syncStudent(7);
    crm.failAttributes = true;
    const later = realNow() + 6 * 60_000;
    Date.now = () => later;
    await integration.syncStudent(7);
    assert.equal(store.student.status, "active");
    assert.equal(store.student.crm_last_error, null);
  } finally { Date.now = realNow; restore(); }
});

test("a changed, invalid field set stops syncing instead of being trusted", async () => {
  const restore = quiet();
  const realNow = Date.now;
  try {
    const { crm, store, integration } = load();
    grant(crm);
    link(crm, store);
    await integration.syncStudent(7);
    crm.definitions = crm.definitions.filter((item) => item.alias !== "bot__dostup_do");
    const later = realNow() + 6 * 60_000;
    Date.now = () => later;
    await assert.rejects(() => integration.syncStudent(7), /CRM fields invalid: Missing field: bot__dostup_do/);
    assert.match(store.student.crm_last_error, /CRM fields invalid/);
  } finally { Date.now = realNow; restore(); }
});

test("binding writes identity into the CRM and links the student", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm);
    const result = await integration.bindStudent(7, crm.user.id);
    assert.deepEqual(result, { synced: true });
    assert.equal(store.student.moyklass_user_id, crm.user.id);
    assert.equal(crm.value("bot__telegram_id"), "427373273");
    assert.equal(crm.value("bot__id_polzovatelya"), "7");
    assert.equal(store.student.status, "active");
  } finally { restore(); }
});

test("binding refuses a card that belongs to another Telegram account or student", async () => {
  const restore = quiet();
  try {
    let loaded = load();
    loaded.crm.set("bot__telegram_id", { value: "999" });
    await assert.rejects(() => loaded.integration.bindStudent(7, loaded.crm.user.id), /crm_telegram_id_conflict/);
    assert.equal(loaded.store.student.moyklass_user_id, null);

    loaded = load();
    loaded.crm.set("bot__id_polzovatelya", { value: "55" });
    await assert.rejects(() => loaded.integration.bindStudent(7, loaded.crm.user.id), /crm_app_user_id_conflict/);

    loaded = load();
    loaded.store.others.push({ id: 8, moyklass_user_id: loaded.crm.user.id });
    await assert.rejects(() => loaded.integration.bindStudent(7, loaded.crm.user.id), /crm_user_already_linked/);
    assert.equal(loaded.crm.writes.length, 0, "a refused bind must not write to the CRM");

    loaded = load({ student: { moyklass_user_id: 12345 } });
    await assert.rejects(() => loaded.integration.bindStudent(7, loaded.crm.user.id), /student_already_linked/);
  } finally { restore(); }
});

test("a failed first sync after binding still reports the link as made", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm);
    // bindStudent reads the card once; the sync that follows gets an error.
    crm.failGetUserAfter = 1;
    const result = await integration.bindStudent(7, crm.user.id);
    assert.deepEqual(result, { synced: false });
    assert.equal(store.student.moyklass_user_id, crm.user.id);
    assert.match(store.student.crm_last_error, /CRM request failed: 400/);
  } finally { restore(); }
});

test("reconciliation applies CRM changes to linked students", async () => {
  const restore = quiet();
  try {
    const { crm, store, integration } = load();
    grant(crm);
    link(crm, store);
    await integration.reconcile();
    assert.equal(store.student.status, "active");
    crm.set("bot__dostup", { value: "false" });
    await integration.reconcile();
    assert.equal(store.student.status, "pending");
  } finally { restore(); }
});

async function withServer(loaded, run) {
  const router = require(path.join(loaded.srcDir, "routes", "moyklass.js"));
  const app = express();
  app.use(express.json());
  app.use("/api/moyklass", router);
  const server = await new Promise((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  try { await run(`http://127.0.0.1:${server.address().port}/api/moyklass`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("condition was not met in time");
}

test("webhook rejects a wrong secret and applies user changes for a valid one", async () => {
  const restore = quiet();
  try {
    const loaded = load();
    grant(loaded.crm);
    link(loaded.crm, loaded.store);
    await withServer(loaded, async (base) => {
      const post = (secret, body) => fetch(`${base}/webhook/${secret}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const event = { event: "user_changed", object: { userId: loaded.crm.user.id } };
      assert.equal((await post("x".repeat(40), event)).status, 404);
      assert.equal((await post("short", event)).status, 404);
      assert.equal((await post(WEBHOOK_SECRET, { event: "lesson_new", object: { userId: loaded.crm.user.id } })).status, 202);
      assert.equal(loaded.store.student.status, "pending", "unrelated events must not sync");
      assert.equal((await post(WEBHOOK_SECRET, { event: "user_changed", object: { userId: null } })).status, 202);
      assert.equal((await post(WEBHOOK_SECRET, event)).status, 202);
      await waitFor(() => loaded.store.student.status === "active");
    });
  } finally { restore(); }
});
