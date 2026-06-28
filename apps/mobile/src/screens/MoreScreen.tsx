import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { buildActionButtonAccessibility } from "@/components/actionButtonAccessibility";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
import { useAlertEvidenceState } from "@/state/alertEvidenceState";
import { useDiscordWebViewHealthState } from "@/state/discordWebViewState";
import {
  buildMobileInstallReadinessSummary,
} from "@/state/installReadinessState";
import {
  buildLiveArmChecklistSummary,
  buildLiveReadinessSummary,
  buildReplayAcceptanceEvidenceSummary,
  useLiveReadinessState,
} from "@/state/liveReadinessState";
import { usePairingDoctorState } from "@/state/pairingDoctorState";
import { usePeerAlertFailsafeState } from "@/state/peerAlertFailsafeState";
import { usePhoneEngineRuntimeState } from "@/state/phoneEngineRuntimeState";
import { useReconciliationState } from "@/state/reconciliationState";
import { useRemoteEngineState } from "@/state/remoteEngineState";
import {
  buildMobileSupportBundle,
  serializeMobileSupportBundle,
} from "@/state/supportBundleState";
import {
  buildSetupAutomationSummary,
  buildSetupSmokeTestSummary,
  useSetupAutomationState,
} from "@/state/setupAutomationState";

function readinessTone(label: string): "good" | "warn" | "bad" | "neutral" {
  if (label === "Ready") {
    return "good";
  }
  if (label === "Ready to arm") {
    return "warn";
  }
  return "bad";
}

function checklistTone(blocking: boolean): "good" | "warn" | "bad" | "neutral" {
  return blocking ? "bad" : "good";
}

