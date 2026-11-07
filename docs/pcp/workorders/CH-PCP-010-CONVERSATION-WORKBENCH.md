# CH-PCP-010｜Conversation & Project Workbench

## Identity

```yaml
repository: Su9moon/Hive
workorder_id: CH-PCP-010
title: Extend the existing Hive Radar into PCP Conversation & Project Workbench
executor: Codex
source_issue: null
```

## Governing References

- `Su9moon/Hive:docs/pcp/README.md`
- `Su9moon/Hive:docs/pcp/PCP_CHARTERION_TARGET_ARCHITECTURE_V0.3.md`
- `Su9moon/Hive:docs/pcp/PCP_CHARTERION_IMPLEMENTATION_ACCEPTANCE_V0.2.md`
- `Su9moon/Hive:dashboard/index.html`
- `Su9moon/Hive:dashboard/radar.ts`
- `Su9moon/Hive:dashboard/radar.css`
- `Su9moon/Hive:shared/radar.ts`
- `Su9moon/Hive:control/src/radarHttp.ts`
- `Su9moon/personal-ai-control-plane:AGENTS.md`
- `Su9moon/personal-ai-control-plane:governance/PCP_ENGINEERING_AGILITY_PRINCIPLE.md`
- `Su9moon/personal-ai-control-plane:governance/baselines/PCP_WEBGPT_ROLE_ORGANIZATION_V0.2_FIXED.md`
- `Su9moon/personal-ai-control-plane:processes/experience-reuse-gate.md`
- `Su9moon/personal-ai-control-plane:governance/PCP_EXECUTION_PROFILE_RESOLUTION_BASELINE.md`
- `Su9moon/personal-ai-control-plane:governance/PCP_EXECUTION_ENVIRONMENT_RESOLUTION_BASELINE.md`

## Architecture Gate

```yaml
architecture_gate:
  required: false
  reason: approved_architecture_extension_of_existing_Hive_V0_3_standalone_dashboard_and_PCP_R4_controller_workbench; no_new_PCP_core_or_runtime_service
```

This work extends the already-approved Hive standalone HTML dashboard and PCP R4 Controller Workbench. It does not create a new PCP Core concept, service, database, scheduler, queue, or Agent role. Reuse the existing Kernel, dashboard, local storage boundary, and Radar APIs.

## Execution Profile

```yaml
execution_profile:
  recommended:
    model: TERRA
    reasoning_effort: High
  resolution:
    human_override_allowed: true
    runtime_fallback_allowed: true
    strict_execution: false
  audit:
    required: true
```

## Execution Environment

```yaml
execution_environment:
  expected:
    os: UNKNOWN
    shell: UNKNOWN
    shell_version: UNKNOWN
    runner_type: UNKNOWN
  sources:
    - type: repository_evidence
      ref: Su9moon/Hive:package.json
    - type: workorder
      ref: Su9moon/Hive:docs/pcp/workorders/CH-PCP-010-CONVERSATION-WORKBENCH.md
  resolution:
    runtime_confirmation_required: true
    critical_fields: []
    mismatch_policy: informational
```

## Objective

Extend the existing Hive standalone HTML Radar into a practical PCP Controller Workbench that can show the user's imported ChatGPT conversations, their associated projects, source-backed work records, and a weekly project view—without replacing the current runtime Radar or creating a second control plane.

## Scope

1. **Extend the existing page, do not create a separate app.**
   - Add Overview, Conversations & Records, Projects, Activity Timeline, and Weekly Summary views to the existing standalone dashboard.
   - Preserve the current runtime Radar, project/session display, Fleet controls, connection state, and offline snapshot behavior.
   - Reuse the existing dark visual system and responsive layout.

2. **Historical ChatGPT conversation import.**
   - First slice accepts the user-selected `conversations.json` extracted from the official ChatGPT export ZIP.
   - Parse durable conversation ID, title, create/update timestamps, message count, message roles, message IDs when present, and text parts.
   - Preserve original source identity and import timestamp.
   - Handle missing/unsupported fields explicitly; do not silently discard records.
   - Make repeated import idempotent.
   - Keep imported data local to the existing Hive instance. Do not upload it to external services.

3. **Conversation browsing.**
   - Support 7-day, 14-day, 30-day, and all-imported-record views.
   - Support search by title and message text, project filter, status filter, date grouping, and conversation detail.
   - Display the conversation's source, account alias when provided, create/update time, and message count.
   - Keep unassigned conversations visible; do not force every conversation into a project.

