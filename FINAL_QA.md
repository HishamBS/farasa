# FINAL_QA.md — Farasa Production Stateful QA Plan (Lead QA, Deep Real-World Flows)

## Brief Summary
This plan upgrades coverage from feature checks to **stateful real-user journeys** that intentionally mix mode/model/search/team/attachments/follow-ups in the **same conversation** and across reload/navigation boundaries.  
Primary goal is to find business-logic bugs, state drift, persistence issues, and UX-truth mismatches in production.

## Public Interfaces / Deliverable Contract
- Product APIs changed: none.
- QA deliverables:
1. Root plan doc: `/Users/hbinseddeq/Documents/farasa/FINAL_QA.md`
2. Master bug report: `/Users/hbinseddeq/Documents/farasa/docs/QA_FINDINGS.md`
3. Evidence per failed check: screenshot + HAR + trace + console excerpt
4. Bug entry must include primary + secondary suspected files with confidence

## Locked Constraints
- Environment: `https://farasa.binseddeq.dev` only
- Auth: manual gate+Google login once, saved `storageState`
- Data policy: full account scope
- No stress/load/concurrency campaign
- No fixes during testing, documentation only

## State Model Under Test (What Must Stay Consistent)
- `conversationId` (single-thread continuity)
- `mode` (`chat` or `team`)
- `webSearchEnabled` (conversation-scoped toggle behavior)
- `selectedModel` (chat turns)
- `teamModels` + `teamSynthesizerModel` (team turns)
- `stream phase truth` (UI reflects actual active phase)
- `message history integrity` (turn ordering + persistence)
- `attachment context` (turn-bound and follow-up reuse)
- `sidebar metadata` (title/pin/order/search visibility)

## Campaign Exit Gates
- [ ] 100% checks below marked `PASS`/`FAIL`/`BLOCKED`
- [ ] 100% `FAIL` checks linked to bug IDs
- [ ] 100% bugs include deterministic repro and evidence bundle
- [ ] 100% bugs mapped to exact suspected files
- [ ] QA report includes “No fixes were applied during this session”

## Setup Checklist
- [ ] Desktop project `1440x900`
- [ ] Mobile project `390x844`
- [ ] Playwright trace/video/screenshot enabled
- [ ] HAR enabled per suite
- [ ] Console + request-failure listeners enabled
- [ ] Auth `storageState` created and validated on `/chat`

## Deep Stateful Journey Scenarios (Primary Test Core)

## Journey J1: Mode/Search/Team Pinball in One Conversation (exact scenario requested)
- [ ] J1-01 Start new conversation in `chat`, `search=off`, `model=Auto`
- [ ] J1-02 Send baseline prompt, wait complete, capture resulting model badge
- [ ] J1-03 Turn `search=on` in same conversation
- [ ] J1-04 Send query requiring web data, confirm search/tool indicators appear
- [ ] J1-05 Without leaving conversation, switch to `team` mode
- [ ] J1-06 Keep `search=on`, select 3 team models, send same-topic comparison prompt
- [ ] J1-07 Verify all 3 model streams render and complete
- [ ] J1-08 Run synthesis and save output
- [ ] J1-09 Still same conversation, switch back to `chat` mode
- [ ] J1-10 Verify `search` state is still on (or explicitly reset, if product behavior is designed so)
- [ ] J1-11 Send follow-up referencing one team model answer + one search fact
- [ ] J1-12 Switch to explicit chat model and send another follow-up
- [ ] J1-13 Switch again to `team` mode, change team model set, send follow-up
- [ ] J1-14 Reload page while staying on same conversation URL
- [ ] J1-15 Verify mode/search/model/team preferences rehydrate correctly
- [ ] J1-16 Verify all prior turns remain ordered and intact
- [ ] J1-17 Export markdown and confirm all mixed-mode turns appear
- [ ] J1-18 Log any inconsistency as business-logic defect

