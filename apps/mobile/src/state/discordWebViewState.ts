import {
  normalizeDiscordIngestionSettings,
  type DiscordIngestionSettingsInput,
} from "@apk-alerts/contracts";

export type DiscordWebViewStatus = "disabled" | "loading" | "slow" | "ready" | "error";

export interface DiscordWebViewLoadState {
  loading: boolean;
  error: string;
  timedOut?: boolean;
}

export interface DiscordWebViewUiState {
  status: DiscordWebViewStatus;
  renderWebView: boolean;
  titleLabel: string;
  detailLabel: string;
  canRetry: boolean;
}

export function buildDiscordWebViewUiState(
  settings: DiscordIngestionSettingsInput,
  loadState: DiscordWebViewLoadState,
): DiscordWebViewUiState {
  const normalized = normalizeDiscordIngestionSettings(settings);
  if (!normalized.webViewEnabled) {
    return {
      status: "disabled",
      renderWebView: false,
      titleLabel: "Discord WebView disabled",
      detailLabel: "Embedded Discord is disabled in Settings.",
      canRetry: false,
    };
  }

  if (loadState.error) {
    return {
      status: "error",
      renderWebView: false,
      titleLabel: "Discord unavailable",
      detailLabel: loadState.error,
      canRetry: true,
    };
  }

  if (loadState.timedOut) {
    return {
      status: "slow",
      renderWebView: true,
      titleLabel: "Discord still loading",
      detailLabel: "Discord is taking longer than usual to finish loading.",
      canRetry: true,
    };
  }

  return {
    status: loadState.loading ? "loading" : "ready",
    renderWebView: true,
    titleLabel: loadState.loading ? "Loading Discord" : "Discord WebView",
    detailLabel: loadState.loading ? "Connecting to Discord web." : "Discord web client loaded.",
    canRetry: true,
  };
}
