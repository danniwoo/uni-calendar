import React, {useMemo} from "react";
import {Pressable, ScrollView, StyleSheet, Text, View} from "react-native";
import {monthCells, shiftMonth} from "./experience";
import {dateKey, longDate} from "./model";
import {importedMonth, type MonthCounts} from "./imported-month";
import {stagingSetup} from "./staging-auth";
import type {ImportedSemesterState} from "./useImportedSemester";
import type {StagingConnectionState} from "./useStagingConnection";

const weekdays=["M","T","W","T","F","S","S"];
const zero:MonthCounts={deadlines:0,activities:0,other:0};
const monthName=new Intl.DateTimeFormat("en-AU",{timeZone:"UTC",month:"long",year:"numeric"});
function countLabel(c:MonthCounts) {
  return `${c.deadlines} due · ${c.activities} scheduled${c.other ? " · "+c.other+" other" : ""}`;
}
function Link({title,onPress}:{title:string;onPress:()=>void}){
  return <Pressable accessibilityRole="button" style={s.link} onPress={onPress}><Text style={s.linkText}>{title}</Text></Pressable>;
}
type Props = {now:number; imported:ImportedSemesterState; connection:StagingConnectionState; day:string; unit:string|null;
  chooseDay:(day:string|null)=>void; chooseUnit:(unit:string|null)=>void; openItem:(id:string)=>void; openUndated:()=>void};
