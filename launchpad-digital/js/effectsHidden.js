/* effectsHidden.js — the systems that sit on top of the base field:
   an energy meter, expanding pulse rings, chain reactions, a black-hole
   core event, the launch sequence, particle morphing, and a rare
   constellation-detection easter egg. None of these are required to
   enjoy the base field — they're discovered gradually.
   Exposes window.LPD.Effects */
(function (utils) {
  const { clamp, rand, dist, TAU } = utils;

  let energy = 0;
  let energyFillEl = null, energyLabelEl = null;
  let reducedMotion = false;
  let lowLight = false;

  const rings = [];
  function spawnRing(x, y, color) {
    rings.push({ x, y, r: 4, maxR: rand(90, 150), color: color || '76,141,255', alpha: 0.65 });
  }

  function bindEnergyUI(fillEl, labelEl) { energyFillEl = fillEl; energyLabelEl = labelEl; updateEnergyUI(); }
  function updateEnergyUI() {
    if (energyFillEl) energyFillEl.style.width = energy.toFixed(0) + '%';
    if (energyLabelEl) energyLabelEl.textContent = 'ENERGY ' + Math.round(energy) + '%';
  }
  function addEnergy(amount) {
    energy = clamp(energy + amount, 0, 100);
    updateEnergyUI();
    if (energy >= 100) { triggerLaunchSequence(); energy = 0; updateEnergyUI(); }
  }
  function decayEnergy(dt) { energy = clamp(energy - dt * 0.6, 0, 100); updateEnergyUI(); }
  function getEnergy() { return energy; }

  /* ---------------- Chain reaction ---------------- */
  function triggerChainReaction(field, originParticle) {
    if (reducedMotion) return;
    originParticle.charge = 1;
    let frontier = [originParticle];
    let depth = 0;
    const maxDepth = 5;
    function step() {
      if (depth >= maxDepth || !frontier.length) return;
      const next = [];
      for (const p of frontier) {
        const neigh = field.neighbors(p);
        let count = 0;
        for (const n of neigh) {
          if (n === p || n.charge > 0) continue;
          if (dist(p.x, p.y, n.x, n.y) < field.connectDist * 0.9) {
            n.charge = 1;
            spawnRing(n.x, n.y, '155,107,255');
            next.push(n);
            if (++count >= 3) break; // limit branching so it stays organic, not chaotic
          }
        }
      }
      frontier = next;
      depth++;
      if (frontier.length) setTimeout(step, 90);
    }
    setTimeout(step, 60);
    addEnergy(4);
  }

  /* ---------------- Black hole / core event ---------------- */
  const blackHole = { active: false, x: 0, y: 0, charge: 0 };
  function chargeBlackHole(x, y, dt) {
    blackHole.active = true; blackHole.x = x; blackHole.y = y;
    blackHole.charge = clamp(blackHole.charge + dt * 0.7, 0, 1);
  }
  function cancelBlackHole() { blackHole.active = false; blackHole.charge = 0; }
  function applyBlackHoleForce(p) {
    if (!blackHole.active) return;
    const dx = p.x - blackHole.x, dy = p.y - blackHole.y;
    const R = 200, d2 = dx * dx + dy * dy;
    if (d2 < R * R) {
      const d = Math.sqrt(d2) || 1;
      const f = (1 - d / R) * (0.4 + blackHole.charge * 1.4);
      p.vx -= (dx / d) * f;
      p.vy -= (dy / d) * f;
    }
  }
  function releaseBlackHole(field) {
    if (!blackHole.active) return;
    if (blackHole.charge > 0.8) {
      const bx = blackHole.x, by = blackHole.y;
      for (const p of field.particles) {
        const d = dist(p.x, p.y, bx, by);
        if (d < 220) {
          const ang = Math.atan2(p.y - by, p.x - bx);
          const f = (1 - d / 220) * 6;
          p.vx += Math.cos(ang) * f;
          p.vy += Math.sin(ang) * f;
        }
      }
      spawnRing(bx, by, '76,141,255');
      spawnRing(bx, by, '155,107,255');
      addEnergy(12);
      utils.showToast('CORE COLLAPSE — ENERGY BURST');
    } else if (blackHole.charge > 0.3) {
      releaseMildGravity(field, blackHole.x, blackHole.y);
    }
    cancelBlackHole();
  }

  /* mild release for a short hold (gravity mode, section 12 — always available,
     distinct from the longer, rarer black-hole collapse above) */
  function releaseMildGravity(field, x, y) {
    for (const p of field.particles) {
      const d = dist(p.x, p.y, x, y);
      if (d < 150) {
        const ang = Math.atan2(p.y - y, p.x - x);
        const f = (1 - d / 150) * 1.8;
        p.vx += Math.cos(ang) * f;
        p.vy += Math.sin(ang) * f;
      }
    }
    spawnRing(x, y, '76,141,255');
  }

  /* ---------------- Launch sequence ---------------- */
  let launching = false, launchStart = 0;
  function triggerLaunchSequence() {
    if (launching) return;
    launching = true;
    launchStart = performance.now();
    utils.showToast('LAUNCH SEQUENCE INITIATED', { duration: 2200 });
    setTimeout(() => { launching = false; }, 2600);
  }
  function isLaunching() { return launching; }
  function launchProgress() { return clamp((performance.now() - launchStart) / 2200, 0, 1); }

  /* ---------------- Particle morphing ---------------- */
  let morphing = false;
  function shapeLP(cx, cy, scale) {
    const pts = [];
    for (let i = 0; i < 10; i++) pts.push([cx - 90 * scale, cy - 70 * scale + i * 14 * scale]);
    for (let i = 0; i < 6; i++) pts.push([cx - 90 * scale + i * 12 * scale, cy + 66 * scale]);
    for (let i = 0; i < 10; i++) pts.push([cx - 10 * scale, cy - 70 * scale + i * 14 * scale]);
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i * (Math.PI / 7);
      pts.push([cx - 10 * scale + Math.cos(a) * 34 * scale, cy - 40 * scale + Math.sin(a) * 26 * scale]);
    }
    return pts;
  }
  function triggerMorph(field, cx, cy) {
    if (morphing || reducedMotion) return;
    morphing = true;
    const pts = shapeLP(cx, cy, 1);
    const pool = field.particles.slice()
      .sort((a, b) => dist(a.x, a.y, cx, cy) - dist(b.x, b.y, cx, cy))
      .slice(0, pts.length);
    pool.forEach((p, i) => { p.morphTX = pts[i][0]; p.morphTY = pts[i][1]; p.morphT = 0; });
    setTimeout(() => { pool.forEach((p) => { p.morphTX = null; p.morphTY = null; }); morphing = false; }, 3200);
  }

  /* ---------------- Constellation detection (rare easter egg) ---------------- */
  let lastConstellationCheck = 0;
  function scanConstellations(field, now) {
    if (reducedMotion) return null;
    if (now - lastConstellationCheck < 4000) return null;
    lastConstellationCheck = now;
    const pts = field.particles;
    if (pts.length < 12) return null;
    for (let tries = 0; tries < 40; tries++) {
      const a = pts[Math.floor(Math.random() * pts.length)];
      const an = field.neighbors(a).filter((n) => n !== a);
      if (an.length < 2) continue;
      const b = an[Math.floor(Math.random() * an.length)];
      const bn = field.neighbors(b).filter((n) => n !== a && n !== b);
      if (!bn.length) continue;
      const c = bn[Math.floor(Math.random() * bn.length)];
      const ab = dist(a.x, a.y, b.x, b.y), bc = dist(b.x, b.y, c.x, c.y), ca = dist(c.x, c.y, a.x, a.y);
      const avg = (ab + bc + ca) / 3;
      const tol = avg * 0.22;
      if (avg > 30 && avg < field.connectDist * 1.3 &&
          Math.abs(ab - avg) < tol && Math.abs(bc - avg) < tol && Math.abs(ca - avg) < tol) {
        return { a, b, c };
      }
    }
    return null;
  }

  function setReducedMotion(v) { reducedMotion = v; }
  function setLowLight(v) { lowLight = v; }

  window.LPD = window.LPD || {};
  window.LPD.Effects = {
    addEnergy, decayEnergy, bindEnergyUI, getEnergy,
    rings, spawnRing,
    triggerChainReaction,
    blackHole, chargeBlackHole, cancelBlackHole, applyBlackHoleForce, releaseBlackHole, releaseMildGravity,
    isLaunching, launchProgress, triggerLaunchSequence,
    triggerMorph,
    scanConstellations,
    setReducedMotion, setLowLight,
  };
})(window.LPD.utils);
