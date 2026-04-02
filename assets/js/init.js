/* ── Init ── */
document.getElementById('tintR').addEventListener('input', updateTint);
scrollWpmInput?.addEventListener('change', e => {
  const next = Number(e.target.value);
  if (!Number.isFinite(next)) {
    syncAutoScrollWpmUi();
    return;
  }
  setAutoScrollWpm(next);
});
scrollWpmInput?.addEventListener('blur', () => syncAutoScrollWpmUi());
window.addEventListener('resize', () => {
  syncSidebarForViewport();
  updateProgressAndStatus();
  updateChunkOverlay();
  syncFlowWordRendererPlacement();
});
syncSidebarForViewport();
initSidebarSectionToggles();
enhanceEvidenceBadges();
toggleProg();
syncAutoScrollWpmUi();
syncFlowWordRendererPlacement();
updateTint();
updateFocusDepth(focusDepth);
setPageJumpAvailability(false);
renderOutlineFallback('Load a PDF to view navigation links.');
document.getElementById('urlLoadBtn').addEventListener('click', loadFromUrl);
document.getElementById('urlIn').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadFromUrl();
});

document.getElementById('pageJumpBtn').addEventListener('click', () => {
  goToPage(document.getElementById('pageJumpIn').value);
});
document.getElementById('pageJumpIn').addEventListener('keydown', e => {
  if (e.key === 'Enter') goToPage(e.target.value);
});
document.getElementById('pageUpBtn').addEventListener('click', () => navigatePage(-1));
document.getElementById('pageDownBtn').addEventListener('click', () => navigatePage(1));
document.getElementById('scrollTopBtn').addEventListener('click', () => goToDocumentEdge('top'));
document.getElementById('scrollBottomBtn').addEventListener('click', () => goToDocumentEdge('bottom'));

document.getElementById('emailOrderSel').addEventListener('change', e => {
  setEmailThreadOrder(e.target.value, { rerender: true, persist: true });
});
document.querySelectorAll('.pbtn[data-email-order]').forEach(btn => {
  btn.addEventListener('click', () => setEmailThreadOrder(btn.dataset.emailOrder, { rerender: true, persist: true }));
});
document.querySelectorAll('input[name="readingMode"]').forEach(input => {
  input.addEventListener('change', async e => {
    if (!e.target.checked) return;
    setReadingMode(e.target.value);
    await applyReadingMode();
  });
});
document.addEventListener('keydown', e => {
  if (!chunkModeOn()) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
  if (e.key === 'j' || e.key === 'J') {
    e.preventDefault();
    stepChunk(1);
  }
  if (e.key === 'k' || e.key === 'K') {
    e.preventDefault();
    stepChunk(-1);
  }
});

/* ── Profile system init ── */
const persistedSettings = loadSettings();
loadSessionSupportState();
setRecentDocSortMode(getRecentDocSortMode());
loadStatsState();
syncRecentDocListFromStorage();
renderRecentDocList();
updateChunkRecoverButton();
loadProfilesState();
refreshProfileSelect();
document.getElementById('profileSel').addEventListener('change', e => useProfile(e.target.value));
document.getElementById('resetProfileBtn').addEventListener('click', handleResetProfileDefaults);
document.getElementById('compareProfileBtn').addEventListener('click', toggleCompareProfile);
document.getElementById('saveProfileBtn').addEventListener('click', handleSaveProfile);
document.getElementById('deleteProfileBtn').addEventListener('click', handleDeleteProfile);
useProfile(lastUsedProfileId);
document.getElementById('lowInterruptT').checked = Boolean(sessionSupportState.lowInterruption);
document.getElementById('sessionFullscreenT').checked = Boolean(sessionSupportState.fullscreenDuringSession);
document.getElementById('statsCollectT').checked = Boolean(statsState.enabled);
applySessionInsightsCollapsedState();
renderReadingInsights();
if (sessionSupportState.sessionEndTs > Date.now() && sessionSupportState.durationMin) {
  const resumeMinutes = getRemainingSessionMs() / 60000;
  const plannedMinutes = Math.max(1, Math.round(Number(sessionSupportState.plannedDurationMin || sessionSupportState.durationMin) || resumeMinutes));
  const inferredStartTs = Number(sessionSupportState.sessionEndTs) - (plannedMinutes * 60000);
  startSessionTimer(resumeMinutes, { startTs: inferredStartTs, plannedMinutes });
} else {
  stopSessionTimer();
}
refreshResumeCard();
ensureCriticalFontsReady().then(() => {
  if (readingMode !== 'pdf') updateStyles();
});
registerSettingsPersistence();
if (persistedSettings.readingMode) {
  setReadingMode(persistedSettings.readingMode);
  applyReadingMode();
}
if (persistedSettings.settings) {
  applySettings(persistedSettings.settings);
}
restorePersistedDocument();
refreshEmailThreadOrderControls();
toggleChunkMode();
document.getElementById('recentDocSortSel')?.addEventListener('change', (event) => {
  setRecentDocSortMode(event.target.value);
  renderRecentDocList();
});
