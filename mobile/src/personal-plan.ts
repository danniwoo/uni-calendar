import { dateKey } from "./model";

export type PersonalTask = {
  id: string;
  title: string;
  unit?: string;
  plannedFor: string;
  createdAt: number;
  completedAt?: number;
  sourceKey?: string;
};
export type TaskDraft = Pick<
  PersonalTask,
  "title" | "unit" | "plannedFor" | "sourceKey"
>;
export const PLAN_STORAGE_KEY = "semester.preview.personal-plan.v1";
export const MAX_TASK_TITLE = 180;
function validDay(day: unknown): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const time = Date.parse(`${day}T12:00:00Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day
  );
}
export function normaliseTaskDraft(draft: TaskDraft): TaskDraft {
  const title = draft.title.trim();
  if (!title || title.length > MAX_TASK_TITLE)
    throw new Error("Enter a task name (up to 180 characters).");
  if (!validDay(draft.plannedFor))
    throw new Error("Choose a valid planning day.");
  return {
    title,
    plannedFor: draft.plannedFor,
    ...(draft.unit ? { unit: draft.unit } : {}),
    ...(draft.sourceKey ? { sourceKey: draft.sourceKey } : {}),
  };
}
// Fail closed instead of silently discarding user-created tasks on a malformed record.
export function readPersonalPlan(raw: string | null): PersonalTask[] {
  if (raw === null) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.tasks))
    throw new Error("Unreadable saved plan.");
  const ids = new Set<string>();
  return value.tasks.map((task: PersonalTask) => {
    if (
      !task ||
      typeof task.id !== "string" ||
      !task.id ||
      ids.has(task.id) ||
      typeof task.title !== "string" ||
      !validDay(task.plannedFor) ||
      !Number.isFinite(task.createdAt) ||
      task.createdAt < 0 ||
      task.createdAt > 8e15 ||
      (task.completedAt !== undefined &&
        (!Number.isFinite(task.completedAt) ||
          task.completedAt < 0 ||
          task.completedAt > 8e15)) ||
      (task.unit !== undefined && typeof task.unit !== "string") ||
      (task.sourceKey !== undefined && typeof task.sourceKey !== "string")
    )
      throw new Error("Unreadable saved task.");
    ids.add(task.id);
    return {
      id: task.id,
      ...normaliseTaskDraft(task),
      createdAt: task.createdAt,
      ...(task.completedAt !== undefined
        ? { completedAt: task.completedAt }
        : {}),
    };
  });
}
export function serialisePersonalPlan(tasks: PersonalTask[]) {
  return JSON.stringify({ version: 1, tasks });
}
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
