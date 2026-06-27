# APK-Alerts Remote Pairing Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real remote-engine connection slice so the Android app can store a Consolidation API target, check `/api/health` and `/api/status`, and render actual phone/remote health without Lab, backtest, replay, fake trades, or demo data.

**Architecture:** Add typed normalization in `@apk-alerts/contracts`, a fetch-injected remote client in `@apk-alerts/sync-client`, and mobile state/view components in `apps/mobile`. The UI stays fail-closed: until a real remote check succeeds, it shows unpaired/offline state and does not imply execution authority.

**Tech Stack:** TypeScript, npm workspaces, Expo Router, React Native, Zustand, Node test runner through `tsx --test`.

---

## File Structure

- Create `packages/contracts/src/remoteHealth.ts`
  - Normalizes Consolidation `/api/health` and `/api/status` payloads.
  - Builds a remote engine health snapshot with strict defaults.
- Create `packages/contracts/src/remoteHealth.test.ts`
  - Covers healthy, degraded, malformed, and null payloads.
- Modify `packages/contracts/src/index.ts`
  - Export remote health contracts.
- Create `packages/sync-client/src/remoteEngineClient.ts`
  - Fetches `/api/health` and `/api/status` from a configured API base URL.
  - Accepts an injected `fetchImpl` for deterministic tests.
  - Adds `X-API-Key` only when the user provided a key.
- Create `packages/sync-client/src/remoteEngineClient.test.ts`
  - Covers URL normalization, auth header behavior, success mapping, HTTP failure mapping, and network failure mapping.
- Modify `packages/sync-client/src/index.ts`
  - Export the remote engine client.
- Create `apps/mobile/src/state/remoteEngineState.ts`
  - Owns in-memory remote connection fields and latest health check result.
  - Provides pure helpers for URL/transport labels and view summaries.
- Create `apps/mobile/src/state/remoteEngineState.test.ts`
  - Covers Tailscale URL classification, invalid URL handling, failed check state, and successful check summary.
- Create `apps/mobile/src/screens/EnginesScreen.tsx`
  - Replaces the current empty Engines tab with real connection inputs and health cards.
- Modify `apps/mobile/app/(tabs)/engines.tsx`
  - Render `EnginesScreen`.
- Optional modify `README.md`
  - Add a short note that remote pairing currently checks Consolidation `/api/health` and `/api/status`.

---

## Task 1: Remote Health Contracts

**Files:**
- Create: `packages/contracts/src/remoteHealth.ts`
- Create: `packages/contracts/src/remoteHealth.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write failing contract tests**

Create `packages/contracts/src/remoteHealth.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemoteEngineHealthSnapshot,
  normalizeRemoteHealthPayload,
  normalizeRemoteStatusPayload,
} from "./index.js";

test("remote health normalizes healthy Consolidation payload", () => {
  const health = normalizeRemoteHealthPayload({
    status: "healthy",
    discord_connected: true,
    broker_connected: true,
  });

  assert.deepEqual(health, {
    status: "healthy",
    discordConnected: true,
    brokerConnected: true,
  });
});

test("remote health degrades unless status and required booleans are healthy", () => {
  assert.equal(
    normalizeRemoteHealthPayload({
      status: "healthy",
      discord_connected: false,
      broker_connected: true,
    }).status,
    "degraded",
  );
  assert.equal(normalizeRemoteHealthPayload(null).status, "offline");
  assert.equal(normalizeRemoteHealthPayload("bad").status, "offline");
});

test("remote status normalizes runtime fields without coercing malformed booleans", () => {
  const status = normalizeRemoteStatusPayload({
    active_broker: "alpaca",
    auto_trading_enabled: true,
    simulation_mode: false,
    shutdown_triggered: "false",
    alerts_processed: 7,
    last_alert_time: "2026-06-27T15:00:00Z",
  });

  assert.equal(status.activeBroker, "alpaca");
  assert.equal(status.autoTradingEnabled, true);
  assert.equal(status.simulationMode, false);
  assert.equal(status.shutdownTriggered, false);
  assert.equal(status.alertsProcessed, 7);
  assert.equal(status.lastAlertTime, "2026-06-27T15:00:00Z");
});

