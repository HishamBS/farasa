# AI Chat System — Complete Technical Specification v2

## Document Purpose

This is the definitive, locked specification for the AI Chat System project. Every architectural decision, feature, engineering principle, file path, schema, implementation detail, and design decision is documented here. This document serves as the single source of truth for development and as interview preparation material.

---

## 1. Project Identity

| Field             | Value                                                |
| ----------------- | ---------------------------------------------------- |
| Project Name      | `ai-chat-system`                                     |
| Runtime           | Bun 1.5+                                             |
| Framework         | Next.js 15 (App Router) + React 19                   |
| Language          | TypeScript 5.x, strict mode, zero `any`              |
| Package Manager   | Bun                                                  |
| Module Target     | ESNext                                               |
| Deployment Target | GCP Cloud Run (`me-central1` — Dammam, Saudi Arabia) |
| Database Host     | Neon Postgres (serverless)                           |
| AI Gateway        | OpenRouter (unified access to all models)            |
| Protocol Version  | A2UI v0.4 for agent-generated UIs                    |

---

## 2. Complete Technology Stack

| Layer              | Technology                                 | Version             | Justification                                                    |
| ------------------ | ------------------------------------------ | ------------------- | ---------------------------------------------------------------- |
| Runtime            | Bun                                        | 1.5+                | Fast startup, native TypeScript, Next.js 15 compatible           |
| Framework          | Next.js                                    | 15 (App Router)     | Spec requirement, RSC, middleware, React 19                      |
| API Layer          | tRPC                                       | v11                 | End-to-end type safety for all operations including streaming    |
| Client State       | TanStack Query                             | v5 (via tRPC React) | Caching, optimistic updates, automatic invalidation              |
| AI Gateway         | OpenRouter                                 | latest              | Unified OpenAI-compatible API for all model providers            |
| AI SDK             | `@openrouter/sdk`                          | pinned              | Native OpenRouter SDK — typed reasoning, provider routing, tools |
| Agent UI           | `@a2ui-sdk/react`                          | v0.4                | Official React renderer for Google A2UI protocol                 |
| A2UI Types         | `@a2ui-sdk/types`                          | v0.4                | TypeScript types for A2UI protocol messages                      |
| A2UI Utils         | `@a2ui-sdk/utils`                          | v0.4                | Utility functions for A2UI value resolution                      |
| Validation         | Zod                                        | latest              | SSOT — schemas define runtime validation and TypeScript types    |
| Auth               | Auth.js (NextAuth)                         | v5                  | Google OAuth, middleware-level route protection                  |
| ORM                | Drizzle ORM                                | latest              | Type-safe, no codegen, SQL-transparent, schema-as-code           |
| Database           | PostgreSQL via Neon                        | serverless          | Scales to zero, HTTP/WebSocket driver, free tier                 |
| DB Driver          | `@neondatabase/serverless`                 | latest              | Works in serverless/container environments                       |
| File Storage       | Google Cloud Storage                       | latest              | Presigned URLs, direct client upload, GCP credits available      |
| Styling            | Tailwind CSS                               | v4                  | Utility-first, responsive, mobile-first                          |
| UI Components      | shadcn/ui                                  | latest              | Owned components, accessible, customizable                       |
| Motion             | Framer Motion                              | latest              | Orchestrated layout animations, spring physics, gesture support  |
| Code Highlighting  | Shiki                                      | latest              | VS Code engine, SSR-safe, all languages supported                |
| Markdown Rendering | react-markdown                             | latest              | Parse AI markdown responses                                      |
| Markdown Plugins   | remark-gfm, rehype-sanitize, rehype-katex  | latest              | GFM tables, sanitized HTML (XSS-safe), math rendering            |
| Search API         | Tavily                                     | latest              | Purpose-built for AI apps, returns structured results + images   |
| PWA                | @serwist/next                              | latest              | Service worker, offline shell, installable                       |
| Fonts              | next/font                                  | built-in            | Geist Sans + Geist Mono                                          |
| Containerization   | Docker                                     | multi-stage         | Bun base image, standalone Next.js output                        |
| Deployment         | GCP Cloud Run                              | latest              | Scales to zero, container-based, `me-central1` region            |
| SSL/Domain         | Cloud Run domain mapping or Cloudflare DNS | —                   | Managed SSL certificates                                         |

---

## 3. Engineering Principles (Non-Negotiable)

These principles apply to every file, every function, every line of code in the project. No exceptions.

### 3.1 SSOT (Single Source of Truth)

- Every data shape that crosses a module boundary is defined exactly ONCE as a Zod schema in `src/schemas/`
- TypeScript types are ALWAYS derived via `z.infer<typeof Schema>`, never handwritten as `type` or `interface` for API/DB/protocol shapes
- The Drizzle schema in `src/lib/db/schema.ts` is the single truth for all table structures
- The model registry is the single truth for all available models and their capabilities
- Environment variables are validated through a single Zod schema in `src/config/env.ts`
- Route paths are defined once in `src/config/routes.ts`
- Compile-time constants are defined once in `src/config/constants.ts`; runtime/business behavior is defined in `src/schemas/runtime-config.ts` and resolved via `src/lib/runtime-config/service.ts`
- The A2UI catalog definition is the single truth for all agent-renderable UI components
- The design token system (colors, spacing, radii, shadows) is defined once via CSS custom properties and Tailwind config — referenced everywhere, never duplicated
- Motion presets are defined once in `src/lib/utils/motion.ts` — every animated component references these presets

### 3.2 DRY (Don't Repeat Yourself)

- Zero duplicated validation logic — Zod schemas are shared across tRPC input validation, client-side validation, and database operations
- Shared utility functions live in `src/lib/utils/`
- Reusable React hooks encapsulate common patterns
- Component composition is used over copy-paste
- Provider abstractions prevent duplicating integration logic
- Motion variants and animation presets are defined once and reused across all animated components

### 3.3 SOLID

- **Single Responsibility**: Each file and module has one clear responsibility. tRPC routers are split by domain (chat, conversation, search, upload, model). Components render one thing.
- **Open/Closed**: The A2UI catalog is open for extension (add new component adapters) without modifying the renderer. The model registry can add new models without changing routing logic. The `StreamChunk` discriminated union can add new chunk types without modifying existing handlers.
- **Liskov Substitution**: All models conform to the same interface via OpenRouter's unified API. All A2UI catalog adapters conform to the component prop interfaces defined by the SDK.
- **Interface Segregation**: tRPC routers expose small, focused procedures. React hooks expose minimal return types. No god-objects.
- **Dependency Inversion**: Components depend on schemas and interfaces, not concrete implementations. The chat stream hook depends on the `StreamChunk` type, not on OpenRouter directly. The A2UI surface component depends on the SDK's `A2UIMessage` type, not on the transport mechanism.

### 3.4 No Literal Strings

- All route paths are constants in `src/config/routes.ts`
- Runtime error/status copy is sourced from runtime config, never duplicated in feature modules
- All OpenRouter model IDs are sourced from the model registry, never hardcoded in components or routers
- All GCS bucket names, collection names, API endpoints are in `src/config/constants.ts` or `src/config/env.ts`
- Runtime prompt templates and wrappers are sourced from runtime config
- All A2UI component type strings are referenced from the catalog definition
- All status phase messages are runtime-config values, never inline

### 3.5 No Inline Types

- Every type that crosses a module boundary lives in `src/schemas/` (Zod-derived) or `src/types/` (pure TypeScript types for internal use only)
- Component props use dedicated schemas or types, never inline `{ x: string; y: number }`
- No `as any`, no `as unknown`, no type assertions unless absolutely unavoidable — and then with a comment explaining why
- tRPC router inputs and outputs are always Zod schemas defined in `src/schemas/`, never inline

### 3.6 No Magic Numbers

- Runtime limits (max message length, max file size, pagination defaults, token limits) are in runtime config
- Runtime timeouts, retry counts, and stream policy values are in runtime config
- All breakpoints are referenced from Tailwind config, never hardcoded pixel values
- All animation durations, spring configs, and easings are constants in `MOTION` object
- API rate limits and upload expiry durations are runtime-config values
- Runtime UX timing values (e.g., auto-scroll threshold, copy-feedback timing) are runtime-config values

### 3.7 No Pixels — Ever

