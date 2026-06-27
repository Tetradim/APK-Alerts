import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemoteEngineHealthSnapshot,
  normalizeRemoteHealthPayload,
  normalizeRemoteStatusPayload,
} from "./index.js";

test("remote health normalizes healthy Consolidation payload", () => {
  const health = normalizeRemoteHealthPayload({
    status: "healthy",
    discord_connected: true,
    broker_connected: true,
  });

  assert.deepEqual(health, {
    status: "healthy",
    discordConnected: true,
    brokerConnected: true,
  });
});

test("remote health degrades unless status and required booleans are healthy", () => {
  assert.equal(
    normalizeRemoteHealthPayload({
      status: "healthy",
      discord_connected: false,
      broker_connected: true,
    }).status,
    "degraded",
  );
  assert.equal(normalizeRemoteHealthPayload(null).status, "offline");
  assert.equal(normalizeRemoteHealthPayload("bad").status, "offline");
});

test("remote status normalizes runtime fields without coercing malformed booleans", () => {
  const status = normalizeRemoteStatusPayload({
    active_broker: "alpaca",
    auto_trading_enabled: true,
    simulation_mode: false,
    shutdown_triggered: "false",
    alerts_processed: 7,
    last_alert_time: "2026-06-27T15:00:00Z",
  });

  assert.equal(status.activeBroker, "alpaca");
  assert.equal(status.autoTradingEnabled, true);
  assert.equal(status.simulationMode, false);
  assert.equal(status.shutdownTriggered, false);
  assert.equal(status.alertsProcessed, 7);
  assert.equal(status.lastAlertTime, "2026-06-27T15:00:00Z");
});

test("remote engine snapshot fails closed when health is degraded or malformed", () => {
  const snapshot = buildRemoteEngineHealthSnapshot({
    health: { status: "degraded", discordConnected: true, brokerConnected: false },
    status: normalizeRemoteStatusPayload({ active_broker: "ibkr" }),
    checkedAt: "2026-06-27T15:00:00Z",
  });

  assert.equal(snapshot.engineHealth, "degraded");
  assert.equal(snapshot.executionReady, false);
  assert.equal(snapshot.activeBroker, "ibkr");
  assert.equal(snapshot.checkedAt, "2026-06-27T15:00:00Z");
});

test("remote engine snapshot is healthy only when health, status, and runtime are ready", () => {
  const snapshot = buildRemoteEngineHealthSnapshot({
    health: normalizeRemoteHealthPayload({
      status: "healthy",
      discord_connected: true,
      broker_connected: true,
    }),
    status: normalizeRemoteStatusPayload({
      active_broker: "ibkr",
      auto_trading_enabled: true,
      simulation_mode: false,
      shutdown_triggered: false,
      alerts_processed: 3,
    }),
    checkedAt: "2026-06-27T15:00:00Z",
  });

  assert.equal(snapshot.engineHealth, "healthy");
  assert.equal(snapshot.executionReady, true);
  assert.equal(snapshot.alertsProcessed, 3);
});
