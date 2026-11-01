/** Shared wall-clock conversion. No browser, server, or native dependencies. */
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const day = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T12:00:00Z")) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;

/** Resolve Sydney wall time, rejecting daylight-saving gaps and ambiguity. */
export function sydneyInstant(date: string, time: string): number | undefined {
  if (!day(date) || !clock.test(time)) return;
  const nominal = Date.parse(`${date}T${time}:00Z`), matches: number[] = [];
  for (const hours of [10, 11]) {
    const instant = nominal - hours * 3600000;
    const p = Object.fromEntries(parts.formatToParts(instant).map(x => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day}` === date && `${p.hour}:${p.minute}` === time) matches.push(instant);
  }
  return matches.length === 1 ? matches[0] : undefined;
}
