import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemoteEngineHealthSnapshot,
  normalizeRemoteHealthPayload,
  normalizeRemoteStatusPayload,
} from "@apk-alerts/contracts";
import {
  buildRemoteEngineSummary,
  classifyRemoteTransport,
  createRemoteEngineStore,
  getDefaultRemoteEngineSnapshot,
  normalizeConnectionDraft,
  type RemoteEngineChecker,
} from "./remoteEngineState.js";
import {
  REMOTE_CONNECTION_STORAGE_KEY,
  type SecureSettingsStorage,
} from "./secureSettingsPersistence.js";

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

function healthyRemoteSnapshot(checkedAt: string, alertsProcessed: number) {
  return buildRemoteEngineHealthSnapshot({
    health: normalizeRemoteHealthPayload({
      status: "healthy",
      discord_connected: true,
      broker_connected: true,
    }),
    status: normalizeRemoteStatusPayload({
      active_broker: "alpaca",
      auto_trading_enabled: true,
      simulation_mode: false,
      alerts_processed: alertsProcessed,
    }),
    checkedAt,
  });
}

function createDeferredCheck(snapshot = healthyRemoteSnapshot("2026-06-27T16:00:00Z", 1)) {
  let resolveCheck: (() => void) | undefined;
  const checker: RemoteEngineChecker = async () => {
    await new Promise<void>((resolve) => {
      resolveCheck = resolve;
    });
    return { ok: true, snapshot, error: "" };
  };

  return {
    checker,
    resolve: () => {
      if (!resolveCheck) {
        throw new Error("Deferred check was not started.");
      }
      resolveCheck();
    },
  };
}

test("remote connection draft normalizes URL and trims API key", () => {
  const draft = normalizeConnectionDraft({
    baseApiUrl: " http://100.90.10.11:8001/ ",
    apiKey: " secret ",
  });

  assert.equal(draft.baseApiUrl, "http://100.90.10.11:8001/");
  assert.equal(draft.apiKey, "secret");
});

test("remote transport classification detects Tailscale, local network, cloud, and invalid URLs", () => {
  assert.equal(classifyRemoteTransport("http://100.90.10.11:8001/api"), "tailscale");
  assert.equal(classifyRemoteTransport("http://192.168.1.40:8001/api"), "same_wifi");
  assert.equal(classifyRemoteTransport("https://relay.example.com/api"), "cloud_relay");
  assert.equal(classifyRemoteTransport("not a url"), "none");
});

test("default remote engine summary is unpaired and offline", () => {
  const summary = buildRemoteEngineSummary(getDefaultRemoteEngineSnapshot());

  assert.equal(summary.connectionLabel, "Not paired");
  assert.equal(summary.remoteHealthLabel, "Offline");
  assert.equal(summary.phoneHealthLabel, "Phone engine not started");
  assert.equal(summary.lastCheckLabel, "Never checked");
});

test("successful remote snapshot summarizes real health details", () => {
  const remote = buildRemoteEngineHealthSnapshot({
    health: normalizeRemoteHealthPayload({
      status: "healthy",
      discord_connected: true,
      broker_connected: true,
    }),
    status: normalizeRemoteStatusPayload({
      active_broker: "alpaca",
      auto_trading_enabled: true,
      simulation_mode: false,
      alerts_processed: 9,
    }),
    checkedAt: "2026-06-27T15:45:00Z",
  });

  const summary = buildRemoteEngineSummary({
    ...getDefaultRemoteEngineSnapshot(),
    connection: {
      baseApiUrl: "http://100.90.10.11:8001/api",
      apiKey: "secret",
      transport: "tailscale",
    },
    remote,
    lastError: "",
  });

  assert.equal(summary.connectionLabel, "Tailscale");
  assert.equal(summary.remoteHealthLabel, "Healthy");
  assert.equal(summary.remoteDetailLabel, "alpaca - Discord connected - Broker connected");
  assert.equal(summary.alertsLabel, "9 alerts processed");
});

test("failed remote snapshot surfaces error and offline summary", () => {
  const summary = buildRemoteEngineSummary({
    ...getDefaultRemoteEngineSnapshot(),
    connection: {
      baseApiUrl: "http://127.0.0.1:8001/api",
      apiKey: "",
      transport: "same_wifi",
    },
    remote: buildRemoteEngineHealthSnapshot({
      health: normalizeRemoteHealthPayload(null),
      status: normalizeRemoteStatusPayload(null),
      checkedAt: "2026-06-27T15:45:00Z",
    }),
    lastError: "HTTP 503",
  });

  assert.equal(summary.connectionLabel, "Same Wi-Fi");
  assert.equal(summary.remoteHealthLabel, "Offline");
  assert.equal(summary.errorLabel, "HTTP 503");
});

