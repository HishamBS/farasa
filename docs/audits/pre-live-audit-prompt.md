# Farasa — Pre-Production Go-Live Audit

## Your Role

You are a hostile, adversarial senior auditor. Your job is to find every defect,
gap, violation, and risk in this codebase before users see it. You are not trying
to be helpful or kind. You assume nothing works until you have read the actual code
and confirmed it with your own eyes.

**The standard**: If you have not read the file, you do not know what is in it.
Assume all features are broken until proven otherwise.

---

## RULE 1 — No Assumptions

You may not claim anything is "correct", "implemented", or "working" unless you have
read the relevant source file(s) in this session and can quote the specific code
that proves it.

You may not list something as a violation unless you have read the file and can
quote the exact code that is wrong.

**False positives are failure. Missed violations are failure. Both are equally bad.**

---

## RULE 2 — Proof Format

Every finding (violation OR confirmation of correctness) must cite:
- Exact file path
- Exact line number(s)
- Quoted code (the actual text from the file)
- What is wrong / what is correct

Do not paraphrase. Quote.

---

## RULE 3 — Complete All Waves Before Writing Any Plan

You will conduct 8 audit waves. Do not begin writing any remediation plan or task
list until ALL 8 waves are complete and the full violations report has been
written. After the report, STOP and wait for the user to approve the violations
list before creating the plan.

---

## Required Skills — Invoke in This Order

These skills are non-negotiable. Invoke the `Skill` tool before the action listed.
Do not rationalize skipping them. If the skill exists and the situation matches, use it.

### Before claiming any wave is complete
**Skill:** `superpowers:verification-before-completion`

Invoke before writing "Wave N complete" or moving to the next wave.
Do not claim a checklist item passes unless you have read the file and quoted the code.
Evidence before assertions — always.

### For independent parallel waves
**Skill:** `superpowers:dispatching-parallel-agents`

Use this to run independent waves simultaneously:
- Waves 1 + 7 can run in parallel (config layer + security layer are non-overlapping)
- Waves 4 + 5 can run in parallel (chat components + sidebar/A2UI are non-overlapping)

Do not run waves sequentially if they share no files. Parallelism is mandatory here.

### When tracing a complex violation across multiple files
**Skill:** `superpowers:systematic-debugging`

Invoke when a violation requires tracing a data path across 3+ files (e.g., a feature
that appears implemented on the client but is broken server-side). Use it to map
the full dependency chain before declaring something broken or correct.

### After user approves the violations report — before writing the plan
**Skill:** `superpowers:writing-plans`

The remediation plan is not a list of tasks — it is a structured implementation
document with exact file paths, quoted wrong code, exact replacement code, and
per-task verification steps. The writing-plans skill defines this format.

### Before executing any fix — isolation
**Skill:** `superpowers:using-git-worktrees`

Create an isolated worktree before starting any code changes. Do not modify
the `dev` branch directly. Each remediation batch should be a clean branch.

### While executing fixes
**Skill:** `superpowers:executing-plans`

Execute the remediation plan task-by-task with review checkpoints.
Default batch size: 3 tasks. Report verification output after each batch.
STOP if any fix causes a typecheck or lint failure — do not proceed.

After every batch of 3 tasks:
**Skill:** `superpowers:requesting-code-review`

Do not skip the review step. Every batch must be reviewed before the next
batch starts.

---

## Ground Truth — Read These First (In This Order)

Read every one of these files completely before starting Wave 1:

1. `docs/VISION.md` — product spec, every feature requirement, every UX rule
2. `CLAUDE.md` — engineering rules R01–R18 (non-negotiable constraints)
3. `mockups/1-whisper.html` — exact UI design reference (open and read the HTML)
4. `src/config/constants.ts` — SSOT for all limits, durations, labels, phases
5. `src/config/prompts.ts` — system prompts and XML delimiter constants
6. `src/config/routes.ts` — all route path constants
7. `src/config/env.ts` — environment variable schema
8. `src/config/models.ts` — static model registry fallback
9. `src/schemas/message.ts` — StreamChunk union, ChatInput, MessageMetadata
10. `src/schemas/conversation.ts` — pagination, CRUD schemas
11. `src/schemas/model.ts` — ModelConfig, ModelSelection, ModelCapability
12. `src/schemas/search.ts` — SearchResult, SearchImage
13. `src/schemas/upload.ts` — UploadRequest, UploadResponse
14. `src/schemas/auth.ts` — SessionUser
15. `src/lib/db/schema.ts` — Drizzle ORM table definitions (ground truth for all DB shapes)
16. `src/types/stream.ts` — StreamState, StreamAction
17. `src/lib/utils/motion.ts` — all animation presets (SSOT for motion)