- All spacing uses Tailwind's rem-based scale (`p-4`, `gap-6`, `mt-8`)
- All font sizes use Tailwind's typographic scale (`text-sm`, `text-base`, `text-lg`)
- All breakpoints use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`)
- No custom pixel values in any component (`p-[16px]` is forbidden)
- All widths use `max-w-*`, `w-full`, `flex`, `grid`, or percentage-based values
- No fixed widths anywhere — layouts breathe at every viewport size
- Border radii use Tailwind's scale (`rounded-lg`, `rounded-xl`), never custom pixel values

### 3.8 Strict TypeScript Configuration

- `strict: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- `forceConsistentCasingInFileNames: true`, `isolatedModules: true`
- No `// @ts-ignore` or `// @ts-expect-error` without a justification comment
- No `any` type anywhere in the codebase

### 3.9 Backend Authority (Non-Negotiable)

The server is the single authority for all business logic, rules, and decisions. Frontend components are dumb UI — they render state and delegate actions, never compute outcomes.

- All model routing decisions happen in `server/routers/chat.ts`
- All conversation management rules are enforced in tRPC procedures
- All rate limiting, ownership validation, and security checks are server-side only
- Frontend hooks (`use-chat-stream`, `use-chat-input`) manage UI state; they never embed business rules
- Components call tRPC mutations/subscriptions and render results — nothing more
- If logic could affect data integrity or security, it belongs exclusively on the server
- The client state machine (`useChatStream`) is a renderer for server-emitted stream chunks, not a decision-maker

### 3.10 Zero Dead Air — The UX Principle

**The user must never stare at a static screen for more than ~500ms without visible feedback.** Every phase of every operation is surfaced to the user in real-time:

- When a message is sent, feedback is immediate — the UI transitions to an active state within the same animation frame
- When the auto-router is selecting a model, the user sees it happening with a description of what's being decided
- When the AI is thinking/reasoning, the thinking content streams in real-time inside an expandable block — exactly like Claude.ai
- When a tool is being used (web search, file reading), the user sees what tool is running and what input it received
- When text is streaming, tokens appear at rendering frame rate (~60fps) — no batching, no delays, no chunky word-by-word appearance
- When an A2UI surface is being generated, the user sees components materialize progressively
- When an error occurs, it appears immediately with context and a retry action
- Every phase transition is animated — nothing pops, everything flows

This is not a nice-to-have. This is a core architectural requirement that affects the streaming protocol, the chunk types, the client state machine, and the component hierarchy.

---

## 4. Design System

This section defines the complete visual language of the application. Every component, every screen, every interaction derives from these specifications.

### 4.1 Design Philosophy

**The Three Words**: Clean. Alive. Layered.

- **Clean**: Generous whitespace. No visual clutter. Every element earns its place. Information density is high but never feels cramped.
- **Alive**: Nothing is static. The interface responds to the user, to the AI, to the passage of time. Micro-animations give weight and presence to every interaction. Streaming phases make the AI feel like a living entity.
- **Layered**: Surfaces exist at different depths. The sidebar is behind the chat. The input floats above. Modals and dropdowns have real presence through blur and shadow. Glassmorphism creates a sense of physical space.

**Inspirations**: Linear (density + whitespace balance), Raycast (snappy interactions), Arc browser (bold color, personality), Vercel dashboard (dark mode elegance), Apple Music (glassmorphism done right).

### 4.2 Color System

Colors are defined as CSS custom properties in `src/styles/themes.css` and referenced via Tailwind's theme extension. Two complete palettes: dark (default) and light.

**Dark Mode (Default)**:

