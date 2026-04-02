/* ── Modes ── */
const MODES = {
  day:   { bg: '#f9f6f0', filter: '', flowBg: 'rgba(23, 17, 11, 0.78)', flowText: '#f2e6d4', flowBorder: 'rgba(200, 135, 74, 0.18)' },
  sepia: { bg: '#f2ead8', filter: 'sepia(35%) brightness(97%)', flowBg: 'rgba(23, 17, 11, 0.78)', flowText: '#f2e6d4', flowBorder: 'rgba(200, 135, 74, 0.18)' },
  dark:  { bg: '#202020', filter: 'invert(1) hue-rotate(180deg) brightness(88%)', flowBg: 'rgba(12, 12, 12, 0.9)', flowText: '#efe7da', flowBorder: 'rgba(200, 135, 74, 0.26)' },
  night: { bg: '#180f04', filter: 'sepia(70%) brightness(62%) contrast(88%)', flowBg: 'rgba(11, 8, 6, 0.94)', flowText: '#f1e7d8', flowBorder: 'rgba(200, 135, 74, 0.32)' },
  'pastel-mint': { bg: '#eaf5ee', filter: 'brightness(99%)', flowBg: 'rgba(21, 52, 40, 0.95)', flowText: '#e8f5ee', flowBorder: 'rgba(145, 208, 179, 0.38)' },
  'pastel-sky': { bg: '#eaf2fa', filter: 'brightness(99%)', flowBg: 'rgba(23, 40, 62, 0.95)', flowText: '#e9f2ff', flowBorder: 'rgba(154, 190, 228, 0.4)' },
  'pastel-lavender': { bg: '#f0ebfa', filter: 'brightness(99%)', flowBg: 'rgba(44, 34, 70, 0.95)', flowText: '#f0e9ff', flowBorder: 'rgba(182, 163, 226, 0.42)' },
  'pastel-peach': { bg: '#f8eee3', filter: 'brightness(99%)', flowBg: 'rgba(72, 40, 27, 0.95)', flowText: '#fff0e3', flowBorder: 'rgba(233, 182, 142, 0.42)' },
};
const FONT_STACKS = {
  native: 'inherit',
  georgia: "'Georgia', 'Charter', 'Times New Roman', serif",
  lora: "'Lora', 'Baskerville', 'Georgia', serif",
  palatino: "'Palatino Linotype', 'Book Antiqua', 'Palatino', serif",
  verdana: "'Verdana', 'Tahoma', 'Trebuchet MS', 'Arial', sans-serif",
  atkinson: "'Atkinson Hyperlegible', 'Atkinson Hyperlegible Next', 'Verdana', 'Arial', sans-serif",
  opendyslexic: "'OpenDyslexic', 'OpenDyslexicAlta', 'Atkinson Hyperlegible', 'Verdana', 'Tahoma', 'Arial', sans-serif",
  courier: "'DM Mono', 'Courier New', monospace",
};
const LEGACY_FONT_KEYS = Object.fromEntries(
  Object.entries(FONT_STACKS).map(([key, stack]) => [stack, key])
);

function normalizeFontKey(fontValue) {
  if (typeof fontValue !== 'string' || !fontValue.trim()) return 'native';
  if (Object.hasOwn(FONT_STACKS, fontValue)) return fontValue;
  return LEGACY_FONT_KEYS[fontValue] || 'native';
}

function hexToRgb(hex) {
  const safe = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(safe)) return { r: 14, g: 10, b: 6 };
  const expanded = safe.length === 3
    ? safe.split('').map((char) => char + char).join('')
    : safe;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }) {
  const normalizeChannel = (value) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const R = normalizeChannel(r);
  const G = normalizeChannel(g);
  const B = normalizeChannel(b);
  return (0.2126 * R) + (0.7152 * G) + (0.0722 * B);
}

function pickContrastTextColor(backgroundHex, lightText = '#f6ebd9', darkText = '#2d2418') {
  const bgLum = relativeLuminance(hexToRgb(backgroundHex));
  const lightLum = relativeLuminance(hexToRgb(lightText));
  const darkLum = relativeLuminance(hexToRgb(darkText));
  const lightContrast = (Math.max(bgLum, lightLum) + 0.05) / (Math.min(bgLum, lightLum) + 0.05);
  const darkContrast = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
  return lightContrast >= darkContrast ? lightText : darkText;
}

function applyEmptyStateContrast(backgroundHex) {
  const rootStyle = document.documentElement.style;
  const titleColor = pickContrastTextColor(backgroundHex, '#f6ebd9', '#2b2217');
  const descColor = pickContrastTextColor(backgroundHex, '#e7d3b7', '#5a4732');
  const bgLum = relativeLuminance(hexToRgb(backgroundHex));
  const isLightBg = bgLum >= 0.38;
  rootStyle.setProperty('--empty-title-color', titleColor);
  rootStyle.setProperty('--empty-desc-color', descColor);
  rootStyle.setProperty('--empty-icon-shadow', isLightBg ? 'rgba(64, 42, 22, 0.36)' : 'rgba(7, 5, 3, 0.5)');
  rootStyle.setProperty('--empty-icon-glow', isLightBg ? 'rgba(255, 246, 227, 0.08)' : 'rgba(255, 224, 175, 0.28)');
}

const FONT_LOAD_PROMISES = new Map();

function appendStylesheetOnce(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ensureFontAvailable({ key, family, probes, fallbackHref, fallbackLinkId, timeoutMs = 2300 }) {
  if (!document.fonts || typeof document.fonts.load !== 'function') return Promise.resolve();
  if (FONT_LOAD_PROMISES.has(key)) return FONT_LOAD_PROMISES.get(key);
  const probeList = Array.isArray(probes) && probes.length ? probes : ['400 1em sans-serif'];
  const job = (async () => {
    try {
      const timer = new Promise(resolve => setTimeout(resolve, timeoutMs));
      await Promise.race([Promise.all(probeList.map(probe => document.fonts.load(probe))), timer]);
      if (probeList.every(probe => document.fonts.check(probe))) return;
      appendStylesheetOnce(fallbackLinkId, fallbackHref);
      await Promise.race([Promise.all(probeList.map(probe => document.fonts.load(probe))), timer]);
      if (!probeList.every(probe => document.fonts.check(probe))) {
        console.warn(`${family} did not fully load; keeping readable fallback stack.`);
      }
    } catch (err) {
      console.warn(`Error while loading ${family}:`, err);
    }
  })();
  FONT_LOAD_PROMISES.set(key, job);
  return job;
}

async function ensureCriticalFontsReady() {
  await Promise.allSettled([
    ensureFontAvailable({
      key: 'atkinson',
      family: 'Atkinson Hyperlegible',
      probes: ['400 1em "Atkinson Hyperlegible"', '700 1em "Atkinson Hyperlegible"'],
      fallbackHref: 'https://cdn.jsdelivr.net/npm/@fontsource/atkinson-hyperlegible@5.2.6/index.css',
      fallbackLinkId: 'fallbackAtkinsonFont'
    }),
    ensureFontAvailable({
      key: 'opendyslexic',
      family: 'OpenDyslexic',
      probes: ['400 1em "OpenDyslexic"', '700 1em "OpenDyslexic"'],
      fallbackHref: 'https://unpkg.com/opendyslexic@1.0.3/opendyslexic.css',
      fallbackLinkId: 'fallbackOpenDyslexicFont'
    })
  ]);
}

function setMode(m) {
  currentMode = m;
  document.querySelectorAll('.pbtn[data-mode]').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === m));
  const orpColor = (m === 'dark' || m === 'night') ? '#ff8f7f' : '#9e2a1f';
  document.documentElement.style.setProperty('--flow-orp-color', orpColor);
  const flowTheme = MODES[m] || MODES.day;
  document.documentElement.style.setProperty('--flow-layer-bg', flowTheme.flowBg || MODES.day.flowBg);
  document.documentElement.style.setProperty('--flow-layer-text', flowTheme.flowText || '#f2e6d4');
  document.documentElement.style.setProperty('--flow-layer-border', flowTheme.flowBorder || MODES.day.flowBorder);
  applyFilters();
}

