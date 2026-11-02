import { assessmentGrade, gradeRuleSummary, unitGrades } from "./grades";
import type { Semester, Task } from "./semester";

function gradeRow(task: Task) {
  const {ratio, finished, recorded, total, error, source} = assessmentGrade(task);
  const plan = task.gradePlan;
  return {
    id: task.id, unit: task.unit, title: task.title, weight: task.weight,
    mark: task.grade ?? null, ratio, finished, recorded, total, error, source,
    rule: plan ? gradeRuleSummary(plan) ?? plan.method : null,
    parts: plan?.items.map(part => ({
      id: part.id, name: part.name, mark: part.grade ?? null, excluded: !!part.excluded,
      outcome: part.outcome ?? null,
    })) ?? [],
  };
}

// The immutable restore point stays in D1. Only fields displayed by Assessments leave the API.
export function importedAssessments(board: Semester) {
  const unitNames = new Map(board.units.map(unit => [unit.code, unit.name]));
  for (const task of board.tasks) if (!unitNames.has(task.unit)) unitNames.set(task.unit, task.unit);
  const units = Array.from(unitNames, ([code, name]) => {
    const {average, currentWeight} = unitGrades(board, code);
    return {code, name, average, currentWeight};
  });
  const rows = board.tasks.map(task => ({
    id: task.id, unit: task.unit, title: task.title, date: task.date || null, time: task.time || null,
    timing: task.timing, weight: task.weight, done: !!task.done,
  }));
  // The working copy overrides any outline entry with the same ID. Keep marked children too.
  const gradeSources = new Map(board.units.flatMap(unit => unit.assessments).map(task => [task.id, task]));
  for (const task of board.tasks) gradeSources.set(task.id, task);
  const grades = Array.from(gradeSources.values()).filter(task => task.grade != null || task.gradePlan != null).map(gradeRow);
  return {version: 1 as const, year: board.year, session: board.session, units, rows, grades};
}
export type ImportedAssessments = ReturnType<typeof importedAssessments>;
