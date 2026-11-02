import React, { useEffect, useMemo, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { dateKey } from "./model";
import { readImportedAssessments, selectImportedWork, type ImportedAssessments, type ImportedGrade, type ImportedView } from "./imported-work";
import { stagingSetup } from "./staging-auth";
import { stagingRequest, StagingApiError } from "./staging-core";
import type { StagingConnectionState } from "./useStagingConnection";
import TrialAssessments from "./TrialAssessments";

function Chip({label, selected, onPress}: {label:string; selected?:boolean; onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[s.chip, selected && s.selected]}>
    <Text style={[s.chipText, selected && s.selectedText]}>{label}</Text>
  </Pressable>;
}
const number = (n:number) => Number(n.toFixed(1)).toString();
function GradeRow({grade}: {grade:ImportedGrade}) {
  const [expanded,setExpanded] = useState(false);
  const score = grade.source === "parts"
    ? grade.ratio === null ? "No calculated result" : `${number(grade.ratio*100)}%${grade.finished ? "" : " so far"}`
    : grade.mark ? `${grade.mark.earned} / ${grade.mark.possible}` : "No recorded mark";
  return <View style={s.row}>
    <Text style={s.unit}>{grade.unit}{grade.weight ? ` · ${grade.weight}` : ""}</Text>
    <Text style={s.title}>{grade.title}</Text>
    <Text style={s.score}>{score}</Text>
    {grade.source === "parts" && grade.mark && <Text style={s.note}>Recorded overall mark · {grade.mark.earned} / {grade.mark.possible}</Text>}
    {!!grade.error && <Text style={s.note}>{grade.error}</Text>}
    {grade.parts.length > 0 && <>
      <Pressable accessibilityRole="button" accessibilityState={{expanded}} style={s.details} onPress={()=>setExpanded(!expanded)}>
        <Text style={s.link}>{expanded ? "Hide" : "Show"} {grade.parts.length} parts · {grade.rule}</Text>
      </Pressable>
      {expanded && grade.parts.map(part => <View key={part.id} style={s.part}>
        <Text style={s.note}>{part.name}</Text>
        <Text>{[part.mark ? `${part.mark.earned} / ${part.mark.possible}` : "", part.outcome?.replace(/_/g," "), part.excluded ? "Excluded" : ""].filter(Boolean).join(" · ") || "Unmarked"}</Text>
      </View>)}
    </>}
  </View>;
}
function WorkRow({row}:{row:ImportedAssessments["rows"][number]}) {
  return <View style={s.row}><Text style={s.unit}>{row.unit}{row.weight ? ` · ${row.weight}` : ""}{row.done ? " · Completed" : ""}</Text>
    <Text style={s.title}>{row.title}</Text>
    <Text style={s.note}>{row.date ? [row.date, row.time].filter(Boolean).join(" · ") : row.timing || "Exact date unconfirmed"}</Text></View>;
}

export default function CloudAssessments({connection}: {connection: StagingConnectionState}) {
  const [board,setBoard] = useState<ImportedAssessments>();
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(true);
  const [reload,setReload] = useState(0);
  const [trial,setTrial] = useState(false);
  const [unit,setUnit] = useState<string|null>(null);
  const [view,setView] = useState<ImportedView>("Work");
  const [past,setPast] = useState(false);
  const token = connection.session?.access_token;
  useEffect(() => {
    const config = stagingSetup.config;
    if (!config || !token) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),15000);
    setLoading(true); setMessage("");
    void stagingRequest(config,token,"/v1/imported/assessments",{signal:controller.signal})
      .then(readImportedAssessments).then(data => {if(active) setBoard(data);})
      .catch(error => {
        if (!active) return;
        setBoard(undefined);
        const status = error instanceof StagingApiError ? error.status : 0;
        setMessage(status === 404 ? "No imported semester yet. Import your saved semester on the staging website."
          : status === 403 ? "This account is not enrolled in the private import trial."
          : status === 401 ? "Your session expired. Sign in again from Widgets."
          : "Could not read your imported semester. Check your connection and retry.");
      }).finally(()=>{clearTimeout(timeout); if(active) setLoading(false);});
    return ()=>{active=false; controller.abort(); clearTimeout(timeout);};
  },[token,reload]);
  useEffect(()=>{
    const listener=AppState.addEventListener("change",state=>{if(state==="active")setReload(n=>n+1);});
    return ()=>listener.remove();
  },[]);
  const today = dateKey(Date.now());
  const selected = useMemo(()=>board ? selectImportedWork(board,unit,today) : null,[board,unit,today]);
  if (!connection.session || !stagingSetup.config) return <View style={s.panel}>
    <Text style={s.title}>Your imported semester</Text><Text style={s.note}>{stagingSetup.config ? "Use the Google account that owns your staging semester." : "Staging is not configured in this build."}</Text>
    {stagingSetup.config && <Chip label={connection.phase || "Continue with Google"} onPress={()=>void connection.login()}/>}
    {!!connection.message && <Text style={s.note}>{connection.message}</Text>}</View>;
  if (trial) return <View style={s.panel}><Chip label="Back to imported semester" onPress={()=>setTrial(false)}/><TrialAssessments connection={connection}/></View>;
  return <View style={s.panel}>
    <View style={s.heading}><View style={s.grow}><Text style={s.title}>{board ? `${board.year} · ${board.session}` : "Your imported semester"}</Text>
      <Text style={s.note}>{board ? `${board.units.length} units · ${board.rows.length} work items · Sydney dates` : "Private staging import"}</Text></View>
      <Chip label={loading ? "Loading…" : "Refresh"} onPress={()=>setReload(n=>n+1)}/></View>
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
          {u.average!==null && <Text style={s.note}>Based on {number(u.currentWeight)}% of unit weight</Text>}</View>)}
        <Text style={s.title}>Marks &amp; grade plans · {selected.grades.length}</Text>
        {selected.grades.map(g=><GradeRow key={g.id} grade={g}/>)}
        {!selected.grades.length && <Text style={s.note}>No marks or grade plans recorded for this selection.</Text>}
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
  score:{fontSize:17,fontWeight:"700",color:"#403680"},unit:{fontSize:12,fontWeight:"700",color:"#584AA5"},
  summary:{gap:3,paddingVertical:6},details:{minHeight:44,justifyContent:"center"}, link:{color:"#51449B",fontWeight:"600"},
  part:{paddingLeft:12,paddingBottom:5,gap:2},
});