function getProfileById(id) {
  if (BUILTIN_PROFILE_MAP.has(id)) return BUILTIN_PROFILE_MAP.get(id);
  if (customProfiles[id]) return customProfiles[id];
  return BUILTIN_PROFILE_MAP.get(DEFAULT_PROFILE_ID);
}

function captureSettings() {
  return {
    mode: currentMode,
    zoom: Math.round((maxW / BASE_PAGE_WIDTH) * 100),
    width: Number(document.getElementById('widthR').value),
    brightness: Number(document.getElementById('briR').value),
    contrast: Number(document.getElementById('conR').value),
    gap: Number(document.getElementById('gapR').value),
    typographyOverlay: readingMode === 'overlay',
    readingMode,
    font: document.getElementById('fontSel').value,
    textSize: Number(document.getElementById('tsizeR').value),
    lineHeight: Number(document.getElementById('lhR').value),
    letterSpacing: Number(document.getElementById('lsR').value),
    wordSpacing: Number(document.getElementById('wsR').value),
    ruler: document.getElementById('rulerT').checked,
    paragraphShading: document.getElementById('shadeT').checked,
    focusMode: document.getElementById('focusT').checked,
    focusVignette: Number(document.getElementById('focusR').value),
    focusDepth: Number(document.getElementById('focusDepthR').value),
    tint: Number(document.getElementById('tintR').value),
    progressBar: document.getElementById('progT').checked,
    autoScrollSpeed: Number(document.getElementById('scrollSR').value),
    flowSentencePauseBoost: document.getElementById('flowSentencePauseT').checked,
    chunkMode: document.getElementById('chunkT').checked,
    chunkHeight: Number(document.getElementById('chunkR').value),
    flowAutoSplit: document.getElementById('flowSplitT').checked,
    flowSplitLines: Number(document.getElementById('flowSplitLinesR').value),
    emailThreadOrder,
  };
}

function setRangeValue(id, value) {
  if (value === undefined || value === null) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.value = String(value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function applySettings(profile) {
  const settings = profile?.settings || profile || {};
  if (settings.mode && MODES[settings.mode]) setMode(settings.mode);
  if (settings.zoom !== undefined) {
    setRangeValue('widthR', settings.zoom);
  } else if (settings.width !== undefined) {
    const legacyZoom = Math.round((Number(settings.width) / BASE_PAGE_WIDTH) * 100);
    setRangeValue('widthR', legacyZoom);
  }
  setRangeValue('briR', settings.brightness);
  setRangeValue('conR', settings.contrast);
  setRangeValue('gapR', settings.gap);
  if (settings.font !== undefined) {
    const fontSel = document.getElementById('fontSel');
    fontSel.value = normalizeFontKey(settings.font);
  }
  let requestedReadingMode = settings.readingMode;
  if (!requestedReadingMode) requestedReadingMode = settings.typographyOverlay ? 'overlay' : 'pdf';
  setReadingMode(requestedReadingMode);
  syncReadingModeControls();
  applyReadingMode();
  setRangeValue('tsizeR', settings.textSize);
  setRangeValue('lhR', settings.lineHeight);
  setRangeValue('lsR', settings.letterSpacing);
  setRangeValue('wsR', settings.wordSpacing);

  if (settings.ruler !== undefined) document.getElementById('rulerT').checked = Boolean(settings.ruler);
  if (settings.paragraphShading !== undefined) document.getElementById('shadeT').checked = Boolean(settings.paragraphShading);
  if (settings.chunkMode !== undefined) document.getElementById('chunkT').checked = Boolean(settings.chunkMode);
  if (settings.flowAutoSplit !== undefined) document.getElementById('flowSplitT').checked = Boolean(settings.flowAutoSplit);
  setRangeValue('chunkR', settings.chunkHeight);
  setRangeValue('flowSplitLinesR', settings.flowSplitLines ?? settings.chunkHeight);
  toggleRuler();
  if (settings.focusMode !== undefined) document.getElementById('focusT').checked = Boolean(settings.focusMode);
  toggleFocus();
  setRangeValue('focusR', settings.focusVignette);
  setRangeValue('focusDepthR', settings.focusDepth);
  if (settings.progressBar !== undefined) document.getElementById('progT').checked = Boolean(settings.progressBar);
  toggleProg();
  setRangeValue('tintR', settings.tint);
  updateTint();
  setRangeValue('scrollSR', settings.autoScrollSpeed);
  if (settings.flowSentencePauseBoost !== undefined) {
    document.getElementById('flowSentencePauseT').checked = Boolean(settings.flowSentencePauseBoost);
  }
  setEmailThreadOrder(settings.emailThreadOrder, { rerender: true, persist: false });
}

function saveProfilesState() {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
    customProfiles,
    lastUsedProfileId
  }));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
    readingMode,
    settings: captureSettings()
  }));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('Unable to load settings:', err);
    return {};
  }
}

function queuePersistSettings() {
  if (persistSettingsTimer) clearTimeout(persistSettingsTimer);
  persistSettingsTimer = setTimeout(() => {
    persistSettingsTimer = null;
    saveSettings();
  }, 120);
}

function registerSettingsPersistence() {
  const ids = [
    'widthR', 'briR', 'conR', 'gapR', 'fontSel', 'tsizeR', 'lhR', 'lsR', 'wsR',
    'rulerT', 'shadeT', 'focusT', 'focusR', 'focusDepthR', 'progT', 'tintR',
    'scrollSR', 'flowSentencePauseT', 'chunkT', 'chunkR', 'flowSplitT', 'flowSplitLinesR', 'lowInterruptT', 'profileSel', 'emailOrderSel'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', queuePersistSettings);
    el.addEventListener('change', queuePersistSettings);
  });
}

function openDocStateDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DOC_STATE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOC_STATE_STORE)) {
        db.createObjectStore(DOC_STATE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open doc state database'));
  });
}

function sanitizeSourceType(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (!raw) return 'unknown';
  return raw.slice(0, 80);
}

function buildPreviewExcerpt(payload = {}, fallbackExcerpt = '') {
  const preferred = normalizeResumeExcerpt(
    fallbackExcerpt
    || payload.previewExcerpt
    || payload.sourceLabel
    || payload.displayName
    || payload.name
    || ''
  );
  return preferred || 'No preview available yet.';
}

function buildRecentDocEntry(docMeta, payload = {}, timestamps = {}) {
  if (!docMeta?.id) return null;
  const savedAt = Number(timestamps.savedAt || Date.now());
  const lastOpenedAt = Number(timestamps.lastOpenedAt || savedAt);
  return {
    docId: String(docMeta.id),
    title: String(docMeta.label || payload.displayName || payload.sourceLabel || 'Recovered document').slice(0, 200),
    sourceType: sanitizeSourceType(docMeta.type || payload.type || 'unknown'),
    savedAt,
    lastOpenedAt,
    previewExcerpt: buildPreviewExcerpt(payload, timestamps.previewExcerpt || ''),
    payloadRef: String(docMeta.id),
    pinned: Boolean(timestamps.pinned)
  };
}

