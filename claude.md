# Repository Memory (Claude)

### [Evidence UX] Keep claim labels traceable
- Context: when adding or editing scientific hints, badges, or control descriptions.
- Guidance: tie evidence-facing copy to an Evidence Notes code (for example `BG1`, `D1`, `T2`) and keep `references.md` aligned.
- Reason: traceable claims reduce ambiguity and make future evidence audits faster.

### [Mobile Layout] Preserve touch-safe controls
- Context: when changing control layouts under `max-width: 900px`.
- Guidance: keep interactive targets around 44px minimum and maintain top dock padding so fixed controls do not overlap top-left nav actions.
- Reason: prevents accidental taps and blocked navigation on small screens.

### [Flow Speed-Read] Respect explicit user anchor
- Context: when changing speed-read start logic across flow/chunk states.
- Guidance: always prefer `.flow-word-selected` as the playback start anchor; only fall back to highlighted chunk words if no selected word exists.
- Reason: preserves user intent and avoids surprising jumps.

### [Mode Availability] Keep controls content-aware
- Context: when wiring reading-mode options by source type.
- Guidance: allow `Original/Overlay/Flow` for PDF sources, but only `Flow` for text-centric imports (clipboard, URL, text/email files).
- Reason: avoids presenting dead-end modes that cannot render meaningful content.

### [Gesture Input] Mirror handlers on flow backdrop
- Context: when backdrop pointer-blocking is active in flow speed-read.
- Guidance: keep pause/resume hold handlers mirrored on both `#reader` and `#flowSpeedBackdrop` (`pointerdown`, `pointerup`, `pointercancel`).
- Reason: backdrop interception otherwise prevents resume interactions.