test("remote engine snapshot fails closed when health is degraded or malformed", () => {
  const snapshot = buildRemoteEngineHealthSnapshot({
    health: { status: "degraded", discordConnected: true, brokerConnected: false },
    status: normalizeRemoteStatusPayload({ active_broker: "ibkr" }),
    checkedAt: "2026-06-27T15:00:00Z",
  });

  assert.equal(snapshot.engineHealth, "degraded");
  assert.equal(snapshot.executionReady, false);
  assert.equal(snapshot.activeBroker, "ibkr");
  assert.equal(snapshot.checkedAt, "2026-06-27T15:00:00Z");
});

test("remote engine snapshot is healthy only when health, status, and runtime are ready", () => {
  const snapshot = buildRemoteEngineHealthSnapshot({
    health: normalizeRemoteHealthPayload({
      status: "healthy",
      discord_connected: true,
      broker_connected: true,
    }),
    status: normalizeRemoteStatusPayload({
      active_broker: "ibkr",
      auto_trading_enabled: true,
      simulation_mode: false,
      shutdown_triggered: false,
      alerts_processed: 3,
    }),
    checkedAt: "2026-06-27T15:00:00Z",
  });

  assert.equal(snapshot.engineHealth, "healthy");
  assert.equal(snapshot.executionReady, true);
  assert.equal(snapshot.alertsProcessed, 3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx tsx --test packages/contracts/src/remoteHealth.test.ts
```

Expected: FAIL because `remoteHealth.ts` exports do not exist.

- [ ] **Step 3: Implement remote health contracts**

Create `packages/contracts/src/remoteHealth.ts`:

```ts
export type RemoteEngineHealth = "healthy" | "degraded" | "offline" | "unknown";

export interface NormalizedRemoteHealth {
  status: Exclude<RemoteEngineHealth, "unknown">;
  discordConnected: boolean;
  brokerConnected: boolean;
}

export interface NormalizedRemoteStatus {
  activeBroker: string;
  autoTradingEnabled: boolean;
  simulationMode: boolean;
  shutdownTriggered: boolean;
  alertsProcessed: number;
  lastAlertTime: string;
}

export interface RemoteEngineHealthSnapshot {
  engineHealth: RemoteEngineHealth;
  executionReady: boolean;
  discordConnected: boolean;
  brokerConnected: boolean;
  autoTradingEnabled: boolean;
  simulationMode: boolean;
  shutdownTriggered: boolean;
  activeBroker: string;
  alertsProcessed: number;
  lastAlertTime: string;
  checkedAt: string;
}

interface RemoteEngineSnapshotInput {
  health: NormalizedRemoteHealth;
  status: NormalizedRemoteStatus;
  checkedAt: string;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function exactBoolean(value: unknown, defaultValue = false): boolean {
  return value === true ? true : value === false ? false : defaultValue;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nonnegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function normalizeRemoteHealthPayload(payload: unknown): NormalizedRemoteHealth {
  const input = objectRecord(payload);
  const discordConnected = exactBoolean(input.discord_connected);
  const brokerConnected = exactBoolean(input.broker_connected);
  const rawStatus = text(input.status).toLowerCase();
  const status = rawStatus === "healthy" && discordConnected && brokerConnected
    ? "healthy"
    : rawStatus === "degraded" || discordConnected || brokerConnected
      ? "degraded"
      : "offline";

  return { status, discordConnected, brokerConnected };
}

export function normalizeRemoteStatusPayload(payload: unknown): NormalizedRemoteStatus {
  const input = objectRecord(payload);

  return {
    activeBroker: text(input.active_broker) || "unknown",
    autoTradingEnabled: exactBoolean(input.auto_trading_enabled),
    simulationMode: exactBoolean(input.simulation_mode, true),
    shutdownTriggered: exactBoolean(input.shutdown_triggered),
    alertsProcessed: nonnegativeNumber(input.alerts_processed),
    lastAlertTime: text(input.last_alert_time),
  };
}

export function buildRemoteEngineHealthSnapshot(input: RemoteEngineSnapshotInput): RemoteEngineHealthSnapshot {
  const executionReady =
    input.health.status === "healthy" &&
    input.status.autoTradingEnabled &&
    !input.status.shutdownTriggered;

  return {
    engineHealth: input.health.status,
    executionReady,
    discordConnected: input.health.discordConnected,
    brokerConnected: input.health.brokerConnected,
    autoTradingEnabled: input.status.autoTradingEnabled,
    simulationMode: input.status.simulationMode,
    shutdownTriggered: input.status.shutdownTriggered,
    activeBroker: input.status.activeBroker,
    alertsProcessed: input.status.alertsProcessed,
    lastAlertTime: input.status.lastAlertTime,
    checkedAt: input.checkedAt,
  };
}
```

- [ ] **Step 4: Export contracts**

Add to `packages/contracts/src/index.ts`:

```ts
export * from "./remoteHealth";
```

- [ ] **Step 5: Run contract tests**

Run:

```bash
npx tsx --test packages/contracts/src/remoteHealth.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/remoteHealth.ts packages/contracts/src/remoteHealth.test.ts packages/contracts/src/index.ts
git commit -m "feat: add remote engine health contracts"
```

---

## Task 2: Remote Engine Fetch Client

**Files:**
- Create: `packages/sync-client/src/remoteEngineClient.ts`
- Create: `packages/sync-client/src/remoteEngineClient.test.ts`
- Modify: `packages/sync-client/src/index.ts`

- [ ] **Step 1: Write failing client tests**

Create `packages/sync-client/src/remoteEngineClient.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  checkRemoteEngineHealth,
  normalizeRemoteApiBaseUrl,
  type FetchLike,
} from "./index.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

test("remote API URL normalization accepts root or api URLs", () => {
  assert.equal(normalizeRemoteApiBaseUrl("http://100.90.10.11:8001"), "http://100.90.10.11:8001/api");
  assert.equal(normalizeRemoteApiBaseUrl("http://100.90.10.11:8001/api/"), "http://100.90.10.11:8001/api");
});

test("remote API URL normalization rejects invalid URLs", () => {
  assert.equal(normalizeRemoteApiBaseUrl(""), "");
  assert.equal(normalizeRemoteApiBaseUrl("not a url"), "");
});

test("remote client fetches health and status with optional API key", async () => {
  const calls: Array<{ url: string; headers?: HeadersInit }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers });
    return calls.length === 1
      ? jsonResponse({ status: "healthy", discord_connected: true, broker_connected: true })
      : jsonResponse({
          active_broker: "ibkr",
          auto_trading_enabled: true,
          simulation_mode: false,
          shutdown_triggered: false,
          alerts_processed: 4,
        });
  };

  const result = await checkRemoteEngineHealth({
    baseApiUrl: "http://100.90.10.11:8001",
    apiKey: "secret",
    fetchImpl,
    now: () => "2026-06-27T15:30:00Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.snapshot?.engineHealth, "healthy");
  assert.equal(result.snapshot?.checkedAt, "2026-06-27T15:30:00Z");
  assert.equal(calls[0].url, "http://100.90.10.11:8001/api/health");
  assert.equal(calls[1].url, "http://100.90.10.11:8001/api/status");
  assert.deepEqual(calls[0].headers, { "X-API-Key": "secret" });
});

test("remote client does not send a blank API key header", async () => {
  let headers: HeadersInit | undefined;
  const fetchImpl: FetchLike = async (_url, init) => {
    headers = init?.headers;
    return jsonResponse({});
  };

  await checkRemoteEngineHealth({ baseApiUrl: "http://127.0.0.1:8001/api", fetchImpl });

  assert.deepEqual(headers, {});
});

test("remote client returns offline failure for HTTP and network failures", async () => {
  const httpFailure = await checkRemoteEngineHealth({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => jsonResponse({ detail: "no" }, 503),
  });
  const networkFailure = await checkRemoteEngineHealth({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });

  assert.equal(httpFailure.ok, false);
  assert.equal(httpFailure.snapshot?.engineHealth, "offline");
  assert.match(httpFailure.error, /HTTP 503/);
  assert.equal(networkFailure.ok, false);
  assert.equal(networkFailure.snapshot?.engineHealth, "offline");
  assert.match(networkFailure.error, /network down/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx tsx --test packages/sync-client/src/remoteEngineClient.test.ts
```

Expected: FAIL because the client exports do not exist.

- [ ] **Step 3: Implement fetch client**

Create `packages/sync-client/src/remoteEngineClient.ts`:

```ts
import {
  buildRemoteEngineHealthSnapshot,
  normalizeRemoteHealthPayload,
  normalizeRemoteStatusPayload,
  type RemoteEngineHealthSnapshot,
} from "@apk-alerts/contracts";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface RemoteEngineClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  now?: () => string;
}

export interface RemoteEngineCheckResult {
  ok: boolean;
  snapshot: RemoteEngineHealthSnapshot;
  error: string;
}

export function normalizeRemoteApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/+$/, "");
    if (!url.pathname.endsWith("/api")) {
      url.pathname = `${url.pathname}/api`.replace(/\/+/g, "/");
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function headers(apiKey?: string): HeadersInit {
  const trimmed = apiKey?.trim();
  return trimmed ? { "X-API-Key": trimmed } : {};
}

async function fetchJson(fetchImpl: FetchLike, url: string, apiKey?: string): Promise<unknown> {
  const response = await fetchImpl(url, { headers: headers(apiKey) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

function offlineSnapshot(checkedAt: string): RemoteEngineHealthSnapshot {
  return buildRemoteEngineHealthSnapshot({
    health: normalizeRemoteHealthPayload(null),
    status: normalizeRemoteStatusPayload(null),
    checkedAt,
  });
}

export async function checkRemoteEngineHealth(config: RemoteEngineClientConfig): Promise<RemoteEngineCheckResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const baseApiUrl = normalizeRemoteApiBaseUrl(config.baseApiUrl);
  if (!baseApiUrl) {
    return { ok: false, snapshot: offlineSnapshot(checkedAt), error: "Remote API URL is invalid." };
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    return { ok: false, snapshot: offlineSnapshot(checkedAt), error: "Fetch is not available." };
  }

  try {
    const [healthPayload, statusPayload] = await Promise.all([
      fetchJson(fetchImpl, `${baseApiUrl}/health`, config.apiKey),
      fetchJson(fetchImpl, `${baseApiUrl}/status`, config.apiKey),
    ]);
    const snapshot = buildRemoteEngineHealthSnapshot({
      health: normalizeRemoteHealthPayload(healthPayload),
      status: normalizeRemoteStatusPayload(statusPayload),
      checkedAt,
    });
    return { ok: snapshot.engineHealth !== "offline", snapshot, error: "" };
  } catch (error) {
    return {
      ok: false,
      snapshot: offlineSnapshot(checkedAt),
      error: error instanceof Error ? error.message : "Remote health check failed.",
    };
  }
}
```

- [ ] **Step 4: Export client**

Add to `packages/sync-client/src/index.ts`:

```ts
export * from "./remoteEngineClient";
```

- [ ] **Step 5: Run sync-client tests**

Run:

```bash
npx tsx --test packages/sync-client/src/remoteEngineClient.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/sync-client/src/remoteEngineClient.ts packages/sync-client/src/remoteEngineClient.test.ts packages/sync-client/src/index.ts
git commit -m "feat: add remote engine health client"
```

---

## Task 3: Mobile Remote Engine State

**Files:**
- Create: `apps/mobile/src/state/remoteEngineState.ts`
- Create: `apps/mobile/src/state/remoteEngineState.test.ts`

- [ ] **Step 1: Write failing mobile state tests**

Create `apps/mobile/src/state/remoteEngineState.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildRemoteEngineHealthSnapshot, normalizeRemoteHealthPayload, normalizeRemoteStatusPayload } from "@apk-alerts/contracts";
import {
  buildRemoteEngineSummary,
  classifyRemoteTransport,
  getDefaultRemoteEngineSnapshot,
  normalizeConnectionDraft,
} from "./remoteEngineState.js";

test("remote connection draft normalizes URL and trims API key", () => {
  const draft = normalizeConnectionDraft({
    baseApiUrl: " http://100.90.10.11:8001/ ",
    apiKey: " secret ",
  });

  assert.equal(draft.baseApiUrl, "http://100.90.10.11:8001/");
  assert.equal(draft.apiKey, "secret");
});

test("remote transport classification detects Tailscale, local network, cloud, and invalid URLs", () => {
  assert.equal(classifyRemoteTransport("http://100.90.10.11:8001/api"), "tailscale");
  assert.equal(classifyRemoteTransport("http://192.168.1.40:8001/api"), "same_wifi");
  assert.equal(classifyRemoteTransport("https://relay.example.com/api"), "cloud_relay");
  assert.equal(classifyRemoteTransport("not a url"), "none");
});

test("default remote engine summary is unpaired and offline", () => {
  const summary = buildRemoteEngineSummary(getDefaultRemoteEngineSnapshot());

  assert.equal(summary.connectionLabel, "Not paired");
  assert.equal(summary.remoteHealthLabel, "Offline");
  assert.equal(summary.phoneHealthLabel, "Phone engine not started");
  assert.equal(summary.lastCheckLabel, "Never checked");
});

test("successful remote snapshot summarizes real health details", () => {
  const remote = buildRemoteEngineHealthSnapshot({
    health: normalizeRemoteHealthPayload({
      status: "healthy",
      discord_connected: true,
      broker_connected: true,
    }),
    status: normalizeRemoteStatusPayload({
      active_broker: "alpaca",
      auto_trading_enabled: true,
      simulation_mode: false,
      alerts_processed: 9,
    }),
    checkedAt: "2026-06-27T15:45:00Z",
  });

  const summary = buildRemoteEngineSummary({
    ...getDefaultRemoteEngineSnapshot(),
    connection: {
      baseApiUrl: "http://100.90.10.11:8001/api",
      apiKey: "secret",
      transport: "tailscale",
    },
    remote,
    lastError: "",
  });

  assert.equal(summary.connectionLabel, "Tailscale");
  assert.equal(summary.remoteHealthLabel, "Healthy");
  assert.equal(summary.remoteDetailLabel, "alpaca · Discord connected · Broker connected");
  assert.equal(summary.alertsLabel, "9 alerts processed");
});

test("failed remote snapshot surfaces error and offline summary", () => {
  const summary = buildRemoteEngineSummary({
    ...getDefaultRemoteEngineSnapshot(),
    connection: {
      baseApiUrl: "http://127.0.0.1:8001/api",
      apiKey: "",
      transport: "same_wifi",
    },
    remote: buildRemoteEngineHealthSnapshot({
      health: normalizeRemoteHealthPayload(null),
      status: normalizeRemoteStatusPayload(null),
      checkedAt: "2026-06-27T15:45:00Z",
    }),
    lastError: "HTTP 503",
  });

  assert.equal(summary.connectionLabel, "Same Wi-Fi");
  assert.equal(summary.remoteHealthLabel, "Offline");
  assert.equal(summary.errorLabel, "HTTP 503");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx tsx --test apps/mobile/src/state/remoteEngineState.test.ts
```

Expected: FAIL because `remoteEngineState.ts` does not exist.

- [ ] **Step 3: Implement remote engine state**

Create `apps/mobile/src/state/remoteEngineState.ts`:

```ts
import type { RemoteEngineHealthSnapshot } from "@apk-alerts/contracts";
import { buildRemoteEngineHealthSnapshot, normalizeRemoteHealthPayload, normalizeRemoteStatusPayload } from "@apk-alerts/contracts";
import { checkRemoteEngineHealth } from "@apk-alerts/sync-client";
import { create } from "zustand";

export type RemoteTransport = "tailscale" | "same_wifi" | "cloud_relay" | "none";

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

export function classifyRemoteTransport(baseApiUrl: string): RemoteTransport {
  try {
    const host = new URL(baseApiUrl).hostname;
    const parts = host.split(".").map((part) => Number(part));
    if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      const [first, second] = parts;
      if (first === 100 && second >= 64 && second <= 127) {
        return "tailscale";
      }
      if (first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || host === "127.0.0.1") {
        return "same_wifi";
      }
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

function offlineRemoteSnapshot(): RemoteEngineHealthSnapshot {
  return buildRemoteEngineHealthSnapshot({
    health: normalizeRemoteHealthPayload(null),
    status: normalizeRemoteStatusPayload(null),
    checkedAt: "",
  });
}

export function getDefaultRemoteEngineSnapshot(): RemoteEngineSnapshot {
  return {
    connection: { baseApiUrl: "", apiKey: "", transport: "none" },
    remote: offlineRemoteSnapshot(),
    phoneEngineOnline: false,
    checking: false,
    lastError: "",
  };
}

function titleHealth(health: RemoteEngineHealthSnapshot["engineHealth"]): string {
  return health === "healthy" ? "Healthy" : health === "degraded" ? "Degraded" : health === "unknown" ? "Unknown" : "Offline";
}

function transportLabel(transport: RemoteTransport): string {
  return transport === "tailscale"
    ? "Tailscale"
    : transport === "same_wifi"
      ? "Same Wi-Fi"
      : transport === "cloud_relay"
        ? "Cloud relay"
        : "Not paired";
}

export function buildRemoteEngineSummary(snapshot: RemoteEngineSnapshot): RemoteEngineSummary {
  const remote = snapshot.remote;
  const discord = remote.discordConnected ? "Discord connected" : "Discord offline";
  const broker = remote.brokerConnected ? "Broker connected" : "Broker offline";
  const alertsLabel = `${remote.alertsProcessed} ${remote.alertsProcessed === 1 ? "alert" : "alerts"} processed`;

  return {
    connectionLabel: transportLabel(snapshot.connection.transport),
    remoteHealthLabel: titleHealth(remote.engineHealth),
    remoteDetailLabel: `${remote.activeBroker} · ${discord} · ${broker}`,
    phoneHealthLabel: snapshot.phoneEngineOnline ? "Phone engine online" : "Phone engine not started",
    alertsLabel,
    lastCheckLabel: remote.checkedAt ? `Checked ${remote.checkedAt}` : "Never checked",
    errorLabel: snapshot.lastError,
  };
}

interface RemoteEngineState {
  snapshot: RemoteEngineSnapshot;
  updateConnectionDraft: (draft: RemoteConnectionDraft) => void;
  checkRemote: () => Promise<void>;
}

export const useRemoteEngineState = create<RemoteEngineState>((set, get) => ({
  snapshot: getDefaultRemoteEngineSnapshot(),
  updateConnectionDraft: (draft) => {
    const normalized = normalizeConnectionDraft(draft);
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        connection: {
          ...normalized,
          transport: classifyRemoteTransport(normalized.baseApiUrl),
        },
        lastError: "",
      },
    }));
  },
  checkRemote: async () => {
    const { connection } = get().snapshot;
    set((state) => ({ snapshot: { ...state.snapshot, checking: true, lastError: "" } }));
    const result = await checkRemoteEngineHealth({
      baseApiUrl: connection.baseApiUrl,
      apiKey: connection.apiKey,
    });
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        checking: false,
        remote: result.snapshot,
        lastError: result.error,
      },
    }));
  },
}));
```

- [ ] **Step 4: Run mobile state tests**

Run:

```bash
npx tsx --test apps/mobile/src/state/remoteEngineState.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/state/remoteEngineState.ts apps/mobile/src/state/remoteEngineState.test.ts
git commit -m "feat: add mobile remote engine state"
```

---

## Task 4: Engines Screen UI

**Files:**
- Create: `apps/mobile/src/screens/EnginesScreen.tsx`
- Modify: `apps/mobile/app/(tabs)/engines.tsx`
- Optional modify: `README.md`

- [ ] **Step 1: Implement real Engines screen**

Create `apps/mobile/src/screens/EnginesScreen.tsx`:

```tsx
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MetricTile } from "@/components/MetricTile";
import { ScreenFrame } from "@/components/ScreenFrame";
import { StatusPill } from "@/components/StatusPill";
import { buildRemoteEngineSummary, useRemoteEngineState } from "@/state/remoteEngineState";

function healthTone(label: string): "good" | "warn" | "bad" | "neutral" {
  return label === "Healthy" ? "good" : label === "Degraded" ? "warn" : label === "Offline" ? "bad" : "neutral";
}

export function EnginesScreen() {
  const snapshot = useRemoteEngineState((state) => state.snapshot);
  const updateConnectionDraft = useRemoteEngineState((state) => state.updateConnectionDraft);
  const checkRemote = useRemoteEngineState((state) => state.checkRemote);
  const summary = buildRemoteEngineSummary(snapshot);

  return (
    <ScreenFrame title="Engines" eyebrow="APK-Alerts">
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.label}>Connection</Text>
          <Text style={styles.heading}>{summary.connectionLabel}</Text>
        </View>
        <StatusPill label={summary.remoteHealthLabel} tone={healthTone(summary.remoteHealthLabel)} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Remote Consolidation API</Text>
        <TextInput
          value={snapshot.connection.baseApiUrl}
          onChangeText={(baseApiUrl) => updateConnectionDraft({ baseApiUrl, apiKey: snapshot.connection.apiKey })}
          placeholder="http://100.x.x.x:8001/api"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
          style={styles.input}
        />
        <TextInput
          value={snapshot.connection.apiKey}
          onChangeText={(apiKey) => updateConnectionDraft({ baseApiUrl: snapshot.connection.baseApiUrl, apiKey })}
          placeholder="API key if required"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: snapshot.checking }}
          disabled={snapshot.checking}
          onPress={() => void checkRemote()}
          style={[styles.button, snapshot.checking ? styles.buttonDisabled : null]}
        >
          <Text style={styles.buttonText}>{snapshot.checking ? "Checking" : "Check Remote"}</Text>
        </Pressable>
      </View>

      <View style={styles.tileRow}>
        <MetricTile label="Phone" value={summary.phoneHealthLabel} detail="Foreground service will own lease when engine is running" />
        <MetricTile label="Remote" value={summary.remoteHealthLabel} detail={summary.remoteDetailLabel} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Last health check</Text>
        <Text style={styles.value}>{summary.lastCheckLabel}</Text>
        <Text style={styles.detail}>{summary.alertsLabel}</Text>
        {summary.errorLabel ? <Text style={styles.error}>{summary.errorLabel}</Text> : null}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#94a3b8", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  heading: { color: "#f8fafc", fontSize: 24, fontWeight: "900", marginTop: 4 },
  panel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  panelTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  input: {
    backgroundColor: "#020617",
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f8fafc",
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  button: { alignItems: "center", backgroundColor: "#2563eb", borderRadius: 8, minHeight: 48, justifyContent: "center" },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  tileRow: { flexDirection: "row", gap: 10 },
  value: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 4 },
  detail: { color: "#94a3b8", fontSize: 13 },
  error: { color: "#fca5a5", fontSize: 13, fontWeight: "800" },
});
```

- [ ] **Step 2: Wire the route**

Replace `apps/mobile/app/(tabs)/engines.tsx` with:

```tsx
import { EnginesScreen } from "@/screens/EnginesScreen";

