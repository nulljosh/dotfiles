// Footer band: the things in this repo as glyphs (the dot, the prompt, fish, Ghostty's ghost, Starship's star,
// a git branch, a folder), each rasterised once and redrawn as a halftone: one dot per grid cell, sized by how much
// of the glyph covers it. A faint dot field runs under the whole band. Plain 2D canvas, drawn once per size and theme.
(function () {
  var band = document.querySelector('.glyph-band'), canvas = band && band.querySelector('canvas');
  if (!canvas) return;

  // Each glyph is drawn white on a 100 unit square.
  var GLYPHS = [
    function dot(c) { c.beginPath(); c.arc(50, 50, 30, 0, 7); c.fill(); },
    function prompt(c) { c.beginPath(); c.moveTo(22, 14); c.lineTo(78, 50); c.lineTo(22, 86); c.lineTo(22, 66); c.lineTo(48, 50); c.lineTo(22, 34); c.closePath(); c.fill(); },
    function fish(c) {
      c.beginPath(); c.ellipse(44, 50, 34, 22, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(70, 50); c.lineTo(96, 28); c.lineTo(96, 72); c.closePath(); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(28, 44, 5, 0, 7); c.fill();
    },
    function ghost(c) {
      c.beginPath(); c.moveTo(18, 88); c.lineTo(18, 46); c.arc(50, 46, 32, Math.PI, 0); c.lineTo(82, 88);
      for (var i = 0; i < 4; i++) { var x = 82 - i * 16; c.lineTo(x - 8, 78); c.lineTo(x - 16, 88); }
      c.closePath(); c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.ellipse(38, 44, 6, 9, 0, 0, 7); c.ellipse(62, 44, 6, 9, 0, 0, 7); c.fill();
    },
    function star(c) {
      c.beginPath();
      for (var i = 0; i < 10; i++) { var r = i % 2 ? 17 : 40, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(50 + r * Math.cos(a), 54 + r * Math.sin(a)); }
      c.closePath(); c.fill();
    },
    function branch(c) {
      c.lineWidth = 9; c.lineCap = 'round'; c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(32, 26); c.lineTo(32, 74); c.stroke();
      c.beginPath(); c.moveTo(68, 34); c.bezierCurveTo(68, 58, 32, 50, 32, 66); c.stroke();
      [[32, 20], [32, 80], [68, 28]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 11, 0, 7); c.fill(); });
    },
    function folder(c) {
      c.beginPath(); c.moveTo(12, 28); c.lineTo(40, 28); c.lineTo(48, 36); c.lineTo(88, 36); c.lineTo(88, 80); c.lineTo(12, 80); c.closePath(); c.fill();
    }
  ];

  function draw() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = band.clientWidth, h = band.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    // Lay the glyphs out in one centred row, repeating the set until the band is full.
    var size = h * 0.72, pitch = size * 1.3, n = Math.max(GLYPHS.length, Math.ceil(w / pitch) + 1);
    var mask = document.createElement('canvas'); mask.width = w; mask.height = h;
    var m = mask.getContext('2d'), x0 = (w - (n - 1) * pitch) / 2;
    for (var i = 0; i < n; i++) {
      m.save(); m.translate(x0 + i * pitch - size / 2, (h - size) / 2); m.scale(size / 100, size / 100);
      m.fillStyle = '#fff'; m.globalCompositeOperation = 'source-over';
      var g = document.createElement('canvas'); g.width = g.height = 100;   // own layer, so a glyph's cut-outs stay inside it
      var gc = g.getContext('2d'); gc.fillStyle = '#fff'; GLYPHS[i % GLYPHS.length](gc);
      m.drawImage(g, 0, 0); m.restore();
    }
    var px = m.getImageData(0, 0, w, h).data;

    // Halftone: sample the mask at each cell centre; covered cells get a big dot, the rest a faint one.
    var step = Math.max(6, Math.round(h / 26)), r = step * 0.46;
    c.fillStyle = getComputedStyle(band).color;
    for (var y = step / 2; y < h; y += step) {
      for (var x = step / 2; x < w; x += step) {
        var a = px[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] / 255;
        c.globalAlpha = a > 0.05 ? 1 : 0.16;
        c.beginPath(); c.arc(x, y, a > 0.05 ? r * Math.max(0.35, a) : r * 0.32, 0, 7); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  var raf;
  function redraw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  window.addEventListener('resize', redraw);
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  redraw();
})();
