import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ImportedAssessments } from "./imported-work";

const OFFSETS = [24 * 60, 30] as const;
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
    for (const offset of OFFSETS) {
      const triggerAt = date.getTime() - offset * 60_000;
      if (triggerAt <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${row.id}:${offset}`,
        content: {
          title: offset === 30 ? "Semester · due soon" : "Semester · due tomorrow",
          body: `${row.unit} · ${row.title}`,
          data: { url: `semester-preview://deadline/imported/${encodeURIComponent(row.id)}` },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerAt) },
      });
      times[`${PREFIX}${row.id}:${offset}`] = triggerAt;
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
