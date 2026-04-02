/* ── Slider wiring ── */
syncReadingModeControls();

function wire(id, valId, suffix, fmt, cb) {
  const sl = document.getElementById(id);
  const vl = document.getElementById(valId);
  function update() {
    const v = parseFloat(sl.value);
    vl.textContent = fmt ? fmt(v) : v + suffix;
    if (cb) cb(v);
  }
  sl.addEventListener('input', update);
  sl.addEventListener('change', update);
  update();
}

function chunkLengthLabel(value) {
  const rounded = Math.round(value);
  const unit = readingMode === 'flow' ? 'sentence' : 'line';
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
}

wire('widthR',  'widthV', '%', null, v => { maxW = Math.round(BASE_PAGE_WIDTH * (v / 100)); applyMaxWidth(); });
wire('briR',    'briV',   '%', null, () => applyFilters());
wire('conR',    'conV',   '%', null, () => applyFilters());
wire('gapR',    'gapV',   'px', null, v => { gap = v; applyGap(); });
wire('tsizeR',  'tsizeV', '%', null, () => applyReadingMode());
wire('lhR',     'lhV',    '',  v => v.toFixed(2), () => applyReadingMode());
wire('lsR',     'lsV',    'px', v => v.toFixed(2)+'px', () => applyReadingMode());
wire('wsR',     'wsV',    'px', v => v.toFixed(1)+'px', () => applyReadingMode());
wire('scrollSR','scrollSV','', v => `${v.toFixed(1)}x`, v => {
  scrollSpeed = uiAutoScrollSpeedToEffective(v);
  queueFlowSpeedReadTimingSync();
  syncAutoScrollWpmUi();
});
wire('focusR',  'focusV', '%', null, v => updateFocusVignette(v));
wire('focusDepthR', 'focusDepthV', 'px', null, v => updateFocusDepth(v));
wire('chunkR', 'chunkV', ' lines', v => chunkLengthLabel(v), () => {
  updateChunkOverlay();
  if (readingMode === 'flow' && (flowAutoSplitOn() || chunkModeOn())) {
    refreshFlowRenderForChunking();
  } else {
    updateFlowHighlight();
  }
});
wire('flowSplitLinesR', 'flowSplitLinesV', ' lines', v => `${Math.round(v)} line${Math.round(v) === 1 ? '' : 's'}`, () => {
  if (readingMode === 'flow' && (flowAutoSplitOn() || chunkModeOn())) {
    refreshFlowRenderForChunking();
  }
});