Only after reading all 17 files above, proceed to Wave 1.

---

## Wave 1 — Configuration & Schema Integrity

**Files to read**: Everything in `src/config/` and `src/schemas/`

Check:
- Every magic number in any component file that should be in `constants.ts` but isn't
- Every hardcoded string (route, error message, phase name, event name, model ID) that
  should reference a constant but doesn't
- Every Zod schema — does each field match the Drizzle schema column it represents?
- Does `MessageMetadataSchema` match every field stored by `chat.ts` router?
- Does `ChatInputSchema` match every field consumed by `chat.ts` router?
- Does `StreamChunkSchema` cover every event type emitted by `chat.ts`?
- Is every exported type derived via `z.infer<>` or is any handwritten?
- Does `env.ts` use `SKIP_ENV_VALIDATION` to allow build-time bypass?
- Does `src/lib/db/client.ts` use a build-phase placeholder URL when
  `SKIP_ENV_VALIDATION=1` to prevent `neon()` from throwing at build time?

---

## Wave 2 — Server Layer

**Files to read**: `src/server/trpc.ts`, `src/server/context.ts`,
`src/server/routers/_app.ts`, and every router file:
- `src/server/routers/chat.ts`
- `src/server/routers/conversation.ts`
- `src/server/routers/model.ts`
- `src/server/routers/search.ts`
- `src/server/routers/upload.ts`

Also read:
- `src/lib/ai/client.ts`
- `src/lib/ai/router.ts`
- `src/lib/ai/registry.ts`
- `src/lib/ai/tools.ts`
- `src/lib/ai/title.ts`
- `src/lib/search/tavily.ts`
- `src/lib/upload/gcs.ts`
- `src/lib/security/token-crypto.ts`
- `src/lib/security/rate-limit.ts`
- `src/lib/utils/errors.ts`
- `src/middleware.ts`
- `src/app/api/trpc/[trpc]/route.ts`
- `src/app/api/health/route.ts`

Check every item:

**Auth & Authorization**
- [ ] `src/server/trpc.ts`: Is `protectedProcedure` enforced via middleware that
      verifies `session.user.id` exists and throws UNAUTHORIZED if not?
- [ ] Every router procedure that handles user data: does it use `protectedProcedure`,
      not `publicProcedure`?
- [ ] `src/middleware.ts`: Does it correctly protect all `(protected)` routes and
      redirect unauthenticated users to `/login`?
- [ ] Auth.js route: is `export const dynamic = 'force-dynamic'` present?
- [ ] tRPC route: is `export const dynamic = 'force-dynamic'` present?

**Database Security**
- [ ] `conversation.ts` router list procedure: does WHERE clause include
      `eq(conversations.userId, ctx.userId)`?
- [ ] `conversation.ts` router getById: does it verify ownership before fetching
      messages? Quote the ownership check.
- [ ] `conversation.ts` router update/delete/pin: does each verify userId ownership?
- [ ] `chat.ts` router: when creating/fetching a conversation, is userId verified?
- [ ] `upload.ts` router: is the attachmentId confirmed to belong to the requesting
      user before it can be used?

**Input Validation**
- [ ] Every tRPC procedure input uses a Zod schema from `src/schemas/` (not inline)?
- [ ] `chat.ts`: is user content wrapped in `<user_request>…</user_request>` XML
      delimiters using `USER_REQUEST_DELIMITERS` constants from `prompts.ts`?
- [ ] `chat.ts`: when an attachment is included, is the attachment block also using
      `wrappedContent`, not raw `input.content`?

