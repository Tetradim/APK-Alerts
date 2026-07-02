# Sentinel Nexus Mobile Order Lifecycle Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add row-level mobile evidence proving each reconciled alert's order lifecycle from trade request through broker acknowledgement, fill or terminal status, position link, and attention state.

**Architecture:** Sentinel Echo already returns normalized reconciliation rows containing alert, trade, order, position, status, simulation, and attention fields. Mobile will derive a read-only `OrderLifecycleEvidenceSummary` from each row and render it on the Positions screen. The helper must fail closed for requested trades missing broker/order proof and must not treat simulated-only attention as a live blocker.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node `tsx --test`.

---

### Task 1: Order Lifecycle Evidence Summary

**Files:**
- Modify: `apps/mobile/src/state/reconciliationState.test.ts`
- Modify: `apps/mobile/src/state/reconciliationState.ts`

- [x] **Step 1: Write failing tests**

Add tests for `buildOrderLifecycleEvidenceSummary(row)` covering:
- filled real trade with order and position proof clears all lifecycle gates;
- pending live order with attention blocks fill, position, and attention proof;
- terminal failed order without a position clears because no position is expected;
- simulated unresolved attention is visible but does not block live readiness.

- [x] **Step 2: Run focused test to verify failure**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/reconciliationState.test.ts`

Expected: FAIL because `buildOrderLifecycleEvidenceSummary` is not exported yet.

- [x] **Step 3: Implement minimal summary helper**

Add `OrderLifecycleEvidenceItem`, `OrderLifecycleEvidenceSummary`, and `buildOrderLifecycleEvidenceSummary(row)` to `apps/mobile/src/state/reconciliationState.ts`. Use explicit item rows for request, broker order, fill/terminal state, position link, and attention state.

- [x] **Step 4: Run focused test to verify pass**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/reconciliationState.test.ts`

Expected: PASS.

### Task 2: Positions Row Lifecycle Panel

**Files:**
- Modify: `apps/mobile/src/screens/PositionsScreen.tsx`

- [x] **Step 1: Render lifecycle evidence per row**

Import `buildOrderLifecycleEvidenceSummary` and render each row's lifecycle gate pill, clear/blocker counts, and request/order/fill/position/attention evidence rows.

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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-order-lifecycle-evidence.md apps/mobile/src/state/reconciliationState.ts apps/mobile/src/state/reconciliationState.test.ts apps/mobile/src/screens/PositionsScreen.tsx
git commit -m "feat: add mobile order lifecycle evidence"
git push
```
