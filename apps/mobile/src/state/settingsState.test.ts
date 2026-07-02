import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DISCORD_INGESTION_SETTINGS,
  DEFAULT_FAILOVER_SETTINGS,
} from "@sentinel-nexus/contracts";
import {
  DISCORD_INGESTION_SETTINGS_STORAGE_KEY,
  FAILOVER_SETTINGS_STORAGE_KEY,
  type SecureSettingsStorage,
} from "./secureSettingsPersistence.js";
import {
  buildSettingsSummary,
  buildMobileDiscordIngestionRouteDigest,
  createNextSettings,
  getDefaultMobileSettingsSnapshot,
  useSettingsState,
} from "./settingsState.js";
import { getDefaultDiscordWebViewHealthSnapshot } from "./discordWebViewState.js";
import { getDefaultPhoneEngineRuntimeSnapshot } from "./phoneEngineRuntimeState.js";

function memoryStorage(initial: Record<string, string> = {}): SecureSettingsStorage & {
  values: Record<string, string>;
} {
  return {
    values: { ...initial },
    async getItemAsync(key) {
      return this.values[key] ?? null;
    },
    async setItemAsync(key, value) {
      this.values[key] = value;
    },
    async deleteItemAsync(key) {
      delete this.values[key];
    },
  };
}

test("default mobile settings summarize phone-primary Tailscale setup", () => {
  const snapshot = getDefaultMobileSettingsSnapshot();
  const summary = buildSettingsSummary(snapshot.failoverSettings);

  assert.equal(snapshot.failoverSettings.enginePriority, "phone_then_remote");
  assert.deepEqual(snapshot.discordIngestionSettings.routePriority, [
    "bot_engine",
    "webview",
  ]);
  assert.equal(summary.engineLabel, "Phone then Remote");
  assert.equal(summary.transportLabel, "Tailscale with cloud fallback");
  assert.equal(summary.discordIngestionLabel, "Bot Engine -> WebView");
  assert.equal(summary.notificationsLabel, "Failover and offline alerts on");
});

test("settings update can switch to remote-primary without disabling phone fallback", () => {
  const next = createNextSettings(DEFAULT_FAILOVER_SETTINGS, {
    enginePriority: "remote_then_phone",
  });

  assert.equal(next.enginePriority, "remote_then_phone");
  assert.equal(next.phoneEngineEnabled, true);
  assert.equal(next.remoteEngineEnabled, true);
});

test("notification summary reflects disabled failover and offline alerts", () => {
  const summary = buildSettingsSummary({
    ...DEFAULT_FAILOVER_SETTINGS,
    notifyOnFailover: false,
    notifyWhenOffline: false,
  });

  assert.equal(summary.notificationsLabel, "Phone alerts off");
});

test("mobile Discord route digest maps native phone evidence without exposing token", () => {
  const digest = buildMobileDiscordIngestionRouteDigest(
    {
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      botToken: "discord-secret-token",
      routePriority: ["bot_engine", "webview"],
    },
    {
      ...getDefaultPhoneEngineRuntimeSnapshot(),
      foregroundServiceActive: true,
      discordEngineReady: true,
      discordGatewayConnected: true,
      discordIngestionEvidenceReady: true,
    },
    getDefaultDiscordWebViewHealthSnapshot(),
  );

  assert.equal(digest.gateLabel, "Discord route ready");
  assert.equal(digest.activeRouteLabel, "Bot Engine");
  assert.equal(digest.botTokenConfigured, true);
  assert.deepEqual(digest.readyRouteLabels, ["Bot Engine"]);
  assert.equal(digest.evidenceLabels[0], "Bot Gateway: ready");
  assert.doesNotMatch(JSON.stringify(digest), /discord-secret-token/);
});

test("settings store hydrates and persists failover settings through secure storage", async () => {
  const storage = memoryStorage({
    [FAILOVER_SETTINGS_STORAGE_KEY]: JSON.stringify({
      ...DEFAULT_FAILOVER_SETTINGS,
      enginePriority: "remote_then_phone",
      notifyWhenOffline: false,
    }),
  });

  await useSettingsState.getState().hydrateFailoverSettings(storage);
  assert.equal(useSettingsState.getState().snapshot.failoverSettings.enginePriority, "remote_then_phone");
  assert.equal(useSettingsState.getState().snapshot.failoverSettings.notifyWhenOffline, false);

  useSettingsState.getState().updateFailoverSettings({
    enginePriority: "phone_then_remote",
    notifyWhenOffline: true,
  });
  await useSettingsState.getState().persistFailoverSettings(storage);

  assert.equal(
    JSON.parse(storage.values[FAILOVER_SETTINGS_STORAGE_KEY]).enginePriority,
    "phone_then_remote",
  );
});

test("settings store hydrates and persists discord ingestion settings through secure storage", async () => {
  const storage = memoryStorage({
    [DISCORD_INGESTION_SETTINGS_STORAGE_KEY]: JSON.stringify({
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      botToken: "abc",
      routePriority: ["webview", "bot_engine"],
      botEngineEnabled: false,
    }),
  });

  await useSettingsState.getState().hydrateDiscordIngestionSettings(storage);
  assert.equal(useSettingsState.getState().snapshot.discordIngestionSettings.botToken, "abc");
  assert.equal(useSettingsState.getState().snapshot.discordIngestionSettings.botEngineEnabled, false);

  useSettingsState.getState().updateDiscordIngestionSettings({
    botToken: "xyz",
    botEngineEnabled: true,
  });
  await useSettingsState.getState().persistDiscordIngestionSettings(storage);

  const stored = JSON.parse(storage.values[DISCORD_INGESTION_SETTINGS_STORAGE_KEY]);
  assert.equal(stored.botToken, "xyz");
  assert.equal(stored.botEngineEnabled, true);
});
