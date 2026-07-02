import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemotePairingDeepLink,
  normalizeRemotePairingConfigPayload,
  normalizeRemotePairingStatusPayload,
  parseRemotePairingPackageInput,
} from "./index.js";

test("remote pairing status normalization maps snake case without carrying secrets", () => {
  const status = normalizeRemotePairingStatusPayload({
    version: 1,
    server_time: "2026-06-27T18:00:00Z",
    api_auth_configured: true,
    api_key_required: true,
    api_key: "must-not-survive",
    remote_bind: {
      host: "0.0.0.0",
      port: 8003,
      remote_accessible: true,
    },
    chrome_bridge_remote_enabled: true,
    base_api_url_hint: "http://100.90.10.11:8003/api",
    required_endpoints: [
      {
        key: "health",
        method: "GET",
        path: "/health",
        requires_api_key: false,
        label: "Health",
      },
    ],
    blocking_issues: [{ code: "api_key_missing_for_remote_bind", message: "missing" }],
  });

  assert.equal(status.version, 1);
  assert.equal(status.serverTime, "2026-06-27T18:00:00Z");
  assert.equal(status.apiAuthConfigured, true);
  assert.equal(status.remoteBind.port, 8003);
  assert.equal(status.requiredEndpoints[0]?.requiresApiKey, false);
  assert.equal(status.blockingIssues[0]?.code, "api_key_missing_for_remote_bind");
  assert.equal("apiKey" in status, false);
  assert.doesNotMatch(JSON.stringify(status), /must-not-survive/);
});

test("remote pairing config normalization keeps the explicit import key", () => {
  const config = normalizeRemotePairingConfigPayload({
    version: 1,
    app: "sentinel-nexus",
    created_at: "2026-06-27T18:01:00Z",
    remote_api_url: "http://100.90.10.11:8003/api",
    api_key: "mobile-secret-value",
    transport_hint: "tailscale",
    required_endpoints: [],
  });

  assert.equal(config.remoteApiUrl, "http://100.90.10.11:8003/api");
  assert.equal(config.apiKey, "mobile-secret-value");
  assert.equal(config.transportHint, "tailscale");
});

test("remote pairing normalization rejects fractional numeric fields", () => {
  const status = normalizeRemotePairingStatusPayload({
    version: 1.5,
    remote_bind: {
      host: "0.0.0.0",
      port: 8003.9,
      remote_accessible: true,
    },
  });
  const config = normalizeRemotePairingConfigPayload({
    version: 2.25,
    remote_api_url: "http://100.90.10.11:8003/api",
  });

  assert.equal(status.version, 0);
  assert.equal(status.remoteBind.port, 0);
  assert.equal(config.version, 0);
});

test("remote pairing package input parses JSON and sentinel nexus deep links", () => {
  const config = {
    version: 1,
    app: "sentinel-nexus",
    createdAt: "2026-06-28T12:10:00Z",
    remoteApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "mobile-secret-value",
    transportHint: "tailscale" as const,
    requiredEndpoints: [],
  };

  const fromJson = parseRemotePairingPackageInput(JSON.stringify(config));
  const deepLink = buildRemotePairingDeepLink(config);
  const fromDeepLink = parseRemotePairingPackageInput(` ${deepLink} `);

  assert.equal(fromJson.ok, true);
  assert.equal(fromJson.format, "json");
  assert.equal(fromJson.config.remoteApiUrl, "http://100.90.10.11:8003/api");
  assert.equal(fromDeepLink.ok, true);
  assert.equal(fromDeepLink.format, "deep_link");
  assert.equal(fromDeepLink.config.apiKey, "mobile-secret-value");
  assert.match(deepLink, /^sentinelnexus:\/\/pair\?payload=/);
  assert.doesNotMatch(deepLink, /mobile-secret-value|\{|"apiKey"/);
});

test("remote pairing package input fails closed for malformed deep links without echoing payloads", () => {
  const result = parseRemotePairingPackageInput("sentinelnexus://pair?payload=not-json");

  assert.equal(result.ok, false);
  assert.equal(result.format, "deep_link");
  assert.equal(result.config.version, 0);
  assert.match(result.error, /valid pairing payload/);
  assert.doesNotMatch(result.error, /not-json/);
});

test("remote pairing status normalization fails closed on malformed payloads", () => {
  const status = normalizeRemotePairingStatusPayload("not-json");

  assert.equal(status.version, 0);
  assert.equal(status.apiAuthConfigured, false);
  assert.equal(status.apiKeyRequired, true);
  assert.equal(status.remoteBind.remoteAccessible, false);
  assert.equal(status.requiredEndpoints.length, 0);
  assert.equal(status.blockingIssues.length, 1);
});
