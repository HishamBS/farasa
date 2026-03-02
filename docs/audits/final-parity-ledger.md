# Final Parity Ledger

## Baseline

- `branch`: `dev`
- `commit_before`: `678a592`
- `audit_date`: `2026-03-02`
- `scope`: Final Domain-First Stabilization and Release Plan

## Blocker Tracker

| ID       | Severity | Domain                          | Status   | Evidence                                                                                                                                                          | Violated Clause                       | Root Cause                                                                                    | Remediation Target                                                                              | Validation Command                                                          | Signoff  |
| -------- | -------- | ------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| STAB-001 | P0       | Chat Routing                    | RESOLVED | `src/server/routers/chat.ts:555`                                                                                                                                  | VISION stream/search mode isolation   | Search tools were enabled in chat mode                                                        | Gate tools to search mode only                                                                  | `bun run type-check && bun run lint`                                        | Pending  |
| STAB-002 | P0       | Chat UX                         | RESOLVED | `src/features/chat/hooks/use-chat-stream.ts:76`                                                                                                                   | VISION zero-dead-air                  | No immediate stream status after send                                                         | Dispatch immediate status before first chunk                                                    | `bun run build` + send-message smoke                                        | Pending  |
| STAB-003 | P0       | New Chat Lifecycle              | RESOLVED | `src/features/sidebar/components/sidebar-header.tsx:30`, `src/features/chat/hooks/use-chat-stream.ts:269`                                                         | VISION conversation lifecycle         | URL/UI state not reset deterministically on new chat                                          | Route replace + refresh + global reset event                                                    | manual chat lifecycle smoke                                                 | Pending  |
| STAB-004 | P1       | Conversation Continuity         | RESOLVED | `src/features/chat/hooks/use-chat-stream.ts:58`                                                                                                                   | VISION follow-up continuity           | Follow-up could lose conversation id                                                          | Fallback to resolved conversation ref                                                           | manual follow-up smoke                                                      | Pending  |
| STAB-005 | P1       | Title Generation                | RESOLVED | `src/server/routers/chat.ts:918`                                                                                                                                  | VISION deterministic title generation | Title generation was abort-coupled to stream signal                                           | Decouple title generation call signal                                                           | manual new-chat title smoke                                                 | Pending  |
| STAB-006 | P1       | Group Mode                      | RESOLVED | `src/config/constants.ts:404`, `src/features/group/components/group-model-picker.tsx:134`                                                                         | VISION group feature parity           | Group mode fixed at max 3 with poor UX                                                        | `2–5` selection with dialog-based multi-select                                                  | `bun run type-check` + group UI smoke                                       | Pending  |
| STAB-007 | P1       | Group Visibility                | RESOLVED | `src/features/group/components/group-tabs.tsx:68`, `src/features/group/components/group-message-group.tsx:102`                                                    | VISION readability requirement        | Provider-first labels hid model identity                                                      | Show full human-readable model names                                                            | manual group render smoke                                                   | Pending  |
| STAB-008 | P1       | Voice STT                       | RESOLVED | `src/features/voice/hooks/use-speech-to-text.ts:70`                                                                                                               | VISION voice reliability              | STT flow required unstable interaction path                                                   | Deterministic permission/record/transcribe state machine                                        | manual mic smoke                                                            | Pending  |
| STAB-009 | P1       | Voice TTS                       | RESOLVED | `src/features/voice/hooks/use-text-to-speech.ts:35`                                                                                                               | AGENTS R12 zero masking               | Hidden browser fallback path masked server errors                                             | Explicit failure path and surfaced error state                                                  | manual TTS smoke                                                            | Pending  |
| STAB-010 | P1       | Attachment Lifecycle            | RESOLVED | `src/features/chat/components/chat-input.tsx:113`, `src/features/chat/hooks/use-file-upload.ts:173`                                                               | VISION upload lifecycle               | Attachments remained in composer after successful send                                        | Clear upload state and preview URLs after send                                                  | attachment smoke                                                            | Pending  |
| STAB-011 | P2       | Sidebar Behavior                | RESOLVED | `src/features/sidebar/hooks/use-sidebar.ts:73`                                                                                                                    | User locked requirement               | Sidebar did not auto-minimize on idle                                                         | Idle timer with interaction resets                                                              | manual idle smoke                                                           | Pending  |
| STAB-012 | P2       | Delete Semantics                | RESOLVED | `src/features/sidebar/components/conversation-item.tsx:258`, `src/features/chat/components/titlebar.tsx:278`                                                      | VISION destructive action semantics   | Wrong destructive button visual token                                                         | Use destructive variant in confirm dialogs                                                      | visual check                                                                | Pending  |
| STAB-013 | P1       | Build-Time DB Fallback          | RESOLVED | `src/lib/db/client.ts:12`, `docker/docker-compose.yml:27`, `Dockerfile:16`                                                                                        | AGENTS R12 no masking fallback        | Placeholder DB URL fallback path                                                              | Require explicit `DATABASE_URL` at build/runtime path                                           | `docker compose -f docker/docker-compose.yml up --build -d`                 | Pending  |
| STAB-014 | P0       | Local Runtime Fetch Loop        | RESOLVED | `src/app/sw.ts:19`, `src/features/pwa/components/dev-sw-reset.tsx:10`, `src/server/routers/user-preferences.ts:8`, `src/features/sidebar/hooks/use-sidebar.ts:16` | VISION reliability + AGENTS R02/R12   | Service worker intercepted API flow on localhost and frontend bootstrapped prefs via mutation | Remove API SW runtime interception, force localhost SW reset, backend owns prefs initialization | `docker compose -f docker/docker-compose.yml up --build -d` + browser smoke | Pending  |
| STAB-015 | P0       | End-to-End Authenticated Matrix | OPEN     | N/A (manual runtime required)                                                                                                                                     | Final plan Phase 7 gate               | Full authenticated F1–F14 runtime matrix not yet executed in this pass                        | Run complete authenticated scenario suite in local Docker with real creds and evidence capture  | Docker app + manual E2E checklist                                           | BLOCKING |

