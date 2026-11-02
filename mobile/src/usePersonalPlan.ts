import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dateKey } from "./model";
import {
  addSuggestedTask,
  normaliseTaskDraft,
  PLAN_STORAGE_KEY,
  readPersonalPlan,
  serialisePersonalPlan,
  type PersonalTask,
  type TaskDraft,
} from "./personal-plan";

export function usePersonalPlan() {
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [undo, setUndo] = useState<{ task: PersonalTask; index: number }>();
  const current = useRef<PersonalTask[]>([]),
    saving = useRef(false),
    loaded = useRef(false);
  async function load() {
    if (saving.current) return;
    setError("");
    setReady(false);
    loaded.current = false;
    try {
      const restored = readPersonalPlan(
        await AsyncStorage.getItem(PLAN_STORAGE_KEY),
      );
      current.current = restored;
      setTasks(restored);
      loaded.current = true;
      setReady(true);
    } catch {
      setError(
        "Couldn’t load your saved plan. Retry to keep your existing tasks safe.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function commit(
    change: (previous: PersonalTask[]) => {
      tasks: PersonalTask[];
      message: string;
      undo?: { task: PersonalTask; index: number };
    },
  ) {
    if (!loaded.current || saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const next = change(current.current);
      await AsyncStorage.setItem(
        PLAN_STORAGE_KEY,
        serialisePersonalPlan(next.tasks),
      );
      current.current = next.tasks;
      setTasks(next.tasks);
      setMessage(next.message);
      setUndo(next.undo);
      return true;
    } catch (e) {
      setError(
        e instanceof Error && /Enter a task|Choose a valid/.test(e.message)
          ? e.message
          : "Couldn’t save your plan. Please try again; your saved tasks are unchanged.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function save(draft: TaskDraft, id?: string) {
    return commit((previous) => {
      const fields = normaliseTaskDraft(draft);
      if (id) {
        const existing = previous.find((t) => t.id === id);
        if (!existing) throw new Error("Task unavailable");
        return {
          tasks: previous.map((t) =>
            t.id === id ? { ...t, ...fields, unit: fields.unit } : t,
          ),
          message: "Task updated · saved on this iPhone",
        };
      }
      const now = Date.now();
      const task: PersonalTask = {
        id: `task-${now.toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
        ...fields,
        createdAt: now,
      };
      return {
        tasks: addSuggestedTask(previous, task, dateKey(now)),
        message: "Added to your plan · saved on this iPhone",
      };
    });
  }
  function toggle(id: string) {
    return commit((previous) => {
      const index = previous.findIndex((t) => t.id === id);
      if (index < 0) throw new Error("Task unavailable");
      const before = previous[index],
        completedAt = before.completedAt === undefined ? Date.now() : undefined;
      return {
        tasks: previous.map((t) => (t.id === id ? { ...t, completedAt } : t)),
        message: completedAt === undefined ? "Task reopened" : "Task completed",
        undo: { task: before, index },
      };
    });
  }
  function remove(id: string) {
    return commit((previous) => {
      const index = previous.findIndex((t) => t.id === id);
      if (index < 0) throw new Error("Task unavailable");
      return {
        tasks: previous.filter((t) => t.id !== id),
        message: "Task deleted",
        undo: { task: previous[index], index },
      };
    });
  }
  function undoLast() {
    if (!undo) return Promise.resolve(false);
    const restore = undo;
    return commit((previous) => {
      const tasks = [...previous],
        index = tasks.findIndex((t) => t.id === restore.task.id);
      if (index >= 0) tasks[index] = restore.task;
      else tasks.splice(Math.min(restore.index, tasks.length), 0, restore.task);
      return { tasks, message: "Change undone · saved on this iPhone" };
    });
  }
  return {
    tasks,
    ready,
    busy,
    error,
    message,
    canUndo: !!undo,
    load,
    save,
    toggle,
    remove,
    undoLast,
  };
}
export type PersonalPlanController = ReturnType<typeof usePersonalPlan>;
