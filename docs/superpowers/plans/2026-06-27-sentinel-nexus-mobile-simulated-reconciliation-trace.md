# Sentinel Nexus Mobile Simulated Reconciliation Trace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent simulated reconciliation rows from clearing the mobile alert-level broker reconciliation trace for queued trades.

**Architecture:** Keep this as a presentation/evidence gate inside `buildAlertReconciliationTraceSummary`. Matching by exact inserted alert ID still happens first, but a matched row with `simulated: true` must block live trace clearance and label the order and position evidence as simulated.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Simulated Row Blocks Alert Trace

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add an alert reconciliation trace test where the queued alert has an exact matching reconciliation row, but the row is simulated:

```ts
assert.equal(summary.gateLabel, "Trace blocked");
assert.equal(summary.alertLabel, "Alert alert-simulated-trace");
assert.equal(summary.reconciliationLabel, "Simulated reconciliation cannot prove broker execution");
assert.equal(summary.orderLabel, "Simulated order order-simulated-trace");
assert.equal(summary.positionLabel, "Simulated position position-simulated-trace - open");
assert.equal(summary.auditLabel, "Audit audit-simulated-trace");
assert.equal(summary.blocking, true);
```

- [x] **Step 2: Run red verification**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: FAIL because the current trace can clear from a simulated matched row.

- [x] **Step 3: Block simulated row proof**

In `buildAlertReconciliationTraceSummary`, after the exact row lookup succeeds and before using `row.liveBlocking`, add:

```ts
if (row.simulated) {
  return {
    gateLabel: "Trace blocked",
    alertLabel: `Alert ${ingestion.alertId}`,
    reconciliationLabel: "Simulated reconciliation cannot prove broker execution",
    orderLabel: formatTraceSimulatedOrderLabel(row),
    positionLabel: formatTraceSimulatedPositionLabel(row),
    auditLabel,
    blocking: true,
  };
}
```

Add helpers:

```ts
function formatTraceSimulatedOrderLabel(row: ReconciliationRow): string {
  if (row.orderId) {
    return `Simulated order ${row.orderId}`;
  }
  if (row.tradeId) {
    return `Simulated trade ${row.tradeId}; broker order id missing`;
  }
  return "Simulated order proof missing";
}

function formatTraceSimulatedPositionLabel(row: ReconciliationRow): string {
  if (row.positionId && row.positionStatus) {
    return `Simulated position ${row.positionId} - ${row.positionStatus}`;
  }
  if (row.positionId) {
    return `Simulated position ${row.positionId}`;
  }
  if (isTraceTerminalNoFill(row.tradeStatus)) {
    return `No position expected (${row.tradeStatus})`;
  }
  return "Simulated position proof missing";
}
```

- [x] **Step 4: Run green verification**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: PASS.

### Task 2: Batch Verification And Commit

**Files:**
- Verify all modified files.

- [x] **Step 1: Run full verification**

Run:

```powershell
npm test
npm run typecheck
git diff --check
```

Expected: all commands exit 0.

- [x] **Step 2: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-simulated-reconciliation-trace.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: block simulated reconciliation trace"
git push
```

Expected: commit and push succeed after verification.
