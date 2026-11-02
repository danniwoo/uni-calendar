import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { clockTime, shortDate } from "./model";
import { stagingSetup } from "./staging-auth";
import type { StagingConnectionState } from "./useStagingConnection";

export default function TrialAssessments({connection}: {connection: StagingConnectionState}) {
  const [filter, setFilter] = useState<string | null>(null);
  const {session, accountId, board, phase, message, noBoard, widgetState} = connection;
  const verified = session && accountId ? board : undefined;
  const items = [...(verified?.semester.assessments ?? [])]
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.title.localeCompare(b.title));
  const units = [...new Set(items.map(item => item.unitCode))].sort();
  const selected = filter && units.includes(filter) ? filter : null;
  const visible = selected ? items.filter(item => item.unitCode === selected) : items;
  const action = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" disabled={Boolean(phase)} onPress={onPress} style={s.action}>
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
  if (!stagingSetup.config) return <Text style={s.note}>Cloud assessments need a build connected to the staging service.</Text>;
  return <View style={s.section}>
    {session ? <>
      <View style={s.heading}>
        <View style={s.grow}>
          <Text style={s.title}>{verified ? verified.semester.weekLabel : "Your test semester"}</Text>
          <Text style={s.note}>{verified ? `${items.length} assessments · Revision ${verified.revision} · Sydney time` : "Load the semester saved under this account."}</Text>
        </View>
        {action(phase ? "Loading…" : "Refresh", () => void connection.request("load"))}
      </View>
      {verified && <>
        {units.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {[null, ...units].map(unit => <Pressable key={unit ?? "all"} accessibilityRole="button"
            accessibilityState={{selected: selected === unit}} style={[s.filter, selected === unit && s.active]}
            onPress={() => setFilter(unit)}>
            <Text style={[s.filterText, selected === unit && s.activeText]}>{unit ?? "All units"}</Text>
          </Pressable>)}
        </ScrollView>}
        {visible.map(item => {
          const due = Date.parse(item.dueAt);
          return <View key={item.id} style={s.row}>
            <View style={s.heading}><Text style={s.unit}>{item.unitCode}</Text><Text style={s.note}>{item.weightLabel}</Text></View>
            <Text style={s.name}>{item.title}</Text><Text style={s.note}>{shortDate(due)} · {clockTime(due)}</Text>
          </View>;
        })}
        {!visible.length && <Text style={s.note}>No assessments in this test semester.</Text>}
      </>}
      {noBoard && action("Create test semester", () => void connection.request("create"))}
    </> : <>
      <Text style={s.title}>Your cloud assessments</Text>
      <Text style={s.note}>Sign in with the Google account you use for the Semester web trial.</Text>
      {action(phase || "Continue with Google", () => void connection.login())}
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.note}>{message}</Text>}
    {verified && widgetState.snapshot?.revision === verified.revision && <Text style={s.note}>Last read {clockTime(widgetState.snapshot.syncedAt)} · Sydney</Text>}
  </View>;
}

const s = StyleSheet.create({
  section:{gap:12}, heading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  grow:{flex:1}, title:{fontSize:20,fontWeight:"700",color:"#252438"}, note:{fontSize:13,lineHeight:19,color:"#625F73"},
  action:{minHeight:44,justifyContent:"center",paddingHorizontal:12,backgroundColor:"#EFEBFA",borderRadius:10},
  actionText:{fontSize:14,fontWeight:"600",color:"#584AA5"}, filters:{gap:8},
  filter:{minHeight:44,justifyContent:"center",paddingHorizontal:12,borderRadius:10,backgroundColor:"#EFEBFA"},
  active:{backgroundColor:"#584AA5"},filterText:{color:"#584AA5",fontWeight:"600"},activeText:{color:"white"},
  row:{paddingVertical:10,gap:4,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:"#D8D5DF"},
  unit:{color:"#584AA5",fontWeight:"700",fontSize:12},name:{fontSize:16,fontWeight:"600",color:"#252438"},
});