function upsertRecentDocEntry(nextEntry, options = {}) {
  if (!nextEntry?.docId) return;
  const merge = options.merge !== false;
  const previous = recentDocEntries.find(entry => entry.docId === nextEntry.docId);
  const merged = merge && previous ? { ...previous, ...nextEntry } : nextEntry;
  const deduped = recentDocEntries.filter(entry => entry.docId !== merged.docId);
  recentDocEntries = [merged, ...deduped].slice(0, DOC_STATE_RECENT_MAX);
}

async function savePersistedDocument(payload) {
  try {
    const savedAt = Date.now();
    const docMeta = currentDocMeta || payload.docMeta || null;
    if (!docMeta?.id) return;
    const previewExcerpt = buildPreviewExcerpt(payload, buildResumeExcerpt({ page: currentPage || 1 }));
    const entry = buildRecentDocEntry(docMeta, payload, { savedAt, lastOpenedAt: savedAt, previewExcerpt });
    if (!entry) return;
    upsertRecentDocEntry(entry);
    saveRecentDocStoragePayload({
      activeDocId: entry.docId,
      recentDocs: recentDocEntries
    });
    renderRecentDocList();
    const db = await openDocStateDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STATE_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to save persisted document'));
      tx.objectStore(DOC_STATE_STORE).put({
        id: entry.payloadRef,
        payload,
        title: entry.title,
        sourceType: entry.sourceType,
        savedAt: entry.savedAt,
        lastOpenedAt: entry.lastOpenedAt,
        previewExcerpt: entry.previewExcerpt,
        payloadRef: entry.payloadRef
      });
    });
    db.close();
  } catch (err) {
    console.warn('Unable to persist document state:', err);
  }
}

async function loadPersistedDocumentRecordByDocId(docId) {
  if (!docId) return null;
  try {
    const db = await openDocStateDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STATE_STORE, 'readonly');
      const req = tx.objectStore(DOC_STATE_STORE).get(docId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Failed to read cached document'));
    });
    db.close();
    return record;
  } catch (err) {
    console.warn('Unable to load cached document by id:', err);
    return null;
  }
}

async function clearPersistedDocumentState() {
  recentDocEntries = [];
  localStorage.removeItem(DOC_STATE_STORAGE_KEY);
  renderRecentDocList();
  try {
    const db = await openDocStateDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STATE_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to clear persisted document'));
      tx.objectStore(DOC_STATE_STORE).clear();
    });
    db.close();
  } catch (err) {
    console.warn('Unable to clear persisted document state:', err);
  }
}

async function clearActivePersistedDocumentState() {
  saveRecentDocStoragePayload({ activeDocId: null });
}

function loadProfilesState() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    customProfiles = parsed?.customProfiles && typeof parsed.customProfiles === 'object' ? parsed.customProfiles : {};
    lastUsedProfileId = typeof parsed?.lastUsedProfileId === 'string' ? parsed.lastUsedProfileId : DEFAULT_PROFILE_ID;
  } catch (err) {
    console.warn('Unable to load reading profiles:', err);
    customProfiles = {};
    lastUsedProfileId = DEFAULT_PROFILE_ID;
  }
}

function refreshProfileSelect() {
  const sel = document.getElementById('profileSel');
  const customIds = Object.keys(customProfiles).sort((a, b) => customProfiles[a].name.localeCompare(customProfiles[b].name));
  sel.innerHTML = '';

  const suggestedGroup = document.createElement('optgroup');
  suggestedGroup.label = 'Suggested';
  BUILTIN_PROFILES.forEach(profile => {
    const opt = document.createElement('option');
    opt.value = profile.id;
    opt.textContent = profile.name;
    suggestedGroup.appendChild(opt);
  });
  sel.appendChild(suggestedGroup);

  if (customIds.length) {
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'Saved';
    customIds.forEach(id => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = customProfiles[id].name;
      customGroup.appendChild(opt);
    });
    sel.appendChild(customGroup);
  }

  if (!getProfileById(lastUsedProfileId)) lastUsedProfileId = DEFAULT_PROFILE_ID;
  sel.value = lastUsedProfileId;
  updateProfileDescription(lastUsedProfileId);
  updateProfileActionState();
  updateCompareProfileButtonState();
}

function updateProfileActionState() {
  const id = document.getElementById('profileSel').value;
  document.getElementById('deleteProfileBtn').disabled = !customProfiles[id];
}

function updateProfileDescription(profileId) {
  const desc = document.getElementById('profileDesc');
  if (!desc) return;
  const profile = getProfileById(profileId);
  if (!profile) {
    desc.textContent = '';
    return;
  }
  desc.textContent = profile.description || 'Custom profile based on your current reader settings.';
}

function updateCompareProfileButtonState() {
  const btn = document.getElementById('compareProfileBtn');
  if (!btn) return;
  const canCompare = Boolean(profileCompareState);
  btn.disabled = !canCompare;
  if (!canCompare) {
    btn.textContent = 'Compare with previous profile';
    btn.classList.remove('on');
    compareView = 'current';
    return;
  }
  const currentName = profileCompareState.currentName || 'Current';
  const previousName = profileCompareState.previousName || 'Previous';
  const showingPrevious = compareView === 'previous';
  btn.textContent = showingPrevious ? `Back to ${currentName}` : `Compare: ${previousName}`;
  btn.classList.toggle('on', showingPrevious);
}

function useProfile(profileId) {
  const profile = getProfileById(profileId);
  if (!profile) return;
  if (lastUsedProfileId !== profileId) {
    const previousProfile = getProfileById(lastUsedProfileId) || getProfileById(DEFAULT_PROFILE_ID);
    profileCompareState = {
      previousProfileId: lastUsedProfileId,
      previousSettings: captureSettings(),
      previousName: previousProfile?.name || 'Previous profile',
      currentProfileId: profileId,
      currentSettings: profile.settings || captureSettings(),
      currentName: profile.name || 'Current profile'
    };
  }
  compareView = 'current';
  applySettings(profile);
  lastUsedProfileId = profileId;
  document.getElementById('profileSel').value = profileId;
  updateProfileDescription(profileId);
  updateProfileActionState();
  updateCompareProfileButtonState();
  saveProfilesState();
  saveDocProgress();
}

function toggleCompareProfile() {
  if (!profileCompareState) return;
  if (compareView === 'current') {
    applySettings(profileCompareState.previousSettings);
    compareView = 'previous';
  } else {
    applySettings(profileCompareState.currentSettings);
    compareView = 'current';
  }
  updateCompareProfileButtonState();
}

function handleSaveProfile() {
  const nameRaw = window.prompt('Name this reading profile:', '');
  if (nameRaw === null) return;
  const name = nameRaw.trim().slice(0, 40);
  if (!name) return;
  const id = `custom-${Date.now()}`;
  customProfiles[id] = { id, name, settings: captureSettings() };
  lastUsedProfileId = id;
  refreshProfileSelect();
  useProfile(id);
}

function handleDeleteProfile() {
  const sel = document.getElementById('profileSel');
  const id = sel.value;
  if (!customProfiles[id]) return;
  delete customProfiles[id];
  lastUsedProfileId = DEFAULT_PROFILE_ID;
  refreshProfileSelect();
  useProfile(DEFAULT_PROFILE_ID);
}

function handleResetProfileDefaults() {
  useProfile(DEFAULT_PROFILE_ID);
}

function getChunkMemoryForCurrentDoc() {
  const docId = getCurrentDocId();
  const chunkMemory = sessionSupportState.chunkMemory || {};
  const current = chunkMemory.current;
  const previous = chunkMemory.previous;
  return {
    current: current && current.docId === docId ? current : null,
    previous: previous && previous.docId === docId ? previous : null
  };
}

