import { dateKey } from "./model";
import type { PersonalTask } from "../../lib/today-plan";
export * from "../../lib/today-plan";
export const PLAN_STORAGE_KEY = "semester.preview.personal-plan.v1";
export function planGroups(tasks: PersonalTask[], today: string) {
  return {
    today: tasks.filter(
      (t) => t.completedAt === undefined && t.plannedFor === today,
    ),
    earlier: tasks
      .filter((t) => t.completedAt === undefined && t.plannedFor < today)
      .sort((a, b) => a.plannedFor.localeCompare(b.plannedFor)),
    later: tasks
      .filter((t) => t.completedAt === undefined && t.plannedFor > today)
      .sort((a, b) => a.plannedFor.localeCompare(b.plannedFor)),
    completed: tasks
      .filter((t) => t.completedAt !== undefined)
      .sort((a, b) => b.completedAt! - a.completedAt!),
  };
}
export function matchingSuggestion(
  tasks: PersonalTask[],
  sourceKey: string,
  today: string,
) {
  return tasks.find(
    (t) =>
      t.sourceKey === sourceKey &&
      (t.completedAt === undefined || dateKey(t.completedAt) === today),
  );
}
export function addSuggestedTask(
  tasks: PersonalTask[],
  task: PersonalTask,
  today: string,
) {
  return task.sourceKey && matchingSuggestion(tasks, task.sourceKey, today)
    ? tasks
    : [...tasks, task];
}
