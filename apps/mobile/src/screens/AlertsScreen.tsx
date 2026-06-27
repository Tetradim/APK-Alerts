import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
import {
  buildAlertEvidenceSummary,
  buildAlertReconciliationTraceSummary,
  buildAlertTestEvidenceSummary,
  buildBridgeSupervisorSummary,
  buildQueuePlaceEvidenceSummary,
  buildSourcePolicySummary,
  useAlertEvidenceState,
} from "@/state/alertEvidenceState";
import { useReconciliationState } from "@/state/reconciliationState";
import { useRemoteEngineState } from "@/state/remoteEngineState";

function healthTone(label: string): "good" | "warn" | "bad" | "neutral" {
  if (label === "Healthy") {
    return "good";
  }
  if (label === "Unhealthy") {
    return "bad";
  }
  return "neutral";
}

function decisionTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "accepted") {
    return "good";
  }
  if (status === "skipped" || status === "duplicate") {
    return "warn";
  }
  return "neutral";
}

function supervisorTone(blocking: boolean): "good" | "warn" | "bad" | "neutral" {
  return blocking ? "bad" : "good";
}

function sourcePolicyTone(blocking: boolean): "good" | "warn" | "bad" | "neutral" {
  return blocking ? "bad" : "good";
}

function queuePlaceTone(blocking: boolean): "good" | "warn" | "bad" | "neutral" {
  return blocking ? "warn" : "good";
}

function alertTestTone(blocking: boolean): "good" | "warn" | "bad" | "neutral" {
  return blocking ? "bad" : "good";
}

function traceTone(blocking: boolean): "good" | "warn" | "bad" | "neutral" {
  return blocking ? "bad" : "good";
}

