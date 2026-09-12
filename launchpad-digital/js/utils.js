/* utils.js — shared helpers used by every other module.
   Exposes window.LPD.utils */
(function () {
  window.LPD = window.LPD || {};

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function dist2(x1, y1, x2, y2) { const dx = x1 - x2, dy = y1 - y2; return dx * dx + dy * dy; }
  function dist(x1, y1, x2, y2) { return Math.sqrt(dist2(x1, y1, x2, y2)); }
  const TAU = Math.PI * 2;

  /* Uniform spatial grid so neighbor look-ups stay close to O(n)
     instead of the O(n^2) naive distance check. cellSize should be
     roughly the largest interaction radius you plan to query with. */
  class SpatialGrid {
    constructor(cellSize) {
      this.cellSize = cellSize;
      this.map = new Map();
    }
    key(cx, cy) { return cx + ',' + cy; }
    cellOf(x, y) { return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)]; }
    clear() { this.map.clear(); }
    insert(item, x, y) {
      const [cx, cy] = this.cellOf(x, y);
      const k = this.key(cx, cy);
      let arr = this.map.get(k);
      if (!arr) { arr = []; this.map.set(k, arr); }
      arr.push(item);
    }
    query(x, y) {
      const [cx, cy] = this.cellOf(x, y);
      const out = [];
      for (let ix = cx - 1; ix <= cx + 1; ix++) {
        for (let iy = cy - 1; iy <= cy + 1; iy++) {
          const arr = this.map.get(this.key(ix, iy));
          if (arr) out.push(...arr);
        }
      }
      return out;
    }
  }

  /* Small elegant toast, reused for every discovery / event message.
     Looks for #lpd-toast in the DOM; safe no-op if it isn't there yet. */
  function makeToast() {
    let el = null;
    let hideTimer = null;
    function ensure() {
      if (!el) el = document.getElementById('lpd-toast');
      return el;
    }
    return function showToast(message, opts) {
      opts = opts || {};
      const node = ensure();
      if (!node) return;
      node.textContent = message;
      if (opts.accent) node.style.setProperty('--toast-accent', opts.accent);
      node.classList.add('is-visible');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => node.classList.remove('is-visible'), opts.duration || 2600);
    };
  }

  window.LPD.utils = { clamp, lerp, rand, dist, dist2, TAU, SpatialGrid, showToast: makeToast() };
})();
