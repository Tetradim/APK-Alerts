# Mobile Bridge Supervisor Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Chrome/Discord bridge supervisor and restart-backoff evidence in the mobile Alerts tab.

**Architecture:** Consolidation's bridge health endpoint stores service-worker and content-script supervisor details in `last_heartbeat.details`. Shared contracts will normalize those details fail-closed, and mobile will derive an operator display summary from the existing alert evidence snapshot. This batch is read-only and must not restart Chrome, modify extension settings, place orders, or claim live-money readiness.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node test runner.

---

### Task 1: Bridge Supervisor Contract

**Files:**
- Modify: `packages/contracts/src/bridgeEvidence.test.ts`
- Modify: `packages/contracts/src/bridgeEvidence.ts`

- [ ] **Step 1: Write failing contract tests**

Add tests showing `normalizeBridgeHealthPayload()` extracts supervisor state, reason, failure list, tab counts, restart count, and next retry timestamp from `last_heartbeat.details`.

- [ ] **Step 2: Run contract tests to verify failure**

Run: `npm --workspace @apk-alerts/contracts exec -- tsx --test src/bridgeEvidence.test.ts`

Expected: FAIL because `health.supervisor` is not normalized yet.

- [ ] **Step 3: Implement minimal contract normalizer**

Add `BridgeSupervisorHealth` and derive it from bridge health plus heartbeat details. Classify `ok` as healthy, `disabled` as disabled, `restart_error`, `forward_error`, `no_discord_tabs`, and `no_matching_discord_tabs` as backoff, unhealthy non-backoff states as attention, and missing heartbeat as unknown.

- [ ] **Step 4: Run contract tests to verify pass**

Run: `npm --workspace @apk-alerts/contracts exec -- tsx --test src/bridgeEvidence.test.ts`

Expected: PASS.

### Task 2: Mobile Supervisor Summary

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [ ] **Step 1: Write failing mobile state tests**

Add tests for `buildBridgeSupervisorSummary(snapshot)` covering healthy service-worker supervision, restart-backoff evidence, disabled supervisor evidence, and missing heartbeat.

- [ ] **Step 2: Run mobile state tests to verify failure**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because `buildBridgeSupervisorSummary` is not exported yet.

- [ ] **Step 3: Implement minimal mobile summary helper**

Add `BridgeSupervisorDisplaySummary` and `buildBridgeSupervisorSummary(snapshot)`. It should surface state, gate label, reason, tab counts, failure evidence, next retry, and a blocking flag.

- [ ] **Step 4: Run mobile state tests to verify pass**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: PASS.

### Task 3: Alerts Tab Evidence Panel

**Files:**
- Modify: `apps/mobile/src/screens/AlertsScreen.tsx`

- [ ] **Step 1: Render read-only supervisor/backoff evidence**

Import `buildBridgeSupervisorSummary(snapshot)` and render an Alerts tab panel with supervisor state, gate label, reason, tab counts, failures, and backoff timing.

- [ ] **Step 2: Verify full batch**

Run:

```bash
npm test
npm run typecheck
git diff --check
```

Expected: all commands pass.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-27-apk-alerts-mobile-bridge-supervisor-evidence.md packages/contracts/src/bridgeEvidence.ts packages/contracts/src/bridgeEvidence.test.ts apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts apps/mobile/src/screens/AlertsScreen.tsx
git commit -m "feat: add mobile bridge supervisor evidence"
git push
```
