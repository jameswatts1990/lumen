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

### [Chunk Overlay] Parse accent colors as channels
- Context: when deriving dynamic chunk/ruler shading from CSS custom properties such as `--accent-dim`.
- Guidance: parse theme colors into numeric RGBA channels before computing derived alpha blends; avoid treating CSS color strings as structured objects.
- Reason: prevents invalid gradient strings that silently break shading visuals.

### [Flow Chunking] Keep chunk mode exclusive with ruler/shading
- Context: when wiring focus-aid toggles in Flow reading mode.
- Guidance: enabling chunk mode should clear ruler and paragraph shading toggles, and flow chunking should avoid the fixed top/bottom shading bands.
- Reason: preserves J/K chunk stepping behavior and keeps chunk focus visuals aligned with expected flow UX.

### [Flow Chunking] Preserve anchor across flow re-renders
- Context: when changing chunk length or auto-split settings in Flow mode triggers re-rendering of flow blocks.
- Guidance: snapshot the current chunk anchor (index + normalized text) before re-render and restore `flowChunkIndex` afterward; avoid resetting to the first chunk.
- Reason: prevents J/K navigation from feeling stuck or jumping after chunk-size adjustments.
### [Keyboard Shortcuts] Only block text-entry targets
- Context: when handling global shortcuts (especially chunking J/K) after sidebar interactions.
- Guidance: gate shortcuts with `isTypingTarget(...)` checks instead of blocking all focused `<input>` elements, so non-text controls (range, checkbox, button) do not disable global keys.
- Reason: users often click sidebar controls before resuming keyboard navigation, and broad input blocking silently breaks expected shortcuts.
