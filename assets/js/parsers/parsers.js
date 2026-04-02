/* ── File upload ── */
const fileIn = document.getElementById('fileIn');
const upZone = document.getElementById('upZone');
const emptyUploadBtn = document.getElementById('emptyUploadBtn');
const emptyPasteBtn = document.getElementById('emptyPasteBtn');
const mobileAddFab = document.getElementById('mobileAddFab');
const mobileAddMenu = document.getElementById('mobileAddMenu');
const mobileAddUploadBtn = document.getElementById('mobileAddUploadBtn');
const mobileAddPasteBtn = document.getElementById('mobileAddPasteBtn');

function looksLikeHttpUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed);
}

function triggerFilePicker(event = null) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  setMobileAddMenuOpen(false);
  fileIn.click();
}

async function promptForSourcePaste(event = null) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  setMobileAddMenuOpen(false);
  const pasted = window.prompt('Paste text to read, or paste a URL to load:');
  if (!pasted || !pasted.trim()) return;
  const trimmed = pasted.trim();
  if (looksLikeHttpUrl(trimmed)) {
    const urlInput = document.getElementById('urlIn');
    urlInput.value = trimmed;
    await loadFromUrl();
    return;
  }
  setCurrentDocumentMeta({
    id: `manual:paste:${Date.now()}`,
    label: 'Manual paste',
    type: 'clipboard-text'
  });
  await loadTextDocument(trimmed, 'Manual paste', 'Clipboard · Pasted text');
}

function setMobileAddMenuOpen(nextOpen) {
  if (!mobileAddMenu || !mobileAddFab) return;
  const open = Boolean(nextOpen);
  mobileAddMenu.classList.toggle('on', open);
  mobileAddMenu.setAttribute('aria-hidden', String(!open));
  mobileAddFab.setAttribute('aria-expanded', String(open));
}

async function handleClipboardImport(clipboardData) {
  if (!clipboardData) return false;
  const clipboardFile = clipboardData.files?.[0];
  if (clipboardFile && await shouldAcceptFileForImport(clipboardFile)) {
    await loadSourceFile(clipboardFile);
    return true;
  }

  const textPayload = (clipboardData.getData('text/plain') || '').trim();
  if (!textPayload) return false;

  if (looksLikeHttpUrl(textPayload)) {
    const urlInput = document.getElementById('urlIn');
    urlInput.value = textPayload;
    await loadFromUrl();
    return true;
  }

  setCurrentDocumentMeta({
    id: `clipboard:text:${Date.now()}`,
    label: 'Clipboard paste',
    type: 'clipboard-text'
  });
  await loadTextDocument(textPayload, 'Clipboard paste', 'Clipboard · Pasted text');
  return true;
}

emptyUploadBtn?.addEventListener('click', triggerFilePicker);
emptyPasteBtn?.addEventListener('click', promptForSourcePaste);
mobileAddFab?.addEventListener('click', () => {
  setMobileAddMenuOpen(!(mobileAddMenu?.classList.contains('on')));
});
mobileAddUploadBtn?.addEventListener('click', triggerFilePicker);
mobileAddPasteBtn?.addEventListener('click', promptForSourcePaste);
document.addEventListener('click', e => {
  if (!mobileAddMenu || !mobileAddFab) return;
  if (!mobileAddMenu.classList.contains('on')) return;
  const target = e.target;
  if (target instanceof Element && (target.closest('#mobileAddMenu') || target.closest('#mobileAddFab'))) return;
  setMobileAddMenuOpen(false);
});

fileIn.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (await shouldAcceptFileForImport(file)) loadSourceFile(file);
});
upZone.addEventListener('dragover', e => { e.preventDefault(); upZone.classList.add('drag'); });
upZone.addEventListener('dragleave', () => upZone.classList.remove('drag'));
upZone.addEventListener('drop', async e => {
  e.preventDefault(); upZone.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (await shouldAcceptFileForImport(f)) loadSourceFile(f);
});

upZone.addEventListener('mouseenter', () => upZone.classList.add('is-paste-ready'));
upZone.addEventListener('mouseleave', () => upZone.classList.remove('is-paste-ready'));
upZone.addEventListener('focusin', () => upZone.classList.add('is-paste-ready'));
upZone.addEventListener('focusout', () => upZone.classList.remove('is-paste-ready'));

upZone.addEventListener('keydown', async e => {
  if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) {
    upZone.classList.add('is-paste-ready');
    setTimeout(() => upZone.classList.remove('is-paste-ready'), 700);
  }
});

upZone.addEventListener('paste', async e => {
  const handled = await handleClipboardImport(e.clipboardData);
  if (handled) {
    e.preventDefault();
    upZone.classList.add('is-paste-ready');
    setTimeout(() => upZone.classList.remove('is-paste-ready'), 700);
  }
});

fileIn.addEventListener('paste', async e => {
  const handled = await handleClipboardImport(e.clipboardData);
  if (handled) e.preventDefault();
});

document.addEventListener('paste', async e => {
  const activeTag = document.activeElement?.tagName;
  const isTypingField = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable;
  if (isTypingField && document.activeElement !== fileIn) return;
  if (!upZone.classList.contains('is-paste-ready')) return;
  const handled = await handleClipboardImport(e.clipboardData);
  if (handled) {
    e.preventDefault();
    upZone.classList.add('is-paste-ready');
    setTimeout(() => upZone.classList.remove('is-paste-ready'), 700);
  }
});

['dragenter', 'dragover'].forEach(evt => {
  reader.addEventListener(evt, e => {
    e.preventDefault();
    reader.classList.add('drop-ready');
  });
});

['dragleave', 'dragend'].forEach(evt => {
  reader.addEventListener(evt, e => {
    if (e.target === reader) reader.classList.remove('drop-ready');
  });
});

reader.addEventListener('drop', async e => {
  e.preventDefault();
  reader.classList.remove('drop-ready');
  const f = e.dataTransfer?.files?.[0];
  if (await shouldAcceptFileForImport(f)) loadSourceFile(f);
});

window.addEventListener('dragover', e => {
  e.preventDefault();
});

window.addEventListener('drop', e => {
  e.preventDefault();
});
window.addEventListener('beforeunload', () => {
  saveSettings();
  saveDocProgress();
});

function isPdfFile(file) {
  if (!file) return false;
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isEpubFile(file) {
  if (!file) return false;
  const lowerName = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();
  return mime === 'application/epub+zip' || lowerName.endsWith('.epub');
}

function isTextLikeFile(file) {
  if (!file) return false;
  const name = (file.name || '').toLowerCase();
  const extMatch = /\.(txt|md|markdown|html|htm|json|eml|msg)$/.test(name);
  const emailNameHint = /(outlook|message|mail|mime|forwarded|attached message)/i.test(name);
  const mime = (file.type || '').toLowerCase();
  const emailMimeMatch = mime === 'message/rfc822';
  const ambiguousMime = !mime || mime === 'application/octet-stream' || mime === 'application/x-msdownload';
  const plausibleEmailBlob = ambiguousMime && emailNameHint && (Number(file.size) || 0) > 0;
  return extMatch || emailMimeMatch || mime.startsWith('text/') || mime === 'application/json' || plausibleEmailBlob;
}

function isSupportedFile(file) {
  return isPdfFile(file) || isEpubFile(file) || isTextLikeFile(file);
}

const msgSignatureCache = new WeakMap();

function hasLikelyMsgMime(file) {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  if (mime === 'application/vnd.ms-outlook' || mime === 'application/cdfv2') return true;
  if (mime !== 'application/octet-stream' && mime !== 'application/x-msdownload') return false;
  const name = (file.name || '').toLowerCase();
  const emailHint = /(outlook|message|mail|mime|forwarded|attached message|winmail)/i.test(name);
  return emailHint && (Number(file.size) || 0) > 0;
}

async function hasOleCompoundFileSignature(file) {
  if (!file || typeof file.slice !== 'function') return false;
  if (msgSignatureCache.has(file)) return msgSignatureCache.get(file);
  try {
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const matches = bytes.length >= 8
      && bytes[0] === 0xD0
      && bytes[1] === 0xCF
      && bytes[2] === 0x11
      && bytes[3] === 0xE0
      && bytes[4] === 0xA1
      && bytes[5] === 0xB1
      && bytes[6] === 0x1A
      && bytes[7] === 0xE1;
    msgSignatureCache.set(file, matches);
    return matches;
  } catch (_) {
    msgSignatureCache.set(file, false);
    return false;
  }
}

async function isLikelyMsgFile(file) {
  if (!file) return false;
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.msg')) return true;
  if (hasLikelyMsgMime(file)) return true;
  return hasOleCompoundFileSignature(file);
}

async function shouldAcceptFileForImport(file) {
  if (!file) return false;
  if (isSupportedFile(file) || isAmbiguousDropEmailCandidate(file)) return true;
  return isLikelyMsgFile(file);
}

function isAmbiguousDropEmailCandidate(file) {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  if (mime && mime !== 'application/octet-stream' && mime !== 'application/x-msdownload') return false;
  const name = (file.name || '').toLowerCase().trim();
  const size = Number(file.size) || 0;
  if (!name || size <= 0) return false;
  const hasMailHint = /(mail|message|outlook|forwarded|attached)/i.test(name);
  const hasKnownExt = /\.(eml|msg|txt|md|markdown|html|htm|json)$/.test(name);
  return hasMailHint || hasKnownExt;
}

function looksLikeUnreadableOutlookBlob(file, rawText) {
  const name = (file?.name || '').toLowerCase();
  const mime = (file?.type || '').toLowerCase();
  const isOutlookLike = name.endsWith('.msg')
    || mime.includes('vnd.ms-outlook')
    || (mime === 'application/octet-stream' && /(outlook|message|mail)/i.test(name));
  if (!isOutlookLike) return false;

  const sample = String(rawText || '').slice(0, 1800);
  if (!sample.trim()) return true;
  const replacementChars = (sample.match(/\uFFFD/g) || []).length;
  const nullChars = (sample.match(/\u0000/g) || []).length;
  const weirdChars = (sample.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length;
  const ratio = sample.length ? weirdChars / sample.length : 1;
  return replacementChars > 8 || nullChars > 4 || ratio > 0.28;
}

function renderReaderNotice(html) {
  reader.classList.remove('drop-ready');
  flowLayer.classList.remove('on');
  flowLayer.innerHTML = '';
  rInner.classList.remove('flow-mode');
  rInner.innerHTML = `<div class="reader-notice">${html}</div>`;
}

function stripToPlainText(rawText, sourceName = '') {
  const lower = sourceName.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawText, 'text/html');
    doc.querySelectorAll('script, style, noscript, svg, canvas').forEach(el => el.remove());
    return (doc.body?.innerText || doc.documentElement?.innerText || '').trim();
  }
  return rawText;
}

function resolveEpubPath(basePath, relativePath) {
  const base = String(basePath || '').replace(/\\/g, '/');
  const rel = String(relativePath || '').replace(/\\/g, '/').split('#')[0].split('?')[0];
  const baseDir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
  const resolved = new URL(rel, `https://epub.local/${baseDir}`).pathname.replace(/^\/+/, '');
  return decodeURIComponent(resolved);
}

function getXmlElementsByLocalName(root, localName) {
  const expected = String(localName || '').toLowerCase();
  if (!root || !expected) return [];
  return Array.from(root.getElementsByTagName('*')).filter(node => (node.localName || node.nodeName || '').toLowerCase() === expected);
}

async function extractEpubText(file) {
  const bytes = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(bytes);
  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) {
    throw new Error('Missing META-INF/container.xml');
  }
  const containerXml = await containerEntry.async('string');
  const xmlParser = new DOMParser();
  const containerDoc = xmlParser.parseFromString(containerXml, 'application/xml');
  const parserError = containerDoc.querySelector('parsererror');
  if (parserError) throw new Error('Unable to parse EPUB container metadata.');
  const rootFileNode = getXmlElementsByLocalName(containerDoc, 'rootfile')[0];
  const opfPath = rootFileNode?.getAttribute('full-path');
  if (!opfPath) throw new Error('Missing package document path in EPUB.');

  const opfEntry = zip.file(opfPath);
  if (!opfEntry) throw new Error('Unable to locate EPUB package document.');
  const opfXml = await opfEntry.async('string');
  const opfDoc = xmlParser.parseFromString(opfXml, 'application/xml');
  const opfParseError = opfDoc.querySelector('parsererror');
  if (opfParseError) throw new Error('Unable to parse EPUB package document.');

  const manifestById = new Map();
  getXmlElementsByLocalName(opfDoc, 'item').forEach(item => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (!id || !href) return;
    manifestById.set(id, {
      href: resolveEpubPath(opfPath, href),
      mediaType: (item.getAttribute('media-type') || '').toLowerCase()
    });
  });

  const spinePaths = [];
  getXmlElementsByLocalName(opfDoc, 'itemref').forEach(itemRef => {
    const idRef = itemRef.getAttribute('idref');
    const manifestItem = idRef ? manifestById.get(idRef) : null;
    if (manifestItem?.href) spinePaths.push(manifestItem.href);
  });

  const fallbackPaths = Array.from(manifestById.values())
    .filter(item => (
      item.mediaType === 'application/xhtml+xml' ||
      item.mediaType === 'text/html' ||
      /\.(xhtml|html|htm)$/i.test(item.href)
    ))
    .map(item => item.href);
  const orderedPaths = (spinePaths.length ? spinePaths : fallbackPaths)
    .filter((path, index, arr) => Boolean(path) && arr.indexOf(path) === index);

  const sections = [];
  for (const path of orderedPaths) {
    const entry = zip.file(path);
    if (!entry) continue;
    const markup = await entry.async('string');
    const plain = stripToPlainText(markup, '.html');
    if (plain) sections.push(plain);
  }

  const joinedText = normalizeReadableText(sections.join('\n\n'));
  if (!joinedText) throw new Error('No readable text was found in this EPUB.');
  return joinedText;
}

