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
  needsPlacement,
  isRoutine,
  weightLabel,
  isPast,
} from "@/lib/semester";
import { reconcile } from "@/lib/sync";
import { registerSemesterTools } from "@/lib/browser-tools";
import { UnitDetail } from "@/components/unit-detail";
import { AssessmentScope } from "@/components/assessment-scope";
import { learningScope, withCoverage } from "@/lib/learning-scope";

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
    [showWarnings, setShowWarnings] = useState(false),
    [showRoutines, setShowRoutines] = useState(false),
    [focus, setFocus] = useState(false),
    [showTray, setShowTray] = useState(false),
    [expandedWeeks, setExpandedWeeks] = useState<Record<string,boolean>>({}),
    [editingTask, setEditingTask] = useState(false),
    [conflict, setConflict] = useState<{remote:Semester; revision:number; fields:string[]} | null>(null),
    [clock, setClock] = useState(() => new Date());
  const current = useRef<Semester | null>(null),
    baseline = useRef<Semester | null>(null),
    revision = useRef(0),
    pending = useRef<Semester | null>(null),
    saving = useRef(false);
  const today = sydneyDate(clock);
  useEffect(()=>{try {setFocus(localStorage.getItem("semester-layout") === "focus");} catch {}},[]);
  function chooseLayout(next:boolean) {setFocus(next);try {localStorage.setItem("semester-layout",next ? "focus" : "full");} catch {}}
  useEffect(() => { const id = setInterval(()=>setClock(new Date()),60000); return ()=>clearInterval(id); }, []);
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
      baseline.current = j.semester;
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
          setEditingTask(false);
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
      let retries = 0;
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
        if (r.status === 409 && retries++ < 2) {
          const latest = await fetch("/api/semester", {cache:"no-store"});
          const remote = await latest.json() as ApiResult;
          if (!latest.ok || !remote.semester) throw new Error("Could not read the latest saved version. Your edits remain in this tab.");
          const merged = reconcile(baseline.current, pending.current || snapshot, remote.semester);
          if (merged.conflicts.length) {
            setConflict({remote:remote.semester,revision:remote.revision,fields:merged.conflicts});
            throw new Error("Another tab changed the same information. Choose which conflicting edits to keep; unrelated changes are preserved.");
          }
          baseline.current = remote.semester; revision.current = remote.revision;
          pending.current = merged.semester; current.current = merged.semester; setSemester(merged.semester);
          continue;
        }
        if (!r.ok) throw new Error(j.error);
        revision.current = j.revision;
        baseline.current = snapshot;
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
  function resolveConflict(prefer: "local" | "remote") {
    if (!conflict || !current.current) return;
    const merged = reconcile(baseline.current,current.current,conflict.remote,prefer);
    baseline.current = conflict.remote; revision.current = conflict.revision;
    setConflict(null); commit(merged.semester);
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
    setEditingTask(false);
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
    setEditingTask(true);
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
    const previous = semester.tasks.find(t=>t.id === draft.id);
    const edited = { ...draft, title: draft.title.trim(), week };
    const keys = ["title","unit","weight","week","date","time","startWeek","coverage","description","passed"];
    const legacyOverrides = previous?.manual && !previous.overrides ? [...keys,"timeBasis","timing","endTime"] : [];
    const overrides = [...new Set([...(previous?.overrides || legacyOverrides), ...keys.filter(k=>
      JSON.stringify((previous as unknown as Record<string,unknown> | undefined)?.[k]) !== JSON.stringify((edited as unknown as Record<string,unknown>)[k]))])];
    const timingChanged = ["date","time","week"].some(k=>JSON.stringify((previous as unknown as Record<string,unknown> | undefined)?.[k]) !== JSON.stringify((edited as unknown as Record<string,unknown>)[k]));
    const next = { ...edited, manual: true, overrides:timingChanged ? [...new Set([...overrides,"timeBasis","timing","endTime"])] : overrides, ...(timingChanged ? {timeBasis:"deadline" as const,timing:"Date entered by you",endTime:undefined} : {}) };
    const exists = semester.tasks.some((t) => t.id === next.id);
    commit({
      ...semester,
      tasks: exists
        ? semester.tasks.map((t) => (t.id === next.id ? next : t))
        : [...semester.tasks, next],
    });
    setDetail(null);
  }
  function saveScope(task: Task, weeks: number[]) {
    const s = current.current;
    if (!s) return;
    const existing = s.tasks.find(t => t.id === task.id);
    const updated = withCoverage(existing || task, weeks);
    commit({...s, tasks: existing ? s.tasks.map(t=>t.id === task.id ? updated : t) : [...s.tasks,updated]});
    setDraft(prev=>prev?.id === task.id ? withCoverage(prev,weeks) : prev);
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
  async function restoreBackup(file?: File) {
    if (!file || !semester) return;
    try {
      const restored = JSON.parse(await file.text()) as Semester;
      if (file.size > 1500000 || restored.year !== semester.year || restored.session !== semester.session
        || !Array.isArray(restored.tasks) || !Array.isArray(restored.classes) || !restored.completed
        || restored.tasks.some(t=>typeof t.id !== "string" || typeof t.title !== "string")) throw new Error("Choose a valid backup for this semester.");
      // Restore personal progress as a merge, not a destructive replacement.
      const tasks = new Map(semester.tasks.map(t=>[t.id,t]));
      for (const t of restored.tasks) tasks.set(t.id, {...(tasks.get(t.id) || t), ...t});
      commit({...semester,tasks:[...tasks.values()],completed:{...semester.completed,...restored.completed}});
      setNotice("Backup tasks and progress restored. Current timetable link kept.");
    } catch(e) {setNotice(e instanceof Error ? e.message : "Backup could not be read.");}
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
    semester?.tasks.filter(needsPlacement) || [];
  const ongoing = undated.filter(t=>t.routine && /ongoing/i.test(t.sourceText));
  const unplaced = undated.filter(t=>!ongoing.includes(t));
  const overdue =
    semester?.tasks.filter(
      (t) =>
        !t.done &&
        isPast(t,semester,clock),
    ) || [];
  const upcoming =
    semester?.tasks
      .filter(
        (t) =>
          !t.done &&
          !isRoutine(t) && !t.rules?.optional &&
          !isPast(t,semester,clock) &&
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
          (a.date ? a.date + (a.time || "23:59") : "") ||
          semester?.weeks.find((w) =>
            a.week ? w.number === a.week : w.id === "exam" && a.kind === "exam",
          )?.start ||
          "9999"
        ).localeCompare(
          (b.date ? b.date + (b.time || "23:59") : "") ||
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
  const focusWeek = selectedWeek?.number ? selectedWeek : semester?.weeks.find(w=>w.kind === "teaching" && w.start >= today);
  const routineTasks = semester?.tasks.filter(t=>isRoutine(t) && (t.week === focusWeek?.number && !!focusWeek?.number)) || [];
  const closeWeeks = semester?.weeks.filter(w=>w.kind === "teaching" && w.end >= today).slice(0,2).map(w=>w.id) || [];
  const expanded = (id:string) => expandedWeeks[id] ?? closeWeeks.includes(id);
  const flipWeek = (id:string) => setExpandedWeeks(p=>({...p,[id]:!expanded(id)}));
  const soon = semester?.tasks.filter(t=>!t.done && !needsPlacement(t) && !t.rules?.optional && !/participation/i.test(t.title)
    && t.date && t.date >= today && Date.parse(t.date+"T12:00:00Z")-Date.parse(today+"T12:00:00Z") <= 7*86400000 && !isPast(t,semester,clock))
    .sort((a,b)=>((a.date||"")+(a.time||"23:59")).localeCompare((b.date||"")+(b.time||"23:59"))) || [];
  const highlighted = focus && soon.length ? soon : upcoming;
  const participationFor = (c:ClassEvent) => /tutorial/i.test(c.activity)
    ? semester?.tasks.find(t=>t.unit === c.unit && t.date === c.date && /participation/i.test(t.title)) : undefined;
  function displayTitle(t:Task) {
    if (!focus) return t.title;
    if (/lecture.*quiz/i.test(t.title)) return "Lecture quiz";
    if (/^weekly quizzes$/i.test(t.title)) return "Weekly quiz";
    if (/tutorial prework/i.test(t.title)) return "Submit prework";
    return t.title;
  }
  function displayTime(t:Task) {
    if (!focus || !t.date || t.timeBasis !== "class") return timingLabel(t);
    const day=new Date(t.date+"T12:00:00Z").toLocaleDateString("en-AU",{weekday:"short",timeZone:"UTC"});
    return t.timing.startsWith("Before") ? `${day} · before ${t.time || "class"}` : `${day} · in ${/lecture/i.test(t.timing) ? "lecture" : /lab|practical/i.test(t.timing) ? "lab" : "tutorial"}`;
  }
  function retryClasses(task: Task) {
    if (!semester || task.passed || !task.date || !task.rules?.attempts || task.rules.attempts < 2) return [];
    return semester.classes.filter(c=>c.unit === task.unit && /tutorial/i.test(c.activity) && c.date > task.date!)
      .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,task.rules.attempts - 1);
  }
  function TaskCard({
    task,
    compact = false,
  }: {
    task: Task;
    compact?: boolean;
  }) {
    return (
      <div
        className={`task-card ${task.hurdle ? "hurdle-card" : ""} ${task.done ? "is-done" : ""} ${task.series ? "recurring-card" : ""}`}
        style={{ "--unit": color(task.unit) } as React.CSSProperties}
      >
        <div className="task-top">
          <small>
            {compact
              ? task.unit
              : task.kind === "exam"
                ? "EXAM"
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
          <strong>{displayTitle(task)}</strong>
          <span>
            {displayTime(task)}
          </span>
          {task.weight && (
            <span className="weight">
              {weightLabel(task)}
            </span>
          )}
          {task.sourceConflict && <span className="source-warning">Source dates conflict</span>}
          {task.rules?.threshold && <span className="source-warning">{task.passed ? "Hurdle met (self-reported)" : `Need ≥${task.rules.threshold}% · ${task.rules.attempts || 1} attempt${task.rules.attempts === 1 ? "" : "s"}`}</span>}
          {!!task.coverage?.length && semester && <span className="scope-status">Covers {learningScope(task,semester).label} · {learningScope(task,semester).status}</span>}
        </button>
      </div>
    );
  }
  function RoutineItem({task}: {task:Task}) {
    return <div className={`routine-item ${task.done ? "is-done" : ""}`} style={{"--unit":color(task.unit)} as React.CSSProperties}>
      <Checkbox aria-label={`Mark ${task.unit} ${task.title} week ${task.week} complete`} checked={!!task.done} onCheckedChange={()=>toggleTask(task)}/>
      <button onClick={()=>openTask(task)}><strong>{displayTitle(task)}</strong><span>{displayTime(task)}</span>{!!task.coverage?.length && semester && <span className="scope-status">{learningScope(task,semester).status}</span>}</button>
      {task.rules?.perOccurrence !== undefined && <small>{task.rules.perOccurrence}%</small>}
    </div>;
  }
  return (
    <main className={focus ? "focus-layout" : "full-layout"}>
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
          {conflict ? <><p>{conflict.fields.length} conflicting field(s). Both versions remain available until you choose.</p><button onClick={()=>resolveConflict("local")}>Keep this tab’s conflicting edits</button>{" "}<button onClick={()=>resolveConflict("remote")}>Keep saved conflicting edits</button></> : <button onClick={flush}>Retry save</button>}{" "}
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
                <label className="restore-backup">Restore backup<input type="file" accept=".json,application/json" onChange={e=>void restoreBackup(e.target.files?.[0])}/></label>
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
              <button className="pending-details-button" aria-haspopup="dialog" aria-expanded={showTray} aria-controls="needs-details" onClick={() => setShowTray(true)}>Needs details ({unplaced.filter(t => !t.done).length})</button>
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
          <div className="layout-comparison" role="group" aria-label="Compare semester layouts">
            <span>Compare views</span>
            <button aria-pressed={!focus} onClick={()=>chooseLayout(false)}>A · Full overview</button>
            <button aria-pressed={focus} onClick={()=>chooseLayout(true)}>B · Focus</button>
            <small>Same tasks & progress</small>
          </div>
          <section className="coming-up">
            <div className="coming-title">
              <p className="eyebrow">{focus && soon.length ? "NEXT 7 DAYS" : "UPCOMING MILESTONES"}</p>
              <span>{highlighted.length} {focus && soon.length ? "tasks & quizzes" : "upcoming milestones"} · scroll for more</span>
              <div className="upcoming-nav"><button aria-label="Previous upcoming tasks" onClick={()=>document.getElementById("upcoming-tasks")?.scrollBy({left:-290,behavior:"smooth"})}>Previous</button><button aria-label="More upcoming tasks" onClick={()=>document.getElementById("upcoming-tasks")?.scrollBy({left:290,behavior:"smooth"})}>More</button></div>
            </div>
            <div className="upcoming-cards" id="upcoming-tasks" role="region" aria-label="Upcoming tasks, scroll horizontally" tabIndex={0}>
              {highlighted.map((t) => (
                <TaskCard key={t.id} task={t} compact />
              ))}
              {!highlighted.length && (
                <p className="muted">
                  No upcoming dated tasks. Check your undated tasks and course
                  notices.
                </p>
              )}
            </div>
          </section>
          <section className="routine-strip">
            <button aria-expanded={showRoutines} onClick={()=>setShowRoutines(!showRoutines)}>
              {focusWeek?.label || "Weekly"} routines · {routineTasks.filter(t=>!t.done).length} unrecorded <ChevronDown size={14}/>
            </button>
            <span>Participation, prework & regular quizzes stay on the board below.</span>
            {showRoutines && <div className="routine-list">{routineTasks.map(t=><div key={t.id}><small style={{color:color(t.unit)}}>{t.unit}</small><RoutineItem task={t}/></div>)}</div>}
          </section>
          {semester.tasks.filter(t=>t.hurdle && t.date && t.date < today && retryClasses(t).some(c=>c.date >= today)).map(t=><div className="hurdle-reminder" key={t.id}>
            <button onClick={()=>openTask(t)}>{t.unit} · {t.title}: hurdle not yet confirmed</button>
            <span>Possible reattempt {retryClasses(t).filter(c=>c.date >= today).map(c=>`${shortDate(c.date)} (W${c.week})`).join(" / ")} · check eligibility</span>
          </div>)}
          <div className="attention-line">
            <button
              onClick={() => {
                setShowPast(true);
                setNotice(
                  `${overdue.length} past assessments are unchecked. They may already be done—mark them complete on the board.`,
                );
              }}
            >
              Review past assessments ({overdue.length})
            </button>
            <button
              aria-haspopup="dialog" aria-expanded={showTray} onClick={() => setShowTray(true)}
            >
              {unplaced.filter((t) => !t.done).length} need details
            </button>
            <span>·</span>
            <span>Unchecked means unrecorded—not necessarily unfinished.</span>
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
          <div className="board-layout tray-closed">
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
                    {ongoing.filter(t=>t.unit === u.code).map(t=><small key={t.id}>Weekly project work · {t.weight} across semester</small>)}
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
                    className={`week-row ${selectedWeek?.id === w.id ? "current" : ""} ${w.kind !== "teaching" ? "non-teaching" : ""} ${focus && w.number && !expanded(w.id) ? "condensed-week" : ""}`}
                    key={w.id}
                  >
                    <div className="week-label">
                      <strong>{w.label}</strong>
                      {focus && w.number && <button className="week-expand" aria-label={`${expanded(w.id) ? "Collapse" : "Expand"} ${w.label}`} aria-expanded={expanded(w.id)} onClick={()=>flipWeek(w.id)}>{expanded(w.id) ? "Less" : "Details"}</button>}
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
                      const folded = focus && !!w.number && !expanded(w.id);
                      const orderedTasks = focus ? [...tasks].sort((a,b)=>((a.date||"")+(a.time||"23:59")).localeCompare((b.date||"")+(b.time||"23:59"))) : tasks;
                      const taskRows = orderedTasks.filter(t=>!focus || !learning.some(c=>participationFor(c)?.id === t.id));
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
                          {taskRows.filter(t=>!folded || !isRoutine(t)).map((t) => (
                            isRoutine(t) ? <RoutineItem key={t.id} task={t}/> : <TaskCard key={t.id} task={t} />
                          ))}
                          {folded && (tasks.some(isRoutine) || learning.length > 0) && <button className="week-summary" onClick={()=>flipWeek(w.id)}>{taskRows.filter(isRoutine).length > 0 ? `${taskRows.filter(isRoutine).length} routine task${taskRows.filter(isRoutine).length === 1 ? "" : "s"} · ` : ""}{learning.length} {learning.length === 1 ? "class" : "classes"}</button>}
                          {!folded && learning.length > 0 && (
                            <div className="learning">
                              {learning.map((c) => {
                                const participation = focus ? participationFor(c) : undefined;
                                return (
                                <div className="learning-item" key={c.id}>
                                  {!participation && <Checkbox
                                    aria-label={`Complete ${c.unit} ${c.activity} week ${c.week} ${c.date}`}
                                    checked={!!semester.completed[c.id]}
                                    onCheckedChange={() => toggleClass(c)}
                                  />}
                                  <button
                                    className={`learning-open ${!participation && semester.completed[c.id] ? "checked" : ""}`}
                                    onClick={() =>
                                      setDetail({ type: "class", event: c })
                                    }
                                  >
                                    {c.activity}
                                    {participation && <small> · {participation.done ? "participation recorded" : "participation unrecorded"}</small>}
                                  </button>
                                </div>
                              );})}
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
            <Sheet open={showTray} onOpenChange={setShowTray}><SheetContent className="detail-panel pending-panel" id="needs-details"><SheetHeader><SheetTitle>
                Needs details{" "}
                <span className="count">
                  {unplaced.filter((t) => !t.done).length}
                </span>
              </SheetTitle><SheetDescription>Dates need confirming in Canvas or Ed. Add what you know; nothing is guessed.</SheetDescription></SheetHeader><div className="pending-items">
              {unplaced.length === 0 ? (
                <p className="hint">
                  All imported tasks have a place. Keep checking course
                  announcements.
                </p>
              ) : (
                unplaced.map((t) => (
                  <div
                    key={t.id}
                    className={`unplaced ${t.done ? "is-done" : ""}`}
                    style={{ "--unit": color(t.unit) } as React.CSSProperties}
                  >
                    <small style={{ color: color(t.unit) }}>
                      {t.unit} · {weightLabel(t)}
                    </small>
                    <strong>{t.title}</strong>
                    <p>
                      {t.kind === "recurring"
                        ? "Recurring dates need checking"
                        : "No individual dates published"}
                    </p>
                    <button onClick={() => {setShowTray(false);openTask(t);setEditingTask(true);}}>Check & place</button>
                  </div>
                ))
              )}
              {!!ongoing.length && <details><summary>Ongoing work ({ongoing.length})</summary>{ongoing.map(t=><p key={t.id}><button onClick={()=>{setShowTray(false);openTask(t);}}>{t.unit} · {t.title}</button><span className="hint">{t.weight} across the semester. Track individual workshop progress on the board.</span></p>)}</details>}
              <p className="hint">
                Add dates from Canvas or Ed. No deadline is invented to fill a
                gap.
              </p>
            </div></SheetContent></Sheet>
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
              {draft.sourceConflict && <p className="notice error">{draft.sourceConflict}</p>}
              {draft.warning && (!/individual occurrences|Recurring assessment/i.test(draft.warning) || needsPlacement(draft)) && <p className="notice">{draft.warning}</p>}
              <section className="rule-card">
                {focus && <p><strong>{timingLabel(draft)}</strong></p>}
                <strong>{weightLabel(draft)}</strong>
                {draft.rules?.threshold && <p>Hurdle: at least {draft.rules.threshold}%. {draft.rules.attempts ? `Highest result across ${draft.rules.attempts} attempts counts.` : ""}</p>}
                {!!retryClasses(draft).length && <p>Possible reattempt tutorials: {retryClasses(draft).map(c=>`${shortDate(c.date)} · W${c.week}`).join("; ")}. Confirm eligibility and arrangements on Canvas.</p>}
                {(draft.series || draft.parentId || draft.kind === "recurring") && <p className="hint">{semester.tasks.filter(t=>(t.series || t.parentId) === (draft.series || draft.parentId || draft.id) && t.done).length} occurrences recorded complete. {draft.rules?.bestOf ? `Best ${draft.rules.bestOf} results count—not necessarily the first ${draft.rules.bestOf} completed.` : "Completion is not a mark or a guarantee of full credit."}</p>}
                {draft.rules?.text && <details><summary>Assessment rules from outline</summary><p>{draft.rules.text}</p></details>}
              </section>
              <AssessmentScope key={draft.id} task={draft} semester={semester} onSave={saveScope} onToggle={toggleClass}/>
              {focus && !editingTask && <>
                <p>{draft.description}</p>
                <button className="primary" onClick={()=>{const task=current.current?.tasks.find(t=>t.id === draft.id);if(task){toggleTask(task);setDraft({...draft,done:!task.done});}}}>{draft.done ? "Mark unfinished" : "Mark complete"}</button>
                {draft.source && <a href={draft.source} target="_blank" rel="noreferrer">Open assessment source</a>}
                <button onClick={()=>setEditingTask(true)}>{needsPlacement(draft) ? "Add missing details" : "Edit details"}</button>
              </>}
              <div className="task-editor" hidden={focus && !editingTask}>
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
              {draft.hurdle && <label className="inline-label"><Checkbox checked={!!draft.passed} onCheckedChange={v=>setDraft({...draft,passed:!!v})}/>I have confirmed that I met the hurdle</label>}
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
                  This edits only this occurrence. Series totals are not the weight of each individual task.
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
                      parentId: draft.id,
                      series: undefined,
                      weight: draft.rules?.perOccurrence !== undefined ? `${draft.rules.perOccurrence}%` : "",
                      date: undefined,
                      time: undefined,
                      week: undefined,
                      routine: true,
                      overrides: [],
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
            </div>
          )}
          {detail?.type === "class" && semester && (
            <div className="detail-body">
              {focus && participationFor(detail.event) && <section className="rule-card">
                <strong>Tutorial participation</strong>
                <label className="inline-label"><Checkbox checked={!!participationFor(detail.event)?.done} onCheckedChange={()=>toggleTask(participationFor(detail.event)!)} />I participated in this tutorial</label>
                <p className="hint">Your own record—not the tutor’s mark. Learning progress is separate below.</p>
                <button onClick={()=>openTask(participationFor(detail.event)!)}>View participation rules</button>
              </section>}
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
          {detail?.type === "unit" && semester && <UnitDetail key={detail.unit.code} semester={semester} unit={semester.units.find(u => u.code === detail.unit.code) || detail.unit} onToggle={toggleClass} onScope={saveScope} onOpenTask={openTask} onCatchUp={through => {
            const s = current.current;
            if (!s) return;
            const completed = {...s.completed};
            s.classes.filter(c => c.unit === detail.unit.code && /lecture/i.test(c.activity) && c.week && c.week <= through).forEach(c => completed[c.id] = true);
            commit({...s, completed});
            setNotice(`${detail.unit.code} lectures through W${through} marked watched. Individual ticks can be undone.`);
          }} />}
        </SheetContent>
      </Sheet>
    </main>
  );
}
