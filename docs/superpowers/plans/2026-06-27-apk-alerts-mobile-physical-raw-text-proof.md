# APK Alerts Mobile Physical Raw Text Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block physical alert-test clearance when the observed Discord alert text differs from the audited decision text.

**Architecture:** Keep the existing mobile alert-test summary as the enforcement point. Extend the contract proof helper so physical signal/audit chains must agree on raw alert text in addition to event, channel, author, and contract version.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Physical Raw Text Contract Proof

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a physical bridge test chain with matching event id, channel id, author id, and contract version, but different `raw_text` in the signal and audit decision:

```ts
assert.equal(summary.modeLabel, "Physical bridge test");
assert.equal(summary.gateLabel, "Blocks test");
assert.equal(summary.contractLabel, "Signal/audit raw text mismatch");
assert.equal(summary.queueLabel, "Order request queued");
assert.equal(summary.blocking, true);
```

- [x] **Step 2: Run red verification**

Run:

```powershell
npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: FAIL because the current contract proof does not compare physical signal raw text to audited raw text.

- [x] **Step 3: Add raw text proof gate**

In `buildAlertContractProofSummary`, inside the `if (chain.signal)` block after author identity checks, reject non-empty mismatched physical/audit raw text:

```ts
if (chain.signal.rawText && decision.rawText && chain.signal.rawText !== decision.rawText) {
  return { passed: false, label: "Signal/audit raw text mismatch" };
}
```

- [x] **Step 4: Run green verification**

Run:

```powershell
npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
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

- [ ] **Step 2: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-06-27-apk-alerts-mobile-physical-raw-text-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require physical raw text proof"
git push
```

Expected: commit and push succeed after verification.