function updateChunkRecoverButton() {
  const btn = document.getElementById('chunkRecoverBtn');
  if (!btn) return;
  const { previous } = getChunkMemoryForCurrentDoc();
  btn.disabled = !previous;
  if (!previous) {
    btn.textContent = 'Return to previous chunk';
    btn.title = 'No previous chunk is available yet.';
    return;
  }
  const kind = previous.readingMode === 'flow' ? 'Flow chunk' : `Page ${previous.page || 1} chunk`;
  btn.textContent = `Return to previous chunk (${kind})`;
  btn.title = `Jump back to the chunk saved at ${formatSessionDate(previous.savedAt)}.`;
}

function captureChunkSnapshot() {
  if (!chunkModeOn()) return null;
  const docId = getCurrentDocId();
  if (!docId) return null;
  const snapshot = {
    docId,
    readingMode,
    page: currentPage || 1,
    scrollTop: Math.round(reader.scrollTop),
    chunkHeight: Number(document.getElementById('chunkR').value) || 1,
    savedAt: Date.now()
  };
  if (readingMode === 'flow') {
    snapshot.flowChunkIndex = Math.max(0, Number(flowChunkIndex) || 0);
  } else {
    snapshot.chunkCenterY = Math.round(chunkCenterY || 0);
  }
  return snapshot;
}

function sameChunkSnapshot(a, b) {
  if (!a || !b) return false;
  if (a.docId !== b.docId || a.readingMode !== b.readingMode || a.page !== b.page) return false;
  if (a.readingMode === 'flow') return Number(a.flowChunkIndex || 0) === Number(b.flowChunkIndex || 0);
  return Math.abs(Number(a.chunkCenterY || 0) - Number(b.chunkCenterY || 0)) <= 2;
}

function rememberChunkSnapshot({ promotePrevious = true } = {}) {
  const snapshot = captureChunkSnapshot();
  if (!snapshot) {
    updateChunkRecoverButton();
    return;
  }
  const memory = sessionSupportState.chunkMemory || { current: null, previous: null };
  if (sameChunkSnapshot(memory.current, snapshot)) {
    memory.current = { ...memory.current, ...snapshot };
    sessionSupportState.chunkMemory = memory;
    saveSessionSupportState();
    updateChunkRecoverButton();
    return;
  }
  if (promotePrevious && memory.current) {
    memory.previous = memory.current;
  }
  memory.current = snapshot;
  sessionSupportState.chunkMemory = memory;
  saveSessionSupportState();
  updateChunkRecoverButton();
}

async function restoreChunkSnapshot(snapshot, { asRecovery = false } = {}) {
  if (!snapshot || snapshot.docId !== getCurrentDocId()) return false;
  if (snapshot.readingMode && snapshot.readingMode !== readingMode) {
    setReadingMode(snapshot.readingMode);
    await applyReadingMode();
  }
  const chunkToggle = document.getElementById('chunkT');
  if (chunkToggle && !chunkToggle.checked) {
    chunkToggle.checked = true;
    toggleChunkMode();
  }
  if (snapshot.chunkHeight) {
    setRangeValue('chunkR', snapshot.chunkHeight);
    document.getElementById('chunkV').textContent = chunkLengthLabel(Number(document.getElementById('chunkR').value));
  }
  requestAnimationFrame(() => {
    reader.scrollTop = Number(snapshot.scrollTop) || 0;
    if (snapshot.readingMode === 'flow') {
      const list = getFlowHighlightables();
      const chunkSize = Math.max(1, Number(document.getElementById('chunkR').value) || 1);
      flowChunkIndex = Math.max(0, Number(snapshot.flowChunkIndex) || 0);
      clampFlowChunkIndex(list, chunkSize);
      updateFlowHighlight();
      scrollFlowChunkIntoView(list, chunkSize);
    } else {
      chunkCenterY = Math.max(0, Number(snapshot.chunkCenterY) || chunkCenterY || 0);
      ensureChunkAnchor();
      updateChunkOverlay();
    }
    updateProgressAndStatus();
  });
  if (asRecovery) {
    const memory = sessionSupportState.chunkMemory || { current: null, previous: null };
    memory.previous = memory.current || null;
    memory.current = { ...snapshot, savedAt: Date.now() };
    sessionSupportState.chunkMemory = memory;
    saveSessionSupportState();
  }
  updateChunkRecoverButton();
  return true;
}

function restoreCurrentChunkFromSessionMemory() {
  const { current } = getChunkMemoryForCurrentDoc();
  if (!current) {
    updateChunkRecoverButton();
    return;
  }
  restoreChunkSnapshot(current).catch(err => console.warn('Unable to restore current chunk from session memory:', err));
}

function formatSessionDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function getCurrentDocId() {
  return currentDocMeta?.id || null;
}

function loadDocProgressMap() {
  try {
    const raw = localStorage.getItem(DOC_PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('Unable to load document progress:', err);
    return {};
  }
}

function saveDocProgressMap(nextMap) {
  localStorage.setItem(DOC_PROGRESS_STORAGE_KEY, JSON.stringify(nextMap));
}

function getRecentDocStoragePayload() {
  try {
    const raw = localStorage.getItem(DOC_STATE_STORAGE_KEY);
    if (!raw) return { recentDocs: [], activeDocId: null };
    const parsed = JSON.parse(raw);
    const recentDocs = Array.isArray(parsed?.recentDocs) ? parsed.recentDocs : [];
    return {
      ...parsed,
      activeDocId: typeof parsed?.activeDocId === 'string' ? parsed.activeDocId : null,
      recentDocs
    };
  } catch (err) {
    console.warn('Unable to parse recent document cache metadata:', err);
    return { recentDocs: [], activeDocId: null };
  }
}

function saveRecentDocStoragePayload(updates = {}) {
  const current = getRecentDocStoragePayload();
  const nextPayload = { ...current, ...updates };
  localStorage.setItem(DOC_STATE_STORAGE_KEY, JSON.stringify(nextPayload));
}

function syncRecentDocListFromStorage() {
  const payload = getRecentDocStoragePayload();
  recentDocEntries = (Array.isArray(payload.recentDocs) ? payload.recentDocs : [])
    .map((entry) => ({
      docId: String(entry?.docId || ''),
      title: String(entry?.title || entry?.label || 'Recovered document').slice(0, 200),
      sourceType: sanitizeSourceType(entry?.sourceType || entry?.type || 'unknown'),
      savedAt: Number(entry?.savedAt || 0),
      lastOpenedAt: Number(entry?.lastOpenedAt || entry?.savedAt || 0),
      previewExcerpt: buildPreviewExcerpt(entry, entry?.previewExcerpt || ''),
      payloadRef: String(entry?.payloadRef || entry?.docId || ''),
      pinned: Boolean(entry?.pinned)
    }))
    .filter(entry => entry.docId);
}

function getRecentDocSortMode() {
  const fromStorage = localStorage.getItem(DOC_SORT_KEY);
  if (fromStorage === 'saved' || fromStorage === 'title' || fromStorage === 'last-opened') return fromStorage;
  return 'last-opened';
}

function setRecentDocSortMode(nextMode) {
  recentDocSortMode = (nextMode === 'saved' || nextMode === 'title' || nextMode === 'last-opened') ? nextMode : 'last-opened';
  localStorage.setItem(DOC_SORT_KEY, recentDocSortMode);
  const sel = document.getElementById('recentDocSortSel');
  if (sel) sel.value = recentDocSortMode;
}

function getSortedRecentDocEntries() {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
  return [...recentDocEntries].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    if (recentDocSortMode === 'title') {
      const titleCmp = collator.compare(a.title || '', b.title || '');
      if (titleCmp !== 0) return titleCmp;
      return Number(b.lastOpenedAt || 0) - Number(a.lastOpenedAt || 0);
    }
    if (recentDocSortMode === 'saved') {
      return Number(b.savedAt || 0) - Number(a.savedAt || 0);
    }
    return Number(b.lastOpenedAt || 0) - Number(a.lastOpenedAt || 0);
  });
}

