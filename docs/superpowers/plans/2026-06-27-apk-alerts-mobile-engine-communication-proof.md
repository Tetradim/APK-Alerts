# APK-Alerts Mobile Engine Communication Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic cockpit evidence proving the Phone and Remote engines are actually communicating through health, lease, transport, and sync signals before mobile reports execution as available.

**Architecture:** The mobile cockpit already receives a normalized operator snapshot with active engine, phone health, remote health, lease, transport, readiness, and sync state. This batch derives a read-only communication proof checklist from that snapshot and renders it in the cockpit. Execution stays fail-closed when communication proof is missing, stale, or contradictory.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node `tsx --test`.

---

### Task 1: Communication Proof Summary

**Files:**
- Modify: `apps/mobile/src/screens/CockpitScreen.test.ts`
- Modify: `apps/mobile/src/state/operatorState.ts`

- [x] **Step 1: Write failing tests**

Add tests for `buildEngineCommunicationProofSummary(snapshot)` covering:
- healthy Phone and Remote engines with a matching active lease, transport, and synced event log;
- stale sync blocks the proof;
- lease holder mismatch blocks the proof;
- missing transport blocks execution even if lease, readiness, and sync are otherwise clear.

- [x] **Step 2: Run focused test to verify failure**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/screens/CockpitScreen.test.ts`

Expected: FAIL because `buildEngineCommunicationProofSummary` is not exported yet.

- [x] **Step 3: Implement minimal summary helper**

Add `EngineCommunicationProofItem`, `EngineCommunicationProofSummary`, and `buildEngineCommunicationProofSummary(snapshot)` to `apps/mobile/src/state/operatorState.ts`. Reuse the same proof in `buildCockpitSummary` so `canExecute` requires clear communication proof.

- [x] **Step 4: Run focused test to verify pass**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/screens/CockpitScreen.test.ts`

Expected: PASS.

### Task 2: Cockpit Communication Panel

**Files:**
- Modify: `apps/mobile/src/screens/CockpitScreen.tsx`

- [x] **Step 1: Render communication proof rows**

Import `buildEngineCommunicationProofSummary` and render a "Communication proof" panel with the gate pill, ready/blocker counts, and rows for phone health, remote health, lease, transport, and sync.

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
git add docs/superpowers/plans/2026-06-27-apk-alerts-mobile-engine-communication-proof.md apps/mobile/src/state/operatorState.ts apps/mobile/src/screens/CockpitScreen.test.ts apps/mobile/src/screens/CockpitScreen.tsx
git commit -m "feat: add mobile engine communication proof"
git push
```
