function onFlowGestureEvent(eventName, listener) {
  if (!flowGestureEventListeners.has(eventName)) flowGestureEventListeners.set(eventName, new Set());
  const bucket = flowGestureEventListeners.get(eventName);
  bucket.add(listener);
  return () => bucket.delete(listener);
}

function emitFlowGestureEvent(eventName, payload = {}) {
  const listeners = flowGestureEventListeners.get(eventName);
  if (!listeners || !listeners.size) return;
  listeners.forEach(listener => {
    try {
      listener(payload);
    } catch (err) {
      console.error('Flow gesture event listener failed', err);
    }
  });
}

function announceFlowGesture(message = '') {
  if (!flowGestureAnnouncer || !message) return;
  flowGestureAnnouncer.textContent = '';
  requestAnimationFrame(() => {
    flowGestureAnnouncer.textContent = message;
  });
}

function setFlowGestureState(nextState, reason = '') {
  if (flowGestureState === nextState) return;
  const previousState = flowGestureState;
  flowGestureState = nextState;
  emitFlowGestureEvent('state_change', {
    previousState,
    nextState,
    reason,
    timestamp: performance.now()
  });
  if (nextState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE) {
    announceFlowGesture('Speed-read mode started. Release press to pause.');
  } else if (nextState === FLOW_GESTURE_STATES.PAUSED_ON_RELEASE) {
    announceFlowGesture('Speed-read paused.');
  }
  const speedReadVisualOn = (
    nextState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE ||
    nextState === FLOW_GESTURE_STATES.PAUSED_ON_RELEASE
  );
  const holdIntentActive = (
    nextState === FLOW_GESTURE_STATES.PRESSING ||
    nextState === FLOW_GESTURE_STATES.TIMER_VISIBLE ||
    nextState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE
  );
  document.body.classList.toggle('flow-speed-read-mode', speedReadVisualOn);
  document.body.classList.toggle('flow-gesture-hold-mode', holdIntentActive);
}

function clearFlowGestureThresholdTimers() {
  if (flowGestureTimerTimeoutId) clearTimeout(flowGestureTimerTimeoutId);
  if (flowGestureActivateTimeoutId) clearTimeout(flowGestureActivateTimeoutId);
  flowGestureTimerTimeoutId = null;
  flowGestureActivateTimeoutId = null;
}

function updateFlowGestureTimerUI(elapsedMs = 0) {
  const clampedElapsed = Math.max(0, elapsedMs);
  const remaining = Math.max(0, FLOW_GESTURE_ACTIVATE_MS - clampedElapsed);
  flowGestureTimerValue.textContent = `${(remaining / 1000).toFixed(1)}s`;
}

function formatFlowSpeedReadPreviewText(index) {
  if (!Number.isInteger(index) || index < 0 || index >= flowSpeedReadTokens.length) return '';
  const parts = [];
  for (let i = index; i < Math.min(flowSpeedReadTokens.length, index + 4); i += 1) {
    const token = flowSpeedReadTokens[i];
    if (!token?.raw) continue;
    parts.push(token.raw);
  }
  return parts.join(' ').trim();
}

function resolveTopOfVisiblePageStart() {
  const visibleBlocks = [...flowLayer.querySelectorAll('.flow-para, .flow-heading, .flow-list-item')];
  const readerRect = reader.getBoundingClientRect();
  const firstVisibleBlock = visibleBlocks.find(block => {
    const rect = block.getBoundingClientRect();
    return rect.bottom >= readerRect.top + 18 && rect.top <= readerRect.bottom - 18;
  });
  const fallbackBlock = firstVisibleBlock || visibleBlocks[0];
  const pageNum = Number(fallbackBlock?.dataset.page || 1) || 1;
  const firstWordOnPage = flowLayer.querySelector(`.flow-para[data-page="${pageNum}"] .flow-speed-word, .flow-heading[data-page="${pageNum}"] .flow-speed-word, .flow-list-item[data-page="${pageNum}"] .flow-speed-word`);
  const fallbackWord = fallbackBlock?.querySelector('.flow-speed-word') || flowLayer.querySelector('.flow-speed-word');
  return {
    pageNum,
    wordNode: firstWordOnPage || fallbackWord || null
  };
}

