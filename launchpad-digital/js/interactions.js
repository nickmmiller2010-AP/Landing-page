/* interactions.js — everything about *reading* the pointer/touch and
   turning it into forces: repulsion, gravity mode, wave painting,
   and a magnetic-bend helper used when rendering connections.
   Exposes window.LPD.Interactions */
(function (utils) {
  const REPEL_RADIUS = 130, REPEL_RADIUS2 = REPEL_RADIUS * REPEL_RADIUS;
  const GRAVITY_RADIUS = 170, GRAVITY_RADIUS2 = GRAVITY_RADIUS * GRAVITY_RADIUS;
  const GRAVITY_DELAY = 160; // ms of holding before repulsion flips to attraction

  const state = {
    x: -9999, y: -9999,
    down: false,
    downStartTime: 0,
    holdDuration: 0,
    isGravity: false,
    lastMoveTime: 0,
    trail: [], // recent {x,y,t} points, for the wave-painting effect
  };

  function setPointer(x, y) {
    state.x = x; state.y = y;
    state.lastMoveTime = performance.now();
    state.trail.push({ x, y, t: state.lastMoveTime });
    const cutoff = state.lastMoveTime - 500;
    while (state.trail.length && state.trail[0].t < cutoff) state.trail.shift();
    if (state.trail.length > 40) state.trail.shift();
  }
  function pointerLeave() { state.x = -9999; state.y = -9999; state.trail.length = 0; state.down = false; }
  function pointerDown(x, y) { state.down = true; state.downStartTime = performance.now(); setPointer(x, y); }
  function pointerUp() {
    const held = performance.now() - state.downStartTime;
    state.down = false; state.isGravity = false;
    return held;
  }

  function update() {
    if (state.down) {
      state.holdDuration = performance.now() - state.downStartTime;
      state.isGravity = state.holdDuration > GRAVITY_DELAY;
    } else {
      state.holdDuration = 0;
    }
  }

  function applyToParticle(p) {
    if (state.x < -1000) return;
    const dx = p.x - state.x, dy = p.y - state.y;
    const d2 = dx * dx + dy * dy;

    if (state.down && state.isGravity) {
      if (d2 < GRAVITY_RADIUS2) {
        const d = Math.sqrt(d2) || 1;
        const f = (1 - d / GRAVITY_RADIUS) * 0.55;
        p.vx -= (dx / d) * f;
        p.vy -= (dy / d) * f;
      }
    } else if (d2 < REPEL_RADIUS2) {
      const d = Math.sqrt(d2) || 1;
      const f = (1 - d / REPEL_RADIUS) * 0.85;
      p.vx += (dx / d) * f;
      p.vy += (dy / d) * f;
    }

    // wave painting: a short-lived nudge from the recent drag trail
    for (let i = 0; i < state.trail.length; i++) {
      const tp = state.trail[i];
      const ddx = p.x - tp.x, ddy = p.y - tp.y;
      const dd2 = ddx * ddx + ddy * ddy;
      if (dd2 < 3600) {
        const dd = Math.sqrt(dd2) || 1;
        const age = (performance.now() - tp.t) / 500;
        const f = (1 - dd / 60) * (1 - age) * 0.35;
        if (f > 0) { p.vx += (ddx / dd) * f; p.vy += (ddy / dd) * f; }
      }
    }
  }

  /* Bends the midpoint of a line toward (or away from) a source point,
     so connections near the cursor / black hole read as a magnetic field
     rather than plain straight lines. */
  function magneticBend(x1, y1, x2, y2, sourceX, sourceY, strength) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = mx - sourceX, dy = my - sourceY;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const maxD = 160;
    if (d > maxD) return { x: mx, y: my };
    const pull = (1 - d / maxD) * strength;
    return { x: mx - (dx / d) * pull, y: my - (dy / d) * pull };
  }

  window.LPD = window.LPD || {};
  window.LPD.Interactions = { state, setPointer, pointerLeave, pointerDown, pointerUp, update, applyToParticle, magneticBend };
})(window.LPD.utils);
