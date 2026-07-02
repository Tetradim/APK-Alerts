# Sentinel Nexus Mobile Live Arm Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic mobile live-arm checklist that lists every required broker, source, credential, ingestion, replay, reconciliation, exit, runtime, and endpoint gate before any live-money readiness claim is possible.

**Architecture:** Mobile already consumes Sentinel Echo's `/api/operator/live-readiness` endpoint and normalizes it through shared contracts. This batch adds a read-only checklist summary derived from that normalized payload, then renders it on the More tab. The checklist must fail closed when endpoint evidence is missing and must keep endpoint-ready-but-unarmed separate from live-money-ready.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node `tsx --test`.

---

### Task 1: Live Arm Checklist Summary

**Files:**
- Modify: `apps/mobile/src/state/liveReadinessState.test.ts`
- Modify: `apps/mobile/src/state/liveReadinessState.ts`

- [x] **Step 1: Write failing tests**

Add tests for `buildLiveArmChecklistSummary(snapshot)` covering:
- complete passing endpoint plus armed runtime clears every checklist item;
- endpoint-ready but unarmed blocks only the runtime arming item;
- missing endpoint evidence fails closed;
- broker/source/credential/ingestion blockers remain visible as individual checklist rows.

- [x] **Step 2: Run focused test to verify failure**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/liveReadinessState.test.ts`

Expected: FAIL because `buildLiveArmChecklistSummary` is not exported yet.

- [x] **Step 3: Implement minimal checklist helper**

Add `LiveArmChecklistItem`, `LiveArmChecklistSummary`, and `buildLiveArmChecklistSummary(snapshot)` to `apps/mobile/src/state/liveReadinessState.ts`. The helper must derive all rows from the normalized readiness snapshot and mark the whole checklist clear only when every row is non-blocking and `snapshot.remote.liveMoneyReady` is true.

- [x] **Step 4: Run focused test to verify pass**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/liveReadinessState.test.ts`

Expected: PASS.

### Task 2: More Tab Checklist Rendering

**Files:**
- Modify: `apps/mobile/src/screens/MoreScreen.tsx`

- [x] **Step 1: Render checklist rows**

Import `buildLiveArmChecklistSummary` and render a "Live arm checklist" panel with the gate pill, clear/blocker counts, and each checklist row's status/detail. Blocking rows should use the existing error color; clear rows should use normal detail text.

- [x] **Step 2: Verify full batch**

Run:

```bash
npm test
npm run typecheck
git diff --check
```

Expected: all commands pass.

- [x] **Step 3: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-live-arm-checklist.md apps/mobile/src/state/liveReadinessState.ts apps/mobile/src/state/liveReadinessState.test.ts apps/mobile/src/screens/MoreScreen.tsx
git commit -m "feat: add mobile live arm checklist"
git push
```