function resolveFlowSpeedReadStartContext() {
  ensureFlowSpeedReadWordNodes();
  const selectedWord = (
    (flowHoveredWordNode && flowLayer.contains(flowHoveredWordNode) ? flowHoveredWordNode : null) ||
    flowLayer.querySelector('.flow-word-selected')
  );
  const selectedIndex = getFlowWordStartIndex(selectedWord);
  if (selectedIndex >= 0) {
    const preview = formatFlowSpeedReadPreviewText(selectedIndex);
    return {
      index: selectedIndex,
      label: preview ? `Hold to speed read from '${preview}…'` : 'Hold to speed read from selected word'
    };
  }
  const highlightedWord = flowLayer.querySelector('.flow-highlight-active .flow-speed-word, .flow-highlight-partial .flow-speed-word');
  const highlightedIndex = getFlowWordStartIndex(highlightedWord);
  if (highlightedIndex >= 0) {
    const preview = formatFlowSpeedReadPreviewText(highlightedIndex);
    return {
      index: highlightedIndex,
      label: preview ? `Hold to speed read from '${preview}…'` : 'Hold to speed read from highlighted section'
    };
  }
  const topOfPage = resolveTopOfVisiblePageStart();
  const fallbackIndex = getFlowWordStartIndex(topOfPage.wordNode);
  return {
    index: fallbackIndex >= 0 ? fallbackIndex : flowSpeedReadWordIndex,
    label: `Hold to speed read from the top of page ${topOfPage.pageNum}`
  };
}

function showFlowGestureTimer() {
  if (flowGestureTimerLabel && flowGestureStartContextLabel) {
    flowGestureTimerLabel.textContent = flowGestureStartContextLabel;
  }
  flowGestureTimer.classList.add('on');
  flowGestureTimer.setAttribute('aria-hidden', 'false');
}

function hideFlowGestureTimer() {
  flowGestureTimer.classList.remove('on');
  flowGestureTimer.setAttribute('aria-hidden', 'true');
}

function startFlowGestureTimerUI() {
  if (flowGestureTimerUiRAF) cancelAnimationFrame(flowGestureTimerUiRAF);
  const tick = () => {
    if (flowGestureState !== FLOW_GESTURE_STATES.TIMER_VISIBLE || !flowGesturePressStartTs) return;
    const elapsed = performance.now() - flowGesturePressStartTs;
    updateFlowGestureTimerUI(elapsed);
    flowGestureTimerUiRAF = requestAnimationFrame(tick);
  };
  flowGestureTimerUiRAF = requestAnimationFrame(tick);
}

function stopFlowGestureTimerUI() {
  if (flowGestureTimerUiRAF) cancelAnimationFrame(flowGestureTimerUiRAF);
  flowGestureTimerUiRAF = null;
}

function clearFlowSpeedReadHighlight() {
  if (flowSpeedReadActiveWord) {
    flowSpeedReadActiveWord.classList.remove('active');
    flowSpeedReadActiveWord = null;
  }
  hideFlowWordRenderer();
}

function hideFlowWordRenderer() {
  if (!flowWordRenderer) return;
  flowWordRenderer.classList.remove('on');
  flowWordRendererToken.textContent = '';
}

function getAutoScrollWpmBounds() {
  const slider = document.getElementById('scrollSR');
  const minSpeed = Math.abs(Number(slider?.min));
  const maxSpeed = Math.abs(Number(slider?.max));
  const maxMagnitude = Math.max(minSpeed, maxSpeed, Math.abs(DEFAULT_SETTINGS.autoScrollSpeed));
  const derivedMax = Math.max(40, Math.round(maxMagnitude * FLOW_BASE_WPM));
  return {
    min: 40,
    max: Math.min(FLOW_SPEED_READ_MAX_WPM, derivedMax)
  };
}

function uiAutoScrollSpeedToEffective(uiSpeed) {
  return uiSpeed * AUTO_SCROLL_UI_TO_EFFECTIVE_MULTIPLIER;
}

function effectiveAutoScrollSpeedToUi(effectiveSpeed) {
  if (!AUTO_SCROLL_UI_TO_EFFECTIVE_MULTIPLIER) return effectiveSpeed;
  return effectiveSpeed / AUTO_SCROLL_UI_TO_EFFECTIVE_MULTIPLIER;
}

