import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMobileInstallReadinessSummary,
} from "./installReadinessState.js";
import { getDefaultDiscordWebViewHealthSnapshot } from "./discordWebViewState.js";
import { getDefaultLiveReadinessSnapshot } from "./liveReadinessState.js";
import { getDefaultPairingDoctorSnapshot } from "./pairingDoctorState.js";
import { getDefaultPhoneEngineRuntimeSnapshot } from "./phoneEngineRuntimeState.js";

test("mobile install readiness fails closed before evidence is collected", () => {
  const summary = buildMobileInstallReadinessSummary({
    pairing: getDefaultPairingDoctorSnapshot(),
    webView: getDefaultDiscordWebViewHealthSnapshot(),
    phoneRuntime: getDefaultPhoneEngineRuntimeSnapshot(),
    liveReadiness: getDefaultLiveReadinessSnapshot(),
  });

  assert.equal(summary.statusLabel, "Install blocked");
  assert.equal(summary.blocking, true);
  assert.equal(summary.readyCountLabel, "0/4 ready");
  assert.equal(summary.items[0]?.label, "Remote pairing");
});

test("mobile install readiness can clear with pairing webview phone and readiness evidence", () => {
  const phoneRuntime = getDefaultPhoneEngineRuntimeSnapshot();
  Object.assign(phoneRuntime, {
    nativeRuntimeAvailable: true,
    serviceEnabled: true,
    foregroundServiceActive: true,
    discordEngineEmbedded: true,
    brokerEngineEmbedded: true,
    discordIngestionEvidenceReady: true,
    peerAlertServerActive: true,
    brokerEngineReady: true,
    health: "healthy",
    lastHeartbeatAt: "2026-06-27T20:00:00Z",
    blockingReason: "",
  });

  const liveReadiness = getDefaultLiveReadinessSnapshot();
  liveReadiness.remote.checkedAt = "2026-06-27T20:01:00Z";
  liveReadiness.remote.readiness.readyForLive = true;

  const summary = buildMobileInstallReadinessSummary({
    pairing: {
      checking: false,
      lastError: "",
      lastCheckedAt: "2026-06-27T20:00:00Z",
      status: {
        version: 1,
        serverTime: "2026-06-27T20:00:00Z",
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
          checkedAt: "2026-06-27T20:00:00Z",
        },
      ],
    },
    webView: {
      ...getDefaultDiscordWebViewHealthSnapshot(),
      lastLoadedAt: "2026-06-27T20:00:00Z",
    },
    phoneRuntime,
    liveReadiness,
  });

  assert.equal(summary.statusLabel, "Install ready");
  assert.equal(summary.blocking, false);
  assert.equal(summary.readyCountLabel, "4/4 ready");
});
