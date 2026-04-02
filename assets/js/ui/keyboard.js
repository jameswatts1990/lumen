/* ── Keyboard shortcuts ── */
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName ? el.tagName.toLowerCase() : '';
  if (tag === 'textarea' || tag === 'select' || el.isContentEditable) return true;
  if (tag !== 'input') return false;
  const type = (el.getAttribute('type') || '').toLowerCase();
  if (!type) return true;
  return ['text', 'search', 'url', 'tel', 'email', 'password', 'number'].includes(type);
}

function stepRange(id, dir) {
  const el = document.getElementById(id);
  if (!el) return;
  const step = Number(el.step) || 1;
  const min = Number(el.min);
  const max = Number(el.max);
  const next = Number(el.value) + (step * dir);
  const clamped = Math.min(max, Math.max(min, next));
  if (clamped === Number(el.value)) return;
  el.value = String(clamped);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function setToggleAndRun(id, fn) {
  const toggle = document.getElementById(id);
  if (!toggle || toggle.disabled) return;
  toggle.checked = !toggle.checked;
  fn();
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const dialogTriggers = { shortcuts: null, nav: null };

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null);
}

function focusFirstActionable(container) {
  const focusable = getFocusableElements(container);
  if (!focusable.length) return;
  focusable[0].focus();
}

function restoreTriggerFocus(trigger) {
  if (!trigger || !trigger.isConnected || typeof trigger.focus !== 'function') return;
  trigger.focus();
}

function setShortcutsOpen(open, trigger = null) {
  const overlay = document.getElementById('shortcutsOverlay');
  const btn = document.getElementById('shortcutHintBtn');
  const controlsMatch = btn.getAttribute('aria-controls') === overlay.id;
  if (open) dialogTriggers.shortcuts = trigger || document.activeElement;
  overlay.classList.toggle('on', open);
  overlay.setAttribute('aria-hidden', String(!open));
  if (controlsMatch) btn.setAttribute('aria-expanded', String(open));
  if (open) {
    focusFirstActionable(overlay);
  } else {
    restoreTriggerFocus(dialogTriggers.shortcuts);
    dialogTriggers.shortcuts = null;
  }
}

function toggleShortcutsPanel(trigger = null) {
  const overlay = document.getElementById('shortcutsOverlay');
  setShortcutsOpen(!overlay.classList.contains('on'), trigger);
}

function setNavigationMenuOpen(open, trigger = null) {
  const pop = document.getElementById('navPopout');
  const btn = document.getElementById('navFabBtn');
  const controlsMatch = btn.getAttribute('aria-controls') === pop.id;
  if (open) dialogTriggers.nav = trigger || document.activeElement;
  pop.classList.toggle('on', open);
  pop.setAttribute('aria-hidden', String(!open));
  btn.classList.toggle('on', open);
  if (controlsMatch) btn.setAttribute('aria-expanded', String(open));
  if (open) {
    focusFirstActionable(pop);
  } else {
    restoreTriggerFocus(dialogTriggers.nav);
    dialogTriggers.nav = null;
  }
}

function toggleNavigationMenu(trigger = null) {
  const pop = document.getElementById('navPopout');
  setNavigationMenuOpen(!pop.classList.contains('on'), trigger);
}

function updateSidebarCursorGlow(event) {
  if (!sidebarPanel || !supportsFinePointer) return;
  const rect = sidebarPanel.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  sidebarPanel.style.setProperty('--sidebar-glow-x', `${Math.max(0, Math.min(100, x)).toFixed(2)}%`);
  sidebarPanel.style.setProperty('--sidebar-glow-y', `${Math.max(0, Math.min(100, y)).toFixed(2)}%`);
}

if (sidebarPanel && supportsFinePointer) {
  sidebarPanel.addEventListener('pointerenter', event => {
    sidebarPanel.classList.add('is-cursor-glow');
    updateSidebarCursorGlow(event);
  });
  sidebarPanel.addEventListener('pointermove', updateSidebarCursorGlow);
  sidebarPanel.addEventListener('pointerleave', () => {
    sidebarPanel.classList.remove('is-cursor-glow');
  });
}

document.getElementById('shortcutHintBtn').addEventListener('click', e => setShortcutsOpen(true, e.currentTarget));
document.getElementById('closeShortcutsBtn').addEventListener('click', () => setShortcutsOpen(false));
document.getElementById('shortcutsOverlay').addEventListener('click', e => {
  if (e.target.id === 'shortcutsOverlay') setShortcutsOpen(false);
});
document.getElementById('navFabBtn').addEventListener('click', e => toggleNavigationMenu(e.currentTarget));
document.getElementById('sidebarToggleBtn').addEventListener('click', () => setSidebarOpen(!sidebarOpen));
document.getElementById('sidebarBackdrop').addEventListener('click', () => {
  if (mobileViewport && sidebarOpen) setSidebarOpen(false);
});
document.addEventListener('click', e => {
  const pop = document.getElementById('navPopout');
  const btn = document.getElementById('navFabBtn');
  if (!pop.classList.contains('on')) return;
  if (pop.contains(e.target) || btn.contains(e.target)) return;
  setNavigationMenuOpen(false);
});

