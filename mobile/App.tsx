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
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NextClassWidget from "./src/widgets/NextClass";
import {
  clockTime,
  dateKey,
  longDate,
  makeSampleBoard,
  nextClass,
  readStoredSample,
  resolveLink,
  shortDate,
  widgetProps,
  widgetTimeline,
  ZONE,
  type SampleBoard,
  type SampleAssessment,
} from "./src/model";

const STORAGE_KEY = "semester.preview.sample.v1";
const palette = {
  paper: "#F7F6F2",
  ink: "#242337",
  muted: "#6D6B7C",
  purple: "#5549A5",
  lavender: "#EDEAF8",
  line: "#E7E5EC",
  white: "#FFFFFF",
  green: "#227264",
  amber: "#916022",
};
const unitColor = (unit: string) =>
  unit === "ISYS2120" ? "#5549A5" : unit === "SOFT2412" ? "#247568" : "#A56535";
type Detail = { kind: "class" | "assessment"; id: string };

function Action({
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
        styles.action,
        secondary && styles.secondaryAction,
        (pressed || disabled) && { opacity: 0.65 },
      ]}
    >
      <Text style={[styles.actionText, secondary && { color: palette.purple }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Eyebrow({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Text style={[styles.eyebrow, color ? { color } : null]}>{children}</Text>
  );
}
function UnitTag({ unit }: { unit: string }) {
  return (
    <View style={styles.unitTag}>
      <View style={[styles.dot, { backgroundColor: unitColor(unit) }]} />
      <Text style={[styles.unitText, { color: unitColor(unit) }]}>{unit}</Text>
    </View>
  );
}

function Prototype() {
  const [board, setBoard] = useState<SampleBoard>();
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"schedule" | "assessments">("schedule");
  const [selectedDay, setSelectedDay] = useState(dateKey(Date.now()));
  const [now, setNow] = useState(Date.now());
  const [detail, setDetail] = useState<Detail>();
  const [help, setHelp] = useState(false);
  const [saveState, setSaveState] = useState(
    "Sample data · saved on this device",
  );
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [widgetError, setWidgetError] = useState(false);
  const saveLock = useRef(false);
  const initialLinkHandled = useRef(false);

  async function load() {
    setLoadError(false);
    try {
      const restored = readStoredSample(
        await AsyncStorage.getItem(STORAGE_KEY),
      );
      const sample = restored?.board ?? makeSampleBoard(Date.now());
      if (!restored)
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 1,
            createdAt: sample.createdAt,
            progress: {},
          }),
        );
      setProgress(restored?.progress ?? {});
      setBoard(sample);
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
        NextClassWidget.updateTimeline(widgetTimeline(board, Date.now()));
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
  }, [board]);
  const currentDay = dateKey(now);
  useEffect(() => {
    setSelectedDay(currentDay);
  }, [currentDay]);
  useEffect(() => {
    if (!board) return;
    let active = true;
    const open = (url: string) => {
      if (!active) return;
      const destination = resolveLink(url, board);
      setHelp(false);
      setTab("schedule");
      setDetail(destination);
      if (!destination && url.startsWith("semester-preview://class/"))
        Alert.alert(
          "Sample class unavailable",
          "This link no longer matches the current sample schedule.",
        );
    };
    if (!initialLinkHandled.current) {
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
  }, [board]);

  async function recordPreparation(id: string) {
    if (!board || saveLock.current) return;
    saveLock.current = true;
    setBusy(true);
    setSaveState("Saving on this device…");
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
      setSaveState("Sample progress saved on this device");
    } catch {
      setSaveState("Not saved · please try again");
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  }
  async function refreshSample() {
    if (saveLock.current) return;
    saveLock.current = true;
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
      setBoard(fresh);
      setProgress({});
      setNow(Date.now());
      setSelectedDay(dateKey(Date.now()));
      setDetail(undefined);
      setHelp(false);
      setSaveState("New sample saved on this device");
    } catch {
      Alert.alert(
        "Could not refresh",
        "Your previous sample is unchanged. Please try again.",
      );
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  }
  if (!board)
    return (
      <SafeAreaView style={styles.loading}>
        {loadError ? (
          <>
            <Text style={styles.h2}>Couldn’t open the sample</Text>
            <Text style={styles.body}>
              Please retry to load your saved preview.
            </Text>
            <Action label="Retry" onPress={() => void load()} />
          </>
        ) : (
          <>
            <ActivityIndicator color={palette.purple} />
            <Text style={styles.meta}>Preparing your sample semester…</Text>
          </>
        )}
      </SafeAreaView>
    );

  const upcoming = nextClass(board, now);
  const widget = widgetProps(board, now);
  const today = dateKey(now);
  const days = Array.from(
    { length: 7 },
    (_, index) => Date.parse(`${today}T01:00:00Z`) + index * 86400000,
  );
  const dayClasses = board.classes.filter(
    (c) => dateKey(c.start) === selectedDay,
  );
  const dayDeadlines = board.assessments.filter(
    (a) => a.due !== undefined && dateKey(a.due) === selectedDay,
  );
  const assessment =
    detail?.kind === "assessment"
      ? board.assessments.find((a) => a.id === detail.id)
      : undefined;
  const classItem =
    detail?.kind === "class"
      ? board.classes.find((c) => c.id === detail.id)
      : undefined;
  const sortedAssessments = [...board.assessments].sort(
    (a, b) => (a.due ?? Infinity) - (b.due ?? Infinity),
  );

  function assessmentCard(item: SampleAssessment) {
    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.unit}, ${item.due ? `${shortDate(item.due)}, ${clockTime(item.due)}` : item.timing}`}
        onPress={() => setDetail({ kind: "assessment", id: item.id })}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.row}>
          <UnitTag unit={item.unit} />
          <Text style={styles.meta}>{item.weight}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        <Text style={[styles.body, !item.due && { color: palette.amber }]}>
          {item.due
            ? `${shortDate(item.due)} · ${clockTime(item.due)}`
            : item.timing}
        </Text>
        <View style={styles.cardFoot}>
          <Text
            style={[styles.meta, progress[item.id] && { color: palette.green }]}
          >
            {progress[item.id]
              ? "✓ Preparation action recorded"
              : `Next: ${item.preparation}`}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>
          semester<Text style={{ color: palette.purple }}>.</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About this sample and widget setup"
          onPress={() => setHelp(true)}
          style={styles.samplePill}
        >
          <Text style={styles.sampleLabel}>SAMPLE PREVIEW ↗</Text>
        </Pressable>
      </View>
      <ScrollView key={tab} contentContainerStyle={styles.content}>
        <Eyebrow>
          {tab === "schedule"
            ? shortDate(now).toUpperCase()
            : "A LITTLE CLARITY, ONE STEP AT A TIME"}
        </Eyebrow>
        <Text style={styles.title}>
          {tab === "schedule"
            ? "Your week,\nat a glance."
            : "What’s coming up."}
        </Text>
        <Text style={styles.subtitle}>
          {tab === "schedule"
            ? "Classes, deadlines and room to prepare."
            : "Keep the deadline and the next step together."}
        </Text>
        {tab === "schedule" ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                upcoming
                  ? `Open next class: ${upcoming.title}`
                  : "Refresh sample schedule"
              }
              onPress={() =>
                upcoming
                  ? setDetail({ kind: "class", id: upcoming.id })
                  : setHelp(true)
              }
              style={({ pressed }) => [
                styles.hero,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.row}>
                <Eyebrow color="#D5CFF7">
                  {upcoming && upcoming.start <= now ? "IN CLASS" : "UP NEXT"}
                </Eyebrow>
                <Text style={styles.heroArrow}>↗</Text>
              </View>
              <Text style={styles.heroUnit}>
                {upcoming?.unit ?? "All clear"}
              </Text>
              <Text style={styles.heroTitle}>
                {upcoming?.title ?? "No more sample classes"}
              </Text>
              <View style={styles.heroRule} />
              <Text style={styles.heroTime}>
                {upcoming
                  ? `${dateKey(upcoming.start) === today ? "Today" : shortDate(upcoming.start)} · ${clockTime(upcoming.start)}–${clockTime(upcoming.end)}`
                  : "Refresh the sample to explore another week."}
              </Text>
              {!!upcoming && (
                <Text style={styles.heroLocation}>{upcoming.location}</Text>
              )}
            </Pressable>
            <View style={styles.sectionHeading}>
              <Text style={styles.h2}>Your schedule</Text>
              <Text style={styles.meta}>Sydney time</Text>
            </View>
            <View style={styles.weekStrip}>
              {days.map((day) => {
                const key = dateKey(day),
                  selected = key === selectedDay;
                const hasItems =
                  board.classes.some((c) => dateKey(c.start) === key) ||
                  board.assessments.some(
                    (a) => a.due && dateKey(a.due) === key,
                  );
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={longDate(day)}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedDay(key)}
                    style={[styles.day, selected && styles.selectedDay]}
                  >
                    <Text style={[styles.dayName, selected && styles.white]}>
                      {new Intl.DateTimeFormat("en-AU", {
                        timeZone: ZONE,
                        weekday: "narrow",
                      }).format(day)}
                    </Text>
                    <Text style={[styles.dayNumber, selected && styles.white]}>
                      {key.slice(-2)}
                    </Text>
                    <View
                      style={[
                        styles.dayDot,
                        {
                          backgroundColor: hasItems
                            ? selected
                              ? "#E9E3FF"
                              : palette.purple
                            : "transparent",
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.dayCaption}>
              {selectedDay === today
                ? "Today"
                : longDate(Date.parse(`${selectedDay}T01:00:00Z`))}
            </Text>
            {dayClasses.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`${c.title}, ${clockTime(c.start)}`}
                onPress={() => setDetail({ kind: "class", id: c.id })}
                style={styles.agendaRow}
              >
                <View style={styles.agendaTime}>
                  <Text style={styles.timeText}>{clockTime(c.start)}</Text>
                  <Text style={styles.meta}>{clockTime(c.end)}</Text>
                </View>
                <View
                  style={[
                    styles.agendaLine,
                    { backgroundColor: unitColor(c.unit) },
                  ]}
                />
                <View style={styles.flex}>
                  <UnitTag unit={c.unit} />
                  <Text style={styles.agendaTitle}>{c.title}</Text>
                  <Text style={styles.meta}>{c.location}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
            {dayDeadlines.map(assessmentCard)}
            {!dayClasses.length && !dayDeadlines.length && (
              <View style={styles.empty}>
                <Text style={styles.h3}>A little breathing room.</Text>
                <Text style={styles.body}>
                  No sample classes or dated deadlines this day. Week-only
                  assessments are listed below.
                </Text>
              </View>
            )}
            <View style={styles.sectionHeading}>
              <Text style={styles.h2}>On your radar</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setTab("assessments")}
                hitSlop={10}
              >
                <Text style={styles.textLink}>View all →</Text>
              </Pressable>
            </View>
            {sortedAssessments.slice(0, 1).map(assessmentCard)}
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setDetail({ kind: "assessment", id: "database-quiz" })
              }
              style={styles.uncertain}
            >
              <Text style={styles.uncertainTitle}>One date to confirm</Text>
              <Text style={styles.body}>
                ISYS2120 quiz · Week 11. Exact day unknown. →
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.sectionHeading}>
              <Text style={styles.h2}>3 sample assessments</Text>
              <Text style={styles.meta}>Across 3 units</Text>
            </View>
            {sortedAssessments.map(assessmentCard)}
            <View style={styles.empty}>
              <Text style={styles.h3}>Preparation is personal.</Text>
              <Text style={styles.body}>
                Recording a preparation action does not mark an assessment
                submitted or change its grade.
              </Text>
            </View>
          </>
        )}
        <Text accessibilityLiveRegion="polite" style={styles.footnote}>
          {saveState}
          {"\n"}Invented data. No account or university connection.
        </Text>
      </ScrollView>
      <SafeAreaView edges={["bottom"]} style={styles.tabBar}>
        <View style={styles.tabRow}>
          {(["schedule", "assessments"] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item }}
              onPress={() => setTab(item)}
              style={[styles.tab, tab === item && styles.activeTab]}
            >
              <Text
                style={[
                  styles.tabIcon,
                  tab === item && { color: palette.purple },
                ]}
              >
                {item === "schedule" ? "▦" : "☷"}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  tab === item && { color: palette.purple },
                ]}
              >
                {item === "schedule" ? "Schedule" : "Assessments"}
              </Text>
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
        <SafeAreaView style={styles.root} edges={["bottom"]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetLabel}>
              {assessment ? "Assessment" : "Class"} · Sample
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDetail(undefined)}
              style={styles.close}
            >
              <Text style={styles.textLink}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {assessment ? (
              <>
                <UnitTag unit={assessment.unit} />
                <Text style={styles.detailTitle}>{assessment.title}</Text>
                <Text style={styles.subtitle}>
                  {assessment.weight} of unit · sample weighting
                </Text>
                <View style={styles.infoCard}>
                  <Eyebrow>
                    {assessment.due
                      ? "SUBMISSION DEADLINE"
                      : "DATE NEEDS CONFIRMATION"}
                  </Eyebrow>
                  <Text style={styles.h2}>
                    {assessment.due
                      ? shortDate(assessment.due)
                      : "Teaching week 11"}
                  </Text>
                  <Text style={styles.body}>
                    {assessment.due
                      ? `${clockTime(assessment.due)} · Sydney time`
                      : "Exact day unknown. No date or reminder has been invented."}
                  </Text>
                </View>
                <Text style={styles.h2}>The assessment</Text>
                <Text style={styles.body}>{assessment.description}</Text>
                <View style={styles.preparation}>
                  <Eyebrow>MY PREPARATION</Eyebrow>
                  <Text style={styles.h2}>{assessment.preparation}</Text>
                  <Text style={styles.body}>
                    A personal next action, separate from the submission
                    deadline.
                  </Text>
                  <Action
                    label={
                      progress[assessment.id]
                        ? "✓ Recorded · Undo"
                        : "Mark preparation done"
                    }
                    disabled={busy}
                    onPress={() => void recordPreparation(assessment.id)}
                    secondary={progress[assessment.id]}
                  />
                  <Text accessibilityLiveRegion="polite" style={styles.meta}>
                    {saveState}
                  </Text>
                </View>
                <Text style={styles.footnote}>
                  Source: invented preview assessment. No Canvas submission or
                  grade is recorded by this action.
                </Text>
              </>
            ) : classItem ? (
              <>
                <UnitTag unit={classItem.unit} />
                <Text style={styles.detailTitle}>{classItem.title}</Text>
                <View style={styles.infoCard}>
                  <Eyebrow>WHEN</Eyebrow>
                  <Text style={styles.h2}>{shortDate(classItem.start)}</Text>
                  <Text style={styles.body}>
                    {clockTime(classItem.start)}–{clockTime(classItem.end)} ·
                    Sydney time
                  </Text>
                </View>
                <View style={styles.infoCard}>
                  <Eyebrow>WHERE</Eyebrow>
                  <Text style={styles.h2}>{classItem.location}</Text>
                  <Text style={styles.body}>
                    Illustrative location, not your real timetable.
                  </Text>
                </View>
                <Text style={styles.h2}>Before you go</Text>
                <Text style={styles.body}>{classItem.note}</Text>
                <Text style={styles.footnote}>
                  This is the same class shown by the Home Screen widget.
                </Text>
              </>
            ) : (
              <Text style={styles.body}>
                This sample item is no longer available.
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={help}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHelp(false)}
      >
        <SafeAreaView style={styles.root} edges={["bottom"]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetLabel}>The native experiment</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setHelp(false)}
              style={styles.close}
            >
              <Text style={styles.textLink}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Eyebrow>SEMESTER FOR IPHONE · 0.1</Eyebrow>
            <Text style={styles.detailTitle}>
              A calmer way to stay on track.
            </Text>
            <Text style={styles.body}>
              Explore an invented week, open an assessment and record one
              preparation action. Your changes stay on this device.
            </Text>
            <View style={styles.widgetPreview}>
              <Eyebrow>{widget.label}</Eyebrow>
              <Text style={styles.h2}>{widget.unit}</Text>
              <Text style={styles.h3}>{widget.title}</Text>
              <Text style={styles.body}>{widget.when}</Text>
              <Text style={styles.meta}>{widget.location}</Text>
            </View>
            <Text style={styles.h2}>Try it on your Home Screen</Text>
            <Text style={styles.body}>
              Touch and hold your Home Screen, choose Edit → Add Widget, then
              search for Semester Preview. Add “Next class · Sample”. Tap the
              widget to open the class.
            </Text>
            <Text style={styles.meta}>
              {widgetError
                ? "The widget could not be updated. Reopen the app to retry."
                : "Sample timeline prepared. iOS controls when widgets refresh."}
            </Text>
            <Text style={styles.h2}>What to look for</Text>
            <Text style={styles.body}>
              Can you find the next class and its room? Is it clear what is due
              versus what you plan to prepare? Would the widget save you opening
              the app?
            </Text>
            <Action
              label="Refresh sample week"
              disabled={busy}
              secondary
              onPress={() =>
                Alert.alert(
                  "Refresh sample week?",
                  "This replaces only the invented schedule and clears this preview’s preparation checkmarks.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Refresh sample",
                      onPress: () => void refreshSample(),
                    },
                  ],
                )
              }
            />
            <Text style={styles.footnote}>
              Sample generated {shortDate(board.createdAt)}. No sign-in,
              analytics, Canvas requests or cloud saves are included.
            </Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.paper },
  loading: {
    flex: 1,
    padding: 32,
    gap: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paper,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: palette.ink,
  },
  samplePill: {
    paddingHorizontal: 11,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: palette.lavender,
  },
  sampleLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: palette.purple,
  },
  content: { padding: 24, paddingTop: 12, gap: 14, paddingBottom: 32 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: palette.muted,
  },
  title: {
    fontSize: 38,
    lineHeight: 43,
    letterSpacing: -1.5,
    fontWeight: "700",
    color: palette.ink,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: palette.muted,
    marginBottom: 6,
  },
  body: { fontSize: 15, lineHeight: 23, color: palette.muted },
  meta: { fontSize: 12, lineHeight: 18, color: palette.muted },
  h2: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.5,
    color: palette.ink,
  },
  h3: { fontSize: 16, fontWeight: "600", color: palette.ink },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  flex: { flex: 1, gap: 5 },
  hero: {
    backgroundColor: "#39315E",
    borderRadius: 24,
    padding: 22,
    marginTop: 6,
  },
  heroUnit: {
    color: "#F2EFFF",
    fontSize: 33,
    fontWeight: "700",
    letterSpacing: -0.6,
    marginTop: 8,
  },
  heroTitle: { color: "#E1DCF5", fontSize: 17, marginTop: 4 },
  heroArrow: { color: "#D5CFF7", fontSize: 23 },
  heroRule: { height: 1, backgroundColor: "#5A507B", marginVertical: 18 },
  heroTime: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  heroLocation: { color: "#CDC6E4", fontSize: 12, marginTop: 6 },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
  },
  weekStrip: { flexDirection: "row", gap: 5 },
  day: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    gap: 7,
    borderRadius: 15,
    backgroundColor: "#EFEEE9",
    minHeight: 82,
  },
  selectedDay: { backgroundColor: palette.purple },
  dayName: { fontSize: 11, color: palette.muted },
  dayNumber: { fontSize: 17, fontWeight: "600", color: palette.ink },
  dayDot: { width: 4, height: 4, borderRadius: 3 },
  white: { color: "#FFF" },
  dayCaption: { fontSize: 12, color: palette.muted, marginTop: 4 },
  agendaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  agendaTime: { width: 66, gap: 4 },
  timeText: { fontSize: 13, color: palette.ink, fontWeight: "600" },
  agendaLine: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  agendaTitle: { fontSize: 16, color: palette.ink, fontWeight: "600" },
  unitTag: { flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  unitText: { fontSize: 11, letterSpacing: 0.6, fontWeight: "700" },
  card: {
    borderRadius: 19,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 21,
    fontWeight: "600",
    letterSpacing: -0.5,
    color: palette.ink,
  },
  chevron: { fontSize: 25, color: "#A6A1B4" },
  cardFoot: {
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 12,
    marginTop: 3,
  },
  pressed: { opacity: 0.7 },
  textLink: { color: palette.purple, fontSize: 13, fontWeight: "600" },
  empty: { padding: 20, gap: 10, borderRadius: 18, backgroundColor: "#EFEEE8" },
  uncertain: {
    padding: 17,
    borderRadius: 16,
    gap: 7,
    backgroundColor: "#F1ECE1",
  },
  uncertainTitle: { fontSize: 13, fontWeight: "700", color: palette.amber },
  footnote: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 12,
  },
  tabBar: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 22,
    paddingTop: 8,
    gap: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 14,
    gap: 3,
  },
  activeTab: { backgroundColor: "#F4F1FB" },
  tabIcon: { color: palette.muted, fontSize: 24 },
  tabLabel: { fontSize: 11, fontWeight: "600", color: palette.muted },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetLabel: { fontSize: 12, color: palette.muted, fontWeight: "600" },
  close: { paddingVertical: 14, paddingLeft: 18 },
  detailTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1.1,
    lineHeight: 40,
    color: palette.ink,
    marginTop: 7,
  },
  infoCard: {
    backgroundColor: palette.white,
    padding: 20,
    gap: 10,
    borderRadius: 18,
    marginVertical: 5,
  },
  preparation: {
    backgroundColor: palette.lavender,
    padding: 20,
    gap: 14,
    borderRadius: 20,
    marginTop: 12,
  },
  action: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: palette.purple,
    alignItems: "center",
  },
  secondaryAction: { backgroundColor: "#E4DFF4" },
  actionText: { color: palette.white, fontSize: 15, fontWeight: "600" },
  widgetPreview: {
    padding: 22,
    gap: 8,
    backgroundColor: palette.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    marginVertical: 12,
  },
});
