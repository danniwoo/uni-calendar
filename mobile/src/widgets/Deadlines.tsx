import { Text, VStack, HStack, Spacer } from "@expo/ui/swift-ui";
import {
  font,
  frame,
  lineLimit,
  widgetURL,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { WorkWidgetProps } from "../experience";

function Deadline(props: WorkWidgetProps) {
  "widget";
  return (
    <VStack
      alignment="leading"
      spacing={2}
      modifiers={[
        frame({
          maxWidth: Infinity,
          maxHeight: Infinity,
          alignment: "leading",
        }),
        widgetURL(props.url || "semester-preview://assessments"),
      ]}
    >
      <Text modifiers={[font({ size: 10, weight: "bold" }), lineLimit(1)]}>
        {props.unit || "SEMESTER · SAMPLE"}
      </Text>
      <Text modifiers={[font({ size: 14, weight: "bold" }), lineLimit(1)]}>
        {props.title || "Your next deadline"}
      </Text>
      <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>
        {props.when || "Open Semester to begin"}
      </Text>
    </VStack>
  );
}
function Deadlines(props: WorkWidgetProps) {
  "widget";
  return (
    <VStack
      alignment="leading"
      spacing={2}
      modifiers={[
        frame({
          maxWidth: Infinity,
          maxHeight: Infinity,
          alignment: "leading",
        }),
        widgetURL("semester-preview://assessments"),
      ]}
    >
      <Text modifiers={[font({ size: 11, weight: "bold" }), lineLimit(1)]}>
        {props.unit ? `${props.unit} · ${props.title}` : "DEADLINES · SAMPLE"}
      </Text>
      <Text modifiers={[font({ size: 10 }), lineLimit(1)]}>
        {props.when || "Open Semester to begin"}
      </Text>
      <Text modifiers={[font({ size: 11, weight: "bold" }), lineLimit(1)]}>
        {props.second || "Your next two deadlines"}
      </Text>
      <Text modifiers={[font({ size: 10 }), lineLimit(1)]}>
        {props.secondWhen || props.context || "Sample data"}
      </Text>
    </VStack>
  );
}
function Overview(props: WorkWidgetProps, environment: WidgetEnvironment) {
  "widget";
  const ink = environment.colorScheme === "dark" ? "#F4F1FF" : "#26223C";
  return (
    <VStack
      alignment="leading"
      spacing={5}
      modifiers={[
        frame({
          maxWidth: Infinity,
          maxHeight: Infinity,
          alignment: "topLeading",
        }),
        widgetURL("semester-preview://assessments"),
        foregroundStyle(ink),
      ]}
    >
      <HStack>
        <Text modifiers={[font({ size: 11, weight: "bold" })]}>
          COMING UP · SAMPLE
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 12, weight: "bold" })]}>semester.</Text>
      </HStack>
      <Spacer />
      <Text modifiers={[font({ size: 14, weight: "bold" }), lineLimit(1)]}>
        {props.unit ? `${props.unit} · ${props.title}` : "Your next deadlines"}
      </Text>
      <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>
        {props.when || "Open Semester to begin"}
      </Text>
      <Text modifiers={[font({ size: 14, weight: "bold" }), lineLimit(1)]}>
        {props.second || "See the bigger picture"}
      </Text>
      <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>
        {props.secondWhen || "Sample data only"}
      </Text>
      <Spacer />
      <Text modifiers={[font({ size: 11, weight: "medium" }), lineLimit(1)]}>
        {props.context || "Dates and preparation, together."}
      </Text>
    </VStack>
  );
}
export const DeadlineWidget = createWidget("SemesterDeadline", Deadline);
export const DeadlinesWidget = createWidget("SemesterDeadlines", Deadlines);
export const OverviewWidget = createWidget("SemesterOverview", Overview);
