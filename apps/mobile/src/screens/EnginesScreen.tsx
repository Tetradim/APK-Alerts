import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
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

export function EnginesScreen() {
  const snapshot = useRemoteEngineState((state) => state.snapshot);
  const updateConnectionDraft = useRemoteEngineState((state) => state.updateConnectionDraft);
  const checkRemote = useRemoteEngineState((state) => state.checkRemote);
  const phoneRuntimeSnapshot = usePhoneEngineRuntimeState((state) => state.snapshot);
  const summary = buildRemoteEngineSummary(snapshot);
  const phoneRuntime = buildPhoneEngineRuntimeSummary(phoneRuntimeSnapshot);

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
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#ffffff", fontSize: 14, fontWeight: "900", textAlign: "center" },
  tileRow: { flexDirection: "row", gap: 10 },
  value: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 4 },
  detail: { color: "#94a3b8", fontSize: 13 },
  error: { color: "#fca5a5", fontSize: 13, fontWeight: "800" },
});
