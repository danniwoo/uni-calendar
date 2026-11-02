import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { dateKey, shortDate } from "./model";
import { sydneyInstant } from "../../lib/sydney-time";
import { findFocusRow, type FocusTarget } from "./deadline-focus";
import type { ImportedSemesterState } from "./useImportedSemester";
import { selectImportedWork, type ImportedAssessments, type ImportedGrade, type ImportedView } from "./imported-work";
import { StagingApiError } from "./staging-core";
import { stagingSetup } from "./staging-auth";
import type { StagingConnectionState } from "./useStagingConnection";
import TrialAssessments from "./TrialAssessments";

function Chip({label, selected, onPress}: {label:string; selected?:boolean; onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[s.chip, selected && s.selected]}>
    <Text style={[s.chipText, selected && s.selectedText]}>{label}</Text>
  </Pressable>;
}
const number = (n:number) => Number(n.toFixed(1)).toString();
type GradeHeading = Pick<ImportedGrade, "id" | "unit" | "title" | "weight"> & {schedule?:string};
type WorkItem = ImportedAssessments["rows"][number];
type OpenMonth = (unit:string, date:string)=>void;
function attemptDate(row:WorkItem, weeks:ImportedAssessments["weeks"]) {
  if (!row.date) return "Date to confirm";
  const instant=sydneyInstant(row.date,"12:00");
  const week=weeks.find(w=>w.start<=row.date! && row.date!<=w.end);
  return [week?.label, instant ? shortDate(instant) : row.date, row.time ? row.time+" Sydney" : "time TBC"].filter(Boolean).join(" · ");
}
function GradeRow({row, grade, work, weeks, openMonth}: {
  row:GradeHeading; grade?:ImportedGrade; work:Map<string,WorkItem>; weeks:ImportedAssessments["weeks"]; openMonth:OpenMonth;
}) {
  const [expanded,setExpanded] = useState(false);
  return <View style={s.row}>
    <Text style={s.unit}>{row.unit}{row.weight ? ` · ${row.weight}` : ""}</Text>
    <Text style={s.title}>{row.title}</Text>
    <Text style={grade ? s.score : s.note}>{grade?.score ?? "No recorded mark"}</Text>
    {!!grade?.progress && <Text style={s.note}>{grade.progress}</Text>}
    {!!row.schedule && <Text style={s.note}>{row.schedule}</Text>}
    {!!grade?.threshold && <Text style={s.note}>{grade.threshold}</Text>}
    {grade?.source === "parts" && grade.mark && <Text style={s.note}>Recorded overall mark · {grade.mark.earned} / {grade.mark.possible}</Text>}
    {!!grade?.error && <Text style={s.note}>{grade.error}</Text>}
    {grade && grade.parts.length > 0 && <>
      <Pressable accessibilityRole="button" accessibilityState={{expanded}} style={s.details} onPress={()=>setExpanded(!expanded)}>
        <Text style={s.link}>{expanded ? "Hide" : "Show"} {grade.parts.length} parts</Text>
      </Pressable>
      {expanded && grade.parts.map(part => {
        const occurrence=part.occurrenceId ? work.get(part.occurrenceId) : undefined;
        const date=occurrence?.date;
        return <View key={part.id} style={s.part}>
        <Text style={s.note}>{part.name}</Text>
        <Text>{[part.mark ? `${part.mark.earned} / ${part.mark.possible}` : "", part.outcome?.replace(/_/g," "), part.excluded ? "Excluded" : ""].filter(Boolean).join(" · ") || "Unmarked"}</Text>
        {occurrence && (date ? <Pressable accessibilityRole="button"
          accessibilityLabel={`View ${part.name} in Month, ${attemptDate(occurrence,weeks)}`}
          style={s.details} onPress={()=>openMonth(occurrence.unit,date)}>
          <Text style={s.link}>{attemptDate(occurrence,weeks)} ›</Text>
        </Pressable> : <Text style={s.note}>Date to confirm</Text>)}
      </View>;})}
    </>}
  </View>;
}
function WorkRow({row}:{row:ImportedAssessments["rows"][number]}) {
  return <View style={s.row}><Text style={s.unit}>{row.unit}{row.weight ? ` · ${row.weight}` : ""}{row.done ? " · Completed" : ""}</Text>
    <Text style={s.title}>{row.title}</Text>
    <Text style={s.note}>{row.date ? [row.date, row.time].filter(Boolean).join(" · ") : row.timing || "Exact date unconfirmed"}</Text></View>;
}

