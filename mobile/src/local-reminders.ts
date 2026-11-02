import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ImportedAssessments } from "./imported-work";

const PREFIX = "semester-deadline:";
const TIMES_KEY = "semester.local-reminder-times.v1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestReminderPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

function deadlineDate(row: ImportedAssessments["rows"][number]) {
  if (!row.date) return null;
  const value = row.time ? `${row.date}T${row.time}:00` : `${row.date}T09:00:00`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type Row = ImportedAssessments["rows"][number];
type Slot = { minutes: number; label: string; at?: number };
function reminderSlots(row: Row, board: ImportedAssessments, target: Date): Slot[] {
  if (row.reminders?.length) return row.reminders.flatMap(r => r.kind === "before"
    ? [{minutes: r.minutes, label: r.minutes === 30 ? "due soon" : r.minutes === 1440 ? "due tomorrow" : "custom reminder"}]
    : [{minutes: r.days * 1440, label: "custom reminder"}]);
  const p = board.automaticReminders;
  if (!p) return [{minutes: 1440, label: "due tomorrow"}, {minutes: 30, label: "due soon"}];
  if (!p?.enabled || row.automaticReminder === "off" || row.scheduledActivity && !p.activities || !row.scheduledActivity && !p.deadlines) return [];
  const preparation = p.deadlinePreparation ?? "24h";
  const hours = p.deadlineLeadHours ?? 2;
  const slots: Slot[] = [];
  if (row.scheduledActivity) slots.push({minutes: 1440, label: "due tomorrow"}, {minutes: 30, label: "due soon"});
  else {
    if (preparation === "24h") slots.push({minutes: 1440, label: "plan ahead"});
    if (preparation === "previous-evening") {
      const evening = new Date(target); evening.setDate(evening.getDate() - 1); evening.setHours(18, 0, 0, 0);
      slots.push({minutes: 0, label: "plan ahead", at: evening.getTime()});
    }
    if (preparation === "same-morning") {
      const morning = new Date(target); morning.setHours(9, 0, 0, 0);
      slots.push({minutes: 0, label: "plan ahead", at: morning.getTime()});
    }
    if (hours > 0) slots.push({minutes: hours * 60, label: "final reminder"});
    // Date-only deadlines use the website's 9am anchor rather than midnight.
    if (!row.time && preparation !== "off") slots.splice(0, slots.length, {minutes: 0, label: "plan ahead"});
  }
  return slots;
}

export async function syncLocalReminders(board: ImportedAssessments) {
  const permitted = await requestReminderPermission();
  if (!permitted) return { scheduled: 0, permitted: false };
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing
    .filter(item => String(item.identifier).startsWith(PREFIX))
    .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));

  const now = Date.now();
  const candidates = board.rows
    .filter(row => !row.done)
    .map(row => ({ row, date: deadlineDate(row) }))
    .filter((item): item is { row: typeof item.row; date: Date } => !!item.date && item.date.getTime() > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 16);
  let scheduled = 0;
  const times: Record<string, number> = {};
  for (const { row, date } of candidates) {
    for (const slot of reminderSlots(row, board, date)) {
      const triggerAt = slot.at ?? (slot.minutes === 0
        ? new Date(`${row.date}T09:00:00`).getTime()
        : date.getTime() - slot.minutes * 60_000);
      if (triggerAt <= now) continue;
      const suffix = slot.at ? `at-${slot.at}` : slot.minutes === 0 ? "at-9am" : String(slot.minutes);
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${row.id}:${suffix}`,
        content: {
          title: `Semester · ${slot.label}`,
          body: `${row.unit} · ${row.title}`,
          data: { url: `semester-preview://deadline/imported/${encodeURIComponent(row.id)}` },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerAt) },
      });
      times[`${PREFIX}${row.id}:${suffix}`] = triggerAt;
      scheduled += 1;
    }
  }
  await AsyncStorage.setItem(TIMES_KEY, JSON.stringify(times));
  return { scheduled, permitted: true };
}

export async function cancelLocalReminders() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing
    .filter(item => String(item.identifier).startsWith(PREFIX))
    .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  await AsyncStorage.removeItem(TIMES_KEY);
}

export async function scheduleTestReminder() {
  const permitted = await requestReminderPermission();
  if (!permitted) return false;
  await Notifications.scheduleNotificationAsync({
    identifier: `${PREFIX}test`,
    content: {
      title: "Semester · test reminder",
      body: "Local notifications are working on this iPhone.",
      data: { url: "semester-preview://today" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 10_000),
    },
  });
  return true;
}

export async function listLocalReminders() {
  const items = await Notifications.getAllScheduledNotificationsAsync();
  const saved = JSON.parse((await AsyncStorage.getItem(TIMES_KEY)) || "{}") as Record<string, number>;
  return items
    .filter(item => String(item.identifier).startsWith(PREFIX) && item.identifier !== `${PREFIX}test`)
    .map(item => {
      const trigger = item.trigger as { date?: Date | number; timestamp?: number } | null;
      const rawDate = saved[item.identifier] ?? trigger?.date ?? (trigger?.timestamp ? trigger.timestamp * 1000 : null);
      return {
        id: item.identifier,
        title: item.content.title || "Semester reminder",
        body: item.content.body || "",
        date: rawDate ? new Date(rawDate).getTime() : null,
      };
    })
    .sort((a, b) => (a.date ?? 0) - (b.date ?? 0));
}