**Error Handling**
- [ ] `chat.ts`: Are `INTERNAL_SERVER_ERROR` TRPCErrors sanitized before reaching
      the client (no raw `error.message` in the response)?
- [ ] Do non-INTERNAL_SERVER_ERROR TRPCErrors (NOT_FOUND, UNAUTHORIZED, etc.) pass
      through as-is (they're already safe)?
- [ ] `registry.ts`: Does `fetchFromOpenRouter()` have try-catch that returns
      `[...STATIC_MODEL_REGISTRY]` on failure?
- [ ] `router.ts` (AI router): Does `ModelSelectionSchema.parse()` have try-catch
      that returns `DEFAULT_MODEL` on failure?

**AI & Tool Calling**
- [ ] `chat.ts`: In CHAT mode, are `tools: ALL_TOOLS` and `tool_choice: 'auto'`
      passed to the OpenRouter completion call?
- [ ] `chat.ts`: After streaming ends, if `finish_reason === 'tool_calls'`, are
      accumulated tool calls processed (Tavily search executed, TOOL_START /
      TOOL_RESULT events emitted, follow-up completion made)?
- [ ] `tools.ts`: Is the web_search tool definition compatible with OpenRouter's
      function calling format?
- [ ] `title.ts`: Does title generation emit a `STREAM_PHASES.GENERATING_TITLE`
      status event after updating the DB?

---

## Wave 3 — Client State Machine & Streaming

**Files to read**:
- `src/features/stream-phases/hooks/use-stream-state.ts`
- `src/features/chat/hooks/use-chat-stream.ts`
- `src/features/chat/hooks/use-chat-input.ts`
- `src/features/chat/hooks/use-file-upload.ts`
- `src/features/chat/hooks/use-auto-scroll.ts`
- `src/features/sidebar/hooks/use-sidebar.ts`
- `src/features/search/hooks/use-search.ts`
- `src/features/a2ui/hooks/use-a2ui-actions.ts`
- `src/features/voice/hooks/use-speech-to-text.ts` (if exists)
- `src/features/voice/hooks/use-text-to-speech.ts` (if exists)
- `src/trpc/client.ts`
- `src/trpc/provider.tsx`
- `src/trpc/server.ts`

Check every item:

**Stream State Machine**
- [ ] `use-stream-state.ts`: Does initial state include `lastInput: null`?
- [ ] Is `SAVE_INPUT` action handled, storing `action.input` in state?
- [ ] Does `RESET` preserve `lastInput` (so retry works after reset)?
- [ ] Are all `STREAM_EVENTS` (STATUS, THINKING, MODEL_SELECTED, TOOL_START,
      TOOL_RESULT, TEXT, A2UI, ERROR, DONE) handled in the reducer?

**Chat Stream Hook**
- [ ] `use-chat-stream.ts`: Does `sendMessage` dispatch `SAVE_INPUT` before `reset()`?
- [ ] Is `retry()` exported and does it call `sendMessage(streamState.lastInput)`?
- [ ] On `STATUS` with phase `GENERATING_TITLE`: does it invalidate both
      `conversation.list` and `conversation.getById`?
- [ ] Is `utils` from `trpc.useUtils()` included in the `sendMessage` useCallback
      dependency array?
- [ ] Is `abort()` correctly calling `abortRef.current?.()`?

**File Upload**
- [ ] `use-file-upload.ts`: Is `URL.revokeObjectURL()` called when removing a file?
- [ ] Is there a `useEffect` cleanup that revokes ALL object URLs on component unmount?
- [ ] Is file type validated against `SUPPORTED_FILE_TYPES` from constants?
- [ ] Is file size validated against `LIMITS.FILE_MAX_SIZE_BYTES`?

**Keyboard Shortcuts**
- [ ] `use-chat-input.ts`: Is `Cmd/Ctrl+Enter` handled to submit the form?
- [ ] Is `Cmd/Ctrl+K` handled to open the model selector?
- [ ] Is `Shift+Enter` allowed for newlines without submitting?

**tRPC Transport**
- [ ] `src/trpc/client.ts`: Does it use `splitLink` with `httpSubscriptionLink` for
      subscriptions and `httpBatchLink` for queries/mutations?
- [ ] Does it use `superjson` transformer?
- [ ] Does `httpSubscriptionLink` use SSE (EventSource) transport?

---

## Wave 4 — UI Components: Chat Feature

Read every file:
- `src/features/chat/components/chat-container.tsx`
- `src/features/chat/components/message-list.tsx`
- `src/features/chat/components/message-bubble.tsx`
- `src/features/chat/components/assistant-message.tsx`
- `src/features/chat/components/historical-assistant-message.tsx`
- `src/features/chat/components/user-message.tsx`
- `src/features/chat/components/chat-input.tsx`
- `src/features/chat/components/model-selector.tsx`
- `src/features/chat/components/mode-toggle.tsx`
- `src/features/chat/components/titlebar.tsx`
- `src/features/chat/components/attachment-preview.tsx`
- `src/features/chat/components/empty-state.tsx`
- `src/features/chat/components/stop-button.tsx`
- `src/features/chat/context/chat-mode-context.tsx`

Check every item against `mockups/1-whisper.html`:

**message-list.tsx**
- [ ] Uses `useVirtualizer` from `@tanstack/react-virtual`?
- [ ] `overscan: 5` or higher?
- [ ] `paddingStart`, `paddingEnd`, `gap` set in virtualizer options?
- [ ] `measureElement` used on each virtual item div for dynamic height?
- [ ] Streaming `AssistantMessage` is included as last virtual item when active?
- [ ] `useAutoScroll` called with `parentRef` and `scrollToBottom` callback?
- [ ] Scroll-to-bottom uses `container.scrollTo({ top: container.scrollHeight })`?
- [ ] `isPaused && isStreaming` shows the "scroll to bottom" floating button?

**user-message.tsx**
- [ ] Bubble has `bg-[--bg-glass]`?
- [ ] Has `backdrop-blur-md`?
- [ ] Has `border border-[--border-default]`?
- [ ] Has `py-2.5` (not `py-3`)?
- [ ] Has `shadow-sm shadow-black/20`?
- [ ] No reference to `--bg-user-message`?

**chat-input.tsx**
- [ ] Outer wrapper has `pb-4 pt-2` (not `py-3`)?
- [ ] Send/stop toggle is wrapped in `<AnimatePresence mode="wait">`?
- [ ] Stop button has `key="stop"` and `exit` animation?
- [ ] Send button has `key="send"` and `exit` animation?
- [ ] `useReducedMotion()` respected on exit animations?
- [ ] Cmd/Ctrl+K wired to open model selector?

**titlebar.tsx**
- [ ] Root flex div has `gap-2.5` (not `gap-2`)?
- [ ] All icon buttons have `size-7` (not `size-9`)?

**historical-assistant-message.tsx**
- [ ] Renders `ModelBadge`?
- [ ] Renders `ThinkingBlock` when `metadata.thinkingContent` exists?
- [ ] Renders `ToolExecution` cards when `metadata.searchResults` exist?
- [ ] Renders `MarkdownRenderer` for message content?
- [ ] Renders `A2UIMessage` when `metadata.a2uiMessages` exist?
- [ ] Renders `TTSControls`?
- [ ] Renders token count and cost from `metadata.usage` (both only when > 0)?

**empty-state.tsx**
- [ ] Suggestion chips grid has `gap-2` (not `gap-3`)?

**attachment-preview.tsx**
- [ ] Root element is a `motion.div`?
- [ ] Has `{...fadeInUp}` or equivalent entrance animation?
- [ ] Has `exit` animation (opacity: 0, scale: 0.8)?

**model-selector.tsx**
- [ ] Shows Thinking capability badge (violet) when `model.supportsThinking`?
- [ ] Shows Vision capability badge (cyan) when `model.supportsVision`?
- [ ] Shows Tools capability badge when `model.supportsTools`?

---

## Wave 5 — UI Components: All Other Features

Read every file:
- `src/features/stream-phases/components/stream-progress.tsx`
- `src/features/stream-phases/components/thinking-block.tsx`
- `src/features/stream-phases/components/model-badge.tsx`
- `src/features/stream-phases/components/tool-execution.tsx`
- `src/features/sidebar/components/sidebar-container.tsx`
- `src/features/sidebar/components/sidebar-header.tsx`
- `src/features/sidebar/components/conversation-list.tsx`
- `src/features/sidebar/components/conversation-item.tsx`
- `src/features/sidebar/components/user-menu.tsx`
- `src/features/markdown/components/markdown-renderer.tsx`
- `src/features/markdown/components/code-block.tsx`
- `src/features/markdown/components/copy-button.tsx`
- `src/features/a2ui/components/a2ui-message.tsx`
- `src/features/a2ui/catalog/custom-catalog.ts`
- `src/features/a2ui/catalog/adapters/button.tsx`
- `src/features/a2ui/catalog/adapters/card.tsx`
- `src/features/a2ui/catalog/adapters/text.tsx`
- `src/features/a2ui/catalog/adapters/input.tsx`
- `src/features/a2ui/catalog/adapters/image.tsx`
- `src/features/a2ui/catalog/adapters/row.tsx`
- `src/features/a2ui/catalog/adapters/column.tsx`
- `src/features/a2ui/catalog/adapters/list.tsx`
- `src/features/a2ui/catalog/adapters/divider.tsx`
- `src/features/a2ui/catalog/adapters/code.tsx`
- `src/features/search/components/search-results.tsx`
- `src/features/search/components/image-gallery.tsx`
- `src/features/pwa/components/install-prompt.tsx`
- `src/features/pwa/components/offline-banner.tsx`
- `src/features/voice/components/mic-button.tsx` (if exists)
- `src/features/voice/components/tts-controls.tsx`
- `src/app/offline/page.tsx`
- `src/app/sw.ts`
- `src/app/manifest.ts`
- `src/app/globals.css`

Check every item:

**stream-progress.tsx**
- [ ] Model chip always uses `bg-orange-400/10 border-orange-400/20`?
- [ ] Model chip always uses `text-[--provider-anthropic]`?
- [ ] Provider prefix stripped from displayed model name?
- [ ] Error state: when `streamState.phase === 'error'`, renders error UI with message?
- [ ] Error state: retry button calls `onRetry` prop if provided?
- [ ] Error state uses `text-[--error]` and `border-[--error]/20 bg-[--error]/5`?
- [ ] `onRetry` prop is optional (`onRetry?: () => void`)?

**thinking-block.tsx**
- [ ] Expanded body has `text-[--thinking]/50` (not `text-[--text-muted]`)?
- [ ] Has `font-mono`?
- [ ] Has `bg-[--thinking-bg]`?
- [ ] Has `border border-[--thinking-border] rounded-xl border-t-0 rounded-t-sm`?
- [ ] Has `max-h-48 overflow-y-auto`?
- [ ] Default collapsed: `useState(!UX.THINKING_COLLAPSE_DEFAULT)` = `useState(false)` → collapsed?

**model-badge.tsx**
- [ ] Provider prefix stripped: `anthropic/claude-sonnet` → `claude-sonnet`?
- [ ] When `modelSelection.reasoning` exists, badge is wrapped in shadcn `Tooltip`?
- [ ] Tooltip content shows reasoning text (not just `title` attribute)?
- [ ] No `title={reasoning}` attribute anywhere in the file?

**code-block.tsx**
- [ ] Uses `rounded-lg` (not `rounded-xl`)?

**globals.css**
- [ ] Line number CSS is scoped to `pre[data-line-numbers="true"]`?
- [ ] No unconditional `.line::before` counter CSS that would add numbers to all code?

**sidebar-container.tsx**
- [ ] Uses `w-72` (not `w-64`)?
- [ ] Has `saturate-150` on the glass surface?
- [ ] Has `shadow-2xl shadow-black/30` on mobile with `lg:shadow-none`?
- [ ] Uses Framer Motion (not CSS `transition-transform`) for open/close?
- [ ] Animation uses `MOTION.DURATION_SLOW` from constants?

**conversation-item.tsx**
- [ ] Has `px-2.5` (not `px-3`)?
- [ ] Active indicator is an absolute `w-0.5` bar (not `border-l-2`)?
- [ ] Has `onContextMenu` handler that opens the dropdown menu on right-click?
- [ ] Dropdown has `open` and `onOpenChange` props (controlled)?

**conversation-list.tsx**
- [ ] Uses `trpc.conversation.list.useInfiniteQuery` (not `useQuery`)?
- [ ] `getNextPageParam: (lastPage) => lastPage.nextCursor`?
- [ ] Flattens pages: `data?.pages.flatMap((p) => p.items)`?
- [ ] Has `IntersectionObserver` sentinel at the bottom?
- [ ] Sentinel triggers `fetchNextPage()` when intersecting?

**a2ui-message.tsx**
- [ ] Before rendering any A2UI message, validates `type` field is a `string`?
- [ ] Rejects (skips) messages where `type` is missing or not a string?

**All A2UI adapters**
- [ ] `button.tsx`: Uses CSS custom property tokens (`--accent`, `--bg-surface`) not
      hardcoded Tailwind colors (`blue-500`, `gray-100`)?
- [ ] `text.tsx`, `card.tsx`, `input.tsx`, `image.tsx`: all use design tokens?

**PWA**
- [ ] `src/app/offline/page.tsx` exists and renders a proper offline UI?
- [ ] `src/app/sw.ts`: Has `fallbacks` config with `/offline` for document requests?
- [ ] `src/app/manifest.ts`: Has `name`, `icons`, `theme_color`, `display: 'standalone'`?

---

## Wave 6 — End-to-End Flow Traces

For each flow, trace the complete data path by reading every file involved.
Do not skim — read the actual function bodies.

### Flow A: New Chat Message (Chat Mode, Auto-Router, No Tools)
Trace: `chat-input.tsx` → `use-chat-input.ts` (submit handler) →
`use-chat-stream.ts` (sendMessage) → `trpc/client.ts` (subscription) →
`server/routers/chat.ts` (stream generator) → `lib/ai/router.ts` (model selection) →
`lib/ai/client.ts` (OpenRouter call) → stream chunks → `use-stream-state.ts`
(reducer) → `stream-progress.tsx` (renders phases) → `message-list.tsx` →
`historical-assistant-message.tsx` (after done).

Verify each handoff:
- [ ] `ChatInputSchema` fields flow correctly from form to `sendMessage`
- [ ] `SAVE_INPUT` dispatched before `reset()` so `lastInput` is preserved
- [ ] `MODEL_SELECTED` chunk is emitted and handled
- [ ] After streaming, message is saved to DB with full `metadata` JSONB
- [ ] Title generated (only on first message), DB updated, cache invalidated

### Flow B: Chat Mode with Model-Initiated Tool Call
Same as Flow A but model responds with `tool_calls`. Verify:
- [ ] `tools: ALL_TOOLS` is in the OpenRouter call payload for CHAT mode
- [ ] `delta.tool_calls` fragments are accumulated across stream chunks
- [ ] When `finish_reason === 'tool_calls'`, tool execution begins
- [ ] `TOOL_START` event emitted with query
- [ ] Tavily called via `lib/search/tavily.ts`
- [ ] `TOOL_RESULT` event emitted with results
- [ ] Follow-up completion call made with tool results in messages array
- [ ] Final text streams from follow-up call

### Flow C: File Attachment
Trace: File selected in input → `use-file-upload.ts` (validate, presign, upload,
confirm) → `attachment-preview.tsx` (shows with fadeInUp) → sent in `ChatInput` →
`server/routers/upload.ts` (confirmUpload) → `server/routers/chat.ts`
(builds attachment content blocks) → OpenRouter multi-modal message.

Verify:
- [ ] MIME type validated client-side against `SUPPORTED_FILE_TYPES`
- [ ] Size validated against `LIMITS.FILE_MAX_SIZE_BYTES`
- [ ] `previewUrl` revoked on remove and on unmount
- [ ] `attachmentId` confirmed before being usable in message send
- [ ] Server-side: attachment content blocks built from confirmed attachment IDs

### Flow D: Conversation History Load
Trace: `/chat/[id]` page → tRPC `conversation.getById` query →
`server/routers/conversation.ts` → DB query (userId-scoped) → messages array →
`message-list.tsx` → `message-bubble.tsx` → `historical-assistant-message.tsx`.

Verify:
- [ ] Ownership verified (userId check) before messages returned
- [ ] `metadata` JSONB correctly parsed by `MessageMetadataSchema`
- [ ] `ModelBadge` rendered from `metadata.modelUsed`
- [ ] `ThinkingBlock` rendered from `metadata.thinkingContent`
- [ ] `ToolExecution` cards rendered from search metadata
- [ ] `A2UIMessage` rendered from `metadata.a2uiMessages`
- [ ] Token count and cost rendered from `metadata.usage`

### Flow E: Conversation Sidebar (Infinite Scroll)
Trace: Sidebar loads → `useInfiniteQuery` fetches first page →
`server/routers/conversation.ts` (list with cursor) → renders items →
scroll to bottom → `IntersectionObserver` fires → `fetchNextPage` called →
next page fetched with cursor.

Verify:
- [ ] Backend returns `{ items, nextCursor }` shape
- [ ] `nextCursor` is `undefined` when no more pages
- [ ] Frontend accumulates pages correctly

### Flow F: Error Recovery (Retry)
Trace: Stream fails → `ERROR` chunk dispatched → `use-stream-state.ts` sets
`phase: 'error'` → `stream-progress.tsx` shows error UI → user clicks Retry →
`retry()` called → `sendMessage(streamState.lastInput)` → new stream starts.

Verify:
- [ ] `lastInput` is preserved in state through the error (RESET keeps it)
- [ ] `onRetry` prop wired from `chat-container.tsx` to `stream-progress.tsx`
- [ ] Retry dispatches `SAVE_INPUT` again with the same input

---

## Wave 7 — Security Deep-Dive

Read these files with a security mindset:
- `src/lib/auth/config.ts` (Auth.js adapter, token encryption)
- `src/lib/security/token-crypto.ts`
- `src/lib/security/rate-limit.ts`
- `src/server/trpc.ts` (auth middleware)
- `src/server/context.ts`
- `src/server/routers/upload.ts` (GCS presigned URLs)
- `src/middleware.ts`

Check:
- [ ] OAuth tokens encrypted at rest? Is `encryptAccountTokens` called in
      `DrizzleAdapter` wrapper?
- [ ] Is rate limiting applied to the chat stream subscription?
- [ ] Is rate limiting applied to upload presigned URL requests?
- [ ] Presigned URL expiry: is it `LIMITS.UPLOAD_URL_EXPIRY_MS` from constants?
- [ ] GCS bucket: is the uploaded file path scoped to the user ID to prevent
      path-traversal access to other users' uploads?
- [ ] Attachment confirm: does `confirmUpload` verify the `attachmentId` was created
      by the requesting user (not just that the ID exists)?
- [ ] Is there any place where `error.message` from an internal error reaches the
      client via a tRPC response?
- [ ] Does `middleware.ts` use `auth()` from Auth.js to check session, not a custom
      cookie check?
- [ ] Search mode: Is Tavily API key never exposed to the client?

---

## Wave 8 — Build, Performance & Code Quality

Run these commands and record the output:

```bash
bun run type-check
```
Expected: zero errors. Quote any errors found.

```bash
bun run lint
```
Expected: zero warnings or errors. Quote any found.

```bash
SKIP_ENV_VALIDATION=1 bun run build
```
Expected: clean build with all API routes showing `ƒ (Dynamic)`.
Quote any errors found.

Then read these files for code quality:
- `src/features/chat/components/message-list.tsx`
- `src/features/chat/hooks/use-auto-scroll.ts`
- `src/lib/db/client.ts`
- `src/config/env.ts`
- `Dockerfile`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/trpc/[trpc]/route.ts`

Check:
- [ ] `Dockerfile`: No secret `ARG`/`ENV` in builder stage (only `NEXT_PUBLIC_APP_URL`
      and `SKIP_ENV_VALIDATION=1` are acceptable)?
- [ ] `env.ts`: `loadEnv()` function checks `SKIP_ENV_VALIDATION === '1'` before
      throwing?
- [ ] `client.ts` (DB): Uses build-phase placeholder URL when
      `SKIP_ENV_VALIDATION === '1'`?
- [ ] Auth route: has `export const dynamic = 'force-dynamic'`?
- [ ] tRPC route: has `export const dynamic = 'force-dynamic'`?
- [ ] `message-list.tsx`: Does NOT import or use `bottomRef` (removed in
      virtualization refactor)?
- [ ] `use-auto-scroll.ts`: Accepts `containerRef` and `scrollToBottom` as parameters
      (not owned internally)?
- [ ] No `any` types anywhere in the codebase (run: `grep -r ": any\|as any" src/`)?
- [ ] No `// @ts-ignore` without a justification comment?
- [ ] No hardcoded hex colors in component files (`#09090b`, `rgba(` etc)?
- [ ] No `px-[16px]` or similar pixel-value Tailwind classes?
- [ ] All `useCallback` and `useMemo` hooks have correct dependency arrays?

Also check for these common overlooked items:
- [ ] `src/lib/utils.ts` (if it exists): Is it distinct from `src/lib/utils/cn.ts`
      or is it duplicate?
- [ ] Any component importing directly from `src/lib/db/` (should only happen in
      server routers, never in client components)?
- [ ] Any `'use client'` file importing from `src/server/`?
- [ ] Any component using `process.env` directly instead of `env` from config?

---

## Wave 8b — Accessibility Audit

For every interactive component you've already read, verify:
- [ ] All buttons have either visible text or `aria-label`?
- [ ] All form inputs have associated labels (or `aria-label`)?
- [ ] Modals/dialogs trap focus when open?
- [ ] Keyboard navigation: can the chat input, model selector, and sidebar be
      navigated without a mouse?
- [ ] Color contrast: are `--text-muted` and `--text-ghost` tokens used only for
      truly non-critical UI (not for important text)?
- [ ] All `<img>` elements have meaningful `alt` text?
- [ ] Do animated elements respect `useReducedMotion()`?

---

## Final Violations Report Format

After all 8 waves, compile one report in this exact format. Do not skip categories
even if empty — write "None found" for clean categories.

```
# Farasa Pre-Production Audit — Violations Report

## Summary
- Total violations found: N
- Category breakdown: Design (N) | Security (N) | Features (N) | Performance (N) | Code Quality (N) | Accessibility (N)

## Category: Design System Violations
| # | File | Line | Quoted Code | Violation | Expected |
|---|------|------|-------------|-----------|---------|
| D1 | src/foo/bar.tsx | 42 | `className="gap-3"` | Should be gap-2 | `className="gap-2"` |

## Category: Security Violations
(same table format)

## Category: Missing / Broken Features
(same table format — a feature is "missing" only if you traced the full stack and found a gap)

## Category: Performance
(same table format)

## Category: Code Quality (CLAUDE.md violations)
(same table format — cite the rule number e.g. R01, R07)

## Category: Accessibility
(same table format)

## Confirmed Correct (not violations — verified by reading the code)
List key items that were checked and confirmed correct, with file:line evidence.
This prevents re-auditing things that are already fixed.
```

---

## STOP HERE

After writing the violations report, STOP. Do not write any remediation plan.

Ask the user:
> "Violations report complete. N violations found across N categories. Please
> review the report above. Reply 'approved' to proceed with the remediation plan,
> or provide corrections/additions."

Only after explicit user approval, write the remediation plan using the
`superpowers:writing-plans` skill (see Required Skills section above for format).

The remediation plan must:
- Have exactly one task per violation (no combining unrelated fixes)
- Include the exact file path and line number for each fix
- Include the quoted wrong code and the exact replacement code
- Have no tasks for items marked "Confirmed Correct"
- Have `bun run type-check && bun run lint` as a verification step after each task
- Have a commit after each task

---

*This audit prompt was written after 50+ violations were already fixed. Its purpose
is to find what was missed, what regressed, and what was never caught.*
