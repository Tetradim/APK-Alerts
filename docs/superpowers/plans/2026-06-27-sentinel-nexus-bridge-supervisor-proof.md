# Sentinel Nexus Bridge Supervisor Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bridge supervisor health fail closed unless a healthy heartbeat includes concrete tab or target supervision proof.

**Architecture:** Tighten the shared bridge evidence contract so supervisor state cannot be `healthy` from status strings alone. The mobile summary continues to render the normalized state, so operators see the heartbeat as attention/blocking when supervision proof is absent.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Shared Supervisor Proof Gate

**Files:**
- Modify: `packages/contracts/src/bridgeEvidence.test.ts`
- Modify: `packages/contracts/src/bridgeEvidence.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`

- [x] **Step 1: Write failing contract regression**

Add a contract test where `healthy: true`, `status: "healthy"`, and `last_heartbeat.status: "ok"` are present, but heartbeat details omit `supervised_tabs`, `discord_tabs`, and `configured_targets`. Expected normalized supervisor state is `attention`.

- [x] **Step 2: Write failing mobile regression**

Add a mobile summary test with the same payload. Expected labels:
- `statusLabel: "Supervisor attention"`
- `gateLabel: "Blocks live"`
- `tabLabel: "Tabs: not reported"`
- `blocking: true`

- [x] **Step 3: Run red verification**

Run:

```powershell
npm --workspace @sentinel-nexus/contracts exec -- tsx --test src/bridgeEvidence.test.ts
npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: FAIL because the existing classifier trusts status strings without proof counts.

- [x] **Step 4: Require concrete proof for healthy supervisor state**

In `classifyBridgeSupervisorState`, return `healthy` only when:
- health status is `healthy`
- heartbeat status is `ok`
- no failure/error proof exists
- one of these is present: `supervised_tabs > 0`, `discord_tabs > 0`, or `configured_targets > 0`

Otherwise return `attention`.

- [x] **Step 5: Run green verification**

Run:

```powershell
npm --workspace @sentinel-nexus/contracts exec -- tsx --test src/bridgeEvidence.test.ts
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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-bridge-supervisor-proof.md packages/contracts/src/bridgeEvidence.ts packages/contracts/src/bridgeEvidence.test.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require bridge supervisor proof"
git push
```

Expected: commit and push succeed after verification.
