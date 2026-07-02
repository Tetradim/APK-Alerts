import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DISCORD_INGESTION_SETTINGS } from "@sentinel-nexus/contracts";
import { applyNativeDiscordIngestionSettings } from "./nativeDiscordIngestionBridge.js";
import { createPhoneEngineRuntimeStore } from "./phoneEngineRuntimeState.js";

test("native discord ingestion bridge configures Android without starting foreground service", async () => {
  const calls: string[] = [];
  const store = createPhoneEngineRuntimeStore();

  await applyNativeDiscordIngestionSettings(
    store,
    {
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      botToken: "abc",
      foregroundServiceEnabled: true,
    },
    {
      getStatus: async () => ({}),
      configureDiscordIngestion: async () => {
        calls.push("configure");
        return {
          nativeRuntimeAvailable: true,
          serviceEnabled: false,
          foregroundServiceActive: false,
          discordEngineEmbedded: true,
          brokerEngineEmbedded: true,
          discordEngineReady: false,
          brokerEngineReady: false,
          liveExecutionArmed: false,
          health: "degraded",
          lastHeartbeatAt: "",
          blockingReason: "Foreground service stopped.",
        };
      },
      start: async () => {
        calls.push("start");
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
          lastHeartbeatAt: "2026-06-27T19:10:00.000Z",
          blockingReason: "Broker adapter is not ready.",
        };
      },
      stop: async () => {
        calls.push("stop");
        return {};
      },
    },
  );

  assert.deepEqual(calls, ["configure"]);
  assert.equal(store.getState().snapshot.foregroundServiceActive, false);
  assert.equal(store.getState().snapshot.discordEngineReady, false);
});

test("native discord ingestion bridge configures disabled route without stopping a running service", async () => {
  const calls: string[] = [];
  const store = createPhoneEngineRuntimeStore();
  store.getState().updateRuntime({
    nativeRuntimeAvailable: true,
    serviceEnabled: true,
    foregroundServiceActive: true,
    discordEngineEmbedded: true,
    brokerEngineEmbedded: true,
    discordEngineReady: true,
    brokerEngineReady: false,
    liveExecutionArmed: false,
    health: "degraded",
    lastHeartbeatAt: "2026-06-27T19:09:00.000Z",
    blockingReason: "Broker adapter is not ready.",
  });

  await applyNativeDiscordIngestionSettings(
    store,
    {
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      foregroundServiceEnabled: false,
    },
    {
      getStatus: async () => ({}),
      configureDiscordIngestion: async () => {
        calls.push("configure");
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
          lastHeartbeatAt: "2026-06-27T19:10:00.000Z",
          blockingReason: "Discord bot engine route disabled.",
        };
      },
      start: async () => {
        calls.push("start");
        return {};
      },
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
          lastHeartbeatAt: "",
          blockingReason: "Foreground service stopped.",
        };
      },
    },
  );

  assert.deepEqual(calls, ["configure"]);
  assert.equal(store.getState().snapshot.foregroundServiceActive, true);
  assert.equal(store.getState().snapshot.health, "degraded");
});
