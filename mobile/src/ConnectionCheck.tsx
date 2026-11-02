import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import {
  checkNativeConnection,
  connectionLabel,
  CONNECTION_RETURN_URL,
  SITE_SIGN_IN_URL,
  type ConnectionResult,
} from "./connection-check";

export default function ConnectionCheck() {
  const [before, setBefore] = useState<ConnectionResult>();
  const [after, setAfter] = useState<ConnectionResult>();
  const [phase, setPhase] = useState("");
  const [browser, setBrowser] = useState("Not opened");
  const [opened, setOpened] = useState<"yes" | "no" | "unsure">("unsure");
  const [error, setError] = useState("");
  const busy = useRef(false),
    mounted = useRef(true),
    active = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, []);
  async function run(withBrowser: boolean) {
    if (busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    active.current = controller;
    setError("");
    setPhase("Checking app access…");
    if (withBrowser) {
      setBefore(undefined);
      setAfter(undefined);
      setOpened("unsure");
      setBrowser("Not opened");
    }
    try {
      if (withBrowser) {
        const initial = await checkNativeConnection({
          signal: controller.signal,
        });
        if (!mounted.current) return;
        setBefore(initial);
        setPhase("Sign in on the website, then tap Cancel to return here.");
        // This uses the system authentication browser. No cookie extraction,
        // token exchange or undocumented Sites parameters are attempted.
        const result = await WebBrowser.openAuthSessionAsync(
          SITE_SIGN_IN_URL,
          CONNECTION_RETURN_URL,
        );
        if (!mounted.current) return;
        setBrowser(
          result.type === "success"
            ? "Return observed · not proof of sign-in"
            : "Browser closed · sign-in not verified",
        );
      }
      if (!mounted.current) return;
      setPhase("Checking app access after returning…");
      const next = await checkNativeConnection({ signal: controller.signal });
      if (mounted.current) setAfter(next);
    } catch {
      if (mounted.current)
        setError(
          "Couldn’t open the sign-in browser. Retry, or check app access separately.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setPhase("");
    }
  }
  const button = (label: string, onPress: () => void, secondary = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={!!phase}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (pressed || !!phase) && { opacity: 0.55 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: "#584AA5" }]}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Try the connection.</Text>
      <Text style={styles.body}>
        Check whether the existing website’s sign-in carries over to this iPhone
        app.
      </Text>
      <View style={styles.panel}>
        <Text style={styles.heading}>What to do</Text>
        <Text style={styles.body}>
          1. Start the check and continue into the system sign-in browser.
        </Text>
        <Text style={styles.body}>
          2. Sign in to Semester if asked. Once your website opens, tap Cancel
          to return here.
        </Text>
        <Text style={styles.caption}>
          Cancel closes this test’s browser. It does not mean your website
          sign-in failed. The website currently has no automatic return to this
          app.
        </Text>
      </View>
      {button("Start connection check", () => void run(true))}
      {!!phase && (
        <View style={styles.progress}>
          <ActivityIndicator color="#584AA5" />
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {phase}
          </Text>
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {error}
        </Text>
      )}
      {(before || after) && (
        <View style={styles.panel}>
          <Text style={styles.heading}>Connection results</Text>
          <Text selectable style={styles.body}>
            Before: {connectionLabel(before)}
          </Text>
          <Text selectable style={styles.body}>
            Browser: {browser}
          </Text>
          <Text selectable style={styles.body}>
            After: {connectionLabel(after)}
          </Text>
          <Text style={styles.heading}>Did your Semester website open?</Text>
          <View style={styles.options}>
            {(
              [
                ["yes", "Yes"],
                ["no", "No"],
                ["unsure", "Not sure"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: opened === value }}
                disabled={!!phase}
                onPress={() => setOpened(value)}
                style={[styles.option, opened === value && styles.selected]}
              >
                <Text style={styles.optionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text selectable style={styles.caption}>
            Website opened:{" "}
            {opened === "yes"
              ? "Yes (your observation)"
              : opened === "no"
                ? "No (your observation)"
                : "Not confirmed"}
            .
          </Text>
          <Text style={styles.body}>
            {after?.kind === "json-response"
              ? "The API responded. We still need a supported account identity and session lifecycle before connecting real data."
              : opened === "yes"
                ? "The website works in the browser. This check has not established a native API session; it does not rule out another supported integration."
                : "This result does not tell us yet whether the sign-in or the native connection is the missing part."}
          </Text>
        </View>
      )}
      {button("Check app access only", () => void run(false), true)}
      <Text style={styles.caption}>
        Preview experiment · status-only HEAD request. No semester download,
        record changes or automatic sync. Results stay on this screen and are
        not sent as analytics. Your sample widgets and personal tasks keep using
        local data.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: 16 },
  title: { fontSize: 30, fontWeight: "800", color: "#252438" },
  heading: { fontSize: 17, fontWeight: "700", color: "#252438" },
  body: { fontSize: 15, lineHeight: 22, color: "#252438", flexShrink: 1 },
  caption: { fontSize: 13, lineHeight: 19, color: "#716E80" },
  panel: {
    padding: 17,
    borderWidth: 1,
    borderColor: "#E6E3EB",
    borderRadius: 16,
    backgroundColor: "white",
    gap: 12,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#584AA5",
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: "#EFEBFA" },
  buttonText: { fontSize: 15, fontWeight: "700", color: "white" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6E3EB",
    borderRadius: 10,
  },
  selected: { backgroundColor: "#EFEBFA", borderColor: "#584AA5" },
  optionText: { color: "#584AA5", fontSize: 14, fontWeight: "600" },
  progress: { flexDirection: "row", gap: 10, alignItems: "center" },
});