## VISION Feature Matrix (F1–F14)

| Feature                            | Status  | Evidence                                                                             |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| F1 Auth + route protection         | PARTIAL | middleware/auth present; full OAuth+session E2E pending (`STAB-014`)                 |
| F2 Streaming core                  | PARTIAL | stream contract and immediate status improved; full replay + cancel E2E pending      |
| F3/F4 Model platform + auto-router | PARTIAL | router fixes in `chat.ts`; full reliability run with live traffic pending            |
| F5 Search mode                     | PARTIAL | chat/search tool gating fixed; authenticated search image replay E2E pending         |
| F6 Markdown/Shiki                  | PASS    | build and runtime compile intact; no regressions observed in static gates            |
| F7 Conversation lifecycle          | PARTIAL | stale-state/new-chat fixes merged; full manual lifecycle suite pending               |
| F8 Attachments                     | PARTIAL | post-send cleanup fixed; large-file and replay suite pending                         |
| F9 A2UI                            | PARTIAL | unchanged in this pass; full replay/action E2E pending                               |
| F10 Responsive/mobile              | PARTIAL | sidebar idle policy added; full gesture/44pt audit pending                           |
| F11 Deployment/health              | PARTIAL | docker prod + health passing locally; cloud deployment not started                   |
| F12 PWA                            | PARTIAL | build output includes manifest/sw routes; offline/install flow not fully re-verified |
| F13 Theming                        | PARTIAL | unchanged in this pass; no-flash and full toggle matrix pending                      |
| F14 Voice                          | PARTIAL | STT/TTS state machines hardened; browser/device matrix pending                       |

## AGENTS Rule Matrix (R01–R18)

| Rule                              | Status  | Evidence                                                                                |
| --------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| R01 SSOT/DRY                      | PARTIAL | New UI strings moved to `src/config/constants.ts`; repo-wide historical literals remain |
| R02 Separation of concerns        | PARTIAL | Core routing/state transitions moved server-side; some legacy UI coupling still present |
| R03 Mirror architecture           | PASS    | Existing Next.js+tRPC+TanStack architecture preserved                                   |
| R04 Performance first             | PARTIAL | No regressions in hooks; broader perf profiling pending                                 |
| R05 Security                      | PARTIAL | Ownership and health checks intact; full abuse/rate-limit runtime audit pending         |
| R06 Plan->Approve->Audit          | PASS    | Executed against user-locked stabilization plan and tracked in this ledger              |
| R07 Strict typing                 | PASS    | `bun run type-check` clean                                                              |
| R08 Build/test gate               | PASS    | `type-check`, `lint`, `build`, `test` all pass locally                                  |
| R09 Clean code                    | PASS    | No TODO/FIXME/HACK markers in `src`                                                     |
| R10 Whole-system refactors        | PARTIAL | Stabilization updates applied across touched flows; full repo modernization pending     |
| R11 Documentation                 | OPEN    | Final docs updates deferred until all runtime blockers are closed                       |
| R12 Real data/no masking fallback | PARTIAL | DB placeholder removed; build env skip path still exists in `src/config/env.ts`         |
| R13 No magic numbers              | PARTIAL | Existing legacy values remain across repo                                               |
| R14 Clean build                   | PASS    | Local static gates clean                                                                |
| R15 No estimates                  | PASS    | No time estimates used                                                                  |
| R16 Full-stack verification       | PARTIAL | Static + docker health complete; full authenticated E2E matrix pending                  |
| R17 Logging validation            | OPEN    | Must run after final commit set                                                         |
| R18 No AI attribution             | PASS    | No AI attribution added in code/comments touched                                        |

## Validation Evidence (Current Pass)

- `bun run type-check`: PASS
- `bun run lint`: PASS
- `bun run build`: PASS
- `bun run test`: PASS
- `docker compose -f docker/docker-compose.yml up --build -d`: PASS
- `curl http://localhost:3010/api/health`: PASS (`200 OK`)

## Release Verdict

- Current verdict: `BLOCKED`
- Blocking reason: `STAB-015` authenticated full F1–F14 local Docker runtime matrix not yet fully executed and signed off.
