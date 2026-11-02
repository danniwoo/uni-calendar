import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NextClassWidget from "./src/widgets/NextClass";
import {
  DeadlineWidget,
  DeadlinesWidget,
  OverviewWidget,
} from "./src/widgets/Deadlines";
import {
  clockTime,
  dateKey,
  longDate,
  makeSampleBoard,
  readStoredSample,
  resolveLink,
  shortDate,
  widgetTimeline,
  type SampleBoard,
  type SampleAssessment,
} from "./src/model";
import {
  dueLabel,
  experienceBoard,
  monthCells,
  sampleGrades,
  sampleWeek,
  shiftMonth,
  workload,
  workWidgetProps,
  workWidgetTimeline,
} from "./src/experience";

import {
  DEFAULT_WIDGET_SETTINGS,
  readWidgetSettings,
  toggleWidgetUnit,
  type WidgetSettings,
} from "./src/widget-settings";
import ImportedToday from "./src/ImportedToday";
import ConnectionCheck from "./src/ConnectionCheck";
import StagingConnection from "./src/StagingConnection";
import CloudAssessments from "./src/CloudAssessments";
import ImportedHome from "./src/ImportedHome";
import { useStagingConnection } from "./src/useStagingConnection";
import { useImportedSemester } from "./src/useImportedSemester";
import { IMPORTED_URL, readFocusURL, type FocusTarget } from "./src/deadline-focus";
import { CLOUD_WIDGET_URL } from "./src/cloud-widget";
import { STAGING_AUTH_REDIRECT } from "./src/staging-core";
import { CONNECTION_RETURN_URL } from "./src/connection-check";
const WIDGET_SETTINGS_KEY = "semester.preview.widgets.v1";
const STORAGE_KEY = "semester.preview.sample.v1";
const P = {
  paper: "#F7F6F2",
  ink: "#252438",
  muted: "#716E80",
  purple: "#584AA5",
  lavender: "#EFEBFA",
  line: "#E6E3EB",
  green: "#28786D",
  amber: "#8D5A22",
};
const unitColor = (unit: string) =>
  unit === "ISYS2120" ? P.purple : unit === "SOFT2412" ? P.green : "#9B603F";
