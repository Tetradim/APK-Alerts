# Sentinel Nexus Mobile Parser Payload Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block alert-test clearance when parser confidence is present but the parsed alert payload is missing.

**Architecture:** Keep parser proof inside `buildAlertTestEvidenceSummary`, because that is the mobile evidence gate for silent and physical alert testing. Replace the boolean confidence-only check with a parser proof helper that requires confidence and parsed payload evidence from the audited decision, plus matching signal-side parsed evidence for physical chains.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Parser Payload Evidence Gate

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add variants that otherwise satisfy contract/source/queue/audit proof but omit parsed payload evidence:

```ts
assert.equal(summary.gateLabel, "Blocks test", variant.name);
assert.equal(summary.parserLabel, "Parsed payload missing", variant.name);
assert.equal(summary.queueLabel, "Order request queued", variant.name);
assert.equal(summary.blocking, true, variant.name);
```

The variants must cover:
- silent audit-only decision missing `parsed`
- physical signal missing `parsed`
- physical audit decision missing `parsed`

- [x] **Step 2: Run red verification**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: FAIL because high parser confidence currently clears without parsed payload evidence.

- [x] **Step 3: Require parsed payload proof**

Add `buildAlertParserProofSummary(chain)` and use it in `buildAlertTestEvidenceSummary`:

```ts
const parser = buildAlertParserProofSummary(chain);
const clear = contract.passed && parser.passed && !source.blocking && !queue.blocking && hasAuditProof;
parserLabel: parser.label,
```

The helper returns:
- `{ passed: false, label: "Parser proof missing" }` when confidence is `"none"`
- `{ passed: false, label: "Parsed payload missing" }` when audit parsed payload is missing, or physical signal parsed payload is missing
- `{ passed: true, label: `Parser proof ${chain.parserConfidence}` }` otherwise

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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-parser-payload-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require parser payload proof"
git push
```

Expected: commit and push succeed after verification.
