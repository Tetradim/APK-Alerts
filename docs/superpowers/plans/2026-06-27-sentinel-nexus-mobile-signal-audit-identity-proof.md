# Sentinel Nexus Mobile Signal Audit Identity Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make physical alert test evidence fail closed when Chrome bridge signal identity does not match the audited decision identity.

**Architecture:** Keep event-id matching as the chain assembly rule, then add stricter mobile proof inside the alert-test summary. A physical test can clear only when signal and audit contract, event id, Discord channel id, and Discord author id all match.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Signal/Audit Identity Gate

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a regression test that builds one physical signal and one audited decision with the same `event_id` and `chrome.discord.message.v1` contract, but with mismatched `channel_id` and `author_id`. The alert test summary must return `gateLabel: "Blocks test"`, `contractLabel: "Signal/audit channel mismatch"`, and `blocking: true`.

- [x] **Step 2: Run red verification**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because the current contract proof does not compare signal and audit identity fields.

- [x] **Step 3: Add identity comparisons**

Inside `buildAlertContractProofSummary`, after event id and contract checks for physical chains, require:
- `chain.signal.channelId === decision.channel.id`
- `chain.signal.authorId === decision.author.id`

Return specific blocking labels for channel or author mismatch.

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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-signal-audit-identity-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require signal audit identity proof"
git push
```

Expected: commit and push succeed after verification.
