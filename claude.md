# Claude Memory

### [Email Import] Outlook .msg parsing in browser
- Context: when handling `.msg` files dropped from Outlook into the reader.
- Guidance: parse `.msg` via `window.MSGReader` on `ArrayBuffer` first; only fall back to plaintext `.text()` heuristics when parsing fails.
- Reason: `.msg` is a binary Outlook container and appears unreadable when treated as UTF-8 text.
