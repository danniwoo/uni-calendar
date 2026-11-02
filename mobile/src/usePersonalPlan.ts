import { useEffect, useRef, useState } from "react";
import { type PlanStorage, devicePlan } from "./plan-storage";
import { StagingApiError } from "./staging-core";
import { dateKey } from "./model";
import {
  addSuggestedTask,
  normaliseTaskDraft,
  type PersonalTask,
  type TaskDraft,
} from "./personal-plan";

export function usePersonalPlan(storage:PlanStorage = devicePlan) {
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [undo, setUndo] = useState<{ task: PersonalTask; index: number }>();
  const current = useRef<PersonalTask[]>([]),
    saving = useRef(false),
    loaded = useRef(false);
  const revision = useRef(0);
  const active = useRef(true);
  const conflict = useRef(false);
  const permissionLost = (e:unknown) => e instanceof StagingApiError && [401,403,404].includes(e.status);
  function hideTasks() {
    current.current=[]; loaded.current=false;
    setTasks([]); setReady(false); setUndo(undefined);
  }
  async function load() {
    if (saving.current) return;
    saving.current=true; setBusy(true); setError(""); setUndo(undefined); setMessage("");
    try {
      const snapshot = await storage.read();
      if(!active.current)return;
      revision.current=snapshot.revision; current.current=snapshot.tasks; conflict.current=false;
      setTasks(snapshot.tasks); loaded.current=true; setReady(true);
    } catch(e) {
      if(!active.current)return;
      if(permissionLost(e))hideTasks();
      setError(permissionLost(e) ? "Sign in to the account that owns this semester." : "Couldn’t refresh your plan. Retry when connected.");
    } finally {
      saving.current=false;
      if(active.current)setBusy(false);
    }
  }
  useEffect(() => {
    active.current=true; void load();
    return ()=>{active.current=false;};
  }, [storage]);
  async function commit(
    change: (previous: PersonalTask[]) => {
      tasks: PersonalTask[];
      message: string;
      undo?: { task: PersonalTask; index: number };
    },
  ) {
    if (!loaded.current || saving.current || conflict.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const next = change(current.current);
      const snapshot = await storage.write(next.tasks,revision.current);
      if(!active.current)return false;
      revision.current=snapshot.revision; current.current=snapshot.tasks;
      setTasks(snapshot.tasks);
      setMessage(next.message);
      setUndo(next.undo);
      return true;
    } catch (e) {
      if(!active.current)return false;
      if(e instanceof StagingApiError && e.status===409) {
        conflict.current=true; setUndo(undefined);
        setError("This plan changed on another device. Close the editor and refresh before saving again.");
        return false;
      }
      if(permissionLost(e)){ hideTasks(); setError("Sign in again to access this plan."); return false; }
      if(e instanceof Error && /Enter a task|Choose a valid/.test(e.message)) setError(e.message);
      else {
        conflict.current = storage !== devicePlan;
        setError("Couldn’t confirm the save. Refresh your plan before trying again.");
      }
      return false;
    } finally {
      saving.current = false;
      if(active.current)setBusy(false);
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
          message: `Task updated · saved ${storage.label}`,
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
        message: `Added to your plan · saved ${storage.label}`,
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
      return { tasks, message: `Change undone · saved ${storage.label}` };
    });
  }
  return {
    tasks,
    ready,
    busy,
    error,
    message,
    storageLabel:storage.label,
    canUndo: !!undo,
    load,
    save,
    toggle,
    remove,
    undoLast,
  };
}
export type PersonalPlanController = ReturnType<typeof usePersonalPlan>;
