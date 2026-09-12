/* particles.js — the particle engine: a single Particle model and
   a Field that owns the array + spatial grid.
   Exposes window.LPD.Particles */
(function (utils) {
  const { rand, SpatialGrid } = utils;

  class Particle {
    constructor(x, y, colorId) {
      this.x = x; this.y = y;
      this.vx = rand(-0.25, 0.25);
      this.vy = rand(-0.25, 0.25);
      this.baseR = rand(1.4, 3.0);
      this.r = this.baseR;
      this.colorId = colorId || null; // null = neutral ambient particle
      this.charge = 0;                // decaying highlight used by chain reactions
      this.morphTX = null;            // active morph target, if any
      this.morphTY = null;
      this.morphT = 0;
    }
  }

  class Field {
    constructor() {
      this.particles = [];
      this.grid = new SpatialGrid(160); // covers our largest interaction radius in one 3x3 sweep
      this.connectDist = 118;
      this.connectDist2 = this.connectDist * this.connectDist;
      this.w = 0; this.h = 0;
      this.maxParticles = 230;
    }
    resize(w, h) { this.w = w; this.h = h; }
    seed(count) {
      this.particles.length = 0;
      for (let i = 0; i < count; i++) this.particles.push(new Particle(rand(0, this.w), rand(0, this.h), null));
    }
    add(x, y, colorId, opts) {
      opts = opts || {};
      const p = new Particle(x, y, colorId);
      if (opts.vx !== undefined) p.vx = opts.vx;
      if (opts.vy !== undefined) p.vy = opts.vy;
      this.particles.push(p);
      if (this.particles.length > this.maxParticles) {
        this.particles.splice(0, this.particles.length - this.maxParticles);
      }
      return p;
    }
    rebuildGrid() {
      this.grid.clear();
      for (const p of this.particles) this.grid.insert(p, p.x, p.y);
    }
    neighbors(p) { return this.grid.query(p.x, p.y); }
  }

  window.LPD = window.LPD || {};
  window.LPD.Particles = { Particle, Field };
})(window.LPD.utils);
