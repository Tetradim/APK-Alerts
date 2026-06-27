# APK-Alerts Mobile Alert Evidence Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile-side evidence spine that proves Chrome/Discord alerts are seen, parsed, policy-checked, audited, and surfaced in APK-Alerts without enabling live-money claims.

**Architecture:** APK-Alerts will mirror Consolidation's existing Chrome bridge evidence contract instead of inventing a new protocol. Shared contracts will normalize bridge bus events, operator audit decisions, and bridge health fail-closed; the sync client will read Consolidation's event endpoints; the Alerts tab will show the latest auditable alert chain from real remote data or an empty state.

**Tech Stack:** TypeScript, npm workspaces, Expo Router, React Native, Zustand, Node `tsx --test`, existing Consolidation `/api/bus/events`, `/api/operator/events`, and `/api/discord/chrome-bridge/health` endpoints.

---

## File Structure

- Create `packages/contracts/src/bridgeEvidence.ts`
  - Defines the Chrome bridge contract version, parser-confidence levels, source policy proof, normalized bridge signal, normalized audit decision, normalized bridge health, and alert evidence chain helpers.
- Create `packages/contracts/src/bridgeEvidence.test.ts`
  - Tests accepted, skipped, duplicate, malformed, and stale bridge evidence normalization using fixtures derived from Consolidation's existing tests.
- Modify `packages/contracts/src/index.ts`
  - Exports the bridge evidence contract.
- Create `packages/sync-client/src/remoteEvidenceClient.ts`
  - Reads `/api/bus/events`, `/api/operator/events`, and `/api/discord/chrome-bridge/health` with the same API key/header behavior as remote health.
- Create `packages/sync-client/src/remoteEvidenceClient.test.ts`
  - Tests endpoint URLs, headers, fail-closed errors, and evidence chain assembly.
- Modify `packages/sync-client/src/index.ts`
  - Exports the evidence reader.
- Create `apps/mobile/src/state/alertEvidenceState.ts`
  - Stores remote alert evidence snapshot, handles connection staleness, and builds display summaries.
- Create `apps/mobile/src/state/alertEvidenceState.test.ts`
  - Tests summary labels and fail-closed states.
- Create `apps/mobile/src/screens/AlertsScreen.tsx`
  - Replaces the empty Alerts tab with real alert evidence cards and bridge health status.
- Modify `apps/mobile/app/(tabs)/alerts.tsx`
  - Renders `AlertsScreen`.
- Update `README.md`
  - Documents that Alerts reads real Consolidation evidence and does not simulate trades.

## Task 1: Bridge Evidence Contracts