function describeWpmEquivalency(wpm) {
  if (wpm <= 130) return 'Equivalent: deliberate study pace for dense text.';
  if (wpm <= 220) return 'Equivalent: average adult reading speed.';
  if (wpm <= 320) return 'Equivalent: strong non-fiction pace.';
  if (wpm <= 450) return 'Equivalent: fast skim-reading pace.';
  if (wpm <= 650) return 'Equivalent: very fast RSVP training pace.';
  return 'Equivalent: elite speed-reading drill pace.';
}

function getAutoScrollWpmValue() {
  const slider = document.getElementById('scrollSR');
  const parsed = Number(slider?.value);
  const uiSpeedMagnitude = Number.isFinite(parsed) ? Math.abs(parsed) : Math.abs(DEFAULT_SETTINGS.autoScrollSpeed);
  const speedMagnitude = Math.abs(uiAutoScrollSpeedToEffective(uiSpeedMagnitude));
  const estimatedWpm = Math.round(speedMagnitude * FLOW_BASE_WPM) || FLOW_SPEED_READ_FALLBACK_WPM;
  const { min, max } = getAutoScrollWpmBounds();
  return Math.min(max, Math.max(min, estimatedWpm));
}

function syncAutoScrollWpmUi() {
  const wpm = getAutoScrollWpmValue();
  const wpmVal = document.getElementById('scrollWpmV');
  if (wpmVal) wpmVal.textContent = `${wpm} wpm`;
  const wpmEq = document.getElementById('scrollWpmEq');
  if (wpmEq) wpmEq.textContent = describeWpmEquivalency(wpm);
  if (scrollWpmInput && document.activeElement !== scrollWpmInput) {
    scrollWpmInput.value = String(wpm);
  }
}

function setAutoScrollWpm(nextWpm) {
  const slider = document.getElementById('scrollSR');
  if (!slider) return;
  const currentSpeed = Number(slider.value);
  const direction = currentSpeed < 0 ? -1 : 1;
  const { min, max } = getAutoScrollWpmBounds();
  const safeWpm = Math.min(max, Math.max(min, Math.round(nextWpm)));
  const nextSpeedMagnitude = safeWpm / FLOW_BASE_WPM;
  const sliderMin = Number(slider.min);
  const sliderMax = Number(slider.max);
  const signedSpeed = direction * effectiveAutoScrollSpeedToUi(nextSpeedMagnitude);
  const clampedSpeed = Math.min(sliderMax, Math.max(sliderMin, signedSpeed));
  slider.value = String(Math.round(clampedSpeed * 10) / 10);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  slider.dispatchEvent(new Event('change', { bubbles: true }));
  syncAutoScrollWpmUi();
}

function applyFlowSpeedReadTiming() {
  flowSpeedReadPlaybackWpm = getAutoScrollWpmValue();
  flowSpeedReadIntervalMs = 60000 / flowSpeedReadPlaybackWpm;
}

function isSentencePauseBoostEnabled() {
  return Boolean(document.getElementById('flowSentencePauseT')?.checked);
}

function getFlowTokenDelayMs(index = flowSpeedReadWordIndex) {
  const token = flowSpeedReadTokens[index];
  if (!token) return flowSpeedReadIntervalMs;
  if (!isSentencePauseBoostEnabled()) return flowSpeedReadIntervalMs;
  if (FLOW_SENTENCE_END_PUNCTUATION.test(token.trailing || '')) {
    return flowSpeedReadIntervalMs * FLOW_SENTENCE_PAUSE_MULTIPLIER;
  }
  return flowSpeedReadIntervalMs;
}

function queueFlowSpeedReadTimingSync() {
  if (flowSpeedReadIntervalUpdateTimer) clearTimeout(flowSpeedReadIntervalUpdateTimer);
  flowSpeedReadIntervalUpdateTimer = setTimeout(() => {
    flowSpeedReadIntervalUpdateTimer = null;
    applyFlowSpeedReadTiming();
    if (flowGestureState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE) {
      flowSpeedReadNextWordAt = performance.now() + getFlowTokenDelayMs(flowSpeedReadWordIndex);
    }
    if (flowSpeedHud.classList.contains('on') || flowSpeedHud.classList.contains('paused')) {
      flowHudWpm.textContent = String(flowSpeedReadPlaybackWpm);
    }
    syncAutoScrollWpmUi();
  }, FLOW_SPEED_READ_INTERVAL_DEBOUNCE_MS);
}

