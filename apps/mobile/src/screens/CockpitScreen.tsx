import { Pressable, StyleSheet, Text, View } from "react-native";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
import {
  buildCockpitSummary,
  buildEngineCommunicationProofSummary,
} from "@/state/operatorState";
import { useAlertEvidenceState } from "@/state/alertEvidenceState";
import { useLiveReadinessState } from "@/state/liveReadinessState";
import { buildOperatorSnapshotFromEvidence } from "@/state/operatorDerivedState";
import { usePhoneEngineRuntimeState } from "@/state/phoneEngineRuntimeState";
import { useRemoteEngineState } from "@/state/remoteEngineState";
import { useSettingsState } from "@/state/settingsState";

function communicationTone(blocking: boolean): "good" | "warn" | "bad" | "neutral" {
  return blocking ? "bad" : "good";
}

export function CockpitScreen() {
  const remoteEngine = useRemoteEngineState((state) => state.snapshot);
  const alertEvidence = useAlertEvidenceState((state) => state.snapshot);
  const liveReadiness = useLiveReadinessState((state) => state.snapshot);
  const phoneEngine = usePhoneEngineRuntimeState((state) => state.snapshot);
  const snapshot = buildOperatorSnapshotFromEvidence({
    remoteEngine,
    alertEvidence,
    liveReadiness,
    phoneEngine,
  });
  const failoverSettings = useSettingsState((state) => state.snapshot.failoverSettings);
  const summary = buildCockpitSummary(snapshot, failoverSettings);
  const communicationProof = buildEngineCommunicationProofSummary(snapshot);

  return (
    <ScreenFrame title="Operator Cockpit" eyebrow="APK-Alerts">
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.label}>Active engine</Text>
          <Text style={styles.activeEngine}>{summary.activeEngineLabel}</Text>
        </View>
        <StatusPill label={summary.leaseLabel} tone={summary.canExecute ? "good" : "bad"} />
      </View>

      <View style={styles.tileRow}>
        <MetricTile label="Remote" value={summary.remoteLabel} detail="Dormant only when phone owns lease" />
        <MetricTile label="Transport" value={summary.transportLabel} detail={summary.syncLabel} />
      </View>

      <View style={[styles.readinessPanel, summary.canExecute ? styles.readyPanel : styles.blockedPanel]}>
        <Text style={styles.readinessLabel}>Readiness</Text>
        <Text style={styles.readinessValue}>{summary.readinessLabel}</Text>
        <Text style={styles.readinessDetail}>
          Trading remains blocked unless lease, engine health, broker readiness, Discord readiness, risk gates, and sync are clear.
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionButton, styles.stopButton, styles.disabledButton]}
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          disabled
        >
          <Text style={styles.actionText}>Panic Stop</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.secondaryButton, styles.disabledButton]}
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          disabled
        >
          <Text style={styles.actionText}>{summary.primaryActionLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.policyPanel}>
        <Text style={styles.policyLabel}>Configured policy</Text>
        <Text style={styles.policyValue}>{summary.policyLabel}</Text>
        <Text style={styles.policyDetail}>{summary.transportPolicyLabel}</Text>
      </View>

      <View style={styles.policyPanel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelCopy}>
            <Text style={styles.policyLabel}>Communication proof</Text>
            <Text style={styles.policyValue}>{communicationProof.readyCountLabel}</Text>
          </View>
          <StatusPill
            label={communicationProof.gateLabel}
            tone={communicationTone(communicationProof.blocking)}
          />
        </View>
        <Text style={styles.policyDetail}>{communicationProof.blockingCountLabel}</Text>
        {communicationProof.items.map((item) => (
          <View key={item.key} style={styles.proofRow}>
            <Text style={styles.policyLabel}>{item.label}</Text>
            <Text style={[styles.proofStatus, item.blocking ? styles.proofBlocked : styles.proofClear]}>
              {item.statusLabel}
            </Text>
            <Text style={styles.policyDetail}>{item.detailLabel}</Text>
          </View>
        ))}
      </View>

      <View style={styles.emptyEvidence}>
        <Text style={styles.emptyTitle}>No live event log paired</Text>
        <Text style={styles.emptyCopy}>
          Pair a real Remote Engine to show alerts, fills, handoffs, and diagnostics. This screen does not invent sample trades.
        </Text>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#94a3b8", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  activeEngine: { color: "#f8fafc", fontSize: 24, fontWeight: "900", marginTop: 4 },
  tileRow: { flexDirection: "row", gap: 10 },
  readinessPanel: { borderRadius: 8, borderWidth: 1, padding: 14 },
  readyPanel: { backgroundColor: "#ecfdf5", borderColor: "#86efac" },
  blockedPanel: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  readinessLabel: { color: "#475569", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  readinessValue: { color: "#0f172a", fontSize: 18, fontWeight: "900", marginTop: 4 },
  readinessDetail: { color: "#475569", fontSize: 13, marginTop: 6 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionButton: { alignItems: "center", borderRadius: 8, flex: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: 12 },
  stopButton: { backgroundColor: "#dc2626" },
  secondaryButton: { backgroundColor: "#334155" },
  disabledButton: { opacity: 0.48 },
  actionText: { color: "#ffffff", fontSize: 14, fontWeight: "900", textAlign: "center" },
  panelHeader: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  panelCopy: { flex: 1 },
  policyPanel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, padding: 14 },
  policyLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  policyValue: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 5 },
  policyDetail: { color: "#94a3b8", fontSize: 13, marginTop: 5 },
  proofRow: {
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
  },
  proofStatus: { fontSize: 14, fontWeight: "900", lineHeight: 19 },
  proofBlocked: { color: "#fca5a5" },
  proofClear: { color: "#86efac" },
  emptyEvidence: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, padding: 14 },
  emptyTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  emptyCopy: { color: "#94a3b8", fontSize: 13, marginTop: 6 },
});
