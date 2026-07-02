import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DISCORD_INGESTION_SETTINGS,
  DEFAULT_FAILOVER_SETTINGS,
} from "@sentinel-nexus/contracts";
import {
  DISCORD_INGESTION_SETTINGS_STORAGE_KEY,
  FAILOVER_SETTINGS_STORAGE_KEY,
  REMOTE_CONNECTION_STORAGE_KEY,
  SETUP_AUTOMATION_STORAGE_KEY,
  loadDiscordIngestionSettings,
  loadFailoverSettings,
  loadRemoteConnection,
  loadSetupAutomationEvidence,
  saveDiscordIngestionSettings,
  saveFailoverSettings,
  saveRemoteConnection,
  saveSetupAutomationEvidence,
  type SecureSettingsStorage,
} from "./secureSettingsPersistence.js";
import { getDefaultWindowsSetupEvidence } from "./setupAutomationState.js";

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

test("secure persistence saves and loads trimmed remote API credentials", async () => {
  const storage = memoryStorage();

  await saveRemoteConnection(storage, {
    baseApiUrl: " http://100.90.10.11:8001/api ",
    apiKey: " secret ",
  });
  const loaded = await loadRemoteConnection(storage);

  assert.deepEqual(loaded, {
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
  });
  assert.equal(JSON.parse(storage.values[REMOTE_CONNECTION_STORAGE_KEY]).apiKey, "secret");
});

test("secure persistence ignores malformed remote credential payloads", async () => {
  const storage = memoryStorage({
    [REMOTE_CONNECTION_STORAGE_KEY]: JSON.stringify({ baseApiUrl: 123, apiKey: true }),
  });

  assert.equal(await loadRemoteConnection(storage), null);
});

test("secure persistence saves and normalizes failover settings", async () => {
  const storage = memoryStorage();

  await saveFailoverSettings(storage, {
    ...DEFAULT_FAILOVER_SETTINGS,
    enginePriority: "remote_then_phone",
    notifyWhenOffline: false,
  });
  const loaded = await loadFailoverSettings(storage);

  assert.equal(loaded?.enginePriority, "remote_then_phone");
  assert.equal(loaded?.notifyWhenOffline, false);
  assert.equal(loaded?.phoneEngineEnabled, true);
  assert.equal(storage.values[FAILOVER_SETTINGS_STORAGE_KEY].includes("remote_then_phone"), true);
});

test("secure persistence saves and normalizes discord ingestion settings including token", async () => {
  const storage = memoryStorage();

  await saveDiscordIngestionSettings(storage, {
    ...DEFAULT_DISCORD_INGESTION_SETTINGS,
    botToken: " bot-token ",
    routePriority: ["webview", "bot_engine"],
    foregroundServiceEnabled: false,
  });
  const loaded = await loadDiscordIngestionSettings(storage);

  assert.equal(loaded?.botToken, "bot-token");
  assert.deepEqual(loaded?.routePriority, ["webview", "bot_engine"]);
  assert.equal(loaded?.foregroundServiceEnabled, false);
  assert.equal(JSON.parse(storage.values[DISCORD_INGESTION_SETTINGS_STORAGE_KEY]).botToken, "bot-token");
});

test("secure persistence saves setup evidence without pairing package secrets", async () => {
  const storage = memoryStorage();
  const evidence = {
    ...getDefaultWindowsSetupEvidence(),
    pairingPackageImportedAt: "2026-06-28T10:02:00Z",
    tailscaleIp: "100.90.10.11",
    apiPreflight: {
      checkedAt: "2026-06-28T10:01:30Z",
      remoteApiUrl: "http://100.90.10.11:8003/api",
      apiPort: 8003,
      firewallRuleName: "Sentinel Nexus API 8003",
      firewallRulePresent: true,
      localHealthOk: true,
      phoneReachabilityOk: false,
      httpStatus: 200,
      failureStage: "",
      repairHint: "",
      repairCommand: "",
    },
  };

  await saveSetupAutomationEvidence(storage, evidence);
  const loaded = await loadSetupAutomationEvidence(storage);

  assert.equal(loaded?.pairingPackageImportedAt, "2026-06-28T10:02:00Z");
  assert.equal(loaded?.tailscaleIp, "100.90.10.11");
  assert.equal(loaded?.apiPreflight.remoteApiUrl, "http://100.90.10.11:8003/api");
  assert.equal(loaded?.apiPreflight.httpStatus, 200);
  assert.doesNotMatch(storage.values[SETUP_AUTOMATION_STORAGE_KEY], /apiKey|mobile-secret/i);
});