function formatRecentDocPosition(info = {}) {
  const progressMap = loadDocProgressMap();
  const progress = info?.docId ? progressMap[info.docId] : null;
  const page = Math.max(1, Number(progress?.page || info.page) || 1);
  const openedAt = formatSessionDate(info.lastOpenedAt || info.savedAt);
  const savedAt = formatSessionDate(info.savedAt);
  return `Page ${page} • Opened ${openedAt} • Saved ${savedAt}`;
}

function escapeHtml(raw = '') {
  return String(raw)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderRecentDocList() {
  const list = document.getElementById('recentDocList');
  if (!list) return;
  const currentDocId = getCurrentDocId();
  if (!recentDocEntries.length) {
    list.innerHTML = `
      <li class="recent-doc-item">
        <span class="recent-doc-meta">No recent documents yet.</span>
      </li>
    `;
    return;
  }
  list.innerHTML = '';
  getSortedRecentDocEntries().forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'recent-doc-item';
    if (currentDocId && entry.docId === currentDocId) li.classList.add('active');
    if (entry.pinned) li.classList.add('is-pinned');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recent-doc-btn';
    btn.dataset.docId = entry.docId;
    btn.innerHTML = `
      <span class="recent-doc-title">${escapeHtml(entry.title || 'Recovered document')}</span>
      <span class="recent-doc-meta">${escapeHtml(formatRecentDocPosition(entry))}</span>
      <span class="recent-doc-meta">${escapeHtml(entry.previewExcerpt || 'No preview available yet.')}</span>
    `;
    btn.addEventListener('click', () => recallRecentDocument(entry.docId));
    li.appendChild(btn);

    const actions = document.createElement('div');
    actions.className = 'recent-doc-actions';

    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = 'recent-doc-action';
    pinBtn.textContent = entry.pinned ? 'Unpin' : 'Pin';
    pinBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleRecentDocPin(entry.docId);
    });
    actions.appendChild(pinBtn);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'recent-doc-action';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      await removeRecentDocument(entry.docId);
    });
    actions.appendChild(removeBtn);

    li.appendChild(actions);
    list.appendChild(li);
  });
}

function saveDocProgress() {
  const docId = getCurrentDocId();
  if (!docId || (!pdf && !textDoc)) return;
  const map = loadDocProgressMap();
  rememberChunkSnapshot({ promotePrevious: false });
  const page = currentPage || 1;
  const docTitle = (currentDocMeta?.label || currentDocMeta?.name || 'Document').trim();
  map[docId] = {
    scrollTop: Math.round(reader.scrollTop),
    page,
    profileId: lastUsedProfileId,
    readingMode,
    docTitle,
    excerpt: buildResumeExcerpt({ page }),
    chunkSnapshot: (sessionSupportState.chunkMemory && sessionSupportState.chunkMemory.current && sessionSupportState.chunkMemory.current.docId === docId)
      ? sessionSupportState.chunkMemory.current
      : null,
    savedAt: Date.now(),
    label: docTitle
  };
  saveDocProgressMap(map);
  upsertRecentDocEntry({
    docId,
    title: docTitle,
    sourceType: sanitizeSourceType(currentDocMeta?.type),
    savedAt: map[docId].savedAt,
    lastOpenedAt: Date.now(),
    previewExcerpt: map[docId].excerpt || 'No preview available yet.',
    payloadRef: docId
  });
  saveRecentDocStoragePayload({
    activeDocId: docId,
    recentDocs: recentDocEntries
  });
  renderRecentDocList();
}

function toggleRecentDocPin(docId) {
  if (!docId) return;
  recentDocEntries = recentDocEntries.map(entry => entry.docId === docId ? { ...entry, pinned: !entry.pinned } : entry);
  saveRecentDocStoragePayload({ recentDocs: recentDocEntries });
  renderRecentDocList();
}

async function removeRecentDocument(docId) {
  if (!docId) return;
  recentDocEntries = recentDocEntries.filter(entry => entry.docId !== docId);
  const progressMap = loadDocProgressMap();
  if (progressMap[docId]) {
    delete progressMap[docId];
    saveDocProgressMap(progressMap);
  }
  const existing = getRecentDocStoragePayload();
  saveRecentDocStoragePayload({
    activeDocId: existing.activeDocId === docId ? null : existing.activeDocId,
    recentDocs: recentDocEntries
  });
  renderRecentDocList();
  try {
    const db = await openDocStateDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_STATE_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to remove cached document'));
      tx.objectStore(DOC_STATE_STORE).delete(docId);
    });
    db.close();
  } catch (err) {
    console.warn('Unable to remove cached document:', err);
  }
}

function normalizeResumeExcerpt(raw, maxLen = 180) {
  const compact = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 1).trim()}…`;
}

function buildResumeExcerpt({ page = 1 } = {}) {
  const pageNumber = Math.max(1, Number(page) || 1);
  const flowBlocks = [...flowLayer.querySelectorAll(`.flow-heading[data-page="${pageNumber}"], .flow-para[data-page="${pageNumber}"], .flow-list-item[data-page="${pageNumber}"]`)];
  const flowText = normalizeResumeExcerpt(flowBlocks.map(node => node.textContent || '').join(' '));
  if (flowText) return flowText;

  const pageWrap = rInner.querySelector(`.page-wrap[data-p="${pageNumber}"]`);
  if (!pageWrap) return '';
  const spanText = [...pageWrap.querySelectorAll('.textLayer span')]
    .map(node => node.textContent || '')
    .join(' ');
  return normalizeResumeExcerpt(spanText);
}

function refreshResumeCard() {
  const card = document.getElementById('resumeCard');
  const text = document.getElementById('resumeText');
  if (!pendingResumeState) {
    card.classList.remove('on');
    text.textContent = 'No saved position yet.';
    return;
  }
  const info = pendingResumeState;
  const title = (info.docTitle || info.label || currentDocMeta?.label || 'Document').trim();
  const page = Math.max(1, Number(info.page) || 1);
  const excerpt = normalizeResumeExcerpt(info.excerpt || buildResumeExcerpt({ page }));
  const excerptLine = excerpt ? `Section excerpt: "${excerpt}"` : 'Section excerpt: unavailable';
  text.textContent = `Document: ${title}