export default function ImportedMonth({now,imported,connection,day,unit,chooseDay,chooseUnit,openItem,openUndated}:Props) {
  const {board,message,refresh}=imported;
  const month=day.slice(0,7), today=dateKey(now);
  const model=useMemo(()=>board ? importedMonth(board,month,unit) : null,[board,month,unit]);
  if(!board || !model) {
    const signIn=connection.authReady && !connection.session && stagingSetup.config;
    return <View style={s.section}>
      <Text style={s.note}>{!stagingSetup.config ? "Staging is not configured." : signIn ? "Sign in to see your semester calendar." : message || "Loading your semester…"}</Text>
      {!!signIn && <Link title={connection.phase || "Continue with Google"} onPress={()=>void connection.login()}/>}
      {!signIn && !!message && <Link title="Retry" onPress={refresh}/>}
      {!!signIn && !!connection.message && <Text style={s.note}>{connection.message}</Text>}
    </View>;
  }
  const period=board.weeks.find(w=>w.start<=day && day<=w.end);
  const items=model.days.get(day)?.items ?? [];
  const next=[...model.days.keys()].find(key=>key>day);
  const cells=monthCells(month);
  return <View style={s.section}>
    <View style={s.nav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={s.arrow} onPress={()=>chooseDay(shiftMonth(month,-1)+"-01")}><Text style={s.arrowText}>‹</Text></Pressable>
      <Text accessibilityRole="header" style={s.title}>{monthName.format(new Date(month+"-01T12:00:00Z"))}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" style={s.arrow} onPress={()=>chooseDay(shiftMonth(month,1)+"-01")}><Text style={s.arrowText}>›</Text></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
      {[null,...board.units.map(u=>u.code)].map(code=><Pressable key={code ?? "all"} accessibilityRole="button"
        accessibilityState={{selected:unit===code}} style={[s.filter,unit===code && s.active]} onPress={()=>chooseUnit(code)}>
        <Text style={[s.filterText,unit===code && s.white]}>{code ?? "All units"}</Text></Pressable>)}
    </ScrollView>
    <Text style={s.summary}>{countLabel(model.totals)}</Text>
    <View accessibilityLabel="Calendar, weeks start on Monday">
      <View style={s.week}>{weekdays.map((d,i)=><Text key={i} style={s.weekday}>{d}</Text>)}</View>
      {Array.from({length:cells.length/7},(_,w)=><View key={w} style={s.week}>{cells.slice(7*w,7*w+7).map((date,i)=>{
        if(!date)return <View key={i} style={s.cell}/>;
        const c=model.days.get(date) ?? zero;
        const chosen=date===day;
        return <Pressable key={date} accessibilityRole="button" accessibilityState={{selected:chosen}}
          accessibilityLabel={longDate(Date.parse(date+"T12:00:00Z"))+", "+countLabel(c)+(date===today ? ", today" : "")}
          style={[s.cell,chosen && s.selected,date===today && s.today]} onPress={()=>chooseDay(date)}>
          <Text style={[s.dateText,chosen && s.white]}>{Number(date.slice(-2))}</Text>
          <View style={s.dots}>{c.deadlines>0 && <View style={[s.dot,s.dueDot,chosen && s.lightDot]}/>}
            {c.activities>0 && <View style={[s.dot,s.activityDot]}/>}
            {c.other>0 && <View style={[s.dot,s.otherDot]}/>}</View>
        </Pressable>;
      })}</View>)}
    </View>
    <View style={s.legend}><View style={[s.dot,s.dueDot]}/><Text style={s.note}>Deadline</Text><View style={[s.dot,s.activityDot]}/><Text style={s.note}>Scheduled</Text>
      {model.totals.other>0 && <><View style={[s.dot,s.otherDot]}/><Text style={s.note}>Other work</Text></>}</View>
    <View style={s.nav}><Link title="Jump to today" onPress={()=>chooseDay(null)}/><Link title={`日期待確認 · ${model.undated} ›`} onPress={openUndated}/></View>
    <Text accessibilityRole="header" style={s.dateHeading}>{longDate(Date.parse(day+"T12:00:00Z"))}</Text>
    {!!period && <Text style={s.note}>{period.label}</Text>}
    {items.map(row=><Pressable key={row.id} accessibilityRole="button" style={s.item} onPress={()=>openItem(row.id)}>
      <Text style={s.code}>{row.unit} · {row.time ? (row.deadlineMode==="before" ? "before " : "")+row.time : "time TBC"}</Text>
      <Text style={s.itemTitle}>{row.title} ›</Text>
      <Text style={s.note}>{row.deadlineMode ? "Deadline" : row.scheduledActivity ? "Scheduled activity" : "Dated work"}{row.done ? " · Completed" : ""}</Text>
    </Pressable>)}
    {!items.length && <Text style={s.note}>{model.days.size ? "No dated work on this day." : "No dated work this month for this selection."}</Text>}
    {!items.length && next && <Link title="Next marked day ›" onPress={()=>chooseDay(next)}/>}
    {!!message && <><Text style={s.note}>{message}</Text><Link title="Refresh" onPress={refresh}/></>}
  </View>;
}
const s=StyleSheet.create({
  section:{gap:8},nav:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:4},title:{fontSize:23,fontWeight:"700",color:"#252438"},
  arrow:{width:44,minHeight:44,alignItems:"center",justifyContent:"center"},arrowText:{fontSize:27,color:"#584AA5"},filters:{gap:6},
  filter:{minHeight:44,paddingHorizontal:11,justifyContent:"center",borderRadius:10,backgroundColor:"#EFEBFA"},filterText:{fontWeight:"600",color:"#51449B",fontSize:13},
  active:{backgroundColor:"#584AA5"},white:{color:"#FFF"},summary:{fontSize:15,fontWeight:"600",color:"#403680"},week:{flexDirection:"row"},
  weekday:{flex:1,textAlign:"center",color:"#625F73",fontSize:12,paddingVertical:4},cell:{flex:1,minHeight:44,borderRadius:8,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"transparent"},
  selected:{backgroundColor:"#584AA5"},today:{borderColor:"#584AA5"},dateText:{fontSize:14,color:"#252438",fontWeight:"600"},
  dots:{height:6,flexDirection:"row",alignItems:"center",gap:3},dot:{height:5,width:5,borderRadius:3},dueDot:{backgroundColor:"#584AA5"},activityDot:{backgroundColor:"#258A78"},otherDot:{backgroundColor:"#888291"},lightDot:{backgroundColor:"#FFF"},
  legend:{flexDirection:"row",gap:6,alignItems:"center"},note:{color:"#625F73",fontSize:13,lineHeight:18},link:{minHeight:44,justifyContent:"center"},
  linkText:{fontSize:14,fontWeight:"600",color:"#584AA5"},dateHeading:{fontSize:19,fontWeight:"700",color:"#252438"},
  item:{minHeight:44,justifyContent:"center",gap:3,paddingVertical:7,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:"#D8D5DF"},
  code:{color:"#584AA5",fontSize:12,fontWeight:"700"},itemTitle:{fontSize:16,fontWeight:"600",color:"#252438"},
});