| Token                 | Value                 | Usage                                             |
| --------------------- | --------------------- | ------------------------------------------------- |
| `--bg-root`           | zinc-950 (#09090b)    | Page background, deepest layer                    |
| `--bg-surface`        | zinc-900 (#18181b)    | Cards, sidebar, elevated panels                   |
| `--bg-surface-hover`  | zinc-800 (#27272a)    | Hovered cards, active list items                  |
| `--bg-surface-active` | zinc-700 (#3f3f46)    | Pressed states, selected items                    |
| `--bg-glass`          | zinc-900/70           | Glassmorphic surfaces (sidebar, input, dropdowns) |
| `--bg-input`          | zinc-800/50           | Input fields, text areas                          |
| `--text-primary`      | zinc-50 (#fafafa)     | Headings, primary content                         |
| `--text-secondary`    | zinc-300 (#d4d4d8)    | Body text, descriptions                           |
| `--text-muted`        | zinc-500 (#71717a)    | Timestamps, metadata, placeholders                |
| `--text-ghost`        | zinc-600 (#52525b)    | Disabled text, very subtle labels                 |
| `--border-subtle`     | zinc-800 (#27272a)    | Subtle separation lines                           |
| `--border-default`    | zinc-700 (#3f3f46)    | Default borders on inputs, cards                  |
| `--accent`            | cyan-400 (#22d3ee)    | Primary interactive elements, links, focus rings  |
| `--accent-hover`      | cyan-300 (#67e8f9)    | Hovered interactive elements                      |
| `--accent-muted`      | cyan-400/10           | Accent backgrounds (badges, highlights)           |
| `--accent-glow`       | cyan-400/20           | Glow effects around focused/active elements       |
| `--success`           | emerald-400 (#34d399) | Completed states, confirmations                   |
| `--warning`           | amber-400 (#fbbf24)   | Warnings, caution states                          |
| `--error`             | red-400 (#f87171)     | Error states, destructive actions                 |
| `--thinking`          | violet-400 (#a78bfa)  | Thinking/reasoning phase accent                   |
| `--thinking-bg`       | violet-400/5          | Thinking block background                         |
| `--thinking-border`   | violet-400/20         | Thinking block border                             |

**Provider Colors** (model badges and selector):

| Provider  | Color       | Token                  |
| --------- | ----------- | ---------------------- |
| OpenAI    | emerald-400 | `--provider-openai`    |
| Anthropic | orange-400  | `--provider-anthropic` |
| Google    | blue-400    | `--provider-google`    |
| Meta      | indigo-400  | `--provider-meta`      |
| Groq      | rose-400    | `--provider-groq`      |
| Cerebras  | amber-400   | `--provider-cerebras`  |

**Light Mode**: Complete inversion with warm white backgrounds (zinc-50, white), dark text (zinc-900, zinc-700), same accent/provider colors at adjusted saturation. Glassmorphism uses white/70 with backdrop-blur.

### 4.3 Typography

Fonts loaded via `next/font` for zero layout shift.

| Role     | Font       | Weight        | Usage                                                     |
| -------- | ---------- | ------------- | --------------------------------------------------------- |
| UI Text  | Geist Sans | 400, 500, 600 | All interface text, labels, buttons                       |
| Code     | Geist Mono | 400, 500      | Code blocks, inline code, model names, technical metadata |
| Headings | Geist Sans | 600           | Section headings, conversation titles                     |

**Typographic Scale** (Tailwind only, never custom):

| Element            | Class                    | Usage                                     |
| ------------------ | ------------------------ | ----------------------------------------- |
| Page title         | `text-2xl font-semibold` | Login page title                          |
| Section heading    | `text-lg font-semibold`  | Sidebar sections, panel headers           |
| Conversation title | `text-sm font-medium`    | Sidebar items                             |
| Body text          | `text-sm` / `text-base`  | Message content (sm mobile, base desktop) |
| Caption            | `text-xs`                | Timestamps, token counts, metadata        |
| Code               | `text-sm font-mono`      | Code blocks and inline code               |
| Status text        | `text-xs font-medium`    | Phase indicators, progress text           |

### 4.4 Spacing & Layout Rhythm

All spacing follows Tailwind's 4-unit base (1 unit = 0.25rem). Consistent everywhere.

| Concept           | Values                        | Example                         |
| ----------------- | ----------------------------- | ------------------------------- |
| Component padding | `p-3`, `p-4`                  | Cards, inputs                   |
| Section gaps      | `gap-4`, `gap-6`              | Between messages, sidebar items |
| Page margins      | `px-4` mobile, `px-6` desktop | Chat area                       |
| Element spacing   | `gap-2`, `gap-3`              | Icon + label, badge + text      |
| Tight spacing     | `gap-1`, `gap-1.5`            | Metadata items, small badges    |

**Layout Grid**: Sidebar `w-72` desktop. Chat area `max-w-3xl` centered. A2UI panel `w-1/2` max desktop, inline mobile. Input area `max-w-3xl` centered aligned with messages.

### 4.5 Borders & Radii

| Element         | Radius         | Border                                                                |
| --------------- | -------------- | --------------------------------------------------------------------- |
| Cards, panels   | `rounded-xl`   | `border border-[--border-subtle]` or none                             |
| Buttons         | `rounded-lg`   | None (filled) or `border border-[--border-default]`                   |
| Inputs          | `rounded-lg`   | `border border-[--border-default]` focus: `ring-2 ring-[--accent]/50` |
| Message bubbles | `rounded-2xl`  | None                                                                  |
| Badges, chips   | `rounded-full` | None                                                                  |
| Dropdowns       | `rounded-xl`   | `border border-[--border-subtle]`                                     |
| Thinking block  | `rounded-xl`   | `border border-[--thinking-border]`                                   |
| Code blocks     | `rounded-lg`   | None                                                                  |
| Avatars         | `rounded-full` | None                                                                  |

### 4.6 Shadows & Depth

| Element                  | Shadow                                    |
| ------------------------ | ----------------------------------------- |
| Dropdowns, popovers      | `shadow-xl shadow-black/20`               |
| Sidebar (mobile overlay) | `shadow-2xl shadow-black/30`              |
| Input area               | `shadow-lg shadow-black/10`               |
| Cards (hover)            | `shadow-lg` transition from `shadow-none` |
| Modal backdrop           | `bg-black/60 backdrop-blur-sm`            |

### 4.7 Glassmorphism

Used on exactly three surfaces — an accent, not a default:

1. **Sidebar** (desktop): `bg-[--bg-glass] backdrop-blur-xl border-r border-[--border-subtle]`
2. **Chat input area**: `bg-[--bg-glass] backdrop-blur-xl border-t border-[--border-subtle]`
3. **Dropdowns/Popovers**: `bg-[--bg-glass] backdrop-blur-lg border border-[--border-subtle] shadow-xl`

### 4.8 Motion System

All animations use Framer Motion with consistent, physically-grounded motion. Every animation communicates something about the state change.

**Motion Presets** (defined once in `src/lib/utils/motion.ts`):

| Preset         | Config                                                              | Usage                     |
| -------------- | ------------------------------------------------------------------- | ------------------------- |
| `fadeIn`       | `opacity: 0->1, duration: 0.2`                                      | Default entrance          |
| `fadeInUp`     | `opacity: 0->1, y: 8->0, duration: 0.25`                            | Messages, cards entering  |
| `fadeInDown`   | `opacity: 0->1, y: -8->0, duration: 0.2`                            | Dropdown menus            |
| `slideInRight` | `x: 100%->0, duration: 0.3, ease: [0.4,0,0.2,1]`                    | A2UI panel                |
| `slideInLeft`  | `x: -100%->0, duration: 0.3`                                        | Sidebar opening           |
| `scaleIn`      | `scale: 0.95->1, opacity: 0->1, duration: 0.15`                     | Button press, badges      |
| `expand`       | `height: 0->auto, opacity: 0->1, duration: 0.25`                    | Thinking block expanding  |
| `collapse`     | `height: auto->0, opacity: 1->0, duration: 0.2`                     | Thinking block collapsing |
| `pulse`        | `opacity: [1,0.5,1], duration: 1.5, repeat: Infinity`               | Active status indicators  |
| `shimmer`      | `backgroundPosition: [-200%,200%], duration: 1.5, repeat: Infinity` | Loading skeletons         |
| `springBounce` | `type: spring, stiffness: 400, damping: 25`                         | Toggle switches           |

**Motion Rules**:

- Every entering element uses `fadeIn` or `fadeInUp` minimum
- Lists use staggered animations (`staggerChildren: 0.05`)
- Layout changes use Framer Motion's `layout` prop for FLIP animations
- Exit animations faster than enter (enter: 0.25s, exit: 0.15s)
- Reduced motion: all animations respect `prefers-reduced-motion`
- No animation exceeds 0.4s. Fast = premium. Slow = sluggish.
- Spring physics over linear easing for interactive elements

### 4.9 Iconography

- Library: Lucide React (consistent with shadcn/ui)
- Size: `size-4` inline, `size-5` standalone buttons
- Color: inherits via `currentColor`
- Stroke width: default (2), never modified

### 4.10 Empty States

| Screen                     | Empty State                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| New chat                   | Centered: app logo, welcome text, 3-4 suggested prompt chips in grid (clickable, pre-fill input), each with icon and short label |
| Sidebar (no conversations) | Subtle icon, "No conversations yet", "Start a new chat"                                                                          |
| Search (no results)        | Search icon, "No results found", "Try rephrasing your query"                                                                     |
| Attachments                | Dashed border zone, upload icon, "Drop files or click to browse"                                                                 |
| Error                      | Warning icon, error message, "Try again" button                                                                                  |
| Offline (PWA)              | Cloud-off icon, "You're offline", "Your conversations will be here when you're back"                                             |

### 4.11 Scrollbar Styling

- WebKit: thin scrollbar, track transparent, thumb `zinc-700` `rounded-full`, hover `zinc-600`
- Firefox: `scrollbar-width: thin; scrollbar-color: var(--border-default) transparent`
- Mobile: native momentum scrolling, no custom scrollbars

### 4.12 Chosen Layout: Whisper (LOCKED)

**Selected from visual mockup review. This layout drives all component structure for Phases 8, 11, 12. Every spatial decision below is locked. No deviations.**

#### Philosophy

macOS-native feeling — warm dark surfaces, glassmorphic sidebar that slides over content, clean editorial prose conversation (no AI bubbles), right-aligned user message pills, minimal chrome, everything breathing. The AI's live phase is communicated by a single elegant status bar that drops in below the titlebar only while a response is active — invisible the rest of the time. Zero dead air, zero clutter.

#### Layout Structure

```
┌─ Shell (flex, h-screen, overflow-hidden) ──────────────────────────┐
│                                                                     │
│  ┌─ Sidebar (overlay mobile / persistent lg+) ─┐                   │
│  │  w-72 | bg-[--bg-glass] backdrop-blur-xl    │                   │
│  │  border-r border-[--border-subtle]           │  ┌─ Main ──────┐ │
│  │                                              │  │ (flex-1,    │ │
│  │  Logo + close btn                            │  │  flex col,  │ │
│  │  New conversation btn                        │  │  overflow   │ │
│  │  Recent label                                │  │  hidden)    │ │
│  │  Conversation list (flex-1, overflow-y-auto) │  │             │ │
│  │  User footer                                 │  │  Titlebar   │ │
│  └─────────────────────────────────────────────┘  │  Phase bar  │ │
│                                                    │  Messages   │ │
│                                                    │  Input zone │ │
│                                                    └─────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

#### Responsive Breakpoints (Tailwind only — zero pixel values)

| Zone           | Mobile (default)                                                            | `lg:` (1024px+)          |
| -------------- | --------------------------------------------------------------------------- | ------------------------ |
| Sidebar        | `fixed inset-y-0 left-0 z-50 w-72 -translate-x-full`                        | `static translate-x-0`   |
| Sidebar open   | `translate-x-0` (JS toggled)                                                | always visible           |
| Overlay        | `fixed inset-0 z-40 bg-black/50 backdrop-blur-sm` (shown when sidebar open) | hidden                   |
| Main           | `flex-1 flex flex-col overflow-hidden`                                      | same                     |
| Messages inner | `max-w-2xl mx-auto px-4`                                                    | `max-w-2xl mx-auto px-6` |
| Input inner    | `max-w-2xl mx-auto px-4`                                                    | `max-w-2xl mx-auto px-6` |
| User bubble    | `max-w-[80%]`                                                               | `max-w-[72%]`            |

#### Component Exact Specifications

**`sidebar-container.tsx`**

```
Position:  mobile — fixed overlay (z-50); lg — static (z-auto)
Width:     w-72 (18rem, Tailwind scale — never a pixel value)
Background: bg-[--bg-glass] backdrop-blur-xl saturate-150
Border:    border-r border-[--border-subtle]
Shadow:    mobile only — shadow-2xl shadow-black/30
Animation: x: -100%→0 (enter), 0→-100% (exit), duration: MOTION.DURATION_SLOW, ease: MOTION.EASING (Framer Motion)
Overlay:   semi-transparent div behind sidebar on mobile, click dismisses

Top section (flex-shrink-0):
  Logo: text-sm font-semibold, accent span for last char
  Close button: icon-btn size (size-7, rounded-lg), lg:hidden

New conversation button:
  mx-3 my-2.5, flex items-center gap-2
  bg-[--accent-muted] border border-[--accent-glow]
  rounded-xl px-3 py-2, text-sm font-medium text-[--accent]
  hover: bg-[--accent-muted] brightness-110 transition-all

Section label:
  px-3.5 pt-2 pb-1 text-xs font-medium text-[--text-ghost] uppercase tracking-wider

Conversation list:
  flex-1 overflow-y-auto px-1.5 pb-3

Conversation item:
  px-2.5 py-2 rounded-xl cursor-pointer transition-colors
  hover: bg-[--bg-surface-hover]
  active: bg-[--bg-surface-active]
  Title: text-sm text-[--text-secondary], active: text-[--text-primary]
  Time: text-xs text-[--text-ghost] mt-0.5
  Active indicator: absolute left-0, w-0.5, h-4/6, rounded-r, bg-[--accent] (inset-y centered)

Footer (flex-shrink-0):
  px-3 py-2.5 border-t border-[--border-subtle]
  Avatar: size-7 rounded-full, gradient bg
  Name: text-sm text-[--text-secondary] flex-1
  Settings icon-btn: size-7 rounded-lg
```

**`titlebar.tsx`** (inside `main`, flex-shrink-0)

```
h-12 flex items-center px-4 gap-2.5
bg-[--bg-root] border-b border-[--border-subtle]

Hamburger: icon-btn, size-7, rounded-lg, color text-[--text-ghost]
Title: text-sm font-medium text-[--text-secondary] flex-1 truncate
Phase status pill (right of title, always present but transitions between states):
  idle:      invisible (opacity-0, pointer-events-none)
  thinking:  bg-[--thinking-bg] border border-[--thinking-border] text-[--thinking] with pulsing dot
  streaming: bg-[--accent-muted] border border-[--accent-glow] text-[--accent] with pulsing dot
  done:      bg-emerald-400/10 border border-emerald-400/20 text-[--success] with check icon
  Transition: opacity + scale, duration MOTION.DURATION_NORMAL, auto-hides 2s after done
Mode toggle: bg-[--bg-surface] border border-[--border-subtle] rounded-xl p-1, text-xs font-medium
More options: icon-btn size-7 rounded-lg
```

**`phase-bar.tsx`** (flex-shrink-0, below titlebar, slides in/out)

```
overflow-hidden, max-h controlled by Framer Motion layout animation
Visible only while phase is active (routing → thinking → streaming); hidden at idle/done

Inner content (when visible):
  px-5 py-2.5 bg-gradient-to-r from-[--accent-muted] to-transparent
  border-b border-[--border-subtle]
  flex items-center gap-3

Phase steps (left to right, flex items-center gap-2):
  Each step: dot + label, text-xs
  done step: text-[--success], dot bg-[--success]
  active step: text-[--text-primary] font-medium, dot bg-[--accent] animate-pulse
  thinking step: text-[--thinking], dot bg-[--thinking] animate-pulse
  inactive step: text-[--text-ghost], dot bg-[--text-ghost]/40

Model chip (right, ml-auto):
  flex items-center gap-1.5 bg-orange-400/10 border border-orange-400/20
  rounded-full px-2.5 py-1 text-xs text-[--provider-anthropic]
  Provider dot: size-1.5 rounded-full bg-[--provider-anthropic]
```

**`message-list.tsx`** (flex-1, overflow-y-auto)

```
scroll-behavior: smooth
Padding: pt-6 pb-4
Scrollbar: thin, WebKit + Firefox both styled via globals.css

Inner wrapper: max-w-2xl mx-auto px-4 lg:px-6
  flex flex-col gap-1

Date divider: flex items-center gap-3 my-2
  text-xs text-[--text-ghost]
  ::before / ::after: flex-1 h-px bg-[--border-subtle]
```

**`message-bubble.tsx` — User variant**

```
display: flex justify-end mb-3
Animation: fadeInUp (MOTION.DURATION_NORMAL), spring physics

Bubble:
  max-w-[80%] lg:max-w-[72%]
  bg-[--bg-glass] backdrop-blur-md
  border border-[--border-default]
  rounded-2xl rounded-br-sm
  px-4 py-2.5
  text-sm leading-relaxed text-[--text-primary]
  box-shadow: shadow-sm shadow-black/20
```

**`message-bubble.tsx` — Assistant variant (editorial, no bubble)**

```
mb-6
Animation: fadeInUp (MOTION.DURATION_MEDIUM), spring physics

Header row (flex items-center gap-2.5 mb-2.5):
  Avatar: size-6 rounded-lg, gradient bg-gradient-to-br from-[--accent] to-[--thinking]
          text-[10px] font-bold text-[--bg-root]
  Name: text-sm font-medium text-[--text-secondary]
  Model meta (ml-auto): flex items-center gap-1.5 text-xs text-[--text-ghost]
    Provider dot: size-1.5 rounded-full bg-[--provider-*]
    Token count if complete

Body (pl-8):
  text-sm lg:text-[0.9375rem] leading-[1.72] text-[--text-primary]
  p + p: mb-2.5
  inline code: font-mono text-xs bg-[--bg-surface-active] rounded px-1 py-0.5 text-[--accent]
  strong: font-semibold text-[--text-primary]
  a: text-[--accent] underline underline-offset-2 hover:text-[--accent-hover]
```

**`thinking-block.tsx`** (inside assistant body)

```
mb-3 transition-all

Trigger pill (flex items-center gap-2 ... cursor-pointer):
  bg-[--thinking-bg] border border-[--thinking-border] rounded-xl
  px-3 py-2 w-fit
  hover: bg-[--thinking-bg] brightness-125 transition-all

  Dot group (flex gap-1 items-center):
    3× span: size-[5px] rounded-full bg-[--thinking]
    each animates with staggered bounce (MOTION.STAGGER_CHILDREN)
    only when isActive (no completedAt); static when complete

  Label: text-[13px] text-[--thinking]
    active: "Thinking…"
    complete: "Thought for Xs" where X = (completedAt - startedAt) / 1000

  Duration: text-xs text-[--thinking]/50 (only when complete)

Expanded body (AnimatePresence + expand preset):
  mt-1 px-3 py-2.5
  font-mono text-xs leading-relaxed text-[--thinking]/50
  bg-[--thinking-bg] border border-[--thinking-border]
  rounded-xl border-t-0 rounded-t-sm
  max-h-48 overflow-y-auto
```

**`chat-input.tsx`** (flex-shrink-0)

```
px-4 lg:px-6 pb-4 pt-2 bg-[--bg-root]

Inner (max-w-2xl mx-auto):
  Input shell:
    bg-[--bg-glass] backdrop-blur-xl
    border border-[--border-default]
    rounded-2xl
    px-3 py-2.5 lg:px-3.5 lg:py-3
    flex items-end gap-2
    focus-within: border-[--accent]/30 ring-4 ring-[--accent]/7
    shadow-md shadow-black/20
    transition: border-color shadow ring — duration MOTION.DURATION_NORMAL

  Attach button: icon-btn size-8 rounded-xl text-[--text-ghost] hover:text-[--text-secondary]
  Textarea (flex-1):
    bg-transparent border-0 outline-0 resize-none
    text-sm text-[--text-primary] placeholder:text-[--text-ghost]
    min-h-[22px] max-h-[120px]
    auto-grows on input
  Voice button: icon-btn size-8 rounded-xl (right of textarea)
  Send button:
    idle: size-8 rounded-xl bg-[--accent] shadow-sm shadow-[--accent]/30
    hover: scale-110, shadow-md shadow-[--accent]/40 — spring physics
    streaming: bg-[--error]/80 (stop square icon)
    disabled (empty): bg-[--bg-surface-active] text-[--text-ghost] cursor-not-allowed

  Footer row (flex items-center gap-2 mt-1.5 px-1):
    Model selector: flex items-center gap-1.5 text-xs text-[--text-ghost]
                    hover: bg-[--bg-surface-hover] rounded-lg px-2 py-1.5
    Attach label: text-xs text-[--text-ghost] same hover
    Hint (ml-auto): text-xs text-[--text-ghost]/60 hidden sm:block
```

**`empty-state.tsx`** (shown on `/chat` when no conversation selected)

```
flex-1 flex flex-col items-center justify-center px-4 gap-6

Logo + title:
  Avatar size-12 rounded-2xl, gradient, text-xl font-bold
  h2: text-xl font-semibold text-[--text-primary]
  p: text-sm text-[--text-secondary] max-w-xs text-center

Suggestion chips (grid grid-cols-2 gap-2 max-w-sm w-full):
  Each: flex items-start gap-2.5 p-3 bg-[--bg-surface] border border-[--border-subtle]
        rounded-xl cursor-pointer text-left transition-all
        hover: bg-[--bg-surface-hover] border-[--border-default]
        Animation: fadeInUp + stagger (MOTION.STAGGER_CHILDREN)
  Icon: size-4 text-[--accent] flex-shrink-0 mt-0.5
  Text: text-sm text-[--text-secondary]
```

#### Touch & Accessibility (Mobile-First)

- All interactive elements: `min-h-11 min-w-11` (44pt minimum touch target)
- Sidebar: swipe-right to open on mobile via `useDrag` (Framer Motion)
- Long-press on conversation item opens context menu (rename, pin, delete)
- Input: virtual keyboard-aware (`env(safe-area-inset-bottom)` padding via CSS)
- `prefers-reduced-motion`: all Framer Motion animations skipped, CSS transitions only

#### What is Forbidden in This Layout

| Forbidden                               | Reason                                |
| --------------------------------------- | ------------------------------------- |
| `w-[288px]` for sidebar                 | Use `w-72` (Tailwind scale)           |
| `style={{ backdropFilter: '...' }}`     | Use `backdrop-blur-xl` Tailwind class |
| `style={{ background: '#1c1c1e' }}`     | Use `bg-[--bg-root]` CSS token        |
| `className="bg-zinc-950"` in components | Use `bg-[--bg-root]`                  |
| `rounded-[12px]` anywhere               | Use `rounded-xl`                      |
| `p-[16px]` or `gap-[12px]`              | Use `p-4` or `gap-3`                  |
| Fixed height sidebar items              | Use `py-2` + content-driven height    |
| Hardcoded max-width string              | Use `max-w-2xl` (Tailwind)            |
| `translate-x-[-100%]`                   | Use `-translate-x-full`               |

---

## 5. Features — Complete Specification

### F1. Google OAuth Authentication

Auth.js v5 with Google OAuth provider. `middleware.ts` protects all `(protected)` routes. Route groups: `(auth)` for login, `(protected)` for chat. Session includes userId, email, name, image. tRPC context injects session; `protectedProcedure` enforces auth and extracts `ctx.userId`. User records upserted on first login. Logout clears session and redirects. **Every database query is scoped to `ctx.userId` — zero cross-user data leakage.**

Login page: full-screen centered, app logo, single "Sign in with Google" button, subtle animated background, dark default, premium feel.

### F2. Chat Interface with Streaming — Zero Dead Air

The core experience. The user sees every phase of the AI's work as it happens. Never waiting without feedback.

**The Streaming Protocol** — tRPC subscription emits typed `StreamChunk` discriminated union:

```
StreamChunk types:
  status      — { phase, message }           Phase indicator (routing, thinking, searching, etc.)
  thinking    — { content, isComplete }       Reasoning tokens (streamed, expandable block)
  model_selected — { model, reasoning }       Auto-router result
  tool_start  — { toolName, input }           Tool execution begins (search query, file read)
  tool_result — { toolName, result }          Tool execution complete
  text        — { content }                   Main response tokens
  a2ui        — { jsonl }                     A2UI JSONL line for rich UI
  error       — { message, code? }            Error during any phase
  done        — { usage? }                    Stream complete
```

**Server-Side Emission Order**:

1. Immediate: `status` with phase `routing` (if auto) or `thinking` (if model pre-selected)
2. After router: `model_selected` with model and reasoning
3. If attachments: `status` with phase `reading_files`
4. If search mode: `tool_start` (web_search) -> process -> `tool_result` with results
5. AI starts: `status` with phase `thinking`
6. If extended thinking: `thinking` chunks token-by-token
7. Text generation: `text` chunks token-by-token
8. If A2UI content: `status` generating_ui -> `a2ui` chunks
9. End: `thinking` isComplete:true (if applicable) -> `done` with usage

**What The User Sees — Visual Timeline**:

The assistant message bubble builds progressively. Each phase adds to the bubble. Nothing disappears — completed status indicators collapse into subtle badges.

**Phase 1 — Routing** (immediate, ~200-500ms visible): Compact animated indicator at top of forming message. Accent-colored pulsing dot with "Selecting the best model..." text. Uses `pulse` motion preset. On complete: smoothly transitions into a small model badge with provider color dot and model name. Reasoning available on hover/click.

**Phase 2 — Thinking** (as soon as AI starts reasoning): Below the model badge, a thinking block appears with `expand` motion. Distinct visual treatment:

- Left border in `--thinking` color (violet) with subtle glow
- Background: `--thinking-bg` (subtle violet tint)
- Header: clickable toggle, collapsed by default. While active: "Thinking..." with animated shimmer. When complete: "Thought for Xs" with duration.
- Expanded view: thinking tokens stream in real-time in `--text-muted` with `font-mono`. Auto-scrolls. Tokens appear one by one like the main response.
- Collapsed view: shimmer animation on header indicates activity inside
- On complete: shimmer stops, duration shown, block remains expandable forever (persisted in metadata for conversation history)

**Phase 3 — Tool Execution** (if search or tool use): Below thinking block, inline execution cards appear:

- Web search: animated card with search icon + actual query in quotes. While active: `pulse` on icon. Complete: checkmark in `--success`, "Found N results", result cards render below with `fadeInUp` + stagger.
- File reading: file icon + filename. Complete: "Processed" with details.
- Cards use `fadeInUp` entrance, compact inline design.

**Phase 4 — Main Content**: Below all indicators, text streams token-by-token at ~60fps. Markdown rendered progressively — code fences get Shiki highlighting in real-time, tables build row by row. Message bubble grows with Framer Motion `layout` animation. Auto-scroll keeps latest content visible.

**Phase 5 — A2UI Surface** (if rich UI): A2UI surface materializes below text. Components appear progressively via SDK's `processMessage`. Custom catalog ensures design consistency. Entrance: `fadeInUp` with subtle scale.

**Phase 6 — Completion**: Stop button disappears (`fadeOut`), typing indicator gone, message finalized and persisted to DB with all metadata (thinking content, duration, tool calls, usage).

**Client State Machine** (`useChatStream` hook):

```
StreamState = {
  phase: idle | active | complete | error
  statusMessages: Array<{ phase, message, completedAt? }>
  thinking: { content, startedAt, completedAt? } | null
  modelSelection: { model, reasoning } | null
  toolExecutions: Array<{ name, input, result?, completedAt? }>
  textContent: string
  a2uiMessages: unknown[]
  error: string | null
}
```

Multiple phases visible simultaneously — thinking block stays visible while text streams below it.

**Other Chat UI Details**:

- User messages: right-aligned, accent-muted background, monochrome avatar
- Assistant messages: left-aligned, surface background, model icon
- Message bubbles: `rounded-2xl`, `fadeInUp` entrance, stagger 0.05s
- Chat area: viewport height minus input, momentum scrolling
- `useAutoScroll`: auto-scrolls during stream, pauses if user scrolls up past threshold, "↓ New messages" floating button to resume
- Input area: fixed bottom, glassmorphic, contains attachment button (left), auto-growing textarea (center), model selector (above/inline), mode toggle (left of send), send button (right)
- Send button: muted when empty, accent + subtle scale when content present, `scaleIn` press
- Stop button: replaces send during stream, red accent, aborts subscription
- Keyboard: Enter to send, Shift+Enter newline, Cmd/Ctrl+K model selector, Escape cancel
- Errors: inline error card at failure point with retry button

### F3. Multi-Model Support via OpenRouter

Native `@openrouter/sdk`. Dynamic registry from `/api/v1/models`, cached. Fallback static config. Models grouped by provider. Each entry: id, name, provider, capabilities, contextWindow, pricing, supportsVision, supportsTools.

**Model Selector UI**: Trigger shows current model + provider dot, or "Auto ✨". Dropdown: `fadeInDown` + backdrop blur, grouped by provider. Each section: provider name + colored dot header. Each item: model name, context badge, pricing indicator. "Auto" at top with sparkle icon. Selected item: accent highlight. Keyboard navigable. Persisted per conversation.

### F4. LLM-Powered Auto Model Router

**Router model:** `google/gemini-3-flash-preview` — purpose-built for fast structured-output classification. Sub-second JSON responses, multimodal awareness (can reason about image-containing requests), and excellent instruction following. Configured via `runtimeConfig.models.routerModel` in `src/schemas/runtime-config.ts`.

**Capability-aware selection:** The registry fetcher (`src/lib/ai/registry.ts`) runs `inferCapabilities(model)` on every OpenRouter model, assigning multi-label capability tags (`code`, `analysis`, `vision`, `fast`, `general`) from pattern matching on model ID/name and API-reported parameters (`reasoning`, image modality). Patterns are defined in `ROUTER_CAPABILITY_PATTERNS` in `src/config/constants.ts` (R01 SSOT).

**Enriched router prompt:** `buildRouterPrompt(models: ReadonlyArray<ModelConfig>)` formats each model as a structured row:

```
{id} | {name} | caps:{capabilities} | ctx:{context_k}k | vision:{y/n} | think:{y/n} | tools:{y/n}
```

The system prompt includes capability-first selection rules: vision tasks → require `vision:y`; complex analysis → prefer `think:y`; real-time data → require `tools:y`; simple lookups → prefer `fast` caps. Returns `ModelSelectionSchema` (category, reasoning, selectedModel) via `response_format: json_object`. Results emitted as `model_selected` chunk.

**Live routing decision UI (`RoutingPanel`):** Three animated states in the titlebar:

1. **Routing** — animated pulse pill "Selecting model…" while the router LLM runs
2. **Decision revealed** — expanded card showing model name, provider dot, category badge, capability pills (Thinking/Vision/Tools), context size, and one-sentence router reasoning
3. **Collapsed** — compact `• {provider} {modelName}` pill once text starts streaming; persists until stream resets

**Reactive mode toggle:** When the main model calls the web search tool, `detectedSearchMode` is set in stream state and the Chat/Search toggle updates to Search in real time — accurately reflecting what the model is doing.

### F5. Search Mode

Toggle in input area with `springBounce` animation. Active: query triggers `tool_start` chunk -> Tavily API -> `tool_result` with structured results. Displayed as styled cards with `fadeInUp` + stagger. Images in responsive grid with hover zoom. Stored in message metadata.

### F6. Markdown Rendering & Syntax Highlighting

react-markdown + remark-gfm + rehype-sanitize + rehype-katex. Shiki for code: VS Code themes, language label, copy button with checkmark feedback, line numbers above threshold. Inline code: `font-mono`, subtle background. Tables: rounded container, horizontal scroll, alternating rows. Block quotes: accent left border. Links: accent color, new tab.

### F7. Chat History & Conversation Management

**DB Tables** (9 total, all FKs with `onDelete: 'cascade'`, all timestamps with timezone):

- `users`, `accounts`, `sessions`, `verificationTokens` — Auth.js adapter tables (standard NextAuth schema)
- `conversations` — (userId FK, title, model, isPinned, timestamps). Index: (userId, updatedAt)
- `messages` — (conversationId FK, role, content, metadata JSONB, clientRequestId, streamSequenceMax, tokenCount). Indexes: (conversationId, createdAt), unique(conversationId, role, clientRequestId)
- `runtimeConfigs` — (scope enum[system|tenant|user], scopeKey, payload JSONB). Stores runtime config overrides resolved in precedence order: user → tenant → system → `RUNTIME_CONFIG_JSON` env var
- `userPreferences` — (userId PK FK, theme, sidebarExpanded, defaultModel, `groupModels` jsonb (nullable `string[]`, last-used group model IDs), `groupJudgeModel` text (nullable, last-used judge model ID)). Per-user UI settings persisted to DB and served via `user-preferences` tRPC router
- `attachments` — (userId FK, messageId FK, fileName, fileType, fileSize, storageUrl, confirmedAt). Indexes: userId, messageId

**Message Metadata** (JSONB): modelUsed, routerReasoning, thinkingContent, thinkingDurationMs, toolCalls, a2uiMessages, searchResults, usage. Enables full phase reconstruction when loading history — thinking blocks expandable, model badges visible, tool calls shown.

**tRPC**: conversation.list (paginated, user-scoped), conversation.getById, conversation.create, conversation.update, conversation.delete (cascade), conversation.pin. message.list (paginated).

**Sidebar**: Collapsible (overlay mobile, persistent lg+). Conversation list sorted updatedAt desc. Pinned at top. Each item: title, preview, timestamp, provider dot. Active: accent border. Context menu: Rename, Pin, Delete. "New Chat" button. User menu at bottom. Search filter. Export as Markdown.

### F8. File Attachments

Upload: attachment button or drag-drop -> validate -> tRPC presigned URL -> client PUT to GCS -> preview in input area. Supported: images, PDFs, text. Multi-modal: images as image_url blocks, PDFs as file blocks, text extracted. Display in messages: images inline with lightbox, files as download cards. Processing phase visible to user.

### F9. A2UI Agent-Generated UIs

`@a2ui-sdk/react` with custom catalog extending `standardCatalog`. Adapters map A2UI types to shadcn/ui: Text, Button, Card, TextField, Image, Row, Column, List, Divider, CodeBlock. All adapters use app design tokens. Streaming via `processMessage`. Actions route through tRPC. System prompt includes catalog schema. AI decides A2UI vs markdown based on response type. Messages can contain both. A2UI surfaces remain interactive in history.

### F9b. Multi-Model Group Mode

Send a single prompt to 2–3 models simultaneously and compare responses side by side in real-time tabs. After all models complete, a user-selected judge model synthesizes the best elements into a unified answer.

**Group stream** (`group.stream`): validates model IDs against registry, creates conversation if needed, saves user message (idempotent via `clientRequestId`), generates a `groupId` UUID, fetches shared history, spawns N parallel OpenRouter streams via a shared in-memory queue (producer-consumer), saves N assistant messages with `metadata.groupId`, `metadata.modelUsed`, `metadata.userMessageId`, then yields `group_done`. Rate-limited via `rateLimitedChatProcedure` — one slot for the entire group request regardless of N.

**Synthesis** (`group.synthesize`): SQL JSONB filter fetches only the N messages for `groupId` (excluding prior syntheses via `IS DISTINCT FROM 'true'`), builds XML-delimited multi-model prompt, streams response via judge model, saves synthesis message with `isGroupSynthesis: true`.

**Client**: `GroupModelPicker` (chip-based multi-select, 2–3 models), `GroupTabs` (shadcn Tabs), `GroupResponsePanel` (per-model streaming, reuses `ThinkingBlock`/`MarkdownRenderer`/`ToolExecution`), `SynthesisPanel` (judge picker + Synthesize button + streaming result), `GroupMessageGroup` (live + historical container). `useGroupStream` manages `Map<modelId, StreamState>`; `useGroupSynthesis` accumulates synthesis text. Selected models and judge persisted to `userPreferences.groupModels` / `userPreferences.groupJudgeModel`.

### F10. Mobile-First Responsive UI

Everything designed at 375px first. Sidebar: hidden overlay mobile, persistent lg+. Chat: full width mobile, max-w-3xl centered desktop. A2UI: inline mobile, side panel lg+. Touch: 44pt min targets, swipe sidebar, long-press context menu.

### F11. Deployment

Docker multi-stage with Bun. Cloud Run `me-central1`. Health check `/api/health`. SSE works natively. `output: 'standalone'`.

### F12. PWA

@serwist/next. Manifest with icons, theme color, display standalone. Caches app shell. Offline: cached shell + "You're offline" banner.

### F13. Dark/Light Theme

Dark default. Toggle in sidebar/menu. System preference detection. CSS custom properties switch. No flash on load. Shiki theme switches.

### F14. TTS/STT

Server-side STT via `openai/whisper` on OpenRouter — browser records audio via `MediaRecorder`, POSTs the blob to `/api/voice/transcribe`, server forwards to OpenRouter and returns the transcript. Server-side TTS via `qwen/qwen3-tts` on OpenRouter — text POSTed to `/api/voice/synthesize`, server returns an audio blob played via `<audio>` element. Markdown is stripped from text before TTS synthesis. Browser `Web Speech API` / `speechSynthesis` used as fallback if server route is unavailable.

Mic button in chat input. TTS play button on assistant messages. Constants: `VOICE.STT_MODEL` (`openai/whisper`), `VOICE.TTS_MODEL` (`qwen/qwen3-tts`), `VOICE.TTS_MAX_CHARS` (4096), `VOICE.MAX_AUDIO_BYTES` (25MB). Routes: `POST /api/voice/transcribe`, `POST /api/voice/synthesize`. Hooks: `use-speech-to-text.ts`, `use-text-to-speech.ts` in `src/features/voice/hooks/`.

---

## 6. Configuration

### 6.1 Environment Variables (`src/config/env.ts`)

Zod-validated: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, OPENROUTER_API_KEY, DATABASE_URL, TAVILY_API_KEY, GCS_BUCKET_NAME, GCS_PROJECT_ID, NEXT_PUBLIC_APP_URL, NODE_ENV.

### 6.2 Constants (`src/config/constants.ts`)

LIMITS: MESSAGE_MAX_LENGTH (32000), FILE_MAX_SIZE_BYTES (10MB), CONVERSATION_TITLE_MAX_LENGTH (200), PAGINATION_DEFAULT_LIMIT (20), PAGINATION_MAX_LIMIT (50), MODEL_REGISTRY_CACHE_TTL_MS (1hr), UPLOAD_URL_EXPIRY_MS (15min), STREAM_TIMEOUT_MS (60s), SEARCH_MAX_RESULTS (10), CODE_BLOCK_LINE_NUMBER_THRESHOLD (5).

SUPPORTED_FILE_TYPES: image/jpeg, image/png, image/gif, image/webp, application/pdf, text/plain, text/markdown.

MODEL_CATEGORIES: CODE, ANALYSIS, CREATIVE, VISION, GENERAL, FAST.

STREAM_EVENTS: STATUS, THINKING, MODEL_SELECTED, TOOL_START, TOOL_RESULT, TEXT, A2UI, ERROR, DONE.

STREAM_PHASES: ROUTING, THINKING, SEARCHING, READING_FILES, GENERATING_UI, GENERATING_TITLE.

PROVIDERS: OPENAI, ANTHROPIC, GOOGLE, META, GROQ, CEREBRAS.

ROUTER_MODEL, DEFAULT_MODEL.

UX: STATUS_MIN_DISPLAY_MS (500), THINKING_COLLAPSE_DEFAULT (true), STREAM_BUFFER_FLUSH_MS (16), AUTO_SCROLL_THRESHOLD (100), COPY_FEEDBACK_DURATION_MS (2000).

MOTION: DURATION_FAST (0.15), DURATION_NORMAL (0.2), DURATION_MEDIUM (0.25), DURATION_SLOW (0.3), STAGGER_CHILDREN (0.05), SPRING_STIFFNESS (400), SPRING_DAMPING (25), EASING [0.4, 0, 0.2, 1].

GROUP_LIMITS: MAX_MODELS (3), MIN_MODELS (2).

GROUP_EVENTS: MODEL_CHUNK ('group_model_chunk'), STREAM_EVENT ('group_stream_event'), DONE ('group_done'), SYNTHESIS_CHUNK ('group_synthesis_chunk'), SYNTHESIS_DONE ('group_synthesis_done').

GROUP_STREAM_PHASES: IDLE ('idle'), ACTIVE ('active'), DONE ('done'), ERROR ('error').

GROUP_STATUS_MESSAGES: SYNTHESIZING ('Synthesizing responses...'), STARTING ('Starting group comparison...').

GROUP_TAB_VALUES: SYNTHESIS ('synthesis').

**Separation note**: `constants.ts` contains compile-time static values only (measurements, provider colors, stream event names, markdown sanitization rules, motion durations). Runtime business behavior — limits, timeouts, prompts, retry policy, feature flags — lives in `src/schemas/runtime-config.ts` (Zod schema) and is resolved at runtime via `src/lib/runtime-config/service.ts` from the `runtimeConfigs` DB table.

### 6.3 Routes (`src/config/routes.ts`)

HOME, LOGIN, CHAT, CHAT_BY_ID(id), API.TRPC, API.AUTH, API.HEALTH.

### 6.4 Prompts (`src/config/prompts.ts`)

ROUTER_SYSTEM_PROMPT, A2UI_SYSTEM_PROMPT, TITLE_GENERATION_PROMPT, CHAT_SYSTEM_PROMPT.

---

## 7. Schemas (`src/schemas/`)

### message.ts

MessageRoleSchema, AttachmentSchema, UsageSchema, StreamPhaseSchema, StreamChunkSchema (full discriminated union with status/thinking/model_selected/tool_start/tool_result/text/a2ui/error/done), ChatInputSchema (with mode: chat|search), MessageMetadataSchema (with thinkingContent, thinkingDurationMs, toolCalls, routerReasoning, `groupId?: uuid`, `isGroupSynthesis?: boolean`, `userMessageId?: uuid`, etc.). All types derived via z.infer.

### conversation.ts

CreateConversationSchema, UpdateConversationSchema, ConversationFilterSchema, `MessageListOutputSchema` (`{ messages, nextCursor: string | null }`). Derived types.

### model.ts

ModelCapabilitySchema, ModelConfigSchema, ModelSelectionSchema. Derived types.

### search.ts

SearchQuerySchema, SearchImageSchema, SearchResultSchema. Derived types.

### upload.ts

UploadRequestSchema, UploadResponseSchema. Derived types.

### auth.ts

SessionUserSchema. Derived type.

### group.ts

`GroupStreamInputSchema` (conversationId?, content, models string[2-3], attachmentIds?), `GroupOutputChunkSchema` (discriminated union: `group_model_chunk` | `group_stream_event` | `group_done`), `GroupSynthesizeInputSchema` (groupId, conversationId, judgeModel), `GroupSynthesisOutputChunkSchema` (discriminated union: `group_synthesis_chunk` | `group_synthesis_done`).

### index.ts

Barrel export of all schemas.

---

## 8. Project File Structure

```
src/
├── app/
│   ├── (auth)/login/page.tsx, layout.tsx
│   ├── (protected)/chat/[id]/page.tsx, chat/page.tsx, layout.tsx, page.tsx
│   ├── api/trpc/[trpc]/route.ts, auth/[...nextauth]/route.ts, health/route.ts
│   ├── layout.tsx, manifest.ts, globals.css
├── server/
│   ├── routers/_app.ts, chat.ts, conversation.ts, group.ts, model.ts, search.ts, upload.ts
│   ├── trpc.ts, context.ts
├── schemas/
│   ├── message.ts, conversation.ts, group.ts, model.ts, search.ts, upload.ts, auth.ts, index.ts
├── features/
│   ├── chat/
│   │   ├── components/chat-container, message-list, message-bubble, chat-input,
│   │   │   model-selector, mode-toggle, attachment-preview, stop-button, empty-state
│   │   ├── hooks/use-chat-stream, use-auto-scroll, use-chat-input
│   ├── group/
│   │   ├── components/   # group-model-picker, group-tabs, group-response-panel, synthesis-panel, group-message-group
│   │   ├── context/      # group-context.tsx
│   │   ├── hooks/        # use-group-stream, use-group-synthesis
│   │   └── types.ts
│   ├── stream-phases/
│   │   ├── components/stream-progress, thinking-block, model-badge, tool-execution
│   │   ├── hooks/use-stream-state
│   ├── a2ui/
│   │   ├── catalog/custom-catalog, adapters/(text,button,card,input,image,row,column,list,divider,code)
│   │   ├── components/a2ui-message
│   │   ├── hooks/use-a2ui-actions
│   │   ├── types.ts
│   ├── search/components/search-results, image-gallery; hooks/use-search
│   ├── sidebar/components/sidebar-container, conversation-list, conversation-item, sidebar-header; hooks/use-sidebar
│   ├── markdown/components/markdown-renderer, code-block, copy-button; config/shiki-config
│   ├── voice/components/mic-button, tts-controls; hooks/use-speech-to-text, use-text-to-speech
├── lib/
│   ├── ai/client.ts, router.ts, registry.ts, tools.ts
│   ├── search/tavily.ts
│   ├── db/schema.ts, relations.ts, client.ts, migrate.ts, seed.ts
│   ├── upload/gcs.ts
│   ├── auth/config.ts
│   ├── utils/cn.ts, format.ts, errors.ts, motion.ts
├── config/constants.ts, routes.ts, env.ts, models.ts, prompts.ts
├── components/ui/ (shadcn)
├── trpc/client.ts, server.ts, provider.tsx
├── styles/themes.css
├── middleware.ts
├── Dockerfile, docker-compose.yml, drizzle.config.ts, tailwind.config.ts,
    tsconfig.json, next.config.ts, .env.example, README.md
```

---

## 9. tRPC Transport

splitLink: subscriptions -> httpSubscriptionLink (SSE), queries/mutations -> httpBatchLink. Single endpoint at ROUTES.API.TRPC.

---

## 10. README Structure

Live demo URL. Architecture diagrams (Mermaid). Key design decisions with justifications. Full tech stack table. Feature screenshots. Setup instructions (Bun). Env var table. Annotated file structure. Production improvements (rate limiting, Redis, OpenTelemetry, provider failover, WebSocket, PgBouncer, CI/CD, Playwright, content moderation, cost tracking). Trade-offs discussion.

---

## 11. Differentiators Summary

| Spec Asks          | We Deliver                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Chat with AI       | Multi-model + LLM auto-router across 5+ providers via OpenRouter                            |
| Streaming          | Typed SSE via tRPC with full phase visibility: routing -> thinking -> tools -> text -> A2UI |
| Google OAuth       | Middleware auth, session injection, complete user isolation                                 |
| Search with images | Tavily with structured cards, image gallery, visible search progress                        |
| Clean TypeScript   | Zod SSOT, zero inline types, zero magic numbers, zero literal strings, strict mode          |
| Responsive         | Mobile-first PWA, futuristic glassmorphic design, Framer Motion throughout                  |
| Deployed           | Dockerized Bun on GCP Cloud Run me-central1                                                 |
| "Bonus" history    | Drizzle + Neon, full CRUD, sidebar, metadata persistence with phase reconstruction          |
| _(not asked)_      | A2UI protocol — agent-generated rich UIs via official React SDK + custom shadcn catalog     |
| _(not asked)_      | File attachments with multi-modal AI via GCS presigned URLs                                 |
| _(not asked)_      | Dynamic model registry from OpenRouter API                                                  |
| _(not asked)_      | LLM-powered router with visible reasoning                                                   |
| _(not asked)_      | Expandable thinking blocks with streamed reasoning (Claude.ai style)                        |
| _(not asked)_      | Full streaming phase visibility — zero dead air UX principle                                |
| _(not asked)_      | Complete design system: motion presets, glassmorphism, color tokens, dark/light             |
| _(not asked)_      | Comprehensive README with architecture diagrams and production roadmap                      |
| _(not asked)_      | tRPC for entire API surface including streaming — single typed protocol                     |

---

## 12. Security Requirements

### S-01 — Rate Limiting (Core Requirement)

Per-user in-memory sliding window rate limiting is applied to all stateful endpoints. Constants in `RATE_LIMITS`:

- `CHAT_PER_MINUTE`: 20 requests/min per user on `chat.stream`
- `UPLOAD_PER_MINUTE`: 30 requests/min per user on `upload.presignedUrl`
- `WINDOW_MS`: 60,000 ms window

Implemented as tRPC middleware in `src/server/trpc.ts` (`rateLimitedChatProcedure`, `rateLimitedUploadProcedure`) backed by `src/lib/security/rate-limit.ts`. Production deployments with multiple instances must use a shared store (Redis) replacing the in-memory map.

### S-02 — Security Headers (Core Requirement)

All responses include the following HTTP security headers via `next.config.ts`:

- `Content-Security-Policy`: restricts script/style/image/connect origins
- `X-Frame-Options: DENY`: blocks clickjacking
- `X-Content-Type-Options: nosniff`: prevents MIME sniffing
- `Strict-Transport-Security`: enforces HTTPS
- `Referrer-Policy: strict-origin-when-cross-origin`: limits referrer leakage
- `Permissions-Policy`: disables camera, microphone, geolocation

### S-03 — Prompt Injection Protection (Core Requirement)

All user-controlled input passed to AI models is wrapped with XML delimiters to establish a clear data boundary:

- Router: `<user_request>…</user_request>` via `PROMPTS.ROUTER_SYSTEM_PROMPT`
- Title generator: `<message>…</message>` appended to `PROMPTS.TITLE_GENERATION_PROMPT`
- Web search results: `<search_results><result>…</result></search_results>` injected into system prompt

System prompts for all three AI calls explicitly instruct the model to treat wrapped content as data only and to ignore any instructions within. This applies to both direct prompt injection (user input) and indirect prompt injection (search result content).

### S-04 — A2UI Security Model (Core Requirement)

A2UI messages streamed from the server must pass runtime structural validation before dispatch. The client (`use-chat-stream.ts`) validates that any JSON parsed from an A2UI chunk has a `type: string` field before dispatching to the renderer. Unknown `type` values are silently ignored by the renderer.

Content policy enforced in `PROMPTS.A2UI_SYSTEM_PROMPT`:

- `Image.src`: must be a relative path, data URI, or HTTPS URL from a trusted source
- `Button.action`: must be a single alphanumeric action identifier
- Unknown component types are documented as ignored by the renderer

A2UI stream detection uses a line-buffer to avoid false positives from token-boundary splits. Only complete newline-terminated lines are emitted as A2UI chunks.

### S-05 — Error Sanitization Policy (Core Requirement)

Internal error details must never reach clients in production:

- `chat.stream` catch block: logs full error server-side in development; sends generic message `"An error occurred while processing your request."` to client in all environments
- tRPC subscription transport errors (`onError` in `use-chat-stream.ts`): always sends generic `"Connection error. Please try again."` regardless of actual error
- tRPC procedure errors (`TRPCError`): handled by tRPC's built-in stripping in production (existing behavior, preserved)

### S-06 — XSS Prevention via rehype-sanitize (Core Requirement)

`rehype-raw` is prohibited. All AI-generated markdown is rendered through `rehype-sanitize` (configured with `defaultSchema` plus `className` on `code`/`span` for Shiki compatibility). This prevents arbitrary HTML from AI responses executing in the browser.

Anchor tags additionally validate that `href` values use only `https:`, `http:`, `mailto:`, or relative paths — all other protocols (including `javascript:`) are stripped before rendering.

### Security Architecture Invariants

| Invariant                                                | Implementation                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| All DB queries scoped to `ctx.userId`                    | `protectedProcedure` + explicit `WHERE userId = ctx.userId`                             |
| OAuth tokens encrypted at rest                           | AES-256-GCM via `src/lib/security/token-crypto.ts`, key derived from `AUTH_SECRET`      |
| User input XML-delimited before AI submission            | `<user_request>` / `<message>` wrappers in all AI callers                               |
| Search results XML-delimited before AI submission        | `<search_results>` wrapper in `chat.ts`                                                 |
| Model IDs validated against live registry                | `getModelRegistry()` called on explicit model selection                                 |
| Attachment ownership enforced with error on unauthorized | Batch query + `FORBIDDEN` throw in `chat.ts`                                            |
| Uploaded file names sanitized                            | `sanitizeFileName()` in `gcs.ts` before object path construction                        |
| Upload orphan prevention                                 | `confirmUpload` procedure sets `confirmedAt`; unconfirmed records are orphan candidates |
| Middleware covers `/api/trpc` routes                     | Matcher excludes only `api/auth`, `_next/*`, `favicon.ico`                              |
| Registry fetch has timeout                               | `AbortSignal.timeout(LIMITS.REGISTRY_FETCH_TIMEOUT_MS)` on all registry fetches         |
