import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays } from "./experience";
import { dateKey, shortDate } from "./model";
import type { PreparationSuggestion } from "./imported-today";
import {
  MAX_TASK_TITLE,
  planGroups,
  type PersonalTask,
  type TaskDraft,
} from "./personal-plan";
import type { PersonalPlanController } from "./usePersonalPlan";
const P = {
  ink: "#252438",
  muted: "#716E80",
  purple: "#584AA5",
  paper: "#F7F6F2",
  line: "#E6E3EB",
  lavender: "#EFEBFA",
};
type Editor = { id?: string; draft: TaskDraft };
export default function TodayPlan({
  plan,
  units,
  today,
  suggestions,
  openSource,
}: {
  plan: PersonalPlanController;
  units: string[];
  today: string;
  suggestions?: PreparationSuggestion[];
  openSource?:(id:string)=>void;
}) {
  const [editor, setEditor] = useState<Editor>();
  const [showCompleted, setShowCompleted] = useState(false);
  const groups = planGroups(plan.tasks, today);
  const tomorrow = addDays(today, 1);
  function edit(task: PersonalTask) {
    setEditor({
      id: task.id,
      draft: {
        title: task.title,
        unit: task.unit,
        plannedFor: task.plannedFor,
        sourceKey: task.sourceKey,
      },
    });
  }
  function button(label: string, onPress: () => void, disabled = false) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={[s.action, disabled && s.disabled]}
      >
        <Text style={s.actionText}>{label}</Text>
      </Pressable>
    );
  }
  function row(task: PersonalTask) {
    const done = task.completedAt !== undefined;
    const day =
      task.plannedFor === today
        ? "Today"
        : task.plannedFor === tomorrow
          ? "Tomorrow"
          : shortDate(Date.parse(`${task.plannedFor}T12:00:00Z`));
    return (
      <View key={task.id} style={s.taskRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Complete ${task.title}`}
          accessibilityState={{ checked: done, disabled: plan.busy }}
          disabled={plan.busy}
          onPress={() => void plan.toggle(task.id)}
          style={s.checkTarget}
        >
          <View style={[s.check, done && s.checked]}>
            <Text style={s.tick}>{done ? "✓" : ""}</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit task: ${task.title}`}
          onPress={() => edit(task)}
          disabled={plan.busy}
          style={s.taskBody}
        >
          <Text style={[s.taskTitle, done && s.done]}>{task.title}</Text>
          <Text style={s.meta}>
            {task.unit ? `${task.unit} · ` : ""}
            {day}
            {task.sourceKey ? " · From suggestion" : ""}
          </Text>
        </Pressable>
        <Text style={s.chevron}>›</Text>
      </View>
    );
  }
  const hasPlan = groups.today.length || groups.earlier.length;
  return (
    <>
      <View style={s.heading}>
        <Text style={s.h2}>
          My plan
          {hasPlan
            ? ` · ${groups.today.length + groups.earlier.length} left`
            : ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!plan.ready || plan.busy}
          onPress={() => setEditor({ draft: { title: "", plannedFor: today } })}
          style={s.smallButton}
        >
          <Text style={[s.link, (!plan.ready || plan.busy) && s.disabled]}>
            ＋ Add task
          </Text>
        </Pressable>
      </View>
      {plan.ready && <Pressable accessibilityRole="button" onPress={()=>void plan.load()} disabled={plan.busy} style={s.smallButton}><Text style={s.link}>Refresh plan</Text></Pressable>}
      {!plan.ready ? (
        plan.error ? (
          <View style={s.panel}>
            <Text style={s.empty}>{plan.error}</Text>
            {button("Retry loading plan", () => void plan.load())}
          </View>
        ) : (
          <ActivityIndicator color={P.purple} />
        )
      ) : (
        <>
          <View style={s.panel}>
            {groups.today.length ? (
              groups.today.map(row)
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add your first task for today"
                disabled={plan.busy}
                onPress={() =>
                  setEditor({ draft: { title: "", plannedFor: today } })
                }
                style={s.emptyButton}
              >
                <Text style={s.taskTitle}>What do you want to get done?</Text>
                <Text style={s.meta}>
                  Add your own task or choose a suggested step below.
                </Text>
              </Pressable>
            )}
          </View>
          {!!groups.earlier.length && (
            <>
              <Text style={s.groupTitle}>Still on your list</Text>
              <View style={s.panel}>{groups.earlier.map(row)}</View>
              <Text style={s.caption}>
                Unfinished tasks stay visible. Tap one to change its plan.
              </Text>
            </>
          )}
          {!!groups.later.length && (
            <>
              <Text style={s.groupTitle}>Planned ahead</Text>
              <View style={s.panel}>{groups.later.map(row)}</View>
            </>
          )}
          {!!groups.completed.length && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showCompleted }}
                onPress={() => setShowCompleted(!showCompleted)}
                style={s.completedButton}
              >
                <Text style={s.link}>
                  {groups.completed.length} completed ·{" "}
                  {showCompleted ? "Hide" : "Show"}
                </Text>
              </Pressable>
              {showCompleted && (
                <View style={s.panel}>{groups.completed.map(row)}</View>
              )}
            </>
          )}
          {!!plan.message && (
            <View style={s.feedback}>
              <Text accessibilityLiveRegion="polite" style={[s.meta, s.flex]}>
                {plan.message}
              </Text>
              {plan.canUndo && (
                <Pressable
                  accessibilityRole="button"
                  disabled={plan.busy}
                  onPress={() => void plan.undoLast()}
                  style={s.smallButton}
                >
                  <Text style={s.link}>Undo</Text>
                </Pressable>
              )}
            </View>
          )}
          {!!plan.error && (
            <Text accessibilityLiveRegion="polite" style={s.error}>
              {plan.error}
            </Text>
          )}
          <Text style={s.caption}>Personal tasks · saved {plan.storageLabel}</Text>
        </>
      )}
      {suggestions && <>
      <View style={s.heading}>
        <Text style={s.h2}>Suggested steps</Text>
        <Text style={s.meta}>From your semester</Text>
      </View>
      <View style={s.panel}>
        {suggestions.length ? (
          suggestions.map((a) => {
            const sourceKey = a.sourceKey, existing = plan.tasks.find(t=>t.sourceKey===sourceKey);
            const label = existing
              ? existing.completedAt !== undefined
                ? "Done"
                : existing.plannedFor > today
                  ? "Planned ahead"
                  : "In my plan"
              : "＋ Today";
            return (
              <View key={a.id} style={s.suggestionRow}>
                <Pressable style={s.flex} accessibilityRole="button" accessibilityLabel={`Open source assessment: ${a.title}`}
                  onPress={()=>openSource?.(a.id)}>
                  <Text style={s.taskTitle}>{a.title}</Text>
                  <Text style={s.meta}>{a.unit} · {a.context} ›</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    existing
                      ? `Edit planned task: ${a.title}`
                      : `Add to today: ${a.title}`
                  }
                  disabled={!plan.ready || plan.busy}
                  onPress={() =>
                    existing
                      ? edit(existing)
                      : void plan.save({
                          title: a.title,
                          unit: a.unit,
                          plannedFor: dateKey(Date.now()),
                          sourceKey,
                        })
                  }
                  style={s.addSuggestion}
                >
                  <Text style={s.link}>{label}</Text>
                </Pressable>
              </View>
            );
          })
        ) : (
          <Text style={s.empty}>
            No upcoming preparation suggestions. You can add your own task.
          </Text>
        )}
      </View>
      <Text style={s.caption}>
        Choose what fits your day. Tasks in your plan are personal actions,
        separate from assessment submission and grades.
      </Text>
      </>}
      <Modal
        visible={!!editor}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!plan.busy) setEditor(undefined);
        }}
      >
        <SafeAreaView style={s.sheet} edges={["bottom"]}>
          <KeyboardAvoidingView
            style={s.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={s.sheetHeader}>
              <Text style={s.h2}>
                {editor?.id ? "Edit task" : "Add a task"}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={plan.busy}
                onPress={() => setEditor(undefined)}
                style={s.smallButton}
              >
                <Text style={s.link}>Cancel</Text>
              </Pressable>
            </View>
            {editor && (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.form}
              >
                <Text style={s.label}>WHAT DO YOU WANT TO DO?</Text>
                <TextInput
                  accessibilityLabel="Task title"
                  placeholder="e.g. Review SQL joins"
                  placeholderTextColor={P.muted}
                  value={editor.draft.title}
                  onChangeText={(title) =>
                    setEditor({ ...editor, draft: { ...editor.draft, title } })
                  }
                  maxLength={MAX_TASK_TITLE}
                  multiline
                  autoFocus
                  style={s.input}
                  editable={!plan.busy}
                />
                <Text style={s.label}>PLAN FOR</Text>
                <View style={s.chips}>
                  {[
                    today,
                    tomorrow,
                    ...(![today, tomorrow].includes(editor.draft.plannedFor)
                      ? [editor.draft.plannedFor]
                      : []),
                  ].map((day) => (
                    <Pressable
                      key={day}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: editor.draft.plannedFor === day,
                      }}
                      disabled={plan.busy}
                      onPress={() =>
                        setEditor({
                          ...editor,
                          draft: { ...editor.draft, plannedFor: day },
                        })
                      }
                      style={[
                        s.chip,
                        editor.draft.plannedFor === day && s.activeChip,
                      ]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          editor.draft.plannedFor === day && s.activeText,
                        ]}
                      >
                        {day === today
                          ? "Today"
                          : day === tomorrow
                            ? "Tomorrow"
                            : shortDate(Date.parse(`${day}T12:00:00Z`))}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={s.label}>UNIT · OPTIONAL</Text>
                <View style={s.chips}>
                  {[
                    "",
                    ...new Set([
                      ...units,
                      ...(editor.draft.unit ? [editor.draft.unit] : []),
                    ]),
                  ].map((unit) => (
                    <Pressable
                      key={unit}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: (editor.draft.unit ?? "") === unit,
                      }}
                      disabled={plan.busy}
                      onPress={() =>
                        setEditor({
                          ...editor,
                          draft: { ...editor.draft, unit: unit || undefined },
                        })
                      }
                      style={[
                        s.chip,
                        (editor.draft.unit ?? "") === unit && s.activeChip,
                      ]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          (editor.draft.unit ?? "") === unit && s.activeText,
                        ]}
                      >
                        {unit || "No unit"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {button(
                  plan.busy
                    ? "Saving…"
                    : editor.id
                      ? "Save changes"
                      : "Add to my plan",
                  () => {
                    void plan.save(editor.draft, editor.id).then((saved) => {
                      if (saved) setEditor(undefined);
                    });
                  },
                  plan.busy || !editor.draft.title.trim(),
                )}
                {!!plan.error && (
                  <Text accessibilityLiveRegion="polite" style={s.error}>
                    {plan.error}
                  </Text>
                )}
                <Text style={s.caption}>
                  This step belongs to your personal plan. Checking it off records your preparation.
                </Text>
                {!!editor.id && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={plan.busy}
                    onPress={() =>
                      Alert.alert(
                        "Delete this task?",
                        "You can undo this immediately from My plan.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete task",
                            style: "destructive",
                            onPress: () => {
                              void plan.remove(editor.id!).then((saved) => {
                                if (saved) setEditor(undefined);
                              });
                            },
                          },
                        ],
                      )
                    }
                    style={s.deleteButton}
                  >
                    <Text style={s.deleteText}>Delete task</Text>
                  </Pressable>
                )}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  flex: { flex: 1 },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 8,
    gap: 8,
  },
  h2: { fontSize: 17, fontWeight: "700", color: P.ink },
  smallButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  link: { fontSize: 12, fontWeight: "600", color: P.purple },
  panel: {
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: P.line,
    overflow: "hidden",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.line,
    paddingRight: 12,
  },
  taskBody: { flex: 1, paddingVertical: 13 },
  taskTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: P.ink },
  meta: { fontSize: 11, lineHeight: 17, color: P.muted, marginTop: 3 },
  checkTarget: {
    width: 48,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 23,
    height: 23,
    borderWidth: 1.5,
    borderColor: "#C5BED5",
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: P.purple, borderColor: P.purple },
  tick: { fontSize: 14, fontWeight: "700", color: "#fff" },
  done: { textDecorationLine: "line-through", color: P.muted },
  chevron: { fontSize: 22, color: "#A29AAC", marginLeft: 8 },
  empty: { padding: 16, fontSize: 13, lineHeight: 21, color: P.muted },
  emptyButton: { padding: 16, gap: 5 },
  groupTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: P.muted,
    marginTop: 14,
    marginBottom: 7,
  },
  caption: { fontSize: 11, lineHeight: 17, color: P.muted, marginTop: 8 },
  completedButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  error: { fontSize: 12, lineHeight: 19, color: "#9A3F35", marginVertical: 8 },
  suggestionRow: {
    flexDirection: "row",
    gap: 10,
    paddingLeft: 14,
    paddingVertical: 13,
    paddingRight: 8,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.line,
  },
  addSuggestion: {
    minHeight: 44,
    paddingHorizontal: 6,
    justifyContent: "center",
    maxWidth: 98,
  },
  sheet: { flex: 1, backgroundColor: P.paper },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  form: { padding: 22, paddingBottom: 36, gap: 12 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: P.muted,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 12,
    padding: 14,
    minHeight: 98,
    fontSize: 17,
    lineHeight: 25,
    color: P.ink,
    textAlignVertical: "top",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: P.line,
    minHeight: 44,
  },
  activeChip: { backgroundColor: P.lavender, borderColor: P.purple },
  chipText: { fontSize: 12, color: P.muted, fontWeight: "600" },
  activeText: { color: P.purple },
  action: {
    marginTop: 8,
    padding: 15,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: P.purple,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.45 },
  deleteButton: { padding: 15, minHeight: 48, alignItems: "center" },
  deleteText: { color: "#9A3F35", fontSize: 13, fontWeight: "600" },
});
