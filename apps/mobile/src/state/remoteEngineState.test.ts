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
  getDefaultRemoteEngineSnapshot,
  normalizeConnectionDraft,
} from "./remoteEngineState.js";

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