**Files:**
- Create: `packages/contracts/src/bridgeEvidence.ts`
- Create: `packages/contracts/src/bridgeEvidence.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write failing normalization tests**

Write tests that import `normalizeBridgeSignalEvent`, `normalizeBridgeAlertDecisionEvent`, `normalizeBridgeHealthPayload`, and `buildAlertEvidenceChains`.

The tests must cover:
- accepted `signal.observed` plus matching `bridge_alert_decision`;
- skipped low-confidence alert with source-policy proof;
- malformed input normalizes to an empty rejected shape instead of throwing;
- disabled/stale bridge health is unhealthy;
- duplicate events remain visible but are not executable evidence.

Run:

```powershell
npm --workspace @apk-alerts/contracts test -- src/bridgeEvidence.test.ts
```

Expected: FAIL because `bridgeEvidence.ts` does not exist.

- [ ] **Step 2: Implement bridge evidence contracts**

Create the contract types and normalizers. Keep parsing strict and boring:
- Unknown confidence becomes `none`.
- Missing booleans default to `false`.
- Unknown status becomes `unknown`.
- Missing arrays become empty arrays.
- Missing event ids become empty strings.
- The evidence chain is keyed by `event_id`, `correlation_id`, or audit detail event id, in that order.

- [ ] **Step 3: Verify contract tests pass**

Run:

```powershell
npm --workspace @apk-alerts/contracts test -- src/bridgeEvidence.test.ts
```

Expected: PASS.

## Task 2: Remote Evidence Client

**Files:**
- Create: `packages/sync-client/src/remoteEvidenceClient.ts`
- Create: `packages/sync-client/src/remoteEvidenceClient.test.ts`
- Modify: `packages/sync-client/src/index.ts`

- [ ] **Step 1: Write failing remote client tests**

Write tests for:
- `normalizeRemoteEvidenceBaseUrl` accepts root or `/api` URLs;
- the client fetches `/bus/events`, `/operator/events`, and `/discord/chrome-bridge/health`;
- blank API key is omitted;
- HTTP/network failures return `ok: false`, empty evidence, and unhealthy bridge status;
- matching signal/audit events produce one alert evidence chain.

Run:

```powershell
npm --workspace @apk-alerts/sync-client test -- src/remoteEvidenceClient.test.ts
```

Expected: FAIL because `remoteEvidenceClient.ts` does not exist.

- [ ] **Step 2: Implement remote evidence client**

Use the existing remote health client's fetch pattern. Do not add retry loops or alternate endpoints in this batch. Fail closed with empty evidence if any required endpoint fails.

- [ ] **Step 3: Verify sync-client tests pass**

Run:

```powershell
npm --workspace @apk-alerts/sync-client test -- src/remoteEvidenceClient.test.ts
```

Expected: PASS.

## Task 3: Mobile Alert Evidence State And UI

**Files:**
- Create: `apps/mobile/src/state/alertEvidenceState.ts`
- Create: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Create: `apps/mobile/src/screens/AlertsScreen.tsx`
- Modify: `apps/mobile/app/(tabs)/alerts.tsx`

- [ ] **Step 1: Write failing mobile state tests**

Write tests for:
- default state is unpaired and has no invented alert data;
- accepted alert summarizes as accepted but not live-ready;
- skipped alert surfaces parser/source skip reason;
- bridge health issues surface as an operator warning;
- connection edits clear stale evidence.

Run:

```powershell
npm --workspace @apk-alerts/mobile test -- src/state/alertEvidenceState.test.ts
```

Expected: FAIL because `alertEvidenceState.ts` does not exist.

- [ ] **Step 2: Implement mobile state and Alerts screen**

Create a Zustand store and summary helpers. The UI should show:
- bridge health status and issues;
- refresh control using the stored Remote API URL and key;
- latest alert evidence cards with raw text, parsed contract, confidence, source proof, decision, skip reason, and audit ids;
- empty state when no real paired evidence is available.

- [ ] **Step 3: Verify mobile tests pass**

Run:

```powershell
npm --workspace @apk-alerts/mobile test -- src/state/alertEvidenceState.test.ts
```

Expected: PASS.

## Task 4: Full Verification, Commit, Push

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Document that the mobile Alerts tab consumes Consolidation evidence from:
- `/api/bus/events`
- `/api/operator/events`
- `/api/discord/chrome-bridge/health`

State that the mobile app does not simulate alerts and does not claim live-money readiness.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run typecheck
git status --short
```

Expected:
- all workspace tests pass;
- all workspace typechecks pass;
- only intentional files are changed.

- [ ] **Step 3: Commit and push**

Run:

```powershell
git add README.md docs/superpowers/plans/2026-06-27-apk-alerts-mobile-alert-evidence-spine.md packages/contracts/src packages/sync-client/src apps/mobile/src apps/mobile/app/(tabs)/alerts.tsx
git commit -m "feat: add mobile alert evidence spine"
git push
```

Expected: push succeeds to `origin/main`.

## Self-Review

- Spec coverage: This batch covers unified Chrome bridge evidence contracts, strict source/channel/author proof display, parser confidence gates, alert audit trail visibility, bridge health visibility, weak fallback removal for missing evidence, and silent endpoint-level alert testing. It does not implement broker reconciliation, live-arm/OCO, deterministic historical replay, risk profitability tuning, or physical Edge testing; those remain later batches after this spine exists.
- Placeholder scan: No placeholder implementation steps are present.
- Type consistency: Contract names are shared across contract, sync-client, and mobile state tasks.
