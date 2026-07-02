# Sentinel Nexus Mobile Physical Raw Text Required Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block physical alert-test clearance when either the observed Discord signal or audited decision omits raw alert text.

**Architecture:** Keep the mobile alert-test contract proof helper as the enforcement point. Physical chains already compare event, channel, author, contract version, and raw text equality; this batch makes raw text presence itself required before equality can be trusted.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Physical Raw Text Presence Proof

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a physical bridge test with two variants:

```ts
assert.equal(summary.modeLabel, "Physical bridge test", variant.name);
assert.equal(summary.gateLabel, "Blocks test", variant.name);
assert.equal(summary.contractLabel, "Signal/audit raw text missing", variant.name);
assert.equal(summary.queueLabel, "Order request queued", variant.name);
assert.equal(summary.blocking, true, variant.name);
```

One variant omits signal `raw_text`; the other omits audit `raw_text`. Both keep matching event id, channel id, author id, and contract version so the failure proves raw text presence is the blocker.

- [x] **Step 2: Run red verification**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: FAIL because the current contract proof still clears when one side lacks raw text.

- [x] **Step 3: Require raw text before physical equality check**

In `buildAlertContractProofSummary`, inside the `if (chain.signal)` block after author identity checks, require both `chain.signal.rawText` and `decision.rawText` before checking equality:

```ts
if (!chain.signal.rawText || !decision.rawText) {
  return { passed: false, label: "Signal/audit raw text missing" };
}
```

Keep the existing mismatch check after this presence check.

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

- [ ] **Step 2: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-physical-raw-text-required.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require physical raw text presence"
git push
```

Expected: commit and push succeed after verification.
