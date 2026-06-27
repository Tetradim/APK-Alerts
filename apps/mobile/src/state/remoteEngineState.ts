import {
  buildRemoteEngineHealthSnapshot,
  normalizeRemoteHealthPayload,
  normalizeRemoteStatusPayload,
  type RemoteEngineHealth,
  type RemoteEngineHealthSnapshot,
} from "@apk-alerts/contracts";
import {
  checkRemoteEngineHealth,
  type RemoteEngineCheckResult,
  type RemoteEngineClientConfig,
} from "@apk-alerts/sync-client";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export type RemoteTransport = "tailscale" | "same_wifi" | "cloud_relay" | "none";
export type RemoteEngineChecker = (
  config: RemoteEngineClientConfig,
) => Promise<RemoteEngineCheckResult>;

export interface RemoteConnectionDraft {
  baseApiUrl: string;
  apiKey: string;
}

export interface RemoteConnectionSettings extends RemoteConnectionDraft {
  transport: RemoteTransport;
}

export interface RemoteEngineSnapshot {
  connection: RemoteConnectionSettings;
  remote: RemoteEngineHealthSnapshot;
  phoneEngineOnline: boolean;
  checking: boolean;
  lastError: string;
}

export interface RemoteEngineSummary {
  connectionLabel: string;
  remoteHealthLabel: string;
  remoteDetailLabel: string;
  phoneHealthLabel: string;
  alertsLabel: string;
  lastCheckLabel: string;
  errorLabel: string;
}

export interface RemoteEngineState {
  snapshot: RemoteEngineSnapshot;
  activeRequestId: number;
  nextRequestId: number;
  updateConnectionDraft: (draft: RemoteConnectionDraft) => void;
  checkRemote: () => Promise<void>;
}

function parseIpv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number(part));
  return octets.every(
    (octet, index) =>
      String(octet) === parts[index] &&
      Number.isInteger(octet) &&
      octet >= 0 &&
      octet <= 255,
  )
    ? (octets as [number, number, number, number])
    : null;
}

function isTailscaleIpv4([first, second]: [number, number, number, number]): boolean {
  return first === 100 && second >= 64 && second <= 127;
}

function isPrivateOrLoopbackIpv4([first, second]: [number, number, number, number]): boolean {
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function classifyRemoteTransport(baseApiUrl: string): RemoteTransport {
  try {
    const { hostname } = new URL(baseApiUrl);
    const ipv4 = parseIpv4(hostname);
    if (ipv4 && isTailscaleIpv4(ipv4)) {
      return "tailscale";
    }
    if (ipv4 && isPrivateOrLoopbackIpv4(ipv4)) {
      return "same_wifi";
    }
    return "cloud_relay";
  } catch {
    return "none";
  }
}

export function normalizeConnectionDraft(draft: RemoteConnectionDraft): RemoteConnectionDraft {
  return {
    baseApiUrl: draft.baseApiUrl.trim(),
    apiKey: draft.apiKey.trim(),
  };
}

function buildOfflineRemoteSnapshot(): RemoteEngineHealthSnapshot {
  return buildRemoteEngineHealthSnapshot({
    health: normalizeRemoteHealthPayload(null),
    status: normalizeRemoteStatusPayload(null),
    checkedAt: "",
  });
}

function connectionKey(connection: RemoteConnectionSettings): string {
  return `${connection.baseApiUrl}\n${connection.apiKey}`;
}

export function getDefaultRemoteEngineSnapshot(): RemoteEngineSnapshot {
  return {
    connection: {
      baseApiUrl: "",
      apiKey: "",
      transport: "none",
    },
    remote: buildOfflineRemoteSnapshot(),
    phoneEngineOnline: false,
    checking: false,
    lastError: "",
  };
}

function formatTransportLabel(transport: RemoteTransport): string {
  switch (transport) {
    case "tailscale":
      return "Tailscale";
    case "same_wifi":
      return "Same Wi-Fi";
    case "cloud_relay":
      return "Cloud relay";
    case "none":
      return "Not paired";
  }
}

function formatRemoteHealthLabel(health: RemoteEngineHealth): string {
  switch (health) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "unknown":
      return "Unknown";
    case "offline":
      return "Offline";
  }
}

function formatConnectionLabel(connection: RemoteConnectionSettings): string {
  return connection.baseApiUrl ? formatTransportLabel(connection.transport) : "Not paired";
}

export function buildRemoteEngineSummary(snapshot: RemoteEngineSnapshot): RemoteEngineSummary {
  const remote = snapshot.remote;
  const discordLabel = remote.discordConnected ? "Discord connected" : "Discord offline";
  const brokerLabel = remote.brokerConnected ? "Broker connected" : "Broker offline";
  const alertsLabel = `${remote.alertsProcessed} ${
    remote.alertsProcessed === 1 ? "alert" : "alerts"
  } processed`;

  return {
    connectionLabel: formatConnectionLabel(snapshot.connection),
    remoteHealthLabel: formatRemoteHealthLabel(remote.engineHealth),
    remoteDetailLabel: `${remote.activeBroker} - ${discordLabel} - ${brokerLabel}`,
    phoneHealthLabel: snapshot.phoneEngineOnline ? "Phone engine online" : "Phone engine not started",
    alertsLabel,
    lastCheckLabel: remote.checkedAt ? `Checked ${remote.checkedAt}` : "Never checked",
    errorLabel: snapshot.lastError,
  };
}

export function createRemoteEngineStore(checker: RemoteEngineChecker = checkRemoteEngineHealth) {
  return createStore<RemoteEngineState>()((set, get) => ({
    snapshot: getDefaultRemoteEngineSnapshot(),
    activeRequestId: 0,
    nextRequestId: 1,
    updateConnectionDraft: (draft) => {
      const normalized = normalizeConnectionDraft(draft);
      set((state) => ({
        ...state,
        activeRequestId: 0,
        snapshot: {
          ...state.snapshot,
          connection: {
            ...normalized,
            transport: classifyRemoteTransport(normalized.baseApiUrl),
          },
          remote: buildOfflineRemoteSnapshot(),
          checking: false,
          lastError: "",
        },
      }));
    },
    checkRemote: async () => {
      const connection = get().snapshot.connection;
      const requestConnectionKey = connectionKey(connection);
      const requestId = get().nextRequestId;
      set((state) => ({
        ...state,
        activeRequestId: requestId,
        nextRequestId: state.nextRequestId + 1,
        snapshot: {
          ...state.snapshot,
          checking: true,
          lastError: "",
        },
      }));

      const result = await checker({
        baseApiUrl: connection.baseApiUrl,
        apiKey: connection.apiKey,
      });

      set((state) => {
        if (
          state.activeRequestId !== requestId ||
          connectionKey(state.snapshot.connection) !== requestConnectionKey
        ) {
          return state;
        }

        return {
          ...state,
          activeRequestId: 0,
          snapshot: {
            ...state.snapshot,
            checking: false,
            remote: result.snapshot,
            lastError: result.error,
          },
        };
      });
    },
  }));
}

export const remoteEngineStore = createRemoteEngineStore();

export function useRemoteEngineState(): RemoteEngineState;
export function useRemoteEngineState<T>(selector: (state: RemoteEngineState) => T): T;
export function useRemoteEngineState<T>(selector?: (state: RemoteEngineState) => T) {
  return selector ? useStore(remoteEngineStore, selector) : useStore(remoteEngineStore);
}
