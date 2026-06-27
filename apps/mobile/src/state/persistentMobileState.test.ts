import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FAILOVER_SETTINGS } from "@apk-alerts/contracts";
import { remoteEngineStore } from "./remoteEngineState.js";
import {
  FAILOVER_SETTINGS_STORAGE_KEY,
  REMOTE_CONNECTION_STORAGE_KEY,
  type SecureSettingsStorage,
} from "./secureSettingsPersistence.js";
import { useSettingsState } from "./settingsState.js";
import {
  hydratePersistentMobileState,
  installPersistentMobileState,
  persistPersistentMobileState,
} from "./persistentMobileState.js";

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

test("persistent mobile state hydrates remote credentials and failover settings", async () => {
  const storage = memoryStorage({
    [REMOTE_CONNECTION_STORAGE_KEY]: JSON.stringify({
      baseApiUrl: "http://100.90.10.11:8001/api",
      apiKey: "secret",
    }),
    [FAILOVER_SETTINGS_STORAGE_KEY]: JSON.stringify({
      ...DEFAULT_FAILOVER_SETTINGS,
      enginePriority: "remote_then_phone",
    }),
  });

  await hydratePersistentMobileState(storage);

  assert.equal(remoteEngineStore.getState().snapshot.connection.baseApiUrl, "http://100.90.10.11:8001/api");
  assert.equal(remoteEngineStore.getState().snapshot.connection.apiKey, "secret");
  assert.equal(remoteEngineStore.getState().snapshot.connection.transport, "tailscale");
  assert.equal(useSettingsState.getState().snapshot.failoverSettings.enginePriority, "remote_then_phone");
});

test("persistent mobile state can persist current store values and subscribe to changes", async () => {
  const storage = memoryStorage();

  remoteEngineStore.getState().updateConnectionDraft({
    baseApiUrl: "https://relay.example.com/api",
    apiKey: "next",
  });
  useSettingsState.getState().updateFailoverSettings({
    enginePriority: "phone_then_remote",
  });
  await persistPersistentMobileState(storage);

  assert.equal(JSON.parse(storage.values[REMOTE_CONNECTION_STORAGE_KEY]).baseApiUrl, "https://relay.example.com/api");
  assert.equal(JSON.parse(storage.values[FAILOVER_SETTINGS_STORAGE_KEY]).enginePriority, "phone_then_remote");

  const unsubscribe = installPersistentMobileState(storage);
  remoteEngineStore.getState().updateConnectionDraft({
    baseApiUrl: "http://192.168.1.40:8001/api",
    apiKey: "local",
  });
  await Promise.resolve();
  unsubscribe();

  assert.equal(JSON.parse(storage.values[REMOTE_CONNECTION_STORAGE_KEY]).baseApiUrl, "http://192.168.1.40:8001/api");
});
