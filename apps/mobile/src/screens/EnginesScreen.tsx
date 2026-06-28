import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { buildActionButtonAccessibility } from "@/components/actionButtonAccessibility";
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
import {
  buildPairingDoctorSummary,
  usePairingDoctorState,
} from "@/state/pairingDoctorState";
import { buildRemoteEngineSummary, useRemoteEngineState } from "@/state/remoteEngineState";
import { useSetupAutomationState } from "@/state/setupAutomationState";

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

function pairingTone(blocking: boolean, checking: boolean): "good" | "warn" | "bad" | "neutral" {
  if (checking) {
    return "warn";
  }
  return blocking ? "bad" : "good";
}

function adapterLabel(embedded: boolean, ready: boolean): string {
  if (!embedded) {
    return "not embedded";
  }
  return ready ? "ready" : "waiting for config";
}

function importFormatLabel(format: string): string {
  return format === "deep_link" ? "deep link" : "JSON";
}

export function EnginesScreen() {
  const [phoneAction, setPhoneAction] = useState<"idle" | "refresh" | "start" | "stop">("idle");
  const [pairingPackageText, setPairingPackageText] = useState("");
  const [pairingImportStatus, setPairingImportStatus] = useState("");
  const snapshot = useRemoteEngineState((state) => state.snapshot);
  const updateConnectionDraft = useRemoteEngineState((state) => state.updateConnectionDraft);
  const checkRemote = useRemoteEngineState((state) => state.checkRemote);
  const phoneRuntimeSnapshot = usePhoneEngineRuntimeState((state) => state.snapshot);
  const updatePhoneRuntime = usePhoneEngineRuntimeState((state) => state.updateRuntime);
  const pairingSnapshot = usePairingDoctorState((state) => state.snapshot);
  const runPairingDoctor = usePairingDoctorState((state) => state.runDoctor);
  const setupSnapshot = useSetupAutomationState((state) => state.snapshot);
  const importPairingPackage = useSetupAutomationState((state) => state.importPairingPackage);
  const summary = buildRemoteEngineSummary(snapshot);
  const phoneRuntime = buildPhoneEngineRuntimeSummary(phoneRuntimeSnapshot);
  const pairingSummary = buildPairingDoctorSummary(pairingSnapshot);
  const phoneBusy = phoneAction !== "idle";
  const persistedPairingImportStatus = setupSnapshot.lastImportError
    ? setupSnapshot.lastImportError
    : setupSnapshot.lastImportedAt
      ? `Imported ${setupSnapshot.lastImportedAt} via ${importFormatLabel(setupSnapshot.lastImportFormat)}`
      : "";

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

  const importPackage = () => {
    const result = importPairingPackage(pairingPackageText);
    if (!result.ok || !result.connection) {
      setPairingImportStatus(result.error);
      return;
    }

    updateConnectionDraft(result.connection);
    setPairingPackageText("");
    setPairingImportStatus(
      `Imported ${result.evidence.pairingPackageImportedAt} via ${importFormatLabel(result.inputFormat)}`,
    );
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
          {...buildActionButtonAccessibility("Check Remote", {
            busy: snapshot.checking,
            disabled: snapshot.checking,
          })}
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
        <Text style={styles.panelTitle}>Pairing Package Import</Text>
        <Text style={styles.detail}>
          Paste the JSON or apkalerts://pair link generated by the Windows installer.
        </Text>
        <TextInput
          value={pairingPackageText}
          onChangeText={setPairingPackageText}
          placeholder={'{ "version": 1, "remoteApiUrl": "http://100.x.x.x:8003/api" } or apkalerts://pair?...'}
          placeholderTextColor="#94a3b8"
          accessibilityLabel="Pairing package JSON"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          style={[styles.input, styles.packageInput]}
        />
        {pairingImportStatus || persistedPairingImportStatus ? (
          <Text
            style={
              (pairingImportStatus || persistedPairingImportStatus).startsWith("Imported")
                ? styles.success
                : styles.error
            }
          >
            {pairingImportStatus || persistedPairingImportStatus}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          {...buildActionButtonAccessibility("Import Pairing Package", {
            disabled: !pairingPackageText.trim(),
          })}
          disabled={!pairingPackageText.trim()}
          onPress={importPackage}
          style={[styles.button, !pairingPackageText.trim() ? styles.buttonDisabled : null]}
        >
          <Text style={styles.buttonText}>Import Package</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelCopy}>
            <Text style={styles.label}>Pairing Doctor</Text>
            <Text style={styles.panelTitle}>{pairingSummary.detailLabel}</Text>
          </View>
          <StatusPill
            label={pairingSummary.statusLabel}
            tone={pairingTone(pairingSummary.blocking, pairingSnapshot.checking)}
          />
        </View>
        {pairingSummary.errorLabel ? <Text style={styles.error}>{pairingSummary.errorLabel}</Text> : null}
        {pairingSnapshot.status?.blockingIssues.slice(0, 4).map((issue) => (
          <Text key={issue.code} style={styles.error}>
            {issue.code}: {issue.message}
          </Text>
        ))}
        {pairingSnapshot.checks.slice(0, 8).map((check) => (
          <View key={`${check.key}-${check.path}`} style={styles.checkRow}>
            <Text style={styles.fieldLabel}>{check.label}</Text>
            <Text style={[styles.checkStatus, check.ok ? styles.checkStatusPass : styles.checkStatusFail]}>
              {check.ok ? "Pass" : check.skipped ? "Skipped" : "Fail"}
            </Text>
            <Text style={styles.detail}>
              {check.method} {check.path}{check.error ? ` - ${check.error}` : ""}
            </Text>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          {...buildActionButtonAccessibility("Run Pairing Doctor", {
            busy: pairingSnapshot.checking,
            disabled: pairingSnapshot.checking || !snapshot.connection.baseApiUrl,
          })}
          disabled={pairingSnapshot.checking || !snapshot.connection.baseApiUrl}
          onPress={() =>
            void runPairingDoctor({
              baseApiUrl: snapshot.connection.baseApiUrl,
              apiKey: snapshot.connection.apiKey,
            })
          }
          style={[
            styles.button,
            pairingSnapshot.checking || !snapshot.connection.baseApiUrl ? styles.buttonDisabled : null,
          ]}
        >
          <Text style={styles.buttonText}>{pairingSnapshot.checking ? "Checking" : "Run Doctor"}</Text>
        </Pressable>
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
          Discord gateway {phoneRuntimeSnapshot.discordGatewayConnected ? "connected" : phoneRuntimeSnapshot.discordGatewayStatus || "not connected"}
        </Text>
        <Text style={styles.detail}>
          Discord ingestion evidence {phoneRuntimeSnapshot.discordIngestionEvidenceReady ? `ready ${phoneRuntimeSnapshot.discordLastAlertObservedAt}` : "waiting for allowed alert"}
        </Text>
        <Text style={styles.detail}>
          Peer challenge listener {phoneRuntimeSnapshot.peerAlertServerActive ? `listening on ${phoneRuntimeSnapshot.peerAlertServerPort}` : phoneRuntimeSnapshot.peerAlertServerStatus || "not started"}
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
            {...buildActionButtonAccessibility("Start Phone", {
              busy: phoneAction === "start",
              disabled: phoneBusy,
            })}
            disabled={phoneBusy}
            onPress={() => void runPhoneRuntimeAction("start")}
            style={[styles.button, styles.actionButton, phoneBusy ? styles.buttonDisabled : null]}
          >
            <Text style={styles.buttonText}>{phoneAction === "start" ? "Starting" : "Start Phone"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            {...buildActionButtonAccessibility("Stop", {
              busy: phoneAction === "stop",
              disabled: phoneBusy,
            })}
            disabled={phoneBusy}
            onPress={() => void runPhoneRuntimeAction("stop")}
            style={[styles.button, styles.actionButton, styles.stopButton, phoneBusy ? styles.buttonDisabled : null]}
          >
            <Text style={styles.buttonText}>{phoneAction === "stop" ? "Stopping" : "Stop"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            {...buildActionButtonAccessibility("Refresh", {
              busy: phoneAction === "refresh",
              disabled: phoneBusy,
            })}
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
  packageInput: { minHeight: 112, paddingTop: 12, textAlignVertical: "top" },
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
  checkRow: {
    borderTopColor: "#1e293b",
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 10,
  },
  checkStatus: { fontSize: 13, fontWeight: "900" },
  checkStatusFail: { color: "#fca5a5" },
  checkStatusPass: { color: "#86efac" },
  tileRow: { flexDirection: "row", gap: 10 },
  value: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 4 },
  detail: { color: "#94a3b8", fontSize: 13 },
  error: { color: "#fca5a5", fontSize: 13, fontWeight: "800" },
  success: { color: "#86efac", fontSize: 13, fontWeight: "800" },
});
