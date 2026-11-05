# HIVE06-P0｜Role Charter / Chief→Developer source review (2026-11-06)

**State: SOURCE_ONLY / NOT_READY_FOR_LIVE_UAT.** This is an evidence and handoff record, not a live runtime receipt. Base: PR #21 `38cec69faf64866ed450152f4ff7905a33e5c464` (contains PR #20). PR #22 remains separate. No installed Chrome Dev, Default Profile, Native Host, Kernel DB, CB, Registry, or real Lease was changed. Fixed PCP V0.2 organization is unchanged: one joint Chief and two Developer slots/three formal Conversations.

## H1 — existing combination

PR #20 historical Windows environment evidence: `npm run verify` and isolated Native Host smoke passed on PR #20's original `0afa0654...`; **these runs do not certify this PR #21+HIVE06 combination**. No full TypeScript/Vitest/Kernel/Native Host/native installer tests executed on the new feature source. Do not mark `HIVE06_H1_BUILD_TEST_PASS`.

## H2 — privileged import and role initialization candidate

The previously existing RC01/RC02/RC03 and immutable SQLite V31 migration remain in place. Kernel now offers `role-charter.import-approved` under its existing **admin token**; exactly two independently pinned PCP/Hive source bytes must match RC01 hashes. The literal `APPROVED` string in a browser payload grants nothing. `role-charter.snapshot` and `control.snapshot.roleCharter` expose an effective contract **only after** atomic validated import and complete binding readback.

Chrome Native snapshot parser reads the verified projection; the new `planJointRoleCharterTargets` requires an exact managed Developer Tab, canonical Conversation, project/slot identity, idle/fresh runtime observation and unexpired active exclusive Kernel Lease. It deliberately returns PENDING for the group Chief, for whom no managed tab/lease has been proven. `background.ts` uses existing `manager_messages`, `SendAttemptRecord`, Native BrowserOperation, transaction/CAS and reply observation to freeze and dispatch the charter only once; a failed/uncertain/orphan delivery is **not silently resubmitted**. Charter rollover to a new unapproved Conversation remains held for authority re-binding.

**Real admin import, V30→V31 migration, Chrome Dev initialization, send/reply/restart and rollover tests: NOT_RUN.**

## H3 — Chief directive/Developer receipt candidate

A strict Chief assistant-output directive starts with `HIVE06_CHIEF_DISPATCH_V1` followed immediately by one JSON object with `dispatchId`, `targetIdentity` and `instruction`. This is processed only on a real content-script `content:changed` event, not a manager-supplied `fromRole`. Kernel group identity + exact Chief Conversation + one active exclusive group-owned browser-tab Lease must match the observed tab. If the real Chief Lease is unavailable, the operation stops with `PENDING_CHIEF_RUNTIME`: **no fictional Chief Tab, no third Developer and no fallback to an ordinary tab**.

The target is resolved from the immutable two Developer roles. `chief-dispatch:<dispatchId>` is persisted with frozen recipient and content before any physical send; duplicate IDs with changed content are rejected. Delivery reuses existing manager messages/attempt ledger, so UNKNOWN physical sends are never blindly retried.

Developer output must use `HIVE06_DEVELOPER_RESULT_V1` with the exact `dispatchId`, `status` (acknowledged/completed/blocked), `summary` and `evidence`. Only a reply correlated to the original attempt can persist a `chief-result:<dispatchId>:ack|final` message addressed to the original Chief Conversation. Reported status/evidence are explicitly **unverified**. Without a genuinely leased Chief tab, the return stays pending.

**Important runtime gap:** The current V0.5.1 group runtime previously showed `browserRuntime=NOT_VERIFIED`; no real group Chief browser Lease or a proven native group-Chief dispatch operation has been captured. A valid live Chief identity and actual content/runtime delivery are required before claiming H3 PASS. UI output alone cannot authorize a send.

## H4 — existing PR #12 code reuse only

Source modules for durable CB dispatch intent, ACK, scoped lookup/event cursor, host MCP read seam, evidence projection and tests were copied from PR #12 exact blobs. The optional `RpcRouter` CB host binding now occupies **seventh** constructor parameter (after existing Radar arguments), defaults disabled and requires Kernel admin for `cb-dispatch.prepare/lookup`. It persists local intent only; **no CB task is submitted by this RPC**. `projectCbResultDimensions` explicitly separates transport task status (incl. timeout), business status, tests, Git delivery and Result Package with `verification=NOT_VERIFIED`.

There is **no official authenticated MCP SDK transport active in this source** and no Hive→CB real submission or signed Result Package readback, so H4 source and fake-reader tests remain NOT_RUN and `JOINT_E2E_NOT_RUN`. Do not change the shared CB protocol or Provider configuration to bypass the gate.

## Isolated Windows build and safety tests required

Use a **new, isolated source worktree** (never `F:\\0 codex\\Hive-PCP-Dev-Trial-001` or the current Chrome Dev Default Profile). Verify its Git HEAD is the reviewed commit and worktree is clean before testing. Reuse the already available Node/.NET toolchain:

```powershell
npm ci
npm run check
npm run check:control
npx vitest run tests/jointRoleInitialization.test.ts tests/jointChiefDispatch.test.ts tests/roleCharterDelivery.test.ts tests/messageBus.test.ts control/tests/jointRoleCharter.test.ts control/tests/charterionCbDispatchRpc.test.ts control/tests/charterionCbResultClassifier.test.ts
npm run verify
npm run publish:native
node scripts/smoke-native-host.mjs
```

Record each command's **actual** exit code; stop on errors and report precise failed tests. Test against a fresh temporary SQLite V30 fixture for V31 migration, not the live database. Then controlled Chief/Developer Chrome Dev UAT needs separate explicit authorization and a final backup. No real paid Codex task should be submitted for this source test.

| Gate | Status |
|---|---|
| H1 source ancestry | PASS (PR #20→#21 existing base) |
| H1 new full build / Vitest / .NET | NOT_RUN |
| H2 role initialization source | CANDIDATE |
| H2 real chat/Kernel restart, rollover | NOT_RUN |
| H3 provenance + frozen dispatch/ACK/result source | CANDIDATE |
| H3 real Chief→Developer→Chief | NOT_RUN — CHIEF_RUNTIME_UNVERIFIED |
| H4 PR #12 source/journal | CANDIDATE |
| H4 MCP SDK and Result Package synthetic/real tests | NOT_RUN |
| `HIVE06_ROLE_DISPATCH_REVIEW_READY` | **NOT_REACHED** |
| `HIVE06_CHIEF_DEVELOPER_DISPATCH_E2E_PASS` | **NOT_RUN** |

This review is limited to source facts and committed test definitions, with no CI/Windows execution claimed.