function splitFlowToken(rawToken = '') {
  const text = String(rawToken || '');
  const match = text.match(/^([(\[{'"""''`]+)?([\s\S]*?)([)\]}'"""''`.,!?;:…%]+)?$/);
  const leading = match?.[1] || '';
  const core = match?.[2] || '';
  const trailing = match?.[3] || '';
  if (!core) {
    return { leading: '', core: text, trailing: '' };
  }
  return { leading, core, trailing };
}

function computeFlowOrpIndex(coreToken = '') {
  const token = String(coreToken || '');
  const len = token.length;
  if (len <= 2) return 0;
  if (/[0-9]/.test(token)) return Math.max(0, Math.min(len - 1, Math.floor((len - 1) / 2)));
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

function normalizeFlowToken(rawToken = '') {
  const trimmed = String(rawToken || '').trim();
  if (!trimmed) return null;
  const { leading, core, trailing } = splitFlowToken(trimmed);
  const orpIndex = computeFlowOrpIndex(core);
  return {
    raw: trimmed,
    leading,
    core,
    trailing,
    orpIndex,
    prefix: core ? core.slice(0, orpIndex) : '',
    orpChar: core ? core.charAt(orpIndex) : '',
    suffix: core ? core.slice(orpIndex + 1) : ''
  };
}

function escapeFlowWordHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function applyFlowWordMarkup(target, token) {
  if (!target || !token) return;
  const fragments = [];
  if (token.leading) fragments.push(`<span class="flow-speed-word-punc">${escapeFlowWordHtml(token.leading)}</span>`);
  if (token.prefix) fragments.push(`<span class="flow-speed-word-prefix">${escapeFlowWordHtml(token.prefix)}</span>`);
  if (token.orpChar) fragments.push(`<span class="flow-speed-word-orp">${escapeFlowWordHtml(token.orpChar)}</span>`);
  if (token.suffix) fragments.push(`<span class="flow-speed-word-suffix">${escapeFlowWordHtml(token.suffix)}</span>`);
  if (token.trailing) fragments.push(`<span class="flow-speed-word-punc">${escapeFlowWordHtml(token.trailing)}</span>`);
  if (!fragments.length) fragments.push(`<span class="flow-speed-word-punc">${escapeFlowWordHtml(token.raw)}</span>`);
  target.innerHTML = fragments.join('');
}

function getFlowWordFontShorthand() {
  const source = flowLayer || document.body;
  const style = getComputedStyle(source);
  const fontStyle = style.fontStyle || 'normal';
  const fontVariant = style.fontVariant || 'normal';
  const fontWeight = style.fontWeight || '400';
  const fontSize = style.fontSize || '26px';
  const lineHeight = style.lineHeight && style.lineHeight !== 'normal' ? style.lineHeight : '1.4';
  const fontFamily = style.fontFamily || 'serif';
  return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily}`;
}

function measureFlowTextWidth(text, font) {
  if (!text) return 0;
  if (!measureFlowTextWidth.canvas) measureFlowTextWidth.canvas = document.createElement('canvas');
  const ctx = measureFlowTextWidth.canvas.getContext('2d');
  if (!ctx) return text.length * 8;
  ctx.font = font;
  return ctx.measureText(text).width;
}

function syncFlowWordRendererPlacement() {
  if (!flowWordRenderer || !reader) return;
  const readerRect = reader.getBoundingClientRect();
  flowWordRenderer.style.left = `${Math.round(readerRect.left + (readerRect.width / 2))}px`;
  flowWordRenderer.style.top = `${Math.round(readerRect.top + (readerRect.height / 2))}px`;
  const maxWidth = Math.max(220, Math.round(readerRect.width - 26));
  flowWordRenderer.style.width = `min(680px, ${maxWidth}px)`;
}

function syncFlowWordRenderer() {
  const token = flowSpeedReadTokens[flowSpeedReadWordIndex];
  if (!token || !flowWordRendererToken) {
    flowWordRenderer?.classList.remove('on');
    return;
  }
  applyFlowWordMarkup(flowWordRendererToken, token);
  let offsetPx = 0;
  const orpNode = flowWordRendererToken.querySelector('.flow-speed-word-orp');
  if (orpNode) {
    const tokenRect = flowWordRendererToken.getBoundingClientRect();
    const orpRect = orpNode.getBoundingClientRect();
    offsetPx = Math.max(0, Math.round(((orpRect.left - tokenRect.left) + (orpRect.width / 2)) * 100) / 100);
  } else {
    const leftSegment = `${token.leading || ''}${token.prefix || ''}`;
    const font = getFlowWordFontShorthand();
    offsetPx = Math.max(0, Math.round(measureFlowTextWidth(leftSegment, font) * 100) / 100);
  }
  flowWordRendererToken.style.setProperty('--flow-orp-offset', `${offsetPx}px`);
  flowWordRenderer.classList.add('on');
}

function syncFlowSpeedReadHighlight() {
  clearFlowSpeedReadHighlight();
  const target = flowSpeedReadWordNodes[flowSpeedReadWordIndex];
  if (!target) return;
  target.classList.add('active');
  flowSpeedReadActiveWord = target;
  syncFlowWordRenderer();
  target.scrollIntoView({ block: 'center', inline: 'nearest' });
}

function clearFlowWordSelection() {
  if (flowHoveredWordNode) {
    flowHoveredWordNode.classList.remove('flow-word-selected');
    flowHoveredWordNode = null;
  }
}

function hideFlowDefinitionPopout() {
  if (!flowDefinitionPopout) return;
  if (flowDefinitionLookupController) flowDefinitionLookupController.abort();
  flowDefinitionPopout.classList.remove('on');
  flowDefinitionPopout.setAttribute('aria-hidden', 'true');
}

function dismissFlowDefinitionPreview() {
  if (flowDefinitionDelayTimer) {
    clearTimeout(flowDefinitionDelayTimer);
    flowDefinitionDelayTimer = null;
  }
  hideFlowDefinitionPopout();
  clearFlowWordSelection();
}

function normalizeDefinitionLookupWord(rawValue = '') {
  return String(rawValue || '')
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .toLowerCase();
}

function getFlowWordStartIndex(node) {
  if (!node) return -1;
  return flowSpeedReadWordNodes.indexOf(node);
}

function setFlowWordSelection(node) {
  if (!node || node === flowHoveredWordNode) return;
  clearFlowWordSelection();
  flowHoveredWordNode = node;
  flowHoveredWordNode.classList.add('flow-word-selected');
}

function placeFlowDefinitionPopout(targetNode) {
  if (!flowDefinitionPopout || !targetNode || !reader) return;
  const readerRect = reader.getBoundingClientRect();
  const wordRect = targetNode.getBoundingClientRect();
  const popoutRect = flowDefinitionPopout.getBoundingClientRect();
  const top = Math.max(readerRect.top + 8, wordRect.bottom + 8);
  const maxLeft = readerRect.right - popoutRect.width - 8;
  const left = Math.max(readerRect.left + 8, Math.min(wordRect.left, maxLeft));
  flowDefinitionPopout.style.top = `${Math.round(top)}px`;
  flowDefinitionPopout.style.left = `${Math.round(left)}px`;
}

async function lookupWordDefinition(word) {
  if (!word) return 'Definition unavailable.';
  if (flowDefinitionCache.has(word)) return flowDefinitionCache.get(word);
  if (flowDefinitionLookupController) flowDefinitionLookupController.abort();
  flowDefinitionLookupController = new AbortController();
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: flowDefinitionLookupController.signal
    });
    if (!response.ok) throw new Error('Lookup failed');
    const payload = await response.json();
    const firstMeaning = payload?.[0]?.meanings?.[0];
    const firstDefinition = firstMeaning?.definitions?.[0]?.definition;
    const result = firstDefinition || 'Definition unavailable.';
    flowDefinitionCache.set(word, result);
    return result;
  } catch (_) {
    return 'Definition unavailable.';
  }
}

function scheduleFlowDefinition(node) {
  if (!node || !flowDefinitionTerm || !flowDefinitionText) return;
  if (flowDefinitionDelayTimer) clearTimeout(flowDefinitionDelayTimer);
  hideFlowDefinitionPopout();
  const lookupWord = normalizeDefinitionLookupWord(node.dataset.speedReadRaw || node.textContent || '');
  if (!lookupWord) return;
  flowDefinitionDelayTimer = setTimeout(async () => {
    if (node !== flowHoveredWordNode) return;
    flowDefinitionTerm.textContent = lookupWord;
    flowDefinitionText.textContent = 'Looking up definition…';
    placeFlowDefinitionPopout(node);
    flowDefinitionPopout.classList.add('on');
    flowDefinitionPopout.setAttribute('aria-hidden', 'false');
    const definition = await lookupWordDefinition(lookupWord);
    if (node !== flowHoveredWordNode) return;
    flowDefinitionText.textContent = definition;
    placeFlowDefinitionPopout(node);
  }, 300);
}

function buildFlowSpeedReadWordNodes() {
  flowSpeedReadWordNodes = [];
  flowSpeedReadTokens = [];
  const blocks = flowLayer.querySelectorAll('.flow-para, .flow-heading, .flow-list-item');
  blocks.forEach(block => {
    if (block.dataset.speedReadPrepared === '1') {
      block.querySelectorAll('.flow-speed-word').forEach(word => {
        const token = normalizeFlowToken(word.dataset.speedReadRaw || word.textContent || '');
        if (!token) return;
        word.dataset.speedReadRaw = token.raw;
        applyFlowWordMarkup(word, token);
        flowSpeedReadWordNodes.push(word);
        flowSpeedReadTokens.push(token);
      });
      return;
    }
    const text = block.textContent || '';
    block.textContent = '';
    const frag = document.createDocumentFragment();
    const parts = text.split(/(\s+)/);
    parts.forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        return;
      }
      const word = document.createElement('span');
      word.className = 'flow-speed-word';
      const token = normalizeFlowToken(part);
      if (!token) {
        word.textContent = part;
      } else {
        word.dataset.speedReadRaw = token.raw;
        applyFlowWordMarkup(word, token);
        flowSpeedReadTokens.push(token);
      }
      flowSpeedReadWordNodes.push(word);
      frag.appendChild(word);
    });
    block.appendChild(frag);
    block.dataset.speedReadPrepared = '1';
  });
}

function ensureFlowSpeedReadWordNodes() {
  if (flowSpeedReadWordNodes.length && flowLayer.querySelector('.flow-speed-word')) return;
  buildFlowSpeedReadWordNodes();
}

function removeFlowSpeedReadWordMarkup() {
  if (!flowLayer) return;
  const blocks = flowLayer.querySelectorAll('.flow-para, .flow-heading, .flow-list-item');
  blocks.forEach(block => {
    if (block.dataset.speedReadPrepared !== '1' && !block.querySelector('.flow-speed-word')) return;
    block.querySelectorAll('.flow-speed-word').forEach(word => {
      const rawValue = String(word.dataset.speedReadRaw || word.textContent || '');
      word.replaceWith(document.createTextNode(rawValue));
    });
    delete block.dataset.speedReadPrepared;
  });
}

function stopFlowSpeedReadPlayback() {
  if (flowSpeedReadRAF) cancelAnimationFrame(flowSpeedReadRAF);
  if (flowSpeedReadIntervalUpdateTimer) clearTimeout(flowSpeedReadIntervalUpdateTimer);
  flowSpeedReadIntervalUpdateTimer = null;
  flowSpeedReadRAF = null;
  flowSpeedReadNextWordAt = 0;
}

function startFlowSpeedReadPlayback({ preserveIndex = false, startIndex = null } = {}) {
  stopFlowSpeedReadPlayback();
  applyFlowSpeedReadTiming();
  ensureFlowSpeedReadWordNodes();
  if (!flowSpeedReadWordNodes.length) return;
  const hasExplicitStartIndex = Number.isInteger(startIndex) && startIndex >= 0;
  const baseIndex = preserveIndex
    ? flowSpeedReadWordIndex
    : (hasExplicitStartIndex ? startIndex : resolveFlowSpeedReadStartIndex());
  flowSpeedReadWordIndex = Math.max(0, Math.min(baseIndex, flowSpeedReadWordNodes.length - 1));
  syncFlowSpeedReadHighlight();
  const firstWordPauseMs = preserveIndex ? 0 : FLOW_SPEED_READ_INITIAL_WORD_PAUSE_MS;
  flowSpeedReadNextWordAt = performance.now() + firstWordPauseMs + getFlowTokenDelayMs(flowSpeedReadWordIndex);
  const tick = (ts) => {
    if (flowGestureState !== FLOW_GESTURE_STATES.SPEED_READ_ACTIVE) return;
    if (!flowSpeedReadNextWordAt) flowSpeedReadNextWordAt = ts + getFlowTokenDelayMs(flowSpeedReadWordIndex);
    while (ts >= flowSpeedReadNextWordAt) {
      if (flowSpeedReadWordIndex >= flowSpeedReadWordNodes.length - 1) {
        flowSpeedReadWordIndex = flowSpeedReadWordNodes.length - 1;
        syncFlowSpeedReadHighlight();
        setFlowGestureState(FLOW_GESTURE_STATES.PAUSED_ON_RELEASE, 'reached_end');
        stopFlowSpeedReadPlayback();
        emitFlowGestureEvent('speed_read_pause', { index: flowSpeedReadWordIndex, reason: 'reached_end' });
        return;
      }
      flowSpeedReadWordIndex += 1;
      syncFlowSpeedReadHighlight();
      emitFlowGestureEvent('speed_read_word', { index: flowSpeedReadWordIndex });
      flowSpeedReadNextWordAt += getFlowTokenDelayMs(flowSpeedReadWordIndex);
    }
    flowSpeedReadRAF = requestAnimationFrame(tick);
  };
  flowSpeedReadRAF = requestAnimationFrame(tick);
  emitFlowGestureEvent('speed_read_start', { index: flowSpeedReadWordIndex });
}

function pauseFlowSpeedRead(reason = 'released') {
  stopFlowSpeedReadPlayback();
  setFlowGestureState(FLOW_GESTURE_STATES.PAUSED_ON_RELEASE, reason);
  emitFlowGestureEvent('speed_read_pause', { index: flowSpeedReadWordIndex, reason });
}

function resolveFlowSpeedReadStartIndex() {
  return resolveFlowSpeedReadStartContext().index;
}

function activateFlowSpeedRead(reason = 'hold_threshold', options = {}) {
  const explicitStartIndex = options.preserveIndex ? null : resolveFlowSpeedReadStartIndex();
  hideFlowGestureTimer();
  stopFlowGestureTimerUI();
  dismissFlowDefinitionPreview();
  setFlowGestureState(FLOW_GESTURE_STATES.SPEED_READ_ACTIVE, reason);
  startFlowSpeedReadPlayback({ ...options, startIndex: explicitStartIndex });
}

function resetFlowGestureInteraction() {
  flowGesturePressStartTs = 0;
  flowGestureActivePointerId = null;
  flowGestureStartContextLabel = '';
  clearFlowGestureThresholdTimers();
  stopFlowGestureTimerUI();
  hideFlowGestureTimer();
}

function stopFlowGestureController(reason = 'mode_change') {
  resetFlowGestureInteraction();
  stopFlowSpeedReadPlayback();
  clearFlowSpeedReadHighlight();
  removeFlowSpeedReadWordMarkup();
  flowSpeedReadWordNodes = [];
  flowSpeedReadTokens = [];
  flowSpeedReadWordIndex = 0;
  clearFlowWordSelection();
  hideFlowDefinitionPopout();
  setFlowGestureState(FLOW_GESTURE_STATES.IDLE, reason);
}

function exitFlowSpeedReadMode(reason = 'keyboard_escape') {
  if (
    flowGestureState === FLOW_GESTURE_STATES.IDLE &&
    !flowSpeedReadWordNodes.length &&
    !flowSpeedReadActiveWord
  ) return false;
  stopFlowGestureController(reason);
  announceFlowGesture('Speed-read mode exited.');
  return true;
}

function startFlowGestureHold(pointerId) {
  resetFlowGestureInteraction();
  const startContext = resolveFlowSpeedReadStartContext();
  flowGestureStartContextLabel = startContext.label;
  flowGesturePressStartTs = performance.now();
  flowGestureActivePointerId = pointerId;
  setFlowGestureState(FLOW_GESTURE_STATES.PRESSING, 'press_start');
  flowGestureTimerTimeoutId = setTimeout(() => {
    const elapsed = performance.now() - flowGesturePressStartTs;
    if (elapsed < FLOW_GESTURE_TIMER_VISIBLE_MS) return;
    if (flowGestureState !== FLOW_GESTURE_STATES.PRESSING) return;
    setFlowGestureState(FLOW_GESTURE_STATES.TIMER_VISIBLE, 'timer_threshold');
    showFlowGestureTimer();
    updateFlowGestureTimerUI(elapsed);
    startFlowGestureTimerUI();
  }, FLOW_GESTURE_TIMER_VISIBLE_MS);
  flowGestureActivateTimeoutId = setTimeout(() => {
    const elapsed = performance.now() - flowGesturePressStartTs;
    if (elapsed < FLOW_GESTURE_ACTIVATE_MS) return;
    if (flowGestureState !== FLOW_GESTURE_STATES.PRESSING && flowGestureState !== FLOW_GESTURE_STATES.TIMER_VISIBLE) return;
    activateFlowSpeedRead('hold_threshold');
  }, FLOW_GESTURE_ACTIVATE_MS);
}

function releaseFlowGestureHold(pointerId, reason = 'release') {
  if (flowGestureActivePointerId !== null && pointerId !== null && pointerId !== flowGestureActivePointerId) return;
  if (flowGestureState === FLOW_GESTURE_STATES.PRESSING || flowGestureState === FLOW_GESTURE_STATES.TIMER_VISIBLE) {
    setFlowGestureState(FLOW_GESTURE_STATES.IDLE, 'release_before_activation');
    emitFlowGestureEvent('activation_cancelled', { reason: 'release_before_activation' });
    resetFlowGestureInteraction();
    return;
  }
  if (flowGestureState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE) {
    resetFlowGestureInteraction();
    pauseFlowSpeedRead(reason);
    return;
  }
  resetFlowGestureInteraction();
}

function isFlowGestureEnabled() {
  return readingMode === 'flow' && flowLayer.classList.contains('on');
}

function shouldIgnoreFlowGestureTarget(target) {
  if (!(target instanceof Element)) return false;
  const blocked = target.closest(
    'button, a, input, select, textarea, label, summary, [role="button"], [role="link"], [role="menuitem"], [contenteditable], [data-flow-gesture-ignore]'
  );
  if (!blocked) return false;
  if (blocked.matches(':disabled, [aria-disabled="true"]')) return true;
  return true;
}

function prefersReducedMotion() {
  return Boolean(prefersReducedMotionQuery?.matches);
}

function handleFlowGesturePointerDown(e) {
  if (!isFlowGestureEnabled()) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (shouldIgnoreFlowGestureTarget(e.target)) return;
  if (flowGestureState === FLOW_GESTURE_STATES.PAUSED_ON_RELEASE) {
    e.preventDefault();
    flowGestureActivePointerId = e.pointerId;
    activateFlowSpeedRead('instant_resume_from_paused', { preserveIndex: true });
    return;
  }
  if (flowGestureState !== FLOW_GESTURE_STATES.IDLE) return;
  e.preventDefault();
  startFlowGestureHold(e.pointerId);
}

window.flowGestureController = {
  subscribe: onFlowGestureEvent,
  getState: () => flowGestureState
};
window.flowSpeedPlaybackController = {
  subscribe: onFlowGestureEvent,
  getState: () => ({
    tokenIndex: flowSpeedReadWordIndex,
    tokenCount: flowSpeedReadWordNodes.length,
    running: flowGestureState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE,
    paused: flowGestureState === FLOW_GESTURE_STATES.PAUSED_ON_RELEASE,
    wpm: flowSpeedReadPlaybackWpm,
    intervalMs: flowSpeedReadIntervalMs
  }),
  pause: () => pauseFlowSpeedRead('controller_pause'),
  resume: () => {
    if (flowGestureState !== FLOW_GESTURE_STATES.PAUSED_ON_RELEASE) return;
    activateFlowSpeedRead('controller_resume');
  }
};
window.flowParserSettings = {
  get: () => ({
    showRemovedArtifactsInDebug: isFlowArtifactDebugEnabled(),
    columnAwareLineOrdering: isColumnAwareLineOrderingEnabled()
  }),
  setShowRemovedArtifactsInDebug: enabled => setFlowArtifactDebugEnabled(Boolean(enabled))
};
