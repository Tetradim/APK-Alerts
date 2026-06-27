import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
import {
  readNativePhoneEngineRuntime,
  startNativePhoneEngineRuntime,
  stopNativePhoneEngineRuntime,
} from "@/native/PhoneEngineRuntimeNative";
import {
  buildPhoneEngineRuntimeSummary,
  usePhoneEngineRuntimeState,
} from "@/state/phoneEngineRuntimeState";
import { buildRemoteEngineSummary, useRemoteEngineState } from "@/state/remoteEngineState";

function healthTone(label: string): "good" | "warn" | "bad" | "neutral" {
  if (label === "Healthy") {
    return "good";
  }

  if (label === "Degraded") {
    return "warn";
  }

  if (label === "Offline") {
    return "bad";
  }

  return "neutral";
}

function phoneRuntimeTone(blocking: boolean): "good" | "bad" {
  return blocking ? "bad" : "good";
}

function adapterLabel(embedded: boolean, ready: boolean): string {
  if (!embedded) {
    return "not embedded";
  }
  return ready ? "ready" : "waiting for config";
}

export function EnginesScreen() {
  const [phoneAction, setPhoneAction] = useState<"idle" | "refresh" | "start" | "stop">("idle");
  const snapshot = useRemoteEngineState((state) => state.snapshot);
  const updateConnectionDraft = useRemoteEngineState((state) => state.updateConnectionDraft);
  const checkRemote = useRemoteEngineState((state) => state.checkRemote);
  const phoneRuntimeSnapshot = usePhoneEngineRuntimeState((state) => state.snapshot);
  const updatePhoneRuntime = usePhoneEngineRuntimeState((state) => state.updateRuntime);
  const summary = buildRemoteEngineSummary(snapshot);
  const phoneRuntime = buildPhoneEngineRuntimeSummary(phoneRuntimeSnapshot);
  const phoneBusy = phoneAction !== "idle";

  const runPhoneRuntimeAction = async (action: "refresh" | "start" | "stop") => {
    setPhoneAction(action);
    try {
      const nextSnapshot =
        action === "start"
          ? await startNativePhoneEngineRuntime()
          : action === "stop"
            ? await stopNativePhoneEngineRuntime()
            : await readNativePhoneEngineRuntime();
      updatePhoneRuntime(nextSnapshot);
    } finally {
      setPhoneAction("idle");
    }
  };

  return (
    <ScreenFrame title="Engines" eyebrow="APK-Alerts">
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.label}>Connection</Text>
          <Text style={styles.heading}>{summary.connectionLabel}</Text>
        </View>
        <StatusPill label={summary.remoteHealthLabel} tone={healthTone(summary.remoteHealthLabel)} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Remote Consolidation API</Text>
        <Text style={styles.fieldLabel}>Remote API URL</Text>
        <TextInput
          value={snapshot.connection.baseApiUrl}
          onChangeText={(baseApiUrl) =>
            updateConnectionDraft({ baseApiUrl, apiKey: snapshot.connection.apiKey })
          }
          placeholder="http://100.x.x.x:8001/api"
          placeholderTextColor="#94a3b8"
          accessibilityLabel="Remote API URL"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>API key</Text>
        <TextInput
          value={snapshot.connection.apiKey}
          onChangeText={(apiKey) =>
            updateConnectionDraft({ baseApiUrl: snapshot.connection.baseApiUrl, apiKey })
          }
          placeholder="API key if required"
          placeholderTextColor="#94a3b8"
          accessibilityLabel="API key"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: snapshot.checking, disabled: snapshot.checking }}
          disabled={snapshot.checking}
          onPress={() => void checkRemote()}
          style={[styles.button, snapshot.checking ? styles.buttonDisabled : null]}
        >
          <Text style={styles.buttonText}>{snapshot.checking ? "Checking" : "Check Remote"}</Text>
        </Pressable>
      </View>

      <View style={styles.tileRow}>
        <MetricTile
          label="Phone"
          value={phoneRuntime.statusLabel}
          detail={phoneRuntime.detailLabel}
        />
        <MetricTile label="Remote" value={summary.remoteHealthLabel} detail={summary.remoteDetailLabel} />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelCopy}>
            <Text style={styles.panelTitle}>Android Phone Engine</Text>
            <Text style={styles.detail}>{phoneRuntime.detailLabel}</Text>
          </View>
          <StatusPill label={phoneRuntime.leaseLabel} tone={phoneRuntimeTone(phoneRuntime.blocking)} />
        </View>
        <Text style={styles.detail}>
          Discord adapter {adapterLabel(phoneRuntimeSnapshot.discordEngineEmbedded, phoneRuntimeSnapshot.discordEngineReady)}
        </Text>
        <Text style={styles.detail}>
          Broker adapter {adapterLabel(phoneRuntimeSnapshot.brokerEngineEmbedded, phoneRuntimeSnapshot.brokerEngineReady)}
        </Text>
        <Text style={styles.detail}>
          Live execution {phoneRuntimeSnapshot.liveExecutionArmed ? "armed" : "blocked until readiness endpoint passes"}
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: phoneAction === "start", disabled: phoneBusy }}
            disabled={phoneBusy}
            onPress={() => void runPhoneRuntimeAction("start")}
            style={[styles.button, styles.actionButton, phoneBusy ? styles.buttonDisabled : null]}
          >
            <Text style={styles.buttonText}>{phoneAction === "start" ? "Starting" : "Start Phone"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: phoneAction === "stop", disabled: phoneBusy }}
            disabled={phoneBusy}
            onPress={() => void runPhoneRuntimeAction("stop")}
            style={[styles.button, styles.actionButton, styles.stopButton, phoneBusy ? styles.buttonDisabled : null]}
          >
            <Text style={styles.buttonText}>{phoneAction === "stop" ? "Stopping" : "Stop"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: phoneAction === "refresh", disabled: phoneBusy }}
            disabled={phoneBusy}
            onPress={() => void runPhoneRuntimeAction("refresh")}
            style={[styles.button, styles.actionButton, styles.secondaryButton, phoneBusy ? styles.buttonDisabled : null]}
          >
            <Text style={styles.buttonText}>{phoneAction === "refresh" ? "Refreshing" : "Refresh"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Last health check</Text>
        <Text style={styles.value}>{summary.lastCheckLabel}</Text>
        <Text style={styles.detail}>{summary.alertsLabel}</Text>
        {summary.errorLabel ? <Text style={styles.error}>{summary.errorLabel}</Text> : null}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  headerCopy: { flex: 1 },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  heading: { color: "#f8fafc", fontSize: 24, fontWeight: "900", marginTop: 4 },
  panel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  panelHeader: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  panelCopy: { flex: 1 },
  panelTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  fieldLabel: { color: "#cbd5e1", fontSize: 13, fontWeight: "800" },
  input: {
    backgroundColor: "#020617",
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f8fafc",
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actionButton: { flex: 1, minWidth: 96 },
  stopButton: { backgroundColor: "#dc2626" },
  secondaryButton: { backgroundColor: "#334155" },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#ffffff", fontSize: 14, fontWeight: "900", textAlign: "center" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tileRow: { flexDirection: "row", gap: 10 },
  value: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 4 },
  detail: { color: "#94a3b8", fontSize: 13 },
  error: { color: "#fca5a5", fontSize: 13, fontWeight: "800" },
});
