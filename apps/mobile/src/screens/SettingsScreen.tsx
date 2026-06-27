import type { EnginePriority, TransportPreference } from "@apk-alerts/contracts";
import { StyleSheet, Text, View } from "react-native";
import { ScreenFrame } from "@/components/ScreenFrame";
import { SegmentedChoice } from "@/components/SegmentedChoice";
import { SettingRow } from "@/components/SettingRow";
import { buildSettingsSummary, useSettingsState } from "@/state/settingsState";

const enginePriorityOptions = [
  { label: "Phone then Remote", value: "phone_then_remote" },
  { label: "Remote then Phone", value: "remote_then_phone" },
] as const;

const transportOptions = [
  { label: "Tailscale first", value: "tailscale_first" },
  { label: "Cloud first", value: "cloud_first" },
] as const;

export function SettingsScreen() {
  const failoverSettings = useSettingsState((state) => state.snapshot.failoverSettings);
  const updateFailoverSettings = useSettingsState((state) => state.updateFailoverSettings);
  const summary = buildSettingsSummary(failoverSettings);

  return (
    <ScreenFrame title="Settings" eyebrow="APK-Alerts">
      <View style={styles.summaryPanel}>
        <Text style={styles.summaryLabel}>Current failover policy</Text>
        <Text style={styles.summaryValue}>{summary.engineLabel}</Text>
        <Text style={styles.summaryDetail}>{summary.transportLabel}</Text>
        <Text style={styles.summaryDetail}>{summary.notificationsLabel}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Engine Priority</Text>
        <SegmentedChoice<EnginePriority>
          label="Active preference"
          value={failoverSettings.enginePriority}
          options={enginePriorityOptions}
          onChange={(enginePriority) => updateFailoverSettings({ enginePriority })}
        />
        <SettingRow
          label="Phone Engine"
          description="Allow this Android device to own the lease when its health checks are passing."
          value={failoverSettings.phoneEngineEnabled}
          onValueChange={(phoneEngineEnabled) => updateFailoverSettings({ phoneEngineEnabled })}
        />
        <SettingRow
          label="Remote Engine"
          description="Allow the Windows Consolidation engine to take over when the phone engine is not healthy."
          value={failoverSettings.remoteEngineEnabled}
          onValueChange={(remoteEngineEnabled) => updateFailoverSettings({ remoteEngineEnabled })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transport</Text>
        <SegmentedChoice<TransportPreference>
          label="Default route"
          value={failoverSettings.transportPreference}
          options={transportOptions}
          onChange={(transportPreference) => updateFailoverSettings({ transportPreference })}
        />
        <SettingRow
          label="Cloud relay fallback"
          description="Use cloud relay only when private transport is unavailable and the operator permits fallback."
          value={failoverSettings.allowCloudFallback}
          onValueChange={(allowCloudFallback) => updateFailoverSettings({ allowCloudFallback })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Phone Alerts</Text>
        <SettingRow
          label="Failover alerts"
          description="Notify this phone when active execution is handed between engines."
          value={failoverSettings.notifyOnFailover}
          onValueChange={(notifyOnFailover) => updateFailoverSettings({ notifyOnFailover })}
        />
        <SettingRow
          label="Offline alerts"
          description="Notify this phone when an engine or transport is considered offline."
          value={failoverSettings.notifyWhenOffline}
          onValueChange={(notifyWhenOffline) => updateFailoverSettings({ notifyWhenOffline })}
        />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  summaryPanel: {
    backgroundColor: "#ecfdf5",
    borderColor: "#86efac",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  summaryLabel: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#052e16",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  summaryDetail: {
    color: "#166534",
    fontSize: 13,
    marginTop: 5,
  },
  section: {
    backgroundColor: "#111827",
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
  },
});
