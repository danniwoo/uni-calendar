import {
  calendar,
  ClassEvent,
  Semester,
  slug,
  Task,
  Unit,
  weekFor,
  Week,
} from "./semester";

export function plain(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ")
    .trim();
}
const decodeICS = (s: string) =>
  s
    .replace(/\\[nN]/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
function icsDate(s: string) {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) throw new Error("The timetable contains an unreadable date.");
  if (m[7]) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (k: string) => parts.find((p) => p.type === k)?.value;
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${get("hour")}:${get("minute")}`,
    };
  }
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    time: m[4] ? `${m[4]}:${m[5]}` : "",
  };
}
export function parseICS(ics: string) {
  if (!ics.includes("BEGIN:VCALENDAR"))
    throw new Error(
      "That link did not return a calendar. Use the subscription link from Sydney Timetable.",
    );
  const events: ClassEvent[] = [],
    units = new Map<string, { code: string; name: string; session: string }>();
  let year = 0,
    session = "";
  for (const match of ics
    .replace(/\r?\n[ \t]/g, "")
    .matchAll(/BEGIN:VEVENT\s*([\s\S]*?)END:VEVENT/g)) {
    const block = match[1];
    if (/^STATUS:CANCELLED/m.test(block)) continue;
    if (/^RRULE:/m.test(block))
      throw new Error(
        "This feed uses recurring calendar rules that this first version cannot safely expand. Please use the USYD timetable subscription export.",
      );
    const fields: Record<string, string> = {};
    for (const line of block.split(/\r?\n/)) {
      const i = line.indexOf(":");
      if (i > 0)
        fields[line.slice(0, i).split(";")[0]] = decodeICS(line.slice(i + 1));
    }
    const id = fields.DESCRIPTION?.match(
      /\b([A-Z]{4}\d{4})-(S[12]C)-([A-Z]+)-([A-Z]+)/,
    );
    if (!id && /\b[A-Z]{4}\d{4}-/.test(fields.DESCRIPTION || ""))
      throw new Error("An intensive or unsupported session appears in this timetable. This version supports standard Semester 1 or 2 only; no units have been silently omitted.");
    if (/DTSTART;TZID=(?!Australia\/Sydney[:;])/.test(block))
      throw new Error("This timetable uses an unsupported time zone. Please use the original USYD subscription feed.");
    if (!id || !fields.DTSTART) continue;
    const start = icsDate(fields.DTSTART),
      end = icsDate(fields.DTEND || fields.DTSTART);
    const thisYear = +start.date.slice(0, 4);
    if (year && (year !== thisYear || session !== id[2]))
      throw new Error(
        "This timetable contains more than one semester. Use the subscription for a single semester.",
      );
    year = thisYear;
    session = id[2];
    const activity =
      fields.DESCRIPTION.match(
        /,\s*(Lecture|Tutorial|Workshop|Practical|Lab|Seminar)/i,
      )?.[1] ||
      fields.SUMMARY?.match(
        /(Lecture|Tutorial|Workshop|Practical|Lab|Seminar)/i,
      )?.[1] ||
      "Class";
    units.set(id[1], {
      code: id[1],
      name: fields.SUMMARY?.split(",")[0] || id[1],
      session: `${id[2]}-${id[3]}-${id[4]}`,
    });
    events.push({
      id: "",
      unit: id[1],
      activity,
      date: start.date,
      time: start.time,
      end: end.time,
      location: fields.LOCATION || "",
    });
  }
  if (!events.length)
    throw new Error(
      "No standard-semester USYD units were found. Check that classes are allocated and the link is current.",
    );
  const weeks = calendar(year, session);
  const counts: Record<string, number> = {};
  const unique = new Set<string>();
  const classes = events
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .filter((e) => {
      const k = [e.unit, e.activity, e.date, e.time, e.location].join("|");
      if (unique.has(k)) return false;
      unique.add(k);
      return true;
    })
    .map((e) => {
      const week = weekFor(e.date, weeks);
      const base = `${e.unit}-${slug(e.activity)}-${week ? `w${week}` : e.date}`;
      const n = (counts[base] = (counts[base] || 0) + 1);
      return { ...e, week, id: `${base}-${n}` };
    });
  return { year, session, weeks, classes, units: [...units.values()] };
}
const rows = (html: string) =>
  [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
const cells = (html: string) =>
  [...html.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => m[1]);
function dueDate(text: string) {
  const m = text.match(
    /Due date\s*:\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+at\s+(\d{1,2}:\d{2}))?/i,
  );
  if (!m) return {};
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const month = months.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  return month
    ? {
        date: `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`,
        time: m[4],
      }
    : {};
}
function coverage(text: string) {
  const m = text.match(
    /(?:cover\w*|test\w*|assess\w*)[^.]{0,60}weeks?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})/i,
  );
  return m && +m[2] >= +m[1] && +m[2] <= 13
    ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i)
    : undefined;
}
export function parseOutline(
  html: string,
  code: string,
  url: string,
  weeks: Week[],
  classes: ClassEvent[],
): Unit {
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(
    (m) => m[0],
  );
  const assessmentTable = tables.find((t) => /id="assessment-table"/.test(t));
  if (!assessmentTable)
    throw new Error(
      "No published assessment table was found in the matching outline.",
    );
  const topics: Unit["topics"] = [];
  for (const table of tables.filter((t) => /Week 0[12]/.test(t))) {
    let week = 0;
    for (const row of rows(table)) {
      const cs = cells(row).map(plain);
      const m = cs[0]?.match(/^Week\s+(\d+)/i);
      if (m) {
        week = +m[1];
        cs.shift();
      }
      if (
        week &&
        cs.length >= 2 &&
        /Lecture|Tutorial|Workshop|Practical|Lab|Seminar/i.test(cs[1])
      )
        topics.push({ week, topic: cs[0], activity: cs[1] });
    }
  }
  const summaryStart = html.indexOf('class="assessmentSummary"');
  const summary =
    summaryStart < 0
      ? ""
      : plain(
          html.slice(
            summaryStart,
            html.indexOf('id="assessmentCriteria"', summaryStart) > 0
              ? html.indexOf('id="assessmentCriteria"', summaryStart)
              : summaryStart + 10000,
          ),
        );
  const assessments: Task[] = [];
  for (const row of rows(assessmentTable)) {
    const cs = cells(row);
    if (cs.length < 5 || !plain(cs[2]).includes("%")) continue;
    const title = plain(cs[1].match(/<b>([\s\S]*?)<\/b>/i)?.[1] || cs[1]),
      description = plain(cs[1]),
      due = plain(cs[3]),
      text = [description, due, plain(cs[4])].join(". ");
    const week = due.match(/Week\s+0?(\d+)/i);
    const kind = /formal exam/i.test(due)
      ? "exam"
      : /multiple weeks/i.test(due) ||
          /weekly|each tutorial|every tutorial|every lecture|ongoing/i.test(
            text,
          )
        ? "recurring"
        : /quiz/i.test(title)
          ? "quiz"
          : "assessment";
    const task: Task = {
      id: `${code}-${slug(title)}`,
      unit: code,
      title,
      description,
      weight: plain(cs[2]),
      timing: due,
      week: week ? +week[1] : undefined,
      ...dueDate(due),
      kind,
      source: url,
      sourceText: text,
      hurdle: /hurdle task/i.test(cs[0]),
      group: /group assignment/i.test(cs[0]),
      coverage: coverage(text),
    };
    if (task.date) {
      const actual = weekFor(task.date, weeks);
      if (task.week && actual && task.week !== actual)
        task.warning =
          "Published week and due date disagree. Check the outline.";
      task.week = actual || task.week;
    }
    if (/students with|following.*tutorial|reattempt/i.test(description))
      task.warning =
        "Special timing or reattempt rules apply. Check the assessment instructions.";
    assessments.push(task);
  }
  const name = plain(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || code,
  ).replace(/^Unit of study outline\s*/i, "");
  return {
    code,
    name,
    session: "",
    outline: url,
    status: "Outline imported",
    summary,
    assessments,
    topics,
  };
}
export function scheduleTasks(unit: Unit, classes: ClassEvent[]): Task[] {
  const result: Task[] = [];
  const own = classes.filter((c) => c.unit === unit.code);
  for (const a of unit.assessments) {
    const text = a.sourceText + " " + unit.summary;
    let activity = "";
    if (/before the lecture, every lecture/i.test(a.sourceText))
      activity = "Lecture";
    else if (/(?:each|every) tutorial/i.test(a.sourceText))
      activity = "Tutorial";
    const quizWeeks = unit.topics
      .filter(
        (t) =>
          /tutorial/i.test(t.activity) &&
          /\bquiz\b/i.test(t.topic) &&
          !/(?:early feedback|SQL Online)/i.test(t.topic),
      )
      .map((t) => t.week);
    if (/^weekly quizzes$/i.test(a.title) && quizWeeks.length) {
      for (const w of [...new Set(quizWeeks)]) {
        const matches = own.filter(
          (c) => c.week === w && /tutorial/i.test(c.activity),
        );
        result.push({
          ...a,
          id: `${a.id}-w${w}`,
          week: w,
          series: a.id,
          kind: "quiz",
          weight: `${a.weight} total`,
          ...(matches.length === 1
            ? {
                date: matches[0].date,
                time: matches[0].time,
                timing: "During your tutorial (matched from timetable)",
              }
            : { timing: "During tutorial · time TBC" }),
        });
      }
      continue;
    }
    if (activity && a.kind === "recurring") {
      for (const c of own.filter(
        (c) => c.activity.toLowerCase() === activity.toLowerCase(),
      ))
        result.push({
          ...a,
          id: `${a.id}-${c.id}`,
          week: c.week,
          date: c.date,
          time: c.time,
          weight: `${a.weight} total`,
          series: a.id,
          timing: /before/i.test(a.sourceText)
            ? `Before your ${activity.toLowerCase()}`
            : `During your ${activity.toLowerCase()}`,
        });
      continue;
    }
    let task = { ...a };
    if (task.week && !task.date) {
      const relevant = unit.topics.filter(
        (t) =>
          t.week === task.week &&
          t.topic.toLowerCase().includes(task.title.toLowerCase()),
      );
      const tutorial =
        /in tutorial|in scheduled tutorial|held in tutorial|during.*tutorial/i.test(
          task.description,
        ) ||
        relevant.some((t) => /tutorial/i.test(t.activity)) ||
        (task.kind === "quiz" &&
          new RegExp(
            `${task.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^.]{0,120}(?:tutorial)`,
            "i",
          ).test(text));
      const lab = /during lab/i.test(task.description);
      const candidates = own.filter(
        (c) =>
          c.week === task.week &&
          (lab
            ? /practical|lab/i.test(c.activity)
            : tutorial
              ? /tutorial/i.test(c.activity)
              : false),
      );
      if (candidates.length === 1) {
        task = {
          ...task,
          date: candidates[0].date,
          time: candidates[0].time,
          timing: `During your ${candidates[0].activity.toLowerCase()} (matched from timetable)`,
        };
      }
    }
    if (
      task.kind === "recurring" &&
      (!task.week || /Ongoing|Multiple weeks/i.test(task.timing))
    ) {
      task.warning =
        "Recurring assessment: individual occurrences are not fully dated in the outline. Check Canvas/Ed and place each required task.";
    }
    result.push(task);
  }
  return result;
}
async function readURL(url: string, privateFeed = false) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    (privateFeed
      ? u.hostname !== "timetable.sydney.edu.au" ||
        !/^\/even\/rest\/calendar\/ical\/[a-zA-Z0-9-]+$/.test(u.pathname)
      : u.hostname !== "www.sydney.edu.au" || !u.pathname.startsWith("/units/"))
  )
    throw new Error("Use the official USYD timetable subscription URL.");
  const response = await fetch(u, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
    headers: { Accept: privateFeed ? "text/calendar" : "text/html" },
  });
  if (!response.ok)
    throw new Error(
      privateFeed
        ? "Sydney Timetable could not be reached. Check the link and try again."
        : "The matching outline is not available.",
    );
  const body = await response.text();
  if (body.length > 3_000_000)
    throw new Error("The import is too large for this first version.");
  return body;
}
export async function importSemester(url: string): Promise<Semester> {
  const feed = await readURL(url.trim(), true),
    parsed = parseICS(feed);
  const warnings: string[] = [];
  const units = await Promise.all(
    parsed.units.slice(0, 8).map(async (info) => {
      const base = `https://www.sydney.edu.au/units/${info.code}`;
      try {
        const generic = await readURL(base);
        const expected = `/units/${info.code}/${parsed.year}-${info.session}`;
        const links = [...generic.matchAll(/href=["']([^"']+)["']/g)].map(
          (m) => m[1],
        );
        const link = links.find(
          (l) => l === expected || l === `https://www.sydney.edu.au${expected}`,
        );
        if (!link)
          throw new Error(
            "Matching semester outline not published or linked yet.",
          );
        const outline = new URL(link, base).href;
        const unit = parseOutline(
          await readURL(outline),
          info.code,
          outline,
          parsed.weeks,
          parsed.classes,
        );
        return { ...unit, name: info.name, session: info.session };
      } catch (error) {
        const status =
          error instanceof Error ? error.message : "Outline unavailable";
        warnings.push(
          `${info.code}: ${status} Add missing assessments manually.`,
        );
        return {
          ...info,
          outline: base,
          status,
          summary: "",
          assessments: [],
          topics: [],
        };
      }
    }),
  );
  const classes = parsed.classes.map((c) => ({
    ...c,
    topic: units
      .find((u) => u.code === c.unit)
      ?.topics.find(
        (t) =>
          t.week === c.week &&
          t.activity.toLowerCase().startsWith(c.activity.toLowerCase()),
      )?.topic,
  }));
  if (parsed.units.length > 8)
    warnings.push(
      "Only the first eight units were imported. Check your timetable.",
    );
  return {
    year: parsed.year,
    session: parsed.session,
    weeks: parsed.weeks,
    classes,
    units,
    tasks: units.flatMap((u) => scheduleTasks(u, classes)),
    completed: {},
    feedUrl: url.trim(),
    importedAt: new Date().toISOString(),
    warnings,
  };
}
