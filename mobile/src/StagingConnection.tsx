import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { stagingSetup } from "./staging-auth";
import type { StagingConnectionState } from "./useStagingConnection";

export default function StagingConnection({connection}: {connection:StagingConnectionState}) {
  const {session,board,accountId,phase,message,noBoard,login,signOut,request,widgetState} = connection;
  const button = (label: string, action: () => void, secondary = false) => <Pressable accessibilityRole="button" disabled={!!phase} onPress={action}
    style={({pressed})=>[s.button,secondary&&s.secondary,(pressed||!!phase)&&{opacity:.5}]}><Text style={[s.buttonText,secondary&&{color:"#584AA5"}]}>{label}</Text></Pressable>;
  return <View style={s.root}>
    <Text style={s.title}>Connect the test semester.</Text>
    <Text style={s.body}>Google sign-in → shared test data on Web and iPhone.</Text>
    {!stagingSetup.config ? <View style={s.panel}><Text style={s.heading}>Setup needed</Text><Text style={s.body}>{stagingSetup.error}</Text>
      <Text style={s.caption}>The build needs the Supabase project URL, publishable key and independent staging API URL. Your current sample app still works.</Text></View> : <>
      <Text style={s.caption}>STAGING · SYNTHETIC RECORDS</Text>
      {session ? <>
        <Text style={s.body}>Signed in as {session.user.email ?? "your test account"}</Text>
        {button("Load / refresh test semester",()=>void request("load"))}
        {noBoard && button("Create my sample semester",()=>void request("create"),true)}
        {accountId ? <Text style={s.caption}>API identity verified · {accountId.slice(0,8)}…</Text> : null}
        <View style={s.panel}>
          <Text style={s.heading}>Cloud deadline · Trial</Text>
          <Text style={s.caption}>{widgetState.props.unit}</Text>
          <Text style={s.heading}>{widgetState.props.title}</Text>
          <Text style={s.body}>{widgetState.props.when}</Text>
          <Text style={s.caption}>{widgetState.props.freshness} · Sydney</Text>
          <Text style={s.caption}>{widgetState.props.progress}</Text>
          <Text style={s.caption}>Lock Screen → Customise → Add Widgets → Semester Preview → Cloud deadline · Trial. A larger version is also available on the Home Screen.</Text>
          <Text style={s.caption}>Tap the widget to return here. Refreshes when Semester opens or returns to the foreground. iOS controls when the widget redraws.</Text>
          {!!widgetState.error && <Text accessibilityLiveRegion="polite" style={s.body}>{widgetState.error}</Text>}
        </View>
        {board && <View style={s.panel}>
          <Text style={s.heading}>{board.semester.title}</Text><Text style={s.caption}>{board.semester.weekLabel} · revision {board.revision}</Text>
          <Text style={s.heading}>Deadlines</Text>
          {board.semester.assessments.map(a=><View key={a.id} style={s.row}><Text style={s.body}>{a.unitCode} · {a.title}</Text><Text style={s.caption}>{new Date(a.dueAt).toLocaleString("en-AU",{timeZone:"Australia/Sydney"})} · Sydney · {a.weightLabel}</Text></View>)}
          <Text style={s.heading}>Test preparation</Text>
          {board.semester.tasks.map(t=><Pressable key={t.id} accessibilityRole="checkbox" accessibilityState={{checked:t.completed,disabled:!!phase}} disabled={!!phase}
            onPress={()=>void request("toggle",t.id)} style={s.row}><Text style={s.body}>{t.completed?"☑":"☐"} {t.title}</Text><Text style={s.caption}>{t.unitCode}</Text></Pressable>)}
        </View>}
        {button("Sign out of this device",()=>void signOut(),true)}
      </> : <>{button("Continue with Google",()=>void login())}
        {!!message && button("Clear saved session",()=>void signOut(),true)}</>}
    </>}
    {!!phase && <View style={s.progress}><ActivityIndicator color="#584AA5"/><Text style={s.body}>{phase}</Text></View>}
    {!!message && <Text accessibilityLiveRegion="polite" style={s.body}>{message}</Text>}
    {!session && <Text style={s.caption}>Sign in and load the test semester to connect the cloud widget.</Text>}
    {!session && !!widgetState.error && <Text style={s.body}>{widgetState.error}</Text>}
    <Text style={s.caption}>Cloud test work and its new widget are separate from the sample app screens, sample widgets and your device-local personal tasks. No old website data has been imported.</Text>
  </View>;
}

const s=StyleSheet.create({root:{gap:14},title:{fontSize:28,fontWeight:"700",color:"#252438"},body:{fontSize:14,lineHeight:21,color:"#252438"},heading:{fontSize:16,fontWeight:"700",color:"#252438"},caption:{fontSize:12,lineHeight:18,color:"#716E80"},panel:{backgroundColor:"white",padding:16,borderRadius:14,borderWidth:1,borderColor:"#E6E3EB",gap:12},row:{paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#E6E3EB"},button:{minHeight:46,backgroundColor:"#584AA5",borderRadius:12,alignItems:"center",justifyContent:"center",padding:12},buttonText:{fontSize:14,fontWeight:"600",color:"white"},secondary:{backgroundColor:"#EFEBFA"},progress:{flexDirection:"row",gap:10,alignItems:"center"}});
