# Evidence claim referencing note

- Keep evidence-related UI copy tied to a source code where possible (for example `BG1`, `D1`, `T2`) so claims in labels/hints can be traced back to the Evidence Notes index.
- For mobile CSS (`max-width: 900px`), keep touch targets at least ~44px for interactive controls and add dock padding so fixed controls do not overlap the top-left nav buttons.
- In flow speed-read, always prioritize the mouse-selected word (`.flow-word-selected`) as the playback start anchor across modes (including chunking); chunk highlight is only a fallback when no cursor-selected word exists.
- Keep reading-mode controls content-aware: PDF sources can show Original/Overlay/Flow, while text-centric imports (clipboard, URL, text files, email files) should only expose Flow to avoid dead-end mode choices.
- [Flow speed-read input] Keep pause/resume gesture handlers mirrored on `#flowSpeedBackdrop` whenever backdrop pointer-blocking is active.
  Context: speed-read mode uses a full-screen backdrop (`pointer-events: auto`) to stop accidental background interaction.
  Guidance: route pointerdown/up/cancel on both `reader` and backdrop through the same hold/resume logic.
  Reason: otherwise paused state cannot be resumed by click/press because the backdrop intercepts the pointer event before it reaches `reader`.
