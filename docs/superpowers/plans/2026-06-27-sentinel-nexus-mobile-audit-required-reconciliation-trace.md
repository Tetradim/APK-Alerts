# Sentinel Nexus Mobile Audit Required Reconciliation Trace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent reconciliation trace evidence from clearing a no-order alert unless an audited bridge decision proves why no broker reconciliation is required.

**Architecture:** Keep the mobile alert evidence summaries as presentation logic over normalized contract evidence. Tighten only `buildAlertReconciliationTraceSummary` so signal-only observations remain visible but cannot clear the trace without an audit event.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Add Audit-Trail Regression

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a test beside the reconciliation trace tests:

```ts
test("alert reconciliation trace blocks signal-only no-order alert without audit decision", () => {
  const signalOnlySkipped = normalizeBridgeSignalEvent({
    event_id: "bus-signal-only-skipped",
    event_type: "signal.observed",
    source_bot: "chrome-discord-bridge",
    created_at: "2026-06-27T17:00:00.000Z",
    correlation_id: "chrome-message-signal-only-skipped",
    payload: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "chrome-message-signal-only-skipped",
      channel_id: "chrome-alerts",
      channel_name: "chrome-alerts",
      author_id: "mike",
      author_name: "MikeInvesting",
      raw_text: "BTO SPY 500C 6/21 @ 1.25",
      parser_metadata: { confidence: "low" },
      ingestion_result: {
        status: "skipped",
        alert_inserted: false,
        alert_id: "",
        trade_requested: false,
        trade_request_reason: "",
        skip_reason: "parser confidence low below required medium",
      },
    },
  });
  const chain = buildAlertEvidenceChains({ signals: [signalOnlySkipped], decisions: [] })[0];
  const summary = buildAlertReconciliationTraceSummary(chain, []);

  assert.equal(summary.gateLabel, "Trace blocked");
  assert.equal(summary.reconciliationLabel, "Audit decision required before clearing no-order trace");
  assert.equal(summary.orderLabel, "No order proven by signal only");
  assert.equal(summary.positionLabel, "No position proven by signal only");
  assert.equal(summary.auditLabel, "Audit proof missing");
  assert.equal(summary.blocking, true);
});
```

- [x] **Step 2: Run red verification**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because signal-only no-order trace currently clears.

- [x] **Step 3: Require audit proof before no-order trace clearance**

In `buildAlertReconciliationTraceSummary`, when `!ingestion.tradeRequested`, return a blocked trace if `chain.decision` is missing. Keep audited skipped/no-order decisions clear with the existing labels.

- [x] **Step 4: Run green verification**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

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

- [ ] **Step 2: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-audit-required-reconciliation-trace.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require audit for no-order reconciliation trace"
git push
```

Expected: commit and push succeed after verification.
