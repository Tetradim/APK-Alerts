import type { DiscordIngestionRoute, EnginePriority, TransportPreference } from "@apk-alerts/contracts";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenFrame } from "@/components/ScreenFrame";
import { SegmentedChoice } from "@/components/SegmentedChoice";
import { SettingRow } from "@/components/SettingRow";
import { useDiscordWebViewHealthState } from "@/state/discordWebViewState";
import { usePhoneEngineRuntimeState } from "@/state/phoneEngineRuntimeState";
import {
  buildMobileDiscordIngestionRouteDigest,
  buildSettingsSummary,
  useSettingsState,
} from "@/state/settingsState";

const enginePriorityOptions = [
  { label: "Phone then Remote", value: "phone_then_remote" },
  { label: "Remote then Phone", value: "remote_then_phone" },
] as const;

const transportOptions = [
  { label: "Tailscale first", value: "tailscale_first" },
  { label: "Cloud first", value: "cloud_first" },
] as const;

type DiscordPriorityPreset =
  | "bot_web"
  | "web_bot";

const discordPriorityOptions = [
  { label: "Bot then Web", value: "bot_web" },
  { label: "Web then Bot", value: "web_bot" },
] as const;

function routePriorityForPreset(preset: DiscordPriorityPreset): DiscordIngestionRoute[] {
  switch (preset) {
    case "bot_web":
      return ["bot_engine", "webview"];
    case "web_bot":
      return ["webview", "bot_engine"];
  }
}

function presetForRoutePriority(priority: DiscordIngestionRoute[]): DiscordPriorityPreset {
  const key = priority.join(",");
  switch (key) {
    case "webview,bot_engine":
      return "web_bot";
    default:
      return "bot_web";
  }
}

export function SettingsScreen() {
  const failoverSettings = useSettingsState((state) => state.snapshot.failoverSettings);
  const discordIngestionSettings = useSettingsState((state) => state.snapshot.discordIngestionSettings);
  const updateFailoverSettings = useSettingsState((state) => state.updateFailoverSettings);
  const updateDiscordIngestionSettings = useSettingsState((state) => state.updateDiscordIngestionSettings);
  const phoneRuntime = usePhoneEngineRuntimeState((state) => state.snapshot);
  const webView = useDiscordWebViewHealthState((state) => state.snapshot);
  const summary = buildSettingsSummary(failoverSettings, discordIngestionSettings);
  const routeDigest = buildMobileDiscordIngestionRouteDigest(
    discordIngestionSettings,
    phoneRuntime,
    webView,
  );

  return (
    <ScreenFrame title="Settings" eyebrow="APK-Alerts">
      <View style={styles.summaryPanel}>
        <Text style={styles.summaryLabel}>Current failover policy</Text>
        <Text style={styles.summaryValue}>{summary.engineLabel}</Text>
        <Text style={styles.summaryDetail}>{summary.transportLabel}</Text>
        <Text style={styles.summaryDetail}>{summary.discordIngestionLabel}</Text>
        <Text style={styles.summaryDetail}>
          {routeDigest.gateLabel}: {routeDigest.activeRouteLabel} - {routeDigest.detailLabel}
        </Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discord Ingestion</Text>
        <SegmentedChoice<DiscordPriorityPreset>
          label="Failure order"
          value={presetForRoutePriority(discordIngestionSettings.routePriority)}
          options={discordPriorityOptions}
          onChange={(preset) =>
            updateDiscordIngestionSettings({ routePriority: routePriorityForPreset(preset) })
          }
        />
        <Text style={styles.routeAuditText}>
          Ready {routeDigest.readyRouteLabels.length || 0} / Enabled{" "}
          {routeDigest.enabledRouteLabels.length || 0} - {routeDigest.evidenceLabels.join("; ")}
        </Text>
        <SettingRow
          label="Embedded Bot Engine"
          description="Run a Discord bot Gateway worker inside the Android foreground service."
          value={discordIngestionSettings.botEngineEnabled}
          onValueChange={(botEngineEnabled) => updateDiscordIngestionSettings({ botEngineEnabled })}
        />
        <SettingRow
          label="Discord WebView"
          description="Show Discord inside the app as a persistent WebView tab."
          value={discordIngestionSettings.webViewEnabled}
          onValueChange={(webViewEnabled) => updateDiscordIngestionSettings({ webViewEnabled })}
        />
        <SettingRow
          label="Foreground Keepalive"
          description="Keep Mobile Consolidation active with an Android foreground notification."
          value={discordIngestionSettings.foregroundServiceEnabled}
          onValueChange={(foregroundServiceEnabled) =>
            updateDiscordIngestionSettings({ foregroundServiceEnabled })
          }
        />
        <Text style={styles.fieldLabel}>Bot token</Text>
        <TextInput
          value={discordIngestionSettings.botToken}
          onChangeText={(botToken) => updateDiscordIngestionSettings({ botToken })}
          placeholder="Discord bot token"
          placeholderTextColor="#94a3b8"
          accessibilityLabel="Discord bot token"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Guild ID</Text>
        <TextInput
          value={discordIngestionSettings.guildId}
          onChangeText={(guildId) => updateDiscordIngestionSettings({ guildId })}
          placeholder="Optional guild/server ID"
          placeholderTextColor="#94a3b8"
          accessibilityLabel="Discord guild ID"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Channel allowlist</Text>
        <TextInput
          value={discordIngestionSettings.channelAllowlist}
          onChangeText={(channelAllowlist) => updateDiscordIngestionSettings({ channelAllowlist })}
          placeholder="Comma-separated channel IDs"
          placeholderTextColor="#94a3b8"
          accessibilityLabel="Discord channel allowlist"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Author allowlist</Text>
        <TextInput
          value={discordIngestionSettings.authorAllowlist}
          onChangeText={(authorAllowlist) => updateDiscordIngestionSettings({ authorAllowlist })}
          placeholder="Comma-separated author IDs"
          placeholderTextColor="#94a3b8"
          accessibilityLabel="Discord author allowlist"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
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
    gap: 10,
    padding: 14,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
  },
  fieldLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "800",
  },
  routeAuditText: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 19,
  },
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
});
