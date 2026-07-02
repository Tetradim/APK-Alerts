# Sentinel Nexus Mobile Live Readiness Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed mobile live-readiness gate that consumes Sentinel Echo `/api/operator/live-readiness` before any future live controls can claim readiness.

**Architecture:** Shared contracts normalize Sentinel Echo's readiness payload into strict sections for broker, source policy, signal ingestion, credentials, runtime arming, replay acceptance, reconciliation, and OCO exits. The sync client fetches the endpoint with the same remote API target and API key pattern. The mobile More tab displays readiness evidence only; it does not arm trading, place orders, or assert live-money readiness without the endpoint passing.

**Tech Stack:** TypeScript, npm workspaces, Expo Router, React Native, Zustand, Node `tsx --test`, existing Sentinel Echo `/api/operator/live-readiness`.

---

## File Structure

- Create `packages/contracts/src/liveReadiness.ts`
  - Normalizes readiness response sections and exposes `canClaimLiveReady`.
- Create `packages/contracts/src/liveReadiness.test.ts`
  - Verifies passing, blocking, malformed, and missing-section payloads fail closed.
- Modify `packages/contracts/src/index.ts`
  - Exports live-readiness contracts.
- Create `packages/sync-client/src/remoteLiveReadinessClient.ts`
  - Fetches `/api/operator/live-readiness`.
- Create `packages/sync-client/src/remoteLiveReadinessClient.test.ts`
  - Verifies endpoint URL, API key behavior, and fail-closed network/HTTP handling.
- Modify `packages/sync-client/src/index.ts`
  - Exports the live-readiness client without conflicting type exports.
- Create `apps/mobile/src/state/liveReadinessState.ts`
  - Stores readiness snapshot, clears stale data on connection edits, and builds display summaries.
- Create `apps/mobile/src/state/liveReadinessState.test.ts`
  - Verifies default blocked state, endpoint-ready summary, blocker summary, and stale connection clearing.
- Create `apps/mobile/src/screens/MoreScreen.tsx`
  - Replaces the empty More tab with readiness evidence cards.
- Modify `apps/mobile/app/(tabs)/more.tsx`
  - Renders `MoreScreen`.
- Modify `README.md`
  - Documents the live-readiness endpoint boundary.

## Task 1: Readiness Contract

- [ ] **Step 1: Write failing contract tests**

Run:

```powershell
npm --workspace @sentinel-nexus/contracts test -- src/liveReadiness.test.ts
```

Expected: FAIL because `liveReadiness.ts` does not exist.

- [ ] **Step 2: Implement strict normalization**

Implement:
- `normalizeLiveReadinessPayload(input)`
- `canClaimLiveReady(readiness)`

Malformed payloads must return `readyForLive=false`, `canClaimLiveReady=false`, and a `readiness_payload_invalid` blocking code.

- [ ] **Step 3: Verify contract tests**

Run:

```powershell
npm --workspace @sentinel-nexus/contracts test -- src/liveReadiness.test.ts
```

Expected: PASS.

## Task 2: Remote Readiness Client

- [ ] **Step 1: Write failing sync-client tests**

Run:

```powershell
npm --workspace @sentinel-nexus/sync-client test -- src/remoteLiveReadinessClient.test.ts
```

Expected: FAIL because `remoteLiveReadinessClient.ts` does not exist.

- [ ] **Step 2: Implement endpoint client**

Fetch only `/api/operator/live-readiness`. Do not add fallback endpoints.

- [ ] **Step 3: Verify sync-client tests**

Run:

```powershell
npm --workspace @sentinel-nexus/sync-client test -- src/remoteLiveReadinessClient.test.ts
```

Expected: PASS.

## Task 3: Mobile State And More Screen

- [ ] **Step 1: Write failing mobile tests**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile test -- src/state/liveReadinessState.test.ts
```

Expected: FAIL because `liveReadinessState.ts` does not exist.

- [ ] **Step 2: Implement state and UI**

The More tab must show:
- ready/blocked label from normalized endpoint result;
- blocking issue codes/messages;
- broker/source/signal/replay/reconciliation/OCO/runtime summaries;
- refresh control using the stored remote API URL/key.

- [ ] **Step 3: Verify mobile tests**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile test -- src/state/liveReadinessState.test.ts
```

Expected: PASS.

## Task 4: Full Verification, Commit, Push

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm test
npm run typecheck
git diff --check
```

- [ ] **Step 2: Commit and push**

Commit message:

```text
feat: add mobile live readiness gate
```

## Self-Review

- Spec coverage: This batch covers live-arm checklist visibility and the rule that mobile cannot claim live-money readiness without the live-readiness endpoint passing broker/source/credential/arming checks. It does not add arming, order placement, broker reconciliation, OCO order creation, or risk tuning.
- Placeholder scan: No implementation placeholder is required for this narrow batch.
- Type consistency: Contract, client, state, and UI share `LiveReadiness` naming.
