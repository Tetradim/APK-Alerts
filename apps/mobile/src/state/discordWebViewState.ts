import {
  normalizeDiscordIngestionSettings,
  type DiscordIngestionSettingsInput,
} from "@apk-alerts/contracts";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

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

export interface DiscordWebViewHealthSnapshot {
  lastLoadStartedAt: string;
  lastLoadedAt: string;
  lastErrorAt: string;
  lastError: string;
  lastTimedOutAt: string;
  reloadCount: number;
  loading: boolean;
}

export interface DiscordWebViewHealthSummary {
  statusLabel: string;
  detailLabel: string;
  reloadLabel: string;
  blocking: boolean;
}

export interface DiscordWebViewHealthState {
  snapshot: DiscordWebViewHealthSnapshot;
  recordLoadStart: () => void;
  recordLoadEnd: () => void;
  recordError: (error: string) => void;
  recordTimeout: () => void;
  recordReload: () => void;
  clearHealth: () => void;
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

export function getDefaultDiscordWebViewHealthSnapshot(): DiscordWebViewHealthSnapshot {
  return {
    lastLoadStartedAt: "",
    lastLoadedAt: "",
    lastErrorAt: "",
    lastError: "",
    lastTimedOutAt: "",
    reloadCount: 0,
    loading: false,
  };
}

export function buildDiscordWebViewHealthSummary(
  snapshot: DiscordWebViewHealthSnapshot,
): DiscordWebViewHealthSummary {
  if (snapshot.lastError) {
    return {
      statusLabel: "WebView error",
      detailLabel: `${snapshot.lastErrorAt || "unknown"} - ${snapshot.lastError}`,
      reloadLabel: `${snapshot.reloadCount} reload attempt(s)`,
      blocking: true,
    };
  }

  if (snapshot.lastTimedOutAt) {
    return {
      statusLabel: "WebView slow",
      detailLabel: `Timed out ${snapshot.lastTimedOutAt}`,
      reloadLabel: `${snapshot.reloadCount} reload attempt(s)`,
      blocking: true,
    };
  }

  if (snapshot.lastLoadedAt) {
    return {
      statusLabel: "WebView loaded",
      detailLabel: `Loaded ${snapshot.lastLoadedAt}`,
      reloadLabel: `${snapshot.reloadCount} reload attempt(s)`,
      blocking: false,
    };
  }

  if (snapshot.loading) {
    return {
      statusLabel: "WebView loading",
      detailLabel: `Started ${snapshot.lastLoadStartedAt || "unknown"}`,
      reloadLabel: `${snapshot.reloadCount} reload attempt(s)`,
      blocking: true,
    };
  }

  return {
    statusLabel: "WebView not loaded",
    detailLabel: "No Discord WebView load evidence yet.",
    reloadLabel: `${snapshot.reloadCount} reload attempt(s)`,
    blocking: true,
  };
}

export function createDiscordWebViewHealthStore(now: () => string = () => new Date().toISOString()) {
  return createStore<DiscordWebViewHealthState>()((set) => ({
    snapshot: getDefaultDiscordWebViewHealthSnapshot(),
    recordLoadStart: () =>
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          lastLoadStartedAt: now(),
          lastError: "",
          lastTimedOutAt: "",
          loading: true,
        },
      })),
    recordLoadEnd: () =>
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          lastLoadedAt: now(),
          lastError: "",
          lastTimedOutAt: "",
          loading: false,
        },
      })),
    recordError: (error) =>
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          lastErrorAt: now(),
          lastError: error.trim() || "Discord WebView failed to load.",
          loading: false,
        },
      })),
    recordTimeout: () =>
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          lastTimedOutAt: now(),
          loading: false,
        },
      })),
    recordReload: () =>
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          reloadCount: state.snapshot.reloadCount + 1,
        },
      })),
    clearHealth: () => set({ snapshot: getDefaultDiscordWebViewHealthSnapshot() }),
  }));
}

export const discordWebViewHealthStore = createDiscordWebViewHealthStore();

export function useDiscordWebViewHealthState(): DiscordWebViewHealthState;
export function useDiscordWebViewHealthState<T>(selector: (state: DiscordWebViewHealthState) => T): T;
export function useDiscordWebViewHealthState<T>(selector?: (state: DiscordWebViewHealthState) => T) {
  return selector ? useStore(discordWebViewHealthStore, selector) : useStore(discordWebViewHealthStore);
}
