const MOSCOW_OFFSET = "+03:00";
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Europe/Moscow";

function partsToMoscowIso(year, month, day, hour, minute) {
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00${MOSCOW_OFFSET}`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  // Date normalizes impossible values such as 31 February, so verify them.
  const moscow = new Date(parsed.getTime() + 3 * 60 * 60 * 1000);
  if (
    moscow.getUTCFullYear() !== Number(year) ||
    moscow.getUTCMonth() + 1 !== Number(month) ||
    moscow.getUTCDate() !== Number(day) ||
    moscow.getUTCHours() !== Number(hour) ||
    moscow.getUTCMinutes() !== Number(minute)
  ) return null;

  return parsed.toISOString();
}

function parseMoscowDeadline(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return partsToMoscowIso(
      value.getUTCFullYear(),
      String(value.getUTCMonth() + 1).padStart(2, "0"),
      String(value.getUTCDate()).padStart(2, "0"),
      String(value.getUTCHours()).padStart(2, "0"),
      String(value.getUTCMinutes()).padStart(2, "0")
    );
  }

  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) return null;
  const [, year, month, day, hour = "23", minute = "59"] = match;
  return partsToMoscowIso(year, month, day, hour, minute);
}

function dateParts(value, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function deadlineNotice(homework, now = new Date(), timeZone = APP_TIME_ZONE) {
  if (homework.status === "done") return { tone: "done", text: "сдано" };
  if (!homework.due) return { tone: "muted", text: "без срока" };
  const due = new Date(homework.due);
  if (Number.isNaN(due.getTime())) return { tone: "muted", text: "без срока" };
  if (due < now) return { tone: "danger", text: "просрочено" };
  const todayKey = dateParts(now, timeZone);
  const dueKey = dateParts(due, timeZone);
  const dayDifference = Math.round(
    (Date.parse(`${dueKey}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86400000
  );
  if (dayDifference === 0) return { tone: "danger", text: "сдать сегодня" };
  if (dayDifference === 1) return { tone: "warning", text: "завтра дедлайн" };
  return { tone: "muted", text: "предстоит" };
}

module.exports = { parseMoscowDeadline, deadlineNotice, dateParts };
