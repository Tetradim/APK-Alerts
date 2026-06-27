import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FAILOVER_SETTINGS,
  buildEnginePriorityLabel,
  buildTransportLabel,
  canAnyEngineRun,
  normalizeFailoverSettings,
} from "./index.js";

test("default failover settings prefer phone then remote over Tailscale", () => {
  assert.equal(DEFAULT_FAILOVER_SETTINGS.enginePriority, "phone_then_remote");
  assert.equal(DEFAULT_FAILOVER_SETTINGS.phoneEngineEnabled, true);
  assert.equal(DEFAULT_FAILOVER_SETTINGS.remoteEngineEnabled, true);
  assert.equal(DEFAULT_FAILOVER_SETTINGS.transportPreference, "tailscale_first");
  assert.equal(DEFAULT_FAILOVER_SETTINGS.allowCloudFallback, true);
  assert.equal(DEFAULT_FAILOVER_SETTINGS.notifyOnFailover, true);
  assert.equal(DEFAULT_FAILOVER_SETTINGS.notifyWhenOffline, true);
});

test("engine availability fails closed when both engines are disabled", () => {
  const settings = normalizeFailoverSettings({
    ...DEFAULT_FAILOVER_SETTINGS,
    phoneEngineEnabled: false,
    remoteEngineEnabled: false,
  });

  assert.equal(canAnyEngineRun(settings), false);
  assert.equal(buildEnginePriorityLabel(settings), "Execution disabled");
});

test("engine priority labels reflect operator preference and disabled engines", () => {
  assert.equal(buildEnginePriorityLabel(DEFAULT_FAILOVER_SETTINGS), "Phone then Remote");
  assert.equal(
    buildEnginePriorityLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      enginePriority: "remote_then_phone",
    }),
    "Remote then Phone",
  );
  assert.equal(
    buildEnginePriorityLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      phoneEngineEnabled: false,
    }),
    "Remote only",
  );
  assert.equal(
    buildEnginePriorityLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      remoteEngineEnabled: false,
    }),
    "Phone only",
  );
});

test("transport labels reflect Tailscale and cloud fallback choices", () => {
  assert.equal(buildTransportLabel(DEFAULT_FAILOVER_SETTINGS), "Tailscale with cloud fallback");
  assert.equal(
    buildTransportLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      allowCloudFallback: false,
    }),
    "Tailscale only",
  );
  assert.equal(
    buildTransportLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      transportPreference: "cloud_first",
    }),
    "Cloud relay with Tailscale fallback",
  );
});
