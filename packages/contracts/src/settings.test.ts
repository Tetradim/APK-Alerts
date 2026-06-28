import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FAILOVER_SETTINGS,
  DEFAULT_DISCORD_INGESTION_SETTINGS,
  buildDiscordIngestionAuditDigest,
  buildDiscordIngestionPriorityLabel,
  buildEnginePriorityLabel,
  buildTransportLabel,
  canAnyEngineRun,
  evaluateDiscordIngestionReadiness,
  normalizeDiscordIngestionSettings,
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

test("malformed boolean settings use defaults instead of runtime coercion", () => {
  const phoneSettings = normalizeFailoverSettings({
    phoneEngineEnabled: "false" as unknown as boolean,
  });
  const remoteInput = {
    phoneEngineEnabled: false,
    remoteEngineEnabled: "false" as unknown as boolean,
  };
  const remoteSettings = normalizeFailoverSettings(remoteInput);

  assert.deepEqual(phoneSettings, DEFAULT_FAILOVER_SETTINGS);
  assert.equal(phoneSettings.phoneEngineEnabled, true);
  assert.equal(remoteSettings.remoteEngineEnabled, true);
  assert.equal(typeof remoteSettings.remoteEngineEnabled, "boolean");
  assert.equal(canAnyEngineRun(remoteInput), true);
});

test("null root failover settings normalize to defaults", () => {
  assert.deepEqual(normalizeFailoverSettings(null), DEFAULT_FAILOVER_SETTINGS);
  assert.equal(canAnyEngineRun(null), true);
  assert.equal(buildEnginePriorityLabel(null), "Phone then Remote");
  assert.equal(buildTransportLabel(null), "Tailscale with cloud fallback");
});

test("invalid engine priority normalizes to the default phone-first preference", () => {
  const settings = {
    ...DEFAULT_FAILOVER_SETTINGS,
    enginePriority: "remote_only" as never,
  };

  assert.equal(normalizeFailoverSettings(settings).enginePriority, "phone_then_remote");
  assert.equal(buildEnginePriorityLabel(settings), "Phone then Remote");
});

test("invalid transport preference normalizes to Tailscale and labels Tailscale", () => {
  const settings = {
    ...DEFAULT_FAILOVER_SETTINGS,
    transportPreference: "cloud_only" as never,
  };

  assert.equal(normalizeFailoverSettings(settings).transportPreference, "tailscale_first");
  assert.equal(buildTransportLabel(settings), "Tailscale with cloud fallback");
});

test("default discord ingestion settings enable all local routes with bot engine first", () => {
  assert.deepEqual(DEFAULT_DISCORD_INGESTION_SETTINGS.routePriority, [
    "bot_engine",
    "webview",
  ]);
  assert.equal(DEFAULT_DISCORD_INGESTION_SETTINGS.webViewEnabled, true);
  assert.equal(DEFAULT_DISCORD_INGESTION_SETTINGS.botEngineEnabled, true);
  assert.equal(DEFAULT_DISCORD_INGESTION_SETTINGS.foregroundServiceEnabled, true);
  assert.equal(
    buildDiscordIngestionPriorityLabel(DEFAULT_DISCORD_INGESTION_SETTINGS),
    "Bot Engine -> WebView",
  );
});

test("discord ingestion settings normalize malformed route priorities and token fields", () => {
  const settings = normalizeDiscordIngestionSettings({
    botToken: " token ",
    guildId: " guild ",
    channelAllowlist: " 111, 222 ",
    authorAllowlist: " bot-a ",
    routePriority: ["webview", "webview", "foreground_service", "bad-route"],
    webViewEnabled: "yes",
    botEngineEnabled: false,
    foregroundServiceEnabled: false,
  });

  assert.equal(settings.botToken, "token");
  assert.equal(settings.guildId, "guild");
  assert.equal(settings.channelAllowlist, "111, 222");
  assert.equal(settings.authorAllowlist, "bot-a");
  assert.deepEqual(settings.routePriority, ["webview", "bot_engine"]);
  assert.equal(settings.webViewEnabled, true);
  assert.equal(settings.botEngineEnabled, false);
  assert.equal(settings.foregroundServiceEnabled, false);
  assert.equal(buildDiscordIngestionPriorityLabel(settings), "WebView -> Bot Engine");
});

