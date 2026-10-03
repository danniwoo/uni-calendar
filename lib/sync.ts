import type { Semester } from "./semester";

// Three-way merge: never overwrite another tab's unrelated edits. Conflicting
// fields require an explicit choice; the caller retains both source snapshots.
export function reconcile(base: Semester | null, local: Semester, remote: Semester, prefer: "local" | "remote" = "local") {
  const conflicts: string[] = [];
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  function merge(b: unknown, l: unknown, r: unknown, path: string): unknown {
    if (equal(l,r) || equal(b,r)) return l;
    if (equal(b,l)) return r;
    if (Array.isArray(l) && Array.isArray(r) && ["tasks", "classes", "units"].includes(path)) {
      const key = path === "units" ? "code" : "id";
      const before = new Map((Array.isArray(b) ? b : []).map(x=>[x[key],x]));
      const left = new Map(l.map(x=>[x[key],x])); const right = new Map(r.map(x=>[x[key],x]));
      return [...new Set([...right.keys(), ...left.keys()])].map(id=>merge(before.get(id),left.get(id),right.get(id),`${path}.${id}`)).filter(x=>x !== undefined);
    }
    if (object(l) && object(r) && (object(b) || b == null)) {
      const out: Record<string, unknown> = {};
      for (const key of new Set([...Object.keys(l),...Object.keys(r)]))
        out[key] = merge(object(b) ? b[key] : undefined,l[key],r[key],path ? `${path}.${key}` : key);
      return out;
    }
    conflicts.push(path);
    return prefer === "local" ? l : r;
  }
  if (base && (local.year !== remote.year || local.session !== remote.session || local.feedUrl !== remote.feedUrl))
    return { semester: prefer === "local" ? local : remote, conflicts: ["Timetable / semester changed"] };
  const semester = merge(base,local,remote,"") as Semester;
  return { semester, conflicts };
}
