import assert from "node:assert/strict";
import test from "node:test";
import {
  configureNativeDiscordIngestion,
  readNativePhoneEngineRuntimeStatus,
  startNativePhoneEngineRuntime,
  stopNativePhoneEngineRuntime,
} from "./phoneEngineRuntimeBridge.js";

test("native phone engine bridge reports unavailable when Android module is missing", async () => {
  const snapshot = await readNativePhoneEngineRuntimeStatus(null);

  assert.equal(snapshot.nativeRuntimeAvailable, false);
  assert.equal(snapshot.foregroundServiceActive, false);
  assert.equal(snapshot.discordEngineEmbedded, false);
  assert.equal(snapshot.brokerEngineEmbedded, false);
  assert.equal(snapshot.blockingReason, "Native Android foreground engine module is unavailable.");
});

test("native phone engine bridge normalizes healthy foreground service status", async () => {
  const snapshot = await readNativePhoneEngineRuntimeStatus({
    getStatus: async () => ({
      nativeRuntimeAvailable: true,
      serviceEnabled: true,
      foregroundServiceActive: true,
      discordEngineEmbedded: true,
      brokerEngineEmbedded: true,
      discordEngineReady: true,
      discordGatewayConnected: true,
      discordIngestionEvidenceReady: true,
      discordGatewayStatus: "message_create",
      discordLastAlertObservedAt: "2026-06-27T18:24:59.000Z",
      peerAlertServerActive: true,
      peerAlertServerStatus: "listening",
      peerAlertServerPort: 42117,
      brokerEngineReady: true,
      liveExecutionArmed: false,
      health: "healthy",
      lastHeartbeatAt: "2026-06-27T18:25:00.000Z",
      blockingReason: "",
    }),
    start: async () => ({}),
    stop: async () => ({}),
    configureDiscordIngestion: async () => ({}),
  });

  assert.equal(snapshot.nativeRuntimeAvailable, true);
  assert.equal(snapshot.serviceEnabled, true);
  assert.equal(snapshot.foregroundServiceActive, true);
  assert.equal(snapshot.discordEngineEmbedded, true);
  assert.equal(snapshot.brokerEngineEmbedded, true);
  assert.equal(snapshot.discordEngineReady, true);
  assert.equal(snapshot.discordGatewayConnected, true);
  assert.equal(snapshot.discordIngestionEvidenceReady, true);
  assert.equal(snapshot.peerAlertServerActive, true);
  assert.equal(snapshot.peerAlertServerPort, 42117);
  assert.equal(snapshot.brokerEngineReady, true);
  assert.equal(snapshot.liveExecutionArmed, false);
  assert.equal(snapshot.health, "healthy");
  assert.equal(snapshot.lastHeartbeatAt, "2026-06-27T18:25:00.000Z");
  assert.equal(snapshot.blockingReason, "");
});

test("native phone engine bridge propagates start and stop status", async () => {
  const calls: string[] = [];
  const module = {
    getStatus: async () => ({}),
    start: async () => {
      calls.push("start");
      return {
        nativeRuntimeAvailable: true,
        serviceEnabled: true,
        foregroundServiceActive: true,
        discordEngineEmbedded: true,
        brokerEngineEmbedded: true,
        discordEngineReady: false,
        brokerEngineReady: false,
        liveExecutionArmed: false,
        health: "degraded",
        lastHeartbeatAt: "2026-06-27T18:26:00.000Z",
        blockingReason: "Native Discord and broker adapters are embedded but not configured.",
      };
    },
    configureDiscordIngestion: async () => ({}),
    stop: async () => {
      calls.push("stop");
      return {
        nativeRuntimeAvailable: true,
        serviceEnabled: false,
        foregroundServiceActive: false,
        discordEngineEmbedded: true,
        brokerEngineEmbedded: true,
        discordEngineReady: false,
        brokerEngineReady: false,
        liveExecutionArmed: false,
        health: "offline",
        lastHeartbeatAt: "2026-06-27T18:26:00.000Z",
        blockingReason: "Foreground service stopped.",
      };
    },
  };

  const started = await startNativePhoneEngineRuntime(module);
  const stopped = await stopNativePhoneEngineRuntime(module);

  assert.deepEqual(calls, ["start", "stop"]);
  assert.equal(started.foregroundServiceActive, true);
  assert.equal(started.health, "degraded");
  assert.equal(stopped.foregroundServiceActive, false);
  assert.equal(stopped.health, "offline");
});

test("native phone engine bridge fails closed when Android module throws", async () => {
  const snapshot = await readNativePhoneEngineRuntimeStatus({
    getStatus: async () => {
      throw new Error("binder unavailable");
    },
    start: async () => ({}),
    stop: async () => ({}),
  });

  assert.equal(snapshot.nativeRuntimeAvailable, false);
  assert.equal(snapshot.health, "offline");
  assert.equal(snapshot.blockingReason, "Native Android phone engine status check failed: binder unavailable");
});

test("native phone engine bridge sends discord ingestion settings to Android module", async () => {
  const received: unknown[] = [];
  const snapshot = await configureNativeDiscordIngestion({
    getStatus: async () => ({}),
    start: async () => ({}),
    stop: async () => ({}),
    configureDiscordIngestion: async (settings) => {
      received.push(settings);
      return {
        nativeRuntimeAvailable: true,
        serviceEnabled: true,
        foregroundServiceActive: true,
        discordEngineEmbedded: true,
        brokerEngineEmbedded: true,
        discordEngineReady: true,
        brokerEngineReady: false,
        liveExecutionArmed: false,
        health: "degraded",
        lastHeartbeatAt: "2026-06-27T19:00:00.000Z",
        blockingReason: "Broker adapter is not ready.",
      };
    },
  }, {
    webViewEnabled: true,
    botEngineEnabled: true,
    foregroundServiceEnabled: true,
    routePriority: ["webview", "bot_engine"],
    botToken: " token ",
    guildId: " guild ",
    channelAllowlist: " 111 ",
    authorAllowlist: " 222 ",
  });

  assert.deepEqual(received, [{
    webViewEnabled: true,
    botEngineEnabled: true,
    foregroundServiceEnabled: true,
    routePriority: ["webview", "bot_engine"],
    botToken: "token",
    guildId: "guild",
    channelAllowlist: "111",
    authorAllowlist: "222",
  }]);
  assert.equal(snapshot.discordEngineReady, true);
  assert.equal(snapshot.health, "degraded");
});
