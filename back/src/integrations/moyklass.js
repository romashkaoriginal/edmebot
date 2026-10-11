const crypto = require("crypto");
const db = require("../db");
const { MoyklassClient } = require("./moyklassClient");
const { TAG_NAMES, alias, attribute, parseAccess, desiredTagNames } = require("./moyklassAccess");
const { logEvent } = require("../utils/eventLog");

const client = new MoyklassClient();
let running = false;
let timer = null;
let fieldsPromise = null;
const pendingSyncs = new Map();
const MANAGED_TAGS = new Set(Object.values(TAG_NAMES));

function isEnabled() { return client.enabled; }

async function fields() {
  if (!fieldsPromise) {
    fieldsPromise = client.getAttributes().then((all) => {
      const byAlias = new Map(all.map((item) => [item.alias, item]));
      const required = ["access", "until", "kind", "subjects", "lastOpened", "telegramId", "appUserId", "lastSync"];
      const missing = required.filter((key) => !byAlias.has(alias(key)));
      if (missing.length) throw new Error(`CRM attributes missing: ${missing.join(", ")}`);
      const expected = { access: ["checkbox", "boolean"], until: ["date", "string"], kind: ["select"], subjects: ["select"], lastOpened: ["string"], telegramId: ["string", "number", "unique"], appUserId: ["string", "number", "unique"], lastSync: ["string"] };
      for (const [key, types] of Object.entries(expected)) {
        if (!types.includes(byAlias.get(alias(key)).type)) throw new Error(`CRM attribute ${alias(key)} must be ${types.join("/")}`);
      }
      if (byAlias.has(alias("error")) && byAlias.get(alias("error")).type !== "string") {
        throw new Error(`CRM attribute ${alias("error")} must be string`);
      }
      return byAlias;
    }).catch((error) => { fieldsPromise = null; throw error; });
  }
  return fieldsPromise;
}

function crmId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function identityValue(user, key) {
  const value = attribute(user, key)?.value;
  return value == null || value === "" ? null : String(value);
}

async function ensureTags() {
  const all = await client.getTags();
  const byName = new Map(all.map((tag) => [tag.name, tag.id]));
  for (const name of MANAGED_TAGS) {
    if (!byName.has(name)) {
      const created = await client.createTag(name);
      byName.set(name, created.id);
    }
  }
  return byName;
}

async function syncTags(user, access) {
  const desired = desiredTagNames(access);
  const present = new Set((user.tags || []).filter((tag) => MANAGED_TAGS.has(tag.name)).map((tag) => tag.name));
  if (desired.length === present.size && desired.every((name) => present.has(name))) return;
  const ids = await ensureTags();
  const keep = (user.tags || []).filter((tag) => !MANAGED_TAGS.has(tag.name)).map((tag) => tag.id);
  await client.setTags(user.id, [...new Set([...keep, ...desired.map((name) => ids.get(name))])]);
}

function fingerprint(access) {
  return crypto.createHash("sha256").update(JSON.stringify({
    enabled: access.enabled,
    until: access.deadline?.toISOString() || null,
    kind: access.kind,
    subjects: [...access.subjects].sort(),
  })).digest("hex");
}

async function recordError(studentId, error) {
  const message = String(error.message || error).slice(0, 240);
  await db.query("UPDATE students SET crm_last_error = $2 WHERE id = $1", [studentId, message]).catch(() => {});
  logEvent("crm_sync_failed", null, { studentId, message });
  return message;
}

