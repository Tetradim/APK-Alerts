import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
import {
  buildLiveReadinessSummary,
  buildReplayAcceptanceEvidenceSummary,
  useLiveReadinessState,
} from "@/state/liveReadinessState";
import { useRemoteEngineState } from "@/state/remoteEngineState";

function readinessTone(label: string): "good" | "warn" | "bad" | "neutral" {
  if (label === "Ready") {
    return "good";
  }
  if (label === "Ready to arm") {
    return "warn";
  }
  return "bad";
}

export function MoreScreen() {
  const remoteConnection = useRemoteEngineState((state) => state.snapshot.connection);
  const snapshot = useLiveReadinessState((state) => state.snapshot);
  const updateConnectionDraft = useLiveReadinessState((state) => state.updateConnectionDraft);
  const checkReadiness = useLiveReadinessState((state) => state.checkReadiness);
  const summary = buildLiveReadinessSummary(snapshot);
  const replayEvidence = buildReplayAcceptanceEvidenceSummary(snapshot);
  const readiness = snapshot.remote.readiness;

  useEffect(() => {
    if (
      remoteConnection.baseApiUrl !== snapshot.connection.baseApiUrl ||
      remoteConnection.apiKey !== snapshot.connection.apiKey
    ) {
      updateConnectionDraft({
        baseApiUrl: remoteConnection.baseApiUrl,
        apiKey: remoteConnection.apiKey,
      });
    }
  }, [
    remoteConnection.baseApiUrl,
    remoteConnection.apiKey,
    snapshot.connection.baseApiUrl,
    snapshot.connection.apiKey,
    updateConnectionDraft,
  ]);

  return (
    <ScreenFrame title="More" eyebrow="APK-Alerts">
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.label}>Live readiness</Text>
          <Text style={styles.heading}>{summary.connectionLabel}</Text>
        </View>
        <StatusPill label={summary.readinessLabel} tone={readinessTone(summary.readinessLabel)} />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>{summary.liveMoneyLabel}</Text>
            <Text style={styles.value}>{summary.primaryReason}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: snapshot.checking, disabled: snapshot.checking }}
            disabled={snapshot.checking}
            onPress={() => void checkReadiness()}
            style={[styles.button, snapshot.checking ? styles.buttonDisabled : null]}
          >
            <Text style={styles.buttonText}>{snapshot.checking ? "Checking" : "Check"}</Text>
          </Pressable>
        </View>
        <Text style={styles.detail}>{summary.lastCheckLabel}</Text>
        {summary.errorLabel ? <Text style={styles.error}>{summary.errorLabel}</Text> : null}
      </View>

      <View style={styles.tileRow}>
        <MetricTile label="Broker" value={summary.brokerLabel} detail={summary.reconciliationLabel} />
        <MetricTile label="Ingestion" value={summary.ingestionLabel} detail={summary.replayLabel} />
      </View>

      <View style={styles.tileRow}>
        <MetricTile label="Exits" value={summary.exitAutomationLabel} detail={summary.runtimeLabel} />
        <MetricTile
          label="Source"
          value={readiness.checks.sourcePolicy.valid ? "Source policy valid" : "Source policy blocked"}
          detail={`${readiness.checks.sourcePolicy.autoLiveSources} auto-live source(s)`}
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>Replay acceptance</Text>
            <Text style={styles.panelTitle}>{replayEvidence.statusLabel}</Text>
          </View>
          <StatusPill label={replayEvidence.gateLabel} tone={replayEvidence.blocking ? "bad" : "good"} />
        </View>
        <Text style={styles.detail}>{replayEvidence.detailLabel}</Text>
        <Text style={styles.detail}>{replayEvidence.proofLabel}</Text>
        <Text style={styles.detail}>{replayEvidence.failedEventsLabel}</Text>
        <Text style={styles.detail}>{replayEvidence.missingEventsLabel}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Blocking issues</Text>
        {readiness.blockingIssues.length === 0 ? (
          <Text style={styles.detail}>No endpoint blockers returned.</Text>
        ) : (
          readiness.blockingIssues.slice(0, 8).map((issue) => (
            <Text key={`${issue.code}-${issue.message}`} style={styles.detail}>
              {issue.code}: {issue.message}
            </Text>
          ))
        )}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  panelHeader: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  headerCopy: { flex: 1 },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  heading: { color: "#f8fafc", fontSize: 24, fontWeight: "900", marginTop: 4 },
  panel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  panelTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  tileRow: { flexDirection: "row", gap: 10 },
  value: { color: "#f8fafc", fontSize: 15, fontWeight: "900", lineHeight: 21, marginTop: 4 },
  detail: { color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
  error: { color: "#fca5a5", fontSize: 13, fontWeight: "800" },
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
    minWidth: 96,
    paddingHorizontal: 12,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#ffffff", fontSize: 14, fontWeight: "900", textAlign: "center" },
});