test("discord ingestion readiness follows route priority without treating keepalive as ingestion", () => {
  const ready = evaluateDiscordIngestionReadiness(
    {
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      botToken: "token",
      routePriority: ["bot_engine", "webview"],
    },
    {
      botGatewayReady: true,
      webViewSessionReady: false,
      foregroundServiceActive: true,
    },
  );
  const blocked = evaluateDiscordIngestionReadiness(
    {
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      botEngineEnabled: false,
      routePriority: ["webview", "bot_engine"],
    },
    {
      botGatewayReady: false,
      webViewSessionReady: false,
      foregroundServiceActive: true,
    },
  );

  assert.equal(ready.ready, true);
  assert.equal(ready.activeRoute, "bot_engine");
  assert.equal(blocked.ready, false);
  assert.equal(blocked.activeRoute, "webview");
  assert.match(blocked.detailLabel, /WebView session has not produced alert evidence/);
});

test("discord ingestion readiness falls through to the next enabled ready route", () => {
  const readiness = evaluateDiscordIngestionReadiness(
    {
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      botToken: "token",
      routePriority: ["bot_engine", "webview"],
    },
    {
      botGatewayReady: false,
      webViewSessionReady: true,
      foregroundServiceActive: true,
    },
  );

  assert.equal(readiness.ready, true);
  assert.equal(readiness.activeRoute, "webview");
  assert.equal(readiness.activeRouteLabel, "WebView");
  assert.match(readiness.detailLabel, /WebView session produced alert evidence/);
});

test("discord ingestion audit digest records ordered route blockers without secrets", () => {
  const digest = buildDiscordIngestionAuditDigest(
    {
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      botToken: "secret-token",
      guildId: "guild-1",
      channelAllowlist: "channel-1, channel-2",
      authorAllowlist: "author-1",
      routePriority: ["bot_engine", "webview"],
    },
    {
      botGatewayReady: false,
      webViewSessionReady: false,
      foregroundServiceActive: true,
    },
  );

  assert.equal(digest.priorityLabel, "Bot Engine -> WebView");
  assert.equal(digest.gateLabel, "Discord route blocked");
  assert.equal(digest.activeRouteLabel, "Bot Engine");
  assert.equal(digest.botTokenConfigured, true);
  assert.equal(digest.guildConfigured, true);
  assert.equal(digest.channelAllowlistConfigured, true);
  assert.equal(digest.authorAllowlistConfigured, true);
  assert.deepEqual(digest.enabledRouteLabels, ["Bot Engine", "WebView"]);
  assert.deepEqual(digest.readyRouteLabels, []);
  assert.deepEqual(digest.blockingRouteLabels, [
    "Bot Engine: Bot Engine Gateway not ready.",
    "WebView: WebView session has not produced alert evidence.",
  ]);
  assert.equal(digest.routeRows.length, 2);
  assert.equal(digest.evidenceLabels[2], "Keepalive: active");
  assert.equal(digest.blocking, true);
  assert.doesNotMatch(JSON.stringify(digest), /secret-token/);
});

test("discord ingestion audit digest records ready fallback route and disabled routes", () => {
  const digest = buildDiscordIngestionAuditDigest(
    {
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      botEngineEnabled: false,
      botToken: "secret-token",
      routePriority: ["bot_engine", "webview"],
    },
    {
      botGatewayReady: false,
      webViewSessionReady: true,
      foregroundServiceActive: true,
    },
  );

  assert.equal(digest.gateLabel, "Discord route ready");
  assert.equal(digest.activeRouteLabel, "WebView");
  assert.deepEqual(digest.disabledRouteLabels, ["Bot Engine"]);
  assert.deepEqual(digest.readyRouteLabels, ["WebView"]);
  assert.equal(digest.routeRows[0]?.detailLabel, "Bot Engine disabled.");
  assert.equal(digest.blocking, false);
});
