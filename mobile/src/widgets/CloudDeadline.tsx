import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, lineLimit, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { CloudWidgetProps } from "../cloud-widget";

function CloudDeadline(props:CloudWidgetProps, environment:WidgetEnvironment) {
  "widget";
  const medium=environment.widgetFamily==="systemMedium";
  return <VStack alignment="leading" spacing={medium?5:1} modifiers={[
    frame({maxWidth:Infinity,maxHeight:Infinity,alignment:"topLeading"}),
    widgetURL("semester-preview://cloud-work"),
  ]}>
    <HStack>
      <Text modifiers={[font({size:10,weight:"bold"}),lineLimit(1)]}>{props.unit || "CLOUD · TRIAL"}</Text>
      {medium && <><Spacer/><Text modifiers={[font({size:11,weight:"semibold"})]}>semester.</Text></>}
    </HStack>
    <Text modifiers={[font({size:medium?15:13,weight:"bold"}),lineLimit(1)]}>{props.title || "Connect cloud work"}</Text>
    <Text modifiers={[font({size:medium?12:11}),lineLimit(1)]}>{props.when || "Open Semester to sync"}</Text>
    {medium && <>
      <Spacer/>
      <Text modifiers={[font({size:14,weight:"semibold"}),lineLimit(1)]}>{props.second || "Your shared test semester"}</Text>
      <Text modifiers={[font({size:12}),lineLimit(1)]}>{props.secondWhen || "Synthetic records · same account as Web"}</Text>
      <Spacer/>
      <Text modifiers={[font({size:11}),lineLimit(1)]}>{props.progress || "Sign in to begin"}</Text>
    </>}
    <Text modifiers={[font({size:10}),lineLimit(1),foregroundStyle({type:"hierarchical",style:"secondary"})]}>
      {props.freshness || "No synced deadlines"}
    </Text>
  </VStack>;
}
export default createWidget("SemesterCloudDeadline",CloudDeadline);
