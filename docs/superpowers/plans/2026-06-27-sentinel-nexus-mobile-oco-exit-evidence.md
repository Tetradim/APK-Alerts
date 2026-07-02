# Mobile OCO Exit Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make position-level OCO/protective exit evidence inspectable in the mobile Positions tab.

**Architecture:** Sentinel Echo's live-readiness payload already includes exit automation configuration, broker order-status/cancel capabilities, unprotected open position IDs, and metadata-only open position IDs. Mobile will derive a fail-closed display summary from that normalized payload and render it next to broker/order/position reconciliation. This batch is read-only and must not arm trading, create exits, cancel orders, or claim live-money readiness.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node test runner.

---

### Task 1: Exit Protection Summary

**Files:**
- Modify: `apps/mobile/src/state/liveReadinessState.test.ts`
- Modify: `apps/mobile/src/state/liveReadinessState.ts`

- [ ] **Step 1: Write failing tests**

Add tests for `buildExitProtectionEvidenceSummary(snapshot)` covering:
- all clear OCO exit evidence is non-blocking;
- unprotected and metadata-only position IDs are listed and block live readiness;
- default empty readiness evidence blocks and does not invent protection.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/liveReadinessState.test.ts`

Expected: FAIL because `buildExitProtectionEvidenceSummary` is not exported yet.

- [ ] **Step 3: Implement minimal summary helper**

Add `ExitProtectionEvidenceSummary` and `buildExitProtectionEvidenceSummary(snapshot)` to `apps/mobile/src/state/liveReadinessState.ts`. The helper should require OCO exits configured, broker order status support, broker cancel support, zero unprotected open positions, and zero metadata-only open positions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/liveReadinessState.test.ts`

Expected: PASS.

### Task 2: Positions Tab Evidence Panel

**Files:**
- Modify: `apps/mobile/src/screens/PositionsScreen.tsx`

- [ ] **Step 1: Render read-only OCO exit evidence**

Import `buildExitProtectionEvidenceSummary` and `useLiveReadinessState`. Sync the readiness connection from the same remote engine pairing used by reconciliation. Render a Positions tab panel showing OCO status, gate label, broker capability label, unprotected position IDs, metadata-only position IDs, and a Check exits button that refreshes the live-readiness endpoint.

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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-oco-exit-evidence.md apps/mobile/src/state/liveReadinessState.ts apps/mobile/src/state/liveReadinessState.test.ts apps/mobile/src/screens/PositionsScreen.tsx
git commit -m "feat: add mobile oco exit evidence"
git push
```