function decodeEmailBytesWithCharsetFallback(bytes, declaredCharset = '') {
  const fallbackChain = [
    String(declaredCharset || '').trim().toLowerCase(),
    'utf-8',
    'windows-1252'
  ].filter((value, idx, arr) => value && arr.indexOf(value) === idx);

  for (const charset of fallbackChain) {
    try {
      return new TextDecoder(charset, { fatal: false }).decode(bytes);
    } catch (_) {
      continue;
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function decodeMimeEncodedWordValue(value = '') {
  const encodedWordPattern = /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g;
  const source = String(value || '');
  if (!encodedWordPattern.test(source)) return source;
  encodedWordPattern.lastIndex = 0;

  const decodeWord = (fullMatch, charset, encoding, encodedText) => {
    let bytes;
    if (String(encoding).toLowerCase() === 'b') {
      try {
        const binary = atob(String(encodedText || '').replace(/\s+/g, ''));
        bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
      } catch (_) {
        return fullMatch;
      }
    } else {
      const qText = String(encodedText || '').replace(/_/g, ' ');
      const out = [];
      for (let i = 0; i < qText.length; i += 1) {
        const ch = qText[i];
        if (ch === '=' && /^[0-9a-fA-F]{2}$/.test(qText.slice(i + 1, i + 3))) {
          out.push(parseInt(qText.slice(i + 1, i + 3), 16));
          i += 2;
        } else {
          out.push(ch.charCodeAt(0) & 0xff);
        }
      }
      bytes = Uint8Array.from(out);
    }
    return decodeEmailBytesWithCharsetFallback(bytes, charset);
  };

  let output = '';
  let cursor = 0;
  let previousEndedWithEncodedWord = false;
  let match = encodedWordPattern.exec(source);
  while (match) {
    const [fullMatch, charset, encoding, encodedText] = match;
    const gap = source.slice(cursor, match.index);
    if (!(previousEndedWithEncodedWord && /^\s*$/.test(gap))) {
      output += gap;
    }
    output += decodeWord(fullMatch, charset, encoding, encodedText);
    cursor = match.index + fullMatch.length;
    previousEndedWithEncodedWord = true;
    match = encodedWordPattern.exec(source);
  }
  output += source.slice(cursor);
  return output;
}

function parseContentTypeHeader(contentType = '') {
  const raw = String(contentType || '');
  const [mimeTypeRaw, ...paramChunks] = raw.split(';');
  const params = {};
  paramChunks.forEach(chunk => {
    const idx = chunk.indexOf('=');
    if (idx === -1) return;
    const key = chunk.slice(0, idx).trim().toLowerCase();
    const value = chunk.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
    if (key) params[key] = value;
  });
  return {
    mimeType: String(mimeTypeRaw || '').trim().toLowerCase(),
    params
  };
}

function parseRfc822Headers(headerText) {
  const headers = {};
  let currentName = '';
  String(headerText || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach(line => {
      if (!line.trim()) return;
      if (/^\s/.test(line) && currentName) {
        headers[currentName] = `${headers[currentName]} ${line.trim()}`.trim();
        return;
      }
      const idx = line.indexOf(':');
      if (idx === -1) return;
      currentName = line.slice(0, idx).trim().toLowerCase();
      headers[currentName] = line.slice(idx + 1).trim();
    });
  ['subject', 'from', 'sender'].forEach((name) => {
    if (headers[name]) headers[name] = decodeMimeEncodedWordValue(headers[name]);
  });
  return headers;
}

function decodeEmailTransferBody(body, { transferEncoding = '', charset = '' } = {}) {
  const rawBody = String(body || '');
  const encoding = String(transferEncoding || '').toLowerCase().trim();
  let decodedBytes = null;

  if (encoding.includes('base64')) {
    try {
      const compact = rawBody.replace(/\s+/g, '');
      const binary = atob(compact);
      decodedBytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    } catch (_) {
      decodedBytes = Uint8Array.from(rawBody, ch => ch.charCodeAt(0) & 0xff);
    }
  } else if (encoding.includes('quoted-printable')) {
    const normalized = rawBody.replace(/\r\n?/g, '\n').replace(/=\n/g, '');
    const bytes = [];
    for (let i = 0; i < normalized.length; i += 1) {
      const ch = normalized[i];
      if (ch === '=' && /^[0-9a-fA-F]{2}$/.test(normalized.slice(i + 1, i + 3))) {
        bytes.push(parseInt(normalized.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(ch.charCodeAt(0) & 0xff);
      }
    }
    decodedBytes = Uint8Array.from(bytes);
  } else if (
    !encoding ||
    encoding.includes('7bit') ||
    encoding.includes('8bit') ||
    encoding.includes('binary')
  ) {
    decodedBytes = Uint8Array.from(rawBody, ch => ch.charCodeAt(0) & 0xff);
  } else {
    decodedBytes = Uint8Array.from(rawBody, ch => ch.charCodeAt(0) & 0xff);
  }

  return decodeEmailBytesWithCharsetFallback(decodedBytes, charset).replace(/\r\n?/g, '\n');
}

function hideUrlsInText(text) {
  return String(text || '')
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>()]+/gi, '')
    .replace(/\s{2,}/g, ' ');
}

function cleanEmailBodyText(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n');
  if (!raw.trim()) return '';

  const noHtml = stripToPlainText(raw, '.html');
  const lines = noHtml.split('\n');
  const cleaned = [];
  let skippedDisclaimer = false;

  const shouldDropLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^(view|open|download|manage)\s+(in\s+browser|online|preferences|unsubscribe)\b/i.test(trimmed)) return true;
    if (/^\[?(?:image|cid):.+\]?$/i.test(trimmed)) return true;
    if (/^(?:https?:\/\/|www\.)\S+$/i.test(trimmed)) return true;
    if (/^(?:from|to|cc|bcc|subject|sent|date):\s*$/i.test(trimmed)) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      if (skippedDisclaimer) skippedDisclaimer = false;
      cleaned.push('');
      continue;
    }
    if (shouldDropLine(line)) continue;
    if (/^[-_=]{6,}$/.test(trimmed)) continue;
    if (!skippedDisclaimer && /^(this (email|message)( and any attachments)?|confidentiality notice|privileged and confidential)\b/i.test(trimmed)) {
      skippedDisclaimer = true;
      continue;
    }
    if (skippedDisclaimer) {
      if (!trimmed) skippedDisclaimer = false;
      continue;
    }
    if (/^sent from my (iphone|ipad|android|mobile device)\.?$/i.test(trimmed)) continue;
    cleaned.push(line);
  }

  return normalizeReadableText(hideUrlsInText(cleaned.join('\n')));
}

function parseContentDispositionHeader(contentDisposition = '') {
  const parsed = parseContentTypeHeader(contentDisposition);
  return {
    disposition: parsed.mimeType,
    params: parsed.params
  };
}

function splitEmailHeadersAndBody(rawPart = '') {
  const normalized = String(rawPart || '').replace(/\r\n?/g, '\n');
  const splitIdx = normalized.indexOf('\n\n');
  if (splitIdx === -1) {
    return {
      headers: {},
      bodyRaw: normalized
    };
  }
  return {
    headers: parseRfc822Headers(normalized.slice(0, splitIdx)),
    bodyRaw: normalized.slice(splitIdx + 2)
  };
}

function splitMultipartBodyParts(bodyRaw = '', boundary = '') {
  if (!boundary) return [];
  const marker = `--${boundary}`;
  const closeMarker = `--${boundary}--`;
  const lines = String(bodyRaw || '').replace(/\r\n?/g, '\n').split('\n');
  const parts = [];
  let currentLines = null;

  for (const line of lines) {
    if (line === marker || line.trim() === marker) {
      if (Array.isArray(currentLines)) parts.push(currentLines.join('\n').trim());
      currentLines = [];
      continue;
    }
    if (line === closeMarker || line.trim() === closeMarker) {
      if (Array.isArray(currentLines)) parts.push(currentLines.join('\n').trim());
      currentLines = null;
      break;
    }
    if (Array.isArray(currentLines)) currentLines.push(line);
  }

  if (Array.isArray(currentLines) && currentLines.length) {
    parts.push(currentLines.join('\n').trim());
  }
  return parts.filter(Boolean);
}

function collectMimeBodyCandidates(rawPart, inheritedCharset = '', sink = []) {
  const { headers, bodyRaw } = splitEmailHeadersAndBody(rawPart);
  const typeInfo = parseContentTypeHeader(headers['content-type'] || '');
  const dispositionInfo = parseContentDispositionHeader(headers['content-disposition'] || '');
  const mimeType = typeInfo.mimeType || 'text/plain';
  const charset = typeInfo.params.charset || inheritedCharset || '';

  if (mimeType.startsWith('multipart/')) {
    const childParts = splitMultipartBodyParts(bodyRaw, typeInfo.params.boundary || '');
    childParts.forEach((childPart) => {
      collectMimeBodyCandidates(childPart, charset, sink);
    });
    return sink;
  }

  if (dispositionInfo.disposition === 'attachment') return sink;

  const decodedPart = decodeEmailTransferBody(bodyRaw, {
    transferEncoding: headers['content-transfer-encoding'],
    charset
  });
  if (mimeType.includes('text/plain')) {
    sink.push({ priority: 0, order: sink.length, bodyText: decodedPart });
  } else if (mimeType.includes('text/html')) {
    sink.push({ priority: 1, order: sink.length, bodyText: stripToPlainText(decodedPart, '.html') });
  }
  return sink;
}

function extractBestEmailBody(raw) {
  const normalized = String(raw || '').replace(/\r\n?/g, '\n');
  const { headers: rootHeaders, bodyRaw: rootBody } = splitEmailHeadersAndBody(normalized);
  if (!Object.keys(rootHeaders).length) {
    return { headers: {}, bodyText: normalized };
  }

  const rootType = parseContentTypeHeader(rootHeaders['content-type'] || '');
  const rootCharset = rootType.params.charset || '';
  const candidates = collectMimeBodyCandidates(normalized, rootCharset, []);

  if (candidates.length) {
    candidates.sort((a, b) => (a.priority - b.priority) || (a.order - b.order));
    return { headers: rootHeaders, bodyText: candidates[0].bodyText };
  }

  if (!rootType.mimeType.includes('multipart/')) {
    const decoded = decodeEmailTransferBody(rootBody, {
      transferEncoding: rootHeaders['content-transfer-encoding'],
      charset: rootCharset
    });
    const bodyText = rootType.mimeType.includes('text/html') ? stripToPlainText(decoded, '.html') : decoded;
    return { headers: rootHeaders, bodyText };
  }

  return { headers: rootHeaders, bodyText: rootBody };
}

function splitEmailThreadMessages(bodyText, rootHeaders = {}) {
  const lines = String(bodyText || '').replace(/\r\n?/g, '\n').split('\n');
  const segments = [];
  let current = [];

  const pushCurrent = () => {
    if (!current.length) return;
    const text = cleanEmailBodyText(current.join('\n'));
    if (text) segments.push(text);
    current = [];
  };

  const isHeaderBlockStart = (idx) => {
    const line = (lines[idx] || '').trim();
    if (!/^From:\s+/i.test(line)) return false;
    const lookahead = lines.slice(idx + 1, idx + 7).join('\n');
    return /(^|\n)(Sent|Date):\s+/i.test(lookahead) && /(^|\n)Subject:\s+/i.test(lookahead);
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const isOnWrote = /^On\b.+\bwrote:\s*$/i.test(trimmed);
    const isQuote = /^>+/.test(trimmed);
    const startsHeaderBlock = isHeaderBlockStart(idx);

    if (isOnWrote || startsHeaderBlock) {
      pushCurrent();
      current.push(line);
      return;
    }
    if (isQuote && current.length && !current.every(entry => /^>+/.test(entry.trim()))) {
      pushCurrent();
    }
    current.push(line);
  });
  pushCurrent();

  const rootSender = rootHeaders.from || rootHeaders.sender || '';
  const rootDate = rootHeaders.date || '';
  return segments
    .map((segment, idx) => {
      const segmentLines = segment.split('\n');
      let sender = '';
      let date = '';
      const bodyLines = [];
      segmentLines.forEach(line => {
        const trimmed = line.trim();
        if (!sender && /^(From|Sender):\s*/i.test(trimmed)) {
          sender = trimmed.replace(/^(From|Sender):\s*/i, '').trim();
          return;
        }
        if (!date && /^(Date|Sent):\s*/i.test(trimmed)) {
          date = trimmed.replace(/^(Date|Sent):\s*/i, '').trim();
          return;
        }
        if (/^(To|Cc|Bcc|Subject):\s*/i.test(trimmed)) return;
        bodyLines.push(line.replace(/^>+\s?/, ''));
      });
      const body = cleanEmailBodyText(bodyLines.join('\n'));
      return {
        sender: sender || (idx === 0 ? rootSender : ''),
        date: date || (idx === 0 ? rootDate : ''),
        body
      };
    })
    .filter(entry => entry.body);
}

function parseEmailToThread(raw, filename = '') {
  const lower = String(filename || '').toLowerCase();
  const format = lower.endsWith('.msg') ? 'msg' : 'eml';
  const { headers, bodyText } = extractBestEmailBody(raw);
  const messages = splitEmailThreadMessages(bodyText, headers);
  return {
    messages,
    latestMessage: messages[0] || null,
    sourceMeta: {
      filename,
      format,
      subject: headers.subject || '',
      totalMessages: messages.length
    }
  };
}

