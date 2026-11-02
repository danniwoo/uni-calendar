import { assessmentListWeight, assessmentOverviewSchedule, assessmentRows, defaultAssessmentFilters } from "./assessment-list";
import { gradeNumber } from "./grade-value";
import { assessmentGrade, gradeRuleSummary, gradeThreshold, unitGrades } from "./grades";
import { sydneyDate, type Semester, type Task } from "./semester";

function scoreLabel(task: Task, result: ReturnType<typeof assessmentGrade>) {
  if (result.source === "overall") {
    return task.grade ? `${task.grade.earned} / ${task.grade.possible}` : "No recorded mark";
  }
  if (result.ratio === null) return "No calculated result";
  if (task.gradePlan?.method === "completion" && result.earned !== null && result.possible !== null) {
    return `${gradeNumber(result.earned)} / ${gradeNumber(result.possible)} points${result.finished ? "" : " secured so far"}`;
  }
  return `${gradeNumber(result.ratio * 100)}%${result.finished ? "" : " so far"}`;
}

function gradeRow(task: Task) {
  const result = assessmentGrade(task);
  const {ratio, finished, recorded, total, error, source} = result;
  const plan = task.gradePlan;
  const rule = plan ? gradeRuleSummary(plan) ?? plan.method : null;
  const progress = source === "parts"
    ? [rule, `${recorded} / ${total} ${plan?.method === "completion" ? "confirmed" : "graded"}`].filter(Boolean).join(" · ")
    : null;
  return {
    id: task.id, unit: task.unit, title: task.title, weight: task.weight,
    mark: task.grade ?? null, ratio, finished, recorded, total, error, source,
    rule, score: scoreLabel(task, result), progress, threshold: plan ? gradeThreshold(plan) : null,
    parts: plan?.items.map(part => ({
      id: part.id, name: part.name, mark: part.grade ?? null, excluded: !!part.excluded,
      outcome: part.outcome ?? null,
    })) ?? [],
  };
}

// Home and Assessments share a read-only projection of the immutable restore point.
export function importedAssessments(board: Semester) {
  const unitNames = new Map(board.units.map(unit => [unit.code, unit.name]));
  const activeUnits = new Set(unitNames.keys());
  const parents = new Set(board.tasks.flatMap(task => [task.parentId, task.series].filter(Boolean)));
  for (const task of board.tasks) if (!unitNames.has(task.unit)) unitNames.set(task.unit, task.unit);
  const units = Array.from(unitNames, ([code, name]) => {
    const {average, currentWeight, securedCompletionPoints} = unitGrades(board, code);
    return {code, name, average, currentWeight, securedCompletionPoints};
  });
  const rows = board.tasks.map(task => {
    const scheduled = activeUnits.has(task.unit) && !!task.date && !parents.has(task.id) && !task.splitCount;
    const mode = scheduled ? deadlineMode(task) : null;
    return {
      id: task.id, unit: task.unit, title: task.title, date: task.date || null, time: task.allDay ? null : task.time || null,
      timing: task.timing, weight: task.weight, done: !!task.done,
      deadlineMode: mode, scheduledActivity: scheduled && mode === null,
    };
  });
  // The working copy overrides any outline entry with the same ID. Keep marked children too.
  const gradeSources = new Map(board.units.flatMap(unit => unit.assessments).map(task => [task.id, task]));
  for (const task of board.tasks) gradeSources.set(task.id, task);
  const grades = Array.from(gradeSources.values()).filter(task => task.grade != null || task.gradePlan != null).map(gradeRow);
  // The website lists every whole assessment, even with no result. Keep recorded
  // child marks separately so grouping never discards a student's existing marks.
  const overview = assessmentRows(board, defaultAssessmentFilters, sydneyDate(), "overview").map(row => {
    const {task} = row;
    const schedule = assessmentOverviewSchedule(board, row);
    return {id: task.id, unit: task.unit, title: task.title,
      weight: assessmentListWeight(task, row.grouped),
      schedule: [schedule.label, schedule.detail].filter(Boolean).join(" · ")};
  });
  const weeks = board.weeks.map(({start,end,label}) => ({start,end,label}));
  return {version: 1 as const, year: board.year, session: board.session, weeks, units, rows, grades, overview};
}
export type ImportedAssessments = ReturnType<typeof importedAssessments>;

// A class time is a deadline when the work is due before class. "During
// workshop", scheduled exams and personal calendar events are activities.
function deadlineMode(task: Task): "before" | "due" | null {
  if (task.kind === "event" || task.kind === "exam") return null;
  if (/^before\b/i.test(task.timing)) return "before";
  return task.timeBasis === "class" ? null : "due";
}
