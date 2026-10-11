const { normalizeSubject } = require("../subjects");

const FIELD_ALIASES = Object.freeze({
  access: "bot__dostup",
  until: "bot__dostup_do",
  kind: "bot__tip_dostupa",
  subjects: "bot__predmety",
  lastOpened: "bot__posledniy_vhod",
  telegramId: "bot__telegram_id",
  appUserId: "bot__id_polzovatelya",
  lastSync: "bot__poslednyaya_sinhronizaciya",
  error: "bot__oshibka_sinhronizacii",
});
const TAG_NAMES = Object.freeze({ trial: "Пробный период", subscription: "Подписка есть", paid: "Бот оплачен", unpaid: "Бот не оплачен" });
const KNOWN_SUBJECTS = new Set(["Математика", "Русский язык", "Химия", "Физика", "Английский язык"]);
const FIELD_TYPES = Object.freeze({
  access: ["boolean", "checkbox"], until: ["string"], kind: ["select"], subjects: ["select"],
  lastOpened: ["string"], telegramId: ["string"], appUserId: ["string"],
  lastSync: ["string"], error: ["string"],
});

function validateAttributes(attributes) {
  const byAlias = new Map(attributes.map((field) => [field.alias, field]));
  const errors = [];
  for (const [key, allowedTypes] of Object.entries(FIELD_TYPES)) {
    const field = byAlias.get(alias(key));
    if (!field) { if (key !== "error") errors.push(`Missing field: ${alias(key)}`); continue; }
    if (!allowedTypes.includes(field.type)) errors.push(`${field.name} (${field.alias}): expected ${allowedTypes.join("/")}, got ${field.type}`);
  }
  for (const [key, expected] of [["kind", ["Пробный", "Платный"]], ["subjects", [...KNOWN_SUBJECTS]]]) {
    const field = byAlias.get(alias(key));
    if (!field || field.type !== "select") continue;
    const present = new Set((field.variants || []).map((variant) => variant.name));
    for (const name of expected) if (!present.has(name)) errors.push(`${field.name}: missing option ${name}`);
  }
  return { byAlias, errors };
}

function alias(key) {
  return process.env[`MOYKLASS_ATTR_${key.toUpperCase()}`] || FIELD_ALIASES[key];
}

function attribute(user, key) {
  return (user?.attributes || []).find((item) => item.attributeAlias === alias(key));
}

function endOfMinskDay(day) {
  return new Date(`${day}T20:59:59.999Z`);
}

function parseDeadline(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.toISOString().slice(0, 10) !== raw) return null;
    return endOfMinskDay(raw);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(raw)) return null;
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(raw) ? raw : `${raw}+03:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function subjectMap() {
  let configured;
  try { configured = JSON.parse(process.env.MOYKLASS_SUBJECT_MAP || "{}"); }
  catch { throw new Error("MOYKLASS_SUBJECT_MAP must be a JSON object"); }
  if (!configured || Array.isArray(configured) || typeof configured !== "object") {
    throw new Error("MOYKLASS_SUBJECT_MAP must be a JSON object");
  }
  return configured;
}

function parseAccess(user, now = new Date(), subjectVariants = []) {
  const accessValue = attribute(user, "access")?.value;
  const enabled = accessValue === true || accessValue === 1 || accessValue === "true" || accessValue === "1";
  const deadline = parseDeadline(attribute(user, "until")?.value);
  const kindAttr = attribute(user, "kind");
  const kind = kindAttr?.value || null;
  const kindName = typeof kind === "string" ? kind.trim().toLowerCase() : null;
  const trial = kindName === "пробный" || kindName === "trial";
  const paid = kindName === "платный" || kindName === "paid";
  const mapping = subjectMap();
  for (const variant of subjectVariants) mapping[String(variant.id)] = variant.name;
  const subjectAttribute = attribute(user, "subjects");
  const selected = subjectAttribute?.valueId != null ? [subjectAttribute.valueId] : subjectAttribute?.valueIds || [];
  const subjects = [];
  for (const id of selected) {
    const mapped = mapping[String(id)];
    const canonical = mapped ? normalizeSubject(mapped) : null;
    if (!KNOWN_SUBJECTS.has(canonical)) return { enabled, deadline, subjects: [], kind: null, valid: false, error: `Unknown CRM subject variant ID: ${id}` };
    if (!subjects.includes(canonical)) subjects.push(canonical);
  }
  let error = null;
  if (enabled && !deadline) error = "Missing or invalid access deadline";
  else if (enabled && !subjects.length) error = "No subjects selected";
  else if (enabled && !trial && !paid) error = "Missing or unknown access kind";
  const active = enabled && !error && deadline > now;
  return { enabled, deadline, subjects, kind: trial ? "trial" : paid ? "assigned" : null, active, valid: !error, error };
}

function desiredTagNames(access) {
  return access.active
    ? access.kind === "trial" ? [TAG_NAMES.trial] : [TAG_NAMES.subscription, TAG_NAMES.paid]
    : [TAG_NAMES.unpaid];
}

module.exports = { FIELD_ALIASES, TAG_NAMES, alias, attribute, parseDeadline, parseAccess, desiredTagNames, validateAttributes };
