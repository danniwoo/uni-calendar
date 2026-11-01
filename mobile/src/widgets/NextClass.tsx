import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  lineLimit,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { WidgetProps } from "../model";

function NextClass(props: WidgetProps, environment: WidgetEnvironment) {
  "widget";
  const content = props.unit ? props : {
    label: "SEMESTER · SAMPLE", unit: "Your next class",
    title: "A little more clarity for your day.",
    when: "Open Semester Preview to begin", location: "Sydney time · Sample data only",
    url: "semester-preview://schedule",
  };
  const ink = environment.colorScheme === "dark" ? "#F4F1FF" : "#26223C";
  const muted = environment.colorScheme === "dark" ? "#C3BDD8" : "#635F75";
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
        widgetURL(content.url),
      ]}
    >
      <HStack>
        <Text
          modifiers={[
            font({ size: 10, weight: "bold" }),
            foregroundStyle(muted),
          ]}
        >
          {content.label}
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 11, weight: "semibold" }),
            foregroundStyle(muted),
          ]}
        >
          semester
        </Text>
      </HStack>
      <Spacer />
      <Text
        modifiers={[
          font({ size: 22, weight: "bold" }),
          foregroundStyle(ink),
          lineLimit(1),
        ]}
      >
        {content.unit}
      </Text>
      <Text
        modifiers={[
          font({ size: 14, weight: "medium" }),
          foregroundStyle(ink),
          lineLimit(1),
        ]}
      >
        {content.title}
      </Text>
      <Spacer />
      <Text
        modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(1)]}
      >
        {content.when}
      </Text>
      <Text
        modifiers={[font({ size: 11 }), foregroundStyle(muted), lineLimit(1)]}
      >
        {content.location || "Sample data only · Sydney time"}
      </Text>
    </VStack>
  );
}
export default createWidget('SemesterNextClass', NextClass);
