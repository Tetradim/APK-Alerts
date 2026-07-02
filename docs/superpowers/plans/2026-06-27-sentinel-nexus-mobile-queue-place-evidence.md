# Mobile Queue Place Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make alert insert and trade-request queue/place evidence inspectable on each mobile alert evidence card.

**Architecture:** Sentinel Echo's bridge ingestion decision already reports whether an alert was inserted, which alert ID was created, whether a trade request was queued/requested, and why execution did or did not proceed. Mobile will derive a fail-closed display summary from each alert chain and render it as evidence only. This batch must not place broker orders, arm trading, or claim live-money readiness.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node test runner.

---

### Task 1: Queue/Place Display Summary

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [ ] **Step 1: Write failing tests**

Add tests for `buildQueuePlaceEvidenceSummary(chain)` covering:
- audited accepted alert inserted and trade request queued;
- audited accepted alert inserted but not queued because execution is disabled;
- skipped alert not inserted and not queued;
- missing proof fails closed.

- [ ] **Step 2: Run focused test to verify failure**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because `buildQueuePlaceEvidenceSummary` is not exported yet.

- [ ] **Step 3: Implement minimal summary helper**

Add `QueuePlaceEvidenceSummary` and `buildQueuePlaceEvidenceSummary(chain)` to `apps/mobile/src/state/alertEvidenceState.ts`. Prefer audited decision evidence over raw signal ingestion evidence. Report queue clear only when audited evidence says an alert was inserted and a trade request was made.

- [ ] **Step 4: Run focused test to verify pass**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: PASS.

### Task 2: Alerts Card Queue/Place Panel

**Files:**
- Modify: `apps/mobile/src/screens/AlertsScreen.tsx`

- [ ] **Step 1: Render queue/place evidence lines**

Import `buildQueuePlaceEvidenceSummary` and render insert status, queue status, reason, audit source, and a clear/blocking status pill on each alert card.

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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-queue-place-evidence.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts apps/mobile/src/screens/AlertsScreen.tsx
git commit -m "feat: add mobile queue place evidence"
git push
```