export function AlertsScreen() {
  const remoteConnection = useRemoteEngineState((state) => state.snapshot.connection);
  const snapshot = useAlertEvidenceState((state) => state.snapshot);
  const updateConnectionDraft = useAlertEvidenceState((state) => state.updateConnectionDraft);
  const refreshEvidence = useAlertEvidenceState((state) => state.refreshEvidence);
  const reconciliationSnapshot = useReconciliationState((state) => state.snapshot);
  const updateReconciliationConnectionDraft = useReconciliationState((state) => state.updateConnectionDraft);
  const summary = buildAlertEvidenceSummary(snapshot);
  const supervisor = buildBridgeSupervisorSummary(snapshot);

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
    if (
      remoteConnection.baseApiUrl !== reconciliationSnapshot.connection.baseApiUrl ||
      remoteConnection.apiKey !== reconciliationSnapshot.connection.apiKey
    ) {
      updateReconciliationConnectionDraft({
        baseApiUrl: remoteConnection.baseApiUrl,
        apiKey: remoteConnection.apiKey,
      });
    }
  }, [
    remoteConnection.baseApiUrl,
    remoteConnection.apiKey,
    snapshot.connection.baseApiUrl,
    snapshot.connection.apiKey,
    reconciliationSnapshot.connection.baseApiUrl,
    reconciliationSnapshot.connection.apiKey,
    updateConnectionDraft,
    updateReconciliationConnectionDraft,
  ]);

  return (
    <ScreenFrame title="Alerts" eyebrow="APK-Alerts">
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.label}>Remote evidence</Text>
          <Text style={styles.heading}>{summary.connectionLabel}</Text>
        </View>
        <StatusPill label={summary.bridgeHealthLabel} tone={healthTone(summary.bridgeHealthLabel)} />
      </View>

      <View style={styles.tileRow}>
        <MetricTile label="Bridge" value={summary.bridgeHealthLabel} detail={summary.bridgeHealthDetail} />
        <MetricTile label="Evidence" value={summary.evidenceCountLabel} detail={summary.liveReadinessLabel} />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>Bridge supervisor</Text>
            <Text style={styles.panelTitle}>{supervisor.statusLabel}</Text>
          </View>
          <StatusPill label={supervisor.gateLabel} tone={supervisorTone(supervisor.blocking)} />
        </View>
        <Text style={styles.detail}>{supervisor.detailLabel}</Text>
        <Text style={styles.detail}>{supervisor.tabLabel}</Text>
        <Text style={styles.detail}>{supervisor.backoffLabel}</Text>
        <Text style={styles.detail}>{supervisor.failureLabel}</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>Last check</Text>
            <Text style={styles.value}>{summary.lastCheckLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: snapshot.checking, disabled: snapshot.checking }}
            disabled={snapshot.checking}
            onPress={() => void refreshEvidence()}
            style={[styles.button, snapshot.checking ? styles.buttonDisabled : null]}
          >
            <Text style={styles.buttonText}>{snapshot.checking ? "Checking" : "Refresh"}</Text>
          </Pressable>
        </View>
        {summary.errorLabel ? <Text style={styles.error}>{summary.errorLabel}</Text> : null}
      </View>

      {snapshot.evidence.chains.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>No alert evidence</Text>
          <Text style={styles.detail}>
            Pair a Remote Engine and refresh to show Chrome bridge observations, parser confidence,
            source-policy proof, audit decisions, and execution state from Consolidation.
          </Text>
        </View>
      ) : (
        snapshot.evidence.chains.map((chain) => {
          const alertTest = buildAlertTestEvidenceSummary(chain);
          const sourcePolicy = buildSourcePolicySummary(chain);
          const queuePlace = buildQueuePlaceEvidenceSummary(chain);
          const reconciliationTrace = buildAlertReconciliationTraceSummary(
            chain,
            reconciliationSnapshot.remote.rows,
          );
          return (
            <View key={chain.eventId} style={styles.panel}>
              <View style={styles.panelHeader}>
                <View style={styles.headerCopy}>
                  <Text style={styles.label}>{chain.channelName || "Unknown source"}</Text>
                  <Text style={styles.panelTitle}>{chain.rawText || chain.eventId}</Text>
                </View>
                <StatusPill label={chain.status} tone={decisionTone(chain.status)} />
              </View>
              <Text style={styles.detail}>Author: {chain.authorName || "unknown"}</Text>
              <Text style={styles.detail}>Parser confidence: {chain.parserConfidence}</Text>
              <Text style={styles.detail}>Decision: {chain.latestReason || "No decision reason"}</Text>
              <View style={styles.evidenceHeader}>
                <Text style={styles.label}>Alert test evidence</Text>
                <StatusPill label={alertTest.gateLabel} tone={alertTestTone(alertTest.blocking)} />
              </View>
              <Text style={styles.detail}>{alertTest.modeLabel}</Text>
              <Text style={styles.detail}>{alertTest.parserLabel}</Text>
              <Text style={styles.detail}>{alertTest.sourceLabel}</Text>
              <Text style={styles.detail}>{alertTest.queueLabel}</Text>
              <Text style={styles.detail}>{alertTest.auditLabel}</Text>
              <Text style={styles.detail}>{alertTest.captureLabel}</Text>
              <View style={styles.evidenceHeader}>
                <Text style={styles.label}>Queue / place evidence</Text>
                <StatusPill label={queuePlace.gateLabel} tone={queuePlaceTone(queuePlace.blocking)} />
              </View>
              <Text style={styles.detail}>{queuePlace.statusLabel}</Text>
              <Text style={styles.detail}>{queuePlace.alertInsertLabel}</Text>
              <Text style={styles.detail}>{queuePlace.queueLabel}</Text>
              <Text style={styles.detail}>{queuePlace.reasonLabel}</Text>
              <Text style={styles.detail}>{queuePlace.auditLabel}</Text>
              <View style={styles.evidenceHeader}>
                <Text style={styles.label}>Reconciliation trace</Text>
                <StatusPill
                  label={reconciliationTrace.gateLabel}
                  tone={traceTone(reconciliationTrace.blocking)}
                />
              </View>
              <Text style={styles.detail}>{reconciliationTrace.alertLabel}</Text>
              <Text style={styles.detail}>{reconciliationTrace.reconciliationLabel}</Text>
              <Text style={styles.detail}>{reconciliationTrace.orderLabel}</Text>
              <Text style={styles.detail}>{reconciliationTrace.positionLabel}</Text>
              <Text style={styles.detail}>{reconciliationTrace.auditLabel}</Text>
              <View style={styles.sourcePolicyHeader}>
                <Text style={styles.label}>Source policy</Text>
                <StatusPill label={sourcePolicy.gateLabel} tone={sourcePolicyTone(sourcePolicy.blocking)} />
              </View>
              <Text style={styles.detail}>{sourcePolicy.statusLabel}</Text>
              <Text style={styles.detail}>{sourcePolicy.sourceLabel}</Text>
              <Text style={styles.detail}>{sourcePolicy.confidenceLabel}</Text>
              <Text style={styles.detail}>{sourcePolicy.channelLabel}</Text>
              <Text style={styles.detail}>{sourcePolicy.authorLabel}</Text>
              <Text style={styles.detail}>{sourcePolicy.executionModeLabel}</Text>
              <Text style={styles.auditText}>
                event {chain.eventId}
                {chain.signal?.busEventId ? ` - bus ${chain.signal.busEventId}` : ""}
                {chain.decision?.auditEventId ? ` - audit ${chain.decision.auditEventId}` : ""}
              </Text>
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
  evidenceHeader: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between", marginTop: 2 },
  sourcePolicyHeader: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between", marginTop: 2 },
  headerCopy: { flex: 1 },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  heading: { color: "#f8fafc", fontSize: 24, fontWeight: "900", marginTop: 4 },
  tileRow: { flexDirection: "row", gap: 10 },
  panel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  panelTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  value: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 4 },
  detail: { color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
  auditText: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
  error: { color: "#fca5a5", fontSize: 13, fontWeight: "800" },
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
    minWidth: 104,
    paddingHorizontal: 12,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#ffffff", fontSize: 14, fontWeight: "900", textAlign: "center" },
});
