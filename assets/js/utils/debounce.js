/* ── Debounce ── */
const _dts = {};
function debounce(fn, ms) {
  return (...a) => { clearTimeout(_dts[fn]); _dts[fn] = setTimeout(() => fn(...a), ms); };
}
