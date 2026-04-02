/* ── Focus mode ── */
function updateFocusVignette(v) {
  const alpha = Math.max(0, Math.min(0.9, v / 100));
  document.getElementById('focTop').style.background =
    `linear-gradient(to bottom, rgba(0,0,0,${alpha.toFixed(2)}), transparent)`;
  document.getElementById('focBot').style.background =
    `linear-gradient(to top, rgba(0,0,0,${alpha.toFixed(2)}), transparent)`;
}

function updateFocusDepth(v) {
  focusDepth = Math.max(80, Math.min(420, Number(v)));
  document.getElementById('focTop').style.height = `${focusDepth}px`;
  document.getElementById('focBot').style.height = `${focusDepth}px`;
}

function toggleFocus() {
  const on = document.getElementById('focusT').checked;
  document.querySelectorAll('.focus-group').forEach(el => el.classList.toggle('collapsed', !on));
  document.getElementById('focTop').classList.toggle('on', on);
  document.getElementById('focBot').classList.toggle('on', on);
}
