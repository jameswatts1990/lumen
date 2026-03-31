# lumen

## Font asset caching

Local OpenDyslexic assets are referenced from `assets/fonts/opendyslexic/` with an explicit version query string in `index.html` (currently `v=2026-03-31`).

For production deployments, serve `/assets/fonts/*` with long-lived immutable caching headers, for example:

- `Cache-Control: public, max-age=31536000, immutable`

When font files change, bump the version query string so clients fetch fresh binaries.