function getOrderedEmailMessages(parsedThread, order = emailThreadOrder) {
  const messages = Array.isArray(parsedThread?.messages) ? [...parsedThread.messages] : [];
  return order === 'oldest-first' ? messages.reverse() : messages;
}

function normalizeEmailThreadOrder(value) {
  return value === 'oldest-first' ? 'oldest-first' : 'newest-first';
}

function buildEmailThreadPlainText(parsedThread, order = emailThreadOrder) {
  const subject = parsedThread?.sourceMeta?.subject ? `Subject: ${parsedThread.sourceMeta.subject}` : '';
  const intro = [
    'Email Thread',
    subject,
    parsedThread?.sourceMeta?.totalMessages ? `Messages parsed: ${parsedThread.sourceMeta.totalMessages}` : ''
  ].filter(Boolean).join('\n');

  const blocks = getOrderedEmailMessages(parsedThread, order).map((message, idx) => {
    const sender = message.sender || 'Unknown sender';
    const date = message.date || 'Unknown date';
    return `Message ${idx + 1}\nFrom: ${sender}\nDate: ${date}\n\n${message.body}`;
  });
  return cleanEmailBodyText([intro, ...blocks].filter(Boolean).join('\n\n'));
}

function stringifyEmailParticipant(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  if (Array.isArray(entry)) return entry.map(item => stringifyEmailParticipant(item)).filter(Boolean).join(', ');
  const name = String(entry.name || entry.displayName || '').trim();
  const email = String(entry.email || entry.emailAddress || '').trim();
  if (name && email) return `${name} <${email}>`;
  return name || email;
}

function parseOutlookMsgDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  const asText = String(value).trim();
  if (!asText) return '';
  const parsed = new Date(asText);
  return Number.isNaN(parsed.getTime()) ? asText : parsed.toISOString();
}

function getMsgReaderRuntimeState() {
  const runtime = window.__msgReaderRuntime || {};
  return {
    available: typeof window.MSGReader === 'function',
    source: runtime.source || 'unknown',
    attemptedSources: Array.isArray(runtime.attemptedSources) ? runtime.attemptedSources : [],
    errors: Array.isArray(runtime.errors) ? runtime.errors : []
  };
}

function logMsgImportTelemetry(path, details = {}) {
  const runtime = getMsgReaderRuntimeState();
  const payload = {
    marker: 'msg-import-path',
    path,
    parserAvailable: runtime.available,
    parserSource: runtime.source,
    attemptedSources: runtime.attemptedSources,
    ...details
  };
  console.info('[LUMEN_MSG_IMPORT]', payload);
}

function buildMsgFailureGuidance(fileName = 'message.msg', runtimeState = getMsgReaderRuntimeState()) {
  const parserState = runtimeState.available
    ? `Structured parser was available (${runtimeState.source}).`
    : 'Structured parser was unavailable in this session.';
  return [
    `<strong>.msg import needs recovery</strong>`,
    `<p>${parserState} We attempted binary recovery but couldn't extract enough readable content from <code>${escapeHtml(fileName)}</code>.</p>`,
    '<ul>',
    '<li>Re-export this email as <code>.eml</code> from Outlook, then import it here.</li>',
    '<li>If possible, copy the message body into <code>.txt</code> or <code>.html</code> and import that file.</li>',
    '<li>For compliance archives, request the original MIME source from the sender/admin.</li>',
    '</ul>'
  ].join('');
}

async function parseOutlookMsgFile(file) {
  if (!window.MSGReader) return null;
  const bytes = await file.arrayBuffer();
  let parsedData = null;
  try {
    const reader = new window.MSGReader(new Uint8Array(bytes));
    parsedData = reader.getFileData();
  } catch (_) {
    try {
      const fallbackReader = new window.MSGReader(bytes);
      parsedData = fallbackReader.getFileData();
    } catch (__){
      return null;
    }
  }
  if (!parsedData || typeof parsedData !== 'object') return null;

  const from = stringifyEmailParticipant(parsedData.senderName || parsedData.senderEmail || parsedData.from || parsedData.author);
  const subject = String(parsedData.subject || '').trim();
  const date = parseOutlookMsgDate(parsedData.messageDeliveryTime || parsedData.clientSubmitTime || parsedData.date);
  const to = stringifyEmailParticipant(parsedData.recipients || parsedData.to);
  const cc = stringifyEmailParticipant(parsedData.cc);
  const body = cleanEmailBodyText(parsedData.body || parsedData.bodyText || parsedData.message || parsedData.htmlBody || parsedData.compressedRtf || '');

  const headerLines = [
    from ? `From: ${from}` : '',
    to ? `To: ${to}` : '',
    cc ? `Cc: ${cc}` : '',
    subject ? `Subject: ${subject}` : '',
    date ? `Date: ${date}` : ''
  ].filter(Boolean).join('\n');

  const plainText = cleanEmailBodyText([headerLines, body].filter(Boolean).join('\n\n'));
  if (!plainText) return null;

  const thread = {
    messages: [{
      sender: from,
      date,
      body: body || plainText
    }],
    latestMessage: null,
    sourceMeta: {
      filename: file.name || 'message.msg',
      format: 'msg',
      subject,
      totalMessages: 1
    }
  };
  thread.latestMessage = thread.messages[0];
  return { plainText, thread };
}

function decodeUtf16LePrintableStrings(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || 0);
  if (!bytes.length) return [];
  const decoded = new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
  return decoded
    .split(/\u0000+/)
    .map(chunk => normalizeReadableText(chunk))
    .filter(chunk => chunk.length > 6 && /[A-Za-z]/.test(chunk));
}

function decodeLatin1PrintableStrings(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || 0);
  if (!bytes.length) return [];
  const decoded = new TextDecoder('latin1', { fatal: false }).decode(bytes);
  return decoded
    .split(/\u0000|[\x01-\x08\x0B\x0C\x0E-\x1F]+/g)
    .map(chunk => normalizeReadableText(chunk))
    .filter(chunk => chunk.length > 6 && /[A-Za-z]/.test(chunk));
}

async function extractMsgTextFallback(file) {
  const bytes = await file.arrayBuffer();
  const utf16Segments = decodeUtf16LePrintableStrings(bytes);
  const latinSegments = decodeLatin1PrintableStrings(bytes);
  const candidates = [...utf16Segments, ...latinSegments]
    .filter((segment, index, arr) => arr.indexOf(segment) === index)
    .map(segment => cleanEmailBodyText(segment))
    .filter(Boolean);

  if (!candidates.length) return null;

  const body = candidates
    .filter(segment => {
      const lineCount = segment.split('\n').filter(Boolean).length;
      const wordCount = segment.split(/\s+/).filter(Boolean).length;
      return lineCount >= 2 || wordCount >= 18;
    })
    .sort((a, b) => b.length - a.length)[0] || candidates.sort((a, b) => b.length - a.length)[0];

  if (!body) return null;
  const plainText = cleanEmailBodyText(body);
  if (!plainText) return null;

  const thread = {
    messages: [{
      sender: '',
      date: '',
      body: plainText
    }],
    latestMessage: null,
    sourceMeta: {
      filename: file.name || 'message.msg',
      format: 'msg',
      subject: '',
      totalMessages: 1
    }
  };
  thread.latestMessage = thread.messages[0];
  return { plainText, thread, fallback: true };
}

async function loadEmailFile(file) {
  const isMsgFile = await isLikelyMsgFile(file);
  if (isMsgFile) {
    await (window.__msgReaderReadyPromise || Promise.resolve());
    const msgRuntime = getMsgReaderRuntimeState();
    if (!msgRuntime.available) {
      renderReaderNotice([
        '<strong>Structured .msg parsing unavailable</strong>',
        '<p>The structured parser did not load in this session, so Lumen will attempt limited binary recovery.</p>',
        '<ul>',
        '<li>Recovered text may miss attachments, thread headers, and some metadata.</li>',
        '<li>For highest fidelity, export this message as <code>.eml</code> and import again.</li>',
        '</ul>'
      ].join(''));
    }
    const parsedMsg = await parseOutlookMsgFile(file);
    if (parsedMsg?.plainText) {
      logMsgImportTelemetry('structured-parse', {
        filename: file.name,
        recovered: false
      });
      setCurrentDocumentMeta({
        id: `file:${file.name}:${file.size}:${file.lastModified || 0}`,
        label: file.name,
        type: 'email-file'
      });
      emailThreadModel = parsedMsg.thread;
      return reRenderEmailThreadFromModel(file.name, `Email · ${file.name}`, { persist: true });
    }
    const recoveredMsg = await extractMsgTextFallback(file);
    if (recoveredMsg?.plainText) {
      logMsgImportTelemetry('binary-recovery-parse', {
        filename: file.name,
        recovered: true
      });
      setCurrentDocumentMeta({
        id: `file:${file.name}:${file.size}:${file.lastModified || 0}`,
        label: file.name,
        type: 'email-file'
      });
      emailThreadModel = recoveredMsg.thread;
      return reRenderEmailThreadFromModel(
        file.name,
        `Email · ${file.name}${recoveredMsg.fallback ? ' · Limited recovery' : ''}`,
        { persist: true }
      );
    }
  }

  const raw = await file.text();
  if (isMsgFile) {
    const sample = String(raw || '').slice(0, 4096);
    const printableCount = (sample.match(/[\x09\x0A\x0D\x20-\x7E]/g) || []).length;
    const printableRatio = sample.length ? printableCount / sample.length : 0;
    if (printableRatio < 0.7) {
      const runtime = getMsgReaderRuntimeState();
      logMsgImportTelemetry('failure-guidance', {
        filename: file.name,
        printableRatio: Number(printableRatio.toFixed(3))
      });
      setCurrentDocumentMeta({
        id: `file:${file.name}:${file.size}:${file.lastModified || 0}`,
        label: file.name,
        type: 'email-file'
      });
      renderReaderNotice(buildMsgFailureGuidance(file.name, runtime));
      return;
    }
  }
  const parsedThread = parseEmailToThread(raw, file.name);
  setCurrentDocumentMeta({
    id: `file:${file.name}:${file.size}:${file.lastModified || 0}`,
    label: file.name,
    type: 'email-file'
  });
  emailThreadModel = parsedThread;
  return reRenderEmailThreadFromModel(file.name, `Email · ${file.name}`, { persist: true });
}

function tryParseUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch (_) {
    return null;
  }
}

function getGoogleDocExportUrl(rawUrl) {
  const parsed = tryParseUrl(rawUrl);
  if (!parsed) return null;
  if (!/^(docs|drive)\.google\.com$/i.test(parsed.hostname)) return null;

  const parts = parsed.pathname.split('/').filter(Boolean);
  const docIdx = parts.findIndex(part => part === 'document');
  if (docIdx === -1) return null;

  const dIdx = parts.findIndex((part, idx) => idx > docIdx && part === 'd');
  if (dIdx === -1 || !parts[dIdx + 1]) return null;
  const docId = parts[dIdx + 1];
  return `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=txt`;
}

async function fetchPlainTextFromUrl(url) {
  const parsedUrl = tryParseUrl(url);
  if (!parsedUrl || !/^https?:$/i.test(parsedUrl.protocol)) {
    throw new Error('Only HTTP(S) URLs are supported');
  }

  const googleDocExportUrl = getGoogleDocExportUrl(url);
  if (googleDocExportUrl) {
    const exportRes = await fetch(googleDocExportUrl);
    if (!exportRes.ok) throw new Error(`Google Docs export failed: HTTP ${exportRes.status}`);
    const exportText = normalizeReadableText(await exportRes.text());
    if (exportText) {
      return { plainText: exportText, sourceLabel: 'Google Doc' };
    }
  }

  const attempts = [
    { sourceLabel: 'Web page', requestUrl: parsedUrl.toString(), mode: 'html' },
    { sourceLabel: 'Web page · Reader mirror', requestUrl: `https://r.jina.ai/${parsedUrl.toString()}`, mode: 'text' }
  ];
  const errors = [];

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.requestUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      const plainText = attempt.mode === 'html'
        ? stripToPlainText(body, '.html')
        : normalizeReadableText(body);
      if (plainText) {
        return { plainText, sourceLabel: attempt.sourceLabel };
      }
      errors.push(`${attempt.sourceLabel}: empty response`);
    } catch (err) {
      errors.push(`${attempt.sourceLabel}: ${err && err.message ? err.message : 'request failed'}`);
    }
  }

  throw new Error(errors.join(' | ') || 'Unable to load URL content');
}

function normalizeReadableText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeFlowSentence(text) {
  return String(text || '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([(\[{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function detectFlowHeading(line) {
  const trimmed = normalizeFlowSentence(line);
  if (!trimmed) return null;
  const markdownMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (markdownMatch) {
    const level = markdownMatch[1].length <= 2 ? 2 : 3;
    return { level, text: normalizeFlowSentence(markdownMatch[2]) };
  }

  const wordCount = trimmed.split(/\s+/).length;
  const hasSentencePunctuation = /[.?!]$/.test(trimmed);
  const sectionLike = /^((\d+(\.\d+)*)|([IVXLCM]+))[\].:)\s-]+\S+/i.test(trimmed);
  const titleCaseLike = /^[A-Z0-9][A-Za-z0-9''"""(),/&\-]+(?:\s+[A-Z0-9][A-Za-z0-9''"""(),/&\-]+){0,9}$/.test(trimmed);
  const allCapsLike = /^[A-Z0-9][A-Z0-9\s\-—:&/]{3,}$/.test(trimmed);
  const endsWithColon = /:$/.test(trimmed);

  if (wordCount <= 10 && !hasSentencePunctuation && (sectionLike || allCapsLike || endsWithColon || titleCaseLike)) {
    return { level: wordCount <= 5 ? 2 : 3, text: trimmed.replace(/:$/, '') };
  }
  return null;
}

