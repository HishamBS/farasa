# Whisper Visual Regression Matrix

## Capture Targets

- Route: `/chat`
  - state: idle (new chat)
  - state: sidebar open (mobile)
- Route: `/chat/:id`
  - state: active stream (phase rail visible)
  - state: stream complete (code block + thought block)
- Route: `/login`
- Route: `/offline`

## Required Viewports

- `390x844`
- `768x1024`
- `1440x900`

## Manual Capture Procedure

1. Start app with `bun run dev`.
2. Open route and set viewport.
3. Capture screenshot and store under `logs/ui-regression/<timestamp>/`.
4. Compare against previous baseline and mock.
5. Record pass/fail for each route/state/viewport tuple.

## Pass Criteria

- No structural drift in shell/sidebar/titlebar/phase rail.
- Message and composer spacing remain consistent across breakpoints.
- Color/contrast and border hierarchy match token system.
- Functional controls remain interactive and keyboard accessible.