export default function EnginesRoute() {
  return <EnginesScreen />;
}
```

- [ ] **Step 3: Update README note**

Add a short bullet under the implemented foundation section:

```md
- Engines tab can check a configured remote Consolidation API through `/api/health` and `/api/status`; it fails closed until a real endpoint responds.
```

- [ ] **Step 4: Run verification**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run Expo web smoke**

Run Expo web on a free local port:

```bash
npm run mobile:web -- --port 3004
```

Then verify with Playwright or browser automation:

- `/` renders.
- The tabs include Cockpit, Alerts, Positions, Engines, Settings, More.
- There is no Lab tab.
- Engines tab renders `Remote Consolidation API`, URL input, API key input, `Check Remote`, Phone card, Remote card.
- With a bad URL, pressing `Check Remote` keeps the remote state offline and shows an error rather than fake health.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/EnginesScreen.tsx "apps/mobile/app/(tabs)/engines.tsx" README.md
git commit -m "feat: add remote engines screen"
```

---

## Self-Review Checklist

- [ ] No Lab/backtest/replay routes or screens are added.
- [ ] No sample trades, fake alerts, or demo modes are introduced.
- [ ] Remote health is derived only from real `/api/health` and `/api/status` responses.
- [ ] Invalid, null, HTTP error, and network failure states fail closed to offline.
- [ ] Tailscale is first-class in transport labeling through `100.64.0.0/10` detection.
- [ ] API key is optional and only sent when nonblank.
- [ ] Mobile UI has 48px minimum touch targets and readable dark-mode contrast.
- [ ] `npm test`, `npm run typecheck`, and web smoke pass before closing the slice.
