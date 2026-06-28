import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { buildActionButtonAccessibility } from "@/components/actionButtonAccessibility";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
import { buildExitProtectionEvidenceSummary, useLiveReadinessState } from "@/state/liveReadinessState";
import {
  buildOrderLifecycleEvidenceSummary,
  buildReconciliationSummary,
  useReconciliationState,
} from "@/state/reconciliationState";
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

function lifecycleTone(blocking: boolean): "good" | "warn" | "bad" | "neutral" {
  return blocking ? "bad" : "good";
}

export function PositionsScreen() {
  const remoteConnection = useRemoteEngineState((state) => state.snapshot.connection);
  const reconciliationSnapshot = useReconciliationState((state) => state.snapshot);
  const updateReconciliationConnectionDraft = useReconciliationState((state) => state.updateConnectionDraft);
  const checkReconciliation = useReconciliationState((state) => state.checkReconciliation);
  const liveReadinessSnapshot = useLiveReadinessState((state) => state.snapshot);
  const updateLiveReadinessConnectionDraft = useLiveReadinessState((state) => state.updateConnectionDraft);
  const checkLiveReadiness = useLiveReadinessState((state) => state.checkReadiness);
  const summary = buildReconciliationSummary(reconciliationSnapshot);
  const exitProtection = buildExitProtectionEvidenceSummary(liveReadinessSnapshot);
  const exitLastCheckLabel = liveReadinessSnapshot.remote.checkedAt
    ? `Checked ${liveReadinessSnapshot.remote.checkedAt}`
    : "Never checked";

  useEffect(() => {
    if (
      remoteConnection.baseApiUrl !== reconciliationSnapshot.connection.baseApiUrl ||
      remoteConnection.apiKey !== reconciliationSnapshot.connection.apiKey
    ) {
      updateReconciliationConnectionDraft({
        baseApiUrl: remoteConnection.baseApiUrl,
        apiKey: remoteConnection.apiKey,
      });
    }
    if (
      remoteConnection.baseApiUrl !== liveReadinessSnapshot.connection.baseApiUrl ||
      remoteConnection.apiKey !== liveReadinessSnapshot.connection.apiKey
    ) {
      updateLiveReadinessConnectionDraft({
        baseApiUrl: remoteConnection.baseApiUrl,
        apiKey: remoteConnection.apiKey,
      });
    }
  }, [
    remoteConnection.baseApiUrl,
    remoteConnection.apiKey,
    reconciliationSnapshot.connection.baseApiUrl,
    reconciliationSnapshot.connection.apiKey,
    liveReadinessSnapshot.connection.baseApiUrl,
    liveReadinessSnapshot.connection.apiKey,
    updateReconciliationConnectionDraft,
    updateLiveReadinessConnectionDraft,
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
            {...buildActionButtonAccessibility("Check", {
              busy: reconciliationSnapshot.checking,
              disabled: reconciliationSnapshot.checking,
            })}
            disabled={reconciliationSnapshot.checking}
            onPress={() => void checkReconciliation()}
            style={[styles.button, reconciliationSnapshot.checking ? styles.buttonDisabled : null]}
          >
            <Text style={styles.buttonText}>{reconciliationSnapshot.checking ? "Checking" : "Check"}</Text>
          </Pressable>
        </View>
        <Text style={styles.detail}>{summary.lastCheckLabel}</Text>
        {summary.errorLabel ? <Text style={styles.error}>{summary.errorLabel}</Text> : null}
      </View>

      <View style={styles.tileRow}>
        <MetricTile label="Rows" value={summary.rowCountLabel} detail={summary.unresolvedLabel} />
        <MetricTile label="Paper" value={summary.simulatedLabel} detail="Simulated unresolved rows do not block live readiness" />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>OCO exit protection</Text>
            <Text style={styles.panelTitle}>{exitProtection.statusLabel}</Text>
          </View>
          <StatusPill label={exitProtection.gateLabel} tone={exitProtection.blocking ? "bad" : "good"} />
        </View>
        <Text style={styles.detail}>{exitProtection.configurationLabel}</Text>
        <Text style={styles.detail}>{exitProtection.capabilityLabel}</Text>
        <Text style={styles.detail}>{exitProtection.unprotectedPositionsLabel}</Text>
        <Text style={styles.detail}>{exitProtection.metadataOnlyPositionsLabel}</Text>
        <View style={styles.panelFooter}>
          <Text style={[styles.detail, styles.footerDetail]}>{exitLastCheckLabel}</Text>
          <Pressable
            accessibilityRole="button"
            {...buildActionButtonAccessibility("Check exits", {
              busy: liveReadinessSnapshot.checking,
              disabled: liveReadinessSnapshot.checking,
            })}
            disabled={liveReadinessSnapshot.checking}
            onPress={() => void checkLiveReadiness()}
            style={[styles.secondaryButton, liveReadinessSnapshot.checking ? styles.buttonDisabled : null]}
          >
            <Text style={styles.secondaryButtonText}>{liveReadinessSnapshot.checking ? "Checking" : "Check exits"}</Text>
          </Pressable>
        </View>
        {liveReadinessSnapshot.lastError ? <Text style={styles.error}>{liveReadinessSnapshot.lastError}</Text> : null}
      </View>

      {reconciliationSnapshot.remote.rows.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>No reconciliation rows</Text>
          <Text style={styles.detail}>
            Pair a Remote Engine and check reconciliation to show alert, trade, order, and position links from Consolidation.
          </Text>
        </View>
      ) : (
        reconciliationSnapshot.remote.rows.slice(0, 12).map((row) => {
          const lifecycle = buildOrderLifecycleEvidenceSummary(row);
          return (
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
              <View style={styles.lifecyclePanel}>
                <View style={styles.panelHeader}>
                  <View style={styles.headerCopy}>
                    <Text style={styles.label}>Order lifecycle evidence</Text>
                    <Text style={styles.detail}>{lifecycle.readyCountLabel}</Text>
                  </View>
                  <StatusPill label={lifecycle.gateLabel} tone={lifecycleTone(lifecycle.blocking)} />
                </View>
                <Text style={styles.detail}>{lifecycle.blockingCountLabel}</Text>
                {lifecycle.items.map((item) => (
                  <View key={item.key} style={styles.lifecycleRow}>
                    <Text style={styles.label}>{item.label}</Text>
                    <Text
                      style={[
                        styles.lifecycleStatus,
                        item.blocking ? styles.lifecycleBlocked : styles.lifecycleClear,
                      ]}
                    >
                      {item.statusLabel}
                    </Text>
                    <Text style={styles.detail}>{item.detailLabel}</Text>
                  </View>
                ))}
              </View>
              {row.attentionReason ? <Text style={styles.error}>{row.attentionReason}</Text> : null}
            </View>
          );
        })
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  panelHeader: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  panelFooter: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  headerCopy: { flex: 1 },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  heading: { color: "#f8fafc", fontSize: 24, fontWeight: "900", marginTop: 4 },
  tileRow: { flexDirection: "row", gap: 10 },
  panel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  panelTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  value: { color: "#f8fafc", fontSize: 15, fontWeight: "900", lineHeight: 21, marginTop: 4 },
  detail: { color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
  footerDetail: { flex: 1 },
  error: { color: "#fca5a5", fontSize: 13, fontWeight: "800" },
  lifecyclePanel: {
    borderTopColor: "#334155",
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 10,
  },
  lifecycleRow: {
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 8,
  },
  lifecycleStatus: { fontSize: 14, fontWeight: "900", lineHeight: 19 },
  lifecycleBlocked: { color: "#fca5a5" },
  lifecycleClear: { color: "#86efac" },
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
  secondaryButton: {
    alignItems: "center",
    borderColor: "#475569",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    minWidth: 112,
    paddingHorizontal: 12,
  },
  secondaryButtonText: { color: "#f8fafc", fontSize: 13, fontWeight: "900", textAlign: "center" },
});