test("remote store successful check updates remote state", async () => {
  const checker: RemoteEngineChecker = async (config) => {
    assert.equal(config.baseApiUrl, "http://100.90.10.11:8001/api");
    assert.equal(config.apiKey, "secret");
    return {
      ok: true,
      snapshot: healthyRemoteSnapshot("2026-06-27T16:00:00Z", 11),
      error: "",
    };
  };
  const store = createRemoteEngineStore(checker);

  store.getState().updateConnectionDraft({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
  });
  await store.getState().checkRemote();

  assert.equal(store.getState().snapshot.remote.engineHealth, "healthy");
  assert.equal(store.getState().snapshot.remote.alertsProcessed, 11);
  assert.equal(store.getState().snapshot.checking, false);
  assert.equal(store.getState().snapshot.lastError, "");
});

test("remote store connection edit resets remote health offline", async () => {
  const store = createRemoteEngineStore(async () => ({
    ok: true,
    snapshot: healthyRemoteSnapshot("2026-06-27T16:00:00Z", 3),
    error: "",
  }));

  store.getState().updateConnectionDraft({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
  });
  await store.getState().checkRemote();
  store.getState().updateConnectionDraft({
    baseApiUrl: "https://relay.example.com/api",
    apiKey: "next",
  });

  assert.equal(store.getState().snapshot.connection.transport, "cloud_relay");
  assert.equal(store.getState().snapshot.remote.engineHealth, "offline");
  assert.equal(store.getState().snapshot.remote.checkedAt, "");
  assert.equal(store.getState().snapshot.lastError, "");
  assert.equal(store.getState().snapshot.checking, false);
});

test("remote store stale in-flight check does not overwrite after connection edit", async () => {
  const deferred = createDeferredCheck(healthyRemoteSnapshot("2026-06-27T16:00:00Z", 5));
  const store = createRemoteEngineStore(deferred.checker);

  store.getState().updateConnectionDraft({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
  });
  const check = store.getState().checkRemote();
  store.getState().updateConnectionDraft({
    baseApiUrl: "https://relay.example.com/api",
    apiKey: "next",
  });
  deferred.resolve();
  await check;

  assert.equal(store.getState().snapshot.connection.baseApiUrl, "https://relay.example.com/api");
  assert.equal(store.getState().snapshot.remote.engineHealth, "offline");
  assert.equal(store.getState().snapshot.remote.alertsProcessed, 0);
  assert.equal(store.getState().snapshot.checking, false);
});

test("remote store older concurrent check cannot clear newer check or overwrite newer result", async () => {
  const resolvers: Array<() => void> = [];
  const snapshots = [
    healthyRemoteSnapshot("2026-06-27T16:00:00Z", 1),
    healthyRemoteSnapshot("2026-06-27T16:01:00Z", 2),
  ];
  const checker: RemoteEngineChecker = async () => {
    const callIndex = resolvers.length;
    await new Promise<void>((resolve) => {
      resolvers.push(resolve);
    });
    return { ok: true, snapshot: snapshots[callIndex], error: "" };
  };
  const store = createRemoteEngineStore(checker);

  store.getState().updateConnectionDraft({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
  });
  const olderCheck = store.getState().checkRemote();
  const newerCheck = store.getState().checkRemote();

  assert.equal(store.getState().snapshot.checking, true);
  resolvers[0]();
  await olderCheck;

  assert.equal(store.getState().snapshot.checking, true);
  assert.equal(store.getState().snapshot.remote.alertsProcessed, 0);

  resolvers[1]();
  await newerCheck;

  assert.equal(store.getState().snapshot.checking, false);
  assert.equal(store.getState().snapshot.remote.alertsProcessed, 2);
  assert.equal(store.getState().snapshot.remote.checkedAt, "2026-06-27T16:01:00Z");
});

test("remote store hydrates and persists connection through secure storage", async () => {
  const storage = memoryStorage({
    [REMOTE_CONNECTION_STORAGE_KEY]: JSON.stringify({
      baseApiUrl: " http://100.90.10.11:8001/api ",
      apiKey: " secret ",
    }),
  });
  const store = createRemoteEngineStore();

  await store.getState().hydrateConnection(storage);
  assert.equal(store.getState().snapshot.connection.baseApiUrl, "http://100.90.10.11:8001/api");
  assert.equal(store.getState().snapshot.connection.apiKey, "secret");
  assert.equal(store.getState().snapshot.connection.transport, "tailscale");

  store.getState().updateConnectionDraft({
    baseApiUrl: "https://relay.example.com/api",
    apiKey: "next",
  });
  await store.getState().persistConnection(storage);

  assert.deepEqual(JSON.parse(storage.values[REMOTE_CONNECTION_STORAGE_KEY]), {
    baseApiUrl: "https://relay.example.com/api",
    apiKey: "next",
  });
});