4. **Project association.**
   - A conversation may relate to more than one project.
   - A suggested match is only a suggestion. Uncertain matches remain unassigned until explicitly confirmed.
   - Allow the user to correct or remove a project association.
   - Reuse the existing PCP/Hive project identity where available; do not create duplicate project identities merely to populate the dashboard.

5. **Structured work records.**
   - Display records of type requirement, decision, task, result, blocker, and next step.
   - Each record must retain source conversation and source message provenance when available.
   - Distinguish user-confirmed facts from assistant-generated or heuristic suggestions.
   - Do not promote assistant suggestions into user decisions.
   - Provide a minimal user-confirm/edit flow for a record whose source and project association are known.
   - AI-assisted bulk extraction is not required in this slice; it may be connected later through the existing Hive/CB route after the real MCP transport is available.

6. **Project status and freshness.**
   - Show current stage, status, recent activity, next action, source, and last-updated time.
   - Prefer existing GitHub/CB/Hive facts when available; use user-confirmed conversation records where no live source is available.
   - If a source cannot be read, show unavailable/unknown and retain the last known timestamp.
   - UNKNOWN, stale, or unavailable data must not be rendered as failed, blocked, or completed.
   - Do not mutate project status from conversation text without explicit confirmation or an authoritative source.

7. **Local persistence and privacy.**
   - Persist imported data through the existing Hive Kernel/local storage boundary.
   - Do not introduce a second database, remote service, generic task queue, scheduler, or new Agent role.
   - Keep source provenance and support explicit archive clearing.
   - Never store credentials, cookies, bearer tokens, or secrets in the archive or Git.
   - Do not commit imported conversation content or private exports to Git.

8. **Integration boundary.**
   - Keep existing `GET /pcp/api/snapshot` and Fleet-control semantics intact.
   - Any new import/write route must be narrow, loopback-only, same-origin, authenticated, size-limited, and restricted to archive import/management; do not expose a generic RPC or admin capability.
   - Do not assume the current Hive→CB MCP transport is complete. No new CB scheduler or protocol is in scope.

## Non-goals

- No live deployment, Chrome Dev profile modification, Native Host registration change, or existing Runtime migration.
- No new ChatGPT private/internal API. The first slice uses the user-provided export file.
- No background capture of unmanaged tabs. Incremental browser capture can be a later extension using existing Hive observation mechanisms and explicit scope.
- No new PCP Core mechanism, RAG/vector store, new backend, database service, task queue, or agent organization.
- No replacement of the existing Radar or Fleet controls.
- No automatic dispatch, project mutation, or production operation.

## Validation

1. Test parsing of valid, empty, malformed, missing-field, duplicate, unsupported, and large conversation exports.
2. Verify durable conversation IDs, timestamps, message roles/text, source identity, import timestamp, and idempotent re-import.
3. Verify local persistence, explicit archive clearing, project association (including multi-project and unassigned), and record provenance/confirmation.
4. Verify 7/14/30/all filters, search, project/status filters, date timeline, weekly aggregation, and conversation detail.
5. Verify source freshness/unavailable/unknown semantics; no UNKNOWN-to-blocked or stale-to-failed conversion.
6. Verify existing Radar snapshot, project/AgentSlot display, Fleet controls, authorization, and offline behavior remain unchanged.
7. Run targeted tests and the relevant existing dashboard/control regression tests. Reuse unaffected prior evidence; do not repeat unrelated full audits.
8. Verify responsive layout at desktop and mobile widths and render imported conversation text as text, not executable HTML.

## Deliverables

- Updated existing dashboard and minimal supporting Kernel/local-storage code.
- Tests for import, idempotence, association, provenance, filters, and existing Radar compatibility.
- A concise implementation receipt with exact commit SHA, test commands/results, local retention/clearing behavior, and explicit NOT_RUN boundaries.

## Stop Conditions

- Complete this slice after the local dashboard/import flow works against an isolated/test Hive Kernel and the existing Radar regressions pass.
- Do not deploy to the user's live Chrome Dev or existing Kernel.
- If the export format differs from the supported schema, preserve the original file and report the unsupported shape; do not guess or silently discard records.
- If existing storage cannot safely hold the archive without introducing a second database/service, report the specific constraint and continue the UI against the existing local data boundary rather than creating new infrastructure.
- Do not expand this workorder into AI-assisted bulk extraction, incremental browser capture, or unrelated CB/Hive lifecycle work.

## Execution Evidence

Fill the canonical PCP execution evidence and environment evidence at completion. Missing non-critical Runtime telemetry must be recorded as `NOT_EXPOSED_BY_RUNTIME` and must not stop an otherwise authorized implementation.