document.addEventListener('keydown', e => {
  if (e.repeat || e.defaultPrevented) return;
  if (e.key === 'Escape' && flowGestureState !== FLOW_GESTURE_STATES.IDLE) {
    e.preventDefault();
    exitFlowSpeedReadMode('keyboard_escape');
    return;
  }
  const shortcutsOverlay = document.getElementById('shortcutsOverlay');
  const navPopout = document.getElementById('navPopout');
  const overlayOpen = shortcutsOverlay.classList.contains('on');
  const navOpen = navPopout.classList.contains('on');
  if (e.key === 'Tab' && (overlayOpen || navOpen)) {
    const activeDialog = overlayOpen ? shortcutsOverlay : navPopout;
    const focusable = getFocusableElements(activeDialog);
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  const isQuestionMark = e.key === '?' || (e.key === '/' && e.shiftKey);
  if (isQuestionMark) {
    e.preventDefault();
    toggleShortcutsPanel(document.activeElement);
    return;
  }
  if (overlayOpen && e.key === 'Escape') {
    e.preventDefault();
    setShortcutsOpen(false);
    return;
  }
  if (navOpen && e.key === 'Escape') {
    e.preventDefault();
    setNavigationMenuOpen(false);
    return;
  }
  if (mobileViewport && sidebarOpen && e.key === 'Escape') {
    e.preventDefault();
    setSidebarOpen(false);
    return;
  }
  if (isTypingTarget(document.activeElement)) return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      toggleScroll();
      break;
    case 'r':
    case 'R':
      e.preventDefault();
      setToggleAndRun('rulerT', toggleRuler);
      break;
    case 'f':
    case 'F':
      e.preventDefault();
      setToggleAndRun('focusT', toggleFocus);
      break;
    case 'p':
    case 'P':
      e.preventDefault();
      setToggleAndRun('progT', toggleProg);
      break;
    case 's':
    case 'S':
      if (!isFlowGestureEnabled()) break;
      e.preventDefault();
      if (flowGestureState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE) {
        pauseFlowSpeedRead('keyboard_toggle');
      } else if (flowGestureState === FLOW_GESTURE_STATES.PAUSED_ON_RELEASE) {
        activateFlowSpeedRead('keyboard_resume', { preserveIndex: true });
      } else if (flowGestureState === FLOW_GESTURE_STATES.IDLE) {
        activateFlowSpeedRead('keyboard_start');
      }
      break;
    case '-':
      e.preventDefault();
      stepRange('widthR', -1);
      break;
    case '=':
      e.preventDefault();
      stepRange('widthR', 1);
      break;
    default:
      break;
  }
});

document.querySelectorAll('.session-btn').forEach(btn => {
  btn.addEventListener('click', () => startSessionTimer(Number(btn.dataset.minutes)));
});
document.querySelectorAll('.session-done-restart').forEach(btn => {
  btn.addEventListener('click', () => {
    const minutes = Number(btn.dataset.minutes) || 5;
    startSessionTimer(minutes, { plannedMinutes: minutes });
  });
});
document.getElementById('lowInterruptT').addEventListener('change', e => {
  sessionSupportState.lowInterruption = e.target.checked;
  saveSessionSupportState();
  updateSessionMeta();
  updateLowInterruptionMode();
});
document.getElementById('sessionFullscreenT').addEventListener('change', e => {
  sessionSupportState.fullscreenDuringSession = e.target.checked;
  saveSessionSupportState();
  if (!sessionSupportState.fullscreenDuringSession) {
    void exitFullscreenForSession();
    return;
  }
  if (getRemainingSessionMs() > 0) {
    void enterFullscreenForSession();
  }
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    sessionManagedFullscreen = false;
  }
});
document.getElementById('sessionInsightsToggle').addEventListener('click', () => {
  sessionSupportState.insightsCollapsed = !sessionSupportState.insightsCollapsed;
  saveSessionSupportState();
  applySessionInsightsCollapsedState();
});
document.getElementById('sessionDoneDismissBtn').addEventListener('click', () => hideSessionDonePopup());
document.getElementById('statsCollectT').addEventListener('change', e => {
  statsState.enabled = e.target.checked;
  if (!statsState.enabled) activeSessionRecord = null;
  saveStatsState();
  renderReadingInsights();
});
document.getElementById('deleteStatsBtn').addEventListener('click', () => {
  const shouldDelete = window.confirm('Delete all saved reading stats from this device? This cannot be undone.');
  if (!shouldDelete) return;
  deleteAllStats();
});
document.getElementById('chunkRecoverBtn').addEventListener('click', async () => {
  const { previous } = getChunkMemoryForCurrentDoc();
  if (!previous) return;
  await restoreChunkSnapshot(previous, { asRecovery: true });
});
document.getElementById('resumeRestoreBtn').addEventListener('click', () => restoreSavedPosition());
document.getElementById('resumeDismissBtn').addEventListener('click', () => {
  pendingResumeState = null;
  refreshResumeCard();
});
document.getElementById('exportDataBtn').addEventListener('click', () => {
  handlePortableDataExport();
});
document.getElementById('importDataBtn').addEventListener('click', () => {
  document.getElementById('importDataFileIn').click();
});
document.getElementById('importDataFileIn').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  await handlePortableDataImport(file);
});
document.getElementById('resetDocBtn').addEventListener('click', async () => {
  await clearActivePersistedDocumentState();
  const docId = getCurrentDocId();
  if (docId) {
    const map = loadDocProgressMap();
    if (map[docId]) {
      delete map[docId];
      saveDocProgressMap(map);
    }
  }
  resetLoadedDocumentUI();
});
