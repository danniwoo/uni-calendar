import React, {useMemo, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {homeSummary} from "./imported-home";
import {todaySuggestions, type PreparationSuggestion} from "./imported-today";
import {dateKey} from "./model";
import {accountPlan, devicePlan, type PlanStorage} from "./plan-storage";
import {usePersonalPlan} from "./usePersonalPlan";
import type {ImportedSemesterState} from "./useImportedSemester";
import type {StagingConnectionState} from "./useStagingConnection";
import TodayPlan from "./TodayPlan";

function Link({title,onPress}:{title:string;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.link}><Text style={s.linkText}>{title}</Text></Pressable>;
}
function Plan({storage,units,today,suggestions,openSource}:{storage:PlanStorage;units:string[];today:string;suggestions?:PreparationSuggestion[];openSource?:(id:string)=>void}) {
  const plan=usePersonalPlan(storage);
  return <TodayPlan plan={plan} units={units} today={today} suggestions={suggestions} openSource={openSource}/>;
}
export default function ImportedToday({now,imported,connection,openItem}:{
  now:number; imported:ImportedSemesterState; connection:StagingConnectionState; openItem:(id:string)=>void;
}) {
  const [legacy,setLegacy]=useState(false);
  const subject=connection.session?.user.id;
  const storage=useMemo(()=>subject ? accountPlan(subject) : null,[subject]);
  const today=dateKey(now);
  const {board,message,refresh}=imported;
  const week=useMemo(()=>board && homeSummary(board,now),[board,now]);
  const suggestions=useMemo(()=>board && todaySuggestions(board,now),[board,now]);
  const units=board?.units.map(unit=>unit.code) ?? [];
  if(legacy) return <View style={s.area}>
    <Link title="← Today" onPress={()=>setLegacy(false)}/>
    <Text style={s.header}>On this iPhone</Text>
    <Text style={s.note}>Earlier device-only tasks. This list stays on this phone.</Text>
    <Plan key="device" storage={devicePlan} today={today} units={units}/>
  </View>;
  return <View style={s.area}>
    {week && storage && board ? <>
      <Text style={s.note}>{week.currentPeriod} · Your imported semester</Text>
      <View style={s.heading}><Text style={s.header}>Due today · {week.day.deadlines}</Text><Link title="Refresh semester" onPress={refresh}/></View>
      {!week.day.deadlines && <Text style={s.note}>No open deadlines today.</Text>}
      {week.day.rows.filter(row=>row.deadlineMode).map(row=><Pressable key={row.id} accessibilityRole="button" onPress={()=>openItem(row.id)} style={s.row}>
        <Text style={s.code}>{row.unit} · {row.time ? (row.deadlineMode==="before" ? "before " : "")+row.time : "time TBC"}</Text>
        <Text style={s.name}>{row.title} ›</Text></Pressable>)}
      {week.day.activities>0 && <><Text style={s.header}>Scheduled today · {week.day.activities}</Text>
        {week.day.rows.filter(row=>row.scheduledActivity).map(row=><Link key={row.id} title={`${row.unit} · ${row.title} · ${row.time || "time TBC"} ›`} onPress={()=>openItem(row.id)}/>)}</>}
      {!!message && <Text style={s.note}>{message}</Text>}
      <Plan key={subject} storage={storage} today={today} units={units} suggestions={suggestions} openSource={openItem}/>
    </> : <>
      <Text style={s.note}>{!connection.authReady ? "Loading your semester…" : !subject ? "Sign in to plan from your semester." : message || "Loading your imported semester…"}</Text>
      {!subject && connection.authReady && <Link title={connection.phase || "Continue with Google"} onPress={()=>void connection.login()}/>}
      {subject && !!message && <Link title="Retry" onPress={refresh}/>}
      {!subject && !!connection.message && <Text style={s.note}>{connection.message}</Text>}
    </>}
    <Link title="Earlier device-only tasks ›" onPress={()=>setLegacy(true)}/>
  </View>;
}
const s=StyleSheet.create({area:{gap:8},heading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  header:{fontSize:17,fontWeight:"700",color:"#252438"},note:{fontSize:13,lineHeight:19,color:"#625F73"},
  link:{minHeight:44,justifyContent:"center",alignSelf:"flex-start"},linkText:{fontSize:14,fontWeight:"600",color:"#584AA5"},
  row:{minHeight:44,gap:3,justifyContent:"center"},code:{fontWeight:"600",fontSize:12,color:"#584AA5"},name:{fontSize:15,fontWeight:"600",color:"#252438"}});