async function applyUser(user, studentId) {
  const definitions = await fields();
  const access = parseAccess(user, new Date(), definitions.get(alias("subjects"))?.variants || []);
  const hash = fingerprint(access);
  const parsedUpdatedAt = user.updatedAt ? new Date(user.updatedAt) : null;
  const sourceUpdatedAt = parsedUpdatedAt && !Number.isNaN(parsedUpdatedAt.getTime()) ? parsedUpdatedAt : null;
  let changed = false;
  const rows = await db.transaction(async (connection) => {
    const current = (await connection.query("SELECT * FROM students WHERE id = $1 FOR UPDATE", [studentId])).rows[0];
    if (!current || String(current.moyklass_user_id) !== String(user.id)) return [];
    if (sourceUpdatedAt && current.crm_source_updated_at && sourceUpdatedAt < current.crm_source_updated_at) return [];
    const remoteTelegramId = identityValue(user, "telegramId");
    const remoteAppId = identityValue(user, "appUserId");
    if (remoteTelegramId !== String(current.tg_id) || remoteAppId !== String(current.id)) {
      throw new Error("CRM identity fields disagree with the existing link");
    }
    const grade = current.grade;
    const valid = access.valid && (!access.enabled || (grade && grade >= 6 && grade <= 11));
    const active = valid && access.active;
    access.active = active;
    const error = valid ? null : access.error || "Student grade is missing";
    access.error = error;
    changed = current.crm_access_fingerprint !== hash;
    await connection.query(
      `UPDATE students SET crm_access_enabled = $2, access_until = $3,
         access_kind = $4, status = $5,
         crm_last_error = $6, crm_access_fingerprint = $7,
         crm_source_updated_at = COALESCE($8, crm_source_updated_at)
       WHERE id = $1`,
      [studentId, access.enabled, access.deadline, access.kind, active ? "active" : "pending", error, hash, sourceUpdatedAt]
    );
    if (active) {
      await connection.query(
        "UPDATE student_profiles SET onboarding_step = 'complete', updated_at = now() WHERE student_id = $1",
        [studentId]
      );
    }
    // CRM is authoritative for enrollment. Removing a subject leaves attempts,
    // homework and mastery history intact; only its active enrollment is gone.
    await connection.query(
      "DELETE FROM student_subjects WHERE student_id = $1 AND NOT (subject = ANY($2::text[]))",
      [studentId, access.subjects]
    );
    if (grade) {
      for (const subject of access.subjects) {
        await connection.query(
          `INSERT INTO student_subjects (student_id, subject, grade) VALUES ($1,$2,$3)
           ON CONFLICT (student_id, subject) DO NOTHING`,
          [studentId, subject, grade]
        );
      }
      await connection.query(
        `UPDATE students SET subject = $2 WHERE id = $1`,
        [studentId, access.subjects[0] || null]
      );
    }
    return [current];
  });
  if (!rows.length) return;
  if (changed) {
    logEvent("crm_access_changed", null, {
      studentId,
      status: active ? "active" : "pending",
      accessEnabled: access.enabled,
      accessKind: access.kind,
      accessUntil: access.deadline?.toISOString() ?? null,
      subjects: access.subjects,
      reason: access.error,
    });
  }
  // Re-read before closing an expired grant: an operator could have extended it
  // between the first GET and this write.
  if (access.enabled && access.deadline && access.deadline <= new Date()) {
    const latest = await client.getUser(user.id);
    const currentAccess = parseAccess(latest, new Date(), definitions.get(alias("subjects"))?.variants || []);
    if (currentAccess.deadline?.getTime() !== access.deadline.getTime() || currentAccess.enabled !== access.enabled) {
      return applyUser(latest, studentId);
    }
    if (currentAccess.enabled && currentAccess.deadline && currentAccess.deadline <= new Date()) {
      await client.setAttribute(user.id, alias("access"), { value: false });
      access.enabled = false;
      access.active = false;
      user = await client.getUser(user.id);
    }
  }
  await syncTags(user, access);
  const localOpened = rows[0].last_opened_at;
  const sentOpened = rows[0].crm_last_opened_synced_at;
  const remoteOpened = attribute(user, "lastOpened")?.value;
  const remoteTime = remoteOpened ? new Date(remoteOpened).getTime() : 0;
  if (localOpened && (!sentOpened || localOpened > sentOpened) && localOpened.getTime() > remoteTime) {
    await client.setAttribute(user.id, alias("lastOpened"), { value: localOpened.toISOString() });
    await db.query("UPDATE students SET crm_last_opened_synced_at = $2 WHERE id = $1", [studentId, localOpened]);
  }
  if (definitions.has(alias("error")) && (attribute(user, "error")?.value || "") !== (access.error || "")) {
    await client.setAttribute(user.id, alias("error"), { value: access.error || "" });
  }
  const lastSyncValue = attribute(user, "lastSync")?.value;
  const lastSyncTime = lastSyncValue ? new Date(lastSyncValue).getTime() : 0;
  if (changed || !Number.isFinite(lastSyncTime) || Date.now() - lastSyncTime >= 5 * 60_000) {
    await client.setAttribute(user.id, alias("lastSync"), { value: new Date().toISOString() });
  }
  await db.query("UPDATE students SET crm_last_synced_at = now(), crm_last_error = $2 WHERE id = $1", [studentId, access.error || null]);
}

