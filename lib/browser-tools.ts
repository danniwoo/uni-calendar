import type { Semester, Task } from "./semester";
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: object;
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerSemesterTools(
  get: () => Semester | null,
  open: (task: Task) => void,
) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: "read_semester_tasks",
      description:
        "Read imported semester task IDs, dates and completion. Does not return the private timetable URL or class locations.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== "object" || Object.keys(input).length)
          throw new Error("Expected an empty object.");
        const s = get();
        return {
          year: s?.year,
          session: s?.session,
          tasks:
            s?.tasks.map(({ id, unit, title, week, date, time, done }) => ({
              id,
              unit,
              title,
              week,
              date,
              time,
              done: !!done,
            })) || [],
        };
      },
    },
    {
      name: "open_semester_task",
      description:
        "Open a task’s detail and editing panel. Does not save edits or mark anything complete.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        if (
          !input ||
          typeof input !== "object" ||
          Object.keys(input).some((k) => k !== "id") ||
          typeof (input as { id?: unknown }).id !== "string"
        )
          throw new Error("Provide a task id.");
        const t = get()?.tasks.find(
          (t) => t.id === (input as { id: string }).id,
        );
        if (!t) throw new Error("Task not found.");
        open(t);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return { opened: t.id, saved: false };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  }
  return () => lifecycle.abort();
}
