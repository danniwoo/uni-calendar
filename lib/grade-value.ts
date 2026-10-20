import type { Grade, GradePlan } from "./semester";

export function validGrade(value: unknown): value is Grade {
  if (!value || typeof value !== "object") return false;
  const g=value as Grade;
  return typeof g.earned==="number" && typeof g.possible==="number" && Number.isFinite(g.earned)
    && Number.isFinite(g.possible) && g.possible>0 && g.earned>=0 && g.earned<=g.possible;
}
export const gradeNumber=(n:number)=>Number(n.toFixed(1)).toString();

export function validGradePlan(value: unknown): value is GradePlan {
  if (!value || typeof value!=="object") return false;
  const p=value as GradePlan;
  return ["parts","overall"].includes(p.mode) && ["points","equal","weighted","best"].includes(p.method)
    && (p.canvasPendingReview===undefined||typeof p.canvasPendingReview==="boolean")
    && (p.bestCount===undefined || (Number.isInteger(p.bestCount)&&p.bestCount>0&&p.bestCount<=200))
    && Array.isArray(p.items) && p.items.length>0 && p.items.length<=200
    && new Set(p.items.map(i=>i?.id)).size===p.items.length
    && p.items.every(i=>!!i && typeof i.id==="string" && i.id.length>0 && i.id.length<=500
      && typeof i.name==="string" && i.name.trim().length>0 && i.name.length<=300
      && (i.grade==null||validGrade(i.grade))
      && (i.maximum===undefined||(typeof i.maximum==="number"&&Number.isFinite(i.maximum)&&i.maximum>0))
      && (i.weight===undefined||(typeof i.weight==="number"&&Number.isFinite(i.weight)&&i.weight>0&&i.weight<=100))
      && (i.excluded===undefined||typeof i.excluded==="boolean"));
}
