import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DISCORD_INGESTION_SETTINGS } from "@apk-alerts/contracts";
import { buildDiscordWebViewUiState } from "./discordWebViewState.js";

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
