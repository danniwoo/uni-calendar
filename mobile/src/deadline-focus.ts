import { sydneyInstant } from "../../lib/sydney-time";
import { addDays } from "./experience";
import { clockTime, dateKey, shortDate } from "./model";
import type { ImportedAssessments } from "./imported-work";

type Row = ImportedAssessments["rows"][number];
export const IMPORTED_URL = "semester-preview://imported-assessments";
const itemPrefix = "semester-preview://deadline/";
const dayMs = 24 * 60 * 60 * 1000;
const lifetime = 7 * dayMs;
export type FocusTarget = {scope:string; id:string};
export type FocusProps = {heading:string; title:string; meta:string; url:string};
export type FocusEntry = {date:Date; props:FocusProps};

export const focusURL = ({scope,id}:FocusTarget) => itemPrefix + scope + "/" + encodeURIComponent(id);
export function readFocusURL(url:string): FocusTarget | null {
  if (!url.startsWith(itemPrefix)) return null;
  const match = /^([0-9a-f]{32})\/([^/?#]+)$/.exec(url.slice(itemPrefix.length));
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[2]);
    return id && encodeURIComponent(id) === match[2] ? {scope:match[1],id} : null;
  } catch { return null; }
}
export function findFocusRow(board:ImportedAssessments, scope:string, target:FocusTarget) {
  if (scope !== target.scope) return undefined;
  return board.rows.find(row => row.id === target.id);
}
export function ownsFocusTimeline(entries:FocusEntry[], scope:string) {
  return entries.length > 0 && entries.every(entry =>
    entry.props.url === IMPORTED_URL || readFocusURL(entry.props.url)?.scope === scope);
}
export function neutralFocus(title:string, meta="Open Semester"): FocusProps {
  return {heading:"DEADLINE FOCUS", title, meta, url:IMPORTED_URL};
}

type Candidate = {row:Row; until:number; timed:boolean};
function candidates(rows:Row[], now:number) {
  const list: Candidate[] = [];
  const today = dateKey(now);
  for (const row of rows) {
    if (row.done || !row.deadlineMode || !row.date || row.date < today) continue;
    // Reject malformed calendar dates instead of letting Date roll them forward.
    if (sydneyInstant(row.date,"00:00") === undefined) continue;
    const exact = row.time ? sydneyInstant(row.date,row.time) : undefined;
    const until = exact ?? sydneyInstant(addDays(row.date,1),"00:00");
    if (until !== undefined && until > now) list.push({row, until, timed:exact !== undefined});
  }
  return list.sort((a,b) => a.until - b.until || a.row.id.localeCompare(b.row.id));
}
function focusProps(next:Candidate, scope:string, when:number, asOf:number): FocusProps {
  const {row,until,timed} = next;
  const today = dateKey(when);
  const day = row.date === today ? "today" : row.date === addDays(today,1) ? "tomorrow"
    : shortDate(sydneyInstant(row.date!,"12:00")!).replace(/,/g,"");
  const time = timed ? (row.deadlineMode === "before" ? "before " : "") + clockTime(until) : "time TBC";
  const stale = when >= asOf + dayMs;
  return {heading:`DUE ${day.toUpperCase()}`, title:row.title, meta:`${row.unit} · ${time}${stale ? " · cached" : ""}`,
    url:focusURL({scope,id:row.id})};
}
export function focusTimeline(rows:Row[], scope:string, syncedAt:number): FocusEntry[] {
  const list = candidates(rows,syncedAt);
  const expiry = syncedAt + lifetime;
  const changes = new Set([syncedAt,syncedAt+dayMs,expiry]);
  for (const item of list) if (item.until < expiry) changes.add(item.until);
  for (let i=1;i<=8;i++) {
    const midnight = sydneyInstant(addDays(dateKey(syncedAt),i),"00:00");
    if (midnight !== undefined && midnight < expiry) changes.add(midnight);
  }
  let index = 0;
  let previous:FocusProps | undefined;
  const entries:FocusEntry[] = [];
  for (const at of [...changes].sort((a,b)=>a-b)) {
    while (list[index] && list[index].until <= at) index++;
    const props = at === expiry ? neutralFocus("Refresh deadlines")
      : list[index] ? focusProps(list[index],scope,at,syncedAt)
      : neutralFocus("No upcoming deadline","Open Assessments");
    if (!previous || previous.url!==props.url || previous.heading!==props.heading || previous.meta!==props.meta || previous.title!==props.title) {
      entries.push({date:new Date(at),props});
    }
    previous=props;
  }
  return entries;
}
