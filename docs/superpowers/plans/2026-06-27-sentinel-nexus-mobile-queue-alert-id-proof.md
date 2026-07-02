# Sentinel Nexus Mobile Queue Alert ID Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make queue/place evidence fail closed when an audited trade request lacks the inserted alert id needed for reconciliation.

**Architecture:** Keep normalized ingestion evidence unchanged. Tighten `buildQueuePlaceEvidenceSummary` so queue proof clears only when the decision is audited, the alert was inserted, the inserted alert id is present, and a trade request was queued.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Alert ID Required For Queue Proof

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a queue/place regression where an audited decision reports:
- `status: "accepted"`
- `alert_inserted: true`
- `alert_id: ""`
- `trade_requested: true`

The summary must remain blocking with `gateLabel: "Queue proof blocked"` and `alertInsertLabel: "Alert insert id missing"`.

- [x] **Step 2: Run red verification**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because the current queue proof clears even when `alert_id` is missing.

- [x] **Step 3: Require alert id in queue proof**

Change the `queued` boolean to require `Boolean(ingestion.alertId)`. Return `"Queue proof blocked"` when a trade was requested but alert id proof is missing, and surface `"Alert insert id missing"` in the alert insert label.

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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-queue-alert-id-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require alert id for queue proof"
git push
```

Expected: commit and push succeed after verification.
