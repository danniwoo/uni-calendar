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
import { activeTasks, backupText, readBackup, replaceBoard, sameUnits } from "@/lib/backup";
import { registerSemesterTools } from "@/lib/browser-tools";
import { UnitDetail } from "@/components/unit-detail";
import { AssessmentList } from "@/components/assessment-list";
import { saveGrade, saveGradePlan } from "@/lib/grades";
import {CanvasImport} from "./canvas-import";
import {CanvasInbox} from "./canvas-inbox";
import {CanvasHistory} from "./canvas-history";
import {confirmCanvasImport,markCanvasGradeSeen,unreadCanvasGrades} from "@/lib/canvas-history";
import { PersonalEditor } from "@/components/personal-editor";
import { isPersonal,calendarOwns } from "@/lib/personal-items";
import { MonthCalendar } from "@/components/month-calendar";
import { WeekCalendar } from "@/components/week-calendar";
import {locationForDate} from "@/lib/week-calendar";
import { SplitAssessment } from "@/components/split-assessment";
import { AssessmentScope } from "@/components/assessment-scope";
import { AssessmentConfirm } from "@/components/assessment-confirm";
import {AssessmentDelete} from "@/components/assessment-delete";
import {deleteAssessment,undoAssessmentDeletion} from "@/lib/assessment-delete";
import { AssessmentAvailability, AvailabilitySummary } from "@/components/assessment-availability";
import { availabilityError, dateInputPatch, assessmentTiming, assessmentMetadataError } from "@/lib/assessment-schedule";
import {activityError} from "@/lib/assessment-activity";
import {ActivityEditor,ActivitySummary} from "@/components/assessment-activity";
import {version as appVersion} from "@/package.json";
import { learningScope, withCoverage } from "@/lib/learning-scope";
import { SEMESTER_LAYOUT_KEY, useFocusLayout, inNextSevenDays } from "@/lib/semester-display";

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
  | { type: "class"; event: ClassEvent };
