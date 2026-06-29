import assert from "node:assert/strict";
import test from "node:test";
import { buildRemotePairingDeepLink } from "@apk-alerts/contracts";
import { createRemoteEngineStore } from "./remoteEngineState.js";
import {
  createSetupAutomationStore,
  getDefaultWindowsSetupEvidence,
} from "./setupAutomationState.js";
import { applyPairingDeepLink, installPairingDeepLinkHandler } from "./pairingDeepLinkState.js";

test("pairing deep link handler imports pair URL and updates remote connection", () => {
  const setupStore = createSetupAutomationStore(() => "2026-06-28T10:02:00Z");
  const remoteStore = createRemoteEngineStore();
  const deepLink = buildRemotePairingDeepLink({
    version: 1,
    app: "mobile-consolidation",
    createdAt: "2026-06-28T10:01:00Z",
    remoteApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "mobile-secret",
    transportHint: "tailscale",
    requiredEndpoints: [],
  });

  const result = applyPairingDeepLink(deepLink, {
    importPairingPackage: setupStore.getState().importPairingPackage,
    updateConnectionDraft: remoteStore.getState().updateConnectionDraft,
  });

  assert.equal(result.handled, true);
  assert.equal(result.imported, true);
  assert.equal(result.inputFormat, "deep_link");
  assert.equal(result.statusLabel, "Imported pairing deep link at 2026-06-28T10:02:00Z");
  assert.equal(remoteStore.getState().snapshot.connection.baseApiUrl, "http://100.90.10.11:8003/api");
  assert.equal(remoteStore.getState().snapshot.connection.apiKey, "mobile-secret");
  assert.equal(remoteStore.getState().snapshot.connection.transport, "tailscale");
  assert.equal(setupStore.getState().snapshot.windows.tailscaleIp, "100.90.10.11");
});

test("pairing deep link handler ignores non-pairing URLs without mutating state", () => {
  const setupStore = createSetupAutomationStore(() => "2026-06-28T10:02:00Z");
  const remoteStore = createRemoteEngineStore();
  const before = setupStore.getState().snapshot.windows;

  const result = applyPairingDeepLink("https://example.com/not-pairing", {
    importPairingPackage: setupStore.getState().importPairingPackage,
    updateConnectionDraft: remoteStore.getState().updateConnectionDraft,
  });

  assert.equal(result.handled, false);
  assert.equal(result.imported, false);
  assert.deepEqual(setupStore.getState().snapshot.windows, before);
  assert.deepEqual(setupStore.getState().snapshot.windows, getDefaultWindowsSetupEvidence());
  assert.equal(remoteStore.getState().snapshot.connection.baseApiUrl, "");
});

test("pairing deep link handler reports malformed pairing links without exposing payload", () => {
  const setupStore = createSetupAutomationStore(() => "2026-06-28T10:02:00Z");
  const remoteStore = createRemoteEngineStore();

  const result = applyPairingDeepLink("apkalerts://pair?payload=not-json", {
    importPairingPackage: setupStore.getState().importPairingPackage,
    updateConnectionDraft: remoteStore.getState().updateConnectionDraft,
  });

  assert.equal(result.handled, true);
  assert.equal(result.imported, false);
  assert.equal(result.inputFormat, "deep_link");
  assert.match(result.error, /valid pairing payload/);
  assert.doesNotMatch(result.error, /not-json/);
  assert.equal(remoteStore.getState().snapshot.connection.baseApiUrl, "");
});

test("pairing deep link handler warns when initial URL lookup fails", async () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    const unsubscribe = installPairingDeepLinkHandler(
      {
        getInitialURL: () => Promise.reject(new Error("linking unavailable")),
        addEventListener: () => ({ remove: () => undefined }),
      },
      {
        importPairingPackage: () => ({
          ok: false,
          inputFormat: "unknown",
          connection: null,
          config: null,
          evidence: getDefaultWindowsSetupEvidence(),
          error: "",
        }),
        updateConnectionDraft: () => undefined,
      },
    );

    await new Promise((resolve) => setImmediate(resolve));
    unsubscribe();
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.[0], "[pairingDeepLink] getInitialURL failed:");
  assert.match(String(warnings[0]?.[1]), /linking unavailable/);
});
