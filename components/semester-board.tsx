"use client";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  Download,
  Check,
  BookOpen,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  COLORS,
  mergeSemester,
  Semester,
  Task,
  Unit,
  ClassEvent,
  shortDate,
  sydneyDate,
  timingLabel,
  weekFor,
} from "@/lib/semester";
import { registerSemesterTools } from "@/lib/browser-tools";

function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, t]) => (
          <SelectItem key={v} value={v}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
type Detail =
  | { type: "task"; task: Task }
  | { type: "unit"; unit: Unit }
  | { type: "class"; event: ClassEvent };
type ApiResult = {
  semester: Semester | null;
  revision: number;
  error?: string;
  signIn?: boolean;
};
export default function SemesterBoard() {
  const [semester, setSemester] = useState<Semester | null>(null),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(""),
    [signIn, setSignIn] = useState(false),
    [saveStatus, setSaveStatus] = useState(""),
    [saveError, setSaveError] = useState(""),
    [notice, setNotice] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [settings, setSettings] = useState(false),
    [detail, setDetail] = useState<Detail | null>(null),
    [draft, setDraft] = useState<Task | null>(null),
    [editError, setEditError] = useState(""),
    [showPast, setShowPast] = useState(false),
    [showWarnings, setShowWarnings] = useState(false);
  const current = useRef<Semester | null>(null),
    revision = useRef(0),
    pending = useRef<Semester | null>(null),
    saving = useRef(false);
  const today = sydneyDate();
  async function load() {
    setLoadError("");
    try {
      const r = await fetch("/api/semester", { cache: "no-store" }),
        j = (await r.json()) as ApiResult;
      if (!r.ok) {
        setSignIn(!!j.signIn);
        throw new Error(j.error);
      }
      current.current = j.semester;
      setSemester(j.semester);
      revision.current = j.revision;
      setLoaded(true);
      setSaveStatus(j.semester ? "Saved" : "");
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load your semester.",
      );
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(
    () =>
      registerSemesterTools(
        () => current.current,
        (t) => {
          setDetail({ type: "task", task: t });
          setDraft({ ...t });
          setEditError("");
        },
      ),
    [],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current || saving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function flush() {
    if (saving.current) return;
    saving.current = true;
    setSaveError("");
    try {
      while (pending.current) {
        const snapshot = pending.current;
        setSaveStatus("Saving…");
        const r = await fetch("/api/semester", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            semester: snapshot,
            revision: revision.current,
          }),
        });
        const j = (await r.json()) as ApiResult;
        if (!r.ok) throw new Error(j.error);
        revision.current = j.revision;
        if (pending.current === snapshot) pending.current = null;
      }
      setSaveStatus("Saved");
    } catch (e) {
      setSaveStatus("Not saved");
      setSaveError(
        e instanceof Error
          ? e.message
          : "Save failed. Export a backup before closing.",
      );
    } finally {
      saving.current = false;
    }
  }
  function commit(next: Semester) {
    current.current = next;
    setSemester(next);
    pending.current = next;
    void flush();
  }
  async function importFeed(value: string) {
    if (!loaded || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const j = (await r.json()) as ApiResult;
      if (!r.ok || !j.semester)
        throw new Error(j.error || "No semester was returned.");
      const next = mergeSemester(current.current || undefined, j.semester);
      commit(next);
      setSettings(false);
      setUrl("");
      setNotice(
        `Imported ${next.units.length} units. Check the Needs details tray and any source warnings.`,
      );
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Import failed. Your previous semester is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  function toggleTask(t: Task) {
    const s = current.current;
    if (s)
      commit({
        ...s,
        tasks: s.tasks.map((x) =>
          x.id === t.id ? { ...x, done: !x.done } : x,
        ),
      });
  }
  function toggleClass(c: ClassEvent) {
    const s = current.current;
    if (s)
      commit({
        ...s,
        completed: { ...s.completed, [c.id]: !s.completed[c.id] },
      });
  }
  function openTask(t: Task) {
    setDetail({ type: "task", task: t });
    setDraft({ ...t });
    setEditError("");
  }
  function newTask() {
    if (!semester) return;
    openTask({
      id: `manual-${crypto.randomUUID()}`,
      unit: semester.units[0]?.code || "",
      title: "",
      weight: "",
      timing: "Added by you",
      kind: "assessment",
      description: "",
      source: "",
      sourceText: "",
      hurdle: false,
      group: false,
      manual: true,
    });
  }
  function saveTask() {
    if (!semester || !draft) return;
    setEditError("");
    if (!draft.title.trim()) {
      setEditError("Give this task a name.");
      return;
    }
    if (draft.time && !draft.date) {
      setEditError("Choose a date for the time, or leave both unknown.");
      return;
    }
    if (
      draft.date &&
      !semester.weeks.some(
        (w) => draft.date! >= w.start && draft.date! <= w.end,
      )
    ) {
      setEditError(
        "Choose a date within this semester, including its exam period.",
      );
      return;
    }
    const week = draft.date ? weekFor(draft.date, semester.weeks) : draft.week;
    if (draft.startWeek && week && draft.startWeek > week) {
      setEditError("Your planned start must be before the due week.");
      return;
    }
    const next = { ...draft, title: draft.title.trim(), week, manual: true };
    const exists = semester.tasks.some((t) => t.id === next.id);
    commit({
      ...semester,
      tasks: exists
        ? semester.tasks.map((t) => (t.id === next.id ? next : t))
        : [...semester.tasks, next],
    });
    setDetail(null);
  }
  function backup() {
    if (!semester) return;
    const blob = new Blob(
      [JSON.stringify({ ...semester, feedUrl: "" }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `semester-${semester.year}-${semester.session}.backup.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const selectedWeek = semester?.weeks.find(
    (w) => w.start <= today && w.end >= today,
  );
  const color = (unit: string) =>
    COLORS[
      Math.max(0, semester?.units.findIndex((u) => u.code === unit) ?? 0) %
        COLORS.length
    ];
  const undated =
    semester?.tasks.filter(
      (t) =>
        (!t.week && !t.date && t.kind !== "exam") ||
        (t.kind === "recurring" && !t.series && t.warning),
    ) || [];
  const overdue =
    semester?.tasks.filter(
      (t) =>
        !t.done &&
        (t.date
          ? t.date < today
          : t.week
            ? (semester.weeks.find((w) => w.number === t.week)?.end || "9999") <
              today
            : false),
    ) || [];
  const upcoming =
    semester?.tasks
      .filter(
        (t) =>
          !t.done &&
          !undated.includes(t) &&
          (t.date
            ? t.date >= today
            : t.week
              ? (semester.weeks.find((w) => w.number === t.week)?.end || "") >=
                today
              : t.kind === "exam"),
      )
      .sort((a, b) =>
        (
          a.date ||
          semester?.weeks.find((w) =>
            a.week ? w.number === a.week : w.id === "exam" && a.kind === "exam",
          )?.start ||
          "9999"
        ).localeCompare(
          b.date ||
            semester?.weeks.find((w) =>
              b.week
                ? w.number === b.week
                : w.id === "exam" && b.kind === "exam",
            )?.start ||
            "9999",
        ),
      ) || [];
  const visibleWeeks =
    semester?.weeks.filter((w) => showPast || w.end >= today) || [];
  const catchup =
    semester?.classes.filter(
      (c) => c.date < today && !semester.completed[c.id],
    ) || [];
  function TaskCard({
    task,
    compact = false,
  }: {
    task: Task;
    compact?: boolean;
  }) {
    return (
      <div
        className={`task-card ${task.done ? "is-done" : ""} ${task.series ? "recurring-card" : ""}`}
        style={{ "--unit": color(task.unit) } as React.CSSProperties}
      >
        <div className="task-top">
          <small>
            {compact
              ? task.unit
              : task.kind === "exam"
                ? "EXAM"
                : task.series
                  ? "RECURRING"
                  : task.kind.toUpperCase()}
            {task.hurdle ? " · HURDLE" : ""}
          </small>
          <Checkbox
            aria-label={`Mark ${task.unit} ${task.title}${task.week ? ` week ${task.week}` : ""} complete`}
            checked={!!task.done}
            onCheckedChange={() => toggleTask(task)}
          />
        </div>
        <button className="task-open" onClick={() => openTask(task)}>
          <strong>{task.title}</strong>
          <span>
            {task.timing.startsWith("Before") ? `${task.timing} · ` : ""}
            {timingLabel(task)}
          </span>
          {task.weight && (
            <span className="weight">
              {task.weight}
              {task.warning ? " · Check details" : ""}
            </span>
          )}
        </button>
      </div>
    );
  }
  return (
    <main>
      <header>
        <div className="wordmark">
          <CalendarDays /> semester <small>USYD</small>
        </div>
        <div className="header-actions">
          <span
            className={`save-state ${saveError ? "danger" : ""}`}
            role="status"
          >
            {saveStatus === "Saved" && <Check size={14} />} {saveStatus}
          </span>
          {semester && (
            <button onClick={() => setSettings(!settings)}>Manage</button>
          )}
        </div>
      </header>
      {loadError && (
        <div className="notice error">
          <p>{loadError}</p>
          {signIn ? (
            <a href="/signin-with-chatgpt?return_to=%2F" target="_top">
              Sign in with ChatGPT
            </a>
          ) : (
            <button onClick={load}>Retry loading</button>
          )}
        </div>
      )}
      {saveError && (
        <div className="notice error" role="alert">
          <p>{saveError}</p>
          <button onClick={flush}>Retry save</button>{" "}
          <button onClick={backup}>Export unsaved progress</button>
        </div>
      )}
      {(!semester || settings) && (
        <section className="setup">
          <div>
            <p className="eyebrow">YOUR SEMESTER, IN ONE PLACE</p>
            <h1>{semester ? "Keep it up to date." : "See it coming."}</h1>
            <p className="muted">
              Assignments, quizzes and the weeks to catch up on.
            </p>
          </div>
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void importFeed(url);
              }}
            >
              <label htmlFor="feed">
                Your USYD timetable subscription link
              </label>
              <div className="input-action">
                <input
                  id="feed"
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://timetable.sydney.edu.au/…"
                  autoComplete="off"
                />
                <button className="primary" disabled={busy || !loaded}>
                  {busy
                    ? "Reading timetable & outlines…"
                    : semester
                      ? "Import timetable"
                      : "Build my semester"}
                </button>
              </div>
              <p className="hint">
                Standard semesters, 2026. Saved privately to your account. Check
                missing details against Canvas/Ed.
              </p>
            </form>
            {semester && (
              <div className="toolbar">
                <button
                  disabled={busy || !semester.feedUrl}
                  onClick={() => importFeed(semester.feedUrl)}
                >
                  <RefreshCw size={15} />
                  Refresh current timetable
                </button>
                <button onClick={backup}>
                  <Download size={15} />
                  Export backup
                </button>
              </div>
            )}
          </div>
        </section>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button
            className="dismiss"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {!semester && !loadError && (
        <section className="onboarding-empty">
          <div className="empty-weeks">
            <span>Week 01</span>
            <span>Week 02</span>
            <span>Week 03</span>
          </div>
          <div>
            <h2>One semester. All your units.</h2>
            <p>
              Paste your timetable link above. We’ll place published assessments
              beside the right teaching weeks and match class-based quizzes to
              your tutorial.
            </p>
            <p className="hint">
              No guessed deadlines. Anything unclear stays visible for you to
              check.
            </p>
            {!loaded && <p role="status">Loading saved semester…</p>}
          </div>
        </section>
      )}
      {semester && (
        <>
          <section className="heading semester-title">
            <div>
              <p className="eyebrow">
                {shortDate(today)} ·{" "}
                {selectedWeek?.label || "Outside teaching weeks"} · SYDNEY TIME
              </p>
              <h1>
                Semester {semester.session === "S2C" ? 2 : 1}{" "}
                <span className="muted">{semester.year}</span>
              </h1>
            </div>
            <div className="toolbar">
              <button
                onClick={() => {
                  document
                    .getElementById(selectedWeek?.id || "exam")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                This week
              </button>
              <button className="primary" onClick={newTask}>
                <Plus size={16} />
                Add task
              </button>
            </div>
          </section>
          <section className="coming-up">
            <div className="coming-title">
              <p className="eyebrow">COMING UP NEXT</p>
              <span>Know before it’s due.</span>
            </div>
            <div className="upcoming-cards">
              {upcoming.slice(0, 3).map((t) => (
                <TaskCard key={t.id} task={t} compact />
              ))}
              {!upcoming.length && (
                <p className="muted">
                  No upcoming dated tasks. Check your undated tasks and course
                  notices.
                </p>
              )}
            </div>
          </section>
          <div className="attention-line">
            <button
              onClick={() => {
                setShowPast(true);
                setNotice(
                  `${overdue.length} past assessments are unchecked. They may already be done—mark them complete on the board.`,
                );
              }}
            >
              {overdue.length} past assessments unchecked
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("needs-details")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {undated.filter((t) => !t.done).length} need details
            </button>
            <span>·</span>
            <span>{catchup.length} past learning items unchecked</span>
            <button onClick={() => setShowWarnings(!showWarnings)}>
              Import details <ChevronDown size={14} />
            </button>
          </div>
          {showWarnings && (
            <section className="notice">
              <p>
                Last checked{" "}
                {new Date(semester.importedAt).toLocaleString("en-AU", {
                  timeZone: "Australia/Sydney",
                })}
                . Official outlines can omit or conflict with Canvas/Ed updates.
              </p>
              {semester.units.map((u) => (
                <p key={u.code}>
                  <a href={u.outline} target="_blank" rel="noreferrer">
                    {u.code}
                  </a>{" "}
                  — {u.status}
                </p>
              ))}
              {semester.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
              <p>
                Lecture/tutorial checkboxes track your own learning, not
                university attendance. A tick doesn’t mean a quiz score or
                hurdle has been passed.
              </p>
            </section>
          )}
          <div className="board-layout">
            <section
              className="board"
              style={
                { "--columns": semester.units.length } as React.CSSProperties
              }
            >
              <div className="grid-head">
                <div className="week-label">TEACHING WEEK</div>
                {semester.units.map((u) => (
                  <button
                    className="unit-head"
                    key={u.code}
                    onClick={() => setDetail({ type: "unit", unit: u })}
                    style={{ color: color(u.code) }}
                  >
                    {u.code}
                    <small>{u.name}</small>
                  </button>
                ))}
              </div>
              {semester.weeks.some((w) => w.end < today) && (
                <button
                  className="past-toggle"
                  onClick={() => setShowPast(!showPast)}
                >
                  {showPast
                    ? "Fold earlier weeks"
                    : "Show earlier weeks & catch-up"}
                  <ChevronDown size={15} />
                </button>
              )}
              {(visibleWeeks.length ? visibleWeeks : semester.weeks).map(
                (w) => (
                  <div
                    id={w.id}
                    className={`week-row ${selectedWeek?.id === w.id ? "current" : ""} ${w.kind !== "teaching" ? "non-teaching" : ""}`}
                    key={w.id}
                  >
                    <div className="week-label">
                      <strong>{w.label}</strong>
                      <small>
                        {shortDate(w.start)} – {shortDate(w.end)}
                      </small>
                      {selectedWeek?.id === w.id && <em>You are here</em>}
                      {w.number === 9 && semester.session === "S2C" && (
                        <small>5 Oct: public holiday</small>
                      )}
                    </div>
                    {semester.units.map((u) => {
                      const tasks = semester.tasks.filter(
                        (t) =>
                          t.unit === u.code &&
                          (t.date
                            ? t.date >= w.start && t.date <= w.end
                            : t.kind === "exam"
                              ? w.kind === "exam"
                              : t.week === w.number && !!w.number),
                      );
                      const learning = semester.classes.filter(
                        (c) =>
                          c.unit === u.code &&
                          c.date >= w.start &&
                          c.date <= w.end,
                      );
                      const active = semester.tasks.filter(
                        (t) =>
                          t.unit === u.code &&
                          t.startWeek &&
                          w.number &&
                          t.startWeek <= w.number &&
                          (t.week || 0) > w.number,
                      );
                      return (
                        <div
                          className="unit-cell"
                          data-unit={u.code}
                          key={u.code}
                          style={
                            { "--unit": color(u.code) } as React.CSSProperties
                          }
                        >
                          <button
                            className="mobile-unit"
                            onClick={() => setDetail({ type: "unit", unit: u })}
                          >
                            {u.code}
                          </button>
                          {active.map((t) => (
                            <button
                              key={t.id}
                              className={`work-span ${t.done ? "is-done" : ""}`}
                              onClick={() => openTask(t)}
                            >
                              {t.title}
                              <small>Planned work · due W{t.week}</small>
                            </button>
                          ))}
                          {tasks.map((t) => (
                            <TaskCard key={t.id} task={t} />
                          ))}
                          {learning.length > 0 && (
                            <div className="learning">
                              {learning.map((c) => (
                                <div className="learning-item" key={c.id}>
                                  <Checkbox
                                    aria-label={`Complete ${c.unit} ${c.activity} week ${c.week} ${c.date}`}
                                    checked={!!semester.completed[c.id]}
                                    onCheckedChange={() => toggleClass(c)}
                                  />
                                  <button
                                    className={`learning-open ${semester.completed[c.id] ? "checked" : ""}`}
                                    onClick={() =>
                                      setDetail({ type: "class", event: c })
                                    }
                                  >
                                    {c.activity}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {!tasks.length &&
                            !learning.length &&
                            !active.length &&
                            w.kind === "teaching" && (
                              <span className="quiet-dash">—</span>
                            )}
                        </div>
                      );
                    })}
                  </div>
                ),
              )}
            </section>
            <aside id="needs-details">
              <CalendarDays size={21} />
              <h3>
                Needs details{" "}
                <span className="count">
                  {undated.filter((t) => !t.done).length}
                </span>
              </h3>
              <p className="muted">
                These aren’t missing—just not fully scheduled yet.
              </p>
              {undated.length === 0 ? (
                <p className="hint">
                  All imported tasks have a place. Keep checking course
                  announcements.
                </p>
              ) : (
                undated.map((t) => (
                  <div
                    key={t.id}
                    className={`unplaced ${t.done ? "is-done" : ""}`}
                    style={{ "--unit": color(t.unit) } as React.CSSProperties}
                  >
                    <small style={{ color: color(t.unit) }}>
                      {t.unit} · {t.weight}
                    </small>
                    <strong>{t.title}</strong>
                    <p>
                      {t.kind === "recurring"
                        ? "Recurring dates need checking"
                        : "No individual dates published"}
                    </p>
                    <button onClick={() => openTask(t)}>Check & place</button>
                  </div>
                ))
              )}
              <p className="hint">
                Add dates from Canvas or Ed. No deadline is invented to fill a
                gap.
              </p>
            </aside>
          </div>
          <footer>
            <a
              href="https://www.sydney.edu.au/students/key-dates.html"
              target="_blank"
              rel="noreferrer"
            >
              USYD teaching calendar
            </a>{" "}
            · Times are Australia/Sydney. Breaks pause teaching-week numbering.{" "}
            <button onClick={backup}>Export backup</button>
          </footer>
        </>
      )}
      <Sheet
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) {
            setDetail(null);
            setDraft(null);
          }
        }}
      >
        <SheetContent className="detail-panel">
          <SheetHeader>
            <SheetTitle>
              {detail?.type === "unit"
                ? detail.unit.code
                : detail?.type === "class"
                  ? `${detail.event.activity} · Week ${detail.event.week || "—"}`
                  : draft?.title || "Add a task"}
            </SheetTitle>
            <SheetDescription>
              {detail?.type === "unit"
                ? detail.unit.name
                : detail?.type === "class"
                  ? detail.event.unit
                  : draft?.unit}
            </SheetDescription>
          </SheetHeader>
          {detail?.type === "task" && draft && semester && (
            <div className="detail-body">
              {draft.warning && <p className="notice">{draft.warning}</p>}
              <label>
                Task name
                <input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <label>
                Unit
                <Choice
                  label="Unit"
                  value={draft.unit}
                  onChange={(unit) => setDraft({ ...draft, unit })}
                  options={semester.units.map((u) => [u.code, u.code])}
                />
              </label>
              <div className="field-pair">
                <label>
                  Teaching week
                  <Choice
                    label="Teaching week"
                    value={String(draft.week || "unknown")}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        week: v === "unknown" ? undefined : +v,
                        date: undefined,
                        time: undefined,
                      })
                    }
                    options={[
                      ["unknown", "Not known"],
                      ...Array.from(
                        { length: 13 },
                        (_, i) =>
                          [String(i + 1), `Week ${i + 1}`] as [string, string],
                      ),
                    ]}
                  />
                </label>
                <label>
                  Weight
                  <input
                    value={draft.weight}
                    placeholder="e.g. 10%"
                    onChange={(e) =>
                      setDraft({ ...draft, weight: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="field-pair">
                <label>
                  Due date
                  <input
                    type="date"
                    value={draft.date || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        date: e.target.value || undefined,
                        week: e.target.value
                          ? weekFor(e.target.value, semester.weeks)
                          : draft.week,
                      })
                    }
                  />
                </label>
                <label>
                  Time · Sydney
                  <input
                    type="time"
                    value={draft.time || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, time: e.target.value || undefined })
                    }
                  />
                </label>
              </div>
              <p className="hint">
                A week without an exact date stays on that week, marked “Day &
                time TBC”.
              </p>
              <label>
                My planned start
                <Choice
                  label="Planned start"
                  value={String(draft.startWeek || "none")}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      startWeek: v === "none" ? undefined : +v,
                    })
                  }
                  options={[
                    ["none", "No plan yet"],
                    ...Array.from(
                      { length: 13 },
                      (_, i) =>
                        [String(i + 1), `Week ${i + 1}`] as [string, string],
                    ),
                  ]}
                />
              </label>
              <label>
                Quiz covers these weeks
                <input
                  key={draft.id}
                  defaultValue={draft.coverage?.join(", ") || ""}
                  placeholder="Only if known, e.g. 4, 5, 6, 7"
                  onBlur={(e) =>
                    setDraft({
                      ...draft,
                      coverage: [
                        ...new Set(
                          e.target.value
                            .split(/[, ]+/)
                            .map(Number)
                            .filter((n) => n >= 1 && n <= 13),
                        ),
                      ],
                    })
                  }
                />
              </label>
              {!!draft.coverage?.length && (
                <div className="coverage">
                  <strong>Learning to check</strong>
                  {semester.classes
                    .filter(
                      (c) =>
                        c.unit === draft.unit &&
                        draft.coverage?.includes(c.week || 0) &&
                        /lecture/i.test(c.activity),
                    )
                    .map((c) => (
                      <label key={c.id} className="coverage-item">
                        <Checkbox
                          checked={!!semester.completed[c.id]}
                          onCheckedChange={() => toggleClass(c)}
                        />
                        Week {c.week}: {c.topic || c.activity}
                      </label>
                    ))}
                </div>
              )}
              <label>
                Notes / instructions
                <textarea
                  rows={4}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <label className="inline-label">
                <Checkbox
                  checked={!!draft.done}
                  onCheckedChange={(v) => setDraft({ ...draft, done: !!v })}
                />
                Completed
              </label>
              {editError && (
                <p className="error" role="alert">
                  {editError}
                </p>
              )}
              <button className="primary" onClick={saveTask}>
                Save task
              </button>
              {draft.series && (
                <p className="hint">
                  This edits only this occurrence. The displayed weight is for
                  the whole assessment series.
                </p>
              )}
              {draft.source && (
                <details>
                  <summary>Original outline information</summary>
                  <p>{draft.sourceText}</p>
                  <p>
                    {draft.hurdle
                      ? "Hurdle assessment. Completion alone does not confirm a pass."
                      : ""}
                  </p>
                  <a href={draft.source} target="_blank" rel="noreferrer">
                    Open unit outline <ExternalLink size={13} />
                  </a>
                </details>
              )}
              {draft.kind === "recurring" && !draft.series && (
                <button
                  onClick={() => {
                    const copy = {
                      ...draft,
                      id: `manual-${crypto.randomUUID()}`,
                      title: `${draft.title} — occurrence`,
                      kind: "assessment" as const,
                      manual: true,
                      done: false,
                      warning: undefined,
                    };
                    setDraft(copy);
                  }}
                >
                  Create an individual occurrence
                </button>
              )}
            </div>
          )}
          {detail?.type === "class" && semester && (
            <div className="detail-body">
              <p>
                {shortDate(detail.event.date)} · {detail.event.time}–
                {detail.event.end}
              </p>
              <p>{detail.event.location || "Location not listed"}</p>
              <h3>This week’s topic</h3>
              <p>
                {detail.event.topic || "Topic not published in the outline."}
              </p>
              <button
                className="primary"
                onClick={() => toggleClass(detail.event)}
              >
                {semester.completed[detail.event.id]
                  ? "Mark unfinished"
                  : "Mark done / watched"}
              </button>
              <p className="hint">
                Your learning progress—not an attendance record.
              </p>
            </div>
          )}
          {detail?.type === "unit" && (
            <div className="detail-body">
              <a href={detail.unit.outline} target="_blank" rel="noreferrer">
                Open official outline
              </a>
              {detail.unit.assessments.map((t) => (
                <div className="assessment-summary" key={t.id}>
                  <strong>{t.title}</strong>
                  <span>
                    {t.weight} {t.hurdle ? "· Hurdle" : ""}
                  </span>
                  <p>{t.timing}</p>
                </div>
              ))}
              <details>
                <summary>Assessment rules</summary>
                <p>
                  {detail.unit.summary ||
                    "No assessment summary could be imported. Check the official outline and Canvas/Ed."}
                </p>
              </details>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
