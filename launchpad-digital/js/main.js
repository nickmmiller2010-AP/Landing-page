/* main.js — wires the DOM to everything else: navigation, the mobile
   menu, the color palette / energy / discovered panel inside the
   Experience section, the low-light toggle, and the scroll-driven
   canvas intensity. Runs last, after every other module is loaded. */
(function (utils, ColorSystem, CanvasField) {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    const canvas = document.getElementById('lpd-canvas');
    if (canvas) CanvasField.init(canvas);

    setupPaletteAndDiscovery();
    setupEnergyMeter();
    setupNav();
    setupLowLightToggle();
    setupSectionObserver();
  });

  function setupPaletteAndDiscovery() {
    const paletteEl = document.getElementById('palette');
    const dotsEl = document.getElementById('discovered-dots');
    const countEl = document.getElementById('discovered-count');
    if (!paletteEl) return;

    let activeBtn = null;
    ColorSystem.PALETTE.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = c.hex;
      b.setAttribute('aria-label', c.name);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        if (activeBtn === b) {
          b.setAttribute('aria-pressed', 'false');
          activeBtn = null;
          CanvasField.setActiveColor(null);
          return;
        }
        if (activeBtn) activeBtn.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
        activeBtn = b;
        CanvasField.setActiveColor(c.id);
      });
      paletteEl.appendChild(b);
    });

    if (dotsEl) {
      ColorSystem.discoveries.forEach((d) => {
        const dot = document.createElement('span');
        dot.className = 'disc-dot';
        dot.dataset.key = d.key;
        dot.title = 'Undiscovered';
        dotsEl.appendChild(dot);
      });
    }
    function updateCount() {
      if (countEl) countEl.textContent = ColorSystem.discoveredCount() + ' / ' + ColorSystem.totalDiscoverable() + ' discovered';
    }
    updateCount();

    window.LPD.UI = window.LPD.UI || {};
    window.LPD.UI.onDiscovery = function (key) {
      if (!dotsEl) return;
      const dot = dotsEl.querySelector('[data-key="' + key + '"]');
      const entry = ColorSystem.discoveries.find((d) => d.key === key);
      if (dot && entry) {
        dot.classList.add('unlocked');
        dot.style.color = entry.hex;
        dot.title = entry.name;
      }
      updateCount();
    };
  }

  function setupEnergyMeter() {
    const fill = document.getElementById('energy-fill');
    const label = document.getElementById('energy-label');
    if (fill && label) window.LPD.Effects.bindEnergyUI(fill, label);
  }

  function setupNav() {
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');
    if (navToggle && navLinks) {
      navToggle.addEventListener('click', () => {
        const open = navLinks.classList.toggle('is-open');
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (navLinks && navLinks.classList.contains('is-open')) {
          navLinks.classList.remove('is-open');
          if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  function setupLowLightToggle() {
    const btn = document.getElementById('motion-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const on = document.body.classList.toggle('low-light');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      CanvasField.setLowLight(on);
    });
  }

  function setupSectionObserver() {
    const navAnchors = Array.from(document.querySelectorAll('.nav-links a'));
    const liveSections = ['home', 'experience'];
    const sections = Array.from(document.querySelectorAll('main .section'));
    if (!('IntersectionObserver' in window) || !sections.length) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        if (entry.isIntersecting) {
          const link = navAnchors.find((a) => a.getAttribute('href') === '#' + id);
          navAnchors.forEach((a) => a.classList.remove('is-active'));
          if (link) link.classList.add('is-active');
          CanvasField.setSectionOpacity(liveSections.includes(id) ? 1 : 0.22);
        }
      });
    }, { threshold: 0.5 });

    sections.forEach((s) => obs.observe(s));
  }
})(window.LPD.utils, window.LPD.ColorSystem, window.LPD.CanvasField);
