import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { shortDate } from "./model";
import { homeSummary } from "./imported-home";
import { stagingSetup } from "./staging-auth";
import type { ImportedAssessments } from "./imported-work";
import type { StagingConnectionState } from "./useStagingConnection";
import type { ImportedSemesterState } from "./useImportedSemester";

type Row = ImportedAssessments["rows"][number];
type Props = {
  now:number; imported:ImportedSemesterState; connection:StagingConnectionState;
  openItem:(id:string)=>void; openUndated:()=>void;
};
const dayLabel = (date:string) => shortDate(Date.parse(date+"T12:00:00Z"));
const countLabel = (n:number, noun:string) => `${n} ${noun}${n===1 ? "" : "s"}`;
function HomeRow({row, open}:{row:Row; open:(id:string)=>void}) {
  const time = row.time ? `${row.deadlineMode==="before" ? "before " : ""}${row.time}` : "time TBC";
  return <Pressable accessibilityRole="button" onPress={()=>open(row.id)} style={s.item}>
    <View style={s.flex}><Text style={s.code}>{row.unit}</Text>
      <Text style={s.name}>{row.title}</Text>
      <Text style={s.meta}>{dayLabel(row.date!)} · {time} · {row.deadlineMode ? "Deadline" : "Scheduled activity"}</Text>
    </View>
    <Text style={s.arrow}>›</Text>
  </Pressable>;
}

export default function ImportedHome({now,imported,connection,openItem,openUndated}:Props) {
  const [period,setPeriod] = useState<"week"|"nextWeek">("week");
  const [expanded,setExpanded] = useState(false);
  const [allToday,setAllToday] = useState(false);
  const {board,message,loading} = imported;
  const summary = useMemo(()=>board ? homeSummary(board,now) : null,[board,now]);
  if (!board || !summary) {
    const signIn = !connection.session && connection.authReady && stagingSetup.config;
    return <View style={s.section}><Text style={s.heading}>Your semester</Text>
      <Text style={s.meta}>{!stagingSetup.config ? "Staging is not configured in this build."
        : signIn ? "Sign in to see your weeks, deadlines and work."
        : message || "Loading your semester…"}</Text>
      {!!signIn && <Pressable accessibilityRole="button" onPress={()=>void connection.login()} style={s.link}><Text style={s.linkText}>Continue with Google</Text></Pressable>}
      {!signIn && !!message && <Pressable accessibilityRole="button" onPress={imported.refresh} style={s.link}><Text style={s.linkText}>Retry</Text></Pressable>}
      {signIn && !!connection.message && <Text style={s.meta}>{connection.message}</Text>}
    </View>;
  }
  const week = summary[period];
  const term = board.session === "S1C" ? "Semester 1" : board.session === "S2C" ? "Semester 2" : board.session;
  const laterToday = summary.nextDeadline?.date === summary.today;
  return <View style={s.section}>
    <View style={s.top}><View style={s.flex}>
      <Text accessibilityRole="header" style={s.heading}>{summary.currentPeriod}</Text>
      <Text style={s.meta}>{term}, {board.year} · {countLabel(board.units.length,"unit")}</Text>
    </View><Pressable accessibilityRole="button" onPress={imported.refresh} disabled={loading} style={s.link}><Text style={s.linkText}>{loading ? "Loading…" : "Refresh"}</Text></Pressable></View>
    {!!message && <Text accessibilityLiveRegion="polite" style={s.meta}>{message}</Text>}

    <View style={s.block}><Text accessibilityRole="header" style={s.subhead}>Today</Text>
      <Text style={s.meta}>{summary.day.deadlines ? `${countLabel(summary.day.deadlines,"open deadline")} today` : "No open deadlines today"}
        {summary.day.activities ? ` · ${countLabel(summary.day.activities,"scheduled item")}` : ""}</Text>
      {(allToday ? summary.day.rows : summary.day.rows.slice(0,3)).map(row=><HomeRow key={row.id} row={row} open={openItem}/>)}
      {summary.day.rows.length > 3 && <Pressable accessibilityRole="button" onPress={()=>setAllToday(!allToday)} style={s.link}>
        <Text style={s.linkText}>{allToday ? "Show fewer" : `Show all ${summary.day.rows.length} today`}</Text></Pressable>}
    </View>
    {summary.nextDeadline && !laterToday && <View style={s.block}><Text style={s.eyebrow}>NEXT DEADLINE</Text>
      <HomeRow row={summary.nextDeadline} open={openItem}/></View>}

    <View style={s.block}><View style={s.top}><Text accessibilityRole="header" style={[s.subhead,s.flex]}>Weekly workload</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`日期待確認 · ${summary.undated} work items without an exact date`} onPress={openUndated} style={s.link}>
        <Text style={s.linkText}>日期待確認 · {summary.undated} ›</Text></Pressable></View>
      <View style={s.choices}>{(["week","nextWeek"] as const).map(key=>(
        <Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:period===key}}
          onPress={()=>{setPeriod(key);setExpanded(false);}} style={[s.choice,period===key && s.selected]}>
          <Text style={[s.choiceTitle,period===key && s.white]}>{key==="week" ? "This week" : "Next week"}</Text>
          <Text style={[s.meta,period===key && s.white]}>{summary[key].deadlines} due · {summary[key].activities} scheduled</Text>
        </Pressable>
      ))}</View>
      <Text style={s.meta}>{dayLabel(week.start)} – {dayLabel(week.end)}{period==="nextWeek" && summary.nextPeriod ? ` · ${summary.nextPeriod}` : ""}</Text>
      {(expanded ? week.rows : week.rows.slice(0,3)).map(row=><HomeRow key={row.id} row={row} open={openItem}/>)}
      {!week.rows.length && <Text style={s.meta}>No open deadlines or scheduled work in this week.</Text>}
      {week.rows.length > 3 && <Pressable accessibilityRole="button" onPress={()=>setExpanded(!expanded)} style={s.link}>
        <Text style={s.linkText}>{expanded ? "Show fewer" : `Show all ${week.rows.length} items`}</Text></Pressable>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  section:{gap:16}, top:{flexDirection:"row",alignItems:"center",gap:8},flex:{flex:1}, block:{gap:5},
  heading:{fontSize:30,fontWeight:"800",color:"#252438"},subhead:{fontSize:18,fontWeight:"700",color:"#252438"},
  meta:{fontSize:13,lineHeight:19,color:"#625F73"},code:{color:"#584AA5",fontSize:12,fontWeight:"700"},
  name:{fontSize:16,fontWeight:"600",color:"#252438"},eyebrow:{fontSize:12,fontWeight:"700",letterSpacing:1,color:"#584AA5"},
  item:{flexDirection:"row",alignItems:"center",gap:8,minHeight:44,paddingVertical:6,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:"#D8D5DF"},
  arrow:{fontSize:20,color:"#625F73"},link:{justifyContent:"center",minHeight:44,alignSelf:"flex-start",paddingHorizontal:5},
  linkText:{fontSize:14,fontWeight:"600",color:"#584AA5"},choices:{flexDirection:"row",gap:6},
  choice:{flex:1,borderRadius:10,minHeight:44,justifyContent:"center",paddingVertical:8,paddingHorizontal:10,backgroundColor:"#EFEBFA"},
  choiceTitle:{fontWeight:"700",color:"#403680"},selected:{backgroundColor:"#584AA5"},white:{color:"white"},
});
