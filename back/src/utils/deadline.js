const MOSCOW_OFFSET = "+03:00";

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

module.exports = { parseMoscowDeadline };
