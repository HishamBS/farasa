[![CI](https://github.com/hishambs/farasa/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hishambs/farasa/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2+-fbf0df?logo=bun&logoColor=000)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)](LICENSE)

# Farasa

Multi-modal AI chat built around a live LLM router that selects from 100+ models per request —
real-time SSE streaming, web search, file attachments, voice I/O, and agent-rendered UI components.

Next.js 15 · tRPC v11 SSE · React 19 · Bun · Neon Postgres · GCP Cloud Run

**[Live Demo →](https://farasa.binseddeq.dev)** · [Architecture](#architecture) ·
[API Reference](#api-reference) · [Setup](#setup)

---

## Quick Start

> **Evaluators:** 3 steps to a running app.

### Prerequisites

- [Bun](https://bun.sh) `>= 1.0`
- [Docker](https://docs.docker.com/get-docker/) (for local Postgres — image pulled automatically)
- Google OAuth credentials ([create here](https://console.cloud.google.com/apis/credentials))

### 1. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable                      | Where to get it                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `AUTH_SECRET`                 | Run: `openssl rand -base64 32`                                                  |
| `AUTH_GOOGLE_ID`              | Google Cloud Console → OAuth 2.0 Client IDs                                     |
| `AUTH_GOOGLE_SECRET`          | Same as above                                                                   |
| `OPENROUTER_API_KEY`          | [openrouter.ai/keys](https://openrouter.ai/keys)                                |
| `DATABASE_URL`                | Pre-filled: `postgresql://farasa_user:farasa_password@localhost:5433/farasa_db` |
| `RUNTIME_CONFIG_JSON`         | Required runtime/business config JSON (see `.env.example`)                      |
| `RUNTIME_CONFIG_CACHE_TTL_MS` | Optional in-memory cache TTL for runtime config snapshots                       |

Add `http://localhost:3010/api/auth/callback/google` to your OAuth client's **Authorized redirect URIs**.

### 2. Install dependencies

```bash
bun install
```

### 3. Start

```bash
./start.sh dev:hybrid
```

This single command handles everything:

- Pulls and starts a local PostgreSQL container via Docker
- Generates and applies the database schema
- Starts the Next.js development server

**App:** http://localhost:3010 — sign in with Google to begin.

---

## Platform Script

`start.sh` is the single entry point for all local development tasks. Run without arguments to open an interactive menu, or pass a command directly:

```bash
./start.sh                 # interactive menu
./start.sh dev:hybrid      # recommended for local dev (Docker Postgres + native Next.js)
```

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `dev`         | Native dev server on port 3010                   |
| `dev:hybrid`  | Docker Postgres + native `bun dev` (recommended) |
| `dev:docker`  | Full Docker stack (app + Postgres)               |
| `stop`        | Stop all running services                        |
| `status`      | Show running service status                      |
| `logs`        | Follow dev server logs (live, colored)           |
| `db:migrate`  | Apply pending database migrations                |
| `db:generate` | Generate migration files from schema changes     |
| `db:push`     | Push schema directly to DB (dev only)            |
| `db:studio`   | Open Drizzle Studio on `:4983`                   |
| `typecheck`   | TypeScript type-check (`tsc --noEmit`)           |
| `lint`        | ESLint                                           |
| `build`       | Production build                                 |
| `validate`    | Validate `.env` configuration against schema     |
| `cleanup`     | Force-kill all tracked processes                 |

---

## Why Farasa?

**فراسة** (_farāsa_) — in Arabic, the faculty of perceptive insight; reading intent and meaning
from subtle observation, perceiving what is not said as clearly as what is.

Most AI assistants lock you to a single model. You get GPT-4o for every query, or Claude,
regardless of whether the task calls for raw speed, deep reasoning, multimodal analysis, or
structured output. Farasa is different: a fast LLM classifier reads each message and routes it to
the optimal model from a live registry of over a hundred. A quick question goes to a fast, cheap
model. Complex analysis goes to the most capable reasoning model available.

This routing is فراسة. The system perceives the nature of a request before responding to it — not
through rigid rules, but through inference. That discernment is the core of what makes this
platform distinct.

---

## Features

| Feature                 | Details                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **LLM auto-router**     | Gemini Flash classifies each prompt and selects the optimal model from 100+ providers; capability-aware (vision, thinking, tools, context) with a live animated routing decision UI showing model, reasoning, and capabilities |
| **Real-time streaming** | 7-phase SSE stream: routing → thinking → tools → text → A2UI                                                                                                                                                                   |
| **Web search**          | Tavily — structured result cards with source attribution and image gallery                                                                                                                                                     |
| **File attachments**    | Multi-modal uploads via GCS presigned URLs (images, PDFs, text)                                                                                                                                                                |
| **Voice I/O**           | Server-side STT via OpenRouter Whisper + TTS via Qwen; explicit typed errors when unsupported/unavailable (no silent client fallback)                                                                                          |
| **Group Mode**          | Compare 2–5 models simultaneously; real-time tabbed streaming per model; AI synthesis via user-selected judge model                                                                                                            |
| **Agent UI (A2UI)**     | AI generates interactive React components via `@a2ui-sdk`                                                                                                                                                                      |
| **Conversation mgmt**   | Full CRUD, sidebar navigation, pinning, Markdown export                                                                                                                                                                        |
| **Auth & security**     | Google OAuth, per-user DB isolation, sliding-window rate limiting, AES-GCM token crypto                                                                                                                                        |
| **PWA**                 | Offline-capable, installable, `@serwist/next` service worker                                                                                                                                                                   |
| **Theming**             | CSS custom property token system, zero-flash dark/light switching                                                                                                                                                              |

---

## Architecture

```mermaid
graph LR
    Browser["Browser\nReact 19"]

    subgraph SRV ["Next.js 15 + Bun Runtime"]
        MW["Auth Middleware"]
        tRPC["tRPC Handler"]
    end

    subgraph API ["Routers"]
        chat["chat.stream"]
        conv["conversation"]
        model["model"]
        srch["search"]
        upl["upload"]
        grp["group"]
    end

    subgraph INFRA ["Infrastructure"]
        OR[("OpenRouter\n100+ LLMs")]
        PG[("Neon Postgres")]
        TV[("Tavily")]
        GCS[("Cloud Storage")]
    end

    Browser -->|"SSE / HTTP"| MW
    MW --> tRPC
    tRPC --> chat
    tRPC --> conv
    tRPC --> model
    tRPC --> srch
    tRPC --> upl
    tRPC --> grp
    chat --> OR
    chat --> PG
    conv --> PG
    srch --> TV
    upl --> GCS
    grp --> OR
    grp --> PG

    classDef client fill:#1a1a2e,stroke:#e94560,color:#e0e0e0
    classDef server fill:#16213e,stroke:#0f3460,color:#e0e0e0
    classDef router fill:#0f3460,stroke:#533483,color:#e0e0e0
    classDef infra fill:#533483,stroke:#e94560,color:#e0e0e0

    class Browser client
    class MW,tRPC server
    class chat,conv,model,srch,upl,grp router
    class OR,PG,TV,GCS infra
```

`splitLink` routes SSE subscriptions through `httpSubscriptionLink` and queries/mutations through
`httpBatchLink`. A single endpoint at `/api/trpc/[trpc]` serves both.

The streaming protocol is a `StreamChunk` discriminated union emitted in phase order:
`status → model_selected → thinking → tool_start → tool_result → text → a2ui → done`. The client
state machine (`useChatStream`) renders all phases simultaneously — no waiting for the stream to
close before showing partial output.

### Runtime Config SSOT

All runtime business behavior is resolved through `RuntimeConfigService` in
`src/lib/runtime-config/service.ts` with this precedence:

1. user override (DB)
2. tenant override (DB)
3. system config (DB)
4. environment (`RUNTIME_CONFIG_JSON`)

No runtime/business fallback defaults are hardcoded in feature codepaths. If required keys are
missing, the app fails with typed runtime-config errors instead of silently degrading.

---

## Tech Stack

| Layer             | Technology                                               | Version       | Why                                                              |
| ----------------- | -------------------------------------------------------- | ------------- | ---------------------------------------------------------------- |
| Runtime           | [Bun](https://bun.sh)                                    | 1.2+          | Native TS execution, fast installs                               |
| Framework         | [Next.js](https://nextjs.org)                            | 15 App Router | RSC + middleware + React 19                                      |
| API               | [tRPC](https://trpc.io)                                  | v11           | End-to-end types, zero codegen, SSE built-in                     |
| Client state      | [TanStack Query](https://tanstack.com/query)             | v5            | Caching, optimistic updates                                      |
| AI gateway        | [OpenRouter](https://openrouter.ai)                      | —             | One key, 100+ models, live pricing metadata                      |
| AI SDK            | `@openrouter/sdk`                                        | pinned        | Native OpenRouter SDK — typed provider routing, reasoning, tools |
| Agent UI          | `@a2ui-sdk/react`                                        | v0.4          | Agent-generated interactive components                           |
| Validation        | [Zod](https://zod.dev)                                   | latest        | SSOT — all TS types derived via `z.infer`                        |
| Auth              | [Auth.js](https://authjs.dev)                            | v5            | Google OAuth, middleware-native                                  |
| ORM               | [Drizzle ORM](https://orm.drizzle.team)                  | latest        | No query engine, SQL-transparent, edge-safe                      |
| Database          | [Neon Postgres](https://neon.tech)                       | serverless    | Scales to zero, HTTP driver                                      |
| Storage           | [Google Cloud Storage](https://cloud.google.com/storage) | —             | Presigned URL direct uploads                                     |
| Search            | [Tavily](https://tavily.com)                             | latest        | AI-optimised search with image results                           |
| Styling           | [Tailwind CSS](https://tailwindcss.com)                  | v4            | CSS custom property token system                                 |
| UI                | [shadcn/ui](https://ui.shadcn.com)                       | latest        | Owned, accessible components                                     |
| Animation         | [Framer Motion](https://www.framer.com/motion/)          | latest        | Spring physics, FLIP, gestures                                   |
| Code highlighting | [Shiki](https://shiki.matsu.io)                          | latest        | VS Code grammar engine, SSR-safe                                 |
| Markdown          | react-markdown + plugins                                 | latest        | GFM, sanitized HTML, KaTeX math                                  |
| PWA               | [@serwist/next](https://serwist.pages.dev)               | latest        | Service worker, offline shell                                    |
| Deployment        | [GCP Cloud Run](https://cloud.google.com/run)            | —             | `me-central1`, scales to zero                                    |

---

## Project Structure

```
src/
├── app/                         # Next.js 15 App Router
│   ├── (auth)/login/            # Google OAuth sign-in
│   ├── (protected)/chat/        # Main chat UI (auth-gated)
│   │   └── [id]/                # Conversation view
│   ├── api/
│   │   ├── trpc/[trpc]/         # tRPC handler — SSE + batch
│   │   ├── auth/[...nextauth]/  # Auth.js OAuth callbacks
│   │   └── health/              # Load balancer health check
│   └── manifest.ts / sw.ts      # PWA manifest + service worker entry
│
├── server/
│   ├── routers/
│   │   ├── chat.ts              # 7-phase SSE streaming
│   │   ├── conversation.ts      # CRUD, pagination, pin, Markdown export
│   │   ├── model.ts             # Live registry — OpenRouter with 1h cache
│   │   ├── runtime-config.ts    # Runtime config read/invalidate procedures
│   │   ├── search.ts            # Tavily web search
│   │   └── upload.ts            # GCS presigned URL + confirmation
│   └── trpc.ts                  # Context, auth middleware, rate limiting
│
├── features/
│   ├── chat/                    # Container, input, message list, model selector
│   ├── stream-phases/           # Phase bar, thinking block, tool execution cards
│   ├── a2ui/                    # A2UI renderer + shadcn catalog adapters
│   ├── search/                  # Result cards, image gallery
│   ├── sidebar/                 # Conversation list, navigation, user menu
│   ├── markdown/                # Renderer, Shiki blocks, copy button
│   ├── voice/                   # STT input, TTS playback
│   ├── group/                   # Multi-model comparison, tabs, synthesis
│   └── pwa/                     # Install prompt, offline banner
│
├── lib/
│   ├── ai/                      # OpenRouter client, model router, registry, tools
│   ├── db/                      # Drizzle schema, relations, client, migrations
│   ├── runtime-config/          # Dynamic runtime config resolution + cache
│   ├── upload/                  # GCS presigned URL generation + sanitization
│   ├── search/                  # Tavily wrapper
│   ├── security/                # Sliding-window rate limiter, AES-GCM token crypto
│   └── utils/                   # cn, format, error messages, motion presets
│
├── schemas/                     # Zod SSOT — message, conversation, model, search, upload, runtime-config
├── config/                      # constants.ts, env.ts, routes.ts, models.ts, prompts.ts
├── types/                       # Pure TypeScript domain types
├── styles/themes.css            # CSS custom properties — dark + light token system
└── middleware.ts                # Auth guard on /chat/* and /api/trpc/*
```

---

## Database Schema

Nine tables in `src/lib/db/schema.ts`. All foreign keys use `onDelete: 'cascade'`. All timestamps use `withTimezone`.

| Table                | Purpose                        | Key Columns                                                                                                                                   |
| -------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`              | Identity                       | id, name, email (unique), image                                                                                                               |
| `accounts`           | OAuth provider links (Auth.js) | userId FK, provider, providerAccountId                                                                                                        |
| `sessions`           | Session tokens (Auth.js)       | sessionToken PK, userId FK, expires                                                                                                           |
| `verificationTokens` | Email verification (Auth.js)   | identifier + token (compound PK)                                                                                                              |
| `conversations`      | Chat sessions                  | userId FK, title, model, isPinned. Index: (userId, updatedAt)                                                                                 |
| `messages`           | Chat messages + metadata       | conversationId FK, role, content, metadata JSONB, clientRequestId, streamSequenceMax, tokenCount. Index: (conversationId, createdAt)          |
| `runtimeConfigs`     | Runtime config overrides       | scope (`system\|tenant\|user`), scopeKey, payload JSONB. Resolved in precedence order: user → tenant → system → `RUNTIME_CONFIG_JSON` env var |
| `userPreferences`    | Per-user UI settings           | userId PK FK, theme, sidebarExpanded, defaultModel, groupModels (jsonb, string[]), groupJudgeModel (text)                                     |
| `attachments`        | File uploads                   | userId FK, messageId FK, fileName, storageUrl, confirmedAt                                                                                    |

---

## API Reference

All procedures are type-safe tRPC at `/api/trpc/[trpc]`.

### `chat.stream`

```ts
// SSE subscription — emits StreamChunk discriminated union
chat.stream({
  model: string | 'auto', // model ID or 'auto' to invoke the LLM router
  messages: Message[],
  sessionId: string,
  mode: 'chat' | 'search',
  streamRequestId: string, // required request lineage ID
  attempt: number, // required internal retry attempt counter
  attachmentIds?: string[],
  skipUserInsert?: boolean,
})

// Emitted in phase order:
{ type: 'status'; phase: StreamPhase; message: string }
{ type: 'model_selected'; model: ModelConfig; reasoning: string }
{ type: 'thinking'; content: string; isComplete: boolean }
{ type: 'tool_start'; toolName: string; input: unknown }
{ type: 'tool_result'; toolName: string; result: unknown }
{ type: 'text'; content: string }
{ type: 'a2ui'; jsonl: string }
{ type: 'done'; usage?: TokenUsage }
{ type: 'error'; message: string; code?: string }
```

### `chat.cancel`

```ts
chat.cancel({
  conversationId: string,
  streamRequestId: string,
})
```

### Conversations

```ts
conversation.list({ limit?, cursor?, search? })  // Paginated — pinned first
conversation.getById({ id })                      // Conversation + all messages
conversation.create({ title? })                   // New conversation
conversation.updateTitle({ id, title })           // Rename
conversation.delete({ id })                       // Cascade: messages + attachments
conversation.generateTitle({ conversationId })    // LLM-generated title
conversation.exportMarkdown({ id })               // Markdown string
```

### Group Mode

```ts
group.stream({              // SSE subscription — rate-limited
  conversationId?: string,
  content: string,
  models: string[],         // 2–5 model IDs validated against registry
  attachmentIds?: string[],
})
// Emits (in order): group_stream_event (conversation_created, user_message_saved)
//                   group_model_chunk (per model, interleaved)
//                   group_done (groupId, completedModels)

group.synthesize({          // SSE subscription
  groupId: string,
  conversationId: string,
  judgeModel: string,       // validated against registry
})
// Emits: group_synthesis_chunk (content) → group_synthesis_done (groupId)
```

### Models, Search & Upload

```ts
model.list()                                      // All models — 1h cache
model.getById({ id })                             // Metadata + capabilities + pricing
model.refresh()                                   // Invalidate cache

runtimeConfig.get()                               // Resolved dynamic runtime config
runtimeConfig.invalidate({ scope? })              // Clear cache snapshots

search.web({ query, maxResults? })                // Tavily → results + images
upload.presignedUrl({ filename, mimeType })       // GCS signed URL + DB record
upload.confirmUpload({ id, contentType })         // Mark confirmed after upload
```

---

## Environment Variables

| Variable                         | Required | Description                                                                                                                     |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                    | ✓        | Auth.js signing secret — `bunx auth secret`                                                                                     |
| `AUTH_GOOGLE_ID`                 | ✓        | Google OAuth client ID                                                                                                          |
| `AUTH_GOOGLE_SECRET`             | ✓        | Google OAuth client secret                                                                                                      |
| `OPENROUTER_API_KEY`             | ✓        | [openrouter.ai/keys](https://openrouter.ai/keys)                                                                                |
| `DATABASE_URL`                   | ✓        | Neon Postgres connection string                                                                                                 |
| `TAVILY_API_KEY`                 | ✓        | Starts with `tvly-` — [app.tavily.com](https://app.tavily.com)                                                                  |
| `GCS_BUCKET_NAME`                | ✓        | Google Cloud Storage bucket                                                                                                     |
| `GCS_PROJECT_ID`                 | ✓        | GCP project ID                                                                                                                  |
| `GOOGLE_APPLICATION_CREDENTIALS` | —        | Service account JSON path (local dev only)                                                                                      |
| `NEXT_PUBLIC_APP_URL`            | ✓        | App base URL — OAuth callbacks + OpenRouter Referer                                                                             |
| `AUTH_URL`                       | —        | Auth.js callback URL (defaults to `NEXT_PUBLIC_APP_URL`)                                                                        |
| `RUNTIME_CONFIG_JSON`            | —        | Runtime config override JSON. Leave empty to use DB-seeded values. Resolution order: user → tenant → system (DB) → this env var |
| `RUNTIME_CONFIG_CACHE_TTL_MS`    | —        | Runtime config cache TTL in milliseconds                                                                                        |
| `NODE_ENV`                       | —        | `development` \| `production` (set by runtime)                                                                                  |

---

## Setup

**Prerequisites**: [Bun 1.2+](https://bun.sh/docs/installation), Neon Postgres, GCP project with
Cloud Storage + Google OAuth, OpenRouter and Tavily API keys.

```bash
bun install
cp .env.example .env  # fill in credentials
bun run db:migrate
bun run dev           # http://localhost:3010
```

```bash
# Quality gates — also enforced by git hooks
bun run type-check && bun run lint && bun run format:check && bun test
```

```bash
# Database
bun run db:generate  # generate migrations from schema changes
bun run db:migrate   # apply to Neon
bun run db:push      # direct push (dev only)
bun run db:studio    # Drizzle Studio on :4983
```

---

## Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3010 \
  --build-arg DATABASE_URL=postgresql://farasa_user:farasa_password@localhost:5433/farasa_db \
  -t farasa .

./start.sh                                        # interactive menu
docker compose -f docker/docker-compose.yml up    # direct
```

| Service  | Port     | Description                          |
| -------- | -------- | ------------------------------------ |
| Next.js  | **3010** | Main application                     |
| Postgres | 5433     | PostgreSQL (internal: 5432)          |
| Adminer  | 8080     | DB admin UI (`./start.sh --adminer`) |

---

## Deployment

CI runs on every push and PR. CD deploys to Cloud Run on every push to `main`.

### One-time GCP setup

```bash
export PROJECT_ID=your-project-id

gcloud services enable run.googleapis.com artifactregistry.googleapis.com

gcloud artifacts repositories create farasa \
  --repository-format=docker --location=me-central1

gcloud iam service-accounts create farasa-gh-actions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:farasa-gh-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:farasa-gh-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud iam service-accounts keys create key.json \
  --iam-account=farasa-gh-actions@$PROJECT_ID.iam.gserviceaccount.com
# Copy key.json contents to GitHub secret GCP_SA_KEY, then:
rm key.json
```

### GitHub configuration

**Secrets**: `GCP_SA_KEY`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`OPENROUTER_API_KEY`, `DATABASE_URL`, `TAVILY_API_KEY`, `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`

**Variables**: `GCP_PROJECT_ID`, `GCP_REGION=me-central1`,
`GCP_ARTIFACT_REGISTRY=me-central1-docker.pkg.dev`, `CLOUD_RUN_SERVICE_NAME=farasa`,
`NEXT_PUBLIC_APP_URL=<your Cloud Run URL>`

---

## Design Decisions

**SSE over WebSocket** — Server-Sent Events traverse corporate proxies without an upgrade
handshake, reconnect automatically on drop, and need no extra infrastructure. For unidirectional
AI streams they are strictly simpler. `httpSubscriptionLink` is already in place; WebSocket
support can be added without changing the router interface if bidirectional messaging is needed.

**Zod as the single source of truth** — Every type that crosses a module boundary lives in
`src/schemas/` as a Zod schema. TypeScript types are derived exclusively via
`z.infer<typeof Schema>`, never handwritten. The same schema validates tRPC inputs, database
writes, and client-side forms — one change propagates everywhere with no drift.

**OpenRouter over direct provider SDKs** — One API key through the native `@openrouter/sdk`
replaces a dozen provider SDKs. The live model registry fetches all available
models with pricing and capability metadata from `/api/v1/models`, cached for one hour. The LLM
router classifies intent and selects the optimal model per request, surfacing its reasoning in
real time.

**Dynamic runtime config over hardcoded business constants** — Chat behavior, retry policy, model
routing policy, UX status copy, limits, safety policy, and feature toggles resolve through
`RuntimeConfigService` with strict schema validation. Runtime codepaths do not silently fallback to
hardcoded business defaults when required config keys are missing.

**A2UI for agent-rendered components** — Rather than hardcoding every possible output format,
`@a2ui-sdk/react` lets the AI emit structured component trees via the A2UI JSONL protocol. Custom
catalog adapters map those types to shadcn/ui components, keeping AI-generated and hand-coded
surfaces on the same design system. All A2UI chunks are validated before render.

**CSS custom property token system** — All design tokens — colors, shadows, radii — are CSS
custom properties in `src/styles/themes.css`. Components reference `var(--bg-surface)` and
`var(--accent)`, never hardcoded hex values or Tailwind color utilities. Dark/light mode is a
single class toggle on `:root` with zero JavaScript layout flash.

**Whisper UI language** — The protected chat experience follows the `mockups/1-whisper.html`
visual grammar: glass sidebar shell, editorial assistant prose, compact titlebar, and explicit
phase rail (`Routed → Thinking → Responding → Done`). Parity checkpoints and capture workflow are
documented in:

- `docs/WHISPER_UI_PARITY_CHECKLIST.md`
- `docs/WHISPER_VISUAL_REGRESSION.md`
- `scripts/whisper-visual-regression.mjs`

### Trade-offs

| Decision      | Chosen         | Alternative    | Rationale                                            |
| ------------- | -------------- | -------------- | ---------------------------------------------------- |
| API layer     | tRPC           | REST / GraphQL | End-to-end types without codegen; SSE built-in       |
| ORM           | Drizzle        | Prisma         | No query engine, SQL-transparent, edge-safe          |
| Streaming     | SSE            | WebSockets     | Simpler, proxy-friendly, auto-reconnect              |
| AI routing    | LLM classifier | Rule-based     | Adapts to novel prompt patterns automatically        |
| Auth          | Auth.js v5     | Lucia / custom | Maintained, Google OAuth built-in, middleware-native |
| Rate limiting | In-memory      | Redis          | One instance; Redis upgrade path documented below    |

---

## Scaling Notes

Documented upgrade paths for the current single-instance deployment:

| Concern            | Current                 | Path                                                |
| ------------------ | ----------------------- | --------------------------------------------------- |
| Rate limiting      | In-memory, per-instance | Redis / Upstash shared store                        |
| Observability      | None                    | OpenTelemetry → Cloud Trace                         |
| Provider failover  | None                    | Secondary OpenRouter endpoint + exponential backoff |
| DB connections     | Neon serverless HTTP    | PgBouncer for sustained load                        |
| Multi-user collab  | SSE unidirectional      | Socket.IO or Partykit                               |
| E2E tests          | Schema unit tests       | Playwright — auth flows + streaming scenarios       |
| Content moderation | None                    | OpenAI Moderation API or Perspective API            |
| Cost visibility    | Token counts stored     | Per-user billing dashboard + budget alerts          |
| Search latency     | Uncached                | Redis TTL keyed by query hash                       |
| Asset delivery     | Direct GCS URLs         | Cloud CDN in front of GCS                           |

---

## Contributing

```
feat(chat): add thinking block expansion animation
fix(upload): prevent orphaned attachments after timeout
chore(ci): pin setup-bun to v2
```

Types: `feat | fix | chore | docs | style | refactor | perf | test | build | ci | revert`

| Hook         | When         | Runs                     |
| ------------ | ------------ | ------------------------ |
| `pre-commit` | `git commit` | lint-staged + type-check |
| `commit-msg` | `git commit` | commitlint               |
| `pre-push`   | `git push`   | full test suite + build  |

Branch strategy: `main` (CI-gated) → `dev` (integration) ← `feat/*`, `fix/*`.

---

## License

[MIT](LICENSE)