Page: ${page}
${excerptLine}
Saved: ${formatSessionDate(info.savedAt)} • Profile: ${info.profileId || DEFAULT_PROFILE_ID}`;
  card.classList.add('on');
}

async function restoreSavedPosition() {
  if (!pendingResumeState) return;
  const info = pendingResumeState;
  if (info.profileId && getProfileById(info.profileId)) useProfile(info.profileId);
  if (info.readingMode && info.readingMode !== readingMode) {
    setReadingMode(info.readingMode);
    await applyReadingMode();
  }
  requestAnimationFrame(() => {
    reader.scrollTop = Number(info.scrollTop) || 0;
    updateProgressAndStatus();
  });
  if (info.chunkSnapshot) {
    restoreChunkSnapshot(info.chunkSnapshot).catch(err => console.warn('Unable to restore saved chunk snapshot:', err));
  }
  pendingResumeState = null;
  refreshResumeCard();
}

function maybeOfferResumeForCurrentDoc() {
  const docId = getCurrentDocId();
  if (!docId) return;
  const saved = loadDocProgressMap()[docId];
  if (!saved) {
    pendingResumeState = null;
    refreshResumeCard();
    return;
  }
  pendingResumeState = saved;
  refreshResumeCard();
  updateChunkRecoverButton();
  restoreCurrentChunkFromSessionMemory();
}

function getAvailableReadingModesForCurrentContent() {
  const metaType = String(currentDocMeta?.type || '').toLowerCase();
  if (!metaType) return ['pdf', 'overlay', 'flow'];
  if (metaType === 'pdf' || metaType === 'pdf-file') return ['pdf', 'overlay', 'flow'];
  return ['flow'];
}

function syncReadingModeAvailability() {
  const availableModes = getAvailableReadingModesForCurrentContent();
  const hasLoadedContent = Boolean(currentDocMeta);
  const readingModeDock = document.querySelector('.reading-mode-dock');
  const modeInputs = Array.from(document.querySelectorAll('input[name="readingMode"]'));
  modeInputs.forEach((input) => {
    const modeAvailable = availableModes.includes(input.value);
    const modeLabel = input.closest('label');
    if (modeLabel) modeLabel.hidden = !modeAvailable;
    input.disabled = !modeAvailable;
    if (!modeAvailable) input.checked = false;
  });
  if (readingModeDock) {
    readingModeDock.hidden = !hasLoadedContent;
    readingModeDock.classList.toggle('is-single-mode', availableModes.length <= 1);
  }
  if (!availableModes.includes(readingMode)) {
    setReadingMode(availableModes[0] || 'flow');
  }
}

function setCurrentDocumentMeta(meta) {
  currentDocMeta = meta;
  if (meta?.id) {
    saveRecentDocStoragePayload({ activeDocId: meta.id });
  }
  syncReadingModeAvailability();
  renderRecentDocList();
  maybeOfferResumeForCurrentDoc();
}

function getIsoDay(ts) {
  const date = new Date(ts);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rollupWindowDays(dayMap, days) {
  const series = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const ts = now.getTime() - (i * 86400000);
    const day = getIsoDay(ts);
    const min = Number(dayMap.get(day) || 0);
    series.push({ day, minutes: min });
  }
  return series;
}

function renderTrendBars(targetId, series) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = '';
  const max = Math.max(1, ...series.map(item => Number(item.minutes) || 0));
  series.forEach(item => {
    const bar = document.createElement('div');
    const pct = Math.max(0.1, (Number(item.minutes) || 0) / max);
    bar.className = `trend-bar${item.minutes > 0 ? ' active' : ''}`;
    bar.style.height = `${Math.max(8, Math.round(pct * 100))}%`;
    bar.title = `${item.day}: ${Math.round(item.minutes)} min`;
    el.appendChild(bar);
  });
}

function computeLongestStreak(dayMap) {
  const days = Array.from(dayMap.keys()).sort();
  let longest = 0;
  let run = 0;
  let prevTs = null;
  days.forEach(day => {
    if ((dayMap.get(day) || 0) <= 0) return;
    const ts = new Date(`${day}T00:00:00`).getTime();
    if (prevTs !== null && (ts - prevTs) === 86400000) run += 1;
    else run = 1;
    prevTs = ts;
    if (run > longest) longest = run;
  });
  return longest;
}

function computeCurrentStreak(dayMap) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getIsoDay(today.getTime());
  const hasToday = (dayMap.get(todayKey) || 0) > 0;
  const startOffset = hasToday ? 0 : 1;
  let streak = 0;
  for (let i = 0; i < 3650; i += 1) {
    const day = getIsoDay(today.getTime() - ((i + startOffset) * 86400000));
    if ((dayMap.get(day) || 0) > 0) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function renderReadingInsights() {
  const sessions = Array.isArray(statsState.sessions) ? statsState.sessions : [];
  const dayMap = new Map();
  sessions.forEach(session => {
    const day = getIsoDay(Number(session.endedAt || session.startedAt || Date.now()));
    const prev = Number(dayMap.get(day) || 0);
    dayMap.set(day, prev + Math.max(0, Number(session.durationMin) || 0));
  });
  const series7 = rollupWindowDays(dayMap, 7);
  const series30 = rollupWindowDays(dayMap, 30);
  const total7 = series7.reduce((sum, item) => sum + item.minutes, 0);
  const total30 = series30.reduce((sum, item) => sum + item.minutes, 0);
  const sessionCount = sessions.length;
  const avgSession = sessionCount ? sessions.reduce((sum, item) => sum + Math.max(0, Number(item.durationMin) || 0), 0) / sessionCount : 0;
  const currentStreak = computeCurrentStreak(dayMap);
  const bestStreak = computeLongestStreak(dayMap);
  const bestSession = sessions.reduce((best, item) => ((Number(item.durationMin) || 0) > (Number(best?.durationMin) || 0) ? item : best), null);

  let bestDay = { day: null, minutes: 0 };
  dayMap.forEach((minutes, day) => {
    if (minutes > bestDay.minutes) bestDay = { day, minutes };
  });

  document.getElementById('insight7Total').textContent = `${Math.round(total7)} min`;
  document.getElementById('insight30Total').textContent = `${Math.round(total30)} min`;
  document.getElementById('insightStreakValue').textContent = `${currentStreak} day${currentStreak === 1 ? '' : 's'}`;
  document.getElementById('insightBestStreak').textContent = `Best: ${bestStreak} day${bestStreak === 1 ? '' : 's'}`;
  document.getElementById('insightAvgSession').textContent = `${Math.round(avgSession)} min`;
  document.getElementById('insightSessionCount').textContent = `${sessionCount} session${sessionCount === 1 ? '' : 's'}`;
  document.getElementById('insightBestDayValue').textContent = `${Math.round(bestDay.minutes)} min`;
  document.getElementById('insightBestDayDate').textContent = bestDay.day ? new Date(`${bestDay.day}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  document.getElementById('insightBestSessionValue').textContent = `${Math.round(Number(bestSession?.durationMin) || 0)} min`;
  document.getElementById('insightBestSessionMeta').textContent = bestSession
    ? `${new Date(Number(bestSession.endedAt || bestSession.startedAt)).toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${bestSession.mode || 'unknown mode'}`
    : 'No sessions yet';

  renderTrendBars('insightTrend7', series7);
  renderTrendBars('insightTrend30', series30);
}

function loadStatsState() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    statsState.enabled = parsed.enabled !== false;
    statsState.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
  } catch (err) {
    console.warn('Unable to load stats state:', err);
  }
}

function saveStatsState() {
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify({
    enabled: statsState.enabled !== false,
    sessions: Array.isArray(statsState.sessions) ? statsState.sessions : []
  }));
}

function persistSessionStat(record) {
  if (!statsState.enabled || !record) return;
  const next = {
    startedAt: Number(record.startedAt) || Date.now(),
    endedAt: Number(record.endedAt) || Date.now(),
    durationMin: Math.max(0, Number(record.durationMin) || 0),
    docId: record.docId || null,
    mode: record.mode || readingMode || 'pdf'
  };
  if (Number.isFinite(record.wordsReadEstimate) && record.wordsReadEstimate > 0) {
    next.wordsReadEstimate = Math.round(record.wordsReadEstimate);
  }
  statsState.sessions.push(next);
  saveStatsState();
  renderReadingInsights();
}

function deleteAllStats() {
  statsState.sessions = [];
  activeSessionRecord = null;
  saveStatsState();
  renderReadingInsights();
}

