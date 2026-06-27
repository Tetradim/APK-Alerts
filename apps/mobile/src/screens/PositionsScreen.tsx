import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
import { buildReconciliationSummary, useReconciliationState } from "@/state/reconciliationState";
import { useRemoteEngineState } from "@/state/remoteEngineState";

function statusTone(label: string): "good" | "warn" | "bad" | "neutral" {
  if (label === "Reconciled") {
    return "good";
  }
  if (label === "Attention") {
    return "warn";
  }
  return "neutral";
}

export function PositionsScreen() {
  const remoteConnection = useRemoteEngineState((state) => state.snapshot.connection);
  const snapshot = useReconciliationState((state) => state.snapshot);
  const updateConnectionDraft = useReconciliationState((state) => state.updateConnectionDraft);
  const checkReconciliation = useReconciliationState((state) => state.checkReconciliation);
  const summary = buildReconciliationSummary(snapshot);

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
    <ScreenFrame title="Positions" eyebrow="APK-Alerts">
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.label}>Reconciliation</Text>
          <Text style={styles.heading}>{summary.connectionLabel}</Text>
        </View>
        <StatusPill label={summary.statusLabel} tone={statusTone(summary.statusLabel)} />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>Broker/order/position evidence</Text>
            <Text style={styles.value}>{summary.primaryReason}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: snapshot.checking, disabled: snapshot.checking }}
            disabled={snapshot.checking}
            onPress={() => void checkReconciliation()}
            style={[styles.button, snapshot.checking ? styles.buttonDisabled : null]}
          >
            <Text style={styles.buttonText}>{snapshot.checking ? "Checking" : "Check"}</Text>
          </Pressable>
        </View>
        <Text style={styles.detail}>{summary.lastCheckLabel}</Text>
        {summary.errorLabel ? <Text style={styles.error}>{summary.errorLabel}</Text> : null}
      </View>

      <View style={styles.tileRow}>
        <MetricTile label="Rows" value={summary.rowCountLabel} detail={summary.unresolvedLabel} />
        <MetricTile label="Paper" value={summary.simulatedLabel} detail="Simulated unresolved rows do not block live readiness" />
      </View>

      {snapshot.remote.rows.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>No reconciliation rows</Text>
          <Text style={styles.detail}>
            Pair a Remote Engine and check reconciliation to show alert, trade, order, and position links from Consolidation.
          </Text>
        </View>
      ) : (
        snapshot.remote.rows.slice(0, 12).map((row) => (
          <View key={`${row.alertId}-${row.tradeId}-${row.positionId}`} style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.label}>{row.contractKey || row.ticker || "Unknown contract"}</Text>
                <Text style={styles.panelTitle}>{row.alertId || "Unknown alert"}</Text>
              </View>
              <StatusPill label={row.status} tone={row.status === "reconciled" ? "good" : "warn"} />
            </View>
            <Text style={styles.detail}>Trade: {row.tradeId || "none"} - {row.tradeStatus || "unknown"}</Text>
            <Text style={styles.detail}>Order: {row.orderId || "none"}</Text>
            <Text style={styles.detail}>Position: {row.positionId || "none"} - {row.positionStatus || "unknown"}</Text>
            <Text style={styles.detail}>Mode: {row.simulated ? "paper/simulated" : "real"}</Text>
            {row.attentionReason ? <Text style={styles.error}>{row.attentionReason}</Text> : null}
          </View>
        ))
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  panelHeader: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  headerCopy: { flex: 1 },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  heading: { color: "#f8fafc", fontSize: 24, fontWeight: "900", marginTop: 4 },
  tileRow: { flexDirection: "row", gap: 10 },
  panel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  panelTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
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
