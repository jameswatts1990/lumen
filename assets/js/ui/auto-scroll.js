/* ── Auto-scroll ── */
function toggleScroll() {
  scrolling = !scrolling;
  const btn = document.getElementById('scrollBtn');
  btn.textContent = scrolling ? '⏸' : '▶';
  btn.classList.toggle('on', scrolling);
  if (flowSpeedHud.classList.contains('on') || flowSpeedHud.classList.contains('paused')) {
    flowSpeedHud.classList.toggle('paused', !scrolling);
    flowHudState.textContent = scrolling ? 'Active' : 'Paused';
    updateFlowSpeedHudMetrics();
  }
  if (scrolling) startScroll(); else stopScroll();
}

function startScroll() {
  stopScroll();
  lastScrollTs = 0;
  scrollCarry = 0;
  const tick = (ts) => {
    if (!scrolling) return;
    if (!lastScrollTs) lastScrollTs = ts;
    const dt = Math.min(64, ts - lastScrollTs || 16);
    lastScrollTs = ts;
    const pxPerSecond = scrollSpeed * AUTO_SCROLL_BASE_PX_PER_SECOND;
    if (Math.abs(pxPerSecond) >= 0.01) {
      scrollCarry += pxPerSecond * (dt / 1000);
      const wholeStep = scrollCarry > 0 ? Math.floor(scrollCarry) : Math.ceil(scrollCarry);
      if (wholeStep !== 0) {
        reader.scrollBy(0, wholeStep);
        scrollCarry -= wholeStep;
      }
    }
    const atBottom = reader.scrollTop + reader.clientHeight >= reader.scrollHeight - 1;
    const atTop = reader.scrollTop <= 1;
    if ((pxPerSecond > 0 && atBottom) || (pxPerSecond < 0 && atTop)) {
      toggleScroll();
      return;
    }
    scrollRAF = requestAnimationFrame(tick);
  };
  scrollRAF = requestAnimationFrame(tick);
}
function stopScroll() {
  if (scrollRAF) cancelAnimationFrame(scrollRAF);
  scrollRAF = null;
  lastScrollTs = 0;
  scrollCarry = 0;
}

reader.addEventListener('mouseenter', () => { if (scrolling) stopScroll(); });
reader.addEventListener('mouseleave', () => { if (scrolling) startScroll(); });
reader.addEventListener('pointerdown', handleFlowGesturePointerDown);
reader.addEventListener('pointerup', e => {
  if (!isFlowGestureEnabled()) return;
  releaseFlowGestureHold(e.pointerId, 'pointer_up');
});
reader.addEventListener('pointercancel', e => {
  if (!isFlowGestureEnabled()) return;
  releaseFlowGestureHold(e.pointerId, 'pointer_cancel');
});
reader.addEventListener('pointerleave', e => {
  if (!isFlowGestureEnabled()) return;
  if (flowGestureState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE) return;
  releaseFlowGestureHold(e.pointerId, 'pointer_leave');
});
flowSpeedBackdrop?.addEventListener('pointerdown', handleFlowGesturePointerDown);
flowSpeedBackdrop?.addEventListener('pointerup', e => {
  if (!isFlowGestureEnabled()) return;
  releaseFlowGestureHold(e.pointerId, 'pointer_up_backdrop');
});
flowSpeedBackdrop?.addEventListener('pointercancel', e => {
  if (!isFlowGestureEnabled()) return;
  releaseFlowGestureHold(e.pointerId, 'pointer_cancel_backdrop');
});
flowLayer.addEventListener('pointerdown', e => {
  if (readingMode !== 'flow') return;
  if (flowGestureState !== FLOW_GESTURE_STATES.IDLE && flowGestureState !== FLOW_GESTURE_STATES.PAUSED_ON_RELEASE) return;
  ensureFlowSpeedReadWordNodes();
  const wordNode = e.target instanceof Element ? e.target.closest('.flow-speed-word') : null;
  if (!wordNode) return;
  setFlowWordSelection(wordNode);
});
flowLayer.addEventListener('pointermove', e => {
  if (readingMode !== 'flow') return;
  if (flowGestureState !== FLOW_GESTURE_STATES.IDLE && flowGestureState !== FLOW_GESTURE_STATES.PAUSED_ON_RELEASE) return;
  ensureFlowSpeedReadWordNodes();
  const wordNode = e.target instanceof Element ? e.target.closest('.flow-speed-word') : null;
  if (!wordNode) return;
  setFlowWordSelection(wordNode);
  scheduleFlowDefinition(wordNode);
});
flowLayer.addEventListener('pointerleave', () => {
  if (flowDefinitionDelayTimer) clearTimeout(flowDefinitionDelayTimer);
  clearFlowWordSelection();
  hideFlowDefinitionPopout();
});
document.addEventListener('pointerup', e => {
  if (!isFlowGestureEnabled()) return;
  if (flowGestureActivePointerId === null) return;
  releaseFlowGestureHold(e.pointerId, 'document_pointer_up');
});
window.addEventListener('blur', () => {
  if (!isFlowGestureEnabled()) return;
  if (flowGestureState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE) {
    releaseFlowGestureHold(flowGestureActivePointerId, 'window_blur');
  }
});
document.addEventListener('visibilitychange', () => {
  if (!isFlowGestureEnabled()) return;
  if (document.visibilityState === 'hidden' && flowGestureState === FLOW_GESTURE_STATES.SPEED_READ_ACTIVE) {
    releaseFlowGestureHold(flowGestureActivePointerId, 'visibility_hidden');
  }
});
