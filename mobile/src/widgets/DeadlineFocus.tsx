import { Text, VStack } from "@expo/ui/swift-ui";
import { font, frame, lineLimit, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget } from "expo-widgets";
import type { FocusProps } from "../deadline-focus";

function DeadlineFocus(props:FocusProps) {
  "widget";
  return <VStack alignment="leading" spacing={1} modifiers={[
    frame({maxWidth:Infinity,maxHeight:Infinity,alignment:"leading"}),
    widgetURL(props.url || "semester-preview://imported-assessments"),
  ]}>
    <Text modifiers={[font({size:10,weight:"semibold"}),lineLimit(1)]}>{props.heading || "DEADLINE FOCUS"}</Text>
    <Text modifiers={[font({size:14,weight:"bold"}),lineLimit(1)]}>{props.title || "Your next deadline"}</Text>
    <Text modifiers={[font({size:11}),lineLimit(1)]}>{props.meta || "Open Semester to sync"}</Text>
  </VStack>;
}
export default createWidget("SemesterDeadlineFocus",DeadlineFocus);
