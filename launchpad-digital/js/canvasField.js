/* canvasField.js — ties particles + interactions + effects to an
   actual <canvas>: resize handling, the render loop, drawing, pointer
   wiring, idle ambience, and section-driven visual intensity.
   Exposes window.LPD.CanvasField */
(function (utils, Particles, Interactions, Effects, ColorSystem) {
  let canvas, ctx, field, dpr = 1;
  let activeColorId = null;
  let sectionOpacity = 1, targetOpacity = 1;
  let lastTime = 0;
  let interactedOnce = false;
  let reducedMotion = false;
  let idleAccum = 0, idleInterval = utils.rand(6, 10);

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    field = new Particles.Field();

    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Effects.setReducedMotion(reducedMotion);

    resize();
    seedField();
    window.addEventListener('resize', resize);
    bindPointerEvents();
    requestAnimationFrame(loop);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (field) field.resize(w, h);
  }

  function seedField() {
    const isMobile = window.innerWidth < 720;
    const base = Math.floor((window.innerWidth * window.innerHeight) / (isMobile ? 18000 : 11000));
    field.seed(utils.clamp(base, isMobile ? 36 : 60, isMobile ? 70 : 130));
  }

  function setActiveColor(id) { activeColorId = id; }
  function setSectionOpacity(v) { targetOpacity = v; }
  function setLowLight(v) { Effects.setLowLight(v); }

  function bindPointerEvents() {
    window.addEventListener('mousemove', (e) => Interactions.setPointer(e.clientX, e.clientY));
    window.addEventListener('mouseleave', () => { Interactions.pointerLeave(); Effects.cancelBlackHole(); });
    window.addEventListener('mousedown', (e) => Interactions.pointerDown(e.clientX, e.clientY));
    window.addEventListener('mouseup', (e) => onPointerUp(e.clientX, e.clientY));

    window.addEventListener('touchstart', (e) => {
      const t = e.touches[0]; if (!t) return;
      Interactions.pointerDown(t.clientX, t.clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      const t = e.touches[0]; if (!t) return;
      Interactions.setPointer(t.clientX, t.clientY);
    }, { passive: true });
    window.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      onPointerUp(t ? t.clientX : Interactions.state.x, t ? t.clientY : Interactions.state.y);
    }, { passive: true });
    window.addEventListener('touchcancel', () => { Interactions.pointerUp(); Effects.cancelBlackHole(); }, { passive: true });
  }

  function onPointerUp(x, y) {
    const held = Interactions.pointerUp();
    interactedOnce = true;
    if (Effects.blackHole.active) { Effects.releaseBlackHole(field); return; }
    if (held < 180) energyPulse(x, y);
    else Effects.releaseMildGravity(field, x, y);
  }

  function energyPulse(x, y) {
    const rgb = activeColorId ? ColorSystem.byId[activeColorId].rgb : [76, 141, 255];
    Effects.spawnRing(x, y, rgb.join(','));
    const p = field.add(x, y, activeColorId, { vx: utils.rand(-1, 1), vy: utils.rand(-1, 1) });
    Effects.addEnergy(2.5);
    Effects.triggerChainReaction(field, p);
    if (!reducedMotion && Math.random() < 0.06) Effects.triggerMorph(field, x, y);
  }

  function colorRgbFor(p) { return p.colorId ? ColorSystem.byId[p.colorId].rgb : [150, 158, 176]; }

  function gradientStroke(x1, y1, x2, y2, rgbA, rgbB, alpha) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, `rgba(${rgbA.join(',')},${alpha})`);
    g.addColorStop(1, `rgba(${rgbB.join(',')},${alpha})`);
    return g;
  }

  function step(dt, now) {
    Interactions.update();

    if (Interactions.state.down && Interactions.state.holdDuration > 500) {
      Effects.chargeBlackHole(Interactions.state.x, Interactions.state.y, dt);
    }

    field.rebuildGrid();

    for (const p of field.particles) {
      Interactions.applyToParticle(p);
      Effects.applyBlackHoleForce(p);

      if (p.morphTX != null) {
        p.morphT = utils.clamp(p.morphT + dt * 1.6, 0, 1);
        p.x = utils.lerp(p.x, p.morphTX, 0.06);
        p.y = utils.lerp(p.y, p.morphTY, 0.06);
      } else {
        p.vx *= 0.965; p.vy *= 0.965;
        if (!reducedMotion) { p.vx += (Math.random() - 0.5) * 0.01; p.vy += (Math.random() - 0.5) * 0.01; }
        p.x += p.vx; p.y += p.vy;
      }

      if (p.x < 0 || p.x > field.w) p.vx *= -1;
      if (p.y < 0 || p.y > field.h) p.vy *= -1;
      p.x = utils.clamp(p.x, 0, field.w);
      p.y = utils.clamp(p.y, 0, field.h);

      if (p.charge > 0) p.charge = utils.clamp(p.charge - dt * 1.2, 0, 1);
    }

    if (!reducedMotion) Effects.decayEnergy(dt);

    // idle ambience: only once the visitor has interacted at least once,
    // so the very first impression stays calm rather than busy
    if (interactedOnce && !reducedMotion) {
      const sinceMove = now - Interactions.state.lastMoveTime;
      if (sinceMove > 4000) {
        idleAccum += dt;
        if (idleAccum > idleInterval) {
          idleAccum = 0; idleInterval = utils.rand(6, 10);
          const p = field.particles[Math.floor(Math.random() * field.particles.length)];
          if (p) Effects.spawnRing(p.x, p.y, colorRgbFor(p).join(','));
        }
      } else {
        idleAccum = 0;
      }

      const found = Effects.scanConstellations(field, now);
      if (found) {
        utils.showToast('CONSTELLATION DETECTED');
        Effects.spawnRing((found.a.x + found.b.x + found.c.x) / 3, (found.a.y + found.b.y + found.c.y) / 3, '155,107,255');
      }
    }

    sectionOpacity = utils.lerp(sectionOpacity, targetOpacity, 0.06);
  }

  function draw(now) {
    ctx.clearRect(0, 0, field.w, field.h);
    ctx.globalAlpha = sectionOpacity;

    for (const p of field.particles) {
      const neigh = field.neighbors(p);
      for (const n of neigh) {
        if (n === p) continue;
        if (p.x + p.y >= n.x + n.y) continue; // draw each pair exactly once
        const d2 = utils.dist2(p.x, p.y, n.x, n.y);
        if (d2 < field.connectDist2) drawConnection(p, n, d2);
      }
    }

    for (const p of field.particles) drawParticle(p);

    drawRings();
    drawBlackHole();
    drawLaunch();

    ctx.globalAlpha = 1;
  }

  function drawConnection(p, n, d2) {
    const d = Math.sqrt(d2);
    const alpha = utils.clamp((1 - d / field.connectDist) * 0.5, 0, 0.6);
    const rgbA = colorRgbFor(p), rgbB = colorRgbFor(n);

    if (p.colorId && n.colorId) {
      const mixed = ColorSystem.mix(p.colorId, n.colorId);
      if (mixed.isNew) {
        utils.showToast('NEW COLOR DISCOVERED — ' + mixed.name, { accent: mixed.rgb.join(',') });
        Effects.addEnergy(8);
        Effects.spawnRing((p.x + n.x) / 2, (p.y + n.y) / 2, mixed.rgb.join(','));
        if (window.LPD.UI && window.LPD.UI.onDiscovery) window.LPD.UI.onDiscovery(mixed.key);
      }
    }

    const src = Effects.blackHole.active ? Effects.blackHole : Interactions.state;
    const bend = Interactions.magneticBend(p.x, p.y, n.x, n.y, src.x, src.y, Effects.blackHole.active ? 26 : 14);

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(bend.x, bend.y, n.x, n.y);
    ctx.strokeStyle = gradientStroke(p.x, p.y, n.x, n.y, rgbA, rgbB, alpha);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawParticle(p) {
    const rgb = colorRgbFor(p);
    const r = p.baseR + (p.charge > 0 ? p.charge * 2 : 0);
    ctx.beginPath();
    ctx.fillStyle = `rgba(${rgb.join(',')},${p.colorId ? 0.95 : 0.75})`;
    ctx.arc(p.x, p.y, r, 0, utils.TAU);
    ctx.fill();
    if (p.colorId) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${rgb.join(',')},0.18)`;
      ctx.arc(p.x, p.y, r * 3, 0, utils.TAU);
      ctx.fill();
    }
  }

  function drawRings() {
    for (let i = Effects.rings.length - 1; i >= 0; i--) {
      const ring = Effects.rings[i];
      ring.r += 2.6;
      ring.alpha *= 0.955;
      if (ring.r > ring.maxR || ring.alpha < 0.02) { Effects.rings.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${ring.color},${ring.alpha})`;
      ctx.lineWidth = 1.4;
      ctx.arc(ring.x, ring.y, ring.r, 0, utils.TAU);
      ctx.stroke();
    }
  }

  function drawBlackHole() {
    const bh = Effects.blackHole;
    if (!bh.active) return;
    const r = 8 + bh.charge * 26;
    const grad = ctx.createRadialGradient(bh.x, bh.y, 0, bh.x, bh.y, r * 3);
    grad.addColorStop(0, `rgba(10,12,20,${0.6 + bh.charge * 0.3})`);
    grad.addColorStop(0.5, `rgba(76,141,255,${0.18 + bh.charge * 0.2})`);
    grad.addColorStop(1, 'rgba(76,141,255,0)');
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(bh.x, bh.y, r * 3, 0, utils.TAU);
    ctx.fill();
  }

  function drawLaunch() {
    if (!Effects.isLaunching()) return;
    const t = Effects.launchProgress();
    const cx = field.w / 2, cy = field.h * 0.6 - t * field.h * 0.9;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
    grad.addColorStop(0, `rgba(155,107,255,${0.5 * (1 - t * 0.4)})`);
    grad.addColorStop(1, 'rgba(76,141,255,0)');
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(cx, cy, 60, 0, utils.TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = `rgba(155,107,255,${0.5 * (1 - t)})`;
    ctx.lineWidth = 3;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + 120);
    ctx.stroke();
  }

  function loop(now) {
    const dt = Math.min((now - (lastTime || now)) / 1000, 0.05);
    lastTime = now;
    step(dt, now);
    draw(now);
    requestAnimationFrame(loop);
  }

  window.LPD = window.LPD || {};
  window.LPD.CanvasField = { init, setActiveColor, setSectionOpacity, setLowLight };
})(window.LPD.utils, window.LPD.Particles, window.LPD.Interactions, window.LPD.Effects, window.LPD.ColorSystem);
