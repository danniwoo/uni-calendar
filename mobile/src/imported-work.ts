import type { ImportedAssessments as Projection } from "../../lib/imported-assessments";
export type ImportedAssessments = Omit<Projection,"rows"> & {rows:(Projection["rows"][number] & {completionRevision?:number})[]};
export type ImportedView = "Work" | "Grades" | "日期待確認";
export type ImportedGrade = ImportedAssessments["grades"][number];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const strings = (obj: Record<string, unknown>, keys: string[]) => keys.every(key => typeof obj[key] === "string");
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const maybeNumber = (v: unknown) => v === null || finite(v);
const maybeString = (v: unknown) => v === null || typeof v === "string";
const mark = (v: unknown) => v === null || (record(v) && finite(v.earned) && finite(v.possible));
export function readImportedAssessments(v: unknown): ImportedAssessments {
  if (!record(v) || v.version !== 1 || !finite(v.year) || typeof v.session !== "string"
    || !Array.isArray(v.weeks) || !v.weeks.every(w => record(w) && strings(w, ["label","start","end"]))
    || !Array.isArray(v.units) || !v.units.every(u => record(u) && strings(u, ["code","name"]) && maybeNumber(u.average) && finite(u.currentWeight) && finite(u.securedCompletionPoints))
    || !Array.isArray(v.overview) || !v.overview.every(row => record(row) && strings(row, ["id","unit","title","weight","schedule"]))
    || !Array.isArray(v.rows) || !v.rows.every(r => record(r) && strings(r, ["id","unit","title","timing","weight"]) && maybeString(r.date) && maybeString(r.time) && typeof r.done === "boolean" && (r.completionRevision === undefined || (Number.isSafeInteger(r.completionRevision) && Number(r.completionRevision)>=0)) && typeof r.scheduledActivity === "boolean" && (r.deadlineMode === null || r.deadlineMode === "before" || r.deadlineMode === "due"))
    || !Array.isArray(v.grades) || !v.grades.every(g => record(g) && strings(g, ["id","unit","title","weight","score"]) && mark(g.mark)
      && maybeString(g.progress) && maybeString(g.threshold)
      && maybeNumber(g.ratio) && typeof g.finished === "boolean" && finite(g.recorded) && finite(g.total) && maybeString(g.rule) && maybeString(g.error)
      && (g.source === "parts" || g.source === "overall") && Array.isArray(g.parts) && g.parts.every(p =>
        record(p) && strings(p, ["id","name"]) && mark(p.mark) && typeof p.excluded === "boolean" && maybeString(p.outcome))))
    throw new Error("Unsupported imported semester.");
  return v as ImportedAssessments;
}

export function selectImportedWork(board: ImportedAssessments, code: string | null, today: string) {
  const applies = (row: {unit:string}) => code === null || row.unit === code;
  const rows = board.rows.filter(applies);
  const grades = board.grades.filter(applies);
  const recorded = new Map(grades.map(grade => [grade.id, grade]));
  const assessmentRows = board.overview.filter(applies).map(row => ({...row, grade: recorded.get(row.id)}));
  const roots = new Set(assessmentRows.map(row => row.id));
  const ordered = rows.filter(row => row.date !== null).sort((a,b) =>
    a.date!.localeCompare(b.date!) || (a.time || "").localeCompare(b.time || "") || a.id.localeCompare(b.id));
  return {
    upcoming: ordered.filter(row => row.date! >= today),
    earlier: ordered.filter(row => row.date! < today).reverse(),
    undated: rows.filter(row => row.date === null),
    grades, assessmentRows, additionalMarks: grades.filter(grade => !roots.has(grade.id)),
  };
}
