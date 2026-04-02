/* ── Flow hold HUD ── */
function flowModeActiveForHoldHud() {
  return readingMode === 'flow' && !document.body.classList.contains('low-interruption-active');
}

function getFlowHudProgressPercent() {
  const scrollableHeight = reader.scrollHeight - reader.clientHeight;
  if (scrollableHeight <= 0) return 0;
  return Math.min(100, Math.max(0, (reader.scrollTop / scrollableHeight) * 100));
}

function updateFlowSpeedHudMetrics() {
  flowHudWpm.textContent = String(getAutoScrollWpmValue());
  flowHudProgress.textContent = `${Math.round(getFlowHudProgressPercent())}%`;
}

function stopFlowHoldRaf() {
  if (!flowHoldState.holdRaf) return;
  cancelAnimationFrame(flowHoldState.holdRaf);
  flowHoldState.holdRaf = null;
}

function setFlowHudPaused() {
  if (!flowSpeedHud.classList.contains('on')) return;
  flowSpeedHud.classList.add('paused');
  flowHudState.textContent = 'Paused';
  updateFlowSpeedHudMetrics();
}

function resetFlowHoldHud({ keepPausedHud = true } = {}) {
  stopFlowHoldRaf();
  flowHoldState.active = false;
  flowHoldState.pointerId = null;
  flowHoldState.holdStartedTs = 0;
  flowHoldTimer.classList.remove('on');
  if (!keepPausedHud) {
    flowSpeedHud.classList.remove('on', 'paused');
    flowHudState.textContent = 'Ready';
  }
}

function tickFlowHoldHud(ts) {
  if (!flowHoldState.active) return;
  if (!flowHoldState.holdStartedTs) flowHoldState.holdStartedTs = ts;
  const elapsed = ts - flowHoldState.holdStartedTs;
  if (elapsed >= FLOW_HOLD_TIMER_THRESHOLD_MS) {
    flowHoldTimer.classList.add('on');
    flowHoldTimer.textContent = `Hold · ${(elapsed / 1000).toFixed(1)}s`;
  }
  if (elapsed >= FLOW_HUD_THRESHOLD_MS) {
    flowSpeedHud.classList.add('on');
    flowSpeedHud.classList.remove('paused');
    flowHudState.textContent = scrolling ? 'Active' : 'Ready';
    updateFlowSpeedHudMetrics();
  }
  flowHoldState.holdRaf = requestAnimationFrame(tickFlowHoldHud);
}

function beginFlowHoldHud(pointerId) {
  if (!flowModeActiveForHoldHud()) return;
  resetFlowHoldHud({ keepPausedHud: true });
  flowHoldState.active = true;
  flowHoldState.pointerId = pointerId;
  flowHoldState.holdRaf = requestAnimationFrame(tickFlowHoldHud);
}

function endFlowHoldHud(pointerId = null) {
  if (!flowHoldState.active) return;
  if (pointerId !== null && flowHoldState.pointerId !== null && pointerId !== flowHoldState.pointerId) return;
  const keepPausedHud = flowSpeedHud.classList.contains('on');
  resetFlowHoldHud({ keepPausedHud });
  setFlowHudPaused();
}
