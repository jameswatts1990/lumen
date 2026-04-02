/* ── Reading ruler ── */
function chunkModeOn() {
  return document.getElementById('chunkT').checked;
}

function flowAutoSplitOn() {
  const toggle = document.getElementById('flowSplitT');
  return Boolean(toggle?.checked);
}

function getFlowSplitLineCount() {
  return Math.max(1, Number(document.getElementById('flowSplitLinesR')?.value) || 1);
}

function parseCssColor(value, alphaFallback = 0.14) {
  const fallback = { r: 200, g: 135, b: 74, a: alphaFallback };
  const raw = (value || '').trim();
  if (!raw) return fallback;
  const rgbaMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map(part => Number.parseFloat(part.trim()));
    if (parts.length >= 3 && parts.every((num, idx) => idx > 2 || Number.isFinite(num))) {
      const [r, g, b, a = alphaFallback] = parts;
      return {
        r: Math.max(0, Math.min(255, r || 0)),
        g: Math.max(0, Math.min(255, g || 0)),
        b: Math.max(0, Math.min(255, b || 0)),
        a: Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : alphaFallback
      };
    }
  }
  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    if (full.length === 6) {
      return {
        r: Number.parseInt(full.slice(0, 2), 16),
        g: Number.parseInt(full.slice(2, 4), 16),
        b: Number.parseInt(full.slice(4, 6), 16),
        a: alphaFallback
      };
    }
  }
  return fallback;
}

function estimatedLineHeightPx() {
  const textSize = Number(document.getElementById('tsizeR').value) / 100;
  const lh = Number(document.getElementById('lhR').value);
  return Math.max(18, 16 * textSize * lh);
}

function getChunkHeightPx() {
  const lines = Number(document.getElementById('chunkR').value) || 2;
  return Math.max(24, Math.round(lines * estimatedLineHeightPx()));
}

function ensureChunkAnchor() {
  if (!chunkCenterY) chunkCenterY = Math.round(window.innerHeight * 0.42);
  const minY = 72;
  const maxY = window.innerHeight - 72;
  chunkCenterY = Math.min(maxY, Math.max(minY, chunkCenterY));
}

function getFlowHighlightables() {
  return [...flowLayer.querySelectorAll('.flow-para, .flow-heading, .flow-list-item')];
}

function getFlowChunkAnchor(list = getFlowHighlightables()) {
  if (!list.length) return null;
  const clampedIndex = Math.max(0, Math.min(flowChunkIndex, list.length - 1));
  const el = list[clampedIndex];
  if (!el) return { index: clampedIndex, text: '' };
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return { index: clampedIndex, text };
}

