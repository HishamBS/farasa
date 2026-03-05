# QA Findings — Farasa Production Stateful Session

**Date**: March 5, 2026  
**Environment**: https://farasa.binseddeq.dev  
**Tester**: Playwright (authenticated persistent profile, Chrome)  
**Viewport used for deep run**: `1142x712` (desktop)  
**Plan reference**: [FINAL_QA.md](/Users/hbinseddeq/Documents/farasa/FINAL_QA.md)  
**Evidence root**: `/Users/hbinseddeq/Documents/farasa/docs/qa-screenshots`

## Summary
- Total executed checks (stateful + targeted): **23**
- Passed: **21**
- Failed (confirmed bugs): **2**
- Blocked/Not executed in this session: remaining checks from full matrix

## Execution Coverage (This Session)
### J1 deep mixed-mode run (chat -> search -> team -> chat -> team, same conversation)
- J1-01 PASS
- J1-02 PASS
- J1-03 PASS
- J1-04 PASS
- J1-05 PASS
- J1-06 PASS
- J1-08 PASS (revalidated in isolated probes)
- J1-09 PASS
- J1-10 PASS
- J1-11 PASS
- J1-12 PASS
- J1-13 PASS (revalidated via follow-up team regression run)
- J1-14 PASS
- J1-15 PASS (mode persistence verified in conversation with ID)
- J1-16 PASS
- J1-17 **FAIL** (sidebar conversation menu trigger)

### Additional targeted checks
- Model explicit selection and usage continuity: PASS
- Team synthesis CTA state after model set change: PASS (2/2 probe runs)
- Attachment extraction + follow-up continuity: PASS
- Team mode persistence after reload (conversation-scoped): PASS
- A2UI form-generation behavior: **FAIL** (2/2 attempts produced plain text, no interactive UI)
- Security spot checks (`/`, unauthenticated `/api/trpc`): PASS

## Confirmed Bugs

### [HIGH] BUG-20260305-001 — Sidebar conversation "More options" menu is non-functional (blocks Rename/Export/Delete from sidebar)
**Journey/Test Check ID**: `J1-17`  
**Area**: Sidebar conversation management  
**Preconditions**:
1. Authenticated user in `/chat/<conversationId>`
2. Desktop viewport (>= `lg`)
3. Sidebar visible with conversation list

**Exact repro steps**:
1. Open an existing conversation route, e.g. `/chat/b1809542-2234-4385-b845-68f1ee1ee549`.
2. In sidebar conversation list, click a visible conversation row `More options` button.
3. Repeat click via Playwright pointer click and via DOM `element.click()` to exclude hover timing issues.

**Expected**:
- Dropdown opens with menu items (`Rename`, `Export`, `Pin/Unpin`, `Delete`).

**Actual**:
- Menu does not open; no `menuitem` nodes appear.
- Pointer click attempts fail with interception/viewport instability (`subtree intercepts pointer events`).
- Programmatic click also leaves `aria-expanded` at `false`.

**Repro rate**: 3/3 in this session  
**Business impact**:
- Sidebar workflow for rename/export/delete is effectively unavailable.
- User loses primary per-conversation management affordance from list context.

**Evidence paths**:
- Screenshot: `docs/qa-screenshots/J1-more-options-intercept.png`
- Screenshot: `docs/qa-screenshots/export-menu-check.png`
- Screenshot: `docs/qa-screenshots/more-options-programmatic.png`
- Trace: `docs/qa-screenshots/j1-deep-flow.trace`
- Network log: `docs/qa-screenshots/j1-deep-flow.network.log`
- Console log: `docs/qa-screenshots/j1-console.log`

**Network excerpt**:
- No failing API call is emitted for sidebar context menu open attempt (UI interaction fails before action dispatch).

**Suspected primary file**:
- [conversation-item.tsx:218](/Users/hbinseddeq/Documents/farasa/src/features/sidebar/components/conversation-item.tsx:218)

**Suspected secondary files**:
- [conversation-item.tsx:229](/Users/hbinseddeq/Documents/farasa/src/features/sidebar/components/conversation-item.tsx:229)
- [protected-shell.tsx:58](/Users/hbinseddeq/Documents/farasa/src/features/layout/protected-shell.tsx:58)

**Confidence**: High  
**Status**: Open

---

### [MEDIUM] BUG-20260305-002 — A2UI interactive-form prompts return plain text instead of rendered interactive surface
**Journey/Test Check ID**: `J7-01` / `J7-02` style prompt validation  
**Area**: A2UI generation pipeline

**Preconditions**:
1. Authenticated user in fresh chat conversation.
2. Auto model mode.

**Exact repro steps**:
1. Send prompt: `Create an interactive form with 3 fields: name, email, message, and a submit button.`
2. Send stricter prompt: `Generate ONLY an interactive UI (no markdown) with 3 input fields (name/email/message) and a Submit button.`
3. Wait for stream completion and inspect rendered message content.

**Expected**:
- Assistant emits A2UI payload and UI surface renders interactive inputs/buttons inside message.
- More than one textbox should exist on page (chat input + generated form controls).

**Actual**:
- Assistant responds in plain prose (example: "Here's a simple contact form UI...") with no interactive form controls rendered.
- Observed `textbox` count remains 1 (chat input only), `submitButtons=0`, `formLike=0`.

**Repro rate**: 2/2 in this session  
**Business impact**:
- Core differentiator (agent-rendered UI) fails for explicit UI-generation requests.
- Reduces trust in A2UI capability and breaks expected workflow for interactive outputs.

**Evidence paths**:
- Screenshot: `docs/qa-screenshots/a2ui-check.png`
- Screenshot: `docs/qa-screenshots/a2ui-check2.png`
- Snapshot (shows plain text response instead of UI components): `.playwright-cli/page-2026-03-05T10-12-44-046Z.yml`

**Network excerpt**:
- Standard `chat.stream` completes successfully (no explicit client error), but no rendered A2UI surface appears in UI.

**Suspected primary file**:
- [chat.ts:548](/Users/hbinseddeq/Documents/farasa/src/server/routers/chat.ts:548)

**Suspected secondary files**:
- [chat.ts:998](/Users/hbinseddeq/Documents/farasa/src/server/routers/chat.ts:998)
- [a2ui-message.tsx:27](/Users/hbinseddeq/Documents/farasa/src/features/a2ui/components/a2ui-message.tsx:27)

**Confidence**: Medium  
**Status**: Open

## Notes
- Team synthesis disabled state observed once during an early long mixed run, but **did not reproduce** in isolated probes; not logged as bug.
- Team mode persistence on reload is **working** when conversation has an ID and mode is saved.

## Session Artifacts (Selected)
- `docs/qa-screenshots/J1-after-baseline.png`
- `docs/qa-screenshots/J1-after-search.png`
- `docs/qa-screenshots/J1-after-team-run.png`
- `docs/qa-screenshots/J1-final-state.png`
- `docs/qa-screenshots/attachment-check.png`
- `docs/qa-screenshots/team-followup-check.png`
- `docs/qa-screenshots/mode-persistence-check2.png`
- `docs/qa-screenshots/j1-deep-flow.trace`
- `docs/qa-screenshots/j1-deep-flow.network.log`
- `docs/qa-screenshots/j1-console.log`

## Explicit Statement
No fixes were applied during this QA session. Only test execution and defect documentation were performed.
