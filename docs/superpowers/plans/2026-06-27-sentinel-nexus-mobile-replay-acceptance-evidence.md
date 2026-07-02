# Mobile Replay Acceptance Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make deterministic replay acceptance proof inspectable in the mobile app without adding a Lab tab or replay runner.

**Architecture:** The existing live-readiness endpoint already carries the replay acceptance proof. Mobile will derive a strict display summary from that normalized payload and render it as read-only evidence in the More tab. Missing, failed, or incomplete replay proof remains blocking and must never be described as live-money ready.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node test runner.

---

### Task 1: Replay Evidence Summary

**Files:**
- Modify: `apps/mobile/src/state/liveReadinessState.test.ts`
- Modify: `apps/mobile/src/state/liveReadinessState.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that import `buildReplayAcceptanceEvidenceSummary`, assert passing proof is non-blocking, failed/missing event IDs are listed, and empty proof blocks live readiness.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/liveReadinessState.test.ts`

Expected: FAIL because `buildReplayAcceptanceEvidenceSummary` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

Add `ReplayAcceptanceEvidenceSummary` and `buildReplayAcceptanceEvidenceSummary(snapshot)` in `apps/mobile/src/state/liveReadinessState.ts`. It should derive labels from `snapshot.remote.readiness.checks.simulationReplay`, require passed status, expected count, matching pass count, zero failed/missing event evidence, `updatedAt`, and `replayUrl`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/liveReadinessState.test.ts`

Expected: PASS.

### Task 2: More Tab Evidence Panel

**Files:**
- Modify: `apps/mobile/src/screens/MoreScreen.tsx`

- [ ] **Step 1: Render read-only replay evidence**

Use `buildReplayAcceptanceEvidenceSummary(snapshot)` and add a More tab panel for replay status, gate label, accepted counts, proof timestamp/URL, failed events, and missing events.

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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-replay-acceptance-evidence.md apps/mobile/src/state/liveReadinessState.ts apps/mobile/src/state/liveReadinessState.test.ts apps/mobile/src/screens/MoreScreen.tsx
git commit -m "feat: add mobile replay acceptance evidence"
git push
```
