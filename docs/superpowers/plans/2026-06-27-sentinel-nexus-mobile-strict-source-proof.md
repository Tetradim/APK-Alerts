# Sentinel Nexus Mobile Strict Source Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile source-policy evidence fail closed when parser threshold proof, channel allowlist proof, or author allowlist proof is missing even if the endpoint booleans claim the source is allowed.

**Architecture:** Keep normalized bridge evidence unchanged. Tighten the mobile `buildSourcePolicySummary` gate so its pass condition requires both boolean policy outcomes and the evidence that explains them.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Strict Source Proof Gate

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a source-policy summary regression where `parser_confidence_allowed`, `channel_url_allowed`, `author_id_allowed`, and `metadata_policy_passed` are true, but `min_parser_confidence`, `observed_parser_confidence`, `allowed_channel_url_count`, and `allowed_author_id_count` are missing or zero. The summary must be blocked and show proof-missing labels.

- [x] **Step 2: Run red verification**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because the current pass condition trusts the booleans without requiring supporting proof.

- [x] **Step 3: Tighten pass conditions and labels**

Require:
- matched override
- parser confidence allowed
- observed parser confidence is not `none`
- minimum parser confidence is not `none`
- channel URL allowed and `allowedChannelUrlCount > 0`
- author ID allowed and `allowedAuthorIdCount > 0`
- metadata policy passed

Return `Parser proof missing`, `Channel allowlist proof missing`, and `Author allowlist proof missing` when those evidence pieces are absent.

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
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-strict-source-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require strict source proof"
git push
```

Expected: commit and push succeed after verification.
