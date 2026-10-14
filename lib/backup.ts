import type { Semester, Task } from "./semester";
import {availabilityError} from "./assessment-schedule";

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: Record<string, unknown>, keys: string[]) => keys.every(k => typeof v[k] === "string");
const unique = (xs: string[]) => new Set(xs).size === xs.length;
const rules = (v: unknown) => v === undefined || (object(v) && typeof v.text === "string"
  && ["count","perOccurrence","total","bestOf","threshold","attempts"].every(k=>v[k] === undefined || (typeof v[k] === "number" && Number.isFinite(v[k])))
  && (v.coverageText === undefined || typeof v.coverageText === "string")
  && (v.optional === undefined || typeof v.optional === "boolean"));
const task = (v: unknown): v is Task => object(v)
  && strings(v,["id","unit","title","weight","timing","description","source","sourceText"])
  && ["assessment","quiz","recurring","exam","task","event"].includes(String(v.kind))
  && ["hurdle","group","done","manual","routine","passed","allDay"].every(k=>v[k] === undefined || typeof v[k] === "boolean")
  && ["date","time","endTime","parentId","series","warning","sourceConflict","location","link","availableFrom","availableFromTime","availableUntil","availableUntilTime"].every(k=>v[k] === undefined || typeof v[k] === "string")
  && ["week","startWeek","dueWeek","splitCount","splitPart"].every(k=>v[k] === undefined || (Number.isInteger(v[k]) && Number(v[k]) > 0))
  && (v.coverage === undefined || (Array.isArray(v.coverage) && v.coverage.every(n=>Number.isInteger(n) && n>=1 && n<=13)))
  && (v.overrides === undefined || (Array.isArray(v.overrides) && v.overrides.every(k=>typeof k === "string" && !["__proto__","constructor","prototype"].includes(k))))
  && rules(v.rules)
  && !availabilityError(v as unknown as Task);

// Backups are complete snapshots, never a bag of tasks to merge into a different feed.
export function readBackup(text: string): Semester {
  if (text.length > 1_500_000) throw new Error("Backup is too large (maximum 1.5 MB).");
  let s: unknown;
  try { s = JSON.parse(text); } catch { throw new Error("Choose a valid semester backup JSON file."); }
  if (!object(s) || s.year !== 2026 || !["S1C","S2C"].includes(String(s.session)))
    throw new Error("This version supports backups for standard Semester 1 or 2, 2026.");
  if (!Array.isArray(s.units) || !s.units.length || s.units.length > 8
    || !s.units.every(u=>object(u) && strings(u,["code","name","session","outline","status","summary"])
      && Array.isArray(u.assessments) && u.assessments.every(task)
      && Array.isArray(u.topics) && u.topics.every(t=>object(t) && Number.isInteger(t.week) && strings(t,["activity","topic"])))
    || !unique(s.units.map(u=>u.code))
    || !Array.isArray(s.tasks) || s.tasks.length > 2500 || !s.tasks.every(task) || !unique(s.tasks.map(t=>t.id))
    || !Array.isArray(s.classes) || !s.classes.every(c=>object(c) && strings(c,["id","unit","activity","date","time","end","location"]))
    || !unique(s.classes.map(c=>c.id))
    || !Array.isArray(s.weeks) || !s.weeks.length || !s.weeks.every(w=>object(w) && strings(w,["id","label","start","end"]) && ["teaching","break","study","exam"].includes(String(w.kind)))
    || !object(s.completed) || !Object.values(s.completed).every(v=>typeof v === "boolean")
    || !Array.isArray(s.warnings) || !s.warnings.every(v=>typeof v === "string")
    || typeof s.importedAt !== "string")
    throw new Error("This backup is incomplete or invalid. Nothing has been changed.");
  // Never inherit the currently open feed, nor trust a URL embedded in an uploaded file.
  return {...s, feedUrl:""} as Semester;
}

export function backupText(s: Semester) { return JSON.stringify({...s,feedUrl:""},null,2); }
export function sameUnits(a: Semester, b: Semester) {
  return a.year === b.year && a.session === b.session
    && a.units.map(u=>u.code).sort().join(",") === b.units.map(u=>u.code).sort().join(",");
}
export function replaceBoard(s: Semester, generation: string): Semester {
  return {...structuredClone(s),boardGeneration:generation};
}
export function activeTasks(s: Semester) {
  const codes=new Set(s.units.map(u=>u.code));
  return s.tasks.filter(t=>codes.has(t.unit));
}