function getLineTextCasingRatio(text) {
  const letters = String(text || '').match(/[A-Za-z]/g) || [];
  if (!letters.length) return 0;
  const upperLetters = letters.filter(char => char === char.toUpperCase()).length;
  return upperLetters / letters.length;
}

function scoreHeadingCandidate(line, neighbors = {}, pageStats = {}) {
  if (!line || !line.text) return { kind: 'paragraph', score: 0 };
  const text = normalizeFlowSentence(line.text);
  if (!text) return { kind: 'paragraph', score: 0 };
  const wordCount = text.split(/\s+/).length;
  const punctuationEnded = /[.?!]$/.test(text);
  const regexCue = detectFlowHeading(text);
  const sectionLike = /^((\d+(\.\d+)*)|([IVXLCM]+))[\].:)\s-]+\S+/i.test(text);
  const titleCaseLike = /^[A-Z0-9][A-Za-z0-9''"""(),/&\-]+(?:\s+[A-Z0-9][A-Za-z0-9''"""(),/&\-]+){0,9}$/.test(text);
  const allCapsLike = /^[A-Z0-9][A-Z0-9\s\-—:&/]{3,}$/.test(text);
  const endsWithColon = /:$/.test(text);
  const prevLine = neighbors.prev || null;
  const nextLine = neighbors.next || null;

  const relativeFontSize = Number(line.relativeFontSize) || 1;
  const textCasingRatio = Number(line.textCasingRatio) || 0;
  const precedingWhitespace = Number(line.precedingWhitespace) || 0;
  const followingWhitespace = Number(line.followingWhitespace) || 0;
  const centerednessScore = Number(line.centerednessScore) || 0;
  const medianGap = Number(pageStats.medianLineGap) || 12;

  let score = 0;

  if (relativeFontSize >= 1.32) score += 2.2;
  else if (relativeFontSize >= 1.16) score += 1.35;
  else if (relativeFontSize >= 1.08) score += 0.55;

  if (precedingWhitespace >= medianGap * 1.1) score += 0.95;
  else if (precedingWhitespace >= medianGap * 0.6) score += 0.45;

  if (followingWhitespace >= medianGap * 1.1) score += 0.75;
  else if (followingWhitespace >= medianGap * 0.6) score += 0.35;

  if (centerednessScore >= 0.7) score += 0.9;
  else if (centerednessScore >= 0.55) score += 0.45;

  if (wordCount >= 2 && wordCount <= 12) score += 0.45;
  if (wordCount > 16) score -= 1.2;
  if (punctuationEnded) score -= 0.75;

  if (textCasingRatio >= 0.55 && textCasingRatio <= 0.92) score += 0.45;
  if (textCasingRatio > 0.96 && wordCount >= 3 && wordCount <= 10) score += 0.3;

  // Regex cues are intentionally weak; styling and spacing dominate.
  if (regexCue) score += 0.55;
  if (sectionLike) score += 0.35;
  if (titleCaseLike) score += 0.3;
  if (endsWithColon) score += 0.25;
  if (allCapsLike) score += 0.2;

  // Suppress frequent false positives.
  const shortAllCapsLabel = textCasingRatio >= 0.97 && wordCount <= 3 && !sectionLike && !endsWithColon;
  const legalStampLike = /^(page\s+\d+(\s+of\s+\d+)?|confidential|draft|copyright\b|all rights reserved|do not distribute|privileged and confidential|for internal use only)\b/i.test(text);
  const tableHeaderLike = (
    /[|]/.test(text) ||
    /^\s*[A-Z][A-Z0-9/%\-]{1,}\s+(?:[A-Z][A-Z0-9/%\-]{1,}\s+){1,6}[A-Z][A-Z0-9/%\-]{1,}\s*$/.test(text)
  ) && wordCount <= 8 && textCasingRatio >= 0.85;
  const uniformRowPair = Boolean(
    nextLine &&
    Math.abs((nextLine.lineWidth || 0) - (line.lineWidth || 0)) < Math.max(28, (pageStats.pageWidth || 800) * 0.06) &&
    Math.abs((nextLine.relativeFontSize || 1) - relativeFontSize) < 0.05 &&
    (Number(nextLine.precedingWhitespace) || 0) < medianGap * 0.35
  );

  if (shortAllCapsLabel && relativeFontSize < 1.2 && centerednessScore < 0.72) return { kind: 'paragraph', score: score - 2.5, suppressed: 'short_all_caps_label' };
  if (legalStampLike) return { kind: 'paragraph', score: score - 3.2, suppressed: 'legal_stamp' };
  if (tableHeaderLike && (uniformRowPair || centerednessScore < 0.45)) return { kind: 'paragraph', score: score - 3, suppressed: 'table_header' };

  if (prevLine && Math.abs((prevLine.relativeFontSize || 1) - relativeFontSize) < 0.02 && precedingWhitespace < medianGap * 0.2 && wordCount > 10) {
    score -= 0.65;
  }

  if (score >= 3.65) return { kind: relativeFontSize >= 1.24 ? 'h2' : 'h3', score };
  if (score >= 2.4) return { kind: 'h3', score };
  return { kind: 'paragraph', score };
}

function detectFlowListItem(line) {
  const trimmed = normalizeFlowSentence(line);
  if (!trimmed) return null;
  const match = trimmed.match(/^([•◦▪●◉○■□►▸▹▻➤➢◆◇★☆✓✔✗✘\-*+]|(?:\d{1,3}|[a-zA-Z])[.)])\s+(.+)$/);
  if (!match) return null;
  return normalizeFlowSentence(match[2]);
}

function splitFlowCompositeLine(line) {
  const normalized = normalizeFlowSentence(line);
  if (!normalized) return [];

  const bulletExpanded = normalized
    .replace(/\s*([•◦▪●◉○■□►▸▹▻➤➢◆◇★☆✓✔✗✘])\s*/g, '\n$1 ')
    .split(/\n+/)
    .map(part => normalizeFlowSentence(part))
    .filter(Boolean);

  const segments = [];
  bulletExpanded.forEach(part => {
    const embeddedHeading = part.match(/(^|.+?\s)([A-Z][A-Z0-9/&\-\s]{10,}(?:\s+—\s+[A-Z0-9/&\-\s]{8,})?)(\s+(?:What|How|Why|When|Where|Who|Is|Are|Can|Do|Did|Could|Would)\b.+)$/);
    if (!embeddedHeading) {
      segments.push(part);
      return;
    }

    const [, beforeRaw, headingRaw, afterRaw] = embeddedHeading;
    const before = normalizeFlowSentence(beforeRaw || '');
    const heading = normalizeFlowSentence(headingRaw || '');
    const after = normalizeFlowSentence(afterRaw || '');
    if (before) segments.push(before);
    if (heading) segments.push(heading);
    if (after) segments.push(after);
  });

  return segments;
}

