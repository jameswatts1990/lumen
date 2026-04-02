/* ── Tint ── */
function updateTint() {
  const v = parseInt(document.getElementById('tintR').value);
  const el = document.getElementById('tintLay');
  document.getElementById('tintV').textContent = v === 0 ? 'Off' : v + '%';
  if (v === 0) { el.classList.remove('on'); }
  else { el.classList.add('on'); el.style.background = `rgba(255,120,0,${(v/100)*0.38})`; }
}