async function performSync(studentId) {
  if (!isEnabled()) throw new Error("MOYKLASS_API_KEY is not configured");
  try {
    await fields();
    const student = (await db.query("SELECT moyklass_user_id FROM students WHERE id = $1", [studentId])).rows[0];
    if (!student?.moyklass_user_id) return;
    await applyUser(await client.getUser(student.moyklass_user_id), studentId);
  } catch (error) {
    await recordError(studentId, error);
    throw error;
  }
}

function syncStudent(studentId) {
  const previous = pendingSyncs.get(studentId) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => performSync(studentId));
  pendingSyncs.set(studentId, current);
  void current.finally(() => { if (pendingSyncs.get(studentId) === current) pendingSyncs.delete(studentId); }).catch(() => {});
  return current;
}

async function bindStudent(studentId, userId) {
  if (!isEnabled()) throw new Error("MOYKLASS_API_KEY is not configured");
  if (!crmId(userId)) throw new Error("invalid_crm_user_id");
  const definitions = await fields();
  const student = (await db.query("SELECT * FROM students WHERE id = $1", [studentId])).rows[0];
  if (!student || !/^\d+$/.test(student.tg_id || "")) throw new Error("student_not_found_or_no_telegram_id");
  if (student.moyklass_user_id && String(student.moyklass_user_id) !== String(userId)) throw new Error("student_already_linked");
  const user = await client.getUser(userId);
  const access = parseAccess(user, new Date(), definitions.get(alias("subjects"))?.variants || []);
  if (access.error?.startsWith("Unknown CRM subject")) throw new Error(access.error);
  if (identityValue(user, "telegramId") && identityValue(user, "telegramId") !== String(student.tg_id)) throw new Error("crm_telegram_id_conflict");
  if (identityValue(user, "appUserId") && identityValue(user, "appUserId") !== String(student.id)) throw new Error("crm_app_user_id_conflict");
  const occupied = (await db.query("SELECT id FROM students WHERE moyklass_user_id = $1 AND id <> $2", [userId, studentId])).rows;
  if (occupied.length) throw new Error("crm_user_already_linked");
  if (!identityValue(user, "telegramId")) await client.setAttribute(userId, alias("telegramId"), { value: String(student.tg_id) });
  if (!identityValue(user, "appUserId")) await client.setAttribute(userId, alias("appUserId"), { value: String(student.id) });
  const linked = await db.query("UPDATE students SET moyklass_user_id = $2 WHERE id = $1 AND (moyklass_user_id IS NULL OR moyklass_user_id = $2)", [studentId, userId]);
  if (!linked.rowCount) throw new Error("student_already_linked");
  await syncStudent(studentId);
}

async function reconcile() {
  if (!isEnabled() || running) return;
  running = true;
  try {
    await fields();
    const { rows } = await db.query("SELECT id, moyklass_user_id FROM students WHERE moyklass_user_id IS NOT NULL ORDER BY id");
    for (let start = 0; start < rows.length; start += 100) {
      const batch = rows.slice(start, start + 100);
      try {
        const page = await client.listUsersByIds(batch.map((row) => row.moyklass_user_id));
        const byId = new Map((page.users || []).map((user) => [String(user.id), user]));
        for (const row of batch) {
          const user = byId.get(String(row.moyklass_user_id));
          if (!user) { await recordError(row.id, new Error("CRM student not found")); continue; }
          await applyUser(user, row.id).catch((error) => recordError(row.id, error));
        }
      } catch (error) {
        for (const row of batch) await recordError(row.id, error);
      }
    }
  } finally { running = false; }
}

function start() {
  if (!isEnabled() || timer) return;
  const runReconciliation = () => void reconcile().catch((error) => logEvent("crm_reconciliation_failed", null, {
    message: String(error.message || error).slice(0, 240),
  }));
  runReconciliation();
  timer = setInterval(runReconciliation, 5 * 60_000);
  timer.unref?.();
}

module.exports = { isEnabled, fields, bindStudent, syncStudent, reconcile, start, recordError };
