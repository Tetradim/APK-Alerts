import assert from "node:assert/strict";
import test from "node:test";
import { createAlertEvidenceStore } from "./alertEvidenceState.js";
import { createLiveReadinessStore } from "./liveReadinessState.js";
import { createReconciliationStore } from "./reconciliationState.js";
import { createRemoteEngineStore } from "./remoteEngineState.js";
import { installRemoteConnectionSync } from "./remoteConnectionSync.js";

test("remote connection sync updates evidence stores without screen lifecycle hooks", () => {
  const remote = createRemoteEngineStore();
  const alerts = createAlertEvidenceStore();
  const readiness = createLiveReadinessStore();
  const reconciliation = createReconciliationStore();
  const unsubscribe = installRemoteConnectionSync({
    remote,
    alerts,
    readiness,
    reconciliation,
  });

  remote.getState().updateConnectionDraft({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: " secret ",
  });

  assert.equal(alerts.getState().snapshot.connection.baseApiUrl, "http://100.90.10.11:8001/api");
  assert.equal(alerts.getState().snapshot.connection.apiKey, "secret");
  assert.equal(readiness.getState().snapshot.connection.baseApiUrl, "http://100.90.10.11:8001/api");
  assert.equal(reconciliation.getState().snapshot.connection.transport, "tailscale");

  unsubscribe();
});
