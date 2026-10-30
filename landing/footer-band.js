// Footer band: the things in this repo as glyphs (the dot, the prompt and its cursor, fish, Ghostty's ghost,
// Starship's star, a git branch, a folder), rasterised once per size and theme and redrawn as a halftone: one dot per
// grid cell, sized by how much of the glyph covers it, in the four prompt segment colours from the page's theme.
// It lives a little: the cursor blinks, a slow swell runs along the row, and the faint field twinkles.
// Still under reduced motion; the loop only runs while the band is on screen.
(function () {
  var band = document.querySelector('.glyph-band'), canvas = band && band.querySelector('canvas');
  if (!canvas) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Each glyph is drawn white on a 100 unit square.
  var GLYPHS = [
    function dot(c) { c.beginPath(); c.arc(50, 50, 30, 0, 7); c.fill(); },
    function prompt(c) { c.beginPath(); c.moveTo(22, 14); c.lineTo(78, 50); c.lineTo(22, 86); c.lineTo(22, 66); c.lineTo(48, 50); c.lineTo(22, 34); c.closePath(); c.fill(); },
    function cursor(c) { c.fillRect(32, 16, 36, 70); },
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

  GLYPHS[2].blink = true;   // the cursor

  var c, w, h, dots = [], pitch, x0, step;

  // Sample the glyph mask once per size and theme into a flat list of dots.
  function build() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = band.clientWidth; h = band.clientHeight;
    if (!w || !h) return false;
    canvas.width = w * dpr; canvas.height = h * dpr;
    c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Lay the glyphs out in one centred row, repeating the set until the band is full.
    var size = h * 0.72, n = Math.max(GLYPHS.length, Math.ceil(w / (size * 1.3)) + 1);
    pitch = size * 1.3; x0 = (w - (n - 1) * pitch) / 2;
    var mask = document.createElement('canvas'); mask.width = w; mask.height = h;
    var m = mask.getContext('2d');
    for (var i = 0; i < n; i++) {
      var g = document.createElement('canvas'); g.width = g.height = 100;   // own layer, so a glyph's cut-outs stay inside it
      var gc = g.getContext('2d'); gc.fillStyle = '#fff'; GLYPHS[i % GLYPHS.length](gc);
      m.save(); m.translate(x0 + i * pitch - size / 2, (h - size) / 2); m.scale(size / 100, size / 100);
      m.drawImage(g, 0, 0); m.restore();
    }
    var px = m.getImageData(0, 0, w, h).data;
    var css = getComputedStyle(document.documentElement), dark = matchMedia('(prefers-color-scheme: dark)').matches;
    var FALLBACK = dark ? ['#89b4fa', '#fab387', '#cba6f7', '#a6e3a1'] : ['#1e66f5', '#fe640b', '#8839ef', '#40a02b'];   // if tokens.css is stale
    var inks = ['--btn', '--ink-peach', '--ink-mauve', '--dot'].map(function (v, i) { return css.getPropertyValue(v).trim() || FALLBACK[i]; });
    var faint = getComputedStyle(band).color;

    // Halftone: sample the mask at each cell centre; covered cells get a big dot, the rest a faint one.
    step = Math.max(6, Math.round(h / 26));
    var r = step * 0.46;
    dots = [];
    for (var y = step / 2; y < h; y += step) {
      for (var x = step / 2; x < w; x += step) {
        var a = px[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] / 255, gi = Math.round((x - x0) / pitch);
        if (a > 0.05) dots.push({ x: x, y: y, r: r * Math.max(0.35, a), ink: inks[((gi % 4) + 4) % 4], blink: !!GLYPHS[((gi % GLYPHS.length) + GLYPHS.length) % GLYPHS.length].blink });
        else dots.push({ x: x, y: y, r: r * 0.32, ink: faint, faint: true, ph: Math.random() * 6.283 });
      }
    }
    return true;
  }

  // One frame at time t (ms): the cursor on for 550 ms and off for 550, a swell every 7 s, sparse twinkles.
  function frame(t) {
    c.clearRect(0, 0, w, h);
    var on = still || Math.floor(t / 550) % 2 === 0;
    var sweep = ((t / 7000) % 1) * (w + 4 * pitch) - 2 * pitch, sigma = pitch * 0.5;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i], rad = d.r;
      if (d.faint) {
        var tw = still ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.0009 + d.ph)), 16);
        c.globalAlpha = 0.22 + 0.55 * tw; rad *= 1 + 0.7 * tw;
      } else {
        if (d.blink && !on) { c.globalAlpha = 0.22; rad = d.r * 0.35; }
        else { c.globalAlpha = 1; if (!still) { var k = (d.x - sweep) / sigma; rad *= 1 + 0.22 * Math.exp(-k * k / 2); } }
      }
      c.fillStyle = d.ink;
      c.beginPath(); c.arc(d.x, d.y, rad, 0, 6.283); c.fill();
    }
    c.globalAlpha = 1;
  }

  // Rebuild whenever the band's own box changes (fonts, scrollbars, rotation), so the bitmap never gets stretched,
  // and when the theme flips. Drawn straight away too: a background tab or a snapshot may never paint a frame.
  var built = '', visible = true, raf = 0;
  function fit() {
    var key = band.clientWidth + 'x' + band.clientHeight;
    if (key !== built && build()) { built = key; frame(performance.now()); }
  }
  function loop(t) { raf = 0; if (!visible || still) return; frame(t); raf = requestAnimationFrame(loop); }
  function start() { if (!raf && visible && !still && dots.length) raf = requestAnimationFrame(loop); }
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(band);
  else window.addEventListener('resize', fit);
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { built = ''; fit(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; start(); }).observe(band);
  fit();
  start();
})();
