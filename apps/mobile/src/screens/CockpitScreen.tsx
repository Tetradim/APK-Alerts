import { Pressable, StyleSheet, Text, View } from "react-native";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
import { buildCockpitSummary, useOperatorState } from "@/state/operatorState";

export function CockpitScreen() {
  const snapshot = useOperatorState((state) => state.snapshot);
  const summary = buildCockpitSummary(snapshot);

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
  emptyEvidence: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, padding: 14 },
  emptyTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  emptyCopy: { color: "#94a3b8", fontSize: 13, marginTop: 6 },
});
