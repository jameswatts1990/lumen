# Claude Memory

### [Email Import] Outlook .msg parsing in browser
- Context: when handling `.msg` files dropped from Outlook into the reader.
- Guidance: initialize `window.MSGReader` with `Uint8Array` bytes first (ArrayBuffer fallback only for compatibility), and if structured parse fails, recover text by decoding UTF-16LE/Latin-1 printable segments from binary before showing a failure notice.
- Reason: Outlook `.msg` payloads are OLE binaries; direct UTF-8 `.text()` reads look corrupted, and some valid messages only become readable via byte-level fallback extraction.
