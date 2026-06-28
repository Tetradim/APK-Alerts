import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPairingDoctorSummary,
  createPairingDoctorStore,
} from "./pairingDoctorState.js";

test("pairing doctor summary starts as not checked", () => {
  const summary = buildPairingDoctorSummary(createPairingDoctorStore().getState().snapshot);

  assert.equal(summary.statusLabel, "Not checked");
  assert.equal(summary.detailLabel, "Run Pairing Doctor after entering the remote API URL.");
  assert.equal(summary.blocking, true);
});

test("pairing doctor store records passing endpoint evidence", async () => {
  const store = createPairingDoctorStore(async () => ({
    ok: true,
    error: "",
    status: {
      version: 1,
      serverTime: "2026-06-27T18:00:00Z",
      apiAuthConfigured: true,
      apiKeyRequired: true,
      remoteBind: { host: "0.0.0.0", port: 8003, remoteAccessible: true },
      chromeBridgeRemoteEnabled: true,
      baseApiUrlHint: "",
      requiredEndpoints: [],
      blockingIssues: [],
    },
    checks: [
      {
        key: "health",
        label: "Health",
        path: "/health",
        method: "GET",
        ok: true,
        skipped: false,
        error: "",
        checkedAt: "2026-06-27T18:02:00Z",
      },
    ],
  }));

  await store.getState().runDoctor({ baseApiUrl: "http://100.90.10.11:8003/api", apiKey: "secret" });
  const summary = buildPairingDoctorSummary(store.getState().snapshot);

  assert.equal(summary.statusLabel, "Paired");
  assert.equal(summary.detailLabel, "1 of 1 required checks passed.");
  assert.equal(summary.blocking, false);
  assert.equal(store.getState().snapshot.checks[0]?.label, "Health");
});

test("pairing doctor store surfaces blocking issues and probe failures", async () => {
  const store = createPairingDoctorStore(async () => ({
    ok: false,
    error: "",
    status: {
      version: 1,
      serverTime: "2026-06-27T18:00:00Z",
      apiAuthConfigured: false,
      apiKeyRequired: true,
      remoteBind: { host: "0.0.0.0", port: 8003, remoteAccessible: true },
      chromeBridgeRemoteEnabled: false,
      baseApiUrlHint: "",
      requiredEndpoints: [],
      blockingIssues: [{ code: "api_key_missing_for_remote_bind", message: "API key missing." }],
    },
    checks: [
      {
        key: "status",
        label: "Runtime status",
        path: "/status",
        method: "GET",
        ok: false,
        skipped: true,
        error: "API key required before probing this endpoint.",
        checkedAt: "2026-06-27T18:02:00Z",
      },
    ],
  }));

  await store.getState().runDoctor({ baseApiUrl: "http://100.90.10.11:8003/api", apiKey: "" });
  const summary = buildPairingDoctorSummary(store.getState().snapshot);

  assert.equal(summary.statusLabel, "Blocked");
  assert.equal(summary.detailLabel, "0 of 1 required checks passed. 1 remote blocker.");
  assert.equal(summary.blocking, true);
  assert.equal(summary.errorLabel, "Runtime status: API key required before probing this endpoint.");
});