function loadSessionSupportState() {
  try {
    const raw = localStorage.getItem(SESSION_SUPPORT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    sessionSupportState = {
      ...sessionSupportState,
      ...parsed
    };
    if (!sessionSupportState.chunkMemory || typeof sessionSupportState.chunkMemory !== 'object') {
      sessionSupportState.chunkMemory = { current: null, previous: null };
    }
    sessionSupportState.insightsCollapsed = sessionSupportState.insightsCollapsed !== false;
    sessionSupportState.plannedDurationMin = Math.max(0, Number(sessionSupportState.plannedDurationMin || sessionSupportState.durationMin || 0));
  } catch (err) {
    console.warn('Unable to load session support settings:', err);
  }
}

function saveSessionSupportState() {
  localStorage.setItem(SESSION_SUPPORT_STORAGE_KEY, JSON.stringify(sessionSupportState));
}

function applySessionInsightsCollapsedState() {
  const insightsSection = document.getElementById('sessionInsightsSection');
  const insightsToggle = document.getElementById('sessionInsightsToggle');
  if (!insightsSection || !insightsToggle) return;
  const collapsed = sessionSupportState.insightsCollapsed !== false;
  sessionSupportState.insightsCollapsed = collapsed;
  insightsSection.classList.toggle('is-collapsed', collapsed);
  insightsToggle.setAttribute('aria-expanded', String(!collapsed));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(String(input || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function derivePortableEncryptionKey(passphrase, salt, iterations = PORTABLE_KDF_ITERATIONS) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function getPortableDataPayload() {
  return {
    settings: loadSettings(),
    profiles: {
      customProfiles,
      lastUsedProfileId
    },
    sessionSupport: sessionSupportState,
    progress: loadDocProgressMap()
  };
}

async function buildPortableEnvelope({ passphrase = '' } = {}) {
  const payload = getPortableDataPayload();
  const base = {
    schema: PORTABLE_SCHEMA_NAME,
    version: PORTABLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: payload
  };
  const checksum = await sha256Hex(stableStringify(base));
  if (!passphrase) {
    return {
      ...base,
      checksum,
      encryption: { enabled: false }
    };
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePortableEncryptionKey(passphrase, salt, PORTABLE_KDF_ITERATIONS);
  const plaintext = new TextEncoder().encode(stableStringify(base.data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    schema: PORTABLE_SCHEMA_NAME,
    version: PORTABLE_SCHEMA_VERSION,
    exportedAt: base.exportedAt,
    checksum,
    encryption: {
      enabled: true,
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: PORTABLE_KDF_ITERATIONS,
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv)
    },
    data: arrayBufferToBase64(ciphertext)
  };
}

function mergeDocProgressMaps(currentMap = {}, incomingMap = {}) {
  const next = { ...currentMap };
  Object.entries(incomingMap || {}).forEach(([docId, incoming]) => {
    if (!incoming || typeof incoming !== 'object') return;
    const existing = next[docId];
    const existingTs = Number(existing?.savedAt || 0);
    const incomingTs = Number(incoming?.savedAt || 0);
    if (!existing || incomingTs >= existingTs) next[docId] = incoming;
  });
  return next;
}

function applyPortableImportData(payload = {}, conflictStrategy = 'merge') {
  const replace = conflictStrategy === 'replace';
  const incomingSettings = payload.settings && typeof payload.settings === 'object' ? payload.settings : {};
  const incomingProfiles = payload.profiles && typeof payload.profiles === 'object' ? payload.profiles : {};
  const incomingSession = payload.sessionSupport && typeof payload.sessionSupport === 'object' ? payload.sessionSupport : {};
  const incomingProgress = payload.progress && typeof payload.progress === 'object' ? payload.progress : {};

  if (replace) {
    if (incomingSettings && Object.keys(incomingSettings).length) {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(incomingSettings));
    }
    const nextProfiles = {
      customProfiles: incomingProfiles.customProfiles && typeof incomingProfiles.customProfiles === 'object' ? incomingProfiles.customProfiles : {},
      lastUsedProfileId: typeof incomingProfiles.lastUsedProfileId === 'string' ? incomingProfiles.lastUsedProfileId : DEFAULT_PROFILE_ID
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfiles));
    const nextSession = {
      ...sessionSupportState,
      ...incomingSession
    };
    localStorage.setItem(SESSION_SUPPORT_STORAGE_KEY, JSON.stringify(nextSession));
    saveDocProgressMap(incomingProgress);
    return;
  }

  if (incomingSettings && Object.keys(incomingSettings).length) {
    const currentSettings = loadSettings();
    const mergedSettings = {
      ...currentSettings,
      ...incomingSettings,
      settings: {
        ...(currentSettings.settings || {}),
        ...(incomingSettings.settings || {})
      }
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(mergedSettings));
  }

  const currentProfiles = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  })();
  const mergedProfiles = {
    customProfiles: {
      ...(currentProfiles.customProfiles || {}),
      ...(incomingProfiles.customProfiles || {})
    },
    lastUsedProfileId: typeof incomingProfiles.lastUsedProfileId === 'string'
      ? incomingProfiles.lastUsedProfileId
      : (currentProfiles.lastUsedProfileId || DEFAULT_PROFILE_ID)
  };
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(mergedProfiles));

  const mergedSessionSupport = {
    ...sessionSupportState,
    ...incomingSession,
    chunkMemory: {
      ...(sessionSupportState.chunkMemory || {}),
      ...((incomingSession && incomingSession.chunkMemory) || {})
    }
  };
  localStorage.setItem(SESSION_SUPPORT_STORAGE_KEY, JSON.stringify(mergedSessionSupport));
  saveDocProgressMap(mergeDocProgressMaps(loadDocProgressMap(), incomingProgress));
}

async function parsePortableImportEnvelope(rawText) {
  const parsed = JSON.parse(rawText);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid import file format.');
  if (parsed.schema !== PORTABLE_SCHEMA_NAME) throw new Error('Unsupported schema.');
  if (Number(parsed.version) !== PORTABLE_SCHEMA_VERSION) throw new Error(`Unsupported schema version: ${parsed.version}`);

  const encryptionEnabled = Boolean(parsed.encryption?.enabled);
  let payload = parsed.data;
  if (encryptionEnabled) {
    const passphrase = window.prompt('This export is encrypted. Enter passphrase to import:');
    if (!passphrase) throw new Error('Import cancelled: passphrase required.');
    const salt = base64ToUint8Array(parsed.encryption?.salt || '');
    const iv = base64ToUint8Array(parsed.encryption?.iv || '');
    const iterations = Number(parsed.encryption?.iterations) || PORTABLE_KDF_ITERATIONS;
    const key = await derivePortableEncryptionKey(passphrase, salt, iterations);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToUint8Array(String(parsed.data || ''))
    );
    payload = JSON.parse(new TextDecoder().decode(decrypted));
  }

  if (!payload || typeof payload !== 'object') throw new Error('Imported payload is empty.');
  const checksumProbe = {
    schema: parsed.schema,
    version: parsed.version,
    exportedAt: parsed.exportedAt,
    data: payload
  };
  const computedChecksum = await sha256Hex(stableStringify(checksumProbe));
  if (computedChecksum !== parsed.checksum) throw new Error('Checksum mismatch. Import aborted to protect data integrity.');
  return payload;
}

async function handlePortableDataExport() {
  try {
    const wantsEncryption = window.confirm('Protect export with a passphrase?\n\nChoose "OK" for encrypted export, or "Cancel" for plain JSON.');
    let passphrase = '';
    if (wantsEncryption) {
      passphrase = window.prompt('Enter export passphrase (remember this; it is required for import):', '') || '';
      if (!passphrase.trim()) {
        window.alert('Export cancelled: passphrase cannot be empty when encryption is enabled.');
        return;
      }
    }
    const envelope = await buildPortableEnvelope({ passphrase });
    const blob = new Blob([`${JSON.stringify(envelope, null, 2)}\n`], { type: 'application/json' });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `lumen-export-v${PORTABLE_SCHEMA_VERSION}-${stamp}.json`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    window.alert(`Export ready: ${filename}`);
  } catch (err) {
    console.warn('Data export failed:', err);
    window.alert(`Export failed: ${err && err.message ? err.message : 'Unknown error'}`);
  }
}

