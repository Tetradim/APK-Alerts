import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DISCORD_INGESTION_SETTINGS } from "@apk-alerts/contracts";
import {
  buildDiscordWebViewHealthSummary,
  buildDiscordWebViewUiState,
  createDiscordWebViewHealthStore,
} from "./discordWebViewState.js";

test("discord webview UI state blocks rendering when disabled in settings", () => {
  const state = buildDiscordWebViewUiState(
    {
      ...DEFAULT_DISCORD_INGESTION_SETTINGS,
      webViewEnabled: false,
    },
    { loading: false, error: "" },
  );

  assert.equal(state.renderWebView, false);
  assert.equal(state.status, "disabled");
  assert.equal(state.canRetry, false);
});

test("discord webview UI state exposes retryable load failures", () => {
  const state = buildDiscordWebViewUiState(DEFAULT_DISCORD_INGESTION_SETTINGS, {
    loading: false,
    error: "net::ERR_FAILED",
  });

  assert.equal(state.renderWebView, false);
  assert.equal(state.status, "error");
  assert.equal(state.canRetry, true);
  assert.match(state.detailLabel, /net::ERR_FAILED/);
});

test("discord webview UI state keeps the webview mounted after a slow load timeout", () => {
  const state = buildDiscordWebViewUiState(DEFAULT_DISCORD_INGESTION_SETTINGS, {
    loading: false,
    error: "",
    timedOut: true,
  });

  assert.equal(state.renderWebView, true);
  assert.equal(state.status, "slow");
  assert.equal(state.canRetry, true);
  assert.match(state.detailLabel, /taking longer/i);
});

test("discord webview health store records load success and reload attempts", () => {
  const store = createDiscordWebViewHealthStore(() => "2026-06-27T19:00:00Z");

  store.getState().recordLoadStart();
  store.getState().recordReload();
  store.getState().recordLoadEnd();
  const summary = buildDiscordWebViewHealthSummary(store.getState().snapshot);

  assert.equal(store.getState().snapshot.lastLoadStartedAt, "2026-06-27T19:00:00Z");
  assert.equal(store.getState().snapshot.lastLoadedAt, "2026-06-27T19:00:00Z");
  assert.equal(store.getState().snapshot.reloadCount, 1);
  assert.equal(summary.statusLabel, "WebView loaded");
  assert.equal(summary.blocking, false);
});

test("discord webview health summary blocks slow and failed loads", () => {
  const store = createDiscordWebViewHealthStore(() => "2026-06-27T19:01:00Z");

  store.getState().recordLoadStart();
  store.getState().recordTimeout();
  let summary = buildDiscordWebViewHealthSummary(store.getState().snapshot);
  assert.equal(summary.statusLabel, "WebView slow");
  assert.equal(summary.blocking, true);

  store.getState().recordError("net::ERR_FAILED");
  summary = buildDiscordWebViewHealthSummary(store.getState().snapshot);
  assert.equal(summary.statusLabel, "WebView error");
  assert.match(summary.detailLabel, /net::ERR_FAILED/);
  assert.equal(summary.blocking, true);
});
