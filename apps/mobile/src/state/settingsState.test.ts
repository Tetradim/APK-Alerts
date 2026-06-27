import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FAILOVER_SETTINGS } from "@apk-alerts/contracts";
import {
  buildSettingsSummary,
  createNextSettings,
  getDefaultMobileSettingsSnapshot,
} from "./settingsState.js";

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
