const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Europe/Moscow";

// Admin picks a calendar day ("до какого числа"); access runs through the END
// of that day in the app's own timezone, not UTC midnight, so "до 30 сентября"
// actually covers all of September 30th for the student. Returns:
//   undefined — the field was not sent at all (caller should leave access_until untouched)
//   null      — explicitly cleared, meaning "бессрочно"
//   Date      — a valid end-of-day cutoff
// or the string "invalid" if a non-empty value could not be parsed.
function parseAccessUntilDay(value, timeZone = APP_TIME_ZONE) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return "invalid";
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return "invalid";
  // Compute where that calendar day's 23:59:59.999 falls in `timeZone` by
  // reading the zone's current UTC offset and applying it — accurate for a
  // single fixed-offset zone like Europe/Moscow; a DST-observing zone would
  // need per-date offset lookup instead.
  const offsetMinutes = Number(
    new Date().toLocaleString("en-US", { timeZone, timeZoneName: "shortOffset" }).match(/GMT([+-]\d+)/)?.[1] ?? 0
  ) * 60;
  const endOfDayUtc = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetMinutes * 60 * 1000;
  const date = new Date(endOfDayUtc);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date;
}

module.exports = { parseAccessUntilDay };