## Journey J2: Mid-Stream State Mutation Safety
- [ ] J2-01 Start chat stream with long response
- [ ] J2-02 During active stream, toggle search on/off
- [ ] J2-03 During same active stream, change chat model selection
- [ ] J2-04 During same active stream, attempt mode change chat->team
- [ ] J2-05 Confirm active stream behavior remains deterministic
- [ ] J2-06 Send immediate next turn and verify which settings applied
- [ ] J2-07 Confirm no duplicated/ghost assistant messages

## Journey J3: Attachment + Follow-Up + Mode Switch Continuity
- [ ] J3-01 Upload text file, ask extraction question in chat mode
- [ ] J3-02 Follow-up asks for exact phrase from file
- [ ] J3-03 Turn search on and ask web-augmented follow-up about file topic
- [ ] J3-04 Switch to team mode in same conversation and ask models to compare file interpretation
- [ ] J3-05 Synthesize and then switch back to chat
- [ ] J3-06 Ask final summary combining attachment + search + team findings
- [ ] J3-07 Reload and verify attachment-related context still represented

## Journey J4: Conversation Lifecycle Under Mixed Interactions
- [ ] J4-01 Create 3 conversations with different mode/search states
- [ ] J4-02 Pin/unpin one conversation while another has recent activity
- [ ] J4-03 Rename conversation containing mixed-mode history
- [ ] J4-04 Delete a non-active conversation and verify ordering integrity
- [ ] J4-05 Use sidebar search and ensure correct filtered results
- [ ] J4-06 Browser back/forward across two mixed-mode conversations
- [ ] J4-07 Confirm active URL, visible title, and loaded message list always align

## Journey J5: Failure-Recovery Realism
- [ ] J5-01 Start stream, then simulate network interruption
- [ ] J5-02 Verify user-visible recoverable error and non-broken UI
- [ ] J5-03 Retry in same conversation and confirm continuity
- [ ] J5-04 Abort stream with stop action and send next turn immediately
- [ ] J5-05 Confirm no stale “thinking/streaming” indicators stuck
- [ ] J5-06 Verify sidebar title/order still updates correctly post-recovery

## Journey J6: Team Mode Realism Beyond Happy Path
- [ ] J6-01 Team run with minimum model count
- [ ] J6-02 Team run with maximum allowed model count
- [ ] J6-03 Change team model set between consecutive turns in same conversation
- [ ] J6-04 Change synthesizer model between runs
- [ ] J6-05 Synthesis follow-up in chat mode references team outputs correctly
- [ ] J6-06 Validate historical team messages re-render after reload

## Journey J7: A2UI Practical Behavior
- [ ] J7-01 Prompt for interactive form, verify structured component rendering
- [ ] J7-02 Fill fields, click actions, verify action effects
- [ ] J7-03 Request second A2UI block in same thread
- [ ] J7-04 Follow-up in plain chat referencing A2UI-generated content
- [ ] J7-05 Refresh and validate A2UI historical stability

## Journey J8: Mobile Stateful Regression (same logic, constrained UI)
- [ ] J8-01 Repeat J1 core transitions on mobile viewport
- [ ] J8-02 Validate sidebar and input bar behavior during mode switches
- [ ] J8-03 Validate no horizontal overflow with long messages/code
- [ ] J8-04 Validate model/team selectors are usable and persistent

## Atomic Feature/Edge Checks (Secondary Coverage)

## Auth/Gate/Security
- [ ] S1 `/`->`/gate` redirect works
- [ ] S2 invalid gate rejected
- [ ] S3 valid gate accepted
- [ ] S4 unauthenticated protected route blocked
- [ ] S5 security headers present
- [ ] S6 obvious XSS payload sanitized
- [ ] S7 conversation-id tampering does not leak unauthorized data

## Chat Protocol Truth
- [ ] S8 active status appears quickly after send
- [ ] S9 stream completion clears active indicators
- [ ] S10 empty send blocked
- [ ] S11 over-limit message rejected
- [ ] S12 refresh preserves history

## Attachments
- [ ] S13 unsupported MIME rejected
- [ ] S14 oversize rejected
- [ ] S15 remove-before-send actually removes