type ApiResult = {
  semester: Semester | null;
  recovery?: Semester | null;
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
    [canvasImport,setCanvasImport] = useState(false),
    [canvasHistory,setCanvasHistory] = useState(false),
    [focusGrade,setFocusGrade] = useState<{id:string;request:number}>(),
    [importedGradeView,setImportedGradeView] = useState(0),
    [canvasRaw,setCanvasRaw] = useState<string|undefined>(),
    [detail, setDetail] = useState<Detail | null>(null),
    [subject, setSubject] = useState<{code:string;taskId?:string}|null>(null),
    [draft, setDraft] = useState<Task | null>(null),
    [personal,setPersonal] = useState<Task|null>(null),
    [calendarFocus,setCalendarFocus] = useState<{date?:string;eventId?:string;nonce:number}>(),
    [editError, setEditError] = useState(""),
    [showPast, setShowPast] = useState(false),
    [showWarnings, setShowWarnings] = useState(false),
    [showRoutines, setShowRoutines] = useState(false),
    [focus, setFocus] = useState(true),
    [view, setView] = useState<"semester"|"month"|"week"|"assessments">("semester"),
    [showTray, setShowTray] = useState(false),
    [expandedWeeks, setExpandedWeeks] = useState<Record<string,boolean>>({}),
    [editingTask, setEditingTask] = useState(false),
    [splittingTask, setSplittingTask] = useState(false),
    [stepsDirty, setStepsDirty] = useState(false),
    [taskFeedback,setTaskFeedback] = useState(""),
    [discardAssessment,setDiscardAssessment] = useState<"close"|"edit"|null>(null),
    [assessmentUndo,setAssessmentUndo] = useState<{before:Semester;after:Semester;taskId:string}|null>(null),
    [deletedAssessment,setDeletedAssessment] = useState<{before:Semester;after:Semester;title:string}|null>(null),
    [newRecurring, setNewRecurring] = useState(false),
    [conflict, setConflict] = useState<{remote:Semester; revision:number; fields:string[]} | null>(null),
    [transfer, setTransfer] = useState<{board:Semester; kind:"backup"|"import"} | null>(null),
    [recovery, setRecovery] = useState<Semester | null>(null),
    [clock, setClock] = useState(() => new Date());
  const current = useRef<Semester | null>(null),
    baseline = useRef<Semester | null>(null),
    revision = useRef(0),
    pending = useRef<Semester | null>(null),
    saving = useRef(false);
  const detailPanel=useRef<HTMLDivElement>(null);
  const [stepRequest,setStepRequest]=useState<string|undefined>();
  useEffect(()=>{setFocusGrade(undefined);setCanvasHistory(false);},[semester?.year,semester?.session,semester?.boardGeneration]);
  const unsavedAssessment=useRef(false);
  unsavedAssessment.current=!!(detail?.type==="task"&&(stepsDirty || (draft&&JSON.stringify(draft)!==JSON.stringify(detail.task))));
  useEffect(()=>{if(detailPanel.current)detailPanel.current.scrollTop=0;},[draft?.id,editingTask,splittingTask]);
  const today = sydneyDate(clock);
  const calendarView=view==="month"||view==="week";
  const draftChildren=draft ? semester?.tasks.filter(t=>t.parentId===draft.id||t.series===draft.id)||[] : [];
  const draftGroup=!!draft?.splitCount||draftChildren.length>0;
  useEffect(()=>{try {setFocus(useFocusLayout(localStorage.getItem(SEMESTER_LAYOUT_KEY)));} catch {}},[]);
  useEffect(()=>{try {const saved=localStorage.getItem("semester-view");if(saved==="month"||saved==="week"||saved==="assessments")setView(saved);} catch {}},[]);
  function chooseView(next:"semester"|"month"|"week"|"assessments") {setCalendarFocus(undefined);setView(next);try {localStorage.setItem("semester-view",next);} catch {}}
  function chooseLayout(next:boolean) {setFocus(next);try {localStorage.setItem(SEMESTER_LAYOUT_KEY,next ? "focus" : "full");} catch {}}
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
      setRecovery(j.recovery || null);
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
        (t) => { if(!unsavedAssessment.current)openTask(t); },
      ),
    [],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current || saving.current || unsavedAssessment.current) {
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
            syncVersion: 9,
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
            throw new Error(merged.conflicts[0]?.startsWith("Whole board")
              ? "Another tab restored or switched boards. These boards will not be merged. Export this tab before choosing which complete board to keep."
              : "Another tab changed the same information. Choose which conflicting edits to keep; unrelated changes are preserved.");
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
      const old = current.current;
      if (old && (old.feedUrl !== j.semester.feedUrl || old.year !== j.semester.year || old.session !== j.semester.session)) {
        setTransfer({board:j.semester,kind:"import"});
        return;
      }
      const next = old ? mergeSemester(old,j.semester) : replaceBoard(j.semester,crypto.randomUUID());
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
    if(s&&(t.splitCount||s.tasks.some(x=>x.parentId===t.id||x.series===t.id)))return;
    if (s)
      commit({
        ...s,
        tasks: s.tasks.some(x=>x.id===t.id) ? s.tasks.map((x) =>
          x.id === t.id ? { ...x, done: !x.done } : x,
        ) : s.units.some(u=>u.assessments.some(a=>a.id===t.id)) ? [...s.tasks,{...t,done:!t.done}] : s.tasks,
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
    setStepRequest(undefined);
    if(isPersonal(t)){setDetail(null);setPersonal(t);return;}
    setSplittingTask(false);
    setStepsDirty(false);
    setTaskFeedback("");
    setNewRecurring(false);
    setEditingTask(false);
    setDetail({ type: "task", task: t });
    setDraft({ ...t });
    setEditError("");
  }
  function closeAssessment() {
    if(unsavedAssessment.current){setDiscardAssessment("close");return;}
    finishCloseAssessment();
  }
  function finishCloseAssessment() {
    setDetail(null);setDraft(null);setStepsDirty(false);setSplittingTask(false);setTaskFeedback("");
  }
  function cancelAssessmentEdit() {
    if(unsavedAssessment.current){setDiscardAssessment("edit");return;}
    finishCancelAssessmentEdit();
  }
  function finishCancelAssessmentEdit() {
    const original=semester?.tasks.find(t=>t.id===draft?.id);
    if(original){setDraft({...original});setDetail({type:"task",task:original});setEditingTask(false);setEditError("");}
    else {setDetail(null);setDraft(null);setEditError("");}
  }
  function saveAssessmentPlan(next:Semester) {
    const before=current.current;if(!before||!draft)return;
    setAssessmentUndo({before,after:next,taskId:draft.id});commit(next);
    const parent=next.tasks.find(t=>t.id===draft.id)!;
    setDraft({...parent});setDetail({type:"task",task:parent});setStepsDirty(false);setTaskFeedback("Steps updated.");
  }
  function undoAssessmentPlan() {
    if(!assessmentUndo||!current.current)return;
    const result=reconcile(assessmentUndo.after,assessmentUndo.before,current.current);
    if(result.conflicts.length){setEditError("These steps changed again. Reopen Edit steps to review them; undo would overwrite newer changes.");return;}
    commit(result.semester);const parent=result.semester.tasks.find(t=>t.id===assessmentUndo.taskId)!;
    setDraft({...parent});setDetail({type:"task",task:parent});setAssessmentUndo(null);setTaskFeedback("Step changes undone.");
  }
  function removeAssessment(id:string,reviewed:Semester) {
    const before=current.current;
    if(!before||busy||conflict||saveError)throw new Error("Resolve the current save or board warning before deleting.");
    const after=deleteAssessment(before,id,reviewed);
    const title=before.tasks.find(t=>t.id===id)!.title;
    commit(after);setDeletedAssessment({before,after,title});setAssessmentUndo(null);
    setNotice("");setSubject(null);setEditingTask(false);setNewRecurring(false);finishCloseAssessment();
  }
  function undoDeletedAssessment() {
    if(!deletedAssessment||!current.current)return;
    try {
      if(busy||conflict||saveError)throw new Error("Resolve the current save or board warning before undoing.");
      commit(undoAssessmentDeletion(deletedAssessment.before,deletedAssessment.after,current.current));
      setDeletedAssessment(null);setNotice("Assessment restored.");
    } catch(e) {setNotice(e instanceof Error?e.message:"Could not undo deletion.");}
  }
  function openPreparation(t: Task) {
    setDetail(null);
    setSubject({code:t.unit,taskId:t.id});
  }
  function newTask() {
    setPersonal({id:`manual-${crypto.randomUUID()}`,kind:"task",unit:subject?.code||"",title:"",weight:"",timing:"Personal task",description:"",source:"",sourceText:"",hurdle:false,group:false,manual:true});
  }
  function newAssessment(unit?:string) {
    if (!semester) return;
    openTask({
      id: `manual-${crypto.randomUUID()}`,
      unit: unit || subject?.code || semester.units[0]?.code || "",
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
    const availabilityIssue = availabilityError(draftGroup ? {...draft,date:undefined,time:undefined} : draft);
    if (availabilityIssue) { setEditError(availabilityIssue); return; }
    const activityIssue = activityError(draft.activity,semester);
    if (activityIssue) { setEditError(activityIssue); return; }
    const metadataIssue = assessmentMetadataError(semester,draft);
    if (metadataIssue) { setEditError(metadataIssue); return; }
    if (!draft.title.trim()) {
      setEditError("Give this task a name.");
      return;
    }
    if (!draftGroup && draft.time && !draft.date) {
      setEditError("Choose a date for the time, or leave both unknown.");
      return;
    }
    if (
      !draftGroup && draft.date &&
      !semester.weeks.some(
        (w) => draft.date! >= w.start && draft.date! <= w.end,
      )
    ) {
      setEditError(
        "Choose a date within this semester, including its exam period.",
      );
      return;
    }
    const originalTask = semester.tasks.find(t=>t.id===draft.id);
    const preservedDueWeek = draft.date === originalTask?.date && draft.time === originalTask?.time ? draft.dueWeek : undefined;
    const week = preservedDueWeek || (draft.date ? weekFor(draft.date, semester.weeks) : draft.week);
    if (!draftGroup && draft.startWeek && week && draft.startWeek > week) {
      setEditError("Your planned start must be before the due week.");
      return;
    }
    const previous = semester.tasks.find(t=>t.id === draft.id) || semester.units.flatMap(u=>u.assessments).find(t=>t.id===draft.id);
    const edited = { ...draft, grade:previous?.grade, gradePlan:previous?.gradePlan, title: draft.title.trim(), week, dueWeek:preservedDueWeek, ...(draftGroup ? {splitCount:draftChildren.length||draft.splitCount,date:undefined,time:undefined,week:undefined,dueWeek:undefined} : {}) };
    const keys = ["title","unit","weight","week","date","time","startWeek","coverage","description","passed","dueWeek","availableFrom","availableFromTime","availableUntil","availableUntilTime","splitCount","activity"];
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
    setDraft({...next});setDetail({type:"task",task:next});setEditingTask(false);setTaskFeedback("Assessment updated.");
  }
  function saveScope(task: Task, weeks: number[]) {
    const s = current.current;
    if (!s) return;
    const existing = s.tasks.find(t => t.id === task.id);
    const updated = withCoverage(existing || task, weeks);
    commit({...s, tasks: existing ? s.tasks.map(t=>t.id === task.id ? updated : t) : [...s.tasks,updated]});
    setDraft(prev=>prev?.id === task.id ? withCoverage(prev,weeks) : prev);
    setDetail(prev=>prev?.type==="task"&&prev.task.id===task.id?{type:"task",task:updated}:prev);
  }
  function downloadBackup(snapshot:Semester, prefix="semester") {
    const blob = new Blob(
      [backupText(snapshot)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${prefix}-${snapshot.year}-${snapshot.session}-${new Date().toISOString().replace(/[:.]/g,"-")}.backup.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function backup() { if (current.current) downloadBackup(current.current); }
  async function restoreBackup(file?: File) {
    if (!file || busy || !loaded) return;
    try {
      if(file.size > 1500000) throw new Error("Backup is too large (maximum 1.5 MB).");
      setTransfer({board:readBackup(await file.text()),kind:"backup"});
    } catch(e) {setNotice(e instanceof Error ? e.message : "Backup could not be read.");}
  }
  function applyTransfer(reconnect=false) {
    if (!transfer || saving.current || pending.current || conflict) return;
    const old = current.current;
    if (reconnect && (!old || transfer.kind !== "import" || !sameUnits(old,transfer.board))) return;
    if (old) setRecovery(structuredClone(old));
    const next = reconnect && old
      ? mergeSemester({...old,feedUrl:transfer.board.feedUrl},transfer.board)
      : replaceBoard(transfer.board,crypto.randomUUID());
    commit(next);
    setDetail(null);setDraft(null);setSettings(false);setShowTray(false);setUrl("");
    setNotice(reconnect ? "Timetable connected to this board. Your edits and progress were kept."
      : transfer.kind === "backup" ? `Complete backup restored. Classes, units, tasks and checkmarks now come from the same backup.${next.feedUrl ? "" : " Reconnect its timetable link in Manage to refresh classes."}`
      : "Switched to the new timetable. Previous tasks and progress were not mixed in.");
    setTransfer(null);
  }
  const selectedWeek = semester?.weeks.find(
    (w) => w.start <= today && w.end >= today,
  );
  const color = (unit: string) =>
    COLORS[
      Math.max(0, semester?.units.findIndex((u) => u.code === unit) ?? 0) %
        COLORS.length
    ];
  const boardTasks = semester ? activeTasks(semester).filter(t=>!isPersonal(t)) : [];
  const retainedCount = semester?.tasks.filter(t=>!calendarOwns(semester,t)).length || 0;
  const undated = boardTasks.filter(needsPlacement);
  const ongoing = undated.filter(t=>t.routine && /ongoing/i.test(t.sourceText));
  const unplaced = undated.filter(t=>!ongoing.includes(t));
  const overdue =
    boardTasks.filter(
      (t) =>
        !t.done &&
        !!semester && isPast(t,semester,clock),
    ) || [];
  const upcoming =
    boardTasks
      .filter(
        (t) =>
          !!semester && !t.done &&
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
  const routineTasks = boardTasks.filter(t=>isRoutine(t) && (t.week === focusWeek?.number && !!focusWeek?.number));
  const closeWeeks = semester?.weeks.filter(w=>w.kind === "teaching" && w.end >= today).slice(0,2).map(w=>w.id) || [];
  const expanded = (id:string) => expandedWeeks[id] ?? closeWeeks.includes(id);
  const flipWeek = (id:string) => setExpandedWeeks(p=>({...p,[id]:!expanded(id)}));
  const soon = boardTasks.filter(t=>!!semester && !t.done && !needsPlacement(t) && !t.rules?.optional && !/participation/i.test(t.title)
    && inNextSevenDays(t.date, today) && !isPast(t,semester,clock))
    .sort((a,b)=>((a.date||"")+(a.time||"23:59")).localeCompare((b.date||"")+(b.time||"23:59"))) || [];
  const highlighted = focus && soon.length ? soon : upcoming;
  const participationFor = (c:ClassEvent) => /tutorial/i.test(c.activity)
    ? semester?.tasks.find(t=>!isPersonal(t) && t.unit === c.unit && t.date === c.date && /participation/i.test(t.title)) : undefined;
  function displayTitle(t:Task) {
    if (!focus) return t.title;
    if (/lecture.*quiz/i.test(t.title)) return "Lecture quiz";
    if (/^weekly quizzes$/i.test(t.title)) return "Weekly quiz";
    if (/tutorial prework/i.test(t.title)) return "Submit prework";
    return t.title;
  }
  function displayTime(t:Task, includeDate = false) {
    if (includeDate && !t.date && t.week) return `Week ${t.week} · Day & time TBC`;
    if (!focus || !t.date || t.timeBasis !== "class") return timingLabel(t);
    const day=new Date(t.date+"T12:00:00Z").toLocaleDateString("en-AU",{weekday:"short",timeZone:"UTC"}) + (includeDate ? ` ${shortDate(t.date)}` : "");
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
        className={`task-card ${task.hurdle ? "hurdle-card" : ""} ${task.done ? "is-done" : ""} ${task.series ? "recurring-card" : ""} ${compact && isRoutine(task) && !task.hurdle ? "upcoming-routine" : ""}`}
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
          <strong>{compact && <span className="compact-task-unit">{task.unit}{task.hurdle ? " · HURDLE" : ""} · </span>}{displayTitle(task)}</strong>
          <span className="task-timing">
            {displayTime(task, compact)}
          </span>
          {task.weight && !(compact && isRoutine(task) && !task.hurdle) && (
            <span className="weight">
              {weightLabel(task)}
            </span>
          )}
          {task.sourceConflict && <span className="source-warning">Source dates conflict</span>}
          {task.rules?.threshold && <span className="source-warning">{task.passed ? "Hurdle met (self-reported)" : `Need ≥${task.rules.threshold}% · ${task.rules.attempts || 1} attempt${task.rules.attempts === 1 ? "" : "s"}`}</span>}
        </button>
        {!!task.coverage?.length && semester && <button className="preparation-link" onClick={()=>openPreparation(task)}>{learningScope(task,semester).status} →</button>}
      </div>
    );
  }
  function RoutineItem({task}: {task:Task}) {
    return <div className={`routine-item ${task.done ? "is-done" : ""}`} style={{"--unit":color(task.unit)} as React.CSSProperties}>
      <Checkbox aria-label={`Mark ${task.unit} ${task.title} week ${task.week} complete`} checked={!!task.done} onCheckedChange={()=>toggleTask(task)}/>
      <button onClick={()=>openTask(task)}><strong>{displayTitle(task)}</strong><span className="routine-timing">{displayTime(task)}</span></button>
      {task.rules?.perOccurrence !== undefined && <small>{task.rules.perOccurrence}%</small>}
      {!!task.coverage?.length && semester && <button className="preparation-link" onClick={()=>openPreparation(task)}>{learningScope(task,semester).status} →</button>}
    </div>;
  }
  return (
    <main className={`${focus ? "focus-layout" : "full-layout"}${calendarView||view==="assessments" ? " calendar-layout" : ""}${view==="week"&&semester&&!settings?" week-layout":""}`}>
      <header className={semester ? "board-header semester-header" : ""}>
        <div className="wordmark">
          <CalendarDays /> semester <small>USYD</small>
        </div>
        {semester && <div className="calendar-view-switch header-view-switch" role="group" aria-label="Board view">{(["semester","month","week","assessments"] as const).map(v=><button key={v} aria-pressed={view===v} onClick={()=>chooseView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}<select className="mobile-board-view" aria-label="Board view" value={view} onChange={e=>chooseView(e.target.value as typeof view)}><option value="semester">Semester</option><option value="month">Month</option><option value="week">Week</option><option value="assessments">Assessments</option></select></div>}
        {semester && <div className="semester-nav-context"><h1>Semester {semester.session === "S2C" ? 2 : 1} {semester.year}</h1><span>{shortDate(today)} · {selectedWeek?.label || "Outside teaching weeks"} · Sydney</span></div>}
        <div className="header-actions">
          {semester && <select className="subject-picker" aria-label="Open subject overview" value="" onChange={e=>{if(e.target.value){setDetail(null);setSubject({code:e.target.value});}}}><option value="" disabled>Subjects</option>{semester.units.map(u=><option key={u.code} value={u.code}>{u.code}</option>)}</select>}
          {semester && <button className="primary header-add-task" aria-label="Add task" title="Add task" onClick={newTask}><Plus size={20} aria-hidden="true"/></button>}
          <span
            className={`save-state ${saveError ? "danger" : ""} ${saveStatus === "Saved" ? "is-saved" : ""}`}
            role="status"
          >
            {saveStatus === "Saved" && <Check size={14} />} {saveStatus}
          </span>
          {semester && (
            <button onClick={() => setSettings(!settings)}>Manage</button>
          )}
        </div>
      </header>
      {semester&&!loadError&&<CanvasInbox semester={semester} reviewOpen={canvasImport} onReview={raw=>{setCanvasRaw(raw);setCanvasImport(true);}}/>}
      {semester&&!loadError&&unreadCanvasGrades(semester).size>0&&<div className="canvas-history-notice"><button onClick={()=>setCanvasHistory(true)}><span className="canvas-new-dot" aria-hidden="true"/>{unreadCanvasGrades(semester).size} assessments have unseen Canvas grade updates · View history</button></div>}
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
          {conflict ? <><p>{conflict.fields[0]?.startsWith("Whole board") ? "Choose one complete board. Tasks and checkmarks will not be combined." : `${conflict.fields.length} conflicting field(s). Both versions remain available until you choose.`}</p><button onClick={()=>resolveConflict("local")}>{conflict.fields[0]?.startsWith("Whole board") ? "Keep this tab’s whole board" : "Keep this tab’s conflicting edits"}</button>{" "}<button onClick={()=>resolveConflict("remote")}>{conflict.fields[0]?.startsWith("Whole board") ? "Use the saved whole board" : "Keep saved conflicting edits"}</button></> : <button onClick={flush}>Retry save</button>}{" "}
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
                <label className="restore-backup">Restore backup<input type="file" disabled={busy} accept=".json,application/json" onChange={e=>{void restoreBackup(e.target.files?.[0]);e.target.value="";}}/></label>
                <button disabled={busy || saveStatus==="Saving…" || !!saveError || !!conflict} onClick={()=>{setCanvasRaw(undefined);setCanvasImport(true);}}>Import from Semester Connect</button>
                <button onClick={()=>setCanvasHistory(true)}>Canvas update history</button>
              </div>
            )}
            {!semester && loaded && <label className="restore-backup">Restore backup instead<input type="file" disabled={busy} accept=".json,application/json" onChange={e=>{void restoreBackup(e.target.files?.[0]);e.target.value="";}}/></label>}
            {semester && !semester.feedUrl && <p className="notice">This board has no connected timetable link. Its saved classes remain visible. Paste this board’s link above, then choose “Connect to this board” to enable refresh.</p>}
            {!!retainedCount && <p className="notice">{retainedCount} retained tasks belong to units outside this timetable. They are excluded from all calendar summaries, but kept in your export. To repair an earlier mixed restore, restore the original clean backup; this will replace the complete board.</p>}
            {recovery && <div className="rule-card"><strong>Before the last switch · {recovery.session} {recovery.year}</strong><p>{recovery.units.map(u=>u.code).join(" · ")}</p><button onClick={()=>downloadBackup(recovery,"before-switch")}>Download previous board</button>{" "}<button onClick={()=>setTransfer({board:recovery,kind:"backup"})}>Review previous board</button><p className="hint">After saving, this recovery copy stays in your account across reloads. Only the previous board is kept; the next switch replaces this recovery copy. Export it to keep it longer. Subscription links are not included in exports.</p></div>}
          </div>
        </section>
      )}
      {deletedAssessment && <div className="notice" role="status">
        Deleted “{deletedAssessment.title}” and any steps.{" "}
        <button type="button" disabled={busy||!!conflict||!!saveError} onClick={undoDeletedAssessment}>Undo delete</button>{" "}
        <button type="button" onClick={()=>setDeletedAssessment(null)}>Dismiss</button>
      </div>}
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
          <div hidden={view!=="assessments"}><AssessmentList key={`assessments-${semester.year}-${semester.session}-${semester.boardGeneration}`} semester={semester} today={today} focusGrade={focusGrade} importedGradeView={importedGradeView} onHistory={()=>setCanvasHistory(true)} onGradeSeen={id=>{const s=current.current;if(!s||saveError||conflict)return;const next=markCanvasGradeSeen(s,id);if(next!==s)commit(next);}} onOpen={openTask} onToggle={toggleTask} onAdd={newAssessment} onGrade={(id,grade,expected)=>{const s=current.current;if(!s)throw new Error("Board is not available. Reopen this assessment.");commit(saveGrade(s,id,grade,expected));}} onGradePlan={(id,plan,expected)=>{const s=current.current;if(!s)throw new Error("Board is not available. Reopen this assessment.");commit(saveGradePlan(s,id,plan,expected));}}/></div>
          {view==="assessments" ? null : view==="week" ? <WeekCalendar key={`${semester.year}-${semester.session}-${semester.boardGeneration}`} semester={semester} focusItem={calendarFocus} today={today} now={clock} onTask={openTask} onPreparation={openPreparation} onClass={event=>setDetail({type:"class",event})} onToggleTask={toggleTask} onToggleClass={toggleClass}/> : calendarView ? <MonthCalendar key={`${semester.year}-${semester.session}-${semester.boardGeneration}`} semester={semester} today={today} onTask={openTask} onPreparation={openPreparation} onClass={event=>setDetail({type:"class",event})} onToggleTask={toggleTask} onToggleClass={toggleClass}/> : <>
          <div className="semester-controls"><select className="mobile-layout-choice" aria-label="Semester layout" value={focus?"focus":"full"} onChange={e=>chooseLayout(e.target.value==="focus")}><option value="focus">A · Focus</option><option value="full">B · Full overview</option></select><div className="layout-comparison" role="group" aria-label="Compare semester layouts">
            <button aria-pressed={focus} onClick={()=>chooseLayout(true)}>A · Focus</button>
            <button aria-pressed={!focus} onClick={()=>chooseLayout(false)}>B · Full overview</button>
          </div><div className="toolbar"><button className="pending-details-button" aria-haspopup="dialog" aria-expanded={showTray} aria-controls="needs-details" onClick={()=>setShowTray(true)}>Needs details ({unplaced.filter(t=>!t.done).length})</button><button onClick={()=>document.getElementById(selectedWeek?.id || "exam")?.scrollIntoView({behavior:"smooth",block:"start"})}>This week</button></div></div>
          <section className="coming-up">
            <div className="coming-title">
              <p className="eyebrow">{focus && soon.length ? "NEXT 7 DAYS" : "UPCOMING MILESTONES"}</p>
              <span>{highlighted.length} {focus && soon.length ? "tasks & quizzes" : "upcoming milestones"}</span>
            </div>
            <div className="upcoming-cards" id="upcoming-tasks" role="region" aria-label="Upcoming tasks" tabIndex={0}>
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
            {showRoutines && <div className="routine-list">{routineTasks.map(t=><div key={t.id}><small style={{color:color(t.unit)}}>{t.unit}</small><RoutineItem task={t}/></div>)}</div>}
          </section>
          {boardTasks.filter(t=>t.hurdle && t.date && t.date < today && retryClasses(t).some(c=>c.date >= today)).map(t=><div className="hurdle-reminder" key={t.id}>
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
            <button onClick={() => setShowWarnings(!showWarnings)}>
              Import details <ChevronDown size={14} />
            </button>
          </div>
          {showWarnings && (
            <section className="notice">
              <p>Unchecked means unrecorded—not necessarily unfinished. Both layouts share tasks and progress. A uses the repeat-pattern submissions editor; B uses individual dates.</p>
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
                    onClick={() => setSubject({code:u.code})}
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
                          !isPersonal(t) && t.unit === u.code && !t.splitCount &&
                          (t.dueWeek ? t.dueWeek === w.number : t.date
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
                          !isPersonal(t) && t.unit === u.code &&
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
                            onClick={() => setSubject({code:u.code})}
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
          </>}
          {(!calendarView||settings)&&<footer>
            <a
              href="https://www.sydney.edu.au/students/key-dates.html"
              target="_blank"
              rel="noreferrer"
            >
              USYD teaching calendar
            </a>{" "}
            · Times are Australia/Sydney. Breaks pause teaching-week numbering.{" "}
            <button onClick={backup}>Export backup</button>
            <span> · Semester v{appVersion}</span>
          </footer>}
        </>
      )}
      <Sheet open={canvasHistory} onOpenChange={setCanvasHistory}><SheetContent className="detail-panel canvas-import-panel"><SheetHeader><SheetTitle>Canvas update history</SheetTitle><SheetDescription>Confirmed changes, separate from pending previews.</SheetDescription></SheetHeader>{semester&&<CanvasHistory semester={semester} onOpenGrade={id=>{setCanvasHistory(false);setSettings(false);chooseView("assessments");setFocusGrade({id,request:Date.now()});}}/>}</SheetContent></Sheet>
      <Sheet open={canvasImport} onOpenChange={setCanvasImport}>
        <SheetContent className="detail-panel canvas-import-panel"><SheetHeader><SheetTitle>Import from Canvas</SheetTitle><SheetDescription>Prepared for you. Change a suggestion if needed, then Import to save.</SheetDescription></SheetHeader>
          {semester&&canvasImport&&<CanvasImport initialRaw={canvasRaw} semester={semester} onClose={()=>setCanvasImport(false)} onApply={(bundle,choices,expected)=>{
            const s=current.current;
            if(!s||s!==expected||busy||saving.current||pending.current||saveError||conflict)throw new Error("The board changed or has unsaved edits. Finish saving, then review the import again.");
            const result=confirmCanvasImport(s,bundle,choices,crypto.randomUUID());
            if(!result.changed)throw new Error("No new changes to import.");
            commit(result.semester);setFocusGrade(undefined);setImportedGradeView(Date.now());chooseView("assessments");setSettings(false);
            setNotice(`${result.changed} Canvas changes imported; check the save status. Your manual data was kept. Future checks remember these connections.`);
          }}/>}
        </SheetContent>
      </Sheet>
      <Sheet open={!!transfer} onOpenChange={o=>{if(!o)setTransfer(null);}}>
        <SheetContent className="detail-panel"><SheetHeader><SheetTitle>{transfer?.kind === "backup" ? "Restore a complete board" : "A different timetable"}</SheetTitle><SheetDescription>Review before changing your saved board. Nothing changes until you confirm.</SheetDescription></SheetHeader>
          {transfer && <div className="detail-body">
            {semester && <section className="rule-card"><p className="eyebrow">CURRENT BOARD</p><strong>{semester.session === "S1C" ? "Semester 1" : "Semester 2"} {semester.year}</strong><p>{semester.units.map(u=>u.code).join(" · ")}</p></section>}
            <section className="rule-card"><p className="eyebrow">{transfer.kind === "backup" ? "BACKUP TO RESTORE" : "NEW TIMETABLE"}</p><strong>{transfer.board.session === "S1C" ? "Semester 1" : "Semester 2"} {transfer.board.year}</strong><p>{transfer.board.units.map(u=>u.code).join(" · ")}</p><p className="hint">{transfer.board.classes.length} classes · {transfer.board.tasks.filter(t=>!t.splitCount).length} tasks · {transfer.board.tasks.filter(t=>t.done&&!t.splitCount).length} tasks completed</p></section>
            <p>{transfer.kind === "backup" ? "Restore this snapshot’s units, classes, tasks and checkmarks together. It replaces the current board; it does not add tasks to it." : "Switch to this timetable as a separate board. Tasks and checkmarks from your current board will not carry over."}</p>
            {transfer.kind === "backup" && !transfer.board.feedUrl && <p className="hint">Backups omit private timetable links. Saved classes work immediately; reconnect the correct link later in Manage.</p>}
            {transfer.kind === "backup" && transfer.board.tasks.some(t=>!calendarOwns(transfer.board,t)) && <p className="notice">This backup already contains tasks outside its unit list. They will stay in the export, not the calendar. Use a clean original backup if this came from an earlier mixed restore.</p>}
            {semester && <p className="hint">Your current board will be saved as the previous board in Manage. Only one recovery copy is kept. You can also <button onClick={backup}>Export current board</button> before proceeding.</p>}
            <button className="primary" disabled={busy || saveStatus==="Saving…" || !!saveError} onClick={()=>applyTransfer()}>{transfer.kind === "backup" ? "Restore this board" : "Switch to this board"}</button>
            {semester && transfer.kind === "import" && sameUnits(semester,transfer.board) && <section className="rule-card"><strong>Is this an updated link for the same board?</strong><p className="hint">The semester and unit codes match. Only choose this if it is your same timetable—not another student’s. Keeps your progress and manual edits while updating classes.</p><button disabled={busy || saveStatus==="Saving…" || !!saveError} onClick={()=>applyTransfer(true)}>Connect to this board</button></section>}
            {!!saveError && <p className="notice error">Resolve the save warning before replacing the board.</p>}
            <button onClick={()=>setTransfer(null)}>Cancel — keep current board</button>
          </div>}
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) closeAssessment();
        }}
      >
        <SheetContent ref={detailPanel} className="detail-panel assessment-panel">
          {discardAssessment&&<AssessmentConfirm title="Discard unsaved changes?" description="Your saved assessment will stay unchanged." action="Discard changes" onCancel={()=>setDiscardAssessment(null)} onConfirm={()=>{const intent=discardAssessment;setDiscardAssessment(null);if(intent==="close")finishCloseAssessment();else finishCancelAssessmentEdit();}}/>}
          {subject && <button className="subject-back" onClick={closeAssessment}>← Back to {subject.code}</button>}
          <SheetHeader>
            <SheetTitle>
              {detail?.type === "class"
                  ? `${detail.event.activity} · Week ${detail.event.week || "—"}`
                  : draft?.title || "Add a task"}
            </SheetTitle>
            <SheetDescription>
              {detail?.type === "class"
                  ? detail.event.unit
                  : draft?.unit}
            </SheetDescription>
          </SheetHeader>
          {detail?.type === "task" && draft && semester && (
            <div className="detail-body">
              {taskFeedback&&!editingTask&&!splittingTask&&<p className="hint" role="status">{taskFeedback} {saveStatus==="Saving…"?"Saving…":saveStatus==="Saved"?"Saved.":""}</p>}
              {saveError&&<p className="error" role="alert">Changes are not saved: {saveError}</p>}
              {draft.parentId&&!editingTask&&!splittingTask&&semester.tasks.some(t=>t.id===draft.parentId)&&<button className="assessment-parent" onClick={()=>openTask(semester.tasks.find(t=>t.id===draft.parentId)!)}>← {semester.tasks.find(t=>t.id===draft.parentId)!.title}</button>}
              {assessmentUndo?.taskId===draft.id&&!editingTask&&!splittingTask&&<button className="assessment-undo" onClick={undoAssessmentPlan}>Undo last step changes</button>}
              {editError&&!editingTask&&!splittingTask&&<p role="alert" className="error">{editError}</p>}
              {!semester.tasks.some(t=>t.id===draft.id) && !semester.units.some(u=>u.assessments.some(t=>t.id===draft.id)) && <div className="task-mode" aria-label="Task frequency"><button aria-pressed={!newRecurring} onClick={()=>setNewRecurring(false)}>One-off task</button><button aria-pressed={newRecurring} onClick={()=>setNewRecurring(true)}>Repeating task</button></div>}
              {newRecurring ? <SplitAssessment key={`repeat-${draft.id}`} recurring task={draft} semester={semester} onOpen={openTask} onCancel={()=>setNewRecurring(false)} onSave={next=>{commit(next);setDetail(null);setDraft(null);setNewRecurring(false);setNotice("Repeating tasks created. Each occurrence can be checked off or edited separately.");}}/> : <>
              {draft.sourceConflict && <p className="notice error">{draft.sourceConflict}</p>}
              {draft.warning && (!/individual occurrences|Recurring assessment/i.test(draft.warning) || needsPlacement(draft)) && <p className="notice">{draft.warning}</p>}
              {(semester.tasks.some(t=>t.id===draft.id)||semester.units.some(u=>u.assessments.some(t=>t.id===draft.id))) && !splittingTask && !editingTask && <section className="rule-card">
                <p><strong>{draftGroup?`${draftChildren.length||draft.splitCount} steps · see schedule below`:draft.parentId||draft.activity?assessmentTiming(draft):timingLabel(draft)}</strong></p>
                <strong>{weightLabel(draft)}</strong>
                <AvailabilitySummary task={draft}/>
                <ActivitySummary task={draft}/>
                {draft.rules?.threshold && <p>Hurdle: at least {draft.rules.threshold}%. {draft.rules.attempts ? `Highest result across ${draft.rules.attempts} attempts counts.` : ""}</p>}
                {!!retryClasses(draft).length && <p>Possible reattempt tutorials: {retryClasses(draft).map(c=>`${shortDate(c.date)} · W${c.week}`).join("; ")}. Confirm eligibility and arrangements on Canvas.</p>}
                {(draft.series || draft.kind === "recurring") && <p className="hint">{semester.tasks.filter(t=>(t.series || t.parentId) === (draft.series || draft.parentId || draft.id) && t.done).length} occurrences recorded complete. {draft.rules?.bestOf ? `Best ${draft.rules.bestOf} results count—not necessarily the first ${draft.rules.bestOf} completed.` : "Completion is not a mark or a guarantee of full credit."}</p>}
                {draft.rules?.text && <details><summary>Assessment rules from outline</summary><p>{draft.rules.text}</p></details>}
              </section>}
              {draftGroup&&!editingTask&&!splittingTask&&<button className="primary" onClick={()=>{setTaskFeedback("");setEditingTask(true);}}>Edit assessment</button>}
              {(semester.tasks.some(t=>t.id===draft.id)||draftChildren.length>0) && !editingTask && <SplitAssessment key={`split-${draft.id}-${stepRequest||""}`} task={draft} semester={semester} focusStepId={stepRequest} onDirtyChange={setStepsDirty} onModeChange={open=>{setSplittingTask(open);if(!open)setStepRequest(undefined);}} onOpen={openTask} onSave={saveAssessmentPlan}/>}
              {!splittingTask && <>
              {!editingTask && <>
                {draft.parentId&&!draft.series&&!draft.routine&&<button onClick={()=>{const parent=semester.tasks.find(t=>t.id===draft.parentId);if(parent){const id=draft.id;openTask(parent);setStepRequest(id);setSplittingTask(true);}}}>Edit step schedule</button>}
                {!draftGroup&&<div className="assessment-actions"><button className="primary" onClick={()=>{setTaskFeedback("");setEditingTask(true);}}>{needsPlacement(draft) ? "Add missing details" : "Edit details"}</button><button onClick={()=>{const task=current.current?.tasks.find(t=>t.id === draft.id)||draft;toggleTask(task);const updated={...draft,done:!task.done};setDraft(updated);setDetail({type:"task",task:updated});}}>{draft.done ? "Mark unfinished" : "Mark complete"}</button></div>}
                {draft.date&&<button onClick={()=>{setDetail(null);setDraft(null);setSubject(null);chooseView("week");setCalendarFocus({date:draft.date,nonce:Date.now()});}}>View in Week</button>}
                {!draftGroup&&(!draft.parentId||!!draft.coverage?.length)&&semester.tasks.some(t=>t.id===draft.id) && <AssessmentScope key={draft.id} task={draft} semester={semester} onSave={saveScope} onToggle={toggleClass}/>}
                {!!draft.parentId&&!draft.coverage?.length&&<details><summary>Preparation scope · optional</summary><AssessmentScope key={draft.id} task={draft} semester={semester} onSave={saveScope} onToggle={toggleClass}/></details>}
                {draft.description&&<details><summary>Notes & instructions</summary><p>{draft.description}</p></details>}
                {draft.source && <a href={draft.source} target="_blank" rel="noreferrer">Open assessment source</a>}
              </>}
              <div className="task-editor" hidden={!editingTask}>
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
                {draftGroup||draft.parentId?<span>{draft.unit} · shared with this assessment’s steps</span>:<Choice
                  label="Unit"
                  value={draft.unit}
                  onChange={(unit) => setDraft({ ...draft, unit })}
                  options={semester.units.map((u) => [u.code, u.code])}
                />}
              </label>
              <div className="field-pair">
                {!draftGroup&&!(draft.parentId&&!draft.series&&!draft.routine&&draft.timeBasis==="class")&&<label>
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
                </label>}
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
              {!draftGroup&&!(draft.parentId&&!draft.series&&!draft.routine&&draft.timeBasis==="class")&&<><div className="field-pair">
                <label>
                  {draft.timeBasis==="class"?"Class appointment date":"Due date"}
                  <input
                    type="date"
                    value={draft.date || ""}
                    onInput={(e) =>
                      setDraft({
                        ...draft,
                        ...dateInputPatch(draft, "date", e.currentTarget.value),
                        week: e.currentTarget.value
                          ? weekFor(e.currentTarget.value, semester.weeks)
                          : draft.week,
                      })
                    }
                  />
                </label>
                <label>
                  {draft.timeBasis==="class"?"Class start · Sydney":"Due time · Sydney"}
                  <input
                    type="time"
                    value={draft.time || ""}
                    onInput={(e) =>
                      setDraft({ ...draft, time: e.currentTarget.value || undefined })
                    }
                  />
                </label>
              </div>
              <p className="hint">
                {draft.timeBasis==="class"?"This is a class appointment. Use Edit steps on the assessment to change its tutorial; add a separate submission for a hand-in deadline.":"New deadlines suggest 23:59. Change or clear the time before saving."}
                A week without an exact date stays marked “Day & time TBC”.
              </p></>}
              {!!draft.parentId&&!draft.series&&!draft.routine&&draft.timeBasis==="class"&&<p className="hint">{assessmentTiming(draft)}. To change this appointment, cancel back to its summary and choose “Edit step schedule”. A submission deadline is a separate step.</p>}
              {draftGroup&&<p className="hint">Each step keeps its own schedule. Open an individual step to change its date. Editing these assessment details does not change your steps.</p>}
              <ActivityEditor task={draft} semester={semester} onChange={t=>{setDraft(t);setEditError("");}}/>
              <AssessmentAvailability task={draft} onChange={t=>{setDraft(t);setEditError("");}}/>
              <details className="optional-task-fields"><summary>More options · notes & planned start</summary>
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
              {!draftGroup&&<label className="inline-label">
                <Checkbox
                  checked={!!draft.done}
                  onCheckedChange={(v) => setDraft({ ...draft, done: !!v })}
                />
                Completed
              </label>}
              {draft.hurdle && <label className="inline-label"><Checkbox checked={!!draft.passed} onCheckedChange={v=>setDraft({...draft,passed:!!v})}/>I have confirmed that I met the hurdle</label>}
              </details>
              {editError && (
                <p className="error" role="alert">
                  {editError}
                </p>
              )}
              <div className="assessment-actions"><button onClick={cancelAssessmentEdit}>Cancel</button><button className="primary" onClick={saveTask}>Save details</button></div>
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
              {draft.kind === "recurring" && !draft.series && !draftGroup && (
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
              <AssessmentDelete key={`delete-${draft.id}`} semester={semester} task={draft} disabled={busy||!!conflict||!!saveError} onDelete={reviewed=>removeAssessment(draft.id,reviewed)}/>
              </>}
              </>}
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
              {locationForDate(detail.event.location,detail.event.date).variable&&<p><strong>{locationForDate(detail.event.location,detail.event.date).label}</strong></p>}
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
        </SheetContent>
      </Sheet>
      <Sheet open={!!personal} onOpenChange={o=>{if(!o)setPersonal(null);}}><SheetContent className="detail-panel personal-panel"><SheetHeader><SheetTitle>{personal&&semester?.tasks.some(t=>t.id===personal.id)?semester.tasks.find(t=>t.id===personal.id)?.kind==="event"?"Event details":"Task details":"Add to your calendar"}</SheetTitle><SheetDescription>Personal tasks & events · Sydney time</SheetDescription></SheetHeader>{personal&&semester&&<PersonalEditor key={personal.id} item={personal} semester={semester} onSave={t=>{const s=current.current;if(s)commit({...s,tasks:s.tasks.some(x=>x.id===t.id)?s.tasks.map(x=>x.id===t.id?t:x):[...s.tasks,t]});}} onDelete={t=>{const s=current.current;if(s)commit({...s,tasks:s.tasks.filter(x=>x.id!==t.id)});}} onAssessment={()=>{setPersonal(null);newAssessment();}} onView={t=>{setPersonal(null);setSubject(null);chooseView("week");setCalendarFocus({date:t.date,eventId:t.kind==="event"&&!t.allDay?t.id:undefined,nonce:Date.now()});}}/>}</SheetContent></Sheet>
      <Sheet open={!!subject && !detail && !personal} onOpenChange={o=>{if(!o)setSubject(null);}}>
        <SheetContent className="detail-panel subject-panel"><SheetHeader><SheetTitle>{subject?.code} · Learning overview</SheetTitle><SheetDescription>{semester?.units.find(u=>u.code===subject?.code)?.name}</SheetDescription></SheetHeader>
          {semester && subject && semester.units.find(u=>u.code===subject.code) && <UnitDetail key={subject.code+":"+(subject.taskId||"")} semester={semester} unit={semester.units.find(u=>u.code===subject.code)!} today={today} focusTaskId={subject.taskId} onToggle={toggleClass} onToggleTask={toggleTask} onScope={saveScope} onCatchUp={through=>{const s=current.current;if(!s)return;const completed={...s.completed};s.classes.filter(c=>c.unit===subject.code&&/lecture/i.test(c.activity)&&c.week&&c.week<=through).forEach(c=>completed[c.id]=true);commit({...s,completed});setNotice(`${subject.code} lectures through W${through} marked watched. Individual ticks can be undone.`);}} onOpenTask={(task,taskId)=>{setSubject({...subject,taskId});openTask(task);}} onOpenClass={(event,taskId)=>{setSubject({...subject,taskId});setDetail({type:"class",event});}}/>}
        </SheetContent>
      </Sheet>
    </main>
  );
}