function normalizeParagraphText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([(\[{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .replace(/\s+([''"])/g, '$1')
    .replace(/([''"])\s+/g, '$1')
    .replace(/([.!?]){2,}/g, '$1')
    .trim();
}

function lineHasTerminalPunctuation(text) {
  return /[.!?;:]["''")\]]*$/.test(normalizeFlowSentence(text));
}

function startsWithLowercase(text) {
  return /^[a-z]/.test(normalizeFlowSentence(text));
}

function endsWithHyphenatedWord(text) {
  return /[A-Za-z]-$/.test(normalizeFlowSentence(text));
}

function isStrongBreakLine(line, nextLine = null, pageStats = {}) {
  if (!line || !line.text) return false;
  const text = normalizeFlowSentence(line.text);
  if (!text) return false;
  if (detectFlowListItem(text)) return true;
  if (detectFlowHeading(text)) return true;
  if (text.length <= 90 && /:$/.test(text)) return true;
  const headingScore = scoreHeadingCandidate(line, { prev: null, next: nextLine }, pageStats);
  return headingScore.kind !== 'paragraph' && headingScore.score >= 2.9;
}

function reconstructFlowParagraphs(contentLines, pageStats = {}) {
  const paragraphs = [];
  let paraBuffer = [];
  let lastY = null;
  let baselineGap = 0;

  const flush = () => {
    if (!paraBuffer.length) return;
    paragraphs.push(normalizeParagraphText(paraBuffer.join(' ')));
    paraBuffer = [];
  };

  contentLines.forEach((line, idx) => {
    const prevLine = idx > 0 ? contentLines[idx - 1] : null;
    if (prevLine) {
      const diff = line.y - prevLine.y;
      baselineGap = baselineGap ? (baselineGap * 0.7 + diff * 0.3) : diff;
    }
    const dynamicBreak = baselineGap ? Math.max(10, baselineGap * 1.7) : 22;
    const prevText = prevLine?.text || '';
    const nextStartsLower = startsWithLowercase(line.text);
    const hyphenContinuation = endsWithHyphenatedWord(prevText) && nextStartsLower;
    const lowercaseContinuation = !lineHasTerminalPunctuation(prevText) && nextStartsLower;
    const strongHardBreak = prevLine && isStrongBreakLine(prevLine, line, pageStats);
    const gapBreak = lastY !== null && (line.y - lastY) > dynamicBreak;

    if (idx > 0 && (gapBreak || (strongHardBreak && !hyphenContinuation && !lowercaseContinuation))) {
      flush();
    }

    if (hyphenContinuation && paraBuffer.length) {
      const previousText = paraBuffer.pop();
      paraBuffer.push(previousText.replace(/-\s*$/, '') + normalizeFlowSentence(line.text));
    } else {
      paraBuffer.push(normalizeFlowSentence(line.text));
    }
    lastY = line.y;
  });
  flush();
  return paragraphs.filter(Boolean);
}

const FLOW_PARAGRAPH_FIXTURES = [
  {
    name: 'hyphenation_join_lowercase',
    lines: [{ text: 'The coordi-' }, { text: 'nation improved outcomes.' }],
    expected: ['The coordination improved outcomes.']
  },
  {
    name: 'continuation_lowercase_without_terminal_punctuation',
    lines: [{ text: 'This is a wrapped line' }, { text: 'continuing the same paragraph.' }],
    expected: ['This is a wrapped line continuing the same paragraph.']
  },
  {
    name: 'hard_break_after_heading',
    lines: [{ text: 'Introduction:' }, { text: 'this section explains context.' }],
    expected: ['Introduction:', 'this section explains context.']
  }
];

function runFlowParagraphFixtureChecks() {
  return FLOW_PARAGRAPH_FIXTURES.map(fixture => {
    const result = reconstructFlowParagraphs(
      fixture.lines.map((line, index) => ({ ...line, y: index * 12 })),
      {}
    );
    return {
      name: fixture.name,
      pass: JSON.stringify(result) === JSON.stringify(fixture.expected),
      expected: fixture.expected,
      got: result
    };
  });
}

let flowParagraphFixtureValidationDone = false;

function buildFlowBlocks(textSegments, pageStats = {}) {
  const blocks = [];
  const sourceLines = [];
  (textSegments || []).forEach(segment => {
    if (segment && typeof segment === 'object' && typeof segment.text === 'string') {
      const compositeLines = splitFlowCompositeLine(segment.text)
        .map(text => normalizeFlowSentence(text))
        .filter(Boolean);
      compositeLines.forEach(text => sourceLines.push({ ...segment, text }));
      return;
    }
    String(segment || '')
      .split(/\n+/)
      .flatMap(line => splitFlowCompositeLine(line))
      .map(line => normalizeFlowSentence(line))
      .filter(Boolean)
      .forEach(text => sourceLines.push({ text }));
  });

  sourceLines.forEach((line, idx) => {
    if (line?.artifactRemoved) {
      blocks.push({ type: 'artifact-debug', text: normalizeFlowSentence(line.text), reason: line.artifactReason || '' });
      return;
    }
    const text = normalizeFlowSentence(line.text);
    if (!text) return;
    const lineObj = { ...line, text };
    const neighbors = {
      prev: sourceLines[idx - 1] || null,
      next: sourceLines[idx + 1] || null
    };
    const headingClassification = scoreHeadingCandidate(lineObj, neighbors, pageStats);
    const listItem = detectFlowListItem(lineObj.text);
    if (listItem) {
      blocks.push({ type: 'list-item', text: listItem });
      return;
    }

    if (headingClassification.kind === 'h2' || headingClassification.kind === 'h3') {
      blocks.push({
        type: 'heading',
        text: normalizeFlowSentence(lineObj.text).replace(/:$/, ''),
        level: headingClassification.kind === 'h2' ? 2 : 3
      });
      return;
    }
    blocks.push({ type: 'paragraph', text: lineObj.text });
  });
  return blocks;
}

function splitIntoSentences(text) {
  const normalized = normalizeFlowSentence(text);
  if (!normalized) return [];
  const protectedInitialisms = normalized.replace(
    /\b(?:[A-Za-z]\.){2,}(?=\s|$|["'"')\]])/g,
    match => match.replace(/\./g, '__FLOW_DOT__')
  );
  const matches = protectedInitialisms.match(/[^.!?]+(?:[.!?]+["'"')]*)+|[^.!?]+$/g) || [];
  return matches
    .map(sentence => sentence.replace(/__FLOW_DOT__/g, '.'))
    .map(sentence => normalizeFlowSentence(sentence))
    .filter(Boolean);
}

const FLOW_SENTENCE_SPLIT_FIXTURES = [
  {
    name: 'keeps_initialism_abbreviation_intact',
    input: 'N.B. all of these had initially been underestimated for fragment length.',
    expected: ['N.B. all of these had initially been underestimated for fragment length.']
  },
  {
    name: 'splits_multiple_terminal_sentences',
    input: 'This line should split cleanly. This one should also split.',
    expected: ['This line should split cleanly.', 'This one should also split.']
  }
];

function runFlowSentenceSplitFixtureChecks() {
  return FLOW_SENTENCE_SPLIT_FIXTURES.map(fixture => {
    const result = splitIntoSentences(fixture.input);
    return {
      name: fixture.name,
      pass: JSON.stringify(result) === JSON.stringify(fixture.expected),
      expected: fixture.expected,
      got: result
    };
  });
}

function expandParagraphBlockForFlowSplit(block) {
  if (!block || block.type !== 'paragraph' || !(flowAutoSplitOn() || chunkModeOn())) return [block];
  const chunkSentenceCount = Math.max(1, Number(document.getElementById('chunkR').value) || 1);
  const splitSentenceCount = flowAutoSplitOn() ? getFlowSplitLineCount() : chunkSentenceCount;
  const sentences = splitIntoSentences(block.text);
  if (sentences.length <= splitSentenceCount) return [block];
  const grouped = [];
  for (let i = 0; i < sentences.length; i += splitSentenceCount) {
    grouped.push({
      type: 'paragraph',
      text: sentences.slice(i, i + splitSentenceCount).join(' '),
      splitFromLongParagraph: true
    });
  }
  return grouped;
}

function renderFlowBlocks(blocks, pageNum) {
  let listEl = null;
  const closeList = () => {
    listEl = null;
  };

  blocks.forEach(originalBlock => {
    const subBlocks = expandParagraphBlockForFlowSplit(originalBlock);
    subBlocks.forEach(block => {
    if (block.type === 'artifact-debug') {
      closeList();
      const artifact = document.createElement('div');
      artifact.className = 'flow-artifact-debug';
      artifact.dataset.page = String(pageNum);
      artifact.textContent = `Filtered artifact: ${block.text}`;
      flowLayer.appendChild(artifact);
      return;
    }
    if (block.type === 'list-item') {
      if (!listEl) {
        listEl = document.createElement('ul');
        listEl.className = 'flow-list';
        listEl.dataset.page = String(pageNum);
        flowLayer.appendChild(listEl);
      }
      const li = document.createElement('li');
      li.className = 'flow-list-item';
      li.dataset.page = String(pageNum);
      li.textContent = block.text;
      listEl.appendChild(li);
      return;
    }

    closeList();
    if (block.type === 'heading') {
      const heading = document.createElement(block.level <= 2 ? 'h2' : 'h3');
      heading.className = `flow-heading ${block.level <= 2 ? 'flow-h2' : 'flow-h3'}`;
      heading.dataset.page = String(pageNum);
      heading.textContent = block.text;
      flowLayer.appendChild(heading);
      return;
    }

      const p = document.createElement('p');
      p.className = 'flow-para';
      if (block.splitFromLongParagraph) p.classList.add('flow-para-split');
      p.dataset.page = String(pageNum);
      p.textContent = block.text;
      flowLayer.appendChild(p);
    });
  });
}

function renderTextFlowFromPlainText(text, originLabel = 'Text source') {
  stopFlowGestureController('flow_rerender');
  const normalized = normalizeReadableText(text);
  const paragraphs = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const blocks = buildFlowBlocks(paragraphs);
  const chunks = [];
  for (let i = 0; i < blocks.length; i += 10) chunks.push(blocks.slice(i, i + 10));
  const totalPages = Math.max(1, chunks.length || 1);

  flowLayer.innerHTML = '';
  chunks.forEach((group, idx) => {
    const pageNum = idx + 1;
    const chip = document.createElement('div');
    chip.className = 'flow-page-chip';
    chip.dataset.page = String(pageNum);
    chip.textContent = `${originLabel} · Segment ${pageNum}`;
    flowLayer.appendChild(chip);
    renderFlowBlocks(group, pageNum);
  });

  if (!blocks.length) {
    const p = document.createElement('p');
    p.className = 'flow-para';
    p.dataset.page = '1';
    p.textContent = 'No readable text was found in this source.';
    flowLayer.appendChild(p);
  }

  return {
    numPages: totalPages,
    plainText: normalized,
    sourceLabel: originLabel
  };
}

async function reRenderEmailThreadFromModel(displayName, sourceLabel, options = {}) {
  if (!emailThreadModel) return;
  const nextOrder = normalizeEmailThreadOrder(options.order ?? emailThreadOrder);
  const preserveScroll = options.preserveScroll !== false;
  const persistDoc = options.persist !== false;
  const previousRatio = preserveScroll && reader.scrollHeight > reader.clientHeight
    ? reader.scrollTop / Math.max(1, reader.scrollHeight - reader.clientHeight)
    : 0;

  const threadText = buildEmailThreadPlainText(emailThreadModel, nextOrder);
  emailThreadOrder = nextOrder;
  refreshEmailThreadOrderControls();
  const extracted = renderTextFlowFromPlainText(threadText, sourceLabel || `Email · ${displayName || emailThreadModel?.sourceMeta?.filename || 'Thread'}`);
  textDoc = {
    ...(textDoc || {}),
    title: displayName || textDoc?.title || emailThreadModel?.sourceMeta?.filename || 'Email thread',
    sourceLabel: sourceLabel || textDoc?.sourceLabel || `Email · ${displayName || 'Thread'}`,
    isEmailThread: true,
    ...extracted
  };

  if (!rInner.contains(flowLayer)) rInner.appendChild(flowLayer);
  flowLayer.classList.add('on');
  rInner.classList.add('flow-mode');
  setPageJumpAvailability(true);
  if (readingMode !== 'flow') setReadingMode('flow');
  await applyReadingMode();
  applyMaxWidth();
  applyGap();
  renderOutlineFallback('Outline is only available for PDFs.');

  if (preserveScroll) {
    const maxScroll = Math.max(0, reader.scrollHeight - reader.clientHeight);
    reader.scrollTop = maxScroll * Math.max(0, Math.min(1, previousRatio));
  }
  updateProgressAndStatus();

  if (persistDoc) {
    await savePersistedDocument({
      type: 'text',
      content: threadText,
      displayName: textDoc.title,
      sourceLabel: textDoc.sourceLabel,
      docMeta: currentDocMeta || null
    });
  }
}

function isEmailImportTypeDetected() {
  const metaType = String(currentDocMeta?.type || '').toLowerCase();
  if (metaType === 'email-file') return true;
  if (textDoc?.isEmailThread) return true;
  const sourceLabel = String(textDoc?.sourceLabel || '').toLowerCase();
  return sourceLabel.startsWith('email ·') || sourceLabel.startsWith('email file ·');
}

function refreshEmailThreadOrderControls() {
  const section = document.getElementById('emailOrderSection');
  const select = document.getElementById('emailOrderSel');
  if (!section || !select) return;

  const emailImportDetected = isEmailImportTypeDetected();
  section.hidden = !emailImportDetected;
  if (!emailImportDetected) return;

  const active = normalizeEmailThreadOrder(emailThreadOrder);
  const enabled = Boolean(emailThreadModel);
  section.classList.toggle('is-disabled', !enabled);
  select.disabled = !enabled;
  select.value = active;
  document.querySelectorAll('.pbtn[data-email-order]').forEach(btn => {
    const on = btn.dataset.emailOrder === active;
    btn.classList.toggle('on', on);
    btn.disabled = !enabled;
  });
}

function setEmailThreadOrder(nextOrder, options = {}) {
  const normalized = normalizeEmailThreadOrder(nextOrder);
  const shouldPersist = options.persist !== false;
  const shouldRerender = options.rerender !== false;
  emailThreadOrder = normalized;
  refreshEmailThreadOrderControls();
  if (shouldPersist) queuePersistSettings();
  if (shouldRerender && emailThreadModel) {
    reRenderEmailThreadFromModel(textDoc?.title || emailThreadModel?.sourceMeta?.filename || 'Email thread', textDoc?.sourceLabel || `Email · ${emailThreadModel?.sourceMeta?.filename || 'Thread'}`, { order: normalized, preserveScroll: true, persist: false });
  }
}

async function loadSourceFile(file) {
  if (isPdfFile(file)) return loadPDF(file);
  if (isEpubFile(file)) {
    try {
      const plainText = await extractEpubText(file);
      setCurrentDocumentMeta({
        id: `file:${file.name}:${file.size}:${file.lastModified || 0}`,
        label: file.name,
        type: 'epub-file'
      });
      return loadTextDocument(plainText, file.name, `EPUB · ${file.name}`);
    } catch (err) {
      console.warn('Failed to parse EPUB:', err);
      renderReaderNotice('Unable to parse this EPUB file. Try a different EPUB export or convert it to TXT/HTML and upload it.');
      return;
    }
  }
  const lowerName = (file?.name || '').toLowerCase();
  const likelyMsgFile = await isLikelyMsgFile(file);
  if (lowerName.endsWith('.eml') || likelyMsgFile) {
    return loadEmailFile(file);
  }
  if (!isTextLikeFile(file)) {
    renderReaderNotice('Unsupported file type. Try PDF, EPUB, TXT, Markdown, HTML, JSON, or email files (.eml/.msg).');
    return;
  }

  const raw = await file.text();
  if (looksLikeUnreadableOutlookBlob(file, raw)) {
    renderReaderNotice(`
      <strong>This Outlook drop looks like a proprietary message blob.</strong>
      We couldn't reliably read this format in-browser. <strong>.eml</strong> is preferred for full thread parsing.
      <ul>
        <li>In Outlook, open the message and save/export it as <strong>.eml</strong>, then upload that file.</li>
        <li>Or copy/paste the email body into a <strong>.txt</strong> file and upload it as a fallback.</li>
      </ul>
    `);
    return;
  }
  const plainText = stripToPlainText(raw, file.name);
  setCurrentDocumentMeta({
    id: `file:${file.name}:${file.size}:${file.lastModified || 0}`,
    label: file.name,
    type: 'text-file'
  });
  return loadTextDocument(plainText, file.name, `File · ${file.name}`);
}

async function loadTextDocument(plainText, displayName, sourceLabel, options = {}) {
  pdf = null;
  flowDocCache = null;
  emailThreadModel = options.emailThreadModel || null;
  stopScroll();
  scrolling = false;
  const scrollBtn = document.getElementById('scrollBtn');
  scrollBtn.textContent = '▶';
  scrollBtn.classList.remove('on');
  reader.scrollTop = 0;
  const extracted = renderTextFlowFromPlainText(plainText, sourceLabel);
  textDoc = { title: displayName, sourceLabel, isEmailThread: Boolean(options.emailThreadModel), ...extracted };
  document.getElementById('upName').textContent = displayName;
  document.getElementById('upName').style.display = 'block';
  reader.classList.remove('drop-ready');
  rInner.innerHTML = '';
  rInner.appendChild(flowLayer);
  flowLayer.classList.add('on');
  rInner.classList.add('flow-mode');
  setPageJumpAvailability(true);
  setReadingMode('flow');
  await applyReadingMode();
  applyMaxWidth();
  applyGap();
  renderOutlineFallback('Outline is only available for PDFs.');
  updateProgressAndStatus();
  refreshEmailThreadOrderControls();
  await savePersistedDocument({
    type: 'text',
    content: String(plainText || ''),
    displayName,
    sourceLabel,
    docMeta: currentDocMeta || null
  });
}

async function loadFromUrl() {
  const input = document.getElementById('urlIn');
  const rawUrl = (input.value || '').trim();
  if (!rawUrl) return;
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const parsedUrl = tryParseUrl(url);
  if (!parsedUrl || !/^https?:$/i.test(parsedUrl.protocol)) {
    rInner.innerHTML = '<div style="padding:40px;color:var(--text-muted);font-size:12px;text-align:center;font-family:\'DM Mono\',monospace;">Please enter a valid website URL that starts with http:// or https://.</div>';
    return;
  }
  setCurrentDocumentMeta({
    id: `url:${parsedUrl.toString()}`,
    label: parsedUrl.toString(),
    type: 'url'
  });
  try {
    const { plainText, sourceLabel } = await fetchPlainTextFromUrl(parsedUrl.toString());
    await loadTextDocument(plainText, parsedUrl.toString(), sourceLabel);
  } catch (err) {
    console.warn('Unable to load URL source:', err);
    rInner.innerHTML = '<div style="padding:40px;color:var(--text-muted);font-size:12px;text-align:center;font-family:\'DM Mono\',monospace;">Could not fetch this URL. The site may block direct requests, so we also tried a reader mirror fallback. For Google Docs, make sure link sharing allows viewer access, then try again—or download as text/HTML and upload it.</div>';
  }
}

async function loadPDF(file) {
  if (!isPdfFile(file)) {
    rInner.innerHTML = '<div style="padding:40px;color:var(--text-muted);font-size:12px;text-align:center;font-family:\'DM Mono\',monospace;">Please upload a valid PDF file.</div>';
    return;
  }

  textDoc = null;
  emailThreadModel = null;
  refreshEmailThreadOrderControls();
  setCurrentDocumentMeta({
    id: `file:${file.name}:${file.size}:${file.lastModified || 0}`,
    label: file.name,
    type: 'pdf-file'
  });
  document.getElementById('upName').textContent = file.name;
  document.getElementById('upName').style.display = 'block';
  reader.classList.remove('drop-ready');
  rInner.innerHTML = '<div style="padding:40px;color:var(--text-muted);font-size:12px;text-align:center;font-family:\'DM Mono\',monospace;">Loading pages…</div>';
  rInner.appendChild(flowLayer);
  flowLayer.classList.remove('on');
  flowLayer.innerHTML = '';
  flowDocCache = null;
  stopScroll();
  scrolling = false;
  const scrollBtn = document.getElementById('scrollBtn');
  scrollBtn.textContent = '▶';
  scrollBtn.classList.remove('on');
  reader.scrollTop = 0;
  currentPage = 0;
  setPageJumpAvailability(false);
  renderOutlineFallback('Loading outline…');

  try {
    const buf = await file.arrayBuffer();
    await savePersistedDocument({
      type: 'pdf',
      bytes: buf,
      name: file.name,
      docMeta: currentDocMeta || null
    });
    pdf = await getPdfDocumentTask({ data: buf }).promise;
    setPageJumpAvailability(true);

    rInner.innerHTML = '';
    rInner.appendChild(flowLayer);
    for (let i = 1; i <= pdf.numPages; i++) await renderPage(i);
    await loadOutline();
    applyFilters();
    await applyReadingMode();
    applyMaxWidth();
    applyGap();
    updateProgressAndStatus();
  } catch (err) {
    console.error('Failed to load PDF:', err);
    pdf = null;
    document.getElementById('statPages').textContent = 'No document';
    rInner.innerHTML = '<div style="padding:40px;color:var(--text-muted);font-size:12px;text-align:center;font-family:\'DM Mono\',monospace;">Unable to load this PDF. Try another file.</div>';
    setPageJumpAvailability(false);
    renderOutlineFallback('Outline unavailable for this document.');
  }
}

async function loadPDFBytes(bytes, name = 'Recovered PDF') {
  textDoc = null;
  emailThreadModel = null;
  refreshEmailThreadOrderControls();
  document.getElementById('upName').textContent = name;
  document.getElementById('upName').style.display = 'block';
  reader.classList.remove('drop-ready');
  rInner.innerHTML = '<div style="padding:40px;color:var(--text-muted);font-size:12px;text-align:center;font-family:\'DM Mono\',monospace;">Restoring previous PDF…</div>';
  rInner.appendChild(flowLayer);
  flowLayer.classList.remove('on');
  flowLayer.innerHTML = '';
  flowDocCache = null;
  stopScroll();
  scrolling = false;
  const scrollBtn = document.getElementById('scrollBtn');
  scrollBtn.textContent = '▶';
  scrollBtn.classList.remove('on');
  reader.scrollTop = 0;
  currentPage = 0;
  setPageJumpAvailability(false);
  renderOutlineFallback('Loading outline…');
  try {
    pdf = await getPdfDocumentTask({ data: bytes }).promise;
    setPageJumpAvailability(true);
    rInner.innerHTML = '';
    rInner.appendChild(flowLayer);
    for (let i = 1; i <= pdf.numPages; i++) await renderPage(i);
    await loadOutline();
    applyFilters();
    await applyReadingMode();
    applyMaxWidth();
    applyGap();
    updateProgressAndStatus();
  } catch (err) {
    console.error('Failed to restore PDF:', err);
    await clearActivePersistedDocumentState();
  }
}

function resetLoadedDocumentUI() {
  pdf = null;
  textDoc = null;
  emailThreadModel = null;
  flowDocCache = null;
  currentDocMeta = null;
  pendingResumeState = null;
  stopScroll();
  scrolling = false;
  currentPage = 0;
  reader.scrollTop = 0;
  document.getElementById('scrollBtn').textContent = '▶';
  document.getElementById('scrollBtn').classList.remove('on');
  document.getElementById('upName').textContent = '';
  document.getElementById('upName').style.display = 'none';
  document.getElementById('fileIn').value = '';
  reader.classList.remove('drop-ready');
  flowLayer.classList.remove('on');
  flowLayer.innerHTML = '';
  rInner.classList.remove('flow-mode');
  rInner.innerHTML = '';
  rInner.appendChild(flowLayer);
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.innerHTML = `
    <div class="empty-icon">📖</div>
    <div class="empty-title">Open a source to begin</div>
    <div class="empty-desc">Upload a document, add a web link, or paste text to start reading. On mobile, tap the + button to quickly add a file or copy in content.</div>
    <div class="empty-actions">
      <button class="pbtn empty-action" id="emptyUploadBtn" type="button">+ Add document</button>
      <button class="pbtn empty-action" id="emptyPasteBtn" type="button">Paste text or URL</button>
    </div>
  `;
  rInner.appendChild(empty);
  document.getElementById('emptyUploadBtn')?.addEventListener('click', triggerFilePicker);
  document.getElementById('emptyPasteBtn')?.addEventListener('click', promptForSourcePaste);
  updateProgressAndStatus();
  setPageJumpAvailability(false);
  renderOutlineFallback('Load a PDF to view navigation links.');
  refreshEmailThreadOrderControls();
  syncReadingModeAvailability();
  refreshResumeCard();
}

async function migrateLegacyActiveRecordIfNeeded() {
  const current = getRecentDocStoragePayload();
  if (current?.[DOC_STATE_MIGRATION_FLAG]) return;
  try {
    const db = await openDocStateDb();
    const legacyRecord = await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STATE_STORE, 'readonly');
      const req = tx.objectStore(DOC_STATE_STORE).get(DOC_STATE_LEGACY_ACTIVE_RECORD_ID);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Failed to read legacy persisted document'));
    });
    if (legacyRecord?.payload) {
      const payload = legacyRecord.payload;
      const fallbackId = payload?.docMeta?.id || `legacy:${payload.type || 'document'}:${legacyRecord.savedAt || Date.now()}`;
      const docMeta = payload?.docMeta || {
        id: fallbackId,
        label: payload.displayName || payload.name || 'Recovered document',
        type: payload.type === 'pdf' ? 'pdf-file' : 'text-file'
      };
      const entry = buildRecentDocEntry(docMeta, payload, {
        savedAt: Number(legacyRecord.savedAt || Date.now()),
        lastOpenedAt: Number(legacyRecord.savedAt || Date.now())
      });
      if (entry) {
        upsertRecentDocEntry(entry);
        await new Promise((resolve, reject) => {
          const tx = db.transaction(DOC_STATE_STORE, 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error('Failed to migrate legacy document'));
          const store = tx.objectStore(DOC_STATE_STORE);
          store.put({
            id: entry.docId,
            payload,
            title: entry.title,
            sourceType: entry.sourceType,
            savedAt: entry.savedAt,
            lastOpenedAt: entry.lastOpenedAt,
            previewExcerpt: entry.previewExcerpt,
            payloadRef: entry.docId
          });
          store.delete(DOC_STATE_LEGACY_ACTIVE_RECORD_ID);
        });
        saveRecentDocStoragePayload({
          activeDocId: entry.docId,
          recentDocs: recentDocEntries,
          [DOC_STATE_MIGRATION_FLAG]: true
        });
      }
    } else {
      saveRecentDocStoragePayload({ [DOC_STATE_MIGRATION_FLAG]: true });
    }
    db.close();
  } catch (err) {
    console.warn('Unable to migrate legacy document cache:', err);
    saveRecentDocStoragePayload({ [DOC_STATE_MIGRATION_FLAG]: true });
  }
}

async function tryOpenRecord(record, fallbackEntry = null) {
  const payload = record?.payload;
  if (!payload) return false;
  const fallbackMeta = {
    id: fallbackEntry?.docId || record?.id || `recovered:${Date.now()}`,
    label: fallbackEntry?.title || record?.title || payload.displayName || payload.name || 'Recovered document',
    type: fallbackEntry?.sourceType || record?.sourceType || payload?.docMeta?.type || payload?.type || 'text-file'
  };
  if (payload.type === 'pdf' && payload.bytes) {
    setCurrentDocumentMeta(payload.docMeta || fallbackMeta);
    await loadPDFBytes(payload.bytes, payload.name || fallbackMeta.label);
    return true;
  }
  if (payload.type === 'text') {
    setCurrentDocumentMeta(payload.docMeta || fallbackMeta);
    await loadTextDocument(payload.content || '', payload.displayName || fallbackMeta.label, payload.sourceLabel || `Recovered source · ${fallbackMeta.label}`);
    return true;
  }
  return false;
}

async function restorePersistedDocument() {
  await migrateLegacyActiveRecordIfNeeded();
  const payload = getRecentDocStoragePayload();
  const preferredId = payload.activeDocId || null;
  const sortedCandidates = getSortedRecentDocEntries();
  const ordered = preferredId
    ? [preferredId, ...sortedCandidates.map(item => item.docId).filter(id => id !== preferredId)]
    : sortedCandidates.map(item => item.docId);
  for (const docId of ordered) {
    const entry = recentDocEntries.find(item => item.docId === docId) || null;
    const record = await loadPersistedDocumentRecordByDocId(docId);
    if (!record?.payload) continue;
    try {
      const opened = await tryOpenRecord(record, entry);
      if (!opened) throw new Error('Unsupported payload format');
      upsertRecentDocEntry({
        ...(entry || {}),
        docId,
        title: record.title || entry?.title || 'Recovered document',
        sourceType: sanitizeSourceType(record.sourceType || entry?.sourceType || 'unknown'),
        savedAt: Number(record.savedAt || entry?.savedAt || Date.now()),
        lastOpenedAt: Date.now(),
        previewExcerpt: buildPreviewExcerpt(record, entry?.previewExcerpt || ''),
        payloadRef: String(record.payloadRef || docId)
      });
      saveRecentDocStoragePayload({ activeDocId: docId, recentDocs: recentDocEntries });
      renderRecentDocList();
      return;
    } catch (err) {
      console.warn(`Skipping unreadable cached document ${docId}:`, err);
      await removeRecentDocument(docId);
    }
  }
}

async function recallRecentDocument(docId) {
  if (!docId) return;
  const record = await loadPersistedDocumentRecordByDocId(docId);
  if (!record?.payload) return;
  const entry = recentDocEntries.find(item => item.docId === docId);
  await tryOpenRecord(record, entry);

  const progress = loadDocProgressMap()[docId];
  if (progress) {
    pendingResumeState = progress;
    refreshResumeCard();
    await restoreSavedPosition();
  }
  upsertRecentDocEntry({
    ...(entry || {}),
    docId,
    title: record.title || entry?.title || progress?.docTitle || 'Recovered document',
    sourceType: sanitizeSourceType(record.sourceType || entry?.sourceType || 'unknown'),
    savedAt: Number(record.savedAt || entry?.savedAt || Date.now()),
    lastOpenedAt: Date.now(),
    previewExcerpt: buildPreviewExcerpt(record, progress?.excerpt || entry?.previewExcerpt || ''),
    payloadRef: String(record.payloadRef || docId)
  });
  saveRecentDocStoragePayload({ activeDocId: docId, recentDocs: recentDocEntries });
  renderRecentDocList();
}

async function renderPage(n) {
  const page = await pdf.getPage(n);
  const wrap = document.createElement('div');
  wrap.className = 'page-wrap';
  wrap.dataset.p = n;

  const canvas = document.createElement('canvas');
  const vp = page.getViewport({ scale: getRenderScale() });
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

  const textDiv = document.createElement('div');
  textDiv.className = 'textLayer';
  await buildTextLayer(page, textDiv, vp);

  const pg = document.createElement('div');
  pg.className = 'page-num';
  pg.textContent = n;

  wrap.appendChild(canvas);
  wrap.appendChild(textDiv);
  wrap.appendChild(pg);
  rInner.appendChild(wrap);
}

async function buildTextLayer(page, textDiv, viewport) {
  const textContent = await page.getTextContent();
  textDiv.innerHTML = '';
  textDiv.classList.add('disabled');
  const pageHeight = viewport.height;
  textContent.items.forEach(item => {
    const span = document.createElement('span');
    span.textContent = item.str;
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const x = tx[4];
    const y = pageHeight - tx[5];
    span.style.left = `${x}px`;
    span.style.top = `${y}px`;
    const baseFontSize = Math.hypot(tx[0], tx[1]).toFixed(2);
    const baseScaleX = Math.hypot(tx[2], tx[3]) / Math.hypot(tx[0], tx[1]) || 1;
    span.dataset.baseFontSize = baseFontSize;
    span.dataset.baseScaleX = baseScaleX;
    span.dataset.baseFontFamily = item.fontName || 'serif';
    span.style.fontSize = `${baseFontSize}px`;
    span.style.fontFamily = span.dataset.baseFontFamily;
    span.style.transform = `scaleX(${baseScaleX})`;
    textDiv.appendChild(span);
  });
}

async function reRender() {
  if (!pdf || rendering) return;
  rendering = true;
  const wraps = rInner.querySelectorAll('.page-wrap');
  for (let i = 0; i < wraps.length; i++) {
    const n = i + 1;
    const page = await pdf.getPage(n);
    const canvas = wraps[i].querySelector('canvas');
    const textDiv = wraps[i].querySelector('.textLayer');
    const vp = page.getViewport({ scale: getRenderScale() });
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    await buildTextLayer(page, textDiv, vp);
  }
  applyMaxWidth();
  applyFilters();
  await applyReadingMode();
  updateProgressAndStatus();
  rendering = false;
}

function applyMaxWidth() {
  rInner.querySelectorAll('.page-wrap').forEach(w => {
    w.style.width = maxW + 'px';
  });
}

function getRenderScale() {
  return maxW / BASE_PAGE_WIDTH;
}

function applyGap() {
  rInner.style.gap = gap + 'px';
}

function applyFilters() {
  const m = MODES[currentMode];
  const bri = document.getElementById('briR').value;
  const con = document.getElementById('conR').value;
  const f = `brightness(${bri}%) contrast(${con}%) ${m.filter}`;
  reader.style.background = m.bg;
  applyEmptyStateContrast(m.bg);
  rInner.querySelectorAll('canvas').forEach(c => c.style.filter = f);
  rInner.querySelectorAll('.page-wrap').forEach(w => w.style.background = m.bg);
  applyReadingMode();
}

function syncReadingModeControls() {
  const typographyEnabled = readingMode === 'overlay' || readingMode === 'flow';
  const isFlow = readingMode === 'flow';
  document.querySelectorAll('.typography-group').forEach(el => el.classList.toggle('collapsed', !typographyEnabled));
  const fontSel = document.getElementById('fontSel');
  if (fontSel) {
    fontSel.disabled = !typographyEnabled;
    fontSel.closest('#typoControls')?.classList.toggle('collapsed', !typographyEnabled);
  }

  ['tsizeR', 'lhR', 'lsR', 'wsR'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !typographyEnabled;
  });

  ['widthR', 'briR', 'conR', 'gapR'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = isFlow;
  });
  document.querySelectorAll('.flow-locked-group').forEach(el => el.classList.toggle('collapsed', isFlow));
  document.querySelectorAll('.flow-only-group').forEach(el => el.classList.toggle('collapsed', !isFlow));
  document.querySelectorAll('.flow-only-note').forEach(el => el.classList.toggle('collapsed', !isFlow));
  const displayModeHint = document.getElementById('displayModeHint');
  if (displayModeHint) displayModeHint.hidden = !isFlow;

  ['rulerT', 'shadeT', 'chunkT', 'chunkR'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  syncChunkFocusAidExclusivity();
  const flowSplitToggle = document.getElementById('flowSplitT');
  if (flowSplitToggle) flowSplitToggle.disabled = !isFlow;
  const flowSplitLines = document.getElementById('flowSplitLinesR');
  if (flowSplitLines) flowSplitLines.disabled = !isFlow || !flowAutoSplitOn();
  const flowSplitSizeRow = document.getElementById('flowSplitSizeRow');
  if (flowSplitSizeRow) flowSplitSizeRow.classList.toggle('collapsed', !isFlow || !flowAutoSplitOn());
  document.getElementById('chunkV').textContent = chunkLengthLabel(Number(document.getElementById('chunkR').value));
  const focusModeHint = document.getElementById('focusModeHint');
  if (focusModeHint) focusModeHint.hidden = !isFlow;
}

function syncChunkFocusAidExclusivity() {
  const chunkToggle = document.getElementById('chunkT');
  const rulerToggle = document.getElementById('rulerT');
  const shadeToggle = document.getElementById('shadeT');
  if (!chunkToggle || !rulerToggle || !shadeToggle) return;
  if (chunkToggle.checked) {
    if (rulerToggle.checked) rulerToggle.checked = false;
    if (shadeToggle.checked) shadeToggle.checked = false;
  }
  [rulerToggle, shadeToggle].forEach(toggle => {
    toggle.disabled = false;
    toggle.closest('.tog')?.classList.remove('is-disabled');
  });
}

function handleFontSelectionChange() {
  const fontKey = normalizeFontKey(document.getElementById('fontSel').value);
  if (fontKey === 'native' && readingMode === 'overlay') {
    setReadingMode('pdf');
  }
  applyReadingMode();
}

function expandSidebarSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const toggleBtn = section.querySelector(':scope > .sec-toggle');
  if (!toggleBtn || !section.classList.contains('is-collapsed')) return;
  document.querySelectorAll('#sidebarPanel .sidebar-scroll > .sec').forEach((otherSection) => {
    if (otherSection === section) return;
    const otherToggle = otherSection.querySelector(':scope > .sec-toggle');
    if (!otherToggle) return;
    otherSection.classList.add('is-collapsed');
    otherToggle.setAttribute('aria-expanded', 'false');
  });
  section.classList.remove('is-collapsed');
  toggleBtn.setAttribute('aria-expanded', 'true');
}

function setReadingMode(mode) {
  const availableModes = getAvailableReadingModesForCurrentContent();
  const normalized = ['pdf', 'overlay', 'flow'].includes(mode) ? mode : 'pdf';
  const nextMode = availableModes.includes(normalized) ? normalized : (availableModes[0] || 'flow');
  syncReadingModeAvailability();
  readingMode = nextMode;
  document.querySelectorAll('input[name="readingMode"]').forEach(input => {
    input.checked = input.value === nextMode;
  });
  if (nextMode === 'overlay') {
    expandSidebarSection('typographySection');
    const fontSel = document.getElementById('fontSel');
    if (fontSel) fontSel.value = 'atkinson';
  }
  const modeTextMap = { pdf: 'Original', overlay: 'Overlay', flow: 'Flow' };
  const currentModeLabel = document.getElementById('readingModeCurrent');
  if (currentModeLabel) currentModeLabel.textContent = modeTextMap[nextMode] || 'Original';
  if (nextMode !== 'flow') {
    resetFlowHoldHud({ keepPausedHud: false });
    clearFlowWordSelection();
    hideFlowDefinitionPopout();
  }
  syncReadingModeControls();
  toggleRuler();
  toggleChunkMode();
  saveSettings();
  saveDocProgress();
}

function normalizeToken(item) {
  return (item?.str || '').replace(/\s+/g, ' ').trim();
}

function buildLineText(tokens) {
  let output = '';
  let prev = null;
  tokens.forEach(token => {
    if (!token.text) return;
    if (!prev) {
      output = token.text;
      prev = token;
      return;
    }
    const gap = token.x - (prev.x + prev.w);
    const compactGap = Math.max(1.8, Math.min(8.5, prev.fontSize * 0.2));
    const punctuationJoin = /^[,.;:!?%)]/.test(token.text);
    const leftBracketJoin = /[(\["'"]$/.test(prev.text);
    output += (gap > compactGap && !punctuationJoin && !leftBracketJoin) ? ' ' : '';
    output += token.text;
    prev = token;
  });
  return output.trim();
}

function computeMedian(values) {
  if (!Array.isArray(values) || !values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isColumnAwareLineOrderingEnabled() {
  if (typeof window.__LUMEN_FLOW_COLUMN_ORDERING__ === 'boolean') {
    return window.__LUMEN_FLOW_COLUMN_ORDERING__;
  }
  const storedPref = localStorage.getItem('lumen.flow.column-ordering');
  if (storedPref === 'false' || storedPref === 'off') return false;
  if (storedPref === 'true' || storedPref === 'on') return true;
  return FLOW_PARSE_FEATURE_FLAGS.columnAwareLineOrdering !== false;
}

function isFlowArtifactDebugEnabled() {
  if (typeof window.__LUMEN_FLOW_DEBUG_ARTIFACTS__ === 'boolean') {
    return window.__LUMEN_FLOW_DEBUG_ARTIFACTS__;
  }
  const storedPref = localStorage.getItem('lumen.flow.debug-artifacts');
  if (storedPref === 'true' || storedPref === 'on') return true;
  if (storedPref === 'false' || storedPref === 'off') return false;
  return FLOW_PARSE_FEATURE_FLAGS.showRemovedArtifactsInDebug === true;
}

function setFlowArtifactDebugEnabled(enabled) {
  localStorage.setItem('lumen.flow.debug-artifacts', enabled ? 'true' : 'false');
  flowDocCache = null;
  if (readingMode === 'flow' && pdf) {
    renderFlowDocument().catch(err => console.warn('Unable to refresh flow artifact debug view:', err));
  }
}

function normalizeFlowArtifactKey(text) {
  return normalizeFlowSentence(text)
    .toLowerCase()
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isLowSemanticDensityLine(text) {
  const normalized = normalizeFlowArtifactKey(text);
  if (!normalized) return false;
  if (/^(page\s*)?\d+\s*(of|\/)\s*\d+$/i.test(normalized)) return true;
  if (/^page\s+\d+[a-z]?$/.test(normalized)) return true;
  if (/^(confidential|draft|copyright|all rights reserved|do not distribute|for internal use only|privileged and confidential)\b/.test(normalized)) return true;
  if (/^\d{1,3}$/.test(normalized)) return true;
  const words = normalized.split(/\s+/);
  const alphaChars = (normalized.match(/[a-z]/g) || []).length;
  if (words.length <= 5 && alphaChars < 18) return true;
  return false;
}

function shouldPreserveRepeatedHeading(line, neighbors, pageStats) {
  if (!line || !line.text) return false;
  const heading = scoreHeadingCandidate(line, neighbors, pageStats);
  if (heading.kind !== 'h2' && heading.kind !== 'h3') return false;
  const normalized = normalizeFlowArtifactKey(line.text);
  if (/^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/.test(normalized)) return false;
  const hasStrongStyle = (Number(line.relativeFontSize) || 1) >= 1.12 || (Number(line.centerednessScore) || 0) >= 0.58;
  const prev = neighbors?.prev;
  const next = neighbors?.next;
  const contextualSupport = Boolean(
    (prev && !isLowSemanticDensityLine(prev.text)) ||
    (next && !isLowSemanticDensityLine(next.text))
  );
  return hasStrongStyle && contextualSupport;
}

function clusterLinesByRegion(lines, pageWidth) {
  if (!lines.length) return { orderedLines: [], layoutConfidence: 0, usedFallback: true, clusters: [] };

  const sortedByX = [...lines].sort((a, b) => a.xMedian - b.xMedian);
  const xGaps = [];
  for (let i = 1; i < sortedByX.length; i++) xGaps.push(sortedByX[i].xMedian - sortedByX[i - 1].xMedian);

  const medianGap = computeMedian(xGaps);
  const splitThreshold = Math.max(pageWidth * 0.09, medianGap * 2.6);
  const clusters = [];
  let activeCluster = [sortedByX[0]];

  for (let i = 1; i < sortedByX.length; i++) {
    const prev = sortedByX[i - 1];
    const current = sortedByX[i];
    const gap = current.xMedian - prev.xMedian;
    if (gap > splitThreshold) {
      clusters.push(activeCluster);
      activeCluster = [];
    }
    activeCluster.push(current);
  }
  if (activeCluster.length) clusters.push(activeCluster);

  const minClusterSize = Math.max(2, Math.round(lines.length * 0.12));
  const significantClusters = clusters.filter(cluster => cluster.length >= minClusterSize);
  const sortedSignificant = significantClusters
    .map(cluster => ({
      lines: [...cluster].sort((a, b) => a.y - b.y),
      xMedian: computeMedian(cluster.map(line => line.xMedian))
    }))
    .sort((a, b) => a.xMedian - b.xMedian);

  const minGap = xGaps.length ? Math.min(...xGaps) : 0;
  const maxGap = xGaps.length ? Math.max(...xGaps) : 0;
  const clusterCoverage = lines.length ? significantClusters.reduce((sum, cluster) => sum + cluster.length, 0) / lines.length : 0;
  const gapSeparation = pageWidth ? Math.min(1, maxGap / (pageWidth * 0.4)) : 0;
  const gapSignal = splitThreshold ? Math.min(1, maxGap / splitThreshold) : 0;
  let layoutConfidence = sortedSignificant.length > 1
    ? Math.max(0, Math.min(1, (gapSeparation * 0.45) + (gapSignal * 0.35) + (clusterCoverage * 0.2)))
    : 0.15;

  const shouldFallback = sortedSignificant.length <= 1 || clusterCoverage < 0.72 || (pageWidth && minGap / pageWidth < 0.012 && maxGap / pageWidth < 0.08);
  if (shouldFallback) {
    return {
      orderedLines: [...lines].sort((a, b) => a.y - b.y),
      layoutConfidence: Math.min(layoutConfidence, 0.45),
      usedFallback: true,
      clusters: [lines]
    };
  }

  const orderedLines = sortedSignificant.flatMap(cluster => cluster.lines);
  return {
    orderedLines,
    layoutConfidence,
    usedFallback: false,
    clusters: sortedSignificant.map(cluster => cluster.lines)
  };
}

async function extractFlowDocument() {
  if (!pdf) return { pages: [] };
  if (flowDocCache) return flowDocCache;

  const pages = [];
  const artifactLineStats = new Map();
  const pageModels = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const content = await page.getTextContent();
    const lineBuckets = new Map();

    content.items.forEach(item => {
      const text = normalizeToken(item);
      if (!text) return;
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const x = tx[4];
      const y = pageHeight - tx[5];
      const fontSize = Math.max(8, Math.hypot(tx[0], tx[1]));
      const token = { text, x, y, w: item.width || text.length * fontSize * 0.42, fontSize };
      const bucket = Math.round(y / 3) * 3;
      if (!lineBuckets.has(bucket)) lineBuckets.set(bucket, []);
      lineBuckets.get(bucket).push(token);
    });

    const lines = [...lineBuckets.entries()]
      .map(([bucket, tokens]) => {
        tokens.sort((a, b) => a.x - b.x);
        const xValues = tokens.map(token => token.x);
        const fontValues = tokens.map(token => token.fontSize);
        const xMin = xValues.length ? Math.min(...xValues) : 0;
        const xMax = tokens.length ? Math.max(...tokens.map(token => token.x + token.w)) : xMin;
        return {
          y: Number(bucket),
          text: buildLineText(tokens),
          xMedian: computeMedian(xValues),
          xMin,
          xMax,
          fontSizeMedian: computeMedian(fontValues),
          lineWidth: Math.max(0, xMax - xMin)
        };
      })
      .filter(line => line.text);

    const shouldUseColumnAwareLayout = isColumnAwareLineOrderingEnabled();
    const layoutModel = shouldUseColumnAwareLayout
      ? clusterLinesByRegion(lines, viewport.width)
      : {
        orderedLines: [...lines].sort((a, b) => a.y - b.y),
        layoutConfidence: 0,
        usedFallback: true,
        clusters: [lines]
      };
    const orderedLines = layoutModel.orderedLines;
    const pageMedianFontSize = computeMedian(orderedLines.map(line => line.fontSizeMedian).filter(Number.isFinite)) || 12;
    const pageLineGaps = orderedLines
      .slice(1)
      .map((line, idx) => Math.max(0, line.y - orderedLines[idx].y))
      .filter(gap => Number.isFinite(gap) && gap > 0);
    const pageMedianLineGap = computeMedian(pageLineGaps) || 12;
    const pageStats = {
      pageWidth: viewport.width,
      medianFontSize: pageMedianFontSize,
      medianLineGap: pageMedianLineGap,
      lineCount: orderedLines.length
    };
    const enrichedLines = orderedLines.map((line, idx) => {
      const prev = idx > 0 ? orderedLines[idx - 1] : null;
      const next = idx < orderedLines.length - 1 ? orderedLines[idx + 1] : null;
      const precedingGap = prev ? Math.max(0, line.y - prev.y) : pageMedianLineGap;
      const followingGap = next ? Math.max(0, next.y - line.y) : pageMedianLineGap;
      const lineCenterX = (line.xMin + line.xMax) / 2;
      const pageCenterX = viewport.width / 2;
      const centerDistance = Math.abs(lineCenterX - pageCenterX);
      const centerednessScore = Math.max(0, 1 - (centerDistance / Math.max(40, viewport.width / 2)));
      return {
        ...line,
        relativeFontSize: line.fontSizeMedian / Math.max(1, pageMedianFontSize),
        textCasingRatio: getLineTextCasingRatio(line.text),
        precedingWhitespace: Math.max(0, precedingGap - pageMedianLineGap),
        followingWhitespace: Math.max(0, followingGap - pageMedianLineGap),
        centerednessScore
      };
    });

    pageModels.push({
      pageNum: n,
      pageHeight,
      orderedLines,
      enrichedLines,
      pageStats,
      layoutModel,
      shouldUseColumnAwareLayout
    });
  }

  pageModels.forEach(pageModel => {
    const pageSeen = new Set();
    pageModel.enrichedLines.forEach(line => {
      const key = normalizeFlowArtifactKey(line.text);
      if (!key) return;
      if (!artifactLineStats.has(key)) {
        artifactLineStats.set(key, { pages: new Set(), topHits: 0, bottomHits: 0 });
      }
      const stat = artifactLineStats.get(key);
      if (pageSeen.has(key)) return;
      pageSeen.add(key);
      stat.pages.add(pageModel.pageNum);
      const yRatio = pageModel.pageHeight ? (line.y / pageModel.pageHeight) : 0.5;
      if (yRatio <= 0.16) stat.topHits += 1;
      if (yRatio >= 0.84) stat.bottomHits += 1;
    });
  });

  const debugArtifactLines = isFlowArtifactDebugEnabled();
  if (!flowParagraphFixtureValidationDone) {
    flowParagraphFixtureValidationDone = true;
    const fixtureResults = runFlowParagraphFixtureChecks();
    const failed = fixtureResults.filter(result => !result.pass);
    if (failed.length) {
      console.warn('Flow paragraph reconstruction fixtures failed', failed);
    }
    const sentenceFixtureResults = runFlowSentenceSplitFixtureChecks();
    const sentenceFailed = sentenceFixtureResults.filter(result => !result.pass);
    if (sentenceFailed.length) {
      console.warn('Flow sentence split fixtures failed', sentenceFailed);
    }
  }
  pageModels.forEach(pageModel => {
    const artifactAnnotatedLines = pageModel.enrichedLines.map((line, idx) => {
      const key = normalizeFlowArtifactKey(line.text);
      const stat = key ? artifactLineStats.get(key) : null;
      const pageCount = stat?.pages?.size || 0;
      const topShare = pageCount ? stat.topHits / pageCount : 0;
      const bottomShare = pageCount ? stat.bottomHits / pageCount : 0;
      const repeatedAcrossPages = pageCount >= 3 && (pageCount / Math.max(1, pdf.numPages)) >= 0.32;
      const consistentBand = Math.max(topShare, bottomShare) >= 0.78;
      const lowSemanticDensity = isLowSemanticDensityLine(line.text);
      const neighbors = {
        prev: idx > 0 ? pageModel.enrichedLines[idx - 1] : null,
        next: idx < pageModel.enrichedLines.length - 1 ? pageModel.enrichedLines[idx + 1] : null
      };
      const preserveHeading = shouldPreserveRepeatedHeading(line, neighbors, pageModel.pageStats);
      const shouldRemove = repeatedAcrossPages && consistentBand && lowSemanticDensity && !preserveHeading;
      return {
        ...line,
        artifactRemoved: shouldRemove,
        artifactReason: shouldRemove ? 'repeated_top_bottom_boilerplate' : null
      };
    });

    const contentLines = artifactAnnotatedLines.filter(line => !line.artifactRemoved);
    const paragraphs = reconstructFlowParagraphs(contentLines, pageModel.pageStats);
    pages.push({
      pageNum: pageModel.pageNum,
      paragraphs,
      lines: debugArtifactLines ? artifactAnnotatedLines : contentLines,
      pageStats: pageModel.pageStats,
      layoutConfidence: Number(pageModel.layoutModel.layoutConfidence.toFixed(3)),
      lineCount: contentLines.length,
      artifactLineCount: artifactAnnotatedLines.length - contentLines.length,
      clusterCount: pageModel.layoutModel.clusters.length,
      usedLegacyOrdering: !pageModel.shouldUseColumnAwareLayout,
      usedSingleColumnFallback: pageModel.layoutModel.usedFallback
    });
  });

  flowDocCache = { pages };
  return flowDocCache;
}

async function renderFlowDocument() {
  if (!pdf) return;
  stopFlowGestureController('flow_rerender');
  const flowDoc = await extractFlowDocument();
  flowLayer.innerHTML = '';
  flowDoc.pages.forEach(page => {
    const chip = document.createElement('div');
    chip.className = 'flow-page-chip';
    chip.dataset.page = String(page.pageNum);
    chip.textContent = `Page ${page.pageNum}`;
    flowLayer.appendChild(chip);
    renderFlowBlocks(buildFlowBlocks(page.lines?.length ? page.lines : page.paragraphs, page.pageStats || {}), page.pageNum);
  });
  flowChunkIndex = 0;
  updateFlowHighlight();
}

async function applyReadingMode() {
  if (!pdf && !textDoc) return;

  const fontKey = normalizeFontKey(document.getElementById('fontSel').value);
  const usingOverlay = readingMode === 'overlay' && fontKey !== 'native';
  const usingFlow = readingMode === 'flow';
  const fontStack = FONT_STACKS[fontKey] || FONT_STACKS.native;
  const tsize  = Number(document.getElementById('tsizeR').value);
  const lh     = Number(document.getElementById('lhR').value);
  const ls     = Number(document.getElementById('lsR').value);
  const ws     = Number(document.getElementById('wsR').value);
  const overlayColors = {
    day: 'rgba(32, 22, 12, 0.6)',
    sepia: 'rgba(50, 36, 19, 0.6)',
    dark: 'rgba(237, 230, 216, 0.72)',
    night: 'rgba(237, 230, 216, 0.76)',
    'pastel-mint': 'rgba(28, 36, 28, 0.58)',
    'pastel-sky': 'rgba(24, 32, 44, 0.58)',
    'pastel-lavender': 'rgba(36, 28, 44, 0.58)',
    'pastel-peach': 'rgba(44, 28, 20, 0.58)'
  };

  rInner.classList.toggle('flow-mode', usingFlow);
  if (usingFlow) {
    if (!flowLayer.innerHTML.trim()) await renderFlowDocument();
    flowLayer.classList.add('on');
    updateFlowHighlight();
  } else {
    stopFlowGestureController('left_flow_mode');
    flowLayer.classList.remove('on');
    updateFlowHighlight();
  }

  rInner.querySelectorAll('.textLayer').forEach(tl => {
    tl.classList.toggle('disabled', !usingOverlay);
    tl.style.opacity = usingOverlay ? '1' : '';
    tl.style.visibility = usingOverlay ? 'visible' : '';
    tl.style.mixBlendMode = 'normal';

    if (!usingOverlay) {
      tl.style.lineHeight = '';
      tl.style.letterSpacing = '';
      tl.style.wordSpacing = '';
      tl.querySelectorAll('span').forEach(span => {
        const baseFontSize = Number(span.dataset.baseFontSize || 12);
        const baseScaleX = Number(span.dataset.baseScaleX || 1);
        span.style.fontSize = `${baseFontSize}px`;
        span.style.fontFamily = span.dataset.baseFontFamily || 'serif';
        span.style.transform = `scaleX(${baseScaleX})`;
      });
      return;
    }

    tl.style.setProperty('--overlay-text-color', overlayColors[currentMode] || overlayColors.day);
    tl.style.lineHeight = String(lh);
    tl.style.letterSpacing = `${ls}px`;
    tl.style.wordSpacing = `${ws}px`;
    tl.querySelectorAll('span').forEach(span => {
      const baseFontSize = Number(span.dataset.baseFontSize || 12);
      const baseScaleX = Number(span.dataset.baseScaleX || 1);
      span.style.fontSize = `${(baseFontSize * (tsize / 100)).toFixed(2)}px`;
      span.style.fontFamily = fontStack;
      span.style.transform = `scaleX(${baseScaleX})`;
    });
  });

  rInner.querySelectorAll('canvas').forEach(canvas => {
    const hideCanvas = usingOverlay || usingFlow;
    canvas.style.opacity = hideCanvas ? '0' : '1';
    canvas.style.visibility = hideCanvas ? 'hidden' : 'visible';
  });

  flowLayer.style.fontFamily = fontStack;
  flowLayer.style.fontSize = `${(18 * (tsize / 100)).toFixed(2)}px`;
  flowLayer.style.lineHeight = String(lh);
  flowLayer.style.letterSpacing = `${ls}px`;
  flowLayer.style.wordSpacing = `${ws}px`;
  updateProgressAndStatus();
}

function setPageJumpAvailability(enabled) {
  const input = document.getElementById('pageJumpIn');
  const btn = document.getElementById('pageJumpBtn');
  const quickIds = ['pageUpBtn', 'pageDownBtn', 'scrollTopBtn', 'scrollBottomBtn'];
  input.disabled = !enabled;
  btn.disabled = !enabled;
  quickIds.forEach(id => {
    const ctl = document.getElementById(id);
    if (ctl) ctl.disabled = !enabled;
  });
  const total = getTotalPages();
  if (enabled && total > 0) {
    input.max = String(total);
    input.value = '1';
  } else {
    input.value = '';
    input.removeAttribute('max');
  }
}

function goToPage(n) {
  if (!pdf && !textDoc) return;
  const pageNum = Number.parseInt(n, 10);
  if (!Number.isFinite(pageNum)) return;
  const total = getTotalPages();
  const target = Math.min(total, Math.max(1, pageNum));
  if (readingMode === 'flow') {
    const targetChip = getNearestFlowAnchor(target);
    if (targetChip) targetChip.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('pageJumpIn').value = String(Number(targetChip?.dataset.page || target));
    setNavigationMenuOpen(false);
    return;
  }
  const pageWrap = rInner.querySelector(`.page-wrap[data-p="${target}"]`);
  if (!pageWrap) return;
  pageWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('pageJumpIn').value = String(target);
  setNavigationMenuOpen(false);
}

function getNearestFlowAnchor(pageNum) {
  const chips = [...flowLayer.querySelectorAll('.flow-page-chip')];
  if (!chips.length) return null;
  let nearest = chips[0];
  let nearestDelta = Math.abs(Number(nearest.dataset.page || 1) - pageNum);
  chips.forEach(chip => {
    const chipPage = Number(chip.dataset.page || 1);
    const delta = Math.abs(chipPage - pageNum);
    if (delta < nearestDelta) {
      nearest = chip;
      nearestDelta = delta;
    }
  });
  return nearest;
}

function navigatePage(delta) {
  if (!pdf && !textDoc) return;
  const base = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  goToPage(base + delta);
}

function goToDocumentEdge(edge) {
  const total = getTotalPages();
  if (!total) return;
  goToPage(edge === 'bottom' ? total : 1);
}

function flattenOutline(items, depth = 0) {
  if (!Array.isArray(items)) return [];
  return items.flatMap(item => {
    const own = [{ title: item?.title?.trim() || 'Untitled section', dest: item?.dest, depth }];
    const children = flattenOutline(item?.items, depth + 1);
    return own.concat(children);
  });
}

async function resolveOutlinePage(dest) {
  if (!dest || !pdf) return null;
  let targetDest = dest;
  if (typeof targetDest === 'string') targetDest = await pdf.getDestination(targetDest);
  if (!Array.isArray(targetDest) || !targetDest.length) return null;
  const ref = targetDest[0];
  if (typeof ref === 'object' && ref !== null) {
    const index = await pdf.getPageIndex(ref);
    return index + 1;
  }
  if (typeof ref === 'number') return ref + 1;
  return null;
}

function renderOutlineFallback(message) {
  const list = document.getElementById('outlineList');
  const empty = document.getElementById('outlineEmpty');
  list.innerHTML = '';
  list.hidden = true;
  empty.textContent = message;
}

async function loadOutline() {
  if (!pdf) return;
  try {
    const outline = await pdf.getOutline();
    if (!outline?.length) {
      renderOutlineFallback('No outline available in this PDF.');
      return;
    }
    const flatItems = flattenOutline(outline).slice(0, 200);
    const resolved = await Promise.all(flatItems.map(async item => ({
      ...item,
      page: await resolveOutlinePage(item.dest)
    })));
    const usable = resolved.filter(item => Number.isFinite(item.page));
    if (!usable.length) {
      renderOutlineFallback('Outline found, but section destinations are unavailable.');
      return;
    }
    const list = document.getElementById('outlineList');
    const empty = document.getElementById('outlineEmpty');
    list.innerHTML = '';
    usable.forEach(item => {
      const li = document.createElement('li');
      li.className = 'outline-item';
      li.dataset.depth = String(Math.min(item.depth, 3));
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item.title;
      btn.addEventListener('click', () => goToPage(item.page));
      li.appendChild(btn);
      list.appendChild(li);
    });
    list.hidden = false;
    empty.textContent = '';
  } catch (err) {
    console.warn('Unable to read outline:', err);
    renderOutlineFallback('Unable to load outline for this document.');
  }
}