## Voice/PWA/Theme
- [ ] S16 TTS playable on assistant response
- [ ] S17 STT unsupported path is explicit, not broken
- [ ] S18 manifest + icons + SW accessible
- [ ] S19 dark/light/system theme correctness

## Business-Logic Invariants (Must Hold Across Journeys)
- [ ] I1 A conversation never mixes message ordering incorrectly after mode switches
- [ ] I2 Settings applied to turn N are not silently applied to already-running turn N-1
- [ ] I3 UI state reflects actual backend turn mode/model/tool usage
- [ ] I4 Reload never drops completed messages or rewrites role ordering
- [ ] I5 Sidebar metadata (title/pin/order) remains consistent with conversation activity
- [ ] I6 Exported markdown matches visible history for same conversation

## Bug Report Format (Mandatory)
Each bug in `docs/QA_FINDINGS.md` must include:
- `Bug ID`
- `Severity`
- `Journey/Test Check ID`
- `Title`
- `Preconditions`
- `Exact repro steps`
- `Expected`
- `Actual`
- `Repro rate`
- `Business impact`
- `Evidence paths` (screenshot/HAR/trace/console)
- `Network excerpt` (if relevant)
- `Suspected primary file`
- `Suspected secondary files`
- `Confidence` (`High|Medium|Low`)
- `Status`

## Suspected File Mapping Baseline
- Chat stream/state:
`/Users/hbinseddeq/Documents/farasa/src/server/routers/chat.ts`
`/Users/hbinseddeq/Documents/farasa/src/features/chat/hooks/use-chat-stream.ts`
`/Users/hbinseddeq/Documents/farasa/src/features/stream-phases/hooks/use-stream-state.ts`
- Mode/model switching:
`/Users/hbinseddeq/Documents/farasa/src/features/chat/components/titlebar.tsx`
`/Users/hbinseddeq/Documents/farasa/src/features/chat/components/model-selector.tsx`
`/Users/hbinseddeq/Documents/farasa/src/server/services/model-resolution-service.ts`
- Team mode:
`/Users/hbinseddeq/Documents/farasa/src/server/routers/team.ts`
`/Users/hbinseddeq/Documents/farasa/src/features/team/hooks/use-team-stream.ts`
`/Users/hbinseddeq/Documents/farasa/src/features/team/hooks/use-team-synthesis.ts`
- Search:
`/Users/hbinseddeq/Documents/farasa/src/server/routers/search.ts`
`/Users/hbinseddeq/Documents/farasa/src/server/services/search-enrichment-service.ts`
- Upload:
`/Users/hbinseddeq/Documents/farasa/src/server/routers/upload.ts`
`/Users/hbinseddeq/Documents/farasa/src/features/chat/hooks/use-file-upload.ts`
- Conversation/sidebar:
`/Users/hbinseddeq/Documents/farasa/src/server/routers/conversation.ts`
`/Users/hbinseddeq/Documents/farasa/src/features/sidebar/components/conversation-list.tsx`
`/Users/hbinseddeq/Documents/farasa/src/features/sidebar/components/conversation-item.tsx`
- A2UI:
`/Users/hbinseddeq/Documents/farasa/src/server/services/a2ui-message-service.ts`
`/Users/hbinseddeq/Documents/farasa/src/features/a2ui/components/a2ui-message.tsx`
`/Users/hbinseddeq/Documents/farasa/src/features/a2ui/catalog/custom-catalog.ts`
- Voice/security:
`/Users/hbinseddeq/Documents/farasa/src/app/api/voice/synthesize/route.ts`
`/Users/hbinseddeq/Documents/farasa/src/features/voice/hooks/use-text-to-speech.ts`
`/Users/hbinseddeq/Documents/farasa/src/middleware.ts`
`/Users/hbinseddeq/Documents/farasa/src/server/trpc.ts`
`/Users/hbinseddeq/Documents/farasa/next.config.ts`

## Assumptions and Defaults
- Assertions are behavior/state/persistence based, not exact LLM phrasing.
- Third-party outages can produce `BLOCKED`; must be explicitly documented.
- No stress-testing by request.
- No code changes during QA execution.
