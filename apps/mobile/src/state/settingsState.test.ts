import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FAILOVER_SETTINGS } from "@apk-alerts/contracts";
import {
  FAILOVER_SETTINGS_STORAGE_KEY,
  type SecureSettingsStorage,
} from "./secureSettingsPersistence.js";
import {
  buildSettingsSummary,
  createNextSettings,
  getDefaultMobileSettingsSnapshot,
  useSettingsState,
} from "./settingsState.js";

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
  assert.equal(summary.engineLabel, "Phone then Remote");
  assert.equal(summary.transportLabel, "Tailscale with cloud fallback");
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