export function MoreScreen() {
  const snapshot = useLiveReadinessState((state) => state.snapshot);
  const checkReadiness = useLiveReadinessState((state) => state.checkReadiness);
  const remoteSnapshot = useRemoteEngineState((state) => state.snapshot);
  const pairingSnapshot = usePairingDoctorState((state) => state.snapshot);
  const webViewSnapshot = useDiscordWebViewHealthState((state) => state.snapshot);
  const phoneRuntimeSnapshot = usePhoneEngineRuntimeState((state) => state.snapshot);
  const windowsSetup = useSetupAutomationState((state) => state.snapshot.windows);
  const alertEvidenceSnapshot = useAlertEvidenceState((state) => state.snapshot);
  const peerFailsafeSnapshot = usePeerAlertFailsafeState((state) => state.snapshot);
  const reconciliationSnapshot = useReconciliationState((state) => state.snapshot);
  const summary = buildLiveReadinessSummary(snapshot);
  const liveChecklist = buildLiveArmChecklistSummary(snapshot);
  const replayEvidence = buildReplayAcceptanceEvidenceSummary(snapshot);
  const setupAssistant = buildSetupAutomationSummary({
    remote: remoteSnapshot,
    pairing: pairingSnapshot,
    phoneRuntime: phoneRuntimeSnapshot,
    webView: webViewSnapshot,
    liveReadiness: snapshot,
    windows: windowsSetup,
  });
  const smokeTest = buildSetupSmokeTestSummary({
    remote: remoteSnapshot,
    pairing: pairingSnapshot,
    phoneRuntime: phoneRuntimeSnapshot,
    alertEvidence: alertEvidenceSnapshot,
    peerFailsafe: peerFailsafeSnapshot,
    windows: windowsSetup,
  });
  const installReadiness = buildMobileInstallReadinessSummary({
    pairing: pairingSnapshot,
    webView: webViewSnapshot,
    phoneRuntime: phoneRuntimeSnapshot,
    liveReadiness: snapshot,
  });
  const supportBundleText = useMemo(
    () =>
      serializeMobileSupportBundle(
        buildMobileSupportBundle({
          createdAt: new Date().toISOString(),
          remote: remoteSnapshot,
          pairing: pairingSnapshot,
          phoneRuntime: phoneRuntimeSnapshot,
          webView: webViewSnapshot,
          liveReadiness: snapshot,
          alertEvidence: alertEvidenceSnapshot,
          reconciliation: reconciliationSnapshot,
          windowsSetup,
        }),
      ),
    [
      alertEvidenceSnapshot,
      pairingSnapshot,
      phoneRuntimeSnapshot,
      reconciliationSnapshot,
      remoteSnapshot,
      snapshot,
      webViewSnapshot,
      windowsSetup,
    ],
  );
  const readiness = snapshot.remote.readiness;

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
            {...buildActionButtonAccessibility("Check", {
              busy: snapshot.checking,
              disabled: snapshot.checking,
            })}
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

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>Setup assistant</Text>
            <Text style={styles.panelTitle}>{setupAssistant.readyCountLabel}</Text>
          </View>
          <StatusPill
            label={setupAssistant.statusLabel}
            tone={checklistTone(setupAssistant.blocking)}
          />
        </View>
        <Text style={styles.detail}>Next: {setupAssistant.nextActionLabel}</Text>
        <Text style={styles.detail}>{setupAssistant.blockingCountLabel}</Text>
        {setupAssistant.items.map((item) => (
          <View key={item.key} style={styles.checklistRow}>
            <Text style={styles.label}>{item.label}</Text>
            <Text
              style={[
                styles.checklistStatus,
                item.blocking ? styles.checklistStatusBlocking : styles.checklistStatusClear,
              ]}
            >
              {item.statusLabel}
            </Text>
            <Text style={styles.detail}>{item.detailLabel}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>Unattended smoke test</Text>
            <Text style={styles.panelTitle}>{smokeTest.readyCountLabel}</Text>
          </View>
          <StatusPill label={smokeTest.statusLabel} tone={checklistTone(smokeTest.blocking)} />
        </View>
        <Text style={styles.detail}>Next: {smokeTest.nextActionLabel}</Text>
        <Text style={styles.detail}>{smokeTest.blockingCountLabel}</Text>
        {smokeTest.items.map((item) => (
          <View key={item.key} style={styles.checklistRow}>
            <Text style={styles.label}>{item.label}</Text>
            <Text
              style={[
                styles.checklistStatus,
                item.blocking ? styles.checklistStatusBlocking : styles.checklistStatusClear,
              ]}
            >
              {item.statusLabel}
            </Text>
            <Text style={styles.detail}>{item.detailLabel}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.label}>Mobile install readiness</Text>
            <Text style={styles.panelTitle}>{installReadiness.readyCountLabel}</Text>
          </View>
          <StatusPill
            label={installReadiness.statusLabel}
            tone={checklistTone(installReadiness.blocking)}
          />
        </View>
        <Text style={styles.detail}>{installReadiness.blockingCountLabel}</Text>
        {installReadiness.items.map((item) => (
          <View key={item.key} style={styles.checklistRow}>
            <Text style={styles.label}>{item.label}</Text>
            <Text
              style={[
                styles.checklistStatus,
                item.blocking ? styles.checklistStatusBlocking : styles.checklistStatusClear,
              ]}
            >
              {item.statusLabel}
            </Text>
            <Text style={styles.detail}>{item.detailLabel}</Text>
          </View>
        ))}
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
            <Text style={styles.label}>Live arm checklist</Text>
            <Text style={styles.panelTitle}>{liveChecklist.readyCountLabel}</Text>
          </View>
          <StatusPill label={liveChecklist.gateLabel} tone={checklistTone(liveChecklist.blocking)} />
        </View>
        <Text style={styles.detail}>{liveChecklist.blockingCountLabel}</Text>
        {liveChecklist.items.map((item) => (
          <View key={item.key} style={styles.checklistRow}>
            <Text style={styles.label}>{item.label}</Text>
            <Text
              style={[
                styles.checklistStatus,
                item.blocking ? styles.checklistStatusBlocking : styles.checklistStatusClear,
              ]}
            >
              {item.statusLabel}
            </Text>
            <Text style={styles.detail}>{item.detailLabel}</Text>
          </View>
        ))}
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

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Support bundle</Text>
        <Text style={styles.detail}>
          Non-secret JSON for troubleshooting pairing, WebView, engine, alert, and reconciliation evidence.
        </Text>
        <Text selectable style={styles.bundleText}>
          {supportBundleText}
        </Text>
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
  checklistRow: {
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 10,
  },
  checklistStatus: { fontSize: 14, fontWeight: "900", lineHeight: 19 },
  checklistStatusBlocking: { color: "#fca5a5" },
  checklistStatusClear: { color: "#86efac" },
  bundleText: {
    backgroundColor: "#020617",
    borderColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    color: "#cbd5e1",
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 16,
    maxHeight: 260,
    padding: 10,
  },
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
