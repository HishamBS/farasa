# Whisper UI Parity Checklist

## Scope

- Source of truth: `mockups/1-whisper.html`
- Routes in scope:
  - `/chat`
  - `/chat/:id`
  - `/login`
  - `/offline`

## Mandatory Viewports

- Mobile: `390x844`
- Tablet: `768x1024`
- Desktop: `1440x900`

## Visual Checkpoints

1. Shell and frame

- Sidebar width and glass treatment match Whisper language.
- Main pane uses 48px titlebar and separate phase band.
- Overlay controls do not pollute `/chat` (install prompt hidden on chat routes).

2. Sidebar

- Logo, new conversation button, recent list, footer profile row match Whisper hierarchy.
- Search is available but does not dominate layout.
- Active conversation state and pinned indicator are visible and subtle.

3. Titlebar and mode toggle

- 48px bar, compact menu icon, title truncation behavior.
- Chat/Search segmented control styling aligns with Whisper.
- Conversation actions are available through menu without visual clutter.

4. Stream phase rail

- Ordered phases: Routed → Thinking → Responding → Done.
- Active/done/inactive color semantics match Whisper.
- Model chip appears on the right when selected.

5. Messages

- User messages are right-aligned accent pills.
- Assistant messages are editorial (header + prose), not boxed chat bubbles.
- Date divider appears above conversation content.
- Thinking block style and expansion behavior match Whisper feel.

6. Composer

- Two-row glass composer with textarea and right-side controls.
- Footer row includes model selector and keyboard hint.
- Send/stop button behavior transitions correctly during streaming.

7. Code and markdown

- Code blocks use Whisper-like frame/header/copy affordance.
- Prose spacing and typography align with mock rhythm.

8. Non-chat pages

- `/login` and `/offline` adopt same visual language (tokens, glass, gradients).

## Functional Regression Checks

- Sidebar open/close via menu, overlay, Escape, swipe.
- Conversation rename/pin/export/delete still work.
- Message send, stream, completion transitions work.
- A2UI/tool/search/image-gallery rendering remains functional.
- Voice input and text-to-speech controls remain available.