type Tab = "Home" | "Today" | "Month" | "Assessments";
type Detail = { kind: "class" | "assessment"; id: string };
function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (pressed || disabled) && s.pressed,
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: P.purple }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Tag({ unit }: { unit: string }) {
  return <Text style={[s.tag, { color: unitColor(unit) }]}>● {unit}</Text>;
}
function Heading({
  title,
  link,
  onPress,
}: {
  title: string;
  link?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.heading}>
      <Text style={s.h2}>{title}</Text>
      {link && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={s.smallButton}
        >
          <Text style={s.link}>{link}</Text>
        </Pressable>
      )}
    </View>
  );
}
function Prototype() {
  const cloudConnection = useStagingConnection();
  const imported = useImportedSemester(cloudConnection);
  const [homeEntry, setHomeEntry] = useState<"item" | "todayItem" | "undated" | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget|null>(null);
  const [board, setBoard] = useState<SampleBoard>();
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>("Home");
  const [assessmentSource, setAssessmentSource] = useState<"cloud" | "sample">("cloud");
  const [now, setNow] = useState(Date.now());
  const [detail, setDetail] = useState<Detail>();
  const [settings, setSettings] = useState(false);
  const [connectionCheck, setConnectionCheck] = useState(false);
  const [stagingConnection, setStagingConnection] = useState(false);
  const [widgetChoice, setWidgetChoice] = useState<
    "Single" | "Two" | "Overview"
  >("Single");
  const [unit, setUnit] = useState("All units");
  const [assessmentView, setAssessmentView] = useState<"Work" | "Grades">(
    "Work",
  );
  const [selectedDay, setSelectedDay] = useState(dateKey(Date.now()));
  const [month, setMonth] = useState(dateKey(Date.now()).slice(0, 7));
  const [busy, setBusy] = useState(false),
    [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState(
    "Sample data · saved on this iPhone",
  );
  const [widgetSettings, setWidgetSettings] = useState<WidgetSettings>(
    DEFAULT_WIDGET_SETTINGS,
  );
  const [widgetDraft, setWidgetDraft] = useState<WidgetSettings>(
    DEFAULT_WIDGET_SETTINGS,
  );
  const [widgetSaveState, setWidgetSaveState] = useState("");
  const [widgetError, setWidgetError] = useState(false);
  const lock = useRef(false),
    initialLinkHandled = useRef(false);
  async function load() {
    setLoadError(false);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY),
        restored = readStoredSample(raw);
      const base = restored?.board ?? makeSampleBoard(Date.now());
      const expanded = experienceBoard(base);
      // Only this version's known IDs are restored; retain the baseline storage shape.
      const saved = restored && raw ? JSON.parse(raw) : undefined;
      const nextProgress = Object.fromEntries(
        expanded.assessments.map((a) => [
          a.id,
          restored ? saved?.progress?.[a.id] === true : false,
        ]),
      );
      if (!restored)
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 1,
            createdAt: base.createdAt,
            progress: {},
          }),
        );
      const preferences = readWidgetSettings(
        await AsyncStorage.getItem(WIDGET_SETTINGS_KEY),
        expanded,
      );
      setWidgetSettings(preferences);
      setWidgetDraft(preferences);
      setProgress(nextProgress);
      setBoard(expanded);
    } catch {
      setLoadError(true);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (!board) return;
    const publish = () => {
      try {
        const time = Date.now(),
          timeline = workWidgetTimeline(board, time, widgetSettings);
        NextClassWidget.updateTimeline(widgetTimeline(board, time));
        DeadlineWidget.updateTimeline(timeline);
        DeadlinesWidget.updateTimeline(timeline);
        OverviewWidget.updateTimeline(timeline);
        setWidgetError(false);
      } catch {
        setWidgetError(true);
      }
    };
    publish();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") publish();
    });
    return () => listener.remove();
  }, [board, widgetSettings]);
  useEffect(() => {
    if (!settings) {
      setWidgetDraft(widgetSettings);
      setWidgetSaveState("");
    }
  }, [settings, widgetSettings]);
  async function saveWidgetSettings() {
    if (lock.current || widgetDraft.units?.length === 0) return;
    lock.current = true;
    setBusy(true);
    setWidgetSaveState("Saving…");
    try {
      await AsyncStorage.setItem(
        WIDGET_SETTINGS_KEY,
        JSON.stringify(widgetDraft),
      );
      setWidgetSettings(widgetDraft);
      setWidgetSaveState("Saved on this iPhone · widget refresh requested");
    } catch {
      setWidgetSaveState(
        "Could not save. Your widgets still use the previous settings.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    const open = (url: string) => {
      if (!active) return;
      // Authentication-browser diagnostics own this return; never treat it as
      // a widget link or as evidence that the app is signed in.
      if (url.split(/[?#]/)[0] === CONNECTION_RETURN_URL) return;
      if (url.split(/[?#]/)[0] === STAGING_AUTH_REDIRECT) return;
      const item = readFocusURL(url);
      if (url === "semester-preview://today-plan") {
        setDetail(undefined); setFocusTarget(null); setHomeEntry(null); setSettings(false); setTab("Today"); return;
      }
      if (item || url === IMPORTED_URL) {
        setHomeEntry(null); setFocusTarget(item); setDetail(undefined); setSettings(false); setStagingConnection(false);
        setConnectionCheck(false); setAssessmentSource("cloud"); setTab("Assessments");
        return;
      }
      if (url === CLOUD_WIDGET_URL) {
        setDetail(undefined); setConnectionCheck(false); setStagingConnection(true); setSettings(true);
        return;
      }
      if (!board) return;
      const destination = resolveLink(url, board);
      if (destination) {
        setSettings(false);
        setDetail(destination);
        if (destination.kind === "assessment") setAssessmentSource("sample");
        setTab(destination.kind === "assessment" ? "Assessments" : "Today");
        return;
      }
      if (url === "semester-preview://assessments") {
        setSettings(false);
        setDetail(undefined);
        setUnit("All units");
        setAssessmentView("Work");
        setAssessmentSource("sample");
        setTab("Assessments");
      } else if (url === "semester-preview://schedule") {
        setSettings(false);
        setDetail(undefined);
        setTab("Today");
      } else if (url.startsWith("semester-preview://"))
        Alert.alert(
          "Sample item unavailable",
          "Open Assessments to find the current sample work.",
        );
    };
    if ((board || loadError) && !initialLinkHandled.current) {
      initialLinkHandled.current = true;
      void Linking.getInitialURL()
        .then((url) => {
          if (url) open(url);
        })
        .catch(() => {});
    }
    const listener = Linking.addEventListener("url", ({ url }) => open(url));
    return () => {
      active = false;
      listener.remove();
    };
  }, [board, loadError]);
  async function togglePreparation(id: string) {
    if (!board || lock.current) return;
    lock.current = true;
    setBusy(true);
    const updated = { ...progress, [id]: !progress[id] };
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          createdAt: board.createdAt,
          progress: updated,
        }),
      );
      setProgress(updated);
      setSaveState("Preparation saved on this iPhone");
    } catch {
      setSaveState("Could not save · try again");
      Alert.alert(
        "Preparation not saved",
        "Please try again. Your previous progress is unchanged.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refreshSample() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const fresh = makeSampleBoard(Date.now());
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          createdAt: fresh.createdAt,
          progress: {},
        }),
      );
      setBoard(experienceBoard(fresh));
      setProgress({});
      setNow(Date.now());
      setSelectedDay(dateKey(Date.now()));
      setMonth(dateKey(Date.now()).slice(0, 7));
      setDetail(undefined);
      setSettings(false);
      setSaveState("New sample saved on this iPhone");
    } catch {
      Alert.alert("Could not refresh", "Your previous sample is unchanged.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const cloudTab = tab === "Assessments" && assessmentSource === "cloud";
  const importedTab = tab === "Home" || tab === "Today" || cloudTab;
  if (!board && !importedTab)
    return (
      <SafeAreaView style={s.loading}>
        {loadError ? (
          <>
            <Text style={s.h2}>Couldn’t load the preview</Text>
            <Button label="Retry" onPress={() => void load()} />
            <Button label="Back to Home" onPress={() => setTab("Home")} />
          </>
        ) : (
          <ActivityIndicator color={P.purple} />
        )}
      </SafeAreaView>
    );
  const sample: SampleBoard = board ?? {version:1, createdAt:now, assessments:[], classes:[]};
  const today = dateKey(now),
    work = workload(sample, now),
    week = sampleWeek(sample, now);
  const units = [...new Set(sample.assessments.map((a) => a.unit))];
  const sorted = [...sample.assessments].sort(
    (a, b) => (a.due ?? Infinity) - (b.due ?? Infinity),
  );
  const assessment =
    detail?.kind === "assessment"
      ? sample.assessments.find((a) => a.id === detail.id)
      : undefined;
  const classItem =
    detail?.kind === "class"
      ? sample.classes.find((c) => c.id === detail.id)
      : undefined;
  const widget = workWidgetProps(sample, now, widgetDraft);
  const widgetDirty =
    JSON.stringify(widgetDraft) !== JSON.stringify(widgetSettings);
  const openAssessment = (a: SampleAssessment) =>
    setDetail({ kind: "assessment", id: a.id });
  function row(a: SampleAssessment) {
    return (
      <Pressable
        key={a.id}
        accessibilityRole="button"
        accessibilityLabel={`${a.unit}, ${a.title}, ${dueLabel(a, now)}, ${a.weight} of unit`}
        onPress={() => openAssessment(a)}
        style={({ pressed }) => [s.assessmentRow, pressed && s.pressed]}
      >
        <View style={[s.unitLine, { backgroundColor: unitColor(a.unit) }]} />
        <View style={s.flex}>
          <View style={s.row}>
            <Tag unit={a.unit} />
            <Text style={s.meta}>{a.weight}</Text>
          </View>
          <Text style={s.rowTitle}>{a.title}</Text>
          <Text
            style={[
              s.meta,
              (a.due === undefined || a.due <= now) && { color: P.amber },
            ]}
          >
            {dueLabel(a, now)}
          </Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </Pressable>
    );
  }
  function empty(text: string) {
    return <Text style={s.empty}>{text}</Text>;
  }
  const titles: Record<Tab, string> = {
    Home: "Your semester.",
    Today: "Today",
    Month: "See what’s ahead.",
    Assessments: "Keep work in view.",
  };
  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <Text style={s.brand}>
          semester<Text style={{ color: P.purple }}>.</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Widgets and settings"
          onPress={() => setSettings(true)}
          style={s.settingsButton}
        >
          <Text style={s.link}>Widgets ⚙</Text>
        </Pressable>
      </View>
      <ScrollView key={focusTarget && tab === "Assessments" ? tab + focusTarget.id : tab} contentContainerStyle={s.content}>
        <View style={s.row}>
          <Text style={s.eyebrow}>
            {tab === "Home" ? shortDate(now).toUpperCase() + " · SYDNEY" : cloudTab ? "CLOUD · IMPORTED SEMESTER" : tab === "Today"
              ? shortDate(now).toUpperCase()
              : `SAMPLE WEEK ${week} · ${units.length} UNITS`}
          </Text>
          <Text style={s.sample}>PREVIEW 0.3.9</Text>
        </View>
        {tab !== "Home" && <Text style={s.title}>{tab === "Assessments" ? "Assessments" : titles[tab]}</Text>}
        {tab === "Home" && <ImportedHome now={now} imported={imported} connection={cloudConnection}
          openItem={id=>{
            if (!imported.scope) return;
            setHomeEntry("item"); setFocusTarget({scope:imported.scope,id}); setAssessmentSource("cloud"); setTab("Assessments");
          }}
          openUndated={()=>{
            setHomeEntry("undated"); setFocusTarget(null); setAssessmentSource("cloud"); setTab("Assessments");
          }}
        />}
        {tab === "Today" && <ImportedToday key={cloudConnection.session?.user.id ?? "guest"}
          now={now} imported={imported} connection={cloudConnection} openItem={id=>{
            if(!imported.scope)return;
            setHomeEntry("todayItem"); setFocusTarget({scope:imported.scope,id}); setAssessmentSource("cloud"); setTab("Assessments");
          }}/>}
        {tab === "Month" && (
          <>
            <Text style={s.subtitle}>Deadlines across units · Sydney time</Text>
            <View style={s.monthHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => {
                  const m = shiftMonth(month, -1);
                  setMonth(m);
                  setSelectedDay(`${m}-01`);
                }}
                style={s.arrow}
              >
                <Text style={s.h2}>‹</Text>
              </Pressable>
              <Text style={s.h2}>
                {new Intl.DateTimeFormat("en-AU", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(`${month}-01T12:00:00Z`))}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => {
                  const m = shiftMonth(month, 1);
                  setMonth(m);
                  setSelectedDay(`${m}-01`);
                }}
                style={s.arrow}
              >
                <Text style={s.h2}>›</Text>
              </Pressable>
            </View>
            <View style={s.calendar}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <View key={`h${i}`} style={s.calendarCell}>
                  <Text style={s.meta}>{d}</Text>
                </View>
              ))}
              {monthCells(month).map((day, i) =>
                day ? (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={`${longDate(Date.parse(`${day}T12:00:00Z`))}, ${sample.assessments.filter((a) => a.due !== undefined && dateKey(a.due) === day).length} deadlines`}
                    accessibilityState={{ selected: day === selectedDay }}
                    onPress={() => setSelectedDay(day)}
                    style={s.calendarCell}
                  >
                    <View
                      style={[
                        s.dayCircle,
                        day === today && s.todayCircle,
                        day === selectedDay && s.selectedDay,
                      ]}
                    >
                      <Text
                        style={[
                          s.dayText,
                          day === selectedDay && { color: "#fff" },
                        ]}
                      >
                        {Number(day.slice(-2))}
                      </Text>
                    </View>
                    <View style={s.dots}>
                      {sample.assessments
                        .filter(
                          (a) => a.due !== undefined && dateKey(a.due) === day,
                        )
                        .map((a) => (
                          <View
                            key={a.id}
                            style={[
                              s.dot,
                              { backgroundColor: unitColor(a.unit) },
                            ]}
                          />
                        ))}
                    </View>
                  </Pressable>
                ) : (
                  <View key={`blank${i}`} style={s.calendarCell} />
                ),
              )}
            </View>
            <View style={s.legend}>
              {units.map((u) => (
                <Tag key={u} unit={u} />
              ))}
            </View>
            <Heading
              title={
                selectedDay === today
                  ? "Today"
                  : shortDate(Date.parse(`${selectedDay}T12:00:00Z`))
              }
              link="Jump to today"
              onPress={() => {
                setSelectedDay(today);
                setMonth(today.slice(0, 7));
              }}
            />
            <View style={s.panel}>
              {sample.assessments.filter(
                (a) => a.due !== undefined && dateKey(a.due) === selectedDay,
              ).length
                ? sample.assessments
                    .filter(
                      (a) =>
                        a.due !== undefined && dateKey(a.due) === selectedDay,
                    )
                    .map(row)
                : empty("No dated assessments on this day.")}
            </View>
            <Heading title="Dates to confirm" />
            <View style={s.panel}>{work.unknown.map(row)}</View>
            <Heading title="This month" />
            <View style={s.panel}>
              {sorted.filter(
                (a) => a.due !== undefined && dateKey(a.due).startsWith(month),
              ).length
                ? sorted
                    .filter(
                      (a) =>
                        a.due !== undefined && dateKey(a.due).startsWith(month),
                    )
                    .map(row)
                : empty("No dated work in this sample month.")}
            </View>
          </>
        )}
        {tab === "Assessments" && (
          <>
            <View style={s.segments}>
              {(["cloud", "sample"] as const).map(source => (
                <Pressable key={source} accessibilityRole="tab" accessibilityState={{selected: source === assessmentSource}}
                  onPress={() => setAssessmentSource(source)} style={[s.segment, source === assessmentSource && s.segmentActive]}>
                  <Text style={s.segmentText}>{source === "cloud" ? "Cloud semester" : "Local sample"}</Text>
                </Pressable>
              ))}
            </View>
            {cloudTab ? <CloudAssessments key={cloudConnection.session?.user.id ?? "guest"} connection={cloudConnection}
              imported={imported} target={focusTarget} initialView={homeEntry==="undated" ? "日期待確認" : "Work"}
              backLabel={homeEntry==="item" ? "← Home" : homeEntry==="todayItem" ? "← Today" : "← All assessments"}
              closeDetail={()=>{setFocusTarget(null); if(homeEntry==="item" || homeEntry==="todayItem"){setTab(homeEntry==="item" ? "Home" : "Today");setHomeEntry(null);}}}/> : <>
            <Text style={s.subtitle}>
              Requirements, preparation and results together.
            </Text>
            <View style={s.segments}>
              {(["Work", "Grades"] as const).map((v) => (
                <Pressable
                  key={v}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: v === assessmentView }}
                  onPress={() => setAssessmentView(v)}
                  style={[s.segment, v === assessmentView && s.segmentActive]}
                >
                  <Text
                    style={[
                      s.segmentText,
                      v === assessmentView && { color: P.ink },
                    ]}
                  >
                    {v}
                  </Text>
                </Pressable>
              ))}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filters}
            >
              {["All units", ...units].map((u) => (
                <Pressable
                  key={u}
                  accessibilityRole="button"
                  accessibilityState={{ selected: unit === u }}
                  onPress={() => setUnit(u)}
                  style={[s.filter, unit === u && s.filterActive]}
                >
                  <Text style={[s.filterText, unit === u && { color: "#fff" }]}>
                    {u}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {assessmentView === "Work" ? (
              <>
                <Heading
                  title={unit === "All units" ? "All assessments" : unit}
                />
                <View style={s.panel}>
                  {sorted
                    .filter((a) => unit === "All units" || a.unit === unit)
                    .map(row)}
                </View>
                <Text style={s.caption}>
                  A past date means check the submission status. It doesn’t mean
                  your work is incomplete.
                </Text>
              </>
            ) : (
              <>
                <Heading title="Sample results" />
                <View style={s.panel}>
                  {sampleGrades
                    .filter((g) => unit === "All units" || g.unit === unit)
                    .map((g) => (
                      <View key={g.unit} style={s.gradeRow}>
                        <Tag unit={g.unit} />
                        <View style={s.row}>
                          <Text style={[s.rowTitle, s.flex]}>{g.title}</Text>
                          <Text style={s.grade}>{g.score}</Text>
                        </View>
                        <Text style={s.meta}>{g.note}</Text>
                      </View>
                    ))}
                </View>
                <Text style={s.caption}>
                  Invented marks for exploring this screen. No overall grade is
                  calculated from partial results.
                </Text>
              </>
            )}
            </>}
          </>
        )}
        <Text accessibilityLiveRegion="polite" style={s.footer}>
          {importedTab ? "Your imported staging semester · Sydney time" : `${saveState}\nLocal sample semester`}
        </Text>
      </ScrollView>
      <SafeAreaView edges={["bottom"]} style={s.tabBar}>
        <View style={s.tabs}>
          {(["Home", "Today", "Month", "Assessments"] as Tab[]).map((t, i) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              onPress={() => { setHomeEntry(null); setFocusTarget(null); if (t === "Assessments" && tab !== t) setAssessmentSource("cloud"); setTab(t); }}
              style={s.tab}
            >
              <Text style={[s.tabIcon, tab === t && { color: P.purple }]}>
                {["⌂", "✓", "▦", "≡"][i]}
              </Text>
              <Text
                style={[
                  s.tabLabel,
                  tab === t && { color: P.purple, fontWeight: "700" },
                ]}
              >
                {t}
              </Text>
              <View
                style={[
                  s.tabIndicator,
                  tab === t && { backgroundColor: P.purple },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      <Modal
        visible={!!detail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetail(undefined)}
      >
        <SafeAreaView style={s.root} edges={["bottom"]}>
          <View style={s.sheetHeader}>
            <Text style={s.eyebrow}>
              {assessment ? "ASSESSMENT" : "CLASS"} · SAMPLE
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDetail(undefined)}
              style={s.smallButton}
            >
              <Text style={s.link}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {assessment ? (
              <>
                <Tag unit={assessment.unit} />
                <Text style={s.title}>{assessment.title}</Text>
                <Text style={s.subtitle}>
                  {assessment.weight} of unit · sample weighting
                </Text>
                <View style={s.detailCard}>
                  <Text style={s.eyebrow}>
                    {assessment.due === undefined
                      ? "DATE NEEDS CONFIRMATION"
                      : "SUBMISSION DEADLINE"}
                  </Text>
                  <Text style={s.h2}>
                    {assessment.due === undefined
                      ? assessment.timing
                      : shortDate(assessment.due)}
                  </Text>
                  <Text style={s.body}>
                    {assessment.due === undefined
                      ? "Exact day unknown. It stays off the dated calendar."
                      : `${clockTime(assessment.due)} · Sydney time`}
                  </Text>
                  {assessment.due !== undefined && assessment.due <= now && (
                    <Text style={s.noticeText}>
                      The date has passed. Check your submission status.
                    </Text>
                  )}
                </View>
                <Heading title="What’s involved" />
                <Text style={s.body}>{assessment.description}</Text>
                <Heading title="One preparation step" />
                <View style={s.detailCard}>
                  <Text style={s.h2}>{assessment.preparation}</Text>
                  <Text style={s.body}>
                    Suggested preparation. Recording it doesn’t mark the
                    assessment submitted.
                  </Text>
                  <Button
                    label={
                      progress[assessment.id]
                        ? "✓ Recorded · Undo"
                        : "Mark preparation done"
                    }
                    secondary={progress[assessment.id]}
                    disabled={busy}
                    onPress={() => void togglePreparation(assessment.id)}
                  />
                  <Text accessibilityLiveRegion="polite" style={s.meta}>
                    {saveState}
                  </Text>
                </View>
              </>
            ) : classItem ? (
              <>
                <Tag unit={classItem.unit} />
                <Text style={s.title}>{classItem.title}</Text>
                <View style={s.detailCard}>
                  <Text style={s.h2}>{shortDate(classItem.start)}</Text>
                  <Text style={s.body}>
                    {clockTime(classItem.start)}–{clockTime(classItem.end)} ·
                    Sydney time
                  </Text>
                  <Text style={s.h2}>{classItem.location}</Text>
                </View>
                <Text style={s.body}>{classItem.note}</Text>
              </>
            ) : (
              empty("This sample item is no longer available.")
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={settings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettings(false)}
      >
        <SafeAreaView style={s.root} edges={["bottom"]}>
          <View style={s.sheetHeader}>
            <Text style={s.eyebrow}>PREVIEW 0.3.9 · ON THIS IPHONE</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSettings(false);
                setConnectionCheck(false);
                setStagingConnection(false);
              }}
              style={s.smallButton}
            >
              <Text style={s.link}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {stagingConnection ? (
              <>
                <Button label="← Back to widgets" secondary onPress={() => setStagingConnection(false)} />
                <StagingConnection connection={cloudConnection} />
              </>
            ) : connectionCheck ? (
              <>
                <Button
                  label="← Back to widgets"
                  secondary
                  onPress={() => setConnectionCheck(false)}
                />
                <ConnectionCheck />
              </>
            ) : (
              <>
                <Text style={s.title}>A useful glance.</Text>
                <Text style={s.subtitle}>
                  Choose what your deadline widgets show.
                </Text>
                <Button
                  label="Test Google + D1 connection →"
                  secondary
                  onPress={() => setStagingConnection(true)}
                />
                <Heading title="Deadline focus"/>
                <Text style={s.caption}>Add Deadline focus below the Lock Screen clock. It shows one unfinished deadline from your imported semester. Tap it to open that item.</Text>
                <Text style={s.caption}>{imported.widgetIssue || imported.message || (imported.syncedAt ? `Synced ${shortDate(imported.syncedAt)} · ${clockTime(imported.syncedAt)} Sydney` : "Open your imported semester to sync.")}</Text>
                <Text style={s.caption}>Cloud deadline · Trial uses the sample cloud semester. The controls below customise sample widgets only.</Text>
                <Button
                  label="Test website connection →"
                  secondary
                  onPress={() => setConnectionCheck(true)}
                />
                <Heading
                  title="Units to show"
                  link="All units"
                  onPress={() => {
                    setWidgetDraft({ ...widgetDraft, units: null });
                    setWidgetSaveState("");
                  }}
                />
                <Text style={s.caption}>
                  Choose one or more. This only filters your widgets.
                </Text>
                <View style={s.panel}>
                  {units.map((u) => {
                    const selected =
                      widgetDraft.units === null ||
                      widgetDraft.units.includes(u);
                    return (
                      <Pressable
                        key={u}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`Show ${u} in widgets`}
                        accessibilityState={{
                          checked: selected,
                          disabled: busy,
                        }}
                        disabled={busy}
                        onPress={() => {
                          setWidgetDraft(
                            toggleWidgetUnit(widgetDraft, u, units),
                          );
                          setWidgetSaveState("");
                        }}
                        style={s.unitRow}
                      >
                        <Tag unit={u} />
                        <View style={[s.check, selected && s.checked]}>
                          <Text style={s.checkMark}>{selected ? "✓" : ""}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={s.preferenceRow}>
                  <View style={s.flex}>
                    <Text style={s.rowTitle}>Show assessment titles</Text>
                    <Text style={s.meta}>
                      Turn off to show unit and due time.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Show assessment titles in widgets"
                    disabled={busy}
                    value={widgetDraft.showTitles}
                    onValueChange={(showTitles) => {
                      setWidgetDraft({ ...widgetDraft, showTitles });
                      setWidgetSaveState("");
                    }}
                    trackColor={{ true: P.purple }}
                  />
                </View>
                <Text style={s.caption}>
                  Applies to both Lock Screen deadline designs and Work overview
                  on this iPhone.
                </Text>
                <Button
                  label={busy ? "Saving…" : "Save widget content"}
                  disabled={
                    busy || !widgetDirty || widgetDraft.units?.length === 0
                  }
                  onPress={() => void saveWidgetSettings()}
                />
                <Text accessibilityLiveRegion="polite" style={s.caption}>
                  {widgetSaveState ||
                    (widgetDraft.units?.length === 0
                      ? "Choose at least one unit to save."
                      : widgetDirty
                        ? "Previewing unsaved changes below."
                        : "Saved settings · iOS controls refresh timing.")}
                </Text>
                <Heading title="Preview a layout" />
                <View style={s.segments}>
                  {(["Single", "Two", "Overview"] as const).map((choice) => (
                    <Pressable
                      key={choice}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: choice === widgetChoice }}
                      onPress={() => setWidgetChoice(choice)}
                      style={[
                        s.segment,
                        choice === widgetChoice && s.segmentActive,
                      ]}
                    >
                      <Text style={s.segmentText}>
                        {choice === "Single"
                          ? "One deadline"
                          : choice === "Two"
                            ? "Two deadlines"
                            : "Overview"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={s.eyebrow}>
                  {widgetChoice === "Overview"
                    ? "HOME SCREEN · MEDIUM"
                    : "LOCK SCREEN · RECTANGULAR"}
                </Text>
                <View
                  style={[
                    s.widgetPreview,
                    widgetChoice === "Overview" && s.overviewPreview,
                  ]}
                >
                  <Text style={s.widgetEyebrow}>
                    {widgetChoice === "Overview"
                      ? "COMING UP · SAMPLE"
                      : widget.unit}
                  </Text>
                  <Text style={s.widgetTitle}>{widget.title}</Text>
                  <Text style={s.widgetMeta}>{widget.when}</Text>
                  {widgetChoice !== "Single" && (
                    <>
                      <View style={s.widgetRule} />
                      <Text style={s.widgetTitle}>{widget.second}</Text>
                      <Text style={s.widgetMeta}>{widget.secondWhen}</Text>
                    </>
                  )}
                  {widgetChoice === "Overview" && (
                    <Text style={s.widgetMeta}>{widget.context}</Text>
                  )}
                </View>
                <Text style={s.caption}>
                  This previews your content choices. To change the layout on
                  your Lock Screen, choose the other Semester widget in the iOS
                  gallery.
                </Text>
                <Button
                  label="Try where this widget opens →"
                  onPress={() => {
                    setSettings(false);
                    const destination = resolveLink(widget.url, sample);
                    if (widgetChoice === "Single" && destination)
                      setDetail(destination);
                    else {
                      setUnit("All units");
                      setAssessmentView("Work");
                      setAssessmentSource("sample");
                      setTab("Assessments");
                    }
                  }}
                />
                <Heading
                  title={
                    widgetChoice === "Overview"
                      ? "Add to your Home Screen"
                      : "Add to your Lock Screen"
                  }
                />
                <Text style={s.body}>
                  {widgetChoice === "Overview"
                    ? "Touch and hold the Home Screen → Edit → Add Widget → Semester Preview → Work overview · Sample."
                    : "Touch and hold your Lock Screen → Customise → Lock Screen → Add Widgets → Semester Preview. Choose Next deadline · Sample or Two deadlines · Sample."}
                </Text>
                <Text style={s.caption}>
                  {widgetError
                    ? "Widget update failed. Reopen the app to retry."
                    : "Sample timeline prepared. iOS controls refresh timing."}
                </Text>
                <Heading title="About this preview" />
                <Text style={s.body}>
                  Home, Today, Assessments and Deadline focus use your imported staging semester.
                  Today saves new plan tasks to your account. Earlier device-only tasks are available in Today.
                  Month and the sample widgets still use sample data.
                </Text>
                <Text style={s.caption}>
                  Sample generated {board ? shortDate(board.createdAt) : "—"}. Week 10 starts
                  on the Monday of that sample week; this is not the USYD
                  academic calendar.
                </Text>
                <Button
                  label="Refresh sample week"
                  secondary
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      "Refresh sample week?",
                      "Replace invented dates and reset local preparation.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Refresh sample",
                          style: "destructive",
                          onPress: () => void refreshSample(),
                        },
                      ],
                    )
                  }
                />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Prototype />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paper },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    backgroundColor: P.paper,
  },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontSize: 27, fontWeight: "800", letterSpacing: -1.4, color: P.ink },
  settingsButton: { minHeight: 44, justifyContent: "center", paddingLeft: 16 },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: P.muted,
  },
  sample: {
    fontSize: 9,
    color: P.purple,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -1.1,
    color: P.ink,
    marginTop: 8,
    marginBottom: 5,
  },
  subtitle: { fontSize: 13, color: P.muted, lineHeight: 20, marginBottom: 14 },
  h2: { fontSize: 17, fontWeight: "700", color: P.ink, letterSpacing: -0.3 },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 8,
    minHeight: 28,
  },
  smallButton: { minHeight: 44, justifyContent: "center", paddingLeft: 10 },
  link: { fontSize: 12, fontWeight: "600", color: P.purple },
  summary: {
    flexDirection: "row",
    backgroundColor: "#ECE8F5",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 2,
  },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: "#D9D2E8" },
  statNumber: {
    fontSize: 29,
    fontWeight: "700",
    color: P.purple,
    letterSpacing: -1,
  },
  statLabel: { fontSize: 12, color: P.ink, fontWeight: "500" },
  caption: {
    fontSize: 11,
    color: P.muted,
    lineHeight: 17,
    marginTop: 7,
    marginBottom: 3,
  },
  panel: {
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: P.line,
  },
  assessmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.line,
  },
  unitLine: { width: 3, height: 46, borderRadius: 3 },
  tag: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: P.ink,
    marginVertical: 3,
    lineHeight: 20,
  },
  meta: { fontSize: 11, color: P.muted, lineHeight: 17 },
  chevron: { fontSize: 23, color: "#A29AAC", marginLeft: 2 },
  empty: { fontSize: 13, lineHeight: 21, color: P.muted, padding: 16 },
  attention: {
    backgroundColor: "#F0EADD",
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  notice: { paddingVertical: 12 },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: P.amber,
    lineHeight: 19,
  },
  noticeText: { fontSize: 12, lineHeight: 19, color: P.amber, marginTop: 4 },
  prepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.line,
  },
  checkTarget: {
    width: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#C5BED5",
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: P.purple, borderColor: P.purple },
  checkMark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  completed: { color: P.muted, textDecorationLine: "line-through" },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.line,
  },
  classRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  time: { fontSize: 12, fontWeight: "600", color: P.purple, width: 63 },
  footer: { fontSize: 10, color: P.muted, lineHeight: 17, marginTop: 24 },
  tabBar: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: P.line,
  },
  tabs: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 6 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    gap: 2,
    minHeight: 52,
  },
  tabIcon: { fontSize: 23, color: P.muted, height: 27 },
  tabLabel: { fontSize: 10, color: P.muted },
  tabIndicator: { height: 3, width: 16, borderRadius: 3, marginTop: 4 },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  calendar: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 8,
  },
  calendarCell: {
    width: "14.285714%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCircle: { borderWidth: 1, borderColor: P.purple },
  selectedDay: { backgroundColor: P.purple },
  dayText: { fontSize: 13, color: P.ink, fontWeight: "500" },
  dots: { flexDirection: "row", gap: 3, height: 8, alignItems: "center" },
  dot: { width: 4, height: 4, borderRadius: 3 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  segments: {
    flexDirection: "row",
    backgroundColor: "#EDEAEF",
    padding: 3,
    borderRadius: 11,
    marginVertical: 12,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: 8,
  },
  segmentActive: { backgroundColor: "#fff" },
  segmentText: { fontSize: 12, color: P.muted, fontWeight: "600" },
  filters: { gap: 7, paddingVertical: 7 },
  filter: {
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 22,
    backgroundColor: "#fff",
  },
  filterActive: { backgroundColor: P.purple, borderColor: P.purple },
  filterText: { fontSize: 11, fontWeight: "600", color: P.muted },
  gradeRow: {
    padding: 16,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.line,
  },
  grade: { fontSize: 15, fontWeight: "700", color: P.purple },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 4,
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    gap: 12,
    marginTop: 12,
  },
  body: { fontSize: 14, lineHeight: 23, color: P.ink },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 15,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: P.purple,
    alignItems: "center",
    marginVertical: 8,
  },
  secondary: { backgroundColor: P.lavender },
  buttonText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  widgetPreview: {
    backgroundColor: "#36344A",
    borderRadius: 20,
    padding: 20,
    gap: 5,
    marginTop: 14,
    marginBottom: 8,
    alignSelf: "stretch",
  },
  overviewPreview: { backgroundColor: "#40385D" },
  widgetEyebrow: { fontSize: 11, color: "#DDD7EF", fontWeight: "700" },
  widgetTitle: { fontSize: 16, color: "#fff", fontWeight: "600" },
  widgetMeta: { fontSize: 12, color: "#DDD7EF", lineHeight: 18 },
  widgetRule: { height: 1, backgroundColor: "#6B627F", marginVertical: 7 },
});