function restoreFlowChunkAnchor(anchor, chunkSize) {
  const list = getFlowHighlightables();
  if (!list.length) {
    flowChunkIndex = 0;
    return;
  }
  if (!anchor) {
    clampFlowChunkIndex(list, chunkSize);
    return;
  }
  const desiredText = anchor.text || '';
  let restoredIndex = Math.max(0, Math.min(anchor.index || 0, list.length - 1));
  if (desiredText) {
    const exactIndex = list.findIndex(el => ((el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()) === desiredText);
    if (exactIndex >= 0) restoredIndex = exactIndex;
  }
  flowChunkIndex = restoredIndex;
  clampFlowChunkIndex(list, chunkSize);
}

async function refreshFlowRenderForChunking() {
  if (readingMode !== 'flow') return;
  const chunkSize = Math.max(1, Number(document.getElementById('chunkR').value) || 1);
  const anchor = getFlowChunkAnchor();
  if (pdf) {
    await renderFlowDocument();
    restoreFlowChunkAnchor(anchor, chunkSize);
    updateFlowHighlight();
    scrollFlowChunkIntoView(getFlowHighlightables(), chunkSize);
    return;
  }
  if (textDoc?.plainText) {
    const refreshed = renderTextFlowFromPlainText(textDoc.plainText, textDoc.sourceLabel || `File · ${textDoc.title || 'Text source'}`);
    textDoc = { ...textDoc, ...refreshed };
    restoreFlowChunkAnchor(anchor, chunkSize);
    updateFlowHighlight();
    scrollFlowChunkIntoView(getFlowHighlightables(), chunkSize);
  }
}

async function toggleFlowAutoSplit() {
  syncReadingModeControls();
  await refreshFlowRenderForChunking();
  saveProfilesState();
}

function ensureFlowHighlightTargets() {
  getFlowHighlightables().forEach(el => el.classList.add('flow-highlightable'));
}

function getFlowElementLineMetrics(el) {
  const cs = getComputedStyle(el);
  const rawLineHeight = parseFloat(cs.lineHeight);
  const lineHeight = Number.isFinite(rawLineHeight) ? rawLineHeight : estimatedLineHeightPx();
  const rect = el.getBoundingClientRect();
  const lines = Math.max(1, Math.round(rect.height / Math.max(1, lineHeight)));
  return {
    lines,
    lineHeightPx: Math.max(1, lineHeight)
  };
}

function stepFlowChunkIndexByItems(list, direction, stepItems) {
  if (!list.length) {
    flowChunkIndex = 0;
    return;
  }
  const step = Math.max(1, stepItems);
  if (direction > 0) {
    flowChunkIndex = Math.min(list.length - 1, flowChunkIndex + step);
    return;
  }
  if (direction < 0) {
    flowChunkIndex = Math.max(0, flowChunkIndex - step);
  }
}

function clampFlowChunkIndex(list, chunkSize) {
  if (!list.length) {
    flowChunkIndex = 0;
    return;
  }
  const maxStart = Math.max(0, list.length - 1);
  flowChunkIndex = Math.max(0, Math.min(flowChunkIndex, maxStart));
}

function scrollFlowChunkIntoView(list, chunkSize) {
  if (!list.length) return;
  const first = list[flowChunkIndex];
  const last = list[Math.min(list.length - 1, flowChunkIndex + chunkSize - 1)];
  if (!first || !last) return;
  const readerRect = reader.getBoundingClientRect();
  const firstRect = first.getBoundingClientRect();
  const lastRect = last.getBoundingClientRect();
  const chunkCenter = ((firstRect.top + lastRect.bottom) / 2) - readerRect.top;
  const viewCenter = reader.clientHeight / 2;
  const delta = chunkCenter - viewCenter;
  if (Math.abs(delta) < 18) return;
  reader.scrollBy({ top: delta, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function updateFlowHighlight() {
  if (readingMode !== 'flow') {
    flowLayer.classList.remove('flow-shaded');
    getFlowHighlightables().forEach(el => {
      el.classList.remove('flow-highlight-active', 'flow-highlight-partial');
      el.style.removeProperty('--flow-active-max-height');
    });
    return;
  }
  ensureFlowHighlightTargets();
  const list = getFlowHighlightables();
  const chunkSize = Math.max(1, Number(document.getElementById('chunkR').value) || 1);
  const rulerOn = document.getElementById('rulerT').checked;
  const shadingOn = document.getElementById('shadeT').checked;
  if (!chunkModeOn() && (rulerOn || shadingOn) && list.length) {
    flowChunkIndex = Math.max(0, Math.min(flowPointerIndex, list.length - 1));
  }
  clampFlowChunkIndex(list, chunkSize);
  if (chunkModeOn()) {
    list.forEach((el, idx) => {
      el.classList.remove('flow-highlight-active', 'flow-highlight-partial');
      el.style.removeProperty('--flow-active-max-height');
      if (idx >= flowChunkIndex && idx < (flowChunkIndex + chunkSize)) {
        el.classList.add('flow-highlight-active');
      }
    });
    const showShadingChunk = document.getElementById('shadeT').checked;
    flowLayer.classList.toggle('flow-shaded', showShadingChunk);
    return;
  }
  list.forEach((el, idx) => {
    el.classList.remove('flow-highlight-active', 'flow-highlight-partial');
    el.style.removeProperty('--flow-active-max-height');
    if (!(rulerOn || shadingOn) || idx !== flowChunkIndex) return;
    el.classList.add('flow-highlight-active');
  });
  flowLayer.classList.toggle('flow-shaded', shadingOn);
}

function updateChunkOverlay() {
  const shadeTop = document.getElementById('rShadeTop');
  const shadeBot = document.getElementById('rShadeBot');
  if (!chunkModeOn()) return;
  ensureChunkAnchor();
  const chunkHeight = getChunkHeightPx();
  const half = Math.round(chunkHeight / 2);
  const y = chunkCenterY;
  const rootStyles = getComputedStyle(document.documentElement);
  const accentDim = parseCssColor(rootStyles.getPropertyValue('--accent-dim'), 0.12);
  const strongerAccentDim = `rgba(${accentDim.r},${accentDim.g},${accentDim.b},${Math.min(0.42, Math.max(0.28, accentDim.a * 2.35)).toFixed(2)})`;
  const useParagraphShadeStyle = readingMode === 'original';

  shadeTop.style.height = `${Math.max(0, y - half)}px`;
  shadeBot.style.height = `${Math.max(0, window.innerHeight - y - half)}px`;
  if (useParagraphShadeStyle) {
    shadeTop.style.background = 'rgba(0,0,0,0.70)';
    shadeBot.style.background = 'rgba(0,0,0,0.70)';
    return;
  }
  shadeTop.style.background = `linear-gradient(to bottom, rgba(8,6,4,0.88), ${strongerAccentDim})`;
  shadeBot.style.background = `linear-gradient(to top, rgba(8,6,4,0.88), ${strongerAccentDim})`;
}

function resetChunkPosition(atTop = true) {
  const chunkHeight = getChunkHeightPx();
  const margin = Math.max(72, Math.round(window.innerHeight * 0.12));
  if (atTop) {
    chunkCenterY = margin + Math.round(chunkHeight / 2);
  } else {
    chunkCenterY = window.innerHeight - margin - Math.round(chunkHeight / 2);
  }
  ensureChunkAnchor();
}

function stepChunkPage(direction) {
  const total = getTotalPages();
  if (!total || readingMode === 'flow') return false;
  const nextPage = currentPage + direction;
  if (nextPage < 1 || nextPage > total) return false;
  goToPage(nextPage);
  resetChunkPosition(direction > 0);
  updateChunkOverlay();
  return true;
}

function stepChunk(direction) {
  if (!chunkModeOn()) return;
  if (readingMode === 'flow') {
    const list = getFlowHighlightables();
    const stepSize = Math.max(1, Number(document.getElementById('chunkR').value) || 1);
    stepFlowChunkIndexByItems(list, direction, stepSize);
    clampFlowChunkIndex(list, stepSize);
    updateFlowHighlight();
    scrollFlowChunkIntoView(list, stepSize);
    rememberChunkSnapshot();
    return;
  }
  ensureChunkAnchor();
  const chunkHeight = getChunkHeightPx();
  const half = Math.round(chunkHeight / 2);
  const nextCenter = chunkCenterY + (direction * chunkHeight);
  const nextTop = nextCenter - half;
  const nextBottom = nextCenter + half;
  if (direction > 0 && nextBottom > window.innerHeight - 24) {
    if (stepChunkPage(1)) return;
  } else if (direction < 0 && nextTop < 24) {
    if (stepChunkPage(-1)) return;
  }
  chunkCenterY = nextCenter;
  ensureChunkAnchor();
  updateChunkOverlay();
  rememberChunkSnapshot();
}

function toggleChunkMode() {
  ensureChunkAnchor();
  const on = chunkModeOn();
  const rulerToggle = document.getElementById('rulerT');
  const shadeToggle = document.getElementById('shadeT');
  if (on) {
    if (rulerToggle?.checked) rulerToggle.checked = false;
    if (shadeToggle?.checked) shadeToggle.checked = false;
  }
  const shadeTop = document.getElementById('rShadeTop');
  const shadeBot = document.getElementById('rShadeBot');
  document.querySelectorAll('.chunk-group').forEach(el => el.classList.toggle('collapsed', !on));
  document.getElementById('chunkStatus').classList.toggle('on', on);
  if (on && readingMode !== 'flow') resetChunkPosition(true);
  if (readingMode === 'flow' && on) {
    refreshFlowRenderForChunking();
    const list = getFlowHighlightables();
    const chunkSize = Math.max(1, Number(document.getElementById('chunkR').value) || 1);
    if (list.length) {
      const visibleIndex = list.findIndex(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 80 && rect.bottom <= (window.innerHeight - 80);
      });
      if (visibleIndex >= 0) flowChunkIndex = visibleIndex;
      clampFlowChunkIndex(list, chunkSize);
      scrollFlowChunkIntoView(list, chunkSize);
    }
  } else if (readingMode === 'flow' && !flowAutoSplitOn()) {
    refreshFlowRenderForChunking();
  }
  syncChunkFocusAidExclusivity();
  if (on && readingMode !== 'flow') {
    document.getElementById('rulerLine').classList.remove('on');
    shadeTop.classList.add('on');
    shadeBot.classList.add('on');
  }
  toggleRuler();
  updateChunkOverlay();
  updateFlowHighlight();
  if (on) rememberChunkSnapshot({ promotePrevious: false });
  updateChunkRecoverButton();
}

reader.addEventListener('mousemove', e => {
  if (chunkModeOn()) return;
  const rl = document.getElementById('rulerLine');
  rl.style.top = e.clientY + 'px';
  const sh = 80;
  document.getElementById('rShadeTop').style.height = Math.max(0, e.clientY - sh) + 'px';
  document.getElementById('rShadeBot').style.height = Math.max(0, window.innerHeight - e.clientY - sh) + 'px';

  if (readingMode !== 'flow') return;
  const list = getFlowHighlightables();
  if (!list.length) return;
  let nearestIdx = 0;
  let nearestDelta = Number.POSITIVE_INFINITY;
  list.forEach((el, idx) => {
    const rect = el.getBoundingClientRect();
    const mid = rect.top + (rect.height / 2);
    const delta = Math.abs(mid - e.clientY);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIdx = idx;
    }
  });
  if (nearestIdx !== flowPointerIndex) {
    flowPointerIndex = nearestIdx;
    updateFlowHighlight();
  }
});

function toggleRuler() {
  const on  = document.getElementById('rulerT').checked;
  const shd = document.getElementById('shadeT').checked;
  const chunkOn = chunkModeOn();
  if (chunkOn && (on || shd)) {
    const chunkToggle = document.getElementById('chunkT');
    chunkToggle.checked = false;
    toggleChunkMode();
    return;
  }
  const paragraphShadeTop = document.getElementById('rShadeTop');
  const paragraphShadeBot = document.getElementById('rShadeBot');
  const rulerLine = document.getElementById('rulerLine');
  const showChunkBandShading = chunkOn && readingMode !== 'flow';
  rulerLine.classList.toggle('on', on && !chunkModeOn());
  paragraphShadeTop.classList.toggle('on', shd || showChunkBandShading);
  paragraphShadeBot.classList.toggle('on', shd || showChunkBandShading);
  if (!chunkModeOn() || readingMode === 'flow') {
    paragraphShadeTop.style.background = 'rgba(0,0,0,0.70)';
    paragraphShadeBot.style.background = 'rgba(0,0,0,0.70)';
  }
  if (showChunkBandShading) updateChunkOverlay();
  updateFlowHighlight();
}
