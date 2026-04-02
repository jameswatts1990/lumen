/* ── Progress bar ── */
function updateCurrentPageStatus() {
  const totalPages = getTotalPages();
  if (!totalPages) {
    currentPage = 0;
    document.getElementById('statPages').textContent = 'No document';
    return;
  }
  if (readingMode === 'flow') {
    currentPage = 0;
    const kindLabel = pdf ? 'Flow document' : 'Flow text';
    document.getElementById('statPages').textContent = `${kindLabel} • ${totalPages} pages`;
    return;
  }
  const wraps = rInner.querySelectorAll('.page-wrap');
  if (!wraps.length) return;
  const viewportAnchor = reader.scrollTop + (reader.clientHeight * 0.35);
  let visiblePage = 1;
  for (const wrap of wraps) {
    if (wrap.offsetTop <= viewportAnchor) visiblePage = Number(wrap.dataset.p);
    else break;
  }
  currentPage = visiblePage;
  document.getElementById('statPages').textContent = `Page ${currentPage} / ${totalPages}`;
  document.getElementById('pageJumpIn').value = String(currentPage);
}

function updateProgress() {
  const scrollableHeight = reader.scrollHeight - reader.clientHeight;
  const pct = scrollableHeight > 0 ? (reader.scrollTop / scrollableHeight) * 100 : 0;
  const clampedPct = Math.min(100, Math.max(0, pct));
  document.getElementById('progFill').style.width = clampedPct.toFixed(1) + '%';
  const base = readingMode === 'flow'
    ? `Doc ${Math.round(clampedPct)}%`
    : `${Math.round(clampedPct)}%`;
  const remainingMs = getRemainingSessionMs();
  const sessionCue = remainingMs > 0 ? ` • ⏱ ${Math.ceil(remainingMs / 60000)}m` : '';
  document.getElementById('statScroll').textContent = `${base}${sessionCue}`;
  if (flowSpeedHud.classList.contains('on')) updateFlowSpeedHudMetrics();
}

function updateProgressAndStatus() {
  updateProgress();
  updateCurrentPageStatus();
}

reader.addEventListener('scroll', () => {
  updateProgressAndStatus();
  updateChunkOverlay();
  updateFlowHighlight();
  saveDocProgress();
});

function toggleProg() {
  document.getElementById('progBar').style.display =
    document.getElementById('progT').checked ? 'block' : 'none';
  updateProgressAndStatus();
}
