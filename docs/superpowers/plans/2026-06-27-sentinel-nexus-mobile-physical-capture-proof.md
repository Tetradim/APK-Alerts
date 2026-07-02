# Sentinel Nexus Mobile Physical Capture Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block physical alert-test clearance unless the observed Chrome signal carries capture evidence.

**Architecture:** Keep capture proof inside `buildAlertTestEvidenceSummary`, because that is the mobile gate for silent and physical alert testing. Silent audit-only tests remain valid without physical capture; physical signal/audit tests must prove capture from the signal side with a capture path or Discord message URL.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Physical Capture Evidence Gate

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a physical bridge test where event id, raw text, parsed payload, source policy, queue proof, and audit proof all pass, but the physical signal has no `capture_path` or message `url`. The audit decision may still include a capture path to prove audit-only capture is not enough for physical proof:

```ts
assert.equal(summary.modeLabel, "Physical bridge test");
assert.equal(summary.gateLabel, "Blocks test");
assert.equal(summary.captureLabel, "Physical capture proof missing");
assert.equal(summary.queueLabel, "Order request queued");
assert.equal(summary.blocking, true);
```

- [x] **Step 2: Run red verification**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: FAIL because physical tests currently clear without signal-side capture proof.

- [x] **Step 3: Require signal-side physical capture proof**

Add `buildAlertCaptureProofSummary(chain)` and include it in `buildAlertTestEvidenceSummary.clear`. For physical chains, require `chain.signal.capturePath` or `chain.signal.messageUrl`; for silent audit-only chains, keep returning `No physical capture` without blocking.

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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-physical-capture-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require physical capture proof"
git push
```

Expected: commit and push succeed after verification.
