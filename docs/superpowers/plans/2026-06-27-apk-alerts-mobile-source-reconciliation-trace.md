# APK-Alerts Mobile Source Reconciliation Trace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile evidence that ties each accepted alert chain to broker/order/position reconciliation using exact inserted alert IDs.

**Architecture:** Alert evidence already carries the audited inserted alert ID and trade-request decision. Reconciliation rows already carry normalized alert IDs, order IDs, position IDs, and live-blocking attention state. This batch derives a read-only trace summary from an alert chain plus reconciliation rows and renders it on each alert card without fuzzy ticker/contract fallback.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node `tsx --test`.

---

### Task 1: Source-to-Reconciliation Trace Summary

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write failing tests**

Add tests for `buildAlertReconciliationTraceSummary(chain, rows)` covering:
- queued alert with exact reconciliation row clears trace;
- queued alert without exact reconciliation row blocks;
- skipped alert with no trade request does not require reconciliation;
- missing chain fails closed.

- [x] **Step 2: Run focused test to verify failure**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because `buildAlertReconciliationTraceSummary` is not exported yet.

- [x] **Step 3: Implement minimal summary helper**

Add `AlertReconciliationTraceSummary` and `buildAlertReconciliationTraceSummary(chain, rows)` to `apps/mobile/src/state/alertEvidenceState.ts`. Match rows by exact `row.alertId === inserted alert ID` only. Do not use ticker, contract text, or approximate fallback.

- [x] **Step 4: Run focused test to verify pass**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: PASS.

### Task 2: Alerts Trace Rendering

**Files:**
- Modify: `apps/mobile/src/screens/AlertsScreen.tsx`

- [x] **Step 1: Render trace proof per alert**

Import `buildAlertReconciliationTraceSummary` and read current reconciliation rows. Render a "Reconciliation trace" section on each alert card with gate, alert ID, reconciliation row status, order, position, and audit labels.

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
git add docs/superpowers/plans/2026-06-27-apk-alerts-mobile-source-reconciliation-trace.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts apps/mobile/src/screens/AlertsScreen.tsx
git commit -m "feat: add mobile source reconciliation trace"
git push
```