function OccurrenceCompletion({row,imported}:{row:ImportedAssessments["rows"][number]; imported:ImportedSemesterState}) {
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const pending=useRef(false);
  const disabled=saving || imported.loading;
  async function toggle() {
    if (pending.current || disabled || row.completionRevision===undefined) return;
    pending.current=true; setSaving(true); setError("");
    try {
      await imported.markOccurrence(row.id,!row.done,row.completionRevision);
    } catch(e) {
      setError(e instanceof StagingApiError && e.status===409 ? "This activity changed on another device. Check its refreshed status."
        : "Couldn’t confirm this change. Refresh and check the activity before trying again.");
    } finally {pending.current=false; setSaving(false);}
  }
  return <View>
    <Text accessibilityLiveRegion="polite" style={s.note}>{row.done ? "Marked complete" : "Not marked complete"}</Text>
    {row.completionRevision!==undefined && <Pressable accessibilityRole="button" accessibilityState={{disabled}}
      disabled={disabled} onPress={()=>void toggle()} style={s.chip}>
      <Text style={s.chipText}>{saving ? "Saving…" : row.done ? "Mark incomplete" : "Mark complete"}</Text>
    </Pressable>}
    {!!(error || imported.message) && <Chip label="Refresh activity" onPress={imported.refresh}/>}
    {!!error && <Text accessibilityLiveRegion="polite" style={s.note}>{error}</Text>}
  </View>;
}
type Props = {
  connection: StagingConnectionState;
  imported: ImportedSemesterState;
  target: FocusTarget | null;
  initialView: ImportedView;
  initialUnit:string|null;
  backToMonth?:()=>void;
  backLabel: string;
  closeDetail: () => void;
  openMonth: OpenMonth;
};
export default function CloudAssessments({connection, imported, target, initialView, initialUnit, backToMonth, backLabel, closeDetail, openMonth}: Props) {
  const {board, message, loading, refresh} = imported;
  const [trial,setTrial] = useState(false);
  const [unit,setUnit] = useState<string|null>(initialUnit);
  const [view,setView] = useState<ImportedView>(initialView);
  const [past,setPast] = useState(false);
  const today = dateKey(Date.now());
  const selected = useMemo(()=>board ? selectImportedWork(board,unit,today) : null,[board,unit,today]);
  const work=useMemo(()=>new Map(board?.rows.map(row=>[row.id,row])),[board]);
  if (!connection.session || !stagingSetup.config) return <View style={s.panel}>
    <Text style={s.title}>Your imported semester</Text><Text style={s.note}>{stagingSetup.config ? "Use the Google account that owns your staging semester." : "Staging is not configured in this build."}</Text>
    {stagingSetup.config && <Chip label={connection.phase || "Continue with Google"} onPress={()=>void connection.login()}/>}
    {!!connection.message && <Text style={s.note}>{connection.message}</Text>}</View>;
  if (target) {
    const row = board && imported.scope ? findFocusRow(board, imported.scope, target) : undefined;
    const part = row && board?.grades.flatMap(grade=>grade.parts).find(part=>part.occurrenceId===row.id);
    const date = row?.date && sydneyInstant(row.date,"12:00");
    return <View style={s.panel}>
      <Chip label={backLabel} onPress={closeDetail}/>
      {row ? <>
        <Text style={s.unit}>{row.unit} · {board!.year} {board!.session}</Text>
        <Text accessibilityRole="header" style={s.detailTitle}>{row.title}</Text>
        <Text style={s.score}>{date ? shortDate(date) : "Date to confirm"}{row.time ? ` · ${row.deadlineMode==="before" ? "before " : ""}${row.time} Sydney` : " · time TBC"}</Text>
        {!!row.timing && <Text style={s.note}>{row.timing}</Text>}
        {!!row.weight && <Text style={s.note}>Weight · {row.weight}</Text>}
        {part && <Text style={s.score}>Result · {part.mark ? `${part.mark.earned} / ${part.mark.possible}` : "No recorded mark"}</Text>}
        <OccurrenceCompletion key={row.id} row={row} imported={imported}/>
      </> : <Text accessibilityLiveRegion="polite" style={s.note}>{loading ? "Opening this assessment…" : message || "This item is unavailable in the signed-in semester."}</Text>}
      {!!message && row && <Text style={s.note}>{message}</Text>}
      {!loading && !row && <Chip label="Refresh" onPress={refresh}/>}
    </View>;
  }
  if (trial) return <View style={s.panel}><Chip label="Back to imported semester" onPress={()=>setTrial(false)}/><TrialAssessments connection={connection}/></View>;
  return <View style={s.panel}>
    {backToMonth && <Chip label="← Month" onPress={backToMonth}/>}
    <View style={s.heading}><View style={s.grow}><Text style={s.title}>{board ? `${board.year} · ${board.session}` : "Your imported semester"}</Text>
      <Text style={s.note}>{board ? `${board.units.length} units · ${board.rows.length} work items · Sydney dates` : "Private staging import"}</Text></View>
      <Chip label={loading ? "Loading…" : "Refresh"} onPress={refresh}/></View>
    {message && <Text accessibilityLiveRegion="polite" style={s.note}>{message}</Text>}
    {board && selected && <>
      <View style={s.wrap}>{[null,...board.units.map(u=>u.code)].map(code=>
        <Chip key={code ?? "all"} label={code ?? "All units"} selected={code===unit} onPress={()=>{setUnit(code);setPast(false);}}/>)}</View>
      <View style={s.wrap}>{(["Work","Grades","日期待確認"] as const).map(tab=><Chip key={tab}
        label={tab === "日期待確認" ? `${tab} · ${selected.undated.length}` : tab}
        selected={view===tab} onPress={()=>setView(tab)}/>)}</View>
      {view === "日期待確認" && <>
        <Text style={s.title}>日期待確認 · {selected.undated.length}</Text><Text style={s.note}>Work without an exact date, including completed work.</Text>
        {selected.undated.map(row=><WorkRow key={row.id} row={row}/>)}
        {!selected.undated.length && <Text style={s.note}>Every item in this selection has a date.</Text>}
      </>}
      {view === "Grades" && <>
        {board.units.filter(u=>unit===null || u.code===unit).map(u=><View key={u.code} style={s.summary}>
          <Text style={s.unit}>{u.code} · Current average</Text><Text style={s.score}>{u.average===null ? "No weighted marks yet" : `${number(u.average)}%`}</Text>
          {u.average!==null && <Text style={s.note}>Based on {number(u.currentWeight)}% of unit weight</Text>}
          {u.securedCompletionPoints > 0 && <Text style={s.note}>Separately secured from unfinished completion work: {number(u.securedCompletionPoints)} unit points</Text>}</View>)}
        <Text style={s.title}>Assessment grades · {selected.assessmentRows.length}</Text>
        {selected.assessmentRows.map(row=><GradeRow key={row.id} row={row} grade={row.grade} work={work} weeks={board.weeks} openMonth={openMonth}/>)}
        {!selected.assessmentRows.length && <Text style={s.note}>No assessments in this selection.</Text>}
        {selected.additionalMarks.length > 0 && <>
          <Text style={s.title}>Other recorded results</Text>
          {selected.additionalMarks.map(grade=><GradeRow key={grade.id} row={grade} grade={grade} work={work} weeks={board.weeks} openMonth={openMonth}/>)}
        </>}
      </>}
      {view === "Work" && <>
        <Text style={s.title}>Today &amp; upcoming · {selected.upcoming.length}</Text>
        {selected.upcoming.map(row=><WorkRow key={row.id} row={row}/>)}
        {!selected.upcoming.length && <Text style={s.note}>No dated work coming up in this selection.</Text>}
        {!!selected.earlier.length && <Chip label={`${past ? "Hide" : "Show"} earlier work · ${selected.earlier.length}`} onPress={()=>setPast(!past)}/>}
        {past && selected.earlier.map(row=><WorkRow key={row.id} row={row}/>)}
      </>}
    </>}
    {!!message && !board && <Chip label="View cloud trial sample" onPress={()=>setTrial(true)}/>}
  </View>;
}

const s = StyleSheet.create({
  panel:{gap:12}, heading:{flexDirection:"row", alignItems:"center", gap:8}, grow:{flex:1},
  title:{fontWeight:"700",fontSize:17,color:"#252438"}, note:{fontSize:13,lineHeight:19,color:"#625F73"},
  wrap:{flexDirection:"row",flexWrap:"wrap",gap:5}, chip:{minHeight:44,justifyContent:"center",paddingHorizontal:10,borderRadius:10,backgroundColor:"#EFEBFA"},
  selected:{backgroundColor:"#584AA5"}, chipText:{color:"#51449B",fontSize:13,fontWeight:"600"},selectedText:{color:"white"},
  row:{gap:3,paddingVertical:8,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:"#D8D5DF"},
  detailTitle:{fontSize:24,fontWeight:"700",color:"#252438"},
  score:{fontSize:17,fontWeight:"700",color:"#403680"},unit:{fontSize:12,fontWeight:"700",color:"#584AA5"},
  summary:{gap:3,paddingVertical:6},details:{minHeight:44,justifyContent:"center"}, link:{color:"#51449B",fontWeight:"600"},
  part:{paddingLeft:12,paddingBottom:5,gap:2},
});