async function handlePortableDataImport(file) {
  if (!file) return;
  try {
    const rawText = await file.text();
    const payload = await parsePortableImportEnvelope(rawText);
    const strategy = window.prompt('Import strategy: type "merge" to combine with local data, or "replace" to overwrite local data.', 'merge');
    const normalized = String(strategy || '').trim().toLowerCase();
    if (!normalized) return;
    if (normalized !== 'merge' && normalized !== 'replace') {
      window.alert('Import cancelled: strategy must be merge or replace.');
      return;
    }
    applyPortableImportData(payload, normalized);
    window.alert(`Import complete (${normalized}). Reloading to apply all restored state.`);
    window.location.reload();
  } catch (err) {
    console.warn('Data import failed:', err);
    window.alert(`Import failed: ${err && err.message ? err.message : 'Unknown error'}`);
  }
}

function updateLowInterruptionMode() {
  const on = Boolean(sessionSupportState.lowInterruption && sessionSupportState.sessionEndTs > Date.now());
  document.body.classList.toggle('low-interruption-active', on);
  if (on) {
    resetFlowHoldHud({ keepPausedHud: false });
    setShortcutsOpen(false);
    setNavigationMenuOpen(false);
  }
}

function getRemainingSessionMs() {
  return Math.max(0, Number(sessionSupportState.sessionEndTs || 0) - Date.now());
}

async function enterFullscreenForSession() {
  if (!sessionSupportState.fullscreenDuringSession) return;
  if (!document.documentElement?.requestFullscreen) return;
  if (document.fullscreenElement) return;
  try {
    await document.documentElement.requestFullscreen();
    sessionManagedFullscreen = true;
  } catch (err) {
    console.warn('Unable to enter fullscreen for session:', err);
  }
}

async function exitFullscreenForSession() {
  if (!sessionManagedFullscreen) return;
  if (!document.exitFullscreen) {
    sessionManagedFullscreen = false;
    return;
  }
  if (!document.fullscreenElement) {
    sessionManagedFullscreen = false;
    return;
  }
  try {
    await document.exitFullscreen();
  } catch (err) {
    console.warn('Unable to exit session fullscreen:', err);
  } finally {
    sessionManagedFullscreen = false;
  }
}

function getSessionsCompletedToday() {
  const sessions = Array.isArray(statsState.sessions) ? statsState.sessions : [];
  const todayKey = getIsoDay(Date.now());
  return sessions.reduce((count, session) => {
    const day = getIsoDay(Number(session.endedAt || session.startedAt || Date.now()));
    return count + (day === todayKey ? 1 : 0);
  }, 0);
}

function updateSessionMeta() {
  const meta = document.getElementById('sessionMeta');
  const remainingMs = getRemainingSessionMs();
  const timerOverlay = document.getElementById('sessionTimerOverlay');
  const timerValue = document.getElementById('sessionTimerValue');
  const chunkStatus = document.getElementById('chunkStatus');
  const lowInterruptionOn = Boolean(sessionSupportState.lowInterruption);
  if (remainingMs <= 0) {
    meta.textContent = `No active session. Sessions completed today: ${getSessionsCompletedToday()}.`;
    document.querySelectorAll('.session-btn').forEach(btn => btn.classList.remove('on'));
    timerOverlay.classList.remove('on');
    chunkStatus.classList.remove('with-timer');
    updateLowInterruptionMode();
    return;
  }
  const min = Math.floor(remainingMs / 60000);
  const sec = Math.floor((remainingMs % 60000) / 1000);
  const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  meta.textContent = `Session running • ${formatted} left • Completed today: ${getSessionsCompletedToday()}`;
  timerValue.textContent = formatted;
  timerOverlay.classList.toggle('on', !lowInterruptionOn);
  chunkStatus.classList.toggle('with-timer', !lowInterruptionOn);
}

function showSessionDonePopup(minutes) {
  const text = document.getElementById('sessionDoneText');
  const roundedMinutes = Math.max(1, Math.round(Number(minutes) || 0));
  text.textContent = `${roundedMinutes}-minute session complete. Continue when you're ready.`;
  document.getElementById('sessionDonePopup').classList.add('on');
}

function hideSessionDonePopup() {
  document.getElementById('sessionDonePopup').classList.remove('on');
}

function stopSessionTimer(clearSchedule = true, markCompleted = false) {
  const finishedMinutes = Math.max(0, Number(sessionSupportState.plannedDurationMin || sessionSupportState.durationMin || 0));
  const finishedAt = Date.now();
  if (sessionTick) {
    clearInterval(sessionTick);
    sessionTick = null;
  }
  if (markCompleted && finishedMinutes > 0) {
    showSessionDonePopup(finishedMinutes);
  }
  if (activeSessionRecord && finishedMinutes > 0) {
    const startedAt = Number(activeSessionRecord.startedAt) || (finishedAt - (finishedMinutes * 60000));
    const durationMin = Math.max(0.1, (finishedAt - startedAt) / 60000);
    const wordsReadEstimate = getAutoScrollWpmValue() * durationMin;
    persistSessionStat({
      startedAt,
      endedAt: finishedAt,
      durationMin,
      docId: activeSessionRecord.docId || getCurrentDocId(),
      mode: activeSessionRecord.mode || readingMode,
      wordsReadEstimate
    });
    activeSessionRecord = null;
  }
  if (clearSchedule) {
    sessionSupportState.sessionEndTs = 0;
    sessionSupportState.durationMin = 0;
    sessionSupportState.plannedDurationMin = 0;
    saveSessionSupportState();
    void exitFullscreenForSession();
  }
  updateSessionMeta();
  updateLowInterruptionMode();
}

function startSessionTimer(minutes, options = {}) {
  stopSessionTimer(false);
  hideSessionDonePopup();
  const now = Date.now();
  const resumedStartTs = Number(options?.startTs);
  const startedAt = Number.isFinite(resumedStartTs) && resumedStartTs > 0 ? resumedStartTs : now;
  const durationMinutes = Math.max(0, Number(minutes) || 0);
  const plannedDurationMinutes = Math.max(1, Math.round(Number(options?.plannedMinutes) || durationMinutes));
  sessionSupportState.durationMin = durationMinutes;
  sessionSupportState.plannedDurationMin = plannedDurationMinutes;
  sessionSupportState.sessionEndTs = now + (durationMinutes * 60 * 1000);
  saveSessionSupportState();
  activeSessionRecord = statsState.enabled
    ? {
      startedAt,
      docId: getCurrentDocId(),
      mode: readingMode
    }
    : null;
  updateSessionMeta();
  updateLowInterruptionMode();
  if (sessionSupportState.lowInterruption) {
    setSidebarOpen(false);
  }
  void enterFullscreenForSession();
  document.querySelectorAll('.session-btn').forEach(btn => {
    btn.classList.toggle('on', Number(btn.dataset.minutes) === plannedDurationMinutes);
  });
  sessionTick = setInterval(() => {
    const remaining = getRemainingSessionMs();
    if (remaining <= 0) {
      stopSessionTimer(true, true);
      updateProgressAndStatus();
      return;
    }
    updateSessionMeta();
    updateProgressAndStatus();
  }, 1000);
}
