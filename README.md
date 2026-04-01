# Lumen Reader

Lumen is a single-page browser reading app focused on adaptable readability controls (display mode, typography, focus aids, and pacing tools) with in-product evidence labels.

## Project layout

- `index.html` — app shell, styles, and client logic.
- `references.md` — bibliography backing the in-app evidence tags (for example `BG1`, `D1`, `T2`).
- `claude.md` — durable contributor memory for future agent work.
- `assets/fonts/opendyslexic/` — bundled OpenDyslexic font files.

## Run locally

No build step is required.

1. Open `index.html` directly in a browser, or
2. Serve the folder with a static file server (recommended for local testing).

Example:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Font asset caching

OpenDyslexic assets are loaded from `assets/fonts/opendyslexic/` with an explicit version query string in `index.html` (currently `v=2026-03-31`).

Atkinson Hyperlegible uses explicit `@font-face` declarations with:

- `local(...)` probes,
- jsDelivr `woff2` fallback, and
- unpkg `woff2` fallback.

For production deploys, serve `/assets/fonts/*` with long-lived immutable caching headers:

- `Cache-Control: public, max-age=31536000, immutable`

When font binaries change, bump the version query string to force client refresh.

## Evidence references

Evidence note labels shown in the UI are maintained in `index.html` and should map to full citations in `references.md`.
