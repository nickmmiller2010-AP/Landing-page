/* colorSystem.js — the 8 primary colors, deterministic mixing,
   and the "discovered combination" tracking used by the field.
   Exposes window.LPD.ColorSystem */
(function (utils) {
  const PALETTE = [
    { id: 'blue',   name: 'Blue',   hex: '#4C8DFF', rgb: [76, 141, 255] },
    { id: 'purple', name: 'Purple', hex: '#9B6BFF', rgb: [155, 107, 255] },
    { id: 'yellow', name: 'Yellow', hex: '#F2C94C', rgb: [242, 201, 76] },
    { id: 'red',    name: 'Red',    hex: '#E85D5D', rgb: [232, 93, 93] },
    { id: 'green',  name: 'Green',  hex: '#4CD9A0', rgb: [76, 217, 160] },
    { id: 'orange', name: 'Orange', hex: '#F2994A', rgb: [242, 153, 74] },
    { id: 'pink',   name: 'Pink',   hex: '#F072B6', rgb: [240, 114, 182] },
    { id: 'white',  name: 'White',  hex: '#EDEDED', rgb: [237, 237, 237] },
  ];
  const byId = {};
  PALETTE.forEach((c) => (byId[c.id] = c));

  function rgbToHex(rgb) {
    return '#' + rgb.map((v) => utils.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }

  /* Curated, named combinations. Any pair not listed here still mixes
     (a plain RGB blend) but doesn't count as a "discovery" — this keeps
     the discovery panel meaningful instead of listing all 28 pairs. */
  const DISCOVERIES = {};
  const discoveryList = [];
  function addDiscovery(a, b, name, rgb) {
    const key = [a, b].sort().join('|');
    const entry = { key, name, rgb, hex: rgbToHex(rgb), a, b };
    DISCOVERIES[key] = entry;
    discoveryList.push(entry);
  }

  addDiscovery('blue', 'yellow', 'Emerald Signal', [70, 214, 150]);
  addDiscovery('red', 'yellow', 'Solar Flare', [240, 150, 60]);
  addDiscovery('red', 'blue', 'Nebula', [150, 100, 220]);
  addDiscovery('blue', 'white', 'Ice Current', [140, 210, 240]);
  addDiscovery('red', 'white', 'Aurora Blush', [240, 150, 170]);
  addDiscovery('purple', 'orange', 'Twilight Ember', [200, 120, 150]);
  addDiscovery('green', 'purple', 'Teal Drift', [90, 190, 180]);
  addDiscovery('pink', 'blue', 'Magenta Pulse', [170, 110, 220]);
  addDiscovery('orange', 'green', 'Amber Field', [190, 190, 90]);
  addDiscovery('white', 'purple', 'Lavender Mist', [210, 190, 240]);
  addDiscovery('yellow', 'pink', 'Peach Glow', [245, 180, 140]);

  const discovered = new Set();

  function averageRgb(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }

  /* Deterministic: same pair always yields the same color.
     Returns { rgb, name, isNew, key } */
  function mix(idA, idB) {
    if (idA === idB) return { rgb: byId[idA].rgb, name: byId[idA].name, isNew: false, key: null };
    const key = [idA, idB].sort().join('|');
    const found = DISCOVERIES[key];
    if (found) {
      const isNew = !discovered.has(key);
      if (isNew) discovered.add(key);
      return { rgb: found.rgb, name: found.name, isNew, key };
    }
    return { rgb: averageRgb(byId[idA].rgb, byId[idB].rgb), name: null, isNew: false, key: null };
  }

  function totalDiscoverable() { return discoveryList.length; }
  function discoveredCount() { return discovered.size; }
  function randomId() { return PALETTE[Math.floor(Math.random() * PALETTE.length)].id; }

  window.LPD = window.LPD || {};
  window.LPD.ColorSystem = {
    PALETTE, byId, mix, totalDiscoverable, discoveredCount, discovered,
    discoveries: discoveryList, randomId, rgbToHex,
  };
})(window.LPD.utils);
