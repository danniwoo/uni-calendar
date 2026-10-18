import type { Grade } from "./semester";

export function validGrade(value: unknown): value is Grade {
  if (!value || typeof value !== "object") return false;
  const g=value as Grade;
  return typeof g.earned==="number" && typeof g.possible==="number" && Number.isFinite(g.earned)
    && Number.isFinite(g.possible) && g.possible>0 && g.earned>=0 && g.earned<=g.possible;
}
export const gradeNumber=(n:number)=>Number(n.toFixed(1)).toString();
