import type { ImportedAssessments } from "../../lib/imported-assessments";
export type { ImportedAssessments };
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
    || !Array.isArray(v.units) || !v.units.every(u => record(u) && strings(u, ["code","name"]) && maybeNumber(u.average) && finite(u.currentWeight))
    || !Array.isArray(v.rows) || !v.rows.every(r => record(r) && strings(r, ["id","unit","title","timing","weight"]) && maybeString(r.date) && maybeString(r.time) && typeof r.done === "boolean")
    || !Array.isArray(v.grades) || !v.grades.every(g => record(g) && strings(g, ["id","unit","title","weight"]) && mark(g.mark)
      && maybeNumber(g.ratio) && typeof g.finished === "boolean" && finite(g.recorded) && finite(g.total) && maybeString(g.rule) && maybeString(g.error)
      && (g.source === "parts" || g.source === "overall") && Array.isArray(g.parts) && g.parts.every(p =>
        record(p) && strings(p, ["id","name"]) && mark(p.mark) && typeof p.excluded === "boolean" && maybeString(p.outcome))))
    throw new Error("Unsupported imported semester.");
  return v as ImportedAssessments;
}

export function selectImportedWork(board: ImportedAssessments, code: string | null, today: string) {
  const applies = (row: {unit:string}) => code === null || row.unit === code;
  const rows = board.rows.filter(applies);
  const ordered = rows.filter(row => row.date !== null).sort((a,b) =>
    a.date!.localeCompare(b.date!) || (a.time || "").localeCompare(b.time || "") || a.id.localeCompare(b.id));
  return {
    upcoming: ordered.filter(row => row.date! >= today),
    earlier: ordered.filter(row => row.date! < today).reverse(),
    undated: rows.filter(row => row.date === null),
    grades: board.grades.filter(applies),
  };
}
