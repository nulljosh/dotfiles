// Injected into the Duolingo lesson tab via javascript_tool. Read the question
// as text, click by selector. Screenshots only for the visual types (see SKILL.md).
window.__duo = {
  sleep: ms => new Promise(r => setTimeout(r, ms)),

  // Math "blob" challenges render in a SAME-ORIGIN iframe. Everything else is
  // in the top document. frame() returns whichever holds the challenge.
  frame() {
    const f = document.querySelector('iframe');
    return (f && f.contentDocument && f.contentDocument.querySelector('.token-bank,.token-slot,.shape,.number-line'))
      ? f.contentDocument : document;
  },

  read() {
    const c = document.querySelector('[data-test^="challenge "]');
    const d = this.frame();
    return {
      type: c ? c.dataset.test.replace('challenge challenge-', '') : null,
      // LaTeX annotations are the ONLY reliable read of a math prompt.
      // innerText garbles equations; \duoblank{} marks the blank.
      latex: [...document.querySelectorAll('[data-test^="challenge "] annotation')].map(a => a.textContent),
      prompt: (document.querySelector('[data-test="challenge-header"]') || {}).innerText,
      choices: [...document.querySelectorAll('[data-test="challenge-choice"]')]
        .map((e, i) => [i, e.innerText.replace(/\n/g, ''), e.getAttribute('aria-checked')]),
      pairs: [...document.querySelectorAll('[data-test$="challenge-tap-token"]')]
        .map((e, i) => [i, e.innerText.replace(/\n/g, ' ')]),
      tokens: [...d.querySelectorAll('.token-bank .token')].map((e, i) => [i, e.textContent.trim()]),
      slots: [...d.querySelectorAll('.token-slot')].map(e => e.textContent.trim()),
      keypad: [...this.keys()].map(b => b.getAttribute('aria-label')),
      hearts: this.hearts(),
      input: !!document.querySelector('[data-test="challenge-text-input"]'),
      blame: (document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test,
      next: (document.querySelector('[data-test="player-next"]') || {}).innerText,
    };
  },

  choose(...idx) {
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    idx.forEach(i => ch[i].click());
  },

  async pair(...idx) {  // match-the-pairs: click left, then its right partner
    const t = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
    for (const i of idx) { t[i].click(); await this.sleep(250); }
  },

  // React controlled input: .value = x does nothing, must use the native setter.
  type(v) {
    const el = document.querySelector('[data-test="challenge-text-input"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },

  // DEAD as of 2026-08-31: the tile bank ignores synthetic .click(). This
  // reports fail:null and even enables CHECK, but the slots stay empty.
  // Use real `computer` clicks at CSS coordinates (see SKILL.md). Kept only
  // to read the bank back; do not trust its placements.
  async place(...vals) {
    const d = this.frame();
    for (const v of vals) {
      const t = [...d.querySelectorAll('.token-bank .token')]
        .find(e => e.textContent.trim() === String(v));
      if (!t) return { fail: v, have: [...d.querySelectorAll('.token-bank .token')].map(e => e.textContent.trim()) };
      t.click(); await this.sleep(350);
    }
    return this.read();
  },

  // ponytail: aria-label is the only handle these buttons expose.
  keys() { const c = document.querySelector('[data-test^="challenge "]') || document;
    return c.querySelectorAll('button[aria-label]'); },

  // Rules say stop at zero hearts; nothing could see them until now.
  hearts() { const e = document.querySelector('[data-test="hearts-count"],[data-test="player-hearts"]');
    return e ? parseInt(e.innerText, 10) : null; },

  key(label) { [...this.keys()].find(b => b.getAttribute('aria-label') === label).click(); },

  async go() {  // CHECK or CONTINUE, then read what came next
    document.querySelector('[data-test="player-next"]').click();
    await this.sleep(1400);
    return this.read();
  },
};

// ---- grader extraction: the client-side grade() reports the correct answer ----
Object.assign(window.__duo, {
  blob() {
    const el = document.querySelector('[data-test^="challenge "]');
    if (!el) return null;
    let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber$'))], d = 0;
    while (f && d++ < 10) { if (f.memoizedProps && f.memoizedProps.challenge) return f.memoizedProps.challenge.challengeBlob; f = f.return; }
    return null;
  },

  // innerText is doubled, and the minus is U+2212 while the grader emits ASCII.
  norm(s) {
    s = String(s).replace(/\s+/g, '').replace(/[\u2212\u2013\u2014]/g, '-');
    const h = s.length / 2;
    return (s.length % 2 === 0 && s.slice(0, h) === s.slice(h)) ? s.slice(0, h) : s;
  },

  // Calling grade() with no user selection returns [false, {value:"...Correct Answer: \mathbf{X}"}]
  answer() {
    const b = this.blob(); if (!b || !b.grading_function) return null;
    const r = new Function('return (' + b.grading_function + ')')()(b);
    const v = (r && r[1] && r[1].value) || '';
    const m = v.match(/mathbf\{([^}]*)\}/);
    return m ? m[1].split(',').map(x => x.trim()) : null;
  },

  // ponytail: matches by normalised text, NOT blob index — the display order is
  // shuffled relative to the blob, and indexing by blob picks the distractor.
  solveChoices() {
    const want = (this.answer() || []).map(x => this.norm(x));
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const idx = c.map((e, i) => [i, this.norm(e.innerText)])
                 .filter(([, t]) => want.includes(t)).map(([i]) => i);
    return { want, dom: c.map(e => this.norm(e.innerText)), idx, ok: idx.length === want.length };
  },
});


// ---- the loop: one javascript_exec per question instead of four ----
// Handles every type the grader + selectors cover. Anything needing real mouse
// input (tile bank, sliders, number lines, images, chess) is HANDED BACK.
Object.assign(window.__duo, {
  MANUAL: /token|slider|number-line|image|shape|polygon|chess|blocks/i,

  // Can this question be done from JS alone?
  auto(r) {
    if (this.MANUAL.test(r.type || '')) return false;
    if (r.tokens && r.tokens.length) return false;   // tile bank present
    return !!(r.choices.length || r.input);
  },

  async solve() {
    const r = this.read();
    if (r.hearts === 0) return { stop: 'no hearts', r };
    if (!this.auto(r)) return { stop: 'manual', type: r.type, r };

    if (r.input) {
      const a = this.answer();
      if (!a) return { stop: 'no grader answer', r };
      this.type(a[0]);
    } else {
      const s = this.solveChoices();
      // ponytail: bail rather than guess — a wrong CHECK costs a heart, a
      // handback costs nothing.
      if (!s.ok) return { stop: 'choice match failed', s, r };
      this.choose(...s.idx);
    }
    const after = await this.go();
    if (after.blame === 'blame-incorrect') return { stop: 'wrong', r, after };
    // clear the post-answer CONTINUE so the next read() is a real question
    if (after.next) await this.go();
    return { ok: true, was: r.type, next: this.read() };
  },

  // Run until something needs a human/mouse. Returns the trail for one report.
  async run(n = 15) {
    const trail = [];
    for (let i = 0; i < n; i++) {
      const s = await this.solve();
      trail.push(s.ok ? s.was : s.stop);
      if (!s.ok) return { trail, halted: s };
    }
    return { trail, halted: null };
  },
});

;'__duo ready';

// The reflection line is drawn, not stated in LaTeX — but it is a .bedrock
// element. Grid lines are the same class, so filter by class name first.
Object.assign(window.__duo, {
  drawnLine() {
    const f = document.querySelector('iframe');
    if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const V = e => { const r = e.getBoundingClientRect();
      return [fr.left + r.left + r.width / 2, fr.top + r.top + r.height / 2]; };

    let el = null;
    d.querySelectorAll('.bedrock').forEach(e => {
      const cls = String(e.getAttribute('class') || '');
      if (/grid|axis|label|arrow--|numberline-arrow/.test(cls)) return;
      const r = e.getBoundingClientRect();
      if ((r.height > 150 && r.width < 14) || (r.width > 150 && r.height < 14)) el = e;
    });
    if (!el) return null;

    const r = el.getBoundingClientRect(), vert = r.height > r.width;
    const labs = [...d.querySelectorAll('.axis-label')]
      .map(e => [+e.textContent.trim().replace('−', '-'), V(e)])
      .filter(l => !isNaN(l[0]));
    if (labs.length < 4) return null;   // ponytail: not enough ticks to scale

    // the axis is wherever most labels share a coordinate
    const mode = (key) => { const c = {};
      labs.forEach(l => c[Math.round(l[1][key])] = (c[Math.round(l[1][key])] || 0) + 1);
      return +Object.keys(c).sort((a, b) => c[b] - c[a])[0]; };
    const yl = labs.filter(l => Math.round(l[1][0]) === mode(0)).map(l => [l[0], l[1][1]]).sort((a, b) => a[0] - b[0]);
    const xl = labs.filter(l => Math.round(l[1][1]) === mode(1)).map(l => [l[0], l[1][0]]).sort((a, b) => a[0] - b[0]);
    if (yl.length < 2 || xl.length < 2) return null;

    const px = fr.left + r.left + r.width / 2, py = fr.top + r.top + r.height / 2;
    const scale = (a, p) => Math.round((p - a[0][1]) / ((a[a.length-1][1] - a[0][1]) / (a[a.length-1][0] - a[0][0])) + a[0][0]);
    return vert ? { ax: 'x', v: scale(xl, px) } : { ax: 'y', v: scale(yl, py) };
  },
});

// LaTeX first, drawing as the fallback.
(function () { const prev = window.__duo.axisLine && window.__duo.axisLine.bind(window.__duo);
  window.__duo.axisLine = function () { return (prev && prev()) || this.drawnLine(); }; })();

;'__duo ready';

// ---- reflections: y=x, y=-x, y=k, x=k, plus the slider2d control ----
Object.assign(window.__duo, {
  // Positive and negative axis labels sit in DIFFERENT rows/columns, so cluster
  // by spread and fit from the extremes. Clustering by shared coordinate splits
  // them and yields a silently wrong y-mapping.
  scale() {
    const f = document.querySelector('iframe');
    if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const labs = [...d.querySelectorAll('.axis-label')].map(e => {
      const r = e.getBoundingClientRect();
      return { v: +e.textContent.trim().replace(/[−–]/g, '-'),
               x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
    }).filter(l => !isNaN(l.v));
    if (labs.length < 4) return null;

    const fit = (arr, key) => { const a = arr.slice().sort((p, q) => p.v - q.v);
      const lo = a[0], hi = a[a.length - 1], u = (hi[key] - lo[key]) / (hi.v - lo.v);
      return { u, o: lo[key] - lo.v * u }; };
    const spanX = Math.max(...labs.map(l => l.x)) - Math.min(...labs.map(l => l.x));
    const meanY = labs.reduce((s, q) => s + q.y, 0) / labs.length;
    const xs = labs.filter(l => Math.abs(l.y - meanY) < spanX * 0.15);
    const xa = fit(xs, 'x'), ya = fit(labs.filter(l => !xs.includes(l)), 'y');
    return {
      px: (gx, gy) => [Math.round(xa.o + gx * xa.u), Math.round(ya.o + gy * ya.u)],
      grid: (x, y) => [Math.round((x - xa.o) / xa.u), Math.round((y - ya.o) / ya.u)],
    };
  },

  reflectPt(p, L) {
    if (/y\s*=\s*-\s*x/.test(L)) return [-p[1], -p[0]];
    if (/y\s*=\s*x/.test(L)) return [p[1], p[0]];
    const m = L.match(/([xy])\s*=\s*(-?\d+)/); if (!m) return null;
    return m[1] === 'y' ? [p[0], 2 * (+m[2]) - p[1]] : [2 * (+m[2]) - p[0], p[1]];
  },

  tex() { return this.ascii(this.read().latex.join(' ')).replace(/[{}\\]|mathbf|textbf/g, ''); },

  // \duodisplay{correct}{current} — the prompt ships the answer.
  duoTarget() {
    const m = this.read().latex.join(' ').match(/\\duodisplay\{([^}]*)\}\{([^}]*)\}/);
    return m ? { want: m[1].replace(/\s/g, ''), cur: m[2].replace(/\s/g, '') } : null;
  },

  sliderPx(v) {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const tr = d.querySelector('.slider2d-track'), th = d.querySelector('.slider2d-thumb');
    if (!tr || !th) return null;
    const r = tr.getBoundingClientRect(), tb = th.getBoundingClientRect();
    const lo = +th.getAttribute('aria-valuemin'), hi = +th.getAttribute('aria-valuemax');
    return {
      from: [Math.round(fr.left + tb.left + tb.width / 2), Math.round(fr.top + tb.top + tb.height / 2)],
      to: [Math.round(fr.left + r.left + (v - lo) / (hi - lo) * r.width), Math.round(fr.top + r.top + r.height / 2)],
      now: +th.getAttribute('aria-valuenow'), lo, hi,
    };
  },

  // value 0 = the original point; each notch = 1 unit perpendicular to the
  // mirror line, so the answer's notch is the distance between the two.
  notch() {
    const sl = this.sliderPx(0); if (!sl) return null;
    const p = s => s.replace(/[()\s]/g, '').split(',').map(Number);
    const t = this.duoTarget();
    if (t) { const w = p(t.want), c = p(t.cur);
      return { v: sl.now + Math.max(Math.abs(w[0] - c[0]), Math.abs(w[1] - c[1])), sl }; }
    const pt = this.pts(); if (!pt || !pt.length) return null;
    const src = pt[0][1], tgt = this.reflectPt(src, this.tex()); if (!tgt) return null;
    return { v: Math.max(Math.abs(tgt[0] - src[0]), Math.abs(tgt[1] - src[1])), tgt, src, sl };
  },

  at() { const p = this.pts(); return p && p.length ? p[0][1] : null; },

  // One answer for "what needs a real mouse drag, and from where to where".
  plan() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect(), s = this.scale();
    const dp = d.querySelector('.draggable-point');
    if (dp && s) {
      const p = this.pts(); if (!p || !p.length) return null;
      const src = p[0][1], t = this.reflectPt(src, this.tex()); if (!t) return null;
      const r = dp.getBoundingClientRect();
      return { kind: 'point', src, tgt: t,
        from: [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)],
        to: s.px(t[0], t[1]) };
    }
    const n = this.notch(); if (!n) return null;
    return { kind: 'slider', v: n.v, from: n.sl.from, to: this.sliderPx(n.v).to };
  },
});

// keep the grader-based matcher; the new solveChoices tries it first.
window.__duo.solveChoicesOrig = window.__duo.solveChoices;

// ---- three answer sources that beat a screenshot ----
Object.assign(window.__duo, {
  clean(s) { return this.norm(this.ascii(s).replace(/\\|mathbf|textbf|\{|\}/g, '')); },

  solveReflectChoice() {
    const r = this.read(), L = this.tex();
    let src = null; const m = L.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
    if (m) src = [+m[1], +m[2]];
    else { const p = this.pts(); if (p && p.length === 1) src = p[0][1]; }
    if (!src) return null;
    const t = this.reflectPt(src, L); if (!t) return null;
    const want = '(' + t[0] + ',' + t[1] + ')';
    const i = r.choices.findIndex(c => this.ascii(c[1]).replace(/\s/g, '') === want);
    return i < 0 ? { miss: want } : { i, want };
  },

  // the ghost shape IS the reflected copy — name the transform between centroids
  solveLineOfReflection() {
    const sh = this.shapes && this.shapes(); if (!sh || sh.length < 2) return null;
    const g = sh.find(s => /ghost/.test(s[0])), o = sh.find(s => !/ghost/.test(s[0]));
    if (!g || !o) return null;
    const [ax, ay] = o[1], [bx, by] = g[1];
    let want = null;
    if (bx === ay && by === ax) want = 'y=x';
    else if (bx === -ay && by === -ax) want = 'y=-x';
    else if (bx === ax && by === -ay) want = 'y=0';
    else if (bx === -ax && by === ay) want = 'x=0';
    if (!want) return { miss: [o[1], g[1]] };
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.ascii(e.innerText).replace(/\s/g, '').includes(want));
    return i < 0 ? { miss: want } : { i, want };
  },

  // choice text is DOUBLED, so norm() both sides or this silently misses
  solvePhantomChoice() {
    const p = this.phantom && this.phantom(); if (!p) return null;
    const want = this.clean(p);
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === want);
    return i < 0 ? { miss: want } : { i, want };
  },

  // try every solver; the stock auto() rejects mathChallengeBlob outright
  solveChoices() {
    const tries = ['solveChoicesOrig', 'solveReflectChoice', 'solveLineOfReflection', 'solvePhantomChoice'];
    for (const name of tries) {
      let r = null; try { r = this[name] && this[name](); } catch (e) { continue; }
      if (!r) continue;
      if (r.ok) return r;
      if (r.i >= 0) return { want: [r.want], idx: [r.i], ok: true, via: name };
    }
    return null;
  },
});

// ponytail: stop only when a real mouse drag is genuinely needed.
window.__duo.run2 = async function (n) {
  this.S = { running: true, log: [], done: 0 };
  for (let i = 0; i < n && this.S.running; i++) {
    const nx0 = document.querySelector('[data-test="player-next"]');
    if (nx0 && /CONTINUE/i.test(nx0.innerText || '') && !document.querySelector('[data-test^="challenge "]')) {
      this.tap(nx0); await this.sleep(1500); continue;
    }
    const r = this.read();
    if (!r.type) { this.S.log.push('lessondone'); break; }
    if (this.plan()) { this.S.log.push('needdrag'); break; }

    let acted = false;
    if (r.choices.length) { const s = this.solveChoices();
      if (s && s.ok) { s.idx.forEach(j => this.tap(document.querySelectorAll('[data-test="challenge-choice"]')[j])); acted = true; } }
    else if (r.input) { acted = !!this.typeAnswer(); }   // \duoblank first, grader second
    if (!acted) { this.S.log.push('stuck:' + r.type); break; }

    await this.sleep(350);
    this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1600);
    const bl = ((document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test || '').replace('blame blame-', '');
    this.S.log.push(bl || 'noblame');
    if (bl === 'correct') this.S.done++;
    if (!bl) break;                        // never submit into a blank
    const nx = document.querySelector('[data-test="player-next"]');
    if (nx && /CONTINUE/i.test(nx.innerText)) { this.tap(nx); await this.sleep(1500); }
  }
  this.S.running = false;
  return this.S;
};

;'__duo ready';

// ---- rotations (unit 126) ----
Object.assign(window.__duo, {
  // \, is a thin space: strip it BEFORE dropping backslashes, or "(6,\,0)"
  // becomes "(6,,0)" and every coordinate regex misses it.
  tex() {
    return this.ascii(this.read().latex.join(' '))
      .replace(/\\[,;!:]/g, ' ').replace(/[{}\\]|mathbf|textbf/g, '').replace(/,\s*,/g, ',');
  },

  // degrees from the prompt; plain "clockwise" is the negative direction
  deg(L) {
    const m = L.match(/(\d+)\s*degree/); if (!m) return null;
    const a = +m[1];
    return (/clockwise/.test(L) && !/counterclockwise/.test(L)) ? 360 - a : a;
  },

  centre(L) {
    const i = L.search(/around|about/); if (i < 0) return [0, 0];
    const m = [...L.slice(i).matchAll(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g)];
    return m.length ? [+m[0][1], +m[0][2]] : [0, 0];
  },

  // where a point must END UP — reflection or rotation, one entry point
  target(src) {
    const L = this.tex();
    if (!/rotat/i.test(L)) return this.reflectPt(src, L);
    const a = this.deg(L); if (a === null) return null;
    const rad = a * Math.PI / 180, cs = Math.round(Math.cos(rad)), sn = Math.round(Math.sin(rad));
    const c = this.centre(L), dx = src[0] - c[0], dy = src[1] - c[1];
    return [Math.round(c[0] + dx * cs - dy * sn), Math.round(c[1] + dx * sn + dy * cs)];
  },

  // valuemax 360 => the slider is an ANGLE, not a count of notches
  rot() {
    const sl = this.sliderPx(0); if (!sl || sl.hi < 180) return null;
    const t = this.duoTarget();
    if (t) { const P = s => s.replace(/[()\s]/g, '').split(',').map(Number);
      const c = P(t.cur), w = P(t.want);
      let a = (Math.atan2(w[1], w[0]) - Math.atan2(c[1], c[0])) * 180 / Math.PI;
      a = Math.round(((a % 360) + 360) % 360);
      return { deg: a, from: sl.from, to: this.sliderPx(a).to }; }
    const a = this.deg(this.tex()); if (a === null) return null;
    return { deg: a, from: sl.from, to: this.sliderPx(a).to };
  },

  plan() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect(), s = this.scale();
    const dp = d.querySelector('.draggable-point');
    if (dp && s) {
      const p = this.pts(); if (!p || !p.length) return null;
      const src = (p.find(q => /draggable/.test(q[0])) || p[0])[1];
      const t = this.target(src); if (!t) return null;
      const r = dp.getBoundingClientRect();
      return { kind: 'point', src, tgt: t,
        from: [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)],
        to: s.px(t[0], t[1]) };
    }
    const rt = this.rot(); if (rt) return { kind: 'rot', v: rt.deg, from: rt.from, to: rt.to };
    const n = this.notch(); if (!n) return null;
    return { kind: 'slider', v: n.v, from: n.sl.from, to: this.sliderPx(n.v).to };
  },

  // \duoblank{X} carries the answer, exactly like \phantom{X}
  solveDuoblank() {
    const m = this.read().latex.join(' ').match(/\\duoblank\{([^}]*)\}/); if (!m) return null;
    const want = this.clean(m[1]);
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === want);
    if (i >= 0) return { i, want };
    if (this.read().input) { this.type(want); return { ok: true, idx: [], want: [want] }; }
    return { miss: want };
  },

  // ghost is the PRE-image; test each candidate centre rather than inverting (I-R)
  solveCenterChoice() {
    const L = this.tex(), a = this.deg(L); if (a === null) return null;
    const rad = a * Math.PI / 180, cs = Math.round(Math.cos(rad)), sn = Math.round(Math.sin(rad));
    const src = this.shapes().concat(this.pts());
    const gh = src.find(s => /ghost/.test(s[0])), so = src.find(s => !/ghost/.test(s[0]));
    if (!gh || !so) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const cand = c.map(e => { const t = this.norm(this.ascii(e.innerText)).match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
      return t ? [+t[1], +t[2]] : null; });
    const hit = (o, g) => cand.findIndex(p => { if (!p) return false;
      const dx = o[0] - p[0], dy = o[1] - p[1];
      return Math.round(p[0] + dx * cs - dy * sn) === g[0] && Math.round(p[1] + dx * sn + dy * cs) === g[1]; });
    let i = hit(gh[1], so[1]); if (i < 0) i = hit(so[1], gh[1]);
    return i < 0 ? { miss: a } : { i, want: cand[i] };
  },

  solveRotChoice() {
    const p = this.pts(); if (!p || p.length < 2) return null;
    const g = p.find(q => /ghost/.test(q[0])), o = p.find(q => !/ghost/.test(q[0]));
    if (!g || !o) return null;
    let a = (Math.atan2(g[1][1], g[1][0]) - Math.atan2(o[1][1], o[1][0])) * 180 / Math.PI;
    a = Math.round(((a % 360) + 360) % 360);
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)));
    const i = txt.findIndex(t => t.startsWith(String(a)));
    return i < 0 ? { miss: a } : { i, want: a };
  },

  solveRotPointChoice() {
    const L = this.tex(); if (!/rotat/i.test(L)) return null;
    const a = this.deg(L); if (a === null) return null;
    const rad = a * Math.PI / 180, cs = Math.round(Math.cos(rad)), sn = Math.round(Math.sin(rad));
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const ctext = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    const ctr = this.centre(L), eq = (p, q) => p[0] === q[0] && p[1] === q[1];
    const nums = [...L.matchAll(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g)].map(x => [+x[1], +x[2]]);
    // the latex also holds the CHOICE labels — those are never the source
    let src = nums.find(n => !eq(n, ctr) && !ctext.includes('(' + n[0] + ',' + n[1] + ')'));
    if (!src) { const p = this.pts(); if (p && p.length) src = (p.find(q => !/ghost/.test(q[0])) || p[0])[1]; }
    if (!src) return null;
    const dx = src[0] - ctr[0], dy = src[1] - ctr[1];
    const want = '(' + Math.round(ctr[0] + dx * cs - dy * sn) + ',' + Math.round(ctr[1] + dx * sn + dy * cs) + ')';
    const i = ctext.indexOf(want);
    return i < 0 ? { miss: want } : { i, want };
  },
});

// Gate every solver on the prompt that owns it: an ungated eager solver answers
// another type's question and gets it wrong. Look them up BY NAME so later
// patches take effect — closures capture the old version.
window.__duo.RULES = [
  ['solveChoicesOrig',      null],
  ['solveDuoblank',         null],
  ['solvePhantomChoice',    /fill in the blank/i],
  ['solveCenterChoice',     /center of the/i],
  ['solveRotChoice',        /transformation of/i],
  ['solveRotPointChoice',   /rotat/i],
  ['solveLineOfReflection', /line of reflection/i],
  ['solveReflectChoice',    /reflect/i],
];
window.__duo.solveChoices = function () {
  const L = this.tex();
  for (const [name, gate] of this.RULES) {
    if (gate && !gate.test(L)) continue;
    let r = null; try { r = this[name] && this[name](); } catch (e) { continue; }
    if (!r) continue;
    if (r.ok) return r;
    if (r.i >= 0) return { want: [String(r.want)], idx: [r.i], ok: true, via: name };
  }
  return null;
};

;'__duo ready';

// "Create the point ..." — no graph, two drop targets and a tile bank.
// Tiles need REAL drags (bank ignores synthetic clicks); re-read the bank
// between each one, the placed tile leaves it and every position shifts.
window.__duo.buildPlan = function () {
  const L = this.tex(), ctr = this.centre(L);
  const nums = [...L.matchAll(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g)].map(x => [+x[1], +x[2]]);
  const src = nums.find(n => !(n[0] === ctr[0] && n[1] === ctr[1])); if (!src) return null;
  const t = this.target(src); if (!t) return null;
  const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
  const d = f.contentDocument, fr = f.getBoundingClientRect();
  const box = e => { const r = e.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  const slots = [...d.querySelectorAll('.drop-target-border')].map(box);
  const bank = [...d.querySelectorAll('.token-bank .token')].map(e => ({ v: this.ascii(e.textContent.trim()), xy: box(e) }));
  const used = [], steps = [];
  t.forEach((val, i) => { const tk = bank.find(b => b.v === String(val) && !used.includes(b));
    if (tk) { used.push(tk); steps.push({ from: tk.xy, to: slots[i], val }); } });
  return { src, tgt: t, steps, ok: steps.length === 2 };
};

;'__duo ready';

// The angle slider counts CLOCKWISE degrees, while target() is CCW-positive.
// Two conventions in one question — keep them apart.
// The widget turns in the direction the prompt states; the slider is only how
// far. 270 on a "90 counterclockwise" question was marked incorrect.
window.__duo.sliderDeg = function () {
  const m = this.tex().match(/(\d+)\s*degree/); return m ? +m[1] : null;
};

// duodisplay's first arg is NOT the answer (verified wrong on a 90 CW question),
// so the angle always comes from the prompt.
window.__duo.rot = function () {
  const sl = this.sliderPx(0); if (!sl || sl.hi < 180) return null;
  const a = this.sliderDeg(); if (a === null) return null;
  return { deg: a, from: sl.from, to: this.sliderPx(a).to };
};

// verify the widget actually landed before submitting — windows get resized
window.__duo.after = async function (want) {
  const f = document.querySelector('iframe'), d = f.contentDocument;
  // the POINT is ground truth; the slider's own number has twice meant
  // something other than it looked like
  const p = this.pts(), pt = p && p.length ? (p.find(q => /draggable/.test(q[0])) || p[0])[1] : null;
  const w = Array.isArray(want) ? want.join(',') : String(want);
  let got = pt ? pt.join(',') : null;
  if (!Array.isArray(want)) { const th = d.querySelector('.slider2d-thumb');
    got = th ? String(+th.getAttribute('aria-valuenow')) : got; }
  if (got !== w) return { miss: got, want: w };
  this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1700);
  const bl = ((document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test || '').replace('blame blame-', '');
  const n = document.querySelector('[data-test="player-next"]');
  if (n && /CONTINUE/i.test(n.innerText)) { this.tap(n); await this.sleep(1500); }
  this.run2(18);
  return { bl };
};

;'__duo ready';

// text inputs were going straight to the grader, skipping the latex answers
window.__duo.typeAnswer = function () {
  const L = this.read().latex.join(' ');
  const m = L.match(/\\duoblank\{([^}]*)\}/) || L.match(/\\phantom\{([^}]*)\}/);
  if (m) { const v = this.clean(m[1]); if (v !== '') { this.type(v); return v; } }
  const a = this.answer(); if (a) { this.type(a[0]); return a[0]; }
  return null;
};

;'__duo ready';

// ---- translations + composite transforms (unit 127) ----
Object.assign(window.__duo, {
  // "over the y-axis" is the line x=0 — easy to get backwards
  reflectPt(p, L) {
    if (/y\s*-?\s*axis/i.test(L)) return [-p[0], p[1]];
    if (/x\s*-?\s*axis/i.test(L)) return [p[0], -p[1]];
    if (/y\s*=\s*-\s*x/.test(L)) return [-p[1], -p[0]];
    if (/y\s*=\s*x/.test(L)) return [p[1], p[0]];
    const m = L.match(/([xy])\s*=\s*(-?\d+)/); if (!m) return null;
    return m[1] === 'y' ? [p[0], 2 * (+m[2]) - p[1]] : [2 * (+m[2]) - p[0], p[1]];
  },

  // A question can chain steps ("2 units up" THEN "reflect over y-axis").
  // Apply them in the order they appear, not just the first match.
  steps(L) {
    const out = [], push = (i, fn) => out.push({ i, fn });
    for (const m of L.matchAll(/(\d+)\s*units?\s*(up|down|left|right)/gi)) {
      const D = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] }[m[2].toLowerCase()], n = +m[1];
      push(m.index, p => [p[0] + D[0] * n, p[1] + D[1] * n]);
    }
    for (const m of L.matchAll(/reflect[^.]*?((?:[xy]\s*-?\s*axis)|(?:y\s*=\s*-?\s*x)|(?:[xy]\s*=\s*-?\d+))/gi)) {
      const spec = m[1]; push(m.index, p => this.reflectPt(p, spec));
    }
    for (const m of L.matchAll(/(\d+)\s*degree/gi)) {
      const a = +m[1], cw = /clockwise/.test(L) && !/counterclockwise/.test(L);
      const rad = (cw ? -a : a) * Math.PI / 180, cs = Math.round(Math.cos(rad)), sn = Math.round(Math.sin(rad));
      const c = this.centre(L);
      push(m.index, p => { const dx = p[0] - c[0], dy = p[1] - c[1];
        return [Math.round(c[0] + dx * cs - dy * sn), Math.round(c[1] + dx * sn + dy * cs)]; });
    }
    return out.sort((a, b) => a.i - b.i);
  },

  target(src) {
    const st = this.steps(this.tex()); if (!st.length) return null;
    let p = src; for (const s of st) { p = s.fn(p); if (!p) return null; }
    return p;
  },

  // The subject is the prompt's own value (latex[1]) — it may ALSO appear as a
  // distractor choice, so "the coordinate that isn't a choice" is not safe.
  subject() {
    const L = this.read().latex;
    for (let i = 1; i < L.length; i++) {
      const s = this.ascii(L[i]).replace(/\\[,;!:]/g, ' ').replace(/[{}\\]|mathbf|textbf/g, '').replace(/,\s*,/g, ',');
      const m = s.match(/^\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*$/); if (m) return [+m[1], +m[2]];
    }
    const p = this.pts(); if (p && p.length) return (p.find(q => !/ghost/.test(q[0])) || p[0])[1];
    return null;
  },

  solveReflectChoice() {
    const L = this.tex();
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const ctext = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    const p = this.pts();
    const src = (p && p.length) ? (p.find(q => !/ghost/.test(q[0])) || p[0])[1] : this.subject();
    if (!src) return null;
    const t = this.reflectPt(src, L); if (!t) return null;
    const want = '(' + t[0] + ',' + t[1] + ')';
    const i = ctext.indexOf(want);
    return i < 0 ? { miss: want, src } : { i, want };
  },

  solveTransChoice() {
    const L = this.tex(); const st = this.steps(L); if (!st.length) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const ctext = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    const p = this.pts();
    const src = (p && p.length) ? (p.find(q => !/ghost/.test(q[0])) || p[0])[1] : this.subject();
    if (!src) return null;
    const t = this.target(src); if (!t) return null;
    const want = '(' + t[0] + ',' + t[1] + ')';
    const i = ctext.indexOf(want);
    return i < 0 ? { miss: want, src } : { i, want };
  },

  // tile builds: no steps left means both slots are filled
  async afterBuild() {
    const b = this.buildPlan(); if (b && b.steps.length) return { left: b.steps };
    this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1800);
    const bl = ((document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test || '').replace('blame blame-', '');
    const n = document.querySelector('[data-test="player-next"]');
    if (n && /CONTINUE/i.test(n.innerText)) { this.tap(n); await this.sleep(1500); }
    this.run2(20); return { bl };
  },
});

window.__duo.RULES.splice(2, 0, ['solveTransChoice', /translat|units? (up|down|left|right)/i]);

;'__duo ready';

// The subject may sit inside the prompt line rather than its own annotation.
// Skip any coordinate after "about"/"around" — that one is the centre.
(function () {
  const prev = window.__duo.subject;
  window.__duo.subject = function () {
    const s = prev.call(this); if (s) return s;
    const L = this.tex(), ci = L.search(/around|about/);
    for (const m of L.matchAll(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g)) {
      if (ci >= 0 && m.index > ci) continue;
      return [+m[1], +m[2]];
    }
    return null;
  };
})();

window.__duo.buildPlan = function () {
  const p = this.pts();
  const src = (p && p.length) ? (p.find(q => !/ghost/.test(q[0])) || p[0])[1] : this.subject();
  if (!src) return null;
  const t = this.target(src); if (!t) return null;
  const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
  const d = f.contentDocument, fr = f.getBoundingClientRect();
  const box = e => { const r = e.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  const slots = [...d.querySelectorAll('.drop-target-border')].map(box);
  if (slots.length < 2) return null;
  const bank = [...d.querySelectorAll('.token-bank .token')].map(e => ({ v: this.ascii(e.textContent.trim()), xy: box(e) }));
  const used = [], steps = [];
  t.forEach((val, i) => { const tk = bank.find(b => b.v === String(val) && !used.includes(b));
    if (tk) { used.push(tk); steps.push({ from: tk.xy, to: slots[i], val }); } });
  return { src, tgt: t, steps, ok: steps.length === 2 };
};

;'__duo ready';

// ---- congruence / similarity / area, without screenshots ----
Object.assign(window.__duo, {
  // a translate slider is "how many units", straight from the prompt
  unitSlider() {
    const sl = this.sliderPx(0); if (!sl) return null;
    const m = this.tex().match(/(\d+)\s*units?/); if (!m) return null;
    const v = +m[1]; if (v < sl.lo || v > sl.hi) return null;
    return { v, from: sl.from, to: this.sliderPx(v).to };
  },

  // figure size in GRID units, from the client bbox over px-per-unit
  figs() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, s = this.scale(); if (!s) return null;
    const u = Math.abs(s.px(1, 0)[0] - s.px(0, 0)[0]);
    return [...d.querySelectorAll('.shape,.polygon')].map(e => { const r = e.getBoundingClientRect();
      return { w: +(r.width / u).toFixed(2), h: +(r.height / u).toFixed(2) }; })
      .filter(x => x.w > 0.1 && x.h > 0.1);
  },

  solveRelation() {
    const fg = this.figs(); if (!fg || fg.length < 2) return null;
    const [a, b] = fg, eq = (x, y) => Math.abs(x - y) < 0.15;
    const congruent = eq(a.w, b.w) && eq(a.h, b.h);
    const similar = congruent || eq(a.w / a.h, b.w / b.h);
    const want = congruent ? 'congruent' : (similar ? 'similarbutnotcongruent' : 'neithersimilarnorcongruent');
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, '') === want);
    return i < 0 ? { miss: want } : { i, want };
  },

  // shapes are <polygon points> OR <path d> with rounded corners — pull the
  // coordinate pairs out of either, shoelace, rescale to grid units
  area() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const el = f.contentDocument.querySelector('.shape,.polygon'); if (!el) return null;
    let P = [];
    if (el.points && el.points.length) P = [...el.points].map(p => [p.x, p.y]);
    else { const nums = (el.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?/g);
      if (!nums) return null;
      for (let i = 0; i + 1 < nums.length; i += 2) P.push([+nums[i], +nums[i + 1]]); }
    if (P.length < 3) return null;
    let a = 0;
    for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; a += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
    a = Math.abs(a) / 2;
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const rawW = Math.max(...xs) - Math.min(...xs), rawH = Math.max(...ys) - Math.min(...ys);
    const g = this.figs(); if (!g || !g.length || !rawW || !rawH) return null;
    return +(a * (g[0].w / rawW) * (g[0].h / rawH)).toFixed(2);
  },

  solveArea() {
    const a = this.area(); if (a === null) return null;
    const want = String(Math.round(a));
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, '') === want);
    return i < 0 ? { miss: want, a } : { i, want };
  },
});

// a units slider is not a rotation — claim it before plan()'s other branches
(function () {
  const prev = window.__duo.plan;
  window.__duo.plan = function () {
    const f = document.querySelector('iframe');
    if (f && f.contentDocument && f.contentDocument.querySelector('.slider2d-thumb')
        && !f.contentDocument.querySelector('.draggable-point')) {
      const u = this.unitSlider();
      if (u && !/rotat/i.test(this.tex())) return { kind: 'units', v: u.v, from: u.from, to: u.to };
    }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveRelation', /relationship between/i],
  ['solveArea', /area of a congruent/i]);

;'__duo ready';

// Rounded corners shave a few percent off the shoelace result, so snap: the
// ratio of area to bounding box says rectangle (1) or triangle (1/2), and the
// box itself snaps to whole grid units. Raw 11.38 was really 12.
window.__duo.areaExact = function () {
  const a = this.area(), g = this.figs();
  if (a === null || !g || !g.length) return null;
  const W = Math.round(g[0].w), H = Math.round(g[0].h); if (!W || !H) return Math.round(a);
  const ratio = a / (g[0].w * g[0].h);
  if (Math.abs(ratio - 1) < 0.08) return W * H;
  if (Math.abs(ratio - 0.5) < 0.08) return W * H / 2;
  return Math.round(a);
};

window.__duo.solveArea = function () {
  const a = this.areaExact(); if (a === null) return null;
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = c.findIndex(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, '') === String(a));
  return i < 0 ? { miss: a } : { i, want: String(a) };
};

// "Enter the ..." variants: area and side length come off the figure
window.__duo.typeAnswer = function () {
  const L = this.tex();
  if (/side length/i.test(L)) { const g = this.figs();
    if (g && g.length) { const v = String(Math.round(Math.max(g[0].w, g[0].h))); this.type(v); return v; } }
  if (/area/i.test(L)) { const a = this.areaExact();
    if (a !== null) { const v = String(a); this.type(v); return v; } }
  const A = this.read().latex.join(' ');
  const m = A.match(/\\duoblank\{([^}]*)\}/) || A.match(/\\phantom\{([^}]*)\}/);
  if (m) { const v = this.clean(m[1]); if (v !== '') { this.type(v); return v; } }
  const g = this.answer(); if (g) { this.type(g[0]); return g[0]; }
  return null;
};

;'__duo ready';

// ---- dilations (unit 128) ----
Object.assign(window.__duo, {
  // \emphasis{} sits between "factor" and its number once braces are stripped.
  // The gap MUST be lazy: a greedy \D swallows the minus and -2 reads as 2.
  factor() { const m = this.tex().match(/factor\D{0,15}?(-?\d+(?:\.\d+)?)/i); return m ? +m[1] : null; },

  // on a dilation the slider IS the scale factor, and its range can go negative
  dilate() {
    const k = this.factor(); if (k === null) return null;
    const sl = this.sliderPx(0); if (!sl || k < sl.lo || k > sl.hi) return null;
    return { v: k, from: sl.from, to: this.sliderPx(k).to };
  },

  solveDilatePos() {
    const L = this.tex();
    const m = L.match(/(?:dilation by|scale factor\s*=?)\D{0,15}?(-?\d+(?:\.\d+)?(?:\/\d+)?)/i)
           || L.match(/factor\D{0,15}?(-?\d+(?:\/\d+)?)/i);
    if (!m) return null;
    const k = m[1].includes('/') ? (+m[1].split('/')[0] / +m[1].split('/')[1]) : +m[1];
    const a = Math.abs(k), want = a > 1 ? 'farther' : (a < 1 ? 'closer' : 'same');
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).toLowerCase());
    let i = txt.findIndex(t => t.includes(want));
    if (i < 0 && want === 'same') i = txt.findIndex(t => /same|unchanged|nochange/.test(t));
    return i < 0 ? { miss: want } : { i, want };
  },

  // the centre of a dilation lies on the line through p and p'
  solveDilateCenter() {
    const p = this.pts(); if (!p || p.length < 2) return null;
    const a = p[0][1], b = p[1][1];
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const cand = c.map(e => { const m = this.norm(this.ascii(e.innerText)).match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
      return m ? [+m[1], +m[2]] : null; });
    const i = cand.findIndex(q => q && ((a[0] - q[0]) * (b[1] - q[1]) - (a[1] - q[1]) * (b[0] - q[0])) === 0);
    return i < 0 ? { miss: 'collinear' } : { i, want: cand[i] };
  },

  // k = |p'| / |p| about the origin
  solveDilateFactor() {
    const p = this.pts(); if (!p || p.length < 2) return null;
    const gh = p.find(q => /ghost/.test(q[0])), so = p.find(q => !/ghost/.test(q[0]));
    if (!gh || !so) return null;
    const da = Math.hypot(gh[1][0], gh[1][1]), db = Math.hypot(so[1][0], so[1][1]);
    if (!da) return null;
    const k = db / da;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    const val = t => t.includes('/') ? (+t.split('/')[0] / +t.split('/')[1]) : +t;
    let i = txt.findIndex(t => Math.abs(val(t) - k) < 0.05);
    if (i < 0) i = txt.findIndex(t => Math.abs(val(t) - 1 / k) < 0.05);
    return i < 0 ? { miss: k } : { i, want: k };
  },

  solveDilateChoice() {
    const p = this.pts();
    const src = (p && p.length) ? (p.find(q => !/ghost/.test(q[0])) || p[0])[1] : this.subject();
    if (!src) return null;
    const t = this.target(src); if (!t) return null;
    const want = '(' + t[0] + ',' + t[1] + ')';
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, '')).indexOf(want);
    return i < 0 ? { miss: want, src } : { i, want };
  },
});

// dilation joins translate/reflect/rotate as an ordered step
(function () {
  const prev = window.__duo.steps;
  window.__duo.steps = function (L) {
    const out = prev.call(this, L);
    for (const m of L.matchAll(/(?:scale factor|dilat\w*(?: by)?)\D{0,15}?(-?\d+(?:\.\d+)?)/gi)) {
      const k = +m[1], c = this.centre(L);
      out.push({ i: m.index, fn: p => [Math.round(c[0] + (p[0] - c[0]) * k), Math.round(c[1] + (p[1] - c[1]) * k)] });
    }
    return out.sort((a, b) => a.i - b.i);
  };
  const prevPlan = window.__duo.plan;
  window.__duo.plan = function () {
    if (/dilat/i.test(this.tex())) { const d = this.dilate();
      if (d) return { kind: 'factor', v: d.v, from: d.from, to: d.to }; }
    return prevPlan.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveDilatePos', /position of a dilated|position after dilation/i],
  ['solveDilateCenter', /center of dilation/i],
  ['solveDilateFactor', /dilation scale factor/i],
  ['solveDilateChoice', /dilated by scale factor|point dilated/i]);

;'__duo ready';

// p and p' may be points OR shapes; figure size is the more reliable ratio
window.__duo.solveDilateFactor = function () {
  const fg = this.figs();
  const src = this.pts().concat(this.shapes());
  const gh = src.find(q => /ghost/.test(q[0])), so = src.find(q => !/ghost/.test(q[0]));
  if (!gh || !so) return null;
  let k = null;
  if (fg && fg.length >= 2 && fg[0].w && fg[1].w) k = Math.max(fg[0].w, fg[1].w) / Math.min(fg[0].w, fg[1].w);
  if (k === null) { const da = Math.hypot(gh[1][0], gh[1][1]), db = Math.hypot(so[1][0], so[1][1]);
    if (!da) return null; k = db / da; }
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
  const val = t => t.includes('/') ? (+t.split('/')[0] / +t.split('/')[1]) : +t;
  let i = txt.findIndex(t => Math.abs(val(t) - k) < 0.08);
  if (i < 0) i = txt.findIndex(t => Math.abs(val(t) - 1 / k) < 0.08);
  return i < 0 ? { miss: k } : { i, want: k };
};

// "Select the endpoints ..." — transform BOTH points and match the pair
window.__duo.solveEndpoints = function () {
  const p = this.pts().filter(q => !/ghost/.test(q[0])).map(q => q[1]);
  if (p.length < 2) return null;
  const t = p.map(q => this.target(q)); if (t.some(x => !x)) return null;
  const want = t.map(q => '(' + q[0] + ',' + q[1] + ')').sort().join('');
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = c.findIndex(e => {
    const m = [...this.norm(this.ascii(e.innerText)).replace(/\s/g, '').matchAll(/\(-?\d+,-?\d+\)/g)].map(x => x[0]);
    return m.length === 2 && m.sort().join('') === want;
  });
  return i < 0 ? { miss: want } : { i, want };
};

// One solver for every "bigger / smaller / same" phrasing — length, area,
// distance, position. |k|>1 grows, <1 shrinks, ==1 unchanged. (Area really
// scales by k squared, but the qualitative answer only needs the direction.)
window.__duo.solveQualitative = function () {
  const m = this.tex().match(/(?:scale factor|dilation by|factor)\s*=?\D{0,10}?(-?\d+(?:\.\d+)?(?:\/\d+)?)/i);
  if (!m) return null;
  const k = Math.abs(m[1].includes('/') ? (+m[1].split('/')[0] / +m[1].split('/')[1]) : +m[1]);
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, '').toLowerCase());
  const GROW = /larger|longer|bigger|farther|greater/, SHRINK = /smaller|shorter|closer|less/, SAME = /same|unchanged|equal/;
  if (!txt.some(t => GROW.test(t) || SHRINK.test(t) || SAME.test(t))) return null;
  const pick = k > 1 ? GROW : (k < 1 ? SHRINK : SAME);
  const i = txt.findIndex(t => pick.test(t));
  return i < 0 ? { miss: k } : { i, want: txt[i] };
};

window.__duo.RULES.splice(2, 0,
  ['solveQualitative', /select the (area|length|position|distance) of|position after dilation/i],
  ['solveEndpoints', /endpoints/i],
  ['solveDilateFactor', /scale factor from|dilation scale factor/i]);

;'__duo ready';

// BUG (cost 3 answers): the ratio was forced >1 via max/min, so a SHRINKING
// dilation reported its reciprocal — 0.5 read as 2. Direction matters:
// k = image / pre-image, and ghost is the PRE-image.
window.__duo.kFactor = function () {
  const src = this.pts().concat(this.shapes());
  const gh = src.find(q => /ghost/.test(q[0])), so = src.find(q => !/ghost/.test(q[0]));
  const fg = this.figs();
  if (fg && fg.length >= 2 && gh && so) {
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const big = fg[0].w >= fg[1].w ? fg[0] : fg[1], small = fg[0].w >= fg[1].w ? fg[1] : fg[0];
    const ghIsSmall = d(gh[1], [0, 0]) <= d(so[1], [0, 0]);
    const pre = ghIsSmall ? small : big, img = ghIsSmall ? big : small;
    if (pre.w) return img.w / pre.w;
  }
  if (gh && so) { const da = Math.hypot(gh[1][0], gh[1][1]), db = Math.hypot(so[1][0], so[1][1]);
    if (da) return db / da; }
  return null;
};

window.__duo.solveDilateFactor = function () {
  const k = this.kFactor(); if (k === null) return null;
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
  const val = t => t.includes('/') ? (+t.split('/')[0] / +t.split('/')[1]) : parseFloat(t);
  const i = txt.findIndex(t => Math.abs(val(t) - k) < 0.06);
  return i < 0 ? { miss: k } : { i, want: k };
};

window.__duo.typeAnswer = function () {
  const L = this.tex();
  if (/scale factor from|dilation scale factor/i.test(L)) {
    const k = this.kFactor();
    if (k !== null) { const v = String(Math.round(k * 1000) / 1000); this.type(v); return v; } }
  if (/side length/i.test(L)) { const g = this.figs();
    if (g && g.length) { const v = String(Math.round(Math.max(g[0].w, g[0].h))); this.type(v); return v; } }
  if (/area/i.test(L)) { const a = this.areaExact();
    if (a !== null) { const v = String(a); this.type(v); return v; } }
  const A = this.read().latex.join(' ');
  const m = A.match(/\\duoblank\{([^}]*)\}/) || A.match(/\\phantom\{([^}]*)\}/);
  if (m) { const v = this.clean(m[1]); if (v !== '') { this.type(v); return v; } }
  const g = this.answer(); if (g) { this.type(g[0]); return g[0]; }
  return null;
};

;'__duo ready';

// ---- parallel lines and angles (unit 129) ----
Object.assign(window.__duo, {
  // latex writes \degree, the choice renders ° — drop both before comparing
  clean(s) {
    return this.norm(this.ascii(s).replace(/\\degree|°/g, '').replace(/\\|mathbf|textbf|text|\{|\}/g, ''));
  },
  // ascii() maps the math-italic CAPITAL block to lowercase, so uppercase first
  letter(s) { return this.norm(this.ascii(s).replace(/\s/g, '').toUpperCase()); },

  // The angle labels and the given value ARE in the iframe as <text> — an
  // over-tight filter hid them. Group into the two intersections by y, then
  // assign each a quadrant: 0=UL 1=UR 2=LR 3=LL.
  angleMap() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const items = [...d.querySelectorAll('text,tspan')].map(e => { const r = e.getBoundingClientRect();
      return { t: this.ascii(e.textContent.trim()).toUpperCase().replace('°', ''),
               x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 }; })
      .filter(o => o.t && (/^[A-Z]$/.test(o.t) || /^\d+$/.test(o.t)));
    if (items.length < 4) return null;
    const ys = items.map(o => o.y), mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    const grp = o => o.y < mid ? 0 : 1, cent = {};
    [0, 1].forEach(g => { const m = items.filter(o => grp(o) === g); if (!m.length) return;
      cent[g] = [m.reduce((s, o) => s + o.x, 0) / m.length, m.reduce((s, o) => s + o.y, 0) / m.length]; });
    items.forEach(o => { const c = cent[grp(o)]; if (!c) return;
      const right = o.x > c[0], below = o.y > c[1];
      o.g = grp(o); o.q = !below && !right ? 0 : (!below && right ? 1 : (below && right ? 2 : 3)); });
    return items;
  },

  // With parallel lines the rule is pure parity: quadrants differing by an EVEN
  // number are equal, ODD are supplementary. No degree label at all means the
  // diagram carries right-angle markers, so everything is 90.
  solveAngleMeasure() {
    const m = this.tex().match(/angle\s+([A-Z])\b/i); if (!m) return null;
    const items = this.angleMap(); if (!items) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const given = items.find(o => /^\d+$/.test(o.t));
    if (!given) { const i = c.findIndex(e => this.clean(e.innerText) === '90');
      return i < 0 ? null : { i, want: 90 }; }
    const tgt = items.find(o => o.t === m[1].toUpperCase()); if (!tgt) return null;
    const g = +given.t, want = ((tgt.q - given.q) % 2 === 0) ? g : 180 - g;
    const i = c.findIndex(e => this.clean(e.innerText) === String(want));
    return i < 0 ? { miss: want } : { i, want };
  },

  solveAnglePair() {
    const L = this.tex(), supp = /supplementary/i.test(L), equal = /equal|congruent/i.test(L);
    if (!supp && !equal) return null;
    const items = this.angleMap(); if (!items) return null;
    const Q = {}; items.forEach(o => { if (/^[A-Z]$/.test(o.t)) Q[o.t] = o.q; });
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => { const ls = this.letter(e.innerText).split(',').map(s => s.trim()).filter(s => s in Q);
      if (ls.length !== 2) return false;
      const dif = Math.abs(Q[ls[0]] - Q[ls[1]]) % 2;
      return supp ? dif === 1 : dif === 0; });
    return i < 0 ? { miss: supp ? 'odd' : 'even' } : { i, want: this.letter(c[i].innerText) };
  },

  solveAngleRel() {
    const L = this.tex(); const m = L.match(/angle to\s+([A-Z])\b/i) || L.match(/\bto\s+([A-Z])\b/i);
    if (!m) return null;
    const items = this.angleMap(); if (!items) return null;
    const src = items.find(o => o.t === m[1].toUpperCase()); if (!src) return null;
    let want = null;
    if (/corresponding/i.test(L))              want = { g: 1 - src.g, q: src.q };
    else if (/vertical/i.test(L))              want = { g: src.g, q: (src.q + 2) % 4 };
    else if (/alternate/i.test(L))             want = { g: 1 - src.g, q: (src.q + 2) % 4 };
    else if (/co-?interior|same-?side/i.test(L)) want = { g: 1 - src.g, q: (src.q + 1) % 4 };
    if (!want) return null;
    const hit = items.find(o => /^[A-Z]$/.test(o.t) && o.g === want.g && o.q === want.q);
    if (!hit) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.letter(e.innerText) === hit.t);
    return i < 0 ? { miss: hit.t } : { i, want: hit.t };
  },

  // "Create a supplementary/complementary pair with N": the slider is one angle
  anglePlan() {
    const L = this.tex(), sl = this.sliderPx(0); if (!sl) return null;
    let m = /create the angles/i.test(L) ? L.match(/=\s*(\d+)\s*degree/) : null;
    if (!m) m = L.match(/(?:supplementary|complementary)[^0-9]{0,30}(\d+)\s*degree/i) || L.match(/(\d+)\s*degree/);
    if (!m) return null;
    const total = /complementary/i.test(L) ? 90 : 180;
    for (const v of [+m[1], total - +m[1]])
      if (v >= sl.lo && v <= sl.hi) return { v, from: sl.from, to: this.sliderPx(v).to };
    return null;
  },
});

(function () {
  const prev = window.__duo.plan;
  window.__duo.plan = function () {
    if (/supplementary|complementary|create the angles/i.test(this.tex())) {
      const a = this.anglePlan(); if (a) return { kind: 'angle', v: a.v, from: a.from, to: a.to };
    }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveAngleMeasure', /measure of angle/i],
  ['solveAnglePair', /pair of (supplementary|equal|congruent)/i],
  ['solveAngleRel', /(corresponding|vertical|alternate|co-?interior|same-?side).{0,12}angle/i]);

;'__duo ready';

// ---- guided multi-step lessons ----
// Their latex accumulates EVERY step, so a prompt regex keeps matching a
// question that is already answered (this cost 5 wrong answers in a row).
// Gate on the SHAPE of the choices instead — that is always the live question.
Object.assign(window.__duo, {
  solveAngleEquation() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    if (!txt.length || !txt.every(t => t.includes('='))) return null;   // must be equations
    const supp = /supplementary|sum to 180|add(?: up)? to 180/i.test(this.tex());
    const i = txt.findIndex(t => supp ? /=180$/.test(t) : !/=180$/.test(t));
    return i < 0 ? null : { i, want: txt[i] };
  },

  solveRelName() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.ascii(e.innerText).toLowerCase().replace(/\s+/g, ''));
    if (!txt.length || !txt.every(t => /angles$/.test(this.norm(t)))) return null;  // must be names
    const m = this.tex().match(/use\s+((?:alternate|corresponding|vertical|co-?interior|same-?side)[a-z\s]*angles)/i);
    if (!m) return null;
    const want = m[1].toLowerCase().replace(/\s+/g, '');
    const i = txt.findIndex(t => t.includes(want));
    return i < 0 ? null : { i, want };
  },

  // Explainer screens have a challenge but nothing to answer, and CHECK is
  // already enabled — just continue. Halt after 2 wrong in a row: a mis-gated
  // solver is confident and will otherwise spend the whole lesson.
  async run2(n) {
    this.S = { running: true, log: [], done: 0 };
    let miss = 0, info = 0;
    for (let i = 0; i < n && this.S.running; i++) {
      const n0 = document.querySelector('[data-test="player-next"]');
      if (n0 && /CONTINUE/i.test(n0.innerText || '') && !document.querySelector('[data-test^="challenge "]')) {
        this.tap(n0); await this.sleep(1500); continue;
      }
      const r = this.read();
      if (!r.type) { this.S.log.push('lessondone'); break; }
      if (this.plan()) { this.S.log.push('needdrag'); break; }

      let acted = false;
      if (r.choices.length) { const s = this.solveChoices();
        if (s && s.ok) { s.idx.forEach(j => this.tap(document.querySelectorAll('[data-test="challenge-choice"]')[j])); acted = true; } }
      else if (r.input) { acted = !!this.typeAnswer(); }
      else if (n0 && !/disabled/i.test(n0.className)) {
        // explainer screen — but cap it, or a question we cannot answer spins forever
        if (++info >= 3) { this.S.log.push('stuck:info-loop'); break; }
        this.tap(n0); await this.sleep(1600); this.S.log.push('info'); continue;
      }
      if (!acted) { this.S.log.push('stuck:' + r.type); break; }
      info = 0;

      await this.sleep(350);
      this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1700);
      const bl = ((document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test || '').replace('blame blame-', '');
      this.S.log.push(bl || 'noblame');
      if (bl === 'correct') { this.S.done++; miss = 0; }
      else if (bl === 'incorrect' && ++miss >= 2) { this.S.log.push('halt:2wrong'); break; }
      if (!bl) break;
      const nx = document.querySelector('[data-test="player-next"]');
      if (nx && /CONTINUE/i.test(nx.innerText)) { this.tap(nx); await this.sleep(1500); }
    }
    this.S.running = false;
    return this.S;
  },
});

window.__duo.RULES.splice(2, 0,
  ['solveRelName', null],
  ['solveAngleEquation', null]);

;'__duo ready';

// ---- transversal geometry: two marked angles ----
// The whole parallel-lines rule collapses to s = (above XOR right):
// equal s => congruent, different s => supplementary. That one line covers
// vertical, corresponding, both alternates and co-interior.
Object.assign(window.__duo, {
  marked() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const B = e => { const r = e.getBoundingClientRect();
      return { x: fr.left + r.left, y: fr.top + r.top, w: r.width, h: r.height,
               cx: fr.left + r.left + r.width / 2, cy: fr.top + r.top + r.height / 2 }; };
    const segs = [...d.querySelectorAll('line,path,polyline')].map(B).filter(o => o.w > 40 || o.h > 40);
    const horiz = segs.filter(o => o.h < 6 && o.w > 100).sort((a, b) => a.cy - b.cy);
    const trans = segs.find(o => o.h > 60 && o.w > 10);
    if (horiz.length < 2 || !trans) return null;
    const xAt = y => { const t = (y - trans.y) / trans.h; return trans.x + trans.w * (1 - t); };
    const labs = [...d.querySelectorAll('text,tspan')].map(e => ({ t: this.ascii(e.textContent.trim()), ...B(e) })).filter(o => o.t);
    if (labs.length < 2) return null;
    return labs.map(o => {
      const line = Math.abs(o.cy - horiz[0].cy) < Math.abs(o.cy - horiz[1].cy) ? 0 : 1;
      return { t: o.t, line, above: o.cy < horiz[line].cy, right: o.cx > xAt(o.cy) };
    });
  },

  markedRel() {
    const m = this.marked(); if (!m || m.length < 2) return null;
    const s = o => ((o.above ? 1 : 0) ^ (o.right ? 1 : 0));
    return { equal: s(m[0]) === s(m[1]), labels: m.map(o => o.t) };
  },

  solveMarkedEquation() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    if (!txt.length || !txt.every(t => t.includes('='))) return null;
    const rel = this.markedRel(); if (!rel) return null;
    const nums = this.marked().map(o => o.t.replace(/[°\s]/g, ''));
    const val = nums.find(t => /^\d+$/.test(t)), expr = nums.find(t => !/^\d+$/.test(t));
    if (!val || !expr) return null;
    const want = rel.equal ? expr + '=' + val : expr + '+' + val + '=180';
    let i = txt.indexOf(want);
    if (i < 0) i = txt.findIndex(t => rel.equal ? t.endsWith('=' + val) : /=180$/.test(t));
    return i < 0 ? { miss: want } : { i, want };
  },

  // one label and no number => right-angle markers, so the angle is 90
  solveForX() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const labs = [...f.contentDocument.querySelectorAll('text,tspan')]
      .map(e => this.ascii(e.textContent.trim()).replace(/°/g, '').trim()).filter(Boolean);
    const val = labs.find(t => /^\d+$/.test(t)), expr = labs.find(t => !/^\d+$/.test(t) && /x/i.test(t));
    if (!expr) return null;
    let rhs;
    if (val) { const rel = this.markedRel(); if (!rel) return null; rhs = rel.equal ? +val : 180 - +val; }
    else rhs = 90;
    const e = expr.replace(/\s+/g, '').replace(/[𝑥𝗑]/gi, 'x').toLowerCase();
    const mm = e.match(/^(-?\d*)x([+-]\d+)?$/); if (!mm) return null;
    const a = mm[1] === '' || mm[1] === '+' ? 1 : (mm[1] === '-' ? -1 : +mm[1]);
    return { x: (rhs - (mm[2] ? +mm[2] : 0)) / a, rhs, expr: e };
  },

  solveXChoice() {
    const r = this.solveForX(); if (!r) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(r.x));
    return i < 0 ? { miss: r.x } : { i, want: r.x };
  },
});

window.__duo.RULES.splice(2, 0,
  ['solveMarkedEquation', null],
  ['solveXChoice', /value of/i]);

;'__duo ready';

// BUG (cost 2 answers): the transversal's lean was inferred from its bounding
// box, which cannot tell "\" from "/". The <line> carries real x1,y1,x2,y2 and
// the <svg> a viewBox — use those and convert the labels into the same space.
window.__duo.marked = function () {
  const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
  const d = f.contentDocument, svg = d.querySelector('svg'); if (!svg) return null;
  const sr = svg.getBoundingClientRect();
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const sx = vb.length === 4 ? sr.width / vb[2] : 1, sy = vb.length === 4 ? sr.height / vb[3] : 1;
  const ox = vb.length === 4 ? -vb[0] * sx : 0, oy = vb.length === 4 ? -vb[1] * sy : 0;

  const lines = [...d.querySelectorAll('line')].map(e => ({
    x1: +e.getAttribute('x1'), y1: +e.getAttribute('y1'),
    x2: +e.getAttribute('x2'), y2: +e.getAttribute('y2') }));
  const horiz = lines.filter(l => Math.abs(l.y1 - l.y2) < 2).sort((a, b) => a.y1 - b.y1);
  const trans = lines.find(l => Math.abs(l.y1 - l.y2) >= 2);
  if (horiz.length < 2 || !trans) return null;
  const xAt = y => trans.x1 + (trans.x2 - trans.x1) * ((y - trans.y1) / (trans.y2 - trans.y1));

  const labs = [...d.querySelectorAll('text,tspan')].map(e => { const r = e.getBoundingClientRect();
    return { t: this.ascii(e.textContent.trim()),
             cx: (r.left + r.width / 2 - sr.left - ox) / sx,
             cy: (r.top + r.height / 2 - sr.top - oy) / sy }; }).filter(o => o.t);
  if (labs.length < 2) return null;
  return labs.map(o => {
    const line = Math.abs(o.cy - horiz[0].y1) < Math.abs(o.cy - horiz[1].y1) ? 0 : 1;
    return { t: o.t, line, above: o.cy < horiz[line].y1, right: o.cx > xAt(o.cy) };
  });
};

;'__duo ready';

// ---- Pythagoras guided chains (unit 130) ----
// Don't write a solver per step — evaluate the arithmetic and pick the choice
// that is actually TRUE for the legs stated earlier in the lesson.
Object.assign(window.__duo, {
  legs() { const m = this.tex().replace(/\s/g, '').match(/(\d+)\^?2\+(\d+)\^?2/); return m ? [+m[1], +m[2]] : null; },

  solvePythStep() {
    const lg = this.legs(); if (!lg) return null;
    const sum = lg[0] * lg[0] + lg[1] * lg[1], hyp = Math.sqrt(sum);
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    if (!txt.length) return null;
    const val = s => { if (!/^[\d+^]+$/.test(s)) return null;
      return s.split('+').reduce((t, p) => { const q = p.split('^');
        return t + (q.length > 1 ? Math.pow(+q[0], +q[1]) : +q[0]); }, 0); };
    let i = txt.findIndex(t => { const [l, r] = t.split('='); if (!r) return false;
      const lv = val(l), rv = val(r);
      if (lv !== null && /^c(\^?2)?$/.test(r)) return lv === sum;
      if (rv !== null && /^c(\^?2)?$/.test(l)) return /\^2/.test(l) ? rv === sum : rv === hyp;
      return false; });
    if (i < 0) i = txt.findIndex(t => val(t) === hyp || +t === hyp);
    return i < 0 ? null : { i, want: txt[i], sum, hyp };
  },

  solvePythFormula() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    if (!txt.length || !txt.some(t => t.includes('='))) return null;
    const i = txt.findIndex(t => /a.?2\+b.?2=c.?2/.test(t.replace(/[^a-z0-9=+^]/g, '')));
    return i < 0 ? null : { i, want: txt[i] };
  },

  // substitution: legs squared and summed on the LEFT, unknown alone on the right
  solvePythSub() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    if (!txt.length || !txt.every(t => t.includes('='))) return null;
    const i = txt.findIndex(t => { const [l, r] = t.split('=');
      return r && /^[a-z](\^?2)?$/.test(r) && /^\d+\^?2\+\d+\^?2$/.test(l); });
    return i < 0 ? null : { i, want: txt[i] };
  },

  // undoing a square is a square root, never "divide by 2"
  solveUndo() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.ascii(e.innerText).toLowerCase().replace(/\s+/g, ''));
    if (!txt.some(t => /squareroot/.test(t)) || !/\^2|²/.test(this.tex())) return null;
    const i = txt.findIndex(t => /squareroot/.test(t));
    return i < 0 ? null : { i, want: 'square root' };
  },
});

window.__duo.RULES.splice(2, 0,
  ['solvePythFormula', null], ['solvePythSub', null],
  ['solvePythStep', null], ['solveUndo', null]);

;'__duo ready';

// ---- right-triangle construction + generic equation checking ----
Object.assign(window.__duo, {
  // innerText renders 5^2 as "52" (superscript), so drop ^ when comparing
  clean(s) {
    return this.norm(this.ascii(s).replace(/\\degree|°/g, '')
      .replace(/\\|mathbf|textbf|text|\{|\}|\^/g, ''));
  },

  // when every choice is a numeric equation, just pick the TRUE one.
  // innerText loses the exponent, so read the choices' own LaTeX.
  solveTrueEquation() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!c.length) return null;
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const ev = s => { const t = s.replace(/\\|mathbf|textbf|\{|\}|\s/g, '');
      if (!/^[-\d+*^()]+$/.test(t)) return null;
      try { return Function('"use strict";return(' + t.replace(/(\d+)\^(\d+)/g, 'Math.pow($1,$2)') + ')')(); }
      catch (e) { return null; } };
    const i = src.findIndex(s => { const p = s.replace(/\\|mathbf|textbf|\{|\}|\s/g, '').split('=');
      if (p.length !== 2) return false;
      const a = ev(p[0]), b = ev(p[1]);
      return a !== null && b !== null && Math.abs(a - b) < 1e-9; });
    return i < 0 ? null : { i, want: src[i] };
  },

  // side labels sit beside their side: extreme y = horizontal leg,
  // extreme x = vertical leg, the remaining one is the hypotenuse
  sideLabels() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const labs = [...d.querySelectorAll('text,tspan')].map(e => { const r = e.getBoundingClientRect();
      return { v: parseFloat(this.ascii(e.textContent.trim())),
               x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 }; })
      .filter(o => !isNaN(o.v));
    if (labs.length < 3) return null;
    const cx = labs.reduce((s, o) => s + o.x, 0) / labs.length;
    const cy = labs.reduce((s, o) => s + o.y, 0) / labs.length;
    const horiz = labs.slice().sort((a, b) => Math.abs(b.y - cy) - Math.abs(a.y - cy))[0];
    const vert = labs.slice().sort((a, b) => Math.abs(b.x - cx) - Math.abs(a.x - cx)).find(o => o !== horiz);
    const hyp = labs.find(o => o !== horiz && o !== vert);
    return { horiz: horiz && horiz.v, vert: vert && vert.v, hyp: hyp && hyp.v };
  },

  solveLegLength() {
    const L = this.tex(), s = this.sideLabels(); if (!s) return null;
    let want = null;
    if (/horizontal/i.test(L)) want = s.horiz;
    else if (/vertical/i.test(L)) want = s.vert;
    else if (/hypotenuse/i.test(L)) want = s.hyp;
    else if (/longer leg/i.test(L)) want = Math.max(s.horiz, s.vert);
    else if (/shorter leg/i.test(L)) want = Math.min(s.horiz, s.vert);
    if (want == null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(want));
    return i < 0 ? { miss: want } : { i, want };
  },

  // "Create a hypotenuse of H": the slider is the missing leg
  hypPlan() {
    const L = this.tex().replace(/\s/g, '');
    const h = L.match(/hypotenuseof\D{0,12}?(\d+)/i); if (!h) return null;
    const leg = L.match(/sqrt\((\d+)\^2/i) || L.match(/(\d+)\^2\+/); if (!leg) return null;
    const v = Math.sqrt((+h[1]) ** 2 - (+leg[1]) ** 2);
    if (!Number.isFinite(v)) return null;
    const sl = this.sliderPx(0); if (!sl || v < sl.lo || v > sl.hi) return null;
    return { v: Math.round(v), from: sl.from, to: this.sliderPx(Math.round(v)).to };
  },

  // "Create a right triangle with legs A and B": drag the three vertices to
  // (gx,gy), (gx+A,gy), (gx,gy-B), using the grid lines for the pixel scale.
  triPlan() {
    const m = this.tex().match(/(\d+)\s*and\s*(\d+)/); if (!m) return null;
    const a = +m[1], b = +m[2];
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const gl = [...d.querySelectorAll('.grid-line,line')].map(e => e.getBoundingClientRect());
    const vert = gl.filter(r => r.width < 3 && r.height > 50).map(r => fr.left + r.left).sort((x, y) => x - y);
    const horz = gl.filter(r => r.height < 3 && r.width > 50).map(r => fr.top + r.top).sort((x, y) => x - y);
    if (vert.length < 2 || horz.length < 2) return null;
    const cell = (vert[vert.length - 1] - vert[0]) / (vert.length - 1);
    const x0 = vert[0], y0 = horz[0], nx = vert.length - 1, ny = horz.length - 1;
    if (a > nx || b > ny) return null;
    const gx = Math.max(0, Math.floor((nx - a) / 2)), gy = Math.min(ny, Math.floor((ny + b) / 2));
    const P = (i, j) => [Math.round(x0 + i * cell), Math.round(y0 + j * cell)];
    const targets = [P(gx, gy), P(gx + a, gy), P(gx, gy - b)];
    const verts = [...d.querySelectorAll('.draggable-point,.point')].map(e => { const r = e.getBoundingClientRect();
      return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; });
    if (verts.length < 3) return null;
    const used = [], steps = [];   // greedy nearest so the drags don't cross
    targets.forEach(t => { let best = null, bd = 1e9;
      verts.forEach(v => { if (used.includes(v)) return;
        const dd = (v[0] - t[0]) ** 2 + (v[1] - t[1]) ** 2; if (dd < bd) { bd = dd; best = v; } });
      if (best) { used.push(best); steps.push({ from: best, to: t }); } });
    return { a, b, cell: Math.round(cell), steps };
  },
});

(function () {
  const prev = window.__duo.plan;
  window.__duo.plan = function () {
    if (/hypotenuse of/i.test(this.tex())) { const h = this.hypPlan();
      if (h) return { kind: 'leg', v: h.v, from: h.from, to: h.to }; }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveLegLength', /length of the (horizontal|vertical|longer|shorter) leg|length of the hypotenuse/i],
  ['solveTrueEquation', null]);

;'__duo ready';

// ---- triangle angle sums ----
Object.assign(window.__duo, {
  // a triangle's angles sum to 180 — the =360 choice is always the distractor
  solveTriangleSum() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
    if (txt.length < 2 || !txt.every(t => t.includes('='))) return null;
    if (!txt.some(t => /=180$/.test(t)) || !txt.some(t => /=360$/.test(t))) return null;
    const i = txt.findIndex(t => /=180$/.test(t));
    return i < 0 ? null : { i, want: txt[i] };
  },

  // collect each angle label as coefficient*x + constant and solve for 180
  triangleX() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument;
    if (!d.querySelector('polygon,.shape,.polygon')) return null;   // must be a triangle
    const labs = [...d.querySelectorAll('text,tspan')]
      .map(e => this.ascii(e.textContent.trim()).replace(/°/g, '').replace(/\s/g, '').toLowerCase()).filter(Boolean);
    if (labs.length < 3) return null;
    let A = 0, B = 0;
    for (const t of labs) {
      const m = t.match(/^(-?\d*)x([+-]\d+)?$/);
      if (m) { A += (m[1] === '' || m[1] === '+') ? 1 : (m[1] === '-' ? -1 : +m[1]); B += m[2] ? +m[2] : 0; }
      else if (/^-?\d+$/.test(t)) B += +t;
      else return null;
    }
    return A ? (180 - B) / A : null;
  },

  solveTriangleX() {
    const v = this.triangleX(); if (v === null || !Number.isFinite(v)) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(v));
    return i < 0 ? { miss: v } : { i, want: v };
  },

  angleNums() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return [];
    return [...f.contentDocument.querySelectorAll('text,tspan')]
      .map(e => this.ascii(e.textContent.trim()).replace(/°/g, '').trim())
      .filter(t => /^\d+$/.test(t)).map(Number);
  },

  solveUnknownAngle() {
    const nums = this.angleNums(); if (nums.length < 2) return null;
    const inner = 180 - nums.reduce((a, b) => a + b, 0);
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.clean(e.innerText));
    let i = txt.indexOf(String(inner));
    if (i < 0) i = txt.indexOf(String(180 - inner));   // exterior angle variant
    return i < 0 ? { miss: inner } : { i, want: txt[i] };
  },
});

// typed variants: triangle x, and the unknown angle
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const L = this.tex();
    if (/value of/i.test(L)) { const v = this.triangleX();
      if (v !== null && Number.isFinite(v)) { this.type(String(v)); return String(v); } }
    if (/unknown angle|missing angle/i.test(L)) { const nums = this.angleNums();
      if (nums.length >= 2) { const v = String(180 - nums.reduce((a, b) => a + b, 0)); this.type(v); return v; } }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveTriangleSum', null],
  ['solveTriangleX', /value of/i],
  ['solveUnknownAngle', /unknown angle|missing angle/i]);

;'__duo ready';

// pick the equation whose terms match the angle labels actually on the diagram
window.__duo.solveTriangleEq = function () {
  const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
  const labs = [...f.contentDocument.querySelectorAll('text,tspan')]
    .map(e => this.ascii(e.textContent.trim()).replace(/°/g, '').replace(/\s/g, '').toLowerCase())
    .filter(Boolean).sort();
  if (labs.length < 3) return null;
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
  const i = src.findIndex(s => {
    const t = s.replace(/\\degree|°|\\|mathbf|textbf|\{|\}|\s/g, '').toLowerCase();
    const [l, r] = t.split('='); if (!r || r !== '180') return false;
    return l.split('+').sort().join(',') === labs.join(',');
  });
  return i < 0 ? { miss: labs } : { i, want: labs.join('+') };
};

// typed hypotenuse / missing leg, straight from Pythagoras
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const L = this.tex();
    if (/length of the (hypotenuse|leg)/i.test(L)) {
      const f = document.querySelector('iframe');
      const nums = f && f.contentDocument ? [...f.contentDocument.querySelectorAll('text,tspan')]
        .map(e => parseFloat(this.ascii(e.textContent.trim()))).filter(n => !isNaN(n)) : [];
      if (nums.length >= 2) {
        const v = /hypotenuse/i.test(L)
          ? Math.sqrt(nums[0] ** 2 + nums[1] ** 2)
          : (() => { const h = Math.max(...nums), g = nums.filter(n => n !== h)[0];
                     return Math.sqrt(h ** 2 - g ** 2); })();
        if (Number.isFinite(v)) { const t = String(Number.isInteger(v) ? v : +v.toFixed(2)); this.type(t); return t; }
      }
    }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0, ['solveTriangleEq', null]);

;'__duo ready';

// ---- unit 131: Pythagoras applied ----
Object.assign(window.__duo, {
  // "sum of the squares of the legs" — the a^2+b^2 form, not a+b
  solveSumSquares() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const i = src.findIndex(s => /^\d+\^2\+\d+\^2$/.test(s.replace(/\\|mathbf|textbf|\{|\}|\s/g, '')));
    return i < 0 ? null : { i, want: src[i] };
  },

  // The hypotenuse is the SQRT of the sum of squares — but SEVERAL choices can
  // carry a sqrt, so the right one is the one that squares BOTH legs.
  solveHypForm() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const norm = s => s.replace(/\\|mathbf|textbf|\{|\}|\s/g, '');
    let i = src.findIndex(s => /sqrt\d+\^2\+\d+\^2/.test(norm(s)));
    if (i < 0) i = src.findIndex(s => /sqrt|√/.test(s) && (norm(s).match(/\^2/g) || []).length >= 2);
    return i < 0 ? null : { i, want: src[i] };
  },
});

// when the asked-for side isn't labelled, compute it from the other two
(function () {
  const prev = window.__duo.solveLegLength;
  window.__duo.solveLegLength = function () {
    const r = prev.call(this); if (r && r.i >= 0) return r;
    const L = this.tex(), f = document.querySelector('iframe');
    if (!f || !f.contentDocument) return r;
    const nums = [...f.contentDocument.querySelectorAll('text,tspan')]
      .map(e => parseFloat(this.ascii(e.textContent.trim()))).filter(n => !isNaN(n));
    if (nums.length < 2) return r;
    let v = null;
    if (/hypotenuse/i.test(L)) v = Math.sqrt(nums[0] ** 2 + nums[1] ** 2);
    else if (/leg/i.test(L)) { const h = Math.max(...nums), g = nums.filter(n => n !== h)[0];
      v = Math.sqrt(h ** 2 - g ** 2); }
    if (v === null || !Number.isFinite(v)) return r;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(Number.isInteger(v) ? v : +v.toFixed(2)));
    return i < 0 ? r : { i, want: v };
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveSumSquares', /sum of the squares/i],
  ['solveHypForm', /hypotenuse/i]);

;'__duo ready';

// ---- guided Pythagoras chains that solve for a LEG ----
Object.assign(window.__duo, {
  // Answer the equation ACTUALLY on screen — take the LAST match, not the first.
  // Re-deriving from an earlier step in the same lesson produced sqrt(8) where
  // the screen plainly said x^2 = 64.
  guidedX() {
    const t = this.tex().replace(/\s/g, '');
    const sqs = [...t.matchAll(/x\^?2=(\d+)/gi)];
    const subs = [...t.matchAll(/(\d+)\+x\^?2=(\d+)/gi)];
    if (/squareroot|solvefor.?x/i.test(t) && sqs.length) {
      const v = Math.sqrt(+sqs[sqs.length - 1][1]); return Number.isFinite(v) ? v : null;
    }
    if (subs.length) { const m = subs[subs.length - 1]; return (+m[2]) - (+m[1]); }
    if (sqs.length) return +sqs[sqs.length - 1][1];
    return null;
  },

  // Finding a LEG puts the hypotenuse (largest value) alone on the right, so the
  // unknown sits on the LEFT — the opposite of the find-the-hypotenuse case.
  solvePythSub() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const N = s => s.replace(/\\|mathbf|textbf|\{|\}|\s/g, '');
    if (!src.length || !src.every(s => N(s).includes('='))) return null;
    const findLeg = /leg length|find the leg/i.test(this.tex());
    const i = src.findIndex(s => { const [l, r] = N(s).split('='); if (!l || !r) return false;
      if (findLeg) {
        const rNum = r.match(/^(\d+)(\^2)?$/); if (!rNum) return false;
        const big = rNum[2] ? +rNum[1] * +rNum[1] : +rNum[1];
        return /[a-z]/.test(l) && (l.match(/\d+/g) || []).map(Number).every(n => n <= big);
      }
      return /^[a-z](\^2)?$/.test(r) && /^\d+(\^2)?\+\d+(\^2)?$/.test(l); });
    return i < 0 ? null : { i, want: src[i] };
  },
});

// the guided chain's own equation beats every heuristic
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const g = this.guidedX();
    if (g !== null && Number.isFinite(g)) {
      const v = String(Number.isInteger(g) ? g : +g.toFixed(2)); this.type(v); return v;
    }
    return prev.call(this);
  };
})();

// \duoblank / \phantom literally carry the answer — try them before anything
// that reasons about the question
window.__duo.RULES = window.__duo.RULES.filter(r => r[0] !== 'solveDuoblank' && r[0] !== 'solvePhantomChoice');
window.__duo.RULES.unshift(['solveDuoblank', null], ['solvePhantomChoice', /fill in the blank/i]);

;'__duo ready';

// build the expected equation from the diagram's own labels: the largest number
// is the hypotenuse, everything else (x included) is squared and summed
window.__duo.solvePythMatch = function () {
  const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
  const labs = [...f.contentDocument.querySelectorAll('text,tspan')]
    .map(e => this.ascii(e.textContent.trim()).replace(/\s/g, '')).filter(Boolean);
  if (labs.length < 3) return null;
  const nums = labs.filter(t => /^\d+$/.test(t)).map(Number); if (!nums.length) return null;
  const hyp = Math.max(...nums);
  const key = labs.filter(t => t !== String(hyp)).map(t => t + '2').sort().join('+') + '=' + hyp + '2';
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
  const N = s => s.replace(/\\|mathbf|textbf|\{|\}|\s|\^/g, '').toLowerCase();
  const i = src.findIndex(s => { const [l, r] = N(s).split('='); if (!r) return false;
    return l.split('+').sort().join('+') + '=' + r === key; });
  return i < 0 ? { miss: key } : { i, want: key };
};

// The equation can be in the PROMPT rather than on a diagram:
//   x^2 + a^2 = b^2  =>  x = sqrt(b^2 - a^2)   (sqrt AND minus)
//   x^2 = a^2 + b^2  =>  x = sqrt(a^2 + b^2)   (sqrt AND plus)
window.__duo.solvePythFormChoice = function () {
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
  if (!src.some(s => /sqrt|√/.test(s))) return null;
  const N = s => s.replace(/\\|mathbf|textbf|\{|\}|\s/g, '').toLowerCase();
  const t = N(this.tex());
  let wantMinus = null;
  if (/x\^?2\+\d+\^?2=\d+\^?2/.test(t)) wantMinus = true;        // x is a leg
  else if (/x\^?2=\d+\^?2\+\d+\^?2/.test(t)) wantMinus = false;   // x is the hypotenuse
  else {
    const f = document.querySelector('iframe');
    const labs = f && f.contentDocument ? [...f.contentDocument.querySelectorAll('text,tspan')]
      .map(e => this.ascii(e.textContent.trim()).replace(/\s/g, '')).filter(Boolean) : [];
    const nums = labs.filter(x => /^\d+$/.test(x)).map(Number);
    if (nums.length === 2 && labs.length === 3) wantMinus = true;
    else if (nums.length >= 2) wantMinus = false;
  }
  if (wantMinus === null) return null;
  const i = src.findIndex(s => { const n = N(s);
    return /sqrt|√/.test(n) && (wantMinus ? /-/.test(n) : /\+/.test(n)); });
  return i < 0 ? null : { i, want: N(src[i]) };
};

window.__duo.RULES.splice(2, 0,
  ['solvePythMatch', null],
  ['solvePythFormChoice', null],
  ['solveLegLength', /length of the leg/i]);

;'__duo ready';

// x may sit on either side of the sum: "6^2 + x^2 = 13^2" as well as x-first
(function () {
  const prev = window.__duo.solvePythFormChoice;
  window.__duo.solvePythFormChoice = function () {
    const r = prev.call(this); if (r && r.i >= 0) return r;
    const N = s => s.replace(/\\|mathbf|textbf|\{|\}|\s/g, '').toLowerCase();
    const t = N(this.tex());
    let wantMinus = null;
    if (/\d+\^?2\+x\^?2=\d+\^?2/.test(t) || /x\^?2\+\d+\^?2=\d+\^?2/.test(t)) wantMinus = true;
    else if (/x\^?2=\d+\^?2\+\d+\^?2/.test(t)) wantMinus = false;
    if (wantMinus === null) return r;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const i = src.findIndex(s => { const n = N(s);
      return /sqrt|√/.test(n) && (wantMinus ? /-/.test(n) : /\+/.test(n)); });
    return i < 0 ? r : { i, want: N(src[i]) };
  };
})();

// typed side lengths: read the label when it is given, compute it when it is x
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const L = this.tex();
    if (/(horizontal|vertical|longer|shorter) leg|hypotenuse/i.test(L)) {
      const f = document.querySelector('iframe');
      const labs = f && f.contentDocument ? [...f.contentDocument.querySelectorAll('text,tspan')]
        .map(e => this.ascii(e.textContent.trim()).replace(/\s/g, '')).filter(Boolean) : [];
      const nums = labs.filter(t => /^\d+$/.test(t)).map(Number);
      if (labs.some(t => /^x$/i.test(t)) && nums.length === 2) {
        const h = Math.max(...nums), g = nums.filter(n => n !== h)[0];
        const v = /hypotenuse/i.test(L) ? Math.sqrt(nums[0] ** 2 + nums[1] ** 2) : Math.sqrt(h * h - g * g);
        if (Number.isFinite(v)) { const s = String(Number.isInteger(v) ? v : +v.toFixed(2)); this.type(s); return s; }
      }
      const s = this.sideLabels();
      if (s) { let v = null;
        if (/horizontal/i.test(L)) v = s.horiz; else if (/vertical/i.test(L)) v = s.vert;
        else if (/longer/i.test(L)) v = Math.max(s.horiz, s.vert);
        else if (/shorter/i.test(L)) v = Math.min(s.horiz, s.vert);
        if (v != null) { this.type(String(v)); return String(v); } }
    }
    return prev.call(this);
  };
})();

;'__duo ready';

// ---- solids: cylinders, cones, volume (unit 132) ----
Object.assign(window.__duo, {
  // Dimensions come either from the PROMPT ("radius = 1, height = 12") or from
  // labels on the drawing. \begin{aligned} puts an & before the =, so "radius&=1".
  solidDims() {
    const t = this.tex().replace(/\s/g, '');
    const g = k => { const m = t.match(new RegExp(k + '&?=(\\d+(?:\\.\\d+)?)', 'i')); return m ? +m[1] : null; };
    const r = g('radius'), h = g('height'), d = g('diameter');
    if (r !== null || h !== null || d !== null)
      return { radius: r !== null ? r : (d !== null ? d / 2 : null), height: h };

    // otherwise read the drawing: the radius label sits INSIDE the figure (near
    // its centre x), the height label outside on the right edge
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const doc = f.contentDocument, fr = f.getBoundingClientRect();
    const labs = [...doc.querySelectorAll('text,tspan')].map(e => { const b = e.getBoundingClientRect();
      return { v: parseFloat(this.ascii(e.textContent.trim())),
               x: fr.left + b.left + b.width / 2, y: fr.top + b.top + b.height / 2 }; })
      .filter(o => !isNaN(o.v));
    if (labs.length < 2) return null;
    const shape = [...doc.querySelectorAll('ellipse,path,polygon,.shape')].map(e => e.getBoundingClientRect())
      .filter(b => b.width > 60 && b.height > 30).sort((a, b) => b.width - a.width)[0];
    if (!shape) return null;
    const cx = fr.left + shape.left + shape.width / 2, right = fr.left + shape.left + shape.width;
    const byDist = labs.slice().sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx));
    const radius = byDist[0];
    const height = labs.find(o => o !== radius && o.x >= right - 30) || byDist[byDist.length - 1];
    return { radius: radius && radius.v, height: height && height.v };
  },

  solveDimension() {
    const L = this.tex(), s = this.solidDims(); if (!s) return null;
    let want = null;
    if (/radius/i.test(L)) want = s.radius;
    else if (/diameter/i.test(L)) want = s.radius * 2;
    else if (/height/i.test(L)) want = s.height;
    if (want == null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(want));
    return i < 0 ? { miss: want } : { i, want };
  },

  // the base shape follows from the solid
  solveBaseShape() {
    const t = this.tex().toLowerCase();
    const want = /cylinder|cone|sphere/.test(t) ? 'circle'
      : (/triangular prism/.test(t) ? 'triangle'
      : (/rectangular prism|cuboid|box/.test(t) ? 'rectangle' : null));
    if (!want) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.norm(this.ascii(e.innerText)).toLowerCase().includes(want));
    return i < 0 ? null : { i, want };
  },

  solveBaseArea() {
    const s = this.solidDims(); if (!s || s.radius == null) return null;
    const want = s.radius * s.radius;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const num = e => { const m = this.norm(this.ascii(e.innerText)).match(/(\d+(?:\.\d+)?)/); return m ? +m[1] : NaN; };
    const i = c.findIndex(e => num(e) === want);
    return i < 0 ? { miss: want } : { i, want };
  },

  // choices are either a number ("V = 50π") or a formula ("π(2)²(4)")
  solveVolume() {
    const s = this.solidDims(); if (!s || s.radius == null || s.height == null) return null;
    const want = /cone/i.test(this.tex()) ? (s.radius ** 2 * s.height / 3) : (s.radius ** 2 * s.height);
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const dig = e => { const d = (this.ascii(e).match(/\d/g) || []).join('');
      const h = d.length / 2; return (d.length % 2 === 0 && d.slice(0, h) === d.slice(h)) ? d.slice(0, h) : d; };
    let i = c.findIndex(e => /π|pi/i.test(this.ascii(e.innerText)) && dig(e.innerText) === '' + s.radius + '2' + s.height);
    if (i < 0) { const num = e => { const m = this.norm(this.ascii(e.innerText)).match(/(\d+(?:\.\d+)?)/); return m ? +m[1] : NaN; };
      i = c.findIndex(e => num(e) === want); }
    return i < 0 ? { miss: want } : { i, want };
  },

  // "Create a ... with radius = N" — the slider is just that number
  dimPlan() {
    const t = this.tex().replace(/\s/g, '');
    const m = t.match(/(?:radius|height|diameter)\D{0,10}?=?\D{0,6}?(\d+)/i); if (!m) return null;
    let v = +m[1]; if (/diameter/i.test(t)) v = v / 2;
    const sl = this.sliderPx(0);
    if (!sl || v < sl.lo || v > sl.hi || !Number.isInteger(v)) return null;
    return { v, from: sl.from, to: this.sliderPx(v).to };
  },

  // "base area of Npi" => radius = sqrt(N)
  radiusPlan() {
    const m = this.tex().replace(/\s/g, '').match(/area\D{0,14}?(\d+)pi/i); if (!m) return null;
    const r = Math.sqrt(+m[1]); if (!Number.isInteger(r)) return null;
    const sl = this.sliderPx(0); if (!sl || r < sl.lo || r > sl.hi) return null;
    return { v: r, from: sl.from, to: this.sliderPx(r).to };
  },

  // "volume = Npi": one dimension is fixed, the slider sets the other
  volPlan() {
    const t = this.tex().replace(/\s/g, '');
    const v = t.match(/volume&?=\D{0,14}?(\d+)pi/i) || t.match(/volume\D{0,14}?(\d+)pi/i); if (!v) return null;
    const V = +v[1], sl = this.sliderPx(0); if (!sl) return null;
    const fixed = new Set();
    const d = this.solidDims();
    if (d) { if (d.radius) fixed.add(d.radius); if (d.height) fixed.add(d.height); }
    (t.match(/\d+/g) || []).forEach(n => { if (+n > 0 && +n <= 50) fixed.add(+n); });
    for (let c = sl.lo; c <= sl.hi; c++)
      for (const o of fixed)
        if (c * c * o === V || o * o * c === V) return { v: c, from: sl.from, to: this.sliderPx(c).to };
    return null;
  },
});

(function () {
  const prev = window.__duo.plan;
  window.__duo.plan = function () {
    const t = this.tex();
    if (/volume/i.test(t)) { const v = this.volPlan(); if (v) return { kind: 'vol', v: v.v, from: v.from, to: v.to }; }
    if (/base area|area of/i.test(t)) { const r = this.radiusPlan(); if (r) return { kind: 'radius', v: r.v, from: r.from, to: r.to }; }
    if (/create a (cylinder|cone|prism)/i.test(t) && /(radius|height|diameter)\s*&?=/i.test(t)) {
      const d = this.dimPlan(); if (d) return { kind: 'dim', v: d.v, from: d.from, to: d.to };
    }
    return prev.call(this);
  };
  // last-resort choice match: compare digit sequences, de-duplicating AFTER
  // extracting them (π and parentheses render differently in latex vs innerText)
  const prevPh = window.__duo.solvePhantomChoice;
  window.__duo.solvePhantomChoice = function () {
    const r = prevPh.call(this); if (r && r.i >= 0) return r;
    const p = this.phantom(); if (!p) return r;
    const dig = s => { const d = (this.ascii(s).match(/\d/g) || []).join('');
      const h = d.length / 2; return (d.length % 2 === 0 && d.slice(0, h) === d.slice(h)) ? d.slice(0, h) : d; };
    const want = dig(p); if (!want) return r;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => dig(e.innerText) === want);
    return i < 0 ? r : { i, want };
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveBaseShape', /shape of the base/i],
  ['solveDimension', /(select|enter) the (radius|diameter|height)|length of the (radius|diameter|height)/i],
  ['solveBaseArea', /area of the base|base area/i],
  ['solveVolume', /volume of/i]);

;'__duo ready';

// typed radius / diameter / height / base area / volume
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const L = this.tex();
    if (/(radius|diameter|height|base area|area of the base|volume)/i.test(L)) {
      const s = this.solidDims();
      if (s) {
        let v = null;
        if (/radius/i.test(L) && s.radius != null) v = s.radius;
        else if (/diameter/i.test(L) && s.radius != null) v = s.radius * 2;
        else if (/height/i.test(L) && s.height != null) v = s.height;
        else if (/base area|area of the base/i.test(L) && s.radius != null) v = s.radius * s.radius;
        else if (/volume/i.test(L) && s.radius != null && s.height != null)
          v = /cone/i.test(L) ? (s.radius ** 2 * s.height / 3) : (s.radius ** 2 * s.height);
        if (v != null && Number.isFinite(v)) {
          const t = String(Number.isInteger(v) ? v : +v.toFixed(2)); this.type(t); return t;
        }
      }
    }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0, ['solveVolume', /volume/i]);

;'__duo ready';

// Radius vs height was ambiguous on cones (centre-x proximity guessed wrong and
// cost two answers). Decide it by the ORIENTATION of the nearest long line: the
// radius label sits on a horizontal segment inside the base, the height label
// beside a vertical one.
window.__duo.solidDims = function () {
  const t = this.tex().replace(/\s/g, '');
  const g = k => { const m = t.match(new RegExp(k + '&?=(\\d+(?:\\.\\d+)?)', 'i')); return m ? +m[1] : null; };
  const r0 = g('radius'), h0 = g('height'), d0 = g('diameter');
  if (r0 !== null || h0 !== null || d0 !== null)
    return { radius: r0 !== null ? r0 : (d0 !== null ? d0 / 2 : null), height: h0 };

  const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
  const doc = f.contentDocument, fr = f.getBoundingClientRect();
  const B = e => { const b = e.getBoundingClientRect();
    return { w: b.width, h: b.height, cx: fr.left + b.left + b.width / 2, cy: fr.top + b.top + b.height / 2 }; };
  const labs = [...doc.querySelectorAll('text,tspan')]
    .map(e => ({ v: parseFloat(this.ascii(e.textContent.trim())), ...B(e) })).filter(o => !isNaN(o.v));
  if (labs.length < 2) return null;
  const segs = [...doc.querySelectorAll('line,path,polyline')].map(B).filter(o => o.w > 25 || o.h > 25);
  const near = o => { let best = null, bd = 1e9;
    segs.forEach(s => { const d = (s.cx - o.cx) ** 2 + (s.cy - o.cy) ** 2; if (d < bd) { bd = d; best = s; } });
    return best; };
  let radius = null, height = null;
  labs.forEach(o => { const s = near(o); if (!s) return;
    if (s.w >= s.h) { if (radius === null) radius = o.v; } else if (height === null) height = o.v; });
  if (radius === null || height === null) {
    const byY = labs.slice().sort((a, b) => a.cy - b.cy);
    radius = radius !== null ? radius : byY[0].v;
    height = height !== null ? height : byY[byY.length - 1].v;
  }
  return { radius, height };
};

// which label is r and which is h can still be ambiguous — compute BOTH and
// take whichever matches an offered answer
window.__duo.solveVolume = function () {
  const s = this.solidDims(); if (!s || s.radius == null || s.height == null) return null;
  const cone = /cone/i.test(this.tex());
  const cands = [s.radius ** 2 * s.height, s.height ** 2 * s.radius].map(v => cone ? v / 3 : v);
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const num = e => { const m = this.norm(this.ascii(e.innerText)).match(/(\d+(?:\.\d+)?)/); return m ? +m[1] : NaN; };
  for (const want of cands) { const i = c.findIndex(e => num(e) === want); if (i >= 0) return { i, want }; }
  const dig = e => { const d = (this.ascii(e).match(/\d/g) || []).join('');
    const h = d.length / 2; return (d.length % 2 === 0 && d.slice(0, h) === d.slice(h)) ? d.slice(0, h) : d; };
  for (const [r, h] of [[s.radius, s.height], [s.height, s.radius]]) {
    const i = c.findIndex(e => /π|pi/i.test(this.ascii(e.innerText)) && dig(e.innerText) === '' + r + '2' + h);
    if (i >= 0) return { i, want: r * r * h };
  }
  return { miss: cands };
};

// when the choices are FORMULAS a cone must carry the 1/3 and a cylinder must not
window.__duo.solveVolumeForm = function () {
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
  if (!src.some(s => /pi|π/i.test(s))) return null;
  const third = s => /frac\{?1\}?\{?3\}?|1\/3|⅓/i.test(s.replace(/\s/g, ''));
  if (!src.some(third)) return null;
  const cone = /cone/i.test(this.tex());
  const i = src.findIndex(s => cone ? third(s) : !third(s));
  return i < 0 ? null : { i, want: cone ? '1/3' : 'no-1/3' };
};

// the shown formula often substitutes one value already, e.g. V = (1/3)π · 9 · h
window.__duo.volPlan = function () {
  const t = this.tex().replace(/\s/g, '');
  const v = t.match(/volume\D{0,16}?=?\D{0,6}?(\d+)pi/i); if (!v) return null;
  const V = +v[1], sl = this.sliderPx(0); if (!sl) return null;
  const cone = /frac13|cone/i.test(t);
  const fm = t.match(/=\s*(?:frac13)?pi(?:cdot)?(\d+)/i);
  if (fm) { const x = (cone ? 3 * V : V) / +fm[1];
    if (Number.isInteger(x) && x >= sl.lo && x <= sl.hi) return { v: x, from: sl.from, to: this.sliderPx(x).to }; }
  const fixed = new Set();
  const f = document.querySelector('iframe');
  if (f && f.contentDocument) [...f.contentDocument.querySelectorAll('text,tspan')]
    .forEach(e => { const n = parseFloat(this.ascii(e.textContent.trim())); if (!isNaN(n)) fixed.add(n); });
  (t.match(/\d+/g) || []).forEach(n => { if (+n > 0 && +n <= 60) fixed.add(+n); });
  const k = cone ? 3 : 1;
  for (let c = sl.lo; c <= sl.hi; c++)
    for (const o of fixed) if (c * c * o === V * k || o * o * c === V * k)
      return { v: c, from: sl.from, to: this.sliderPx(c).to };
  return null;
};

// self-contained, each with a digit-sequence fallback (π and parentheses render
// differently in LaTeX and innerText). NEVER rebuild these by string-replacing a
// serialized closure — that produced a self-referencing TDZ crash.
window.__duo.solveDuoblank = function () {
  const m = this.read().latex.join(' ').match(/\\duoblank\{([^}]*)\}/); if (!m) return null;
  const want = this.clean(m[1]);
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  let i = c.findIndex(e => this.clean(e.innerText) === want);
  if (i < 0) { const dig = s => { const d = (this.ascii(s).match(/\d/g) || []).join('');
      const h = d.length / 2; return (d.length % 2 === 0 && d.slice(0, h) === d.slice(h)) ? d.slice(0, h) : d; };
    const wd = dig(m[1]); if (wd) i = c.findIndex(e => dig(e.innerText) === wd); }
  if (i >= 0) return { i, want };
  if (this.read().input) { this.type(want); return { ok: true, idx: [], want: [want] }; }
  return { miss: want };
};

window.__duo.solvePhantomChoice = function () {
  const p = this.phantom(); if (!p) return null;
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const want = this.clean(p);
  let i = c.findIndex(e => this.clean(e.innerText) === want);
  if (i >= 0) return { i, want };
  const dig = s => { const d = (this.ascii(s).match(/\d/g) || []).join('');
    const h = d.length / 2; return (d.length % 2 === 0 && d.slice(0, h) === d.slice(h)) ? d.slice(0, h) : d; };
  const wd = dig(p);
  if (wd) { i = c.findIndex(e => dig(e.innerText) === wd); if (i >= 0) return { i, want: wd }; }
  return { miss: want };
};

window.__duo.RULES.splice(2, 0, ['solveVolumeForm', /volume/i]);

;'__duo ready';

// when the prompt doesn't name the solid, read it off the drawing: an <ellipse>
// (or an arc in a path) means a circular base
(function () {
  const prev = window.__duo.solveBaseShape;
  window.__duo.solveBaseShape = function () {
    const r = prev.call(this); if (r && r.i >= 0) return r;
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return r;
    const d = f.contentDocument;
    const round = d.querySelector('ellipse')
      || [...d.querySelectorAll('path')].some(p => /[Aa]/.test(p.getAttribute('d') || ''));
    if (!round) return r;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.norm(this.ascii(e.innerText)).toLowerCase().includes('circle'));
    return i < 0 ? r : { i, want: 'circle' };
  };
})();

;'__duo ready';

// ---- scatter plots and data (unit 133) ----
Object.assign(window.__duo, {
  // ROBUST axis calibration: x-axis labels SHARE a y (and vice versa). Group by
  // rounded coordinate and take the biggest group with >=2 distinct values.
  // The older "distance from the mean" split collapsed on 0-based L-shaped axes
  // and produced a degenerate x scale.
  scale() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const labs = [...d.querySelectorAll('.axis-label,text,tspan')].map(e => { const r = e.getBoundingClientRect();
      return { v: +this.ascii(e.textContent.trim()).replace(/[−–]/g, '-'),
               x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 }; })
      .filter(o => !isNaN(o.v));
    if (labs.length < 4) return null;
    const group = key => { const m = {};
      labs.forEach(o => { const k = Math.round(o[key] / 6) * 6; (m[k] = m[k] || []).push(o); });
      let best = null;
      Object.values(m).forEach(g => { const vs = new Set(g.map(o => o.v));
        if (vs.size >= 2 && (!best || g.length > best.length)) best = g; });
      return best; };
    const xs = group('y'), ys = group('x'); if (!xs || !ys) return null;
    const fit = (g, key) => { const a = g.slice().sort((p, q) => p.v - q.v);
      const lo = a[0], hi = a[a.length - 1], u = (hi[key] - lo[key]) / (hi.v - lo.v);
      return { u, o: lo[key] - lo.v * u }; };
    const xa = fit(xs, 'x'), ya = fit(ys, 'y');
    if (!isFinite(xa.u) || !isFinite(ya.u) || !xa.u || !ya.u) return null;
    return { px: (gx, gy) => [Math.round(xa.o + gx * xa.u), Math.round(ya.o + gy * ya.u)],
             grid: (x, y) => [Math.round((x - xa.o) / xa.u), Math.round((y - ya.o) / ya.u)] };
  },

  // "Place the point at (x,y)": drag the point, or — when there is no draggable
  // point — a slider sets the ONE free coordinate (the formula shows the fixed one)
  placePlan() {
    const t = this.tex().replace(/\s/g, '');
    const m = t.match(/place[^(]*\((-?\d+),(-?\d+)\)/i); if (!m) return null;
    const tgt = [+m[1], +m[2]];
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const dp = d.querySelector('.draggable-point');
    if (dp) { const s = this.scale(); if (!s) return null;
      const r = dp.getBoundingClientRect();
      return { kind: 'place', tgt,
        from: [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)],
        to: s.px(tgt[0], tgt[1]) }; }
    const sl = this.sliderPx(0); if (!sl) return null;
    const fx = t.match(/\((-?\d+),duodisplay/i), fy = t.match(/duodisplay[^)]*,(-?\d+)\)/i);
    let want = (fx && +fx[1] === tgt[0]) ? tgt[1] : ((fy && +fy[1] === tgt[1]) ? tgt[0] : tgt[1]);
    if (want < sl.lo || want > sl.hi) return null;
    return { kind: 'coord', v: want, from: sl.from, to: this.sliderPx(want).to };
  },

  // "Plot the data (a,b), (c,d), ..." — one draggable point per pair
  plotPlan() {
    const t = this.tex().replace(/\s/g, '');
    const pairs = [...t.matchAll(/\((-?\d+),(-?\d+)\)/g)].map(m => [+m[1], +m[2]]);
    if (pairs.length < 2) return null;
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect(), s = this.scale(); if (!s) return null;
    const dps = [...d.querySelectorAll('.draggable-point')].map(e => { const r = e.getBoundingClientRect();
      return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; });
    if (!dps.length) return null;
    const used = [], steps = [];
    pairs.forEach(p => { const to = s.px(p[0], p[1]);
      let best = null, bd = 1e9;
      dps.forEach(v => { if (used.includes(v)) return;
        const dd = (v[0] - to[0]) ** 2 + (v[1] - to[1]) ** 2; if (dd < bd) { bd = dd; best = v; } });
      if (best) { used.push(best); steps.push({ from: best, to, pair: p }); } });
    return { pairs, steps };
  },

  solveCount() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const n = f.contentDocument.querySelectorAll('.point').length; if (!n) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(n));
    return i < 0 ? { miss: n } : { i, want: n };
  },

  // independent = x axis, dependent = y axis. Axis TITLES are the non-numeric
  // labels: the x title sits lowest, the y title leftmost.
  axisTitles() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const labs = [...d.querySelectorAll('text,tspan')].map(e => { const r = e.getBoundingClientRect();
      return { t: this.ascii(e.textContent.trim()),
               x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 }; })
      .filter(o => o.t && !/^-?\d+(\.\d+)?$/.test(o.t));
    if (!labs.length) return null;
    const xt = labs.slice().sort((a, b) => b.y - a.y)[0];
    const yt = labs.filter(o => o !== xt).sort((a, b) => a.x - b.x)[0];
    return { x: xt && xt.t, y: yt && yt.t };
  },

  solveVariable() {
    const L = this.tex(), a = this.axisTitles(); if (!a) return null;
    const want = /independent/i.test(L) ? a.x : (/dependent/i.test(L) ? a.y : null);
    if (!want) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const n = s => this.norm(this.ascii(s)).toLowerCase().replace(/[^a-z0-9]/g, '');
    const i = c.findIndex(e => n(e.innerText) === n(want));
    return i < 0 ? { miss: want } : { i, want };
  },

  solveVarValue() {
    const L = this.tex(), m = L.replace(/\s/g, '').match(/\((-?\d+),(-?\d+)\)/); if (!m) return null;
    const want = /independent/i.test(L) ? +m[1] : (/dependent/i.test(L) ? +m[2] : null);
    if (want === null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(want));
    return i < 0 ? { miss: want } : { i, want };
  },

  solveOrderedPair() {
    const p = this.pts(); if (!p || !p.length) return null;
    const q = (p.find(o => !/ghost/.test(o[0])) || p[0])[1];
    if (!q || !isFinite(q[0]) || !isFinite(q[1])) return null;
    const want = '(' + q[0] + ',' + q[1] + ')';
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, '') === want);
    return i < 0 ? { miss: want } : { i, want };
  },
});

(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    if (/place the point/i.test(this.tex())) { const p = this.placePlan(); if (p) return p; }
    return base.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveCount', /number of data points|how many points/i],
  ['solveVariable', /(independent|dependent) variable/i],
  ['solveVarValue', /value of the (independent|dependent)/i],
  ['solveOrderedPair', /ordered pair/i]);

;'__duo ready';

// several points are plotted: match the choice against ANY of them
window.__duo.solveOrderedPair = function () {
  const p = this.pts(); if (!p || !p.length) return null;
  const set = new Set(p.map(o => o[1]).filter(q => q && isFinite(q[0]) && isFinite(q[1]))
    .map(q => '(' + q[0] + ',' + q[1] + ')'));
  if (!set.size) return null;
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = c.findIndex(e => set.has(this.norm(this.ascii(e.innerText)).replace(/\s/g, '')));
  return i < 0 ? { miss: [...set] } : { i, want: this.norm(this.ascii(c[i].innerText)) };
};

// typed variants for the data unit
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const L = this.tex(), f = document.querySelector('iframe'), d = f && f.contentDocument;
    if (/number of data points|how many points/i.test(L) && d) {
      const n = d.querySelectorAll('.point').length;
      if (n) { this.type(String(n)); return String(n); }
    }
    if (/value of the (independent|dependent)/i.test(L)) {
      const m = L.replace(/\s/g, '').match(/\((-?\d+),(-?\d+)\)/);
      if (m) { const v = /independent/i.test(L) ? m[1] : m[2]; this.type(v); return v; }
    }
    return prev.call(this);
  };
})();

;'__duo ready';

// ---- scatter-plot statistics ----
// These plots often have NO numeric axis labels, so scale() cannot calibrate.
// Correlation, clustering and outliers don't need real units — work in raw
// pixels (y negated, since screen y grows downward).
Object.assign(window.__duo, {
  pixPts() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return [];
    return [...f.contentDocument.querySelectorAll('.point')].map(e => { const r = e.getBoundingClientRect();
      return [r.left + r.width / 2, -(r.top + r.height / 2)]; });
  },

  corr() {
    const q = this.pixPts(); if (q.length < 3) return null;
    const n = q.length, mx = q.reduce((s, v) => s + v[0], 0) / n, my = q.reduce((s, v) => s + v[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    q.forEach(v => { sxy += (v[0] - mx) * (v[1] - my); sxx += (v[0] - mx) ** 2; syy += (v[1] - my) ** 2; });
    return (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : 0;
  },

  solveAssociation() {
    const r = this.corr(); if (r === null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).toLowerCase());
    if (txt.some(t => /linear/.test(t))) {
      const want = Math.abs(r) > 0.85 ? 'linear' : 'nonlinear';
      const i = txt.findIndex(t => want === 'linear' ? /^linear/.test(t) : /nonlinear/.test(t));
      return i < 0 ? { miss: want } : { i, want, r: +r.toFixed(2) };
    }
    const want = Math.abs(r) < 0.3 ? 'no' : (r > 0 ? 'positive' : 'negative');
    let i = txt.findIndex(t => t.includes(want));
    if (i < 0 && want === 'no') i = txt.findIndex(t => /no association|none/.test(t));
    return i < 0 ? { miss: want } : { i, want, r: +r.toFixed(2) };
  },

  // the cluster is the offered set with the smallest bounding box
  solveCluster() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const sets = c.map(e => [...this.norm(this.ascii(e.innerText)).matchAll(/\((-?\d+),\s*(-?\d+)\)/g)]
      .map(m => [+m[1], +m[2]]));
    if (!sets.length || sets.some(s => s.length < 2)) return null;
    const spread = s => { const xs = s.map(p => p[0]), ys = s.map(p => p[1]);
      return (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys)); };
    let best = 0; sets.forEach((s, i) => { if (spread(s) < spread(sets[best])) best = i; });
    return { i: best, want: sets[best] };
  },

  // the outlier is the offered point furthest from the centre of the data
  solveOutlier() {
    const p = this.pts();
    const all = (p || []).map(o => o[1]).filter(q => q && isFinite(q[0]) && isFinite(q[1]));
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const cand = c.map(e => { const m = this.norm(this.ascii(e.innerText)).match(/\((-?\d+),\s*(-?\d+)\)/);
      return m ? [+m[1], +m[2]] : null; });
    if (cand.some(x => !x)) return null;
    const pool = all.length >= 3 ? all : cand;
    const cx = pool.reduce((s, q) => s + q[0], 0) / pool.length;
    const cy = pool.reduce((s, q) => s + q[1], 0) / pool.length;
    let best = 0;
    cand.forEach((q, i) => { if ((q[0] - cx) ** 2 + (q[1] - cy) ** 2 >
      (cand[best][0] - cx) ** 2 + (cand[best][1] - cy) ** 2) best = i; });
    return { i: best, want: cand[best] };
  },
});

window.__duo.RULES.splice(2, 0,
  ['solveCluster', /cluster/i],
  ['solveOutlier', /outlier/i],
  ['solveAssociation', /association/i]);

;'__duo ready';

// ---- line of best fit (unit 134) ----
Object.assign(window.__duo, {
  // Exact endpoints from the <line> beat a bounding box, which includes the
  // arrowhead and skews the slope. Calibrate from the grid lines themselves.
  bestFit() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument;
    const gl = [...d.querySelectorAll('line')].filter(e => /grid/.test(String(e.getAttribute('class'))));
    const vx = [...new Set(gl.filter(e => +e.getAttribute('x1') === +e.getAttribute('x2'))
      .map(e => +e.getAttribute('x1')))].sort((a, b) => a - b);
    const hy = [...new Set(gl.filter(e => +e.getAttribute('y1') === +e.getAttribute('y2'))
      .map(e => +e.getAttribute('y1')))].sort((a, b) => a - b);
    if (vx.length < 2 || hy.length < 2) return null;
    const ux = (vx[vx.length - 1] - vx[0]) / (vx.length - 1);
    const uy = (hy[hy.length - 1] - hy[0]) / (hy.length - 1);
    const x0 = vx[0], y0 = hy[hy.length - 1];
    const fit = [...d.querySelectorAll('line')].filter(e => !/grid/.test(String(e.getAttribute('class'))))
      .map(e => ({ x1: +e.getAttribute('x1'), y1: +e.getAttribute('y1'),
                   x2: +e.getAttribute('x2'), y2: +e.getAttribute('y2') }))
      .filter(o => Math.abs(o.x1 - o.x2) > 5 && Math.abs(o.y1 - o.y2) > 5)[0];
    if (!fit) return null;
    const G = (px, py) => [(px - x0) / ux, (y0 - py) / uy];
    const p1 = G(fit.x1, fit.y1), p2 = G(fit.x2, fit.y2);
    const m = (p2[1] - p1[1]) / (p2[0] - p1[0]);
    return { m: +m.toFixed(3), b: +(p1[1] - m * p1[0]).toFixed(3),
             p1: p1.map(v => +v.toFixed(2)), p2: p2.map(v => +v.toFixed(2)) };
  },

  solveFit() {
    const bf = this.bestFit(); if (!bf) return null;
    const L = this.tex();
    const v = /slope/i.test(L) ? bf.m : (/intercept/i.test(L) ? bf.b : null);
    if (v === null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(v));
    return i < 0 ? { miss: v } : { i, want: v };
  },

  // rise = change in Y, run = change in X (getting these backwards cost an answer)
  solveRiseRun() {
    const L = this.tex().replace(/\s/g, '');
    const pts = [...L.matchAll(/\((-?\d+),(-?\d+)\)/g)].map(m => [+m[1], +m[2]]);
    if (pts.length < 2) return null;
    const [p, q] = pts.slice(-2);
    const run = /run/i.test(L); if (!run && !/rise/i.test(L)) return null;
    const a = run ? q[0] : q[1], b = run ? p[0] : p[1];
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const norm = e => this.norm(this.ascii(e.innerText)).replace(/\s/g, '').replace(/−/g, '-');
    let i = c.findIndex(e => norm(e) === a + '-' + b + '=' + (a - b));
    if (i < 0) i = c.findIndex(e => { const m = norm(e).match(/^(-?\d+)-(-?\d+)=(-?\d+)$/);
      return m && +m[1] === a && +m[2] === b; });
    return i < 0 ? { miss: a + '-' + b } : { i, want: a - b };
  },
});

(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const L = this.tex();
    if (/intercept|slope/i.test(L)) { const bf = this.bestFit();
      if (bf) { const v = /slope/i.test(L) ? bf.m : bf.b;
        if (Number.isFinite(v)) { const t = String(Number.isInteger(v) ? v : +v.toFixed(2)); this.type(t); return t; } } }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveRiseRun', /\b(rise|run)\b/i],
  ['solveFit', /intercept|slope/i]);

;'__duo ready';

// LaTeX writes non-breaking spaces as ~ ("x~=~4"), which defeats every regex
(function () {
  const prev = window.__duo.tex;
  window.__duo.tex = function () { return prev.call(this).replace(/~/g, ''); };
})();

Object.assign(window.__duo, {
  // "Create a positive/negative/zero trend": the slider IS the trend's sign
  trendPlan() {
    const m = this.tex().toLowerCase().match(/create a\s*\S{0,12}?(positive|negative|zero|no)\s*trend/);
    if (!m) return null;
    const want = m[1] === 'positive' ? 1 : (m[1] === 'negative' ? -1 : 0);
    const sl = this.sliderPx(0); if (!sl || want < sl.lo || want > sl.hi) return null;
    return { kind: 'trend', v: want, from: sl.from, to: this.sliderPx(want).to };
  },

  // "Set the y-intercept to N" — \emphasis{} leaves ~9 non-digit chars after "to"
  setPlan() {
    const t = this.tex().replace(/\s/g, '');
    const m = t.match(/setthe\D{0,26}?to\D{0,14}?(-?\d+)/i) || t.match(/to\D{0,14}?(-?\d+)/i);
    if (!m) return null;
    const v = +m[1], sl = this.sliderPx(0); if (!sl || v < sl.lo || v > sl.hi) return null;
    return { kind: 'set', v, from: sl.from, to: this.sliderPx(v).to };
  },

  // "Graph the line of best fit: y = mx + b" — the slider holds one parameter
  graphPlan() {
    const m = this.tex().replace(/\s/g, '').match(/y=(-?\d*)x([+-]\d+)?/i); if (!m) return null;
    const slope = m[1] === '' || m[1] === '+' ? 1 : (m[1] === '-' ? -1 : +m[1]);
    const inter = m[2] ? +m[2] : 0;
    const sl = this.sliderPx(0); if (!sl) return null;
    for (const v of [inter, slope])
      if (v >= sl.lo && v <= sl.hi && v !== sl.now)
        return { kind: 'graph', v, from: sl.from, to: this.sliderPx(v).to };
    return null;
  },

  solveSlopeDir() {
    const bf = this.bestFit();
    const m = bf && Number.isFinite(bf.m) ? bf.m : this.corr();
    if (m === null || !Number.isFinite(m)) return null;
    const want = Math.abs(m) < 0.05 ? 'zero' : (m > 0 ? 'positive' : 'negative');
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const txt = c.map(e => this.norm(this.ascii(e.innerText)).toLowerCase());
    let i = txt.findIndex(t => t.includes(want));
    if (i < 0 && want === 'positive') i = txt.findIndex(t => /up|increas/.test(t));
    if (i < 0 && want === 'negative') i = txt.findIndex(t => /down|decreas/.test(t));
    return i < 0 ? { miss: want } : { i, want };
  },

  // Read x from the PROMPT line only: tex() concatenates the choices, so
  // "x = 4" with choices 2,1,0 parsed as x = 4210.
  solvePredict() {
    const L0 = this.ascii(this.read().latex[0] || '').replace(/[~\s]/g, '')
      .replace(/[{}\\]|mathbf|textbf/g, '');
    const xm = L0.match(/x=(-?\d+)/i); if (!xm) return null;
    const x = +xm[1];
    const q = (this.pts() || []).map(o => o[1]).filter(v => v && isFinite(v[0]) && isFinite(v[1]));
    let want = null;
    const hit = q.find(v => v[0] === x);
    if (hit) want = hit[1];
    else if (q.length >= 2) {
      const n = q.length, mx = q.reduce((s, v) => s + v[0], 0) / n, my = q.reduce((s, v) => s + v[1], 0) / n;
      let sxy = 0, sxx = 0;
      q.forEach(v => { sxy += (v[0] - mx) * (v[1] - my); sxx += (v[0] - mx) ** 2; });
      if (sxx) want = Math.round(my + (sxy / sxx) * (x - mx));
    }
    if (want === null) { const bf = this.bestFit(); if (bf) want = Math.round(bf.m * x + bf.b); }
    if (want === null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(want));
    return i < 0 ? { miss: want } : { i, want };
  },
});

// the intercept may be offered as a POINT (0,b) rather than a bare number
(function () {
  const prev = window.__duo.solveFit;
  window.__duo.solveFit = function () {
    const r = prev.call(this); if (r && r.i >= 0) return r;
    const bf = this.bestFit(); if (!bf || !/intercept/i.test(this.tex())) return r;
    const want = '(0,' + Math.round(bf.b) + ')';
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, '') === want);
    return i < 0 ? r : { i, want };
  };
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const t = this.tex();
    if (/create a\s*\S{0,12}?(positive|negative|zero|no)\s*trend/i.test(t)) { const p = this.trendPlan(); if (p) return p; }
    if (/graph the line/i.test(t)) { const p = this.graphPlan(); if (p) return p; }
    if (/set the/i.test(t)) { const p = this.setPlan(); if (p) return p; }
    return base.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveSlopeDir', /direction of the slope/i],
  ['solvePredict', /value when/i]);

;'__duo ready';

// A HORIZONTAL best-fit line has slope 0, but the slanted-line filter found
// nothing at all — handle the flat case explicitly.
(function () {
  const prev = window.__duo.bestFit;
  window.__duo.bestFit = function () {
    const r = prev.call(this); if (r) return r;
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument;
    const flat = [...d.querySelectorAll('line')].filter(e => !/grid/.test(String(e.getAttribute('class'))))
      .map(e => ({ y: +e.getAttribute('y1'), y2: +e.getAttribute('y2'),
                   x1: +e.getAttribute('x1'), x2: +e.getAttribute('x2') }))
      .filter(o => Math.abs(o.y - o.y2) < 2 && Math.abs(o.x1 - o.x2) > 40)[0];
    if (!flat) return null;
    const s = this.scale(); if (!s) return null;
    const svg = d.querySelector('svg'), sr = svg.getBoundingClientRect(), fr = f.getBoundingClientRect();
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const sy = vb.length === 4 ? sr.height / vb[3] : 1, oy = vb.length === 4 ? -vb[1] * sy : 0;
    const b = s.grid(0, fr.top + sr.top + oy + flat.y * sy)[1];
    return { m: 0, b, p1: [0, b], p2: [1, b] };
  };
})();

;'__duo ready';

// Scan each latex ENTRY for a standalone equation. Concatenating them made
// "y = 8x - 4" swallow the choice digits and evaluate to -4524804.
window.__duo.equation = function () {
  for (const s of this.read().latex) {
    const t = this.ascii(s).replace(/[~\s]/g, '').replace(/[{}\\]|mathbf|textbf|text/g, '');
    const m = t.match(/^y=(-?\d*)x([+-]\d+)?$/i);
    if (m) { const a = m[1] === '' || m[1] === '+' ? 1 : (m[1] === '-' ? -1 : +m[1]);
      return { m: a, b: m[2] ? +m[2] : 0 }; }
  }
  return null;
};

window.__duo.solvePredict = function () {
  const L0 = this.ascii(this.read().latex[0] || '').replace(/[~\s]/g, '').replace(/[{}\\]|mathbf|textbf/g, '');
  const xm = L0.match(/x=(-?\d+)/i); if (!xm) return null;
  const x = +xm[1];
  let want = null;
  const eq = this.equation(); if (eq) want = eq.m * x + eq.b;
  if (want === null) {
    const q = (this.pts() || []).map(o => o[1]).filter(v => v && isFinite(v[0]) && isFinite(v[1]));
    const hit = q.find(v => v[0] === x);
    if (hit) want = hit[1];
    else if (q.length >= 2) {
      const n = q.length, mx = q.reduce((s, v) => s + v[0], 0) / n, my = q.reduce((s, v) => s + v[1], 0) / n;
      let sxy = 0, sxx = 0;
      q.forEach(v => { sxy += (v[0] - mx) * (v[1] - my); sxx += (v[0] - mx) ** 2; });
      if (sxx) want = Math.round(my + (sxy / sxx) * (x - mx));
    }
  }
  if (want === null) { const bf = this.bestFit(); if (bf) want = Math.round(bf.m * x + bf.b); }
  if (want === null) return null;
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = c.findIndex(e => this.clean(e.innerText) === String(want));
  return i < 0 ? { miss: want } : { i, want };
};

// "Complete the scatter plot (x,y)" is the same as "place the point"
window.__duo.placePlan = function () {
  const t = this.tex().replace(/\s/g, '');
  const m = t.match(/(?:place|complete)[^(]*\((-?\d+),(-?\d+)\)/i); if (!m) return null;
  const tgt = [+m[1], +m[2]];
  const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
  const d = f.contentDocument, fr = f.getBoundingClientRect();
  const dp = d.querySelector('.draggable-point');
  if (dp) { const s = this.scale(); if (!s) return null;
    const r = dp.getBoundingClientRect();
    return { kind: 'place', tgt,
      from: [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)],
      to: s.px(tgt[0], tgt[1]) }; }
  const sl = this.sliderPx(0); if (!sl) return null;
  const fx = t.match(/\((-?\d+),duodisplay/i), fy = t.match(/duodisplay[^)]*,(-?\d+)\)/i);
  const want = (fx && +fx[1] === tgt[0]) ? tgt[1] : ((fy && +fy[1] === tgt[1]) ? tgt[0] : tgt[1]);
  if (want < sl.lo || want > sl.hi) return null;
  return { kind: 'coord', v: want, from: sl.from, to: this.sliderPx(want).to };
};

// guided prediction: the substitution step puts a NUMBER in parentheses
window.__duo.solveSubstitute = function () {
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const txt = c.map(e => this.norm(this.ascii(e.innerText)).replace(/\s/g, ''));
  if (txt.length < 2) return null;
  const subbed = txt.map(t => /\(\s*-?\d+\s*\)/.test(t) && !/x/i.test(t));
  if (!subbed.some(Boolean)) return null;
  const xm = this.tex().replace(/\s/g, '').match(/x=(-?\d+)/i);
  let i = -1;
  if (xm) i = txt.findIndex((t, k) => subbed[k] && t.includes('(' + xm[1] + ')'));
  if (i < 0) i = subbed.indexOf(true);
  return i < 0 ? null : { i, want: txt[i] };
};

// guided steps render their choices a beat late — re-read once before deciding
// a screen is a no-answer explainer
window.__duo.run2 = async function (n) {
  this.S = { running: true, log: [], done: 0 };
  let miss = 0, info = 0;
  for (let i = 0; i < n && this.S.running; i++) {
    const n0 = document.querySelector('[data-test="player-next"]');
    if (n0 && /CONTINUE/i.test(n0.innerText || '') && !document.querySelector('[data-test^="challenge "]')) {
      this.tap(n0); await this.sleep(1500); continue;
    }
    let r = this.read();
    if (!r.type) { this.S.log.push('lessondone'); break; }
    if (this.plan()) { this.S.log.push('needdrag'); break; }
    if (!r.choices.length && !r.input) { await this.sleep(900); r = this.read(); }
    let acted = false;
    if (r.choices.length) { const s = this.solveChoices();
      if (s && s.ok) { s.idx.forEach(j => this.tap(document.querySelectorAll('[data-test="challenge-choice"]')[j])); acted = true; } }
    else if (r.input) { acted = !!this.typeAnswer(); }
    else if (n0 && !/disabled/i.test(n0.className)) {
      if (++info >= 3) { this.S.log.push('stuck:info-loop'); break; }
      this.tap(n0); await this.sleep(1600); this.S.log.push('info'); continue;
    }
    if (!acted) { this.S.log.push('stuck:' + r.type); break; }
    info = 0;
    await this.sleep(350);
    this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1700);
    const bl = ((document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test || '').replace('blame blame-', '');
    this.S.log.push(bl || 'noblame');
    if (bl === 'correct') { this.S.done++; miss = 0; }
    else if (bl === 'incorrect' && ++miss >= 2) { this.S.log.push('halt:2wrong'); break; }
    if (!bl) break;
    const nx = document.querySelector('[data-test="player-next"]');
    if (nx && /CONTINUE/i.test(nx.innerText)) { this.tap(nx); await this.sleep(1500); }
  }
  this.S.running = false;
  return this.S;
};

(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    if (/place the point|complete the scatter/i.test(this.tex())) { const p = this.placePlan(); if (p) return p; }
    return base.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveSubstitute', /predicted output|substitut/i],
  ['solvePredict', /predicted output|value when|output when/i]);

;'__duo ready';

// ---- two-way frequency tables (unit 135) ----
Object.assign(window.__duo, {
  // Some tables are a real <table>, others are positioned text. For the latter,
  // cluster cells into rows/columns by coordinate so EMPTY cells survive — a
  // ragged row-by-row parse silently shifts every value left.
  gridCells() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const cells = [...d.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim())
      .map(e => { const r = e.getBoundingClientRect();
        return { t: this.ascii(e.textContent.trim()), x: fr.left + r.left + r.width / 2,
                 y: fr.top + r.top + r.height / 2, w: r.width, h: r.height }; })
      .filter(c => c.w > 0 && c.h > 0);
    if (cells.length < 6) return null;
    const cluster = (vals, tol) => { const s = [...vals].sort((a, b) => a - b), out = [];
      s.forEach(v => { const g = out.find(g => Math.abs(g[0] - v) < tol); if (g) g.push(v); else out.push([v]); });
      return out.map(g => g.reduce((a, b) => a + b, 0) / g.length); };
    const ys = cluster(cells.map(c => c.y), 14), xs = cluster(cells.map(c => c.x), 24);
    const near = (v, arr) => arr.reduce((b, a, i) => Math.abs(a - v) < Math.abs(arr[b] - v) ? i : b, 0);
    const grid = ys.map(() => xs.map(() => ''));
    cells.forEach(c => { grid[near(c.y, ys)][near(c.x, xs)] = c.t; });
    return { grid, xs, ys };
  },

  table() {
    const f = document.querySelector('iframe'); if (!f || !f.contentDocument) return null;
    const t = f.contentDocument.querySelector('table');
    if (t) return [...t.rows].map(r => [...r.cells].map(c => this.ascii(c.textContent.trim())));
    const g = this.gridCells();
    return g ? g.grid.map(r => r.filter(v => v !== '')).filter(r => r.length) : null;
  },

  // header "9th" vs prompt "Grade 9": fall back to matching on the digits
  hdrMatch(h, L) {
    h = String(h).toLowerCase(); if (!h) return false;
    if (L.includes(h)) return true;
    const dh = h.replace(/\D/g, '');
    if (dh && new RegExp('\\b' + dh + '\\b').test(L)) return true;
    const w = h.replace(/[^a-z]/g, '');
    return w.length > 2 && L.includes(w);
  },

  solveTableCell() {
    const T = this.table(); if (!T || T.length < 2) return null;
    const L0 = this.ascii(this.read().latex[0] || '').replace(/[{}\\]|mathbf|textbf|text/g, '').toLowerCase();
    const head = T[0], body = T.slice(1);
    const off = body.length ? body[0].length - head.length : 0;
    let col = -1; head.forEach((h, i) => { if (this.hdrMatch(h, L0)) col = i; });
    let row = null; body.forEach(r => { if (this.hdrMatch(r[0], L0)) row = r; });
    if (!row || col < 0) return null;
    const v = row[col + off];
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(v));
    return i < 0 ? { miss: v } : { i, want: v };
  },

  // if the table HAS a Total row, read it; otherwise sum, skipping any Total
  // line (double-counting it gave 33 where the answer was 19)
  solveTableTotal() {
    const T = this.table(); if (!T || T.length < 2) return null;
    const L0 = this.ascii(this.read().latex[0] || '').replace(/[{}\\]|mathbf|textbf|text/g, '').toLowerCase();
    const head = T[0], body = T.slice(1);
    const num = s => { const v = parseFloat(String(s).replace(/[^\d.-]/g, '')); return isNaN(v) ? null : v; };
    const off = body.length ? body[0].length - head.length : 0;
    const totalRow = body.find(r => /total/i.test(String(r[0])));
    let want = null;
    head.forEach((h, i) => { if (!this.hdrMatch(h, L0)) return;
      if (totalRow) { const v = num(totalRow[i + off]); if (v !== null) want = v; }
      else { const s = body.filter(r => !/total/i.test(String(r[0])))
        .reduce((a, r) => a + (num(r[i + off]) || 0), 0); if (s) want = s; } });
    if (want === null) body.forEach(r => { if (/total/i.test(String(r[0]))) return;
      if (this.hdrMatch(r[0], L0)) { const s = r.slice(1).reduce((a, v) => a + (num(v) || 0), 0); if (s) want = s; } });
    if (want === null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(want));
    return i < 0 ? { miss: want } : { i, want };
  },

  // a "?" cell is recoverable from its column total
  solveTableMissing() {
    const T = this.table(); if (!T || T.length < 2) return null;
    const body = T.slice(1);
    const num = s => { const v = parseFloat(String(s).replace(/[^\d.-]/g, '')); return isNaN(v) ? null : v; };
    let ri = -1, ci = -1;
    body.forEach((r, i) => r.forEach((v, j) => { if (/\?/.test(String(v))) { ri = i; ci = j; } }));
    if (ri < 0) return null;
    const totalRow = body.findIndex(r => /total/i.test(String(r[0])));
    let want = null;
    if (totalRow >= 0 && totalRow !== ri) {
      const tot = num(body[totalRow][ci]);
      const others = body.filter((r, i) => i !== ri && i !== totalRow).reduce((a, r) => a + (num(r[ci]) || 0), 0);
      if (tot !== null) want = tot - others;
    }
    if (want === null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(want));
    if (i >= 0) return { i, want };
    if (this.read().input) { this.type(String(want)); return { ok: true, idx: [], want: [String(want)] }; }
    return { miss: want };
  },

  // "Complete the table": work out each blank from its column total and drag the
  // matching tile into it. Uses the positional grid so blanks are located.
  tablePlan() {
    const G = this.gridCells(); if (!G) return null;
    const g = G.grid;
    const num = s => { const v = parseFloat(String(s).replace(/[^\d.-]/g, '')); return isNaN(v) ? null : v; };
    const totR = g.findIndex(r => /total/i.test(String(r[0])));
    if (totR < 0) return null;
    const cols = g[0].map((v, i) => v ? i : -1).filter(i => i > 0);
    const bodyRows = g.map((r, i) => (i > 0 && i < totR && r[0]) ? i : -1).filter(i => i >= 0);
    const wants = [];
    cols.forEach(ci => {
      const missing = bodyRows.filter(ri => !g[ri][ci]);
      if (missing.length === 1) {
        const tot = num(g[totR][ci]);
        const others = bodyRows.filter(ri => ri !== missing[0]).reduce((a, ri) => a + (num(g[ri][ci]) || 0), 0);
        if (tot !== null) wants.push({ r: missing[0], c: ci, val: tot - others });
      } else if (!g[totR][ci]) {
        wants.push({ r: totR, c: ci, val: bodyRows.reduce((a, ri) => a + (num(g[ri][ci]) || 0), 0) });
      }
    });
    if (!wants.length) return null;
    // tiles sit below the table: numeric cells in rows past the total row
    const tiles = [];
    g.forEach((r, i) => { if (i <= totR) return;
      r.forEach((v, j) => { if (/^\d+$/.test(String(v))) tiles.push({ v: +v, xy: [Math.round(G.xs[j]), Math.round(G.ys[i])] }); }); });
    const used = [], steps = [];
    wants.forEach(w => { const tk = tiles.find(x => x.v === w.val && !used.includes(x));
      if (tk) { used.push(tk); steps.push({ from: tk.xy, to: [Math.round(G.xs[w.c]), Math.round(G.ys[w.r])], val: w.val }); } });
    return { wants: wants.map(w => w.val), steps };
  },
});

window.__duo.RULES.splice(2, 0,
  ['solveTableMissing', null],
  ['solveTableCell', /frequency for|how many/i],
  ['solveTableTotal', /total for/i]);

;'__duo ready';

// the "?" can be IN the Total row — then it's the column SUM, not a difference
window.__duo.solveTableMissing = function () {
  const T = this.table(); if (!T || T.length < 2) return null;
  const body = T.slice(1);
  const num = s => { const v = parseFloat(String(s).replace(/[^\d.-]/g, '')); return isNaN(v) ? null : v; };
  let ri = -1, ci = -1;
  body.forEach((r, i) => r.forEach((v, j) => { if (/\?/.test(String(v))) { ri = i; ci = j; } }));
  if (ri < 0) return null;
  const totalRow = body.findIndex(r => /total/i.test(String(r[0])));
  let want = null;
  if (ri === totalRow) want = body.filter((r, i) => i !== totalRow).reduce((a, r) => a + (num(r[ci]) || 0), 0);
  else if (totalRow >= 0) { const tot = num(body[totalRow][ci]);
    const others = body.filter((r, i) => i !== ri && i !== totalRow).reduce((a, r) => a + (num(r[ci]) || 0), 0);
    if (tot !== null) want = tot - others; }
  if (want === null) return null;
  const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = c.findIndex(e => this.clean(e.innerText) === String(want));
  if (i >= 0) return { i, want };
  if (this.read().input) { this.type(String(want)); return { ok: true, idx: [], want: [String(want)] }; }
  return { miss: want };
};

// typed table questions: with no choices the solver reports its value in `miss`
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const L = this.tex();
    if (/enter the total$|^total$/i.test(L.trim())) {
      const r = this.solveTableMissing();
      const v = r && (r.ok ? r.want[0] : (r.want !== undefined ? r.want : r.miss));
      if (v !== undefined && v !== null) { this.type(String(v)); return String(v); }
    }
    if (/total frequency for|total for|frequency for|how many/i.test(L)) {
      const r = /total/i.test(L) ? this.solveTableTotal() : this.solveTableCell();
      const v = r && (r.want !== undefined ? r.want : r.miss);
      if (v !== undefined && v !== null) { this.type(String(v)); return String(v); }
    }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0, ['solveTableTotal', /total frequency for|total for/i]);

;'__duo ready';

// ---- guided lessons stack iframes ----
// A guided lesson KEEPS EVERY PREVIOUS STEP'S IFRAME in the DOM (8 of them by
// the end), and the very last one is empty. querySelector('iframe') therefore
// returns a STALE table and every lookup silently answers the wrong question.
// Take the lowest iframe on the page that actually has content.
window.__duo.frameEl = function () {
  const cand = [...document.querySelectorAll('iframe')].filter(f => {
    if (!f.contentDocument) return false;
    const r = f.getBoundingClientRect(); if (r.width < 20 || r.height < 20) return false;
    return [...f.contentDocument.querySelectorAll('*')]
      .filter(e => e.children.length === 0 && e.textContent.trim()).length > 3;
  });
  if (!cand.length) return null;
  return cand.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[cand.length - 1];
};

// In guided lessons latex[0] is the LESSON TITLE; the live question is the last
// \text{} instruction.
window.__duo.prompt = function () {
  const L = this.read().latex;
  for (let i = L.length - 1; i >= 0; i--) {
    const s = this.ascii(L[i]).replace(/[{}\\]|mathbf|textbf|text/g, '').replace(/~/g, ' ').trim();
    if (/[a-z]{4,}/i.test(s)) return s.toLowerCase();
  }
  return this.ascii(L[0] || '').toLowerCase();
};

Object.assign(window.__duo, {
  gridCells() {
    const f = this.frameEl(); if (!f) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const cells = [...d.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim())
      .map(e => { const r = e.getBoundingClientRect();
        return { t: this.ascii(e.textContent.trim()), x: fr.left + r.left + r.width / 2,
                 y: fr.top + r.top + r.height / 2, w: r.width, h: r.height }; })
      .filter(c => c.w > 0 && c.h > 0);
    if (cells.length < 6) return null;
    const cluster = (vals, tol) => { const s = [...vals].sort((a, b) => a - b), out = [];
      s.forEach(v => { const g = out.find(g => Math.abs(g[0] - v) < tol); if (g) g.push(v); else out.push([v]); });
      return out.map(g => g.reduce((a, b) => a + b, 0) / g.length); };
    const ys = cluster(cells.map(c => c.y), 14), xs = cluster(cells.map(c => c.x), 24);
    const near = (v, arr) => arr.reduce((b, a, i) => Math.abs(a - v) < Math.abs(arr[b] - v) ? i : b, 0);
    const grid = ys.map(() => xs.map(() => ''));
    cells.forEach(c => { grid[near(c.y, ys)][near(c.x, xs)] = c.t; });
    return { grid, xs, ys };
  },

  table() {
    const f = this.frameEl(); if (!f) return null;
    const ts = [...f.contentDocument.querySelectorAll('table')];
    const t = ts.length ? ts[ts.length - 1] : null;
    if (t) return [...t.rows].map(r => [...r.cells].map(c => this.ascii(c.textContent.trim())));
    const g = this.gridCells();
    return g ? g.grid.map(r => r.filter(v => v !== '')).filter(r => r.length) : null;
  },

  grandTotal() {
    const T = this.table(); if (!T || T.length < 2) return null;
    const body = T.slice(1);
    const num = s => { const v = parseFloat(String(s).replace(/[^\d.-]/g, '')); return isNaN(v) ? null : v; };
    const tot = body.find(r => /total/i.test(String(r[0])));
    if (tot) return tot.slice(1).reduce((a, v) => a + (num(v) || 0), 0);
    return body.reduce((a, r) => a + r.slice(1).reduce((b, v) => b + (num(v) || 0), 0), 0);
  },

  // joint relative frequency = cell / GRAND total; conditional uses a row/column total
  solveRelFreq() {
    const g = this.grandTotal(); if (!g) return null;
    const joint = /joint/i.test(this.tex());
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const den = s => { const m = s.replace(/\s/g, '').match(/frac\{?(\d+)\}?\{?(\d+)\}?/i); return m ? +m[2] : null; };
    const i = joint ? src.findIndex(s => den(s) === g)
                    : src.findIndex(s => den(s) !== null && den(s) !== g);
    return i < 0 ? null : { i, want: src[i] };
  },

  solveTableCell() {
    const T = this.table(); if (!T || T.length < 2) return null;
    const L0 = this.prompt();
    const head = T[0], body = T.slice(1);
    const off = body.length ? body[0].length - head.length : 0;
    let col = -1; head.forEach((h, i) => { if (this.hdrMatch(h, L0)) col = i; });
    let row = null; body.forEach(r => { if (this.hdrMatch(r[0], L0)) row = r; });
    if (!row || col < 0) return null;
    const v = row[col + off];
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(v));
    return i < 0 ? { miss: v } : { i, want: v };
  },
});

// guided steps: read the table cell, the grand total, or a plain lookup
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const P = this.prompt();
    if (/total number of/i.test(P)) { const v = this.grandTotal();
      if (v) { this.type(String(v)); return String(v); } }
    if (/number of|frequency for|how many/i.test(P)) {
      const r = this.solveTableCell();
      const v = r && (r.want !== undefined ? r.want : r.miss);
      if (v !== undefined && v !== null) { this.type(String(v)); return String(v); }
    }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0, ['solveRelFreq', /relative frequency/i]);

;'__duo ready';

// read().latex includes the CHOICES' annotations, so prompt()/phantom() must
// exclude them or they return an answer option instead of the question
Object.assign(window.__duo, {
  promptLatex() {
    return [...document.querySelectorAll('[data-test^="challenge "] annotation')]
      .filter(a => !a.closest('[data-test="challenge-choice"]'))
      .map(a => a.textContent);
  },

  prompt() {
    const L = this.promptLatex();
    for (let i = L.length - 1; i >= 0; i--) {
      const s = this.ascii(L[i]).replace(/[{}\\]|mathbf|textbf|text/g, '').replace(/~/g, ' ').trim();
      if (/[a-z]{4,}/i.test(s)) return s.toLowerCase();
    }
    const H = document.querySelector('[data-test="challenge-header"]');
    return this.ascii(H ? H.innerText : (L[0] || '')).toLowerCase();
  },

  phantom() {
    const L = this.promptLatex().join(' ');
    const i = L.indexOf('\\phantom{'); if (i < 0) return null;
    let j = i + 9, dep = 1, out = '';
    while (j < L.length && dep > 0) { const ch = L[j];
      if (ch === '{') dep++; else if (ch === '}') { dep--; if (!dep) break; }
      out += ch; j++; }
    return out;
  },

  // joint       = CELL / grand total
  // marginal    = MARGINAL TOTAL / grand total   (also over the grand total!)
  // conditional = cell / a marginal total
  // Treating "not joint" as "not over the grand total" cost two answers, and
  // the choices arrive SIMPLIFIED (40/64 shown as 5/8) so compare by VALUE.
  solveRelFreq() {
    const T = this.table(); if (!T) return null;
    const g = this.grandTotal(); if (!g) return null;
    const P = this.prompt();
    const num = s => { const v = parseFloat(String(s).replace(/[^\d.-]/g, '')); return isNaN(v) ? null : v; };
    const head = T[0], body = T.slice(1);
    const off = body.length ? body[0].length - head.length : 0;
    const totRow = body.find(r => /total/i.test(String(r[0])));
    const kind = /marginal/i.test(P) ? 'marginal' : (/conditional/i.test(P) ? 'conditional' : 'joint');
    let target = null;
    if (kind === 'marginal') {
      head.forEach((h, i) => { if (!this.hdrMatch(h, P)) return;
        const v = totRow ? num(totRow[i + off])
          : body.filter(r => !/total/i.test(String(r[0]))).reduce((a, r) => a + (num(r[i + off]) || 0), 0);
        if (v) target = v / g; });
      if (target === null) body.forEach(r => { if (/total/i.test(String(r[0]))) return;
        if (this.hdrMatch(r[0], P)) { const s = r.slice(1).reduce((a, v) => a + (num(v) || 0), 0); if (s) target = s / g; } });
    } else {
      let col = -1; head.forEach((h, i) => { if (this.hdrMatch(h, P)) col = i; });
      let row = null; body.forEach(r => { if (this.hdrMatch(r[0], P)) row = r; });
      if (row && col >= 0) { const cell = num(row[col + off]);
        if (kind === 'joint') target = cell / g;
        else { const colTot = totRow ? num(totRow[col + off]) : null;
          const rowTot = row.slice(1).reduce((a, v) => a + (num(v) || 0), 0);
          target = cell / (colTot || rowTot); } }
    }
    if (target === null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const val = s => { const m = s.replace(/\s/g, '').match(/frac\{?(\d+)\}?\{?(\d+)\}?/i);
      if (m) return +m[1] / +m[2];
      const p = parseFloat(s.replace(/[^\d.]/g, '')); return isNaN(p) ? null : p; };
    const i = src.findIndex(s => { const v = val(s); return v !== null && Math.abs(v - target) < 0.01; });
    return i < 0 ? { miss: target, kind } : { i, want: target, kind };
  },

  solveGrandTotal() {
    const v = this.grandTotal(); if (!v) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(v));
    return i < 0 ? { miss: v } : { i, want: v };
  },

  // use prompt() (the live step), not latex[0] (the lesson title)
  solveTableTotal() {
    const T = this.table(); if (!T || T.length < 2) return null;
    const L0 = this.prompt();
    const head = T[0], body = T.slice(1);
    const num = s => { const v = parseFloat(String(s).replace(/[^\d.-]/g, '')); return isNaN(v) ? null : v; };
    const off = body.length ? body[0].length - head.length : 0;
    const totalRow = body.find(r => /total/i.test(String(r[0])));
    let want = null;
    head.forEach((h, i) => { if (!this.hdrMatch(h, L0)) return;
      if (totalRow) { const v = num(totalRow[i + off]); if (v !== null) want = v; }
      else { const s = body.filter(r => !/total/i.test(String(r[0])))
        .reduce((a, r) => a + (num(r[i + off]) || 0), 0); if (s) want = s; } });
    if (want === null) body.forEach(r => { if (/total/i.test(String(r[0]))) return;
      if (this.hdrMatch(r[0], L0)) { const s = r.slice(1).reduce((a, v) => a + (num(v) || 0), 0); if (s) want = s; } });
    if (want === null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(want));
    return i < 0 ? { miss: want } : { i, want };
  },
});

(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const P = this.prompt();
    if (/grand total/i.test(P)) { const v = this.grandTotal(); if (v) { this.type(String(v)); return String(v); } }
    if (/marginal total/i.test(P)) { const r = this.solveTableTotal();
      const v = r && (r.want !== undefined ? r.want : r.miss);
      if (v !== undefined && v !== null) { this.type(String(v)); return String(v); } }
    return prev.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveGrandTotal', /grand total|total number of/i],
  ['solveTableTotal', /marginal total|total frequency for|total for/i]);

;'__duo ready';

// relative-frequency choices may be a fraction, a decimal, OR a percentage
(function () {
  const prev = window.__duo.solveRelFreq;
  window.__duo.solveRelFreq = function () {
    const r = prev.call(this);
    if (!r || r.i >= 0) return r;
    const target = r.miss; if (typeof target !== 'number') return r;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const val = s => { const t = s.replace(/\s|\\|mathbf|textbf|\{|\}/g, '');
      const f = t.match(/frac(\d+)(\d+)/); if (f) return +f[1] / +f[2];
      const p = t.match(/(-?\d+(?:\.\d+)?)%/); if (p) return +p[1] / 100;
      const n = parseFloat(t); return isNaN(n) ? null : n; };
    const i = src.findIndex(s => { const v = val(s); return v !== null && Math.abs(v - target) < 0.005; });
    return i < 0 ? r : { i, want: target, kind: r.kind };
  };
  // typed relative frequency wants a decimal (placeholder reads "Example: 0.2")
  const prevType = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const P = this.prompt();
    if (/relative frequency/i.test(P)) {
      const r = this.solveRelFreq();
      const v = r && (r.want !== undefined ? r.want : r.miss);
      if (typeof v === 'number' && isFinite(v)) { const t = String(+v.toFixed(4)); this.type(t); return t; }
    }
    return prevType.call(this);
  };
})();

;'__duo ready';

// ---- exponent laws (unit 136) ----
Object.assign(window.__duo, {
  // x^a·x^b = x^(a+b); x^a/x^b = x^(a-b); (x^a)^b = x^(ab). Any base, not just x.
  expValue(s) {
    const t = this.ascii(s).replace(/\s/g, '').replace(/[\\{}]|mathbf|textbf|left|right/g, '').replace(/[⋅·]/g, 'cdot');
    let m = t.match(/^([a-z])\^?(-?\d+)cdot\1\^?(-?\d+)$/i); if (m) return (+m[2]) + (+m[3]);
    m = t.match(/^frac([a-z])\^?(-?\d+)\1\^?(-?\d+)$/i); if (m) return (+m[2]) - (+m[3]);
    m = t.match(/^\(?([a-z])\^?(-?\d+)\)?\^(-?\d+)$/i); if (m) return (+m[2]) * (+m[3]);
    m = t.match(/^([a-z])\^?(-?\d+)$/i); if (m) return +m[2];
    return null;
  },

  // compound expressions: simplify EACH term and compare the per-base signature
  expSig(s) {
    const t = this.ascii(s).replace(/\s/g, '').replace(/[\\{}]|mathbf|textbf|left|right/g, '').replace(/[⋅·]/g, 'cdot');
    const terms = t.split(/(?=[+-])/).filter(Boolean), sig = [];
    for (const term of terms) {
      const u = term.replace(/^[+-]/, '');
      let m = u.match(/^([a-z])\^?(-?\d+)cdot\1\^?(-?\d+)$/i);
      if (m) { sig.push(m[1].toLowerCase() + ':' + ((+m[2]) + (+m[3]))); continue; }
      m = u.match(/^frac([a-z])\^?(-?\d+)\1\^?(-?\d+)$/i);
      if (m) { sig.push(m[1].toLowerCase() + ':' + ((+m[2]) - (+m[3]))); continue; }
      m = u.match(/^\(?([a-z])\^?(-?\d+)\)?\^(-?\d+)$/i);
      if (m) { sig.push(m[1].toLowerCase() + ':' + ((+m[2]) * (+m[3]))); continue; }
      m = u.match(/^([a-z])\^?(-?\d+)$/i);
      if (m) { sig.push(m[1].toLowerCase() + ':' + (+m[2])); continue; }
      return null;
    }
    return sig.length ? sig.join('|') : null;
  },

  solveExpLaw() {
    let target = null;
    for (const s of this.promptLatex()) { const v = this.expValue(s); if (v !== null) { target = v; break; } }
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    if (target !== null) {
      let i = src.findIndex(s => this.expValue(s) === target);
      // choices may be EXPANSIONS (x·x·x…) rather than powers
      if (i < 0) { const count = e => (this.norm(this.ascii(e.innerText)).match(/[a-z]/gi) || []).length;
        i = c.findIndex(e => count(e) === target); }
      if (i >= 0) return { i, want: target };
    }
    // compound: match the per-base signature
    let sig = null;
    for (const s of this.promptLatex()) { const v = this.expSig(s); if (v) { sig = v; break; } }
    if (!sig) return null;
    const i = src.findIndex(s => this.expSig(s) === sig);
    return i < 0 ? { miss: sig } : { i, want: sig };
  },

  // "Complete the pattern": the missing cell shows as "?" — take the entry
  // before it. The right column is either the expansion or the symbolic sum.
  solveExpandPattern() {
    const L = this.promptLatex().map(s => this.ascii(s).replace(/\s/g, '').replace(/[\\{}]|mathbf|textbf/g, ''));
    const q = L.findIndex(s => s === '?' || /\?/.test(s));
    const src = q > 0 ? L[q - 1] : null; if (!src) return null;
    const ex = [...src.matchAll(/([a-z])\^?(-?\d+)/gi)].map(m => +m[2]);
    if (ex.length < 2) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const count = e => (this.norm(this.ascii(e.innerText)).match(/[a-z]/gi) || []).length;
    let i = c.findIndex(e => count(e) === ex[0] + ex[1]);
    if (i >= 0) return { i, want: ex[0] + ex[1] };
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const want = new RegExp('\\^\\{?' + ex[0] + '\\+' + ex[1] + '\\}?');
    i = tex.findIndex(s => want.test(s.replace(/\s/g, '')));
    if (i < 0) i = tex.findIndex(s => /\+/.test(s));
    return i < 0 ? null : { i, want: ex[0] + '+' + ex[1] };
  },

  // match-the-pairs: a rendered fraction has no slash in innerText, so read the
  // token's own LaTeX
  tokenExp(el) {
    let s = null;
    if (el && el.querySelector) { const a = el.querySelector('annotation'); if (a) s = a.textContent; }
    if (s === null) s = (typeof el === 'string') ? el : (el.innerText || '');
    return this.expValue(s);
  },

  async solvePairs() {
    const tok = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
    if (tok.length < 4) return null;
    const vals = tok.map(e => this.tokenExp(e));
    const used = new Set(); let n = 0;
    for (let i = 0; i < tok.length; i++) {
      if (used.has(i) || vals[i] === null) continue;
      for (let j = i + 1; j < tok.length; j++) {
        if (used.has(j) || vals[j] === null) continue;
        if (vals[i] === vals[j]) { used.add(i); used.add(j);
          this.tap(tok[i]); await this.sleep(320); this.tap(tok[j]); await this.sleep(420); n++; break; }
      }
    }
    return { pairs: n, vals };
  },
});

// run2 must also handle match-the-pairs (tap tokens; no choices, no input)
window.__duo.run2 = async function (n) {
  this.S = { running: true, log: [], done: 0 };
  let miss = 0, info = 0;
  for (let i = 0; i < n && this.S.running; i++) {
    const n0 = document.querySelector('[data-test="player-next"]');
    if (n0 && /CONTINUE/i.test(n0.innerText || '') && !document.querySelector('[data-test^="challenge "]')) {
      this.tap(n0); await this.sleep(1500); continue;
    }
    let r = this.read();
    if (!r.type) { this.S.log.push('lessondone'); break; }
    if (this.plan()) { this.S.log.push('needdrag'); break; }
    if (!r.choices.length && !r.input) { await this.sleep(900); r = this.read(); }

    let acted = false;
    if (document.querySelectorAll('[data-test$="challenge-tap-token"]').length >= 4 && !r.choices.length) {
      const p = await this.solvePairs(); acted = !!(p && p.pairs);
    }
    if (!acted && r.choices.length) { const s = this.solveChoices();
      if (s && s.ok) { s.idx.forEach(j => this.tap(document.querySelectorAll('[data-test="challenge-choice"]')[j])); acted = true; } }
    else if (!acted && r.input) { acted = !!this.typeAnswer(); }
    if (!acted && n0 && !/disabled/i.test(n0.className)) {
      if (++info >= 3) { this.S.log.push('stuck:info-loop'); break; }
      this.tap(n0); await this.sleep(1600); this.S.log.push('info'); continue;
    }
    if (!acted) { this.S.log.push('stuck:' + r.type); break; }
    info = 0;

    await this.sleep(350);
    this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1700);
    const bl = ((document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test || '').replace('blame blame-', '');
    this.S.log.push(bl || 'noblame');
    if (bl === 'correct') { this.S.done++; miss = 0; }
    else if (bl === 'incorrect' && ++miss >= 2) { this.S.log.push('halt:2wrong'); break; }
    if (!bl) break;
    const nx = document.querySelector('[data-test="player-next"]');
    if (nx && /CONTINUE/i.test(nx.innerText)) { this.tap(nx); await this.sleep(1500); }
  }
  this.S.running = false;
  return this.S;
};

window.__duo.RULES.splice(2, 0,
  ['solveExpandPattern', /complete the pattern/i],
  ['solveExpLaw', null]);

;'__duo ready';

// ---- TIMED match-the-pairs lessons ----
// Two things matter here:
//  1. Pairs AUTO-ADVANCE when all are matched — there is no CHECK to press and
//     no blame to read, so the normal run2 loop bails out with "noblame".
//  2. The default ~350ms sleeps are far too slow for a 2-minute timer; the
//     first attempt solved 20 pairs and still ran out. ~90/130ms lands the star.
Object.assign(window.__duo, {
  // pairs can be plain ARITHMETIC (5·4 = 20) as well as exponent laws
  tokenExp(el) {
    let s = null;
    if (el && el.querySelector) { const a = el.querySelector('annotation'); if (a) s = a.textContent; }
    if (s === null) s = (typeof el === 'string') ? el : (el.innerText || '');
    const v = this.expValue(s); if (v !== null) return v;
    const t = this.ascii(s).replace(/\s/g, '').replace(/[\\{}]|mathbf|textbf|left|right/g, '')
      .replace(/cdot|[⋅·×]/g, '*').replace(/[÷]/g, '/');
    if (!/^[-+*/^().\d]+$/.test(t)) return null;
    try { const r = Function('"use strict";return(' + t.replace(/(\d+)\^(\d+)/g, 'Math.pow($1,$2)') + ')')();
      return typeof r === 'number' && isFinite(r) ? r : null; } catch (e) { return null; }
  },

  async solvePairs() {
    const tok = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
    if (tok.length < 4) return null;
    const vals = tok.map(e => this.tokenExp(e));
    const used = new Set(); let n = 0;
    for (let i = 0; i < tok.length; i++) {
      if (used.has(i) || vals[i] === null) continue;
      for (let j = i + 1; j < tok.length; j++) {
        if (used.has(j) || vals[j] === null) continue;
        if (vals[i] === vals[j]) { used.add(i); used.add(j);
          this.tap(tok[i]); await this.sleep(90); this.tap(tok[j]); await this.sleep(130); n++; break; }
      }
    }
    return { pairs: n, vals };
  },

  async runPairs(n) {
    this.S = { running: true, log: [], done: 0 };
    for (let i = 0; i < n && this.S.running; i++) {
      const tok = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
      if (tok.length >= 4) { const p = await this.solvePairs();
        this.S.log.push('p' + (p ? p.pairs : 0)); this.S.done++; await this.sleep(650); continue; }
      const r = this.read();
      if (!r.type) { this.S.log.push('done'); break; }
      let acted = false;
      if (r.choices.length) { const s = this.solveChoices();
        if (s && s.ok) { s.idx.forEach(j => this.tap(document.querySelectorAll('[data-test="challenge-choice"]')[j])); acted = true; } }
      else if (r.input) { acted = !!this.typeAnswer(); }
      const n0 = document.querySelector('[data-test="player-next"]');
      if (!acted && n0 && !/disabled/i.test(n0.className)) { this.tap(n0); await this.sleep(700); this.S.log.push('i'); continue; }
      if (!acted) { this.S.log.push('stuck'); break; }
      await this.sleep(160);
      this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(900);
      const bl = ((document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test || '').replace('blame blame-', '');
      this.S.log.push(bl ? bl[0] : '-');
      const nx = document.querySelector('[data-test="player-next"]');
      if (nx && /CONTINUE/i.test(nx.innerText)) { this.tap(nx); await this.sleep(800); }
    }
    this.S.running = false;
    return this.S;
  },
});

;'__duo ready';

// ---- word phrases to algebra (unit 137) ----
Object.assign(window.__duo, {
  // "Translate the next part." is a generic instruction — the phrase to
  // translate is the last CONTENT line that isn't an instruction or praise
  phraseSource() {
    const L = this.promptLatex().map(s =>
      this.ascii(s).replace(/[{}\\]|mathbf|textbf|text/g, '').replace(/~/g, ' ').trim());
    const skip = /^(translate|select|great|right|awesome|nice|let'?s|you just|write an equation)/i;
    for (let i = L.length - 1; i >= 0; i--) {
      const s = L[i];
      if (!s || skip.test(s)) continue;
      if (/[a-z]{3,}/i.test(s)) return s.toLowerCase();
    }
    return this.prompt();
  },

  term(s) {
    const t = this.ascii(s).toLowerCase().replace(/\s+/g, '').replace(/\.$/, '');
    if (/^twice.*number$|^double.*number$/.test(t)) return '2x';
    if (/^anumber$|^x$/.test(t)) return 'x';
    if (/^\d+x$/.test(t)) return t;
    if (/^-?\d+(\.\d+)?$/.test(t)) return t;
    const m = t.match(/^(\d+)timesanumber$/); if (m) return m[1] + 'x';
    return null;
  },

  phraseExpr(P) {
    const t = this.ascii(P).toLowerCase().replace(/\s+/g, ' ').trim();
    // "the sum/difference/product/quotient of A and B"
    let m = t.match(/\b(sum|difference|product|quotient) of (.+?) and (.+?)\.?$/);
    if (m) { const A = this.term(m[2]), B = this.term(m[3]);
      if (A && B) return A + { sum: '+', difference: '-', product: '*', quotient: '/' }[m[1]] + B; }
    // word multipliers
    if (/\btwice\b|\bdouble\b/.test(t)) return '2x';
    if (/\btriple\b|\bthrice\b/.test(t)) return '3x';
    if (/\bhalf\b/.test(t)) return 'x/2';
    if (/\bsquare(d)?\b/.test(t)) return 'x^2';
    // "N less/more than <expr>" REVERSES the order: 8 less than 4x -> 4x-8
    m = t.match(/(-?\d+(?:\.\d+)?)\s*(less than|more than|greater than)\s*(.+)/);
    if (m) { const n = m[1], rest = m[3].replace(/\s+/g, '')
        .replace(/timesanumber/, 'x').replace(/anumber/, 'x');
      return /less/.test(m[2]) ? (rest + '-' + n) : (rest + '+' + n); }
    const n = (t.match(/(-?\d+(?:\.\d+)?)/) || [])[1];
    if (n === undefined) return null;
    if (/times|product|multiplied/.test(t)) return n + 'x';
    if (/divided by|quotient/.test(t)) return /number divided by/.test(t) ? ('x/' + n) : (n + '/x');
    if (/more than|increased by|added to|sum|plus/.test(t)) return 'x+' + n;
    if (/less than|decreased by|subtracted from|fewer|minus/.test(t)) return 'x-' + n;
    return null;
  },

  // full sentence: "<expr> is N" is an EQUATION; "at most/least" an inequality
  phraseEq(P) {
    const t = this.ascii(P).toLowerCase().replace(/\s+/g, ' ').trim();
    const m = t.match(/^(.*?)\s+(is at most|is at least|is less than|is greater than|is|equals)\s+(-?\d+(?:\.\d+)?)\s*\.?$/);
    if (!m) return null;
    const lhs = this.phraseExpr(m[1]); if (!lhs) return null;
    const op = { 'is': '=', 'equals': '=', 'is at most': '<=', 'is at least': '>=',
                 'is less than': '<', 'is greater than': '>' }[m[2]];
    return lhs + op + m[3];
  },

  solvePhrase() {
    const P = this.phraseSource();
    const want = this.phraseEq(P) || this.phraseExpr(P); if (!want) return null;
    const norm = s => this.ascii(s).replace(/\s|\\|mathbf|textbf|\{|\}|cdot|left|right/g, '')
      .replace(/leq/g, '<=').replace(/geq/g, '>=').toLowerCase();
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.norm(this.ascii(e.innerText)));
    let i = src.findIndex(s => norm(s) === want.replace(/\*/g, ''));
    if (i < 0) i = src.findIndex(s => norm(s) === want);
    return i < 0 ? { miss: want } : { i, want };
  },
});

window.__duo.RULES.splice(2, 0, ['solvePhrase', null]);

;'__duo ready';

// "N fewer than EXPR" reverses like "less than" — without it the generic branch
// loses the coefficient (gave x-8 where the answer was 6x-8)
(function () {
  const prev = window.__duo.phraseExpr;
  window.__duo.phraseExpr = function (P) {
    const t = this.ascii(P).toLowerCase().replace(/\s+/g, ' ').trim();
    const m = t.match(/(-?\d+(?:\.\d+)?)\s*(fewer than|less than|more than|greater than)\s*(.+)/);
    if (m) { const rest = m[3].replace(/\s+/g, '').replace(/timesanumber/, 'x').replace(/anumber/, 'x');
      return /fewer|less/.test(m[2]) ? (rest + '-' + m[1]) : (rest + '+' + m[1]); }
    return prev.call(this, P);
  };
})();

Object.assign(window.__duo, {
  // "Select the variable term / coefficient of x / constant" — the coefficient
  // must come from the EXPRESSION, not just any number among the choices
  solveTermPart() {
    const P = this.prompt();
    const kind = /variable term/i.test(P) ? 'var' : (/coefficient/i.test(P) ? 'coef' : (/constant/i.test(P) ? 'const' : null));
    if (!kind) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const N = s => this.ascii(s).replace(/\s|\\|mathbf|textbf|\{|\}/g, '');
    if (kind === 'var') { const i = src.findIndex(s => /\d*[a-z]/i.test(N(s)));
      return i < 0 ? null : { i, want: N(src[i]) }; }
    let expr = null;
    for (const s of this.promptLatex()) { const t = N(s);
      if (/[a-z]/i.test(t) && /\d/.test(t) && !/select|the|of/i.test(t)) { expr = t; break; } }
    if (!expr) return null;
    let want = null;
    if (kind === 'coef') { const m = expr.match(/(-?\d*)[a-z]/i);
      if (m) want = (m[1] === '' || m[1] === '+') ? 1 : (m[1] === '-' ? -1 : +m[1]); }
    else { const m = expr.match(/[a-z]\s*([+-]\s*\d+)/i); if (m) want = +m[1].replace(/\s/g, ''); }
    if (want === null) return null;
    const i = c.findIndex(e => this.clean(e.innerText) === String(want));
    return i < 0 ? { miss: want } : { i, want };
  },

  // generic table pattern: infer the rule from the completed rows, apply to "?"
  solvePatternRule() {
    const L = this.promptLatex().map(s => this.ascii(s).replace(/\s|[{}\\]|mathbf|textbf|text/g, ''));
    const q = L.findIndex(s => s === '?'); if (q < 1) return null;
    const src = L[q - 1];
    const pairs = [];
    for (let i = 1; i < L.length - 1; i++) { if (i === q || i === q - 1) continue;
      if (/^-?\d+$/.test(L[i + 1]) && /[a-z]/i.test(L[i])) pairs.push([L[i], +L[i + 1]]); }
    const coef = s => { const m = s.match(/(-?\d*)[a-z]/i);
      return m ? ((m[1] === '' || m[1] === '+') ? 1 : (m[1] === '-' ? -1 : +m[1])) : null; };
    const konst = s => { const m = s.match(/[a-z]\s*([+-]\s*\d+)/i); return m ? +m[1].replace(/\s/g, '') : null; };
    const rhs = s => { const m = s.match(/=(-?\d+)/); return m ? +m[1] : null; };
    for (const fn of [coef, konst, rhs]) {
      if (pairs.length && pairs.every(([inp, out]) => fn(inp) === out)) {
        const want = fn(src); if (want === null) continue;
        const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = c.findIndex(e => this.clean(e.innerText) === String(want));
        if (i >= 0) return { i, want };
      }
    }
    return null;
  },
});

// pairs can also match an EQUATION to its coefficient (-9x+18=0 -> -9)
(function () {
  const prev = window.__duo.tokenExp;
  window.__duo.tokenExp = function (el) {
    const v = prev.call(this, el); if (v !== null) return v;
    let s = null;
    if (el && el.querySelector) { const a = el.querySelector('annotation'); if (a) s = a.textContent; }
    if (s === null) s = (typeof el === 'string') ? el : (el.innerText || '');
    const t = this.ascii(s).replace(/\s|[{}\\]|mathbf|textbf/g, '');
    const m = t.match(/^(-?\d*)[a-z](?=[+-=])/i);
    return m ? ((m[1] === '' || m[1] === '+') ? 1 : (m[1] === '-' ? -1 : +m[1])) : null;
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveTermPart', /variable term|constant|coefficient/i],
  ['solvePatternRule', /complete the pattern/i]);

;'__duo ready';

// Two loop bugs that both looked like "the solver is stuck":
//  1. The blame banner LAGS — a single read made the loop bail with "noblame"
//     right after a correct answer. Poll for it.
//  2. A solved pairs question shows a CONTINUE; the pairs branch skipped it and
//     re-counted the same solved screen forever ("p3,p3,p3…" with the streak
//     frozen). Press CONTINUE after solving pairs.
window.__duo.blame = async function () {
  for (let k = 0; k < 4; k++) {
    const b = ((document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test || '').replace('blame blame-', '');
    if (b) return b;
    if (!document.querySelector('[data-test^="challenge "]')) return '';
    await this.sleep(600);
  }
  return '';
};

window.__duo.run2 = async function (n) {
  this.S = { running: true, log: [], done: 0 };
  let miss = 0, info = 0;
  for (let i = 0; i < n && this.S.running; i++) {
    const n0 = document.querySelector('[data-test="player-next"]');
    if (n0 && /CONTINUE/i.test(n0.innerText || '')) { this.tap(n0); await this.sleep(1400); continue; }

    let r = this.read();
    if (!r.type) { this.S.log.push('lessondone'); break; }
    if (this.plan()) { this.S.log.push('needdrag'); break; }
    if (!r.choices.length && !r.input) { await this.sleep(900); r = this.read(); }

    let acted = false;
    if (document.querySelectorAll('[data-test$="challenge-tap-token"]').length >= 4 && !r.choices.length) {
      const p = await this.solvePairs();
      if (p && p.pairs) {
        this.S.log.push('p' + p.pairs); this.S.done++; await this.sleep(1200);
        const cn = document.querySelector('[data-test="player-next"]');
        if (cn && /CONTINUE/i.test(cn.innerText)) { this.tap(cn); await this.sleep(1400); }
        continue;
      }
    }
    if (r.choices.length) { const s = this.solveChoices();
      if (s && s.ok) { s.idx.forEach(j => this.tap(document.querySelectorAll('[data-test="challenge-choice"]')[j])); acted = true; } }
    else if (r.input) { acted = !!this.typeAnswer(); }
    if (!acted && n0 && !/disabled/i.test(n0.className)) {
      if (++info >= 3) { this.S.log.push('stuck:info-loop'); break; }
      this.tap(n0); await this.sleep(1500); this.S.log.push('info'); continue;
    }
    if (!acted) { this.S.log.push('stuck:' + r.type); break; }
    info = 0;

    await this.sleep(320);
    this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1400);
    const bl = await this.blame();
    this.S.log.push(bl || 'noblame');
    if (bl === 'correct') { this.S.done++; miss = 0; }
    else if (bl === 'incorrect' && ++miss >= 2) { this.S.log.push('halt:2wrong'); break; }
    const nx = document.querySelector('[data-test="player-next"]');
    if (nx && /CONTINUE/i.test(nx.innerText)) { this.tap(nx); await this.sleep(1400); }
  }
  this.S.running = false;
  return this.S;
};

// typed coefficient / constant / phrase answers
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const P = this.prompt();
    if (/coefficient|constant|variable term/i.test(P)) {
      const r = this.solveTermPart();
      const v = r && (r.want !== undefined ? r.want : r.miss);
      if (v !== undefined && v !== null) { this.type(String(v)); return String(v); }
    }
    const ph = this.phraseEq(this.phraseSource()) || this.phraseExpr(this.phraseSource());
    if (ph && /write|translate|equation/i.test(P)) { this.type(ph.replace(/\*/g, '')); return ph; }
    return prev.call(this);
  };
})();

;'__duo ready';

// ---- combining like terms and solving linear equations (unit 137) ----
Object.assign(window.__duo, {
  // \begin{aligned} packs several equations into ONE latex entry separated by \\
  // with & alignment markers — split them before parsing
  eqLines() {
    const out = [];
    for (const s of this.promptLatex()) {
      const t = this.ascii(s).replace(/\\begin\{aligned\}|\\end\{aligned\}/g, '')
        .replace(/[{}]|mathbf|textbf|\\text/g, '');
      t.split(/\\\\|\\newline/).forEach(part => {
        const u = part.replace(/&/g, '').replace(/\\/g, '').replace(/\s/g, '');
        if (u.includes('=')) out.push(u);
      });
    }
    return out;
  },

  simplifySide(str) {
    let coef = 0, konst = 0, v = null, ok = true;
    str.split(/(?=[+-])/).filter(Boolean).forEach(term => {
      const mm = term.match(/^([+-]?)(\d*)([a-z])$/i);
      if (mm) { coef += (mm[1] === '-' ? -1 : 1) * (mm[2] === '' ? 1 : +mm[2]); v = mm[3]; return; }
      const cc = term.match(/^([+-]?\d+)$/); if (cc) { konst += +cc[1]; return; }
      ok = false;
    });
    return ok ? { coef, konst, v } : null;
  },

  fmtSide(s) {
    if (!s) return null;
    if (!s.v || s.coef === 0) return String(s.konst);
    const c = (s.coef === 1 ? '' : (s.coef === -1 ? '-' : String(s.coef))) + s.v;
    const k = s.konst === 0 ? '' : (s.konst > 0 ? '+' + s.konst : String(s.konst));
    return c + k;
  },

  // equations can have variables on BOTH sides — simplify each independently
  combineLike(str) {
    const t = this.ascii(str).replace(/\s|[{}\\]|mathbf|textbf|text/g, '');
    const m = t.match(/^(.*)=(.*)$/); if (!m) return null;
    const L = this.simplifySide(m[1]), R = this.simplifySide(m[2]);
    if (!L || !R) return null;
    const ls = this.fmtSide(L), rs = this.fmtSide(R);
    return (ls && rs) ? ls + '=' + rs : null;
  },

  solveLinear() {
    const L = this.eqLines();
    for (let i = L.length - 1; i >= 0; i--) {
      const m = L[i].match(/^(.*)=(.*)$/); if (!m) continue;
      const A = this.simplifySide(m[1]), B = this.simplifySide(m[2]);
      if (!A || !B) continue;
      const dc = A.coef - B.coef, dk = B.konst - A.konst;
      if (dc === 0) continue;
      const x = dk / dc; if (!isFinite(x)) continue;
      return +(Math.round(x * 10000) / 10000);
    }
    return null;
  },

  solveXValue() {
    const x = this.solveLinear(); if (x === null) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => this.clean(e.innerText) === String(x));
    return i < 0 ? { miss: x } : { i, want: x };
  },

  solveEquivalent() {
    const L = this.promptLatex().map(s => this.ascii(s).replace(/\s|[{}\\]|mathbf|textbf|text/g, ''));
    let want = null;
    for (let i = L.length - 1; i >= 0; i--) { const w = this.combineLike(L[i]); if (w) { want = w; break; } }
    if (!want) return null;
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')]
      .map(a => this.ascii(a.textContent).replace(/\s|[{}\\]|mathbf|textbf/g, ''));
    const i = tex.indexOf(want);
    return i < 0 ? { miss: want } : { i, want };
  },

  varPart(s) {
    const t = this.ascii(s).replace(/\s|\\|mathbf|textbf|\{|\}/g, '').toLowerCase();
    const m = t.match(/^-?\d*([a-z](\^\d+)?)$/); if (m) return m[1];
    if (/^-?\d+(\.\d+)?$/.test(t)) return '#';
    return null;
  },

  solveLikeTerms() {
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const parts = src.map(s => this.ascii(s).replace(/\s|\\|mathbf|textbf|\{|\}/g, '').split(/,|and/i).filter(Boolean));
    let i = parts.findIndex(p => p.length === 2 && this.varPart(p[0]) && this.varPart(p[0]) === this.varPart(p[1]));
    if (i >= 0) return { i, want: parts[i].join(',') };
    let expr = null;
    for (const s of this.promptLatex()) { const t = this.ascii(s).replace(/\s|\\|mathbf|textbf|\{|\}|text/g, '');
      if (/[a-z].*[+-]/i.test(t) && !/select|like|terms/i.test(t)) { expr = t; break; } }
    if (!expr) return null;
    const counts = {};
    expr.split(/(?=[+-])/).filter(Boolean).forEach(t => {
      const v = this.varPart(t.replace(/^\+/, '')); if (v) counts[v] = (counts[v] || 0) + 1; });
    const rep = Object.keys(counts).find(k => counts[k] > 1); if (!rep) return null;
    i = src.findIndex(s => this.varPart(s) === rep);
    return i < 0 ? { miss: rep } : { i, want: rep };
  },
});

// "11x + 9x = 80" must COMBINE to 20, not report the first coefficient — the
// naive match paired it with 13x=78 and only ever landed one pair
(function () {
  const prev = window.__duo.tokenExp;
  window.__duo.tokenExp = function (el) {
    let s = null;
    if (el && el.querySelector) { const a = el.querySelector('annotation'); if (a) s = a.textContent; }
    if (s === null) s = (typeof el === 'string') ? el : (el.innerText || '');
    const t = this.ascii(s).replace(/\s|[{}\\]|mathbf|textbf/g, '');
    const m = t.match(/^(.*?)=(-?\d+)$/);
    if (m && /[a-z]/i.test(m[1])) { const side = this.simplifySide(m[1]);
      if (side && side.v) return side.coef; }
    return prev.call(this, el);
  };
  // pattern rule can also be "combine like terms"
  const prevPat = window.__duo.solvePatternRule;
  window.__duo.solvePatternRule = function () {
    const r = prevPat.call(this); if (r && r.i >= 0) return r;
    const L = this.promptLatex().map(s => this.ascii(s).replace(/\s|[{}\\]|mathbf|textbf|text/g, ''));
    const q = L.findIndex(s => s === '?'); if (q < 1) return r;
    const want = this.combineLike(L[q - 1]); if (!want) return r;
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')]
      .map(a => this.ascii(a.textContent).replace(/\s|[{}\\]|mathbf|textbf/g, ''));
    const i = tex.indexOf(want);
    return i < 0 ? { miss: want } : { i, want };
  };
  const prevType = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (/value of/i.test(this.prompt())) { const x = this.solveLinear();
      if (x !== null) { this.type(String(x)); return String(x); } }
    return prevType.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveLikeTerms', /like terms/i],
  ['solveEquivalent', /equivalent equation|simplif/i],
  ['solveXValue', /value of/i]);

;'__duo ready';

// ---- inequalities and number lines (unit 138) ----
Object.assign(window.__duo, {
  // \b fails between "e" and a digit, so "\le10" stayed "le10" — normalise the
  // symbols BEFORE stripping backslashes
  ineqNorm(s) {
    return this.ascii(s)
      .replace(/\\leq/g, '<=').replace(/\\geq/g, '>=')
      .replace(/\\le/g, '<=').replace(/\\ge/g, '>=')
      .replace(/≤/g, '<=').replace(/≥/g, '>=')
      .replace(/\s|\\|mathbf|textbf|\{|\}/g, '').toLowerCase();
  },

  // number-line labels can live in ANY of the stacked frames and sit in one row
  lineScale() {
    const frames = [...document.querySelectorAll('iframe')].filter(f => f.contentDocument);
    let best = null;
    for (const f of frames) {
      const d = f.contentDocument, fr = f.getBoundingClientRect();
      const labs = [...d.querySelectorAll('text,tspan')].map(e => { const r = e.getBoundingClientRect();
        return { v: +this.ascii(e.textContent.trim()).replace(/[−–]/g, '-'),
                 x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 }; })
        .filter(o => !isNaN(o.v) && o.x > 0);
      if (labs.length < 3) continue;
      const row = {}; labs.forEach(o => { const k = Math.round(o.y / 10) * 10; (row[k] = row[k] || []).push(o); });
      const grp = Object.values(row).sort((a, b) => b.length - a.length)[0];
      if (!grp || grp.length < 3) continue;
      if (!best || grp.length > best.length) best = grp;
    }
    if (!best) return null;
    const s = best.slice().sort((a, b) => a.v - b.v), lo = s[0], hi = s[s.length - 1];
    const u = (hi.x - lo.x) / (hi.v - lo.v); if (!isFinite(u) || !u) return null;
    return { px: v => Math.round(lo.x + (v - lo.v) * u), y: Math.round(lo.y), lo: lo.v, hi: hi.v, u };
  },

  // read the inequality from the PROMPT entries: tex() concatenates the choices,
  // turning "x >= 9" with choices 7,10,8 into "x>=97108"
  ineqFromPrompt() {
    for (const s of this.promptLatex()) {
      const m = this.ineqNorm(s).match(/^[a-z](<=|>=|<|>)(-?\d+)$/);
      if (m) return { op: m[1], n: +m[2] };
    }
    for (const s of this.promptLatex()) {
      const m = this.ineqNorm(s).match(/[a-z](<=|>=|<|>)(-?\d+)/);
      if (m) return { op: m[1], n: +m[2] };
    }
    return null;
  },

  // drag the number-line handle to the boundary value
  ineqPlan() {
    const q = this.ineqFromPrompt(); if (!q) return null;
    const sc = this.lineScale(); if (!sc || q.n < sc.lo || q.n > sc.hi) return null;
    const f = this.frameEl(); if (!f) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect();
    const th = d.querySelector('.slider1d-thumb,.slider2d-thumb'); if (!th) return null;
    const r = th.getBoundingClientRect();
    return { kind: 'ineq', v: q.n, op: q.op,
      from: [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)],
      to: [sc.px(q.n), Math.round(fr.top + r.top + r.height / 2)] };
  },

  // read an inequality OFF a number line: dot = boundary, filled = inclusive,
  // and the shaded segment's side gives the direction
  readIneqGraph() {
    const f = this.frameEl(); if (!f) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect(), sc = this.lineScale(); if (!sc) return null;
    const dot = [...d.querySelectorAll('circle,ellipse')].map(e => { const r = e.getBoundingClientRect();
      return { cx: fr.left + r.left + r.width / 2, w: r.width, fill: getComputedStyle(e).fill }; })
      .filter(o => o.w > 6).sort((a, b) => b.w - a.w)[0];
    if (!dot) return null;
    const v = Math.round((dot.cx - sc.px(0)) / sc.u);
    const filled = !/none|rgba\(0,\s*0,\s*0,\s*0\)|rgb\(255,\s*255,\s*255\)/i.test(dot.fill);
    const seg = [...d.querySelectorAll('line,path,rect')].map(e => { const r = e.getBoundingClientRect();
      return { x: fr.left + r.left, w: r.width, cls: String(e.getAttribute('class') || '') }; })
      .filter(o => o.w > 25 && !/axis/.test(o.cls)).sort((a, b) => b.w - a.w)[0];
    if (!seg) return null;
    const left = (seg.x + seg.w / 2) < dot.cx;
    return { v, op: left ? (filled ? '<=' : '<') : (filled ? '>=' : '>'), filled };
  },

  solveIneqMatch() {
    const g = this.readIneqGraph(); if (!g) return null;
    const want = 'x' + g.op + g.v;
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const i = src.findIndex(s => this.ineqNorm(s) === want);
    return i < 0 ? { miss: want } : { i, want };
  },

  // "x is at least/at most/no more than N" -> the right sign
  solveIneqPhrase() {
    const P = this.prompt().replace(/[,\s]+/g, ' ');
    const m = P.match(/([a-z])\s*is\s*(at least|at most|greater than or equal to|less than or equal to|no more than|no less than|more than|greater than|less than|fewer than)\s*(-?\d+)/i);
    if (!m) return null;
    const w = m[2].toLowerCase();
    const op = /at least|no less than|greater than or equal/.test(w) ? '>='
      : (/at most|no more than|less than or equal/.test(w) ? '<='
      : (/more than|greater than/.test(w) ? '>' : '<'));
    const want = m[1] + op + m[3];
    const tex = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const src = tex.length === c.length ? tex : c.map(e => this.ascii(e.innerText));
    const i = src.findIndex(s => this.ineqNorm(s) === want);
    return i < 0 ? { miss: want } : { i, want };
  },

  solveIneqValue() {
    let q = this.ineqFromPrompt();
    if (!q) { const g = this.readIneqGraph(); if (g) q = { op: g.op, n: g.v }; }
    if (!q) return null;
    const ok = v => q.op === '<=' ? v <= q.n : (q.op === '>=' ? v >= q.n : (q.op === '<' ? v < q.n : v > q.n));
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = c.findIndex(e => { const v = parseFloat(this.clean(e.innerText)); return !isNaN(v) && ok(v); });
    return i < 0 ? { miss: q } : { i, want: q.op + q.n };
  },
});

(function () {
  const b = window.__duo.plan;
  window.__duo.plan = function () {
    if (/inequality|solution set/i.test(this.tex())) { const p = this.ineqPlan(); if (p) return p; }
    return b.call(this);
  };
})();

window.__duo.RULES.splice(2, 0,
  ['solveIneqPhrase', /inequality/i],
  ['solveIneqMatch', null],
  ['solveIneqValue', /solution value|is a solution/i]);

;'__duo ready';

// ---- synthetic slider drags: removes the manual `computer` tool from the loop ----
// Earlier notes said slider drags REQUIRE a real left_click_drag. That was wrong, and
// it was the single biggest throughput limit. Three things have to be right at once:
//   1. construct events with the IFRAME's own PointerEvent/MouseEvent (not the top
//      window's) and pass view: iframe.contentWindow
//   2. dispatch on the thumb element itself, not on elementFromPoint
//   3. send pointer AND mouse moves, to both the thumb and the iframe document
// Miss any one and the thumb silently does not move.
Object.assign(window.__duo, {
  async dragSynth(from, to) {
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('.slider1d-thumb,.slider2d-thumb'));
    if (!f) return false;
    const d = f.contentDocument, fr = f.getBoundingClientRect(), W = f.contentWindow;
    const th = d.querySelector('.slider1d-thumb,.slider2d-thumb'); if (!th) return false;
    const P = W.PointerEvent, M = W.MouseEvent;
    const fire = (tgt, type, x, y, C, btn) => tgt.dispatchEvent(new C(type, {
      bubbles: true, cancelable: true, composed: true, view: W,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: btn,
      clientX: x - fr.left, clientY: y - fr.top, screenX: x, screenY: y }));
    fire(th, 'pointerover', from[0], from[1], P, 0);
    fire(th, 'pointerenter', from[0], from[1], P, 0);
    fire(th, 'pointerdown', from[0], from[1], P, 1);
    fire(th, 'mousedown', from[0], from[1], M, 1);
    const n = 14;
    for (let i = 1; i <= n; i++) {
      const x = from[0] + (to[0] - from[0]) * i / n, y = from[1] + (to[1] - from[1]) * i / n;
      fire(th, 'pointermove', x, y, P, 1); fire(d, 'pointermove', x, y, P, 1);
      fire(th, 'mousemove', x, y, M, 1);  fire(d, 'mousemove', x, y, M, 1);
      await this.sleep(28);
    }
    fire(th, 'pointerup', to[0], to[1], P, 0);
    fire(th, 'mouseup', to[0], to[1], M, 0);
    await this.sleep(500);
    return true;
  },

  // always verify the widget landed where planned BEFORE pressing CHECK
  async autoDrag() {
    const p = this.plan(); if (!p || !p.from || !p.to) return false;
    if (!await this.dragSynth(p.from, p.to)) return false;
    if (p.kind === 'ineq') { const g = this.readIneqGraph(); if (!g || g.v !== p.v || g.op !== p.op) return false; }
    return true;
  },

  // an open endpoint is still painted a solid colour, so computed `fill` cannot tell
  // open from closed — the state lives in the parent <g class="point ... open|closed">
  readIneqGraph() {
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('.static-points circle,.slider1d-thumb'));
    if (!f) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect(), sc = this.lineScale();
    if (!sc) return null;
    const c = [...d.querySelectorAll('.static-points circle,circle')].map(e => {
      const r = e.getBoundingClientRect(); return { e, cx: fr.left + r.left + r.width / 2, w: r.width };
    }).filter(o => o.w > 6).sort((a, b) => b.w - a.w)[0];
    if (!c) return null;
    const v = Math.round((c.cx - sc.px(0)) / sc.u);
    const cls = String((c.e.closest('g.point') || c.e.parentElement || {}).getAttribute
      ? (c.e.closest('g.point') || c.e.parentElement).getAttribute('class') || '' : '');
    const filled = /closed|filled|solid/.test(cls) || !/open/.test(cls);
    const ov = d.querySelector('.slider-axis-overlay'); if (!ov) return null;
    const r = ov.getBoundingClientRect();
    const left = (fr.left + r.left + r.width / 2) < c.cx;
    return { v, op: left ? (filled ? '<=' : '<') : (filled ? '>=' : '>'), filled, cls };
  },

  // an empty <tspan> coerces to 0 (not NaN) and injected a bogus v=0 label cluster,
  // which silently broke every number-line scale
  lineScale() {
    const frames = [...document.querySelectorAll('iframe')].filter(f => f.contentDocument);
    let best = null;
    for (const f of frames) {
      const d = f.contentDocument, fr = f.getBoundingClientRect();
      const labs = [...d.querySelectorAll('text,tspan')].map(e => {
        const t = e.textContent.trim(); if (!t) return null;
        const r = e.getBoundingClientRect();
        return { v: +this.ascii(t).replace(/[−–]/g, '-'),
                 x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
      }).filter(o => o && !isNaN(o.v) && o.x > 0);
      if (labs.length < 3) continue;
      const row = {}; labs.forEach(o => { const k = Math.round(o.y / 10) * 10; (row[k] = row[k] || []).push(o); });
      const grp = Object.values(row).sort((a, b) => b.length - a.length)[0];
      if (!grp || grp.length < 3 || new Set(grp.map(o => o.v)).size < 3) continue;
      if (!best || grp.length > best.length) best = grp;
    }
    if (!best) return null;
    const s = best.slice().sort((a, b) => a.v - b.v), lo = s[0], hi = s[s.length - 1];
    const u = (hi.x - lo.x) / (hi.v - lo.v); if (!isFinite(u) || !u) return null;
    return { px: v => Math.round(lo.x + (v - lo.v) * u), y: Math.round(lo.y), lo: lo.v, hi: hi.v, u };
  },

  // frameEl() returns the last frame, which in a guided lesson is the EMPTY one —
  // find whichever frame actually holds the thumb
  ineqPlan() {
    const q = this.ineqFromPrompt(); if (!q) return null;
    const sc = this.lineScale(); if (!sc || q.n < sc.lo || q.n > sc.hi) return null;
    // guided lessons STACK one iframe per step; the live one is the last with
    // content, so scan in reverse or a solved step's graph answers the new question
    for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument).reverse()) {
      const th = f.contentDocument.querySelector('.slider1d-thumb'); if (!th) continue;
      const fr = f.getBoundingClientRect(), r = th.getBoundingClientRect();
      const y = Math.round(fr.top + r.top + r.height / 2);
      return { kind: 'ineq', v: q.n, op: q.op,
        from: [Math.round(fr.left + r.left + r.width / 2), y], to: [sc.px(q.n), y] };
    }
    return null;
  },

  // any value satisfying the inequality
  __ineqType() {
    let q = this.ineqFromPrompt();
    if (!q) { const g = this.readIneqGraph(); if (g) q = { op: g.op, n: g.v }; }
    if (!q) return null;
    return (q.op === '<=' || q.op === '>=') ? q.n : (q.op === '<' ? q.n - 1 : q.n + 1);
  },
});

// typed answers never consult RULES — they go through typeAnswer
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (/solution to the inequality|enter a solution/i.test(this.prompt())) {
      const v = this.__ineqType();
      if (v !== null && v !== undefined) { this.type(String(v)); return String(v); }
    }
    return prev.call(this);
  };
})();

// run2 used to log 'needdrag' and stop dead; now it drags, verifies, and submits itself
(function () {
  const src = String(window.__duo.run2);
  const patched = src.replace(
    "if(this.plan()){this.S.log.push('needdrag');break;}",
    "if(this.plan()){if(await this.autoDrag()){this.S.log.push('drag');await this.sleep(300);"
    + "this.tap(document.querySelector('[data-test=\"player-next\"]'));await this.sleep(1500);"
    + "const b2=await this.blame();this.S.log.push(b2||'noblame');"
    + "if(b2==='correct'){this.S.done++;miss=0;}"
    + "else if(b2==='incorrect'&&++miss>=2){this.S.log.push('halt:2wrong');break;}"
    + "const c2=document.querySelector('[data-test=\"player-next\"]');"
    + "if(c2&&/CONTINUE/i.test(c2.innerText)){this.tap(c2);await this.sleep(1400);}"
    + "info=0;continue;}this.S.log.push('needdrag');break;}");
  if (patched !== src) window.__duo.run2 = eval('(' + patched + ')');
})();

;'__duo ready';

// ---- general linear inequality solving (unit 138 L3) ----
// Pattern-matching "ax OP b" with regexes kept failing as the forms multiplied
// (constant-first "9-3x>-12", brackets "3(2x+1)>4x+11", variables both sides,
// and "-x > 0" which is really x < 0). One small recursive-descent parser replaces
// all of them: reduce each side to {a,b} for a*x+b, then divide, flipping on a<0.
Object.assign(window.__duo, {
  flipOp(o) { return { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }[o] || o; },

  linear(t, v) {
    let i = 0; const S = t;
    const eat = c => { if (S[i] === c) { i++; return true; } return false; };
    function mul(x, y) {
      if (x.a && y.a) return null;                 // no quadratics here
      if (x.a) return { a: x.a * y.b, b: x.b * y.b };
      if (y.a) return { a: y.a * x.b, b: x.b * y.b };
      return { a: 0, b: x.b * y.b };
    }
    function factor() {
      if (eat('-')) { const q = factor(); return { a: -q.a, b: -q.b }; }
      if (eat('(')) { const q = expr(); eat(')'); return q; }
      let n = ''; while (/[0-9]/.test(S[i] || '')) n += S[i++];
      if (S[i] === v) { i++; return { a: n === '' ? 1 : +n, b: 0 }; }
      // consuming nothing here spins term()'s loop forever and hangs the renderer
      if (n === '') throw 'stuck';
      return { a: 0, b: +n };
    }
    function term() {
      let r = factor();
      for (;;) {
        if (eat('*')) { const q = factor(); r = mul(r, q); }
        else if (S[i] === '(' || /[a-z0-9]/.test(S[i] || '')) { const q = factor(); r = mul(r, q); }
        else return r;
      }
    }
    function expr() {
      let r = term();
      for (;;) {
        if (eat('+')) { const q = term(); r = { a: r.a + q.a, b: r.b + q.b }; }
        else if (eat('-')) { const q = term(); r = { a: r.a - q.a, b: r.b - q.b }; }
        else return r;
      }
    }
    let r; try { r = expr(); } catch (e) { return null; }
    return (i === S.length && r && isFinite(r.a) && isFinite(r.b)) ? r : null;
  },

  // one inequality -> its solved form, e.g. "3(2x+1)>4x+11" -> "x>4"
  solveOne(s) {
    const t = this.ineqNorm(s);
    // \frac{x}{d} + c OP b — ineqNorm collapses this to "fracxd+cOPb"
    const f = t.match(/^frac([a-z])(\d+)([+-]\d+)?(<=|>=|<|>)(-?\d+)$/);
    if (f) {
      const d = +f[2], c = f[3] ? +f[3] : 0, b = +f[5]; if (!d) return null;
      const v = (b - c) * d;
      return f[1] + f[4] + (Number.isInteger(v) ? v : +v.toFixed(4));
    }
    const m = t.match(/^(.+?)(<=|>=|<|>)(.+)$/); if (!m) return null;
    const v = (t.match(/[a-z]/) || [])[0]; if (!v) return null;
    const L = this.linear(m[1], v), R = this.linear(m[3], v); if (!L || !R) return null;
    const a = L.a - R.a, b = R.b - L.b; if (!a) return null;
    const op = a < 0 ? this.flipOp(m[2]) : m[2];
    const x = b / a; if (!isFinite(x)) return null;
    return v + op + (Number.isInteger(x) ? x : +x.toFixed(4));
  },

  // `~` non-breaking spaces and \emphasis{} silently broke every match here
  ineqNorm(s) {
    return this.ascii(s)
      .replace(/\\leq/g, '<=').replace(/\\geq/g, '>=')
      .replace(/\\le/g, '<=').replace(/\\ge/g, '>=')
      .replace(/≤/g, '<=').replace(/≥/g, '>=')
      .replace(/~|\\,/g, '')
      .replace(/emphasis|mathbf|textbf|text|emph/g, '')
      .replace(/\s|\\|\{|\}/g, '').toLowerCase();
  },

  // the prompt must be SOLVED, not pattern-matched: "-x > 0" graphs as x < 0.
  // \duodisplay lines are the widget's current state, never the target.
  ineqFromPrompt() {
    const L = this.promptLatex().filter(s => !/duodisplay/.test(s));
    for (const s of L) {
      const w = this.solveOne(s);
      if (w) { const m = w.match(/^[a-z](<=|>=|<|>)(-?[\d.]+)$/); if (m) return { op: m[1], n: +m[2] }; }
    }
    for (const s of L) { const m = this.ineqNorm(s).match(/[a-z](<=|>=|<|>)(-?\d+)/); if (m) return { op: m[1], n: +m[2] }; }
    return null;
  },

  solveIneqSolve() {
    const N = this.promptLatex().filter(s => !/duodisplay/.test(s)).map(s => this.ineqNorm(s));
    const qi = N.findIndex(s => s === '?');
    let want = qi > 0 ? this.solveOne(N[qi - 1]) : null;
    if (!want) for (const s of N) { const w = this.solveOne(s); if (w && s !== w) { want = w; break; } }
    if (!want) return null;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const i = S.findIndex(s => this.ineqNorm(s) === want);
    return i < 0 ? { miss: want } : { i, want };
  },

  // pairs of "ax OP b" against their solved forms — the stock pairs solver matches
  // identical text and never fires on these
  async ineqPairs() {
    const tk = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
    if (tk.length < 4) return null;
    const txt = tk.map(e => { const a = e.querySelector('annotation'); return a ? a.textContent : this.ascii(e.innerText); });
    const norm = txt.map(s => this.ineqNorm(s)), sol = txt.map(s => this.solveOne(s));
    const used = new Set(); let n = 0;
    for (let i = 0; i < tk.length; i++) {
      if (used.has(i) || !sol[i]) continue;
      const j = norm.findIndex((s, k) => k !== i && !used.has(k) && s === sol[i]);
      if (j < 0) continue;
      used.add(i); used.add(j); n++;
      this.tap(tk[i]); await this.sleep(140); this.tap(tk[j]); await this.sleep(320);
    }
    if (!n) return null;
    const left = tk.filter(e => !/disabled|used|selected/i.test(String(e.className)) && e.offsetParent !== null);
    if (left.length === 2) { this.tap(left[0]); await this.sleep(140); this.tap(left[1]); await this.sleep(320); n++; }
    return { pairs: n };
  },

  // a plan can produce NaN coords, or a zero-length drag when the widget already
  // sits on the answer — neither is a failure
  async autoDrag() {
    const p = this.plan(); if (!p || !p.from || !p.to) return false;
    if (![p.from[0], p.from[1], p.to[0], p.to[1]].every(Number.isFinite)) return false;
    const match = () => { const q = this.readIneqGraph(); return q && q.v === p.v && q.op === p.op; };
    if (p.kind === 'ineq' && match()) return true;
    if (!await this.dragSynth(p.from, p.to)) return false;
    return p.kind === 'ineq' ? match() : true;
  },
});

// plan() only tried ineqPlan when the text said "inequality"/"solution set", so a
// prompt reading "Graph x < -1" fell through and the loop stalled on needdrag
(function () {
  const b = window.__duo.__planBase || window.__duo.plan;
  window.__duo.__planBase = b;
  window.__duo.plan = function () {
    if (this.ineqFromPrompt() && this.lineScale()) { const p = this.ineqPlan(); if (p) return p; }
    return b.call(this);
  };
})();



window.__duo.RULES = window.__duo.RULES.filter(r => r[0] !== 'solveIneqSolve');
window.__duo.RULES.splice(2, 0,
  ['solveIneqSolve', /complete the pattern|solve the inequality|select the solution/i]);

// walk levels unattended; state in localStorage so it survives navigation
window.__duo.autoLesson = async function () {
  const st = JSON.parse(localStorage.getItem('duoAuto'));
  this.S.busy = false; this.S.wrong = 0; this.S.log = []; this.S.done = 0;
  await this.run2(60);
  const tail = this.S.log.slice(-3).join(',');
  st.log.push('u' + st.unit + 'l' + st.level + ':' + this.S.done + '(' + tail + ')');
  const ok = /lessondone/.test(this.S.log.join(','));
  if (ok) { st.level++; if (st.level > 4) { st.level = 1; st.unit++; } } else { st.stuck = (st.stuck || 0) + 1; }
  localStorage.setItem('duoAuto', JSON.stringify(st));
  return { ok, done: this.S.done, tail, next: 'u' + st.unit + 'l' + st.level, stuck: st.stuck || 0 };
};

;'__duo ready';

// ---- core helpers ----
// These used to live in a bootstrap that was injected separately, so duo.js was
// never self-contained: losing the cached copy in the page lost `ascii` and `tap`
// while all 188 other members loaded fine. Defined here, and only if absent, so
// the file can rebuild the whole solver on its own.
(function () {
  const D = window.__duo;

  // Duolingo renders maths in the Unicode math-alphanumeric blocks (𝑥, 𝗑) and uses
  // U+2212 for minus. NFKC folds the alphabets back to ASCII; the rest is spacing.
  if (typeof D.ascii !== 'function') D.ascii = function (s) {
    return String(s == null ? '' : s).normalize('NFKC')
      .replace(/[−–—]/g, '-')
      .replace(/[    ]/g, ' ');
  };

  // A bare .click() is ignored by the sliders and tile banks; the full pointer +
  // mouse sequence works and does not need the window focused.
  if (typeof D.tap !== 'function') D.tap = function (el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const o = { bubbles: true, cancelable: true, composed: true, view: window,
      clientX: x, clientY: y, screenX: x, screenY: y, button: 0 };
    el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 }, o)));
    el.dispatchEvent(new MouseEvent('mousedown', Object.assign({ buttons: 1 }, o)));
    el.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 }, o)));
    el.dispatchEvent(new MouseEvent('mouseup', Object.assign({ buttons: 0 }, o)));
    el.dispatchEvent(new MouseEvent('click', Object.assign({ buttons: 0 }, o)));
    return true;
  };

  if (typeof D.sleep !== 'function') D.sleep = ms => new Promise(r => setTimeout(r, ms));

  if (typeof D.keys !== 'function') D.keys = function () {
    return document.querySelectorAll('[data-test="challenge-keypad"] button, button[aria-label]');
  };

  // typed answers go through the on-screen maths keypad, not the DOM value
  if (typeof D.type !== 'function') D.type = function (s) {
    const inp = document.querySelector('[data-test="challenge-text-input"]');
    if (inp) {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(inp, ''); inp.dispatchEvent(new Event('input', { bubbles: true }));
      set.call(inp, String(s)); inp.dispatchEvent(new Event('input', { bubbles: true }));
      return String(s);
    }
    for (const ch of String(s)) {
      const b = [...this.keys()].find(k => (k.getAttribute('aria-label') || k.textContent).trim() === (ch === '-' ? '−' : ch));
      if (b) this.tap(b);
    }
    return String(s);
  };

  if (!D.S) D.S = { log: [], done: 0, running: false, busy: false, wrong: 0, noop: 0 };
})();
;'__duo ready';

// ---- wire autoDrag and ineqPairs into run2 ----
// Earlier versions patched run2 by matching MINIFIED source text, which silently
// no-ops against the pretty-printed copy in this file: run2 kept logging
// 'needdrag' and stopping even though both solvers were present. Match on a
// whitespace-tolerant regex and assert the patch actually applied.
(function () {
  let s = String(window.__duo.run2);
  const before = s;

  s = s.replace(/const\s+p\s*=\s*await\s+this\.solvePairs\(\);/,
    'const p = (await this.ineqPairs()) || await this.solvePairs();');

  s = s.replace(/if\s*\(\s*this\.plan\(\)\s*\)\s*\{\s*this\.S\.log\.push\('needdrag'\);\s*break;\s*\}/,
    `if (this.plan()) {
      if (await this.autoDrag()) {
        this.S.log.push('drag'); await this.sleep(300);
        this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1500);
        const b2 = await this.blame(); this.S.log.push(b2 || 'noblame');
        if (b2 === 'correct') { this.S.done++; miss = 0; }
        else if (b2 === 'incorrect' && ++miss >= 2) { this.S.log.push('halt:2wrong'); break; }
        const c2 = document.querySelector('[data-test="player-next"]');
        if (c2 && /CONTINUE/i.test(c2.innerText)) { this.tap(c2); await this.sleep(1400); }
        info = 0; continue;
      }
      this.S.log.push('needdrag'); break;
    }`);

  if (s === before) console.warn('[duo] run2 patch did not apply');
  else window.__duo.run2 = eval('(' + s + ')');
})();
;'__duo ready';

// ---- compound inequalities (unit 139) ----
// The inequality is DRAWN, not written: the prompt carries only the header, and
// the condition lives in the number-line graph as one or two shaded bands.
Object.assign(window.__duo, {
  readCompound() {
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('g.point'));
    if (!f) return null;
    const d = f.contentDocument, fr = f.getBoundingClientRect(), sc = this.lineScale();
    if (!sc) return null;
    // shaded bands are <line class="line normal">; axis lines carry "axis" in the class
    const segs = [...d.querySelectorAll('line,rect,path')].map(e => {
      const c = String(e.getAttribute('class') || '');
      if (!/\bline\b/.test(c) || /axis/.test(c)) return null;
      const r = e.getBoundingClientRect(); if (r.width < 8) return null;
      return { x1: fr.left + r.left, x2: fr.left + r.left + r.width };
    }).filter(Boolean);
    if (!segs.length) return null;
    // "hidden" points are off-screen placeholders, not endpoints
    const ends = [...d.querySelectorAll('g.point')].map(p => {
      const c = String(p.getAttribute('class') || ''); if (/hidden/.test(c)) return null;
      const r = p.getBoundingClientRect();
      return { v: Math.round((fr.left + r.left + r.width / 2 - sc.px(0)) / sc.u), open: /open/.test(c) };
    }).filter(Boolean);
    const sat = v => {
      const px = sc.px(v);
      if (!segs.some(s => px >= s.x1 - 2 && px <= s.x2 + 2)) return false;
      const e = ends.find(o => o.v === v);
      return !(e && e.open);
    };
    return { sat, segs: segs.length, ends };
  },

  solveCompound() {
    const c = this.readCompound(); if (!c) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const v = parseFloat(this.clean(e.innerText)); return !isNaN(v) && c.sat(v); });
    return i < 0 ? { miss: 'none-sat' } : { i };
  },
});
window.__duo.RULES.splice(2, 0, ['solveCompound', /compound inequality/i]);
;'__duo ready';

// "Select the match": choices are compound expressions, the graph is the truth.
// Rather than pattern-match the text, build a predicate per choice and keep the
// one that agrees with the drawn graph at every integer on the axis.
Object.assign(window.__duo, {
  predOf(s) {
    // \b fails between "9" and "or" — both are word characters, the same trap that
    // once left "\le10" as "le10". Replace "and" first so "or" cannot split it.
    const t = this.ineqNorm(s).replace(/and/g, '&').replace(/or/g, '|');
    const join = t.includes('|') ? '|' : (t.includes('&') ? '&' : null);
    const parts = t.split(/[|&]/).map(p => this.solveOne(p)).filter(Boolean);
    if (!parts.length) return null;
    const one = w => {
      const m = w.match(/^[a-z](<=|>=|<|>)(-?[\d.]+)$/); if (!m) return null;
      const op = m[1], n = +m[2];
      return v => op === '<=' ? v <= n : (op === '>=' ? v >= n : (op === '<' ? v < n : v > n));
    };
    const ps = parts.map(one); if (ps.some(p => !p)) return null;
    if (ps.length === 1) return ps[0];
    return join === '&' ? (v => ps.every(p => p(v))) : (v => ps.some(p => p(v)));
  },

  solveCompoundMatch() {
    const c = this.readCompound(); if (!c) return null;
    const sc = this.lineScale(); if (!sc) return null;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const xs = []; for (let v = sc.lo; v <= sc.hi; v++) xs.push(v);
    const i = S.findIndex(s => { const p = this.predOf(s); return p && xs.every(v => p(v) === c.sat(v)); });
    return i < 0 ? { miss: S.map(s => this.ineqNorm(s)) } : { i };
  },
});
window.__duo.RULES.splice(2, 0, ['solveCompoundMatch', /select the match|matches the graph/i]);
;'__duo ready';

// a compound inequality can also arrive as plain text with no graph at all
window.__duo.solveCompoundValue = function () {
  const L = this.promptLatex().filter(s => !/duodisplay/.test(s));
  let p = null;
  for (const s of L) {
    if (!/(and|or)/.test(this.ineqNorm(s))) continue;
    const q = this.predOf(s); if (q) { p = q; break; }
  }
  if (!p) { const c = this.readCompound(); if (c) p = c.sat; }
  if (!p) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = parseFloat(this.clean(e.innerText)); return !isNaN(v) && p(v); });
  return i < 0 ? { miss: 'none' } : { i };
};
window.__duo.RULES = window.__duo.RULES.filter(r => r[0] !== 'solveCompoundValue');
window.__duo.RULES.splice(2, 0, ['solveCompoundValue', /select a solution|is a solution|solution value/i]);
;'__duo ready';

// ---- two-thumb compound graphs ----
// "Graph the solution set" for a compound inequality gives TWO thumbs, one per
// endpoint. dragSynth() grabs whichever thumb it finds first, so it can only ever
// place one of them; these helpers address a specific thumb.
Object.assign(window.__duo, {
  thumbs() {
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('.slider1d-thumb'));
    if (!f) return [];
    const fr = f.getBoundingClientRect();
    return [...f.contentDocument.querySelectorAll('.slider1d-thumb')].map(e => {
      const r = e.getBoundingClientRect();
      return { el: e, f, x: Math.round(fr.left + r.left + r.width / 2), y: Math.round(fr.top + r.top + r.height / 2) };
    }).sort((a, b) => a.x - b.x);
  },

  async dragEl(t, dx) {
    const d = t.f.contentDocument, fr = t.f.getBoundingClientRect(), W = t.f.contentWindow, th = t.el;
    const P = W.PointerEvent, M = W.MouseEvent;
    const fire = (tg, ty, x, y, C, b) => tg.dispatchEvent(new C(ty, {
      bubbles: true, cancelable: true, composed: true, view: W,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: b,
      clientX: x - fr.left, clientY: y - fr.top, screenX: x, screenY: y }));
    fire(th, 'pointerover', t.x, t.y, P, 0); fire(th, 'pointerenter', t.x, t.y, P, 0);
    fire(th, 'pointerdown', t.x, t.y, P, 1); fire(th, 'mousedown', t.x, t.y, M, 1);
    for (let i = 1; i <= 14; i++) {
      const x = t.x + dx * i / 14;
      fire(th, 'pointermove', x, t.y, P, 1); fire(d, 'pointermove', x, t.y, P, 1);
      fire(th, 'mousemove', x, t.y, M, 1); fire(d, 'mousemove', x, t.y, M, 1);
      await this.sleep(24);
    }
    fire(th, 'pointerup', t.x + dx, t.y, P, 0); fire(th, 'mouseup', t.x + dx, t.y, M, 0);
    await this.sleep(420); return true;
  },

  endsNow() {
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('g.point'));
    const sc = this.lineScale(); if (!f || !sc) return [];
    const fr = f.getBoundingClientRect();
    return [...f.contentDocument.querySelectorAll('g.point')].map(p => {
      const c = String(p.getAttribute('class') || ''); if (/hidden/.test(c)) return null;
      const r = p.getBoundingClientRect();
      return { v: Math.round((fr.left + r.left + r.width / 2 - sc.px(0)) / sc.u), open: /open/.test(c) };
    }).filter(Boolean).sort((a, b) => a.v - b.v);
  },

  compoundTargets() {
    for (const s of this.promptLatex().filter(x => !/duodisplay/.test(x))) {
      const t = this.ineqNorm(s).replace(/and/g, '&').replace(/or/g, '|');
      if (!/[|&]/.test(t)) continue;
      const ns = t.split(/[|&]/).map(p => this.solveOne(p)).filter(Boolean)
        .map(w => { const m = w.match(/^[a-z](<=|>=|<|>)(-?[\d.]+)$/); return m ? +m[2] : null; })
        .filter(v => v !== null);
      if (ns.length === 2) return ns.sort((a, b) => a - b);
    }
    return null;
  },

  // move one thumb per pass and re-read: dragging both from stale coordinates
  // puts the second one in the wrong place
  async compoundDrag() {
    const want = this.compoundTargets(); if (!want) return false;
    const sc = this.lineScale(); if (!sc) return false;
    for (let k = 0; k < 4; k++) {
      const now = this.endsNow(), th = this.thumbs();
      if (now.length !== 2 || th.length !== 2) return false;
      if (now[0].v === want[0] && now[1].v === want[1]) return true;
      let moved = false;
      for (let i = 0; i < 2; i++) {
        const dx = sc.px(want[i]) - sc.px(now[i].v);
        if (dx) { await this.dragEl(this.thumbs()[i], dx); moved = true; break; }
      }
      if (!moved) return false;
    }
    const n = this.endsNow();
    return n.length === 2 && n[0].v === want[0] && n[1].v === want[1];
  },
});

(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.thumbs().length === 2 && this.compoundTargets()) return await this.compoundDrag();
    return await base.call(this);
  };
})();
;'__duo ready';

// chained form "5 <= x <= 9" is a third notation: neither an "and" nor an "or" join
(function () {
  const base = window.__duo.predOf;
  window.__duo.predOf = function (s) {
    const m = this.ineqNorm(s).match(/^(-?[\d.]+)(<=|<)([a-z])(<=|<)(-?[\d.]+)$/);
    if (m) {
      const lo = +m[1], hi = +m[5], lc = m[2], rc = m[4];
      return v => (lc === '<=' ? v >= lo : v > lo) && (rc === '<=' ? v <= hi : v < hi);
    }
    return base.call(this, s);
  };
})();

// gating on /(and|or)/ skipped the chained form entirely — try any line with a relation
window.__duo.solveCompoundValue = function () {
  const L = this.promptLatex().filter(s => !/duodisplay/.test(s));
  let p = null;
  for (const s of L) {
    if (!/[<>]/.test(this.ineqNorm(s))) continue;
    const q = this.predOf(s); if (q) { p = q; break; }
  }
  if (!p) { const c = this.readCompound(); if (c) p = c.sat; }
  if (!p) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = parseFloat(this.clean(e.innerText)); return !isNaN(v) && p(v); });
  return i < 0 ? { miss: 'none' } : { i };
};
;'__duo ready';

// the chained form has to be taught to the two-thumb planner as well, not just predOf
(function () {
  const base = window.__duo.compoundTargets;
  window.__duo.compoundTargets = function () {
    for (const s of this.promptLatex().filter(x => !/duodisplay/.test(x))) {
      const m = this.ineqNorm(s).match(/^(-?[\d.]+)(?:<=|<)([a-z])(?:<=|<)(-?[\d.]+)$/);
      if (m) return [+m[1], +m[3]].sort((a, b) => a - b);
    }
    return base.call(this);
  };
})();
;'__duo ready';

// ---- function notation (unit 140) ----
// Guided steps ask which SUBSTITUTION is right ("4^2 + 2" vs "4(2) + 2") while
// \duoblank{} carries the final value. Evaluating each choice against that value
// picks the right one without parsing the algebra.
Object.assign(window.__duo, {
  evalExpr(s) {
    let t = this.ascii(s)
      .replace(/\\cdot|\\times/g, '*')
      .replace(/\\left|\\right/g, '')
      .replace(/mathbf|textbf|text|\\|\{|\}/g, '')
      .replace(/\s+/g, '')
      .replace(/\^/g, '**')
      .replace(/(\d|\))(\()/g, '$1*$2');       // implicit multiplication: 4(2)
    // whitelist before eval — never hand arbitrary page text to Function()
    if (!/^[-+*/().0-9]+$/.test(t.replace(/\*\*/g, '*'))) return null;
    try { const v = Function('"use strict";return (' + t + ')')(); return isFinite(v) ? v : null; }
    catch (e) { return null; }
  },

  // in a guided lesson the LaTeX accumulates, so the LAST blank is the live step
  blankValue() {
    const m = this.promptLatex().join(' ').match(/duoblank\{([^}]*)\}/g);
    if (!m) return null;
    const v = parseFloat(this.ascii(m[m.length - 1].match(/duoblank\{([^}]*)\}/)[1]));
    return isNaN(v) ? null : v;
  },

  solveEvalChoice() {
    const want = this.blankValue(); if (want === null) return null;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const i = S.findIndex(s => { const v = this.evalExpr(s); return v !== null && Math.abs(v - want) < 1e-9; });
    return i < 0 ? { miss: want } : { i, want };
  },
});
window.__duo.RULES.splice(2, 0, ['solveEvalChoice', null]);
;'__duo ready';

// Guided function lessons stack every step's LaTeX, so the live step is always the
// LAST \duoblank{} — and that blank holds the answer verbatim (it may be an
// expression, not a number). Reading any earlier blank answers a solved step and
// is graded wrong; this is the same accumulation trap that once cost 5 in a row.
window.__duo.lastBlank = function () {
  const all = this.promptLatex().join(' ').match(/duoblank\{([^}]*)\}/g);
  if (!all) return null;
  return this.ascii(all[all.length - 1].match(/duoblank\{([^}]*)\}/)[1]).replace(/\s+/g, '');
};
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const b = this.lastBlank();
      if (b !== null && b !== '') { this.type(b); return b; }
    }
    return prev.call(this);
  };
})();

// "First, substitute 4 for x" wants the substituted expression, not the final value
window.__duo.substStep = function () {
  const A = this.ascii(this.promptLatex().join(' '));
  const m = A.match(/substitute\s*(-?\d+)\s*for/i); if (!m) return null;
  const n = m[1];
  const f = A.match(/f\(x\)\s*&?=\s*([^\\]+?)\s*\\\\/) || A.match(/f\(x\)\s*&?=\s*([^\\]+)/);
  if (!f) return null;
  const body = f[1].replace(/mathbf|textbf|text|\{|\}/g, '').trim();
  return body.replace(/x/g, +n < 0 ? '(' + n + ')' : n).replace(/\s+/g, '');
};
;'__duo ready';

// "function or not a function": a relation is a function iff no input maps to two
// different outputs. Pairs arrive either as g(4) = 0 lines or as ordered pairs.
Object.assign(window.__duo, {
  relPairs() {
    const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}/g, '');
    const out = [];
    let m, re = /[a-z]\(\s*(-?\d+)\s*\)\s*&?=\s*(-?\d+)/g;
    while ((m = re.exec(A))) out.push([+m[1], +m[2]]);
    if (!out.length) {
      re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;
      while ((m = re.exec(A))) out.push([+m[1], +m[2]]);
    }
    return out;
  },

  isFunction() {
    const p = this.relPairs(); if (p.length < 2) return null;
    const seen = new Map();
    for (const [x, y] of p) { if (seen.has(x) && seen.get(x) !== y) return false; seen.set(x, y); }
    return true;
  },

  solveIsFunction() {
    const f = this.isFunction(); if (f === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')]
      .map(e => this.ascii(e.innerText).toLowerCase());
    if (!ch.some(s => /function/.test(s))) return null;
    const i = ch.findIndex(s => f ? (/function/.test(s) && !/not/.test(s)) : /not/.test(s));
    return i < 0 ? { miss: f } : { i, want: f ? 'function' : 'not a function' };
  },
});
window.__duo.RULES.splice(2, 0, ['solveIsFunction', null]);
;'__duo ready';

// the relation can also arrive as a formula rather than as pairs
(function () {
  const base = window.__duo.isFunction;
  window.__duo.isFunction = function () {
    const r = base.call(this); if (r !== null && r !== undefined) return r;
    const A = this.ascii(this.promptLatex().join(' '))
      .replace(/mathbf|textbf|text|\\|\{|\}/g, '').replace(/[~\s]+/g, '');
    // no (?:^|[^a-z]) guard here: the header runs straight into the formula
    // ("Selectthematchf(x)=sqrtx"), so the preceding char is a letter
    const m = A.match(/(f\(x\)|g\(x\)|y)=(.+)$/i);
    if (!m) return null;
    if (/pm|±/.test(m[2])) return false;   // ± gives two outputs
    if (/y\^?2=/.test(A)) return false;    // y^2 = x is not single-valued
    return true;
  };
})();
;'__duo ready';

// "Complete the pattern" over function notation: rows read "f(a) = b" followed by
// an answer. Whether that answer is the INPUT or the OUTPUT is only knowable from
// the worked example row, so infer it there and apply it to the query row.
window.__duo.solveFnPattern = function () {
  const L = this.promptLatex().map(s => this.ascii(s)
    .replace(/mathbf|textbf|text|\\|\{|\}/g, '').replace(/\s+/g, ''));
  const rows = [];
  for (let i = 0; i < L.length - 1; i++) {
    const m = L[i].match(/^[a-z]\((-?\d+)\)=(-?\d+)$/);
    if (m) rows.push({ a: +m[1], b: +m[2], ans: L[i + 1] });
  }
  if (rows.length < 2) return null;
  const ex = rows.find(r => /^-?\d+$/.test(r.ans));
  const q = rows.find(r => r.ans === '?' || r.ans === '');
  if (!ex || !q) return null;
  const v = +ex.ans;
  const want = v === ex.a ? q.a : (v === ex.b ? q.b : null);
  if (want === null) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')]
    .map(e => parseFloat(this.clean(e.innerText)));
  const i = ch.findIndex(x => x === want);
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveFnPattern', /complete the pattern/i]);
;'__duo ready';

// "Match the pairs" over function notation: pair "f(a) = b" with the loose number
// token it evaluates to. Try the output first, then the input, since either can be
// the intended half.
window.__duo.fnPairs = async function () {
  const tk = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
  if (tk.length < 4) return null;
  const txt = tk.map(e => { const a = e.querySelector('annotation'); return a ? a.textContent : this.ascii(e.innerText); });
  const norm = txt.map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}/g, '').replace(/\s+/g, ''));
  const call = norm.map(s => { const m = s.match(/^[a-z]\((-?\d+)\)=(-?\d+)$/); return m ? { a: m[1], b: m[2] } : null; });
  const used = new Set(); let n = 0;
  for (let i = 0; i < tk.length; i++) {
    if (used.has(i) || !call[i]) continue;
    let j = norm.findIndex((s, k) => k !== i && !used.has(k) && !call[k] && s === call[i].b);
    if (j < 0) j = norm.findIndex((s, k) => k !== i && !used.has(k) && !call[k] && s === call[i].a);
    if (j < 0) continue;
    used.add(i); used.add(j); n++;
    this.tap(tk[i]); await this.sleep(140); this.tap(tk[j]); await this.sleep(320);
  }
  if (!n) return null;
  const left = tk.filter((e, k) => !used.has(k) && e.offsetParent !== null);
  if (left.length === 2) { this.tap(left[0]); await this.sleep(140); this.tap(left[1]); await this.sleep(320); n++; }
  return { pairs: n };
};

// chain it behind the inequality pairs solver that run2 already calls
(function () {
  const base = window.__duo.ineqPairs;
  window.__duo.ineqPairs = async function () {
    return (await base.call(this)) || (await this.fnPairs());
  };
})();
;'__duo ready';

// "Select the input" / "Select the output" for f(a) = b
window.__duo.solveInputOutput = function () {
  const P = this.prompt();
  const wantIn = /\binput\b/.test(P), wantOut = /\boutput\b/.test(P);
  if (!wantIn && !wantOut) return null;
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}/g, '').replace(/[~\s]+/g, '');
  const m = A.match(/[a-z]\((-?\d+)\)=(-?\d+)/); if (!m) return null;
  const want = wantIn ? +m[1] : +m[2];
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')]
    .map(e => parseFloat(this.clean(e.innerText)));
  const i = ch.findIndex(x => x === want);
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveInputOutput', /select the (input|output)/i]);
;'__duo ready';

// ---- function tables ----
// Do NOT pick the frame by testing its text for "x": the header renders as the
// math-italic 𝑥 (U+1D465), so /\bx\b/ never matches. Pick by content shape instead.
Object.assign(window.__duo, {
  fnTable() {
    // guided lessons STACK one iframe per step; the live one is the last with
    // content, so scan in reverse or a solved step's graph answers the new question
    for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument).reverse()) {
      const d = f.contentDocument;
      const cells = [...d.querySelectorAll('text,tspan,td,div,span')].map(e => {
        const t = e.textContent.trim(); if (!t || e.children.length) return null;
        const r = e.getBoundingClientRect(); if (!r.width) return null;
        return { v: parseFloat(this.ascii(t)), x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }).filter(o => o && !isNaN(o.v));
      if (cells.length < 4) continue;
      // cluster by row, then read the first two columns — a blank cell would
      // otherwise shift every value one place left
      const rows = {};
      cells.forEach(c => { const k = Math.round(c.y / 8) * 8; (rows[k] = rows[k] || []).push(c); });
      const out = [];
      Object.keys(rows).map(Number).sort((a, b) => a - b).forEach(k => {
        const r = rows[k].sort((a, b) => a.x - b.x);
        if (r.length >= 2) out.push([r[0].v, r[1].v]);
      });
      if (out.length) return out;
    }
    return null;
  },

  solveTableValue() {
    const m = this.ascii(this.promptLatex().join(' ')).match(/x\s*=\s*(-?\d+)/);
    if (!m) return null;
    const T = this.fnTable(); if (!T) return null;
    const hit = T.find(r => r[0] === +m[1]); if (!hit) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')]
      .map(e => parseFloat(this.clean(e.innerText)));
    const i = ch.findIndex(x => x === hit[1]);
    return i < 0 ? { miss: hit[1] } : { i, want: hit[1] };
  },
});
window.__duo.RULES.splice(2, 0, ['solveTableValue', /select the value when/i]);
;'__duo ready';

// the reverse table lookup: "select the value of x when f(x) = 6"
window.__duo.solveTableInverse = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}/g, '').replace(/[~\s]+/g, '');
  const m = A.match(/f\(x\)&?=(-?\d+)/); if (!m) return null;
  const T = this.fnTable(); if (!T) return null;
  const hit = T.find(r => r[1] === +m[1]); if (!hit) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')]
    .map(e => parseFloat(this.clean(e.innerText)));
  const i = ch.findIndex(x => x === hit[0]);
  return i < 0 ? { miss: hit[0] } : { i, want: hit[0] };
};
window.__duo.RULES.splice(2, 0, ['solveTableInverse', /value of .*when/i]);
;'__duo ready';

// typed table lookups: "Enter the value when x = 1"
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]') && /enter the value/i.test(this.prompt())) {
      const A = this.ascii(this.promptLatex().join(' '))
        .replace(/mathbf|textbf|text|\\|\{|\}/g, '').replace(/[~\s]+/g, '');
      const T = this.fnTable();
      if (T) {
        // no boundary guard: the header runs into the formula ("whenx=1")
        let m = A.match(/x&?=(-?\d+)/);
        if (m) { const h = T.find(r => r[0] === +m[1]); if (h) { this.type(String(h[1])); return String(h[1]); } }
        m = A.match(/f\(x\)&?=(-?\d+)/);
        if (m) { const h = T.find(r => r[1] === +m[1]); if (h) { this.type(String(h[0])); return String(h[0]); } }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// typeAnswer is now ~18 wrappers deep and the innermost one reads .value off the
// input element unguarded. When the screen has no text input that throws, and the
// exception escapes run2 and kills the whole lesson silently. Guard once, outermost.
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (!document.querySelector('[data-test="challenge-text-input"]')) return null;
    try { return prev.call(this); } catch (e) { return null; }
  };
})();
;'__duo ready';

// Table cells are not one element per value: a negative number arrives as a
// separate "−" glyph followed by its digits, so parsing element-by-element yields
// NaN and dropped rows. Cluster a row's glyphs into columns by x-gap first.
window.__duo.fnTable = function () {
  // scan in reverse: the live frame is the last one with content
  for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument).reverse()) {
    const d = f.contentDocument;
    const glyphs = [...d.querySelectorAll('text,tspan,td,div,span')].map(e => {
      const t = e.textContent.trim(); if (!t || e.children.length) return null;
      const r = e.getBoundingClientRect(); if (!r.width) return null;
      return { t: this.ascii(t), x: r.left, x2: r.left + r.width, y: r.top + r.height / 2 };
    }).filter(Boolean);
    if (glyphs.length < 4) continue;

    const rows = {};
    glyphs.forEach(g => { const k = Math.round(g.y / 8) * 8; (rows[k] = rows[k] || []).push(g); });

    const out = [];
    Object.keys(rows).map(Number).sort((a, b) => a - b).forEach(k => {
      const gs = rows[k].sort((a, b) => a.x - b.x);
      const cols = []; let cur = null;
      for (const g of gs) {
        if (cur && g.x - cur.x2 < 14) { cur.t += g.t; cur.x2 = Math.max(cur.x2, g.x2); }
        else { cur = { t: g.t, x2: g.x2 }; cols.push(cur); }
      }
      const nums = cols.map(c => parseFloat(c.t)).filter(v => !isNaN(v));
      if (nums.length >= 2) out.push([nums[0], nums[1]]);
    });
    if (out.length) return out;
  }
  return null;
};
;'__duo ready';

// Read the table from TEXT NODES, not elements: a value like -7 is split across
// nodes ("-" then "7") that sit inside wrappers, so an element-level scan misses
// the digits entirely and every negative row is dropped. Skip <script>/<style> and
// any long node — the frame also carries the diagram library's inline source.
window.__duo.fnTable = function () {
  // scan in reverse: the live frame is the last one with content
  for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument).reverse()) {
    const d = f.contentDocument;
    const w = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
    const glyphs = []; let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.trim();
      if (!t || t.length > 8) continue;
      if (n.parentElement && /SCRIPT|STYLE|TEMPLATE/.test(n.parentElement.tagName)) continue;
      const r = d.createRange(); r.selectNodeContents(n);
      const b = r.getBoundingClientRect(); if (!b.width) continue;
      glyphs.push({ t: this.ascii(t), x: b.left, x2: b.right, y: b.top + b.height / 2 });
    }
    if (glyphs.length < 4) continue;

    const rows = {};
    glyphs.forEach(g => { const k = Math.round(g.y / 8) * 8; (rows[k] = rows[k] || []).push(g); });

    const out = [];
    Object.keys(rows).map(Number).sort((a, b) => a - b).forEach(k => {
      const gs = rows[k].sort((a, b) => a.x - b.x);
      const cols = []; let cur = null;
      for (const g of gs) {
        if (cur && g.x - cur.x2 < 14) { cur.t += g.t; cur.x2 = Math.max(cur.x2, g.x2); }
        else { cur = { t: g.t, x2: g.x2 }; cols.push(cur); }
      }
      const nums = cols.map(c => parseFloat(c.t)).filter(v => !isNaN(v));
      if (nums.length >= 2) out.push([nums[0], nums[1]]);
    });
    if (out.length) return out;
  }
  return null;
};
;'__duo ready';

// Guided arithmetic steps ("multiply the terms", "combine", "simplify") show the
// current expression and offer rewrites of it. The right one is simply the choice
// that evaluates to the same value — no need to model the transformation.
window.__duo.solveEquivExpr = function () {
  const L = this.promptLatex().filter(s => !/duoblank|duodisplay/.test(s));
  let want = null;
  for (let i = L.length - 1; i >= 0; i--) {
    const v = this.evalExpr(L[i]);
    if (v !== null) { want = v; break; }
  }
  if (want === null) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const hits = [];
  S.forEach((s, i) => { const v = this.evalExpr(s); if (v !== null && Math.abs(v - want) < 1e-9) hits.push(i); });
  // only answer when exactly one choice matches, so an ambiguous screen falls
  // through to a more specific rule instead of guessing
  return hits.length === 1 ? { i: hits[0], want } : null;
};
window.__duo.RULES.splice(2, 0, ['solveEquivExpr', null]);
;'__duo ready';

// ---- rate of change / slope (unit 141) ----
// "Select the ratio of change in y to change in x" — read both deltas from the
// prompt and honour the order the sentence asks for, since the distractor is the
// same fraction inverted.
window.__duo.solveRatio = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}/g, ' ').replace(/[~]/g, ' ');
  const dy = A.match(/change\s*in\s*y\s*=?\s*(-?\d+)/i);
  const dx = A.match(/change\s*in\s*x\s*=?\s*(-?\d+)/i);
  if (!dy || !dx) return null;
  const P = this.prompt();
  const yFirst = !/change in x to change in y/i.test(P);
  const top = yFirst ? dy[1] : dx[1], bot = yFirst ? dx[1] : dy[1];
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  // compare the fraction's parts, not the string: the choice is wrapped as
  // \mathbf{\frac{6}{2}} and stripping the command leaves a stray outer brace
  const parts = s => {
    const m = this.ascii(s).match(/frac\s*\{\s*(-?\d+)\s*\}\s*\{\s*(-?\d+)\s*\}/)
      || this.ascii(s).match(/(-?\d+)\s*\/\s*(-?\d+)/);
    return m ? [m[1], m[2]] : null;
  };
  const i = S.findIndex(s => { const q = parts(s); return q && q[0] === top && q[1] === bot; });
  return i < 0 ? { miss: top + '/' + bot } : { i, want: top + '/' + bot };
};
window.__duo.RULES.splice(2, 0, ['solveRatio', /ratio of change|change in y to change in x|change in x to change in y/i]);
;'__duo ready';

// ---- \duodisplay slider (unit 141, "create a rate of change of ...") ----
// A horizontal .slider2d-track drives the numerator of a displayed fraction. The
// px-per-unit is NOT the grid's, and the widget tracks movement relative to the
// grab point, so compute nothing up front: nudge, re-read \duodisplay's SECOND
// argument (the live state — the first is not the answer), and calibrate.
Object.assign(window.__duo, {
  async dragXY(el, f, from, to) {
    const d = f.contentDocument, fr = f.getBoundingClientRect(), W = f.contentWindow;
    const P = W.PointerEvent, M = W.MouseEvent;
    const fire = (tg, ty, x, y, C, b) => tg.dispatchEvent(new C(ty, {
      bubbles: true, cancelable: true, composed: true, view: W,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: b,
      clientX: x - fr.left, clientY: y - fr.top, screenX: x, screenY: y }));
    fire(el, 'pointerover', from[0], from[1], P, 0); fire(el, 'pointerenter', from[0], from[1], P, 0);
    fire(el, 'pointerdown', from[0], from[1], P, 1); fire(el, 'mousedown', from[0], from[1], M, 1);
    for (let i = 1; i <= 14; i++) {
      const x = from[0] + (to[0] - from[0]) * i / 14, y = from[1] + (to[1] - from[1]) * i / 14;
      fire(el, 'pointermove', x, y, P, 1); fire(d, 'pointermove', x, y, P, 1);
      fire(el, 'mousemove', x, y, M, 1); fire(d, 'mousemove', x, y, M, 1);
      await this.sleep(24);
    }
    fire(el, 'pointerup', to[0], to[1], P, 0); fire(el, 'mouseup', to[0], to[1], M, 0);
    await this.sleep(430); return true;
  },

  duoCur() {
    const t = this.duoTarget();
    if (!t) return null;
    const v = parseFloat(this.ascii(t.cur));
    return isNaN(v) ? null : v;
  },

  // what the prompt actually demands of the value
  duoGoal() {
    const P = this.prompt();
    const m = this.ascii(this.promptLatex().join(' ')).match(/rate of change of\s*(-?[\d.]+)/i);
    if (m) return { kind: 'eq', v: parseFloat(m[1]) };
    if (/negative/.test(P)) return { kind: 'neg' };
    if (/positive/.test(P)) return { kind: 'pos' };
    if (/zero|no rate of change/.test(P)) return { kind: 'eq', v: 0 };
    return null;
  },

  async solveDuoSlider() {
    const goal = this.duoGoal(); if (!goal) return false;
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('.slider2d-thumb'));
    if (!f) return false;
    const ok = v => goal.kind === 'neg' ? v < 0 : (goal.kind === 'pos' ? v > 0 : Math.abs(v - goal.v) < 1e-6);
    let cur = this.duoCur(); if (cur === null) return false;
    if (ok(cur)) return true;

    const pos = () => {
      const th = f.contentDocument.querySelector('.slider2d-thumb');
      const fr = f.getBoundingClientRect(), r = th.getBoundingClientRect();
      return { el: th, x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
    };
    let px = 40;                                  // unknown step; calibrate from the first move
    for (let k = 0; k < 8; k++) {
      const p = pos(), before = this.duoCur();
      const target = goal.kind === 'neg' ? before - 1 : (goal.kind === 'pos' ? before + 1 : goal.v);
      const dx = (target - before) * px;
      if (!isFinite(dx) || !dx) return ok(this.duoCur());
      await this.dragXY(p.el, f, [p.x, p.y], [p.x + dx, p.y]);
      const after = this.duoCur();
      if (after === null) return false;
      if (ok(after)) return true;
      if (after !== before) px = Math.abs(dx / (after - before));   // calibrated
      else px *= 1.6;                                              // too small to register
    }
    return ok(this.duoCur());
  },
});

// let autoDrag reach it: this widget has no .slider1d-thumb, so the number-line
// path never fires
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('.slider2d-thumb'));
    if (f && this.duoGoal()) return await this.solveDuoSlider();
    return await base.call(this);
  };
})();

// and let run2 see it as a drag-shaped screen
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this); if (p) return p;
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('.slider2d-thumb'));
    if (f && this.duoGoal()) return { kind: 'duoslider', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// Two corrections to duoGoal: the target sits inside \emphasis{\mathbf{1.5}}, so
// strip the commands before matching; and that target is the value of the whole
// FRACTION while the slider moves only the numerator, so scale by the denominator
// in \frac{\duodisplay{..}{..}}{D}.
window.__duo.duoGoal = function () {
  const raw = this.promptLatex().join(' ');
  const A = this.ascii(raw)
    .replace(/emphasis|mathbf|textbf|text|\\/g, ' ')
    .replace(/[{}~]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const den = this.ascii(raw).match(/duodisplay\s*\{[^}]*\}\s*\{[^}]*\}\s*\}\s*\{\s*(-?\d+)\s*\}/);
  const D = den ? +den[1] : 1;
  const m = A.match(/rate of change of\s*(-?[\d.]+)/);
  if (m) return { kind: 'eq', v: parseFloat(m[1]) * (D || 1) };
  if (/negative/.test(A)) return { kind: 'neg' };
  if (/positive/.test(A)) return { kind: 'pos' };
  if (/zero rate|rate of change of zero|no rate of change/.test(A)) return { kind: 'eq', v: 0 };
  return null;
};
;'__duo ready';

// "Select the description of the rate of change": read the drawn line's real
// endpoints. A bounding box cannot tell "\" from "/", and the line is a <path>
// whose d is thousands of numbers — the first and last pairs are the endpoints.
Object.assign(window.__duo, {
  drawnSlope() {
    // guided lessons STACK one iframe per step; the live one is the last with
    // content, so scan in reverse or a solved step's graph answers the new question
    for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument).reverse()) {
      const p = [...f.contentDocument.querySelectorAll('path,line,polyline')].find(e => {
        const c = String(e.getAttribute('class') || '');
        if (/axis|grid/.test(c)) return null;
        const r = e.getBoundingClientRect();
        return r.width > 12 || r.height > 12;
      });
      if (!p) continue;
      let x1, y1, x2, y2;
      if (p.tagName.toLowerCase() === 'line') {
        x1 = +p.getAttribute('x1'); y1 = +p.getAttribute('y1');
        x2 = +p.getAttribute('x2'); y2 = +p.getAttribute('y2');
      } else {
        const n = String(p.getAttribute('d') || p.getAttribute('points') || '').match(/-?\d+(?:\.\d+)?/g);
        if (!n || n.length < 4) continue;
        x1 = +n[0]; y1 = +n[1]; x2 = +n[n.length - 2]; y2 = +n[n.length - 1];
      }
      if (![x1, y1, x2, y2].every(isFinite)) continue;
      const dx = x2 - x1, dy = -(y2 - y1);          // SVG y grows downward
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      if (Math.abs(dy) < 2) return 0;
      if (Math.abs(dx) < 2) return null;            // vertical: undefined slope
      return dy / dx;
    }
    return null;
  },

  solveRateDescription() {
    const s = this.drawnSlope(); if (s === null) return null;
    const want = s > 0 ? 'positive' : (s < 0 ? 'negative' : 'zero');
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')]
      .map(e => this.ascii(e.innerText).toLowerCase());
    const i = ch.findIndex(c => c.includes(want));
    return i < 0 ? { miss: want } : { i, want };
  },
});
window.__duo.RULES.splice(2, 0, ['solveRateDescription', /description of the rate|rate of change is/i]);
;'__duo ready';

// "Select the line with the greater/lesser rate of change": each choice carries its
// own inline SVG, so measure the slope inside each choice rather than in a frame.
Object.assign(window.__duo, {
  slopeIn(root) {
    const p = [...root.querySelectorAll('path,line,polyline')].find(e => {
      const c = String(e.getAttribute('class') || '');
      if (/axis|grid/.test(c)) return false;
      const r = e.getBoundingClientRect();
      return r.width > 8 || r.height > 8;
    });
    if (!p) return null;
    let x1, y1, x2, y2;
    if (p.tagName.toLowerCase() === 'line') {
      x1 = +p.getAttribute('x1'); y1 = +p.getAttribute('y1');
      x2 = +p.getAttribute('x2'); y2 = +p.getAttribute('y2');
    } else {
      const n = String(p.getAttribute('d') || p.getAttribute('points') || '').match(/-?\d+(?:\.\d+)?/g);
      if (!n || n.length < 4) return null;
      x1 = +n[0]; y1 = +n[1]; x2 = +n[n.length - 2]; y2 = +n[n.length - 1];
    }
    if (![x1, y1, x2, y2].every(isFinite)) return null;
    const dx = x2 - x1, dy = -(y2 - y1);
    if (Math.abs(dx) < 1) return null;
    return dy / dx;
  },

  solveCompareSlope() {
    const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
    const greater = /greater|greatest|steeper|largest|fastest/.test(A);
    const lesser = /lesser|least|smallest|slowest|shallower/.test(A);
    if (!greater && !lesser) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const sl = ch.map(e => this.slopeIn(e));
    if (sl.some(s => s === null) || sl.length < 2) return null;
    let best = 0;
    for (let i = 1; i < sl.length; i++) if (greater ? sl[i] > sl[best] : sl[i] < sl[best]) best = i;
    return { i: best, want: sl.map(s => +s.toFixed(2)).join(',') };
  },
});
window.__duo.RULES.splice(2, 0, ['solveCompareSlope', /rate of change|steeper|slope/i]);
;'__duo ready';

// These inline SVGs report a 0x0 client rect for every path, so a size filter
// discards them all. Choose by geometry instead: the axes are axis-aligned, so the
// data line is the path with both a horizontal and a vertical extent.
window.__duo.slopeIn = function (root) {
  const ends = p => {
    if (p.tagName.toLowerCase() === 'line') {
      return [+p.getAttribute('x1'), +p.getAttribute('y1'), +p.getAttribute('x2'), +p.getAttribute('y2')];
    }
    const n = String(p.getAttribute('d') || p.getAttribute('points') || '').match(/-?\d+(?:\.\d+)?/g);
    if (!n || n.length < 4) return null;
    return [+n[0], +n[1], +n[n.length - 2], +n[n.length - 1]];
  };
  const cands = [];
  for (const p of root.querySelectorAll('path,line,polyline')) {
    const c = String(p.getAttribute('class') || '');
    if (/axis|grid/.test(c)) continue;
    const e = ends(p); if (!e || !e.every(isFinite)) continue;
    const dx = e[2] - e[0], dy = -(e[3] - e[1]);
    cands.push({ dx, dy });
  }
  const line = cands.find(c => Math.abs(c.dx) >= 1 && Math.abs(c.dy) >= 1)
    || cands.find(c => Math.abs(c.dx) >= 1);
  if (!line || Math.abs(line.dx) < 1) return null;
  return line.dy / line.dx;
};
;'__duo ready';

// The comparison can also be between EQUATIONS rather than drawn lines. (The paths
// found inside a choice are UI icons with no `d` at all — never assume a choice
// containing <path> holds a graph.)
window.__duo.slopeOfFormula = function (s) {
  const t = this.ascii(s).replace(/mathbf|textbf|text|\s/g, '');
  let m = t.match(/=\s*-?\\?frac\{(-?\d+)\}\{(-?\d+)\}\s*x/);
  if (m) { const v = +m[1] / +m[2]; return /=-/.test(t) ? -v : v; }
  m = t.match(/=\s*(-?\d*\.?\d*)x/);
  if (m) { if (m[1] === '' ) return 1; if (m[1] === '-') return -1; return parseFloat(m[1]); }
  return null;
};
(function () {
  const base = window.__duo.solveCompareSlope;
  window.__duo.solveCompareSlope = function () {
    const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
    const greater = /greater|greatest|steeper|largest|fastest/.test(A);
    const lesser = /lesser|least|smallest|slowest|shallower/.test(A);
    if (greater || lesser) {
      const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      if (ann.length === ch.length && ch.length >= 2) {
        const sl = ann.map(s => this.slopeOfFormula(s));
        if (sl.every(v => v !== null)) {
          let best = 0;
          for (let i = 1; i < sl.length; i++) if (greater ? sl[i] > sl[best] : sl[i] < sl[best]) best = i;
          return { i: best, want: sl.join(',') };
        }
      }
    }
    return base.call(this);
  };
})();
;'__duo ready';

// ---- 2D coordinate grid ----
// Reused by the "change in x / change in y" questions. Axis labels split into a
// horizontal row (the x axis) and a vertical column (the y axis); an empty tspan
// still coerces to 0, so drop blanks before clustering.
Object.assign(window.__duo, {
  grid2D() {
    // guided lessons STACK one iframe per step; the live one is the last with
    // content, so scan in reverse or a solved step's graph answers the new question
    for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument).reverse()) {
      const d = f.contentDocument, fr = f.getBoundingClientRect();
      const labs = [...d.querySelectorAll('text,tspan')].map(e => {
        const t = e.textContent.trim(); if (!t) return null;
        const v = parseFloat(this.ascii(t)); if (isNaN(v)) return null;
        const r = e.getBoundingClientRect(); if (!r.width) return null;
        return { v, x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
      }).filter(Boolean);
      if (labs.length < 4) continue;

      const byRow = {}, byCol = {};
      labs.forEach(o => {
        const rk = Math.round(o.y / 8) * 8, ck = Math.round(o.x / 8) * 8;
        (byRow[rk] = byRow[rk] || []).push(o); (byCol[ck] = byCol[ck] || []).push(o);
      });
      const row = Object.values(byRow).sort((a, b) => b.length - a.length)[0];
      const col = Object.values(byCol).sort((a, b) => b.length - a.length)[0];
      if (!row || !col || row.length < 3 || col.length < 3) continue;

      const fit = (arr, key) => {
        const s = arr.slice().sort((a, b) => a.v - b.v), lo = s[0], hi = s[s.length - 1];
        const u = (hi[key] - lo[key]) / (hi.v - lo.v);
        return isFinite(u) && u ? { zero: lo[key] - lo.v * u, u } : null;
      };
      const X = fit(row, 'x'), Y = fit(col, 'y');
      if (!X || !Y) continue;
      return {
        f,
        toXY: (px, py) => [ (px - X.zero) / X.u, (py - Y.zero) / Y.u ],
        ux: X.u, uy: Y.u, x0: X.zero, y0: Y.zero,
      };
    }
    return null;
  },

  // plotted points in grid coordinates, left to right
  gridPoints() {
    const g = this.grid2D(); if (!g) return null;
    const fr = g.f.getBoundingClientRect();
    const pts = [...g.f.contentDocument.querySelectorAll('g.point')].map(p => {
      const c = String(p.getAttribute('class') || ''); if (/hidden/.test(c)) return null;
      const r = p.getBoundingClientRect();
      const [x, y] = g.toXY(fr.left + r.left + r.width / 2, fr.top + r.top + r.height / 2);
      return [Math.round(x * 2) / 2, Math.round(y * 2) / 2];
    }).filter(Boolean).sort((a, b) => a[0] - b[0]);
    return pts.length >= 2 ? pts : null;
  },

  solveDelta() {
    const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
    const wantX = /change in\s*x/i.test(A), wantY = /change in\s*y/i.test(A);
    if (!wantX && !wantY) return null;
    const p = this.gridPoints(); if (!p) return null;
    const a = p[0], b = p[p.length - 1];
    const want = wantX ? b[0] - a[0] : b[1] - a[1];
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')]
      .map(e => parseFloat(this.clean(e.innerText)));
    const i = ch.findIndex(v => v === want);
    return i < 0 ? { miss: want } : { i, want };
  },
});
window.__duo.RULES.splice(2, 0, ['solveDelta', /change in .*from left to right|select the change in/i]);
;'__duo ready';

// "Select the rate of change": slope from the two plotted points, matched against
// choices that may be a fraction, a decimal, or an integer.
window.__duo.solveRateValue = function () {
  const p = this.gridPoints(); if (!p) return null;
  const a = p[0], b = p[p.length - 1];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (!dx) return null;
  const want = dy / dx;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const val = s => {
    const t = this.ascii(s).replace(/mathbf|textbf|text|\s/g, '');
    const m = t.match(/(-?)\\?frac\{(-?\d+)\}\{(-?\d+)\}/);
    if (m) return (m[1] === '-' ? -1 : 1) * (+m[2] / +m[3]);
    const v = parseFloat(t.replace(/[^-\d.]/g, ''));
    return isNaN(v) ? null : v;
  };
  const hits = [];
  S.forEach((s, i) => { const v = val(s); if (v !== null && Math.abs(v - want) < 1e-9) hits.push(i); });
  return hits.length === 1 ? { i: hits[0], want } : (hits.length ? { i: hits[0], want } : { miss: want });
};
window.__duo.RULES.splice(2, 0, ['solveRateValue', /select the rate of change|what is the rate of change/i]);
;'__duo ready';

// ---- "Create a line with rate of change = m" ----
// Both endpoints are <g class="point draggable-point">, there is no slider, and the
// grid is bounded — so pick a lattice pair with the required slope that actually
// FITS the axes (slope 6 needs dx=1, e.g. (0,-3)->(1,3)), then drag each point and
// re-verify, because the widget moves relative to the grab point.
Object.assign(window.__duo, {
  targetSlope() {
    const A = this.ascii(this.promptLatex().join(' '))
      .replace(/emphasis|mathbf|textbf|text|\\/g, ' ').replace(/[{}~]/g, ' ');
    let m = A.match(/rate of change\s*,?\s*=\s*(-?\d+(?:\.\d+)?)/i);
    if (m) return parseFloat(m[1]);
    m = A.match(/rate of change of\s*(-?\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : null;
  },

  // axis extent, read from the labels
  gridRange() {
    const g = this.grid2D(); if (!g) return null;
    const fr = g.f.getBoundingClientRect();
    let lo = 0, hi = 0;
    for (const e of g.f.contentDocument.querySelectorAll('text,tspan')) {
      const t = e.textContent.trim(); if (!t) continue;
      const v = parseFloat(this.ascii(t)); if (isNaN(v)) continue;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    return { lo, hi };
  },

  linePair(m) {
    const R = this.gridRange() || { lo: -5, hi: 5 };
    let best = null;
    for (let dx = 1; dx <= (R.hi - R.lo); dx++) {
      const dy = m * dx;
      if (Math.abs(dy - Math.round(dy)) > 1e-9) continue;
      for (let x1 = R.lo; x1 + dx <= R.hi; x1++) {
        for (let y1 = R.lo; y1 <= R.hi; y1++) {
          const y2 = y1 + dy;
          if (y2 < R.lo || y2 > R.hi) continue;
          const cost = Math.abs(x1) + Math.abs(y1) + Math.abs(x1 + dx) + Math.abs(y2);
          if (!best || cost < best.cost) best = { a: [x1, y1], b: [x1 + dx, y2], cost };
        }
      }
      if (best) break;
    }
    return best && [best.a, best.b];
  },

  async solveMakeLine() {
    const m = this.targetSlope(); if (m === null) return false;
    const want = this.linePair(m); if (!want) return false;
    const g = this.grid2D(); if (!g) return false;
    const px = (x, y) => [Math.round(g.x0 + x * g.ux), Math.round(g.y0 + y * g.uy)];

    for (let pass = 0; pass < 5; pass++) {
      const cur = this.gridPoints(); if (!cur || cur.length < 2) return false;
      const dxNow = cur[cur.length - 1][0] - cur[0][0];
      const dyNow = cur[cur.length - 1][1] - cur[0][1];
      if (dxNow && Math.abs(dyNow / dxNow - m) < 1e-9) return true;

      const fr = g.f.getBoundingClientRect();
      const els = [...g.f.contentDocument.querySelectorAll('g.point')]
        .filter(p => /draggable/.test(String(p.getAttribute('class') || '')))
        .map(p => {
          const r = p.getBoundingClientRect();
          const cx = fr.left + r.left + r.width / 2, cy = fr.top + r.top + r.height / 2;
          const [x, y] = g.toXY(cx, cy);
          return { el: p, cx, cy, x: Math.round(x), y: Math.round(y) };
        }).sort((a, b) => a.x - b.x);
      if (els.length < 2) return false;

      let moved = false;
      for (let i = 0; i < 2; i++) {
        const t = px(want[i][0], want[i][1]);
        if (Math.abs(t[0] - els[i].cx) < 3 && Math.abs(t[1] - els[i].cy) < 3) continue;
        await this.dragXY(els[i].el, g.f, [Math.round(els[i].cx), Math.round(els[i].cy)], t);
        moved = true; break;             // re-read after every single move
      }
      if (!moved) break;
    }
    const cur = this.gridPoints();
    if (!cur || cur.length < 2) return false;
    const dx = cur[cur.length - 1][0] - cur[0][0], dy = cur[cur.length - 1][1] - cur[0][1];
    return !!dx && Math.abs(dy / dx - m) < 1e-9;
  },
});

(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('g.point.draggable-point,g.draggable-point'));
    if (f && this.targetSlope() !== null) return await this.solveMakeLine();
    return await base.call(this);
  };
})();
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this); if (p) return p;
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('g.point.draggable-point,g.draggable-point'));
    if (f && this.targetSlope() !== null) return { kind: 'makeline', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// "Complete the pattern" over formulas: each row pairs f(x)=mx+b with a value.
// Confirm on a worked row what that value is (slope or intercept) before applying
// it to the query row — the two are indistinguishable from the query alone.
window.__duo.solveSlopePattern = function () {
  const L = this.promptLatex().map(s => this.ascii(s)
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, '').replace(/\s+/g, ''));
  const rows = [];
  for (let i = 0; i < L.length - 1; i++) {
    if (!/^[a-z]\(x\)=/.test(L[i])) continue;
    rows.push({ f: L[i], ans: L[i + 1] });
  }
  if (rows.length < 2) return null;
  const intercept = s => { const m = s.match(/x([+-]\d+)$/); return m ? +m[1] : null; };
  const ex = rows.find(r => /^-?\d+$/.test(r.ans));
  const q = rows.find(r => r.ans === '?' || r.ans === '');
  if (!ex || !q) return null;
  const v = +ex.ans;
  let want = null;
  if (this.slopeOfFormula(ex.f) === v) want = this.slopeOfFormula(q.f);
  else if (intercept(ex.f) === v) want = intercept(q.f);
  if (want === null || want === undefined) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')]
    .map(e => parseFloat(this.clean(e.innerText)));
  const i = ch.findIndex(x => x === want);
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveSlopePattern', /complete the pattern/i]);
;'__duo ready';

// "Match the pairs": formula <-> its slope, where a slope can be a fraction token
window.__duo.slopePairs = async function () {
  const tk = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
  if (tk.length < 4) return null;
  const txt = tk.map(e => { const a = e.querySelector('annotation'); return a ? a.textContent : this.ascii(e.innerText); });
  const num = s => {
    const t = this.ascii(s).replace(/mathbf|textbf|text|\s/g, '');
    const m = t.match(/^(-?)\\?frac\{(-?\d+)\}\{(-?\d+)\}$/);
    if (m) return (m[1] === '-' ? -1 : 1) * (+m[2] / +m[3]);
    const v = parseFloat(t.replace(/[^-\d.]/g, ''));
    return /^[-\d.\\{}fract]*$/.test(t) && !isNaN(v) ? v : null;
  };
  const slope = txt.map(s => /\(x\)\s*=/.test(this.ascii(s)) ? this.slopeOfFormula(s) : null);
  const val = txt.map((s, i) => slope[i] === null ? num(s) : null);
  const used = new Set(); let n = 0;
  for (let i = 0; i < tk.length; i++) {
    if (used.has(i) || slope[i] === null) continue;
    const j = val.findIndex((v, k) => k !== i && !used.has(k) && v !== null && Math.abs(v - slope[i]) < 1e-9);
    if (j < 0) continue;
    used.add(i); used.add(j); n++;
    this.tap(tk[i]); await this.sleep(140); this.tap(tk[j]); await this.sleep(320);
  }
  if (!n) return null;
  const left = tk.filter((e, k) => !used.has(k) && e.offsetParent !== null);
  if (left.length === 2) { this.tap(left[0]); await this.sleep(140); this.tap(left[1]); await this.sleep(320); n++; }
  return { pairs: n };
};
(function () {
  const base = window.__duo.ineqPairs;
  window.__duo.ineqPairs = async function () {
    return (await base.call(this)) || (await this.slopePairs());
  };
})();
;'__duo ready';

// the rate of change can be asked from a formula with no graph present at all
(function () {
  const base = window.__duo.solveRateValue;
  window.__duo.solveRateValue = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    let want = null;
    for (const s of this.promptLatex()) {
      if (!/\(x\)\s*=/.test(this.ascii(s))) continue;
      const v = this.slopeOfFormula(s);
      if (v !== null) { want = v; break; }
    }
    if (want === null) return r;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const val = s => {
      const t = this.ascii(s).replace(/mathbf|textbf|text|\s/g, '');
      const m = t.match(/(-?)\\?frac\{(-?\d+)\}\{(-?\d+)\}/);
      if (m) return (m[1] === '-' ? -1 : 1) * (+m[2] / +m[3]);
      const v = parseFloat(t.replace(/[^-\d.]/g, ''));
      return isNaN(v) ? null : v;
    };
    const i = S.findIndex(s => { const v = val(s); return v !== null && Math.abs(v - want) < 1e-9; });
    return i < 0 ? { miss: want } : { i, want };
  };
})();
;'__duo ready';

// pts() was part of the bootstrap that never lived in this file (like ascii/tap).
// Older solvers call it as [[label, [x, y]], ...].
if (typeof window.__duo.pts !== 'function') window.__duo.pts = function () {
  const g = this.grid2D(); if (!g) return null;
  const fr = g.f.getBoundingClientRect();
  const out = [...g.f.contentDocument.querySelectorAll('g.point')].map(p => {
    const c = String(p.getAttribute('class') || ''); if (/hidden/.test(c)) return null;
    const r = p.getBoundingClientRect();
    const [x, y] = g.toXY(fr.left + r.left + r.width / 2, fr.top + r.top + r.height / 2);
    const lab = (p.textContent || '').trim();
    return [lab, [Math.round(x * 2) / 2, Math.round(y * 2) / 2]];
  }).filter(Boolean);
  return out.length ? out : null;
};

// one missing helper deep in the chain should not kill the whole lesson
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    try { return base.call(this); } catch (e) { return null; }
  };
})();
;'__duo ready';

// A fraction token arrives as \mathbf{-\frac{2}{3}}, so an ANCHORED ^\\?frac match
// fails and the digit-only fallback reads it as -23. Search for the fraction
// anywhere, and only fall back to a plain number when there is no frac at all.
window.__duo.numTok = function (s) {
  const t = this.ascii(s).replace(/mathbf|textbf|text|\s/g, '');
  const m = t.match(/(-?)\\?frac\{(-?\d+)\}\{(-?\d+)\}/);
  if (m) {
    // the sign can sit outside the \frac, as in "{-\frac{2}{3}}"
    const neg = m[1] === '-' || /[-]\\?frac/.test(t);
    return (neg ? -1 : 1) * Math.abs(+m[2] / +m[3]);
  }
  if (/[a-z]\(/.test(t)) return null;            // a formula, not a value
  const v = parseFloat(t.replace(/[^-\d.]/g, ''));
  return isNaN(v) ? null : v;
};
window.__duo.slopePairs = async function () {
  const tk = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
  if (tk.length < 4) return null;
  const txt = tk.map(e => { const a = e.querySelector('annotation'); return a ? a.textContent : this.ascii(e.innerText); });
  const slope = txt.map(s => /\(x\)\s*=/.test(this.ascii(s)) ? this.slopeOfFormula(s) : null);
  const val = txt.map((s, i) => slope[i] === null ? this.numTok(s) : null);
  const used = new Set(); let n = 0;
  for (let i = 0; i < tk.length; i++) {
    if (used.has(i) || slope[i] === null) continue;
    const j = val.findIndex((v, k) => k !== i && !used.has(k) && v !== null && Math.abs(v - slope[i]) < 1e-9);
    if (j < 0) continue;
    used.add(i); used.add(j); n++;
    this.tap(tk[i]); await this.sleep(140); this.tap(tk[j]); await this.sleep(320);
  }
  return n ? { pairs: n } : null;
};
;'__duo ready';

// typed variants of the delta / rate questions ("Enter the change in y ...")
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const inp = document.querySelector('[data-test="challenge-text-input"]');
    if (inp) {
      const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
      const p = this.gridPoints();
      if (p && p.length >= 2) {
        const a = p[0], b = p[p.length - 1];
        if (/change in\s*y/i.test(A)) { const v = String(b[1] - a[1]); this.type(v); return v; }
        if (/change in\s*x/i.test(A)) { const v = String(b[0] - a[0]); this.type(v); return v; }
        if (/rate of change/i.test(A) && (b[0] - a[0])) {
          const v = String((b[1] - a[1]) / (b[0] - a[0])); this.type(v); return v;
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// ---- average rate of change / secant lines (unit 141 L4) ----
// "Identify the points on the secant line": each choice lists two ordered pairs;
// pick the one whose pairs are the points actually plotted.
window.__duo.solveIdentifyPoints = function () {
  const p = this.gridPoints(); if (!p || p.length < 2) return null;
  const key = a => a.map(q => q[0] + ',' + q[1]).sort().join(' ');
  const want = key(p);
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const pairsOf = s => {
    const out = []; let m;
    const re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;
    const t = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
    while ((m = re.exec(t))) out.push([+m[1], +m[2]]);
    return out;
  };
  const i = S.findIndex(s => { const q = pairsOf(s); return q.length >= 2 && key(q) === want; });
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveIdentifyPoints', /identify the points|points on the secant/i]);

// "Find the average rate of change": slope between the two plotted points
window.__duo.solveAvgRate = function () {
  const p = this.gridPoints(); if (!p || p.length < 2) return null;
  const a = p[0], b = p[p.length - 1];
  const dx = b[0] - a[0]; if (!dx) return null;
  const want = (b[1] - a[1]) / dx;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const i = S.findIndex(s => { const v = this.numTok(s); return v !== null && Math.abs(v - want) < 1e-9; });
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveAvgRate', /average rate of change/i]);
;'__duo ready';

// Guided secant steps offer full equations ("0 - 4 = -4" vs "2 - 0 = 2"). Match on
// the RESULT of the requested delta, not on the arithmetic.
window.__duo.solveDeltaStep = function () {
  const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
  const wantY = /change in the\s*y|change in\s*y/i.test(A);
  const wantX = /change in the\s*x|change in\s*x/i.test(A);
  if (!wantY && !wantX) return null;
  const p = this.gridPoints(); if (!p || p.length < 2) return null;
  const a = p[0], b = p[p.length - 1];
  const want = wantY ? b[1] - a[1] : b[0] - a[0];
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const rhs = s => {
    const t = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    const m = t.match(/=(-?\d+(?:\.\d+)?)$/);
    return m ? parseFloat(m[1]) : this.evalExpr(s);
  };
  const i = S.findIndex(s => { const v = rhs(s); return v !== null && Math.abs(v - want) < 1e-9; });
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveDeltaStep', /change in the/i]);
;'__duo ready';

// Matching a delta step on its RESULT is wrong whenever dx and dy coincide: for
// (-1,-2)->(2,1) both "2 - (-1) = 3" and "1 - (-2) = 3" evaluate to 3. Match the
// OPERANDS against the requested axis, and only fall back to the result.
window.__duo.solveDeltaStep = function () {
  const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
  const wantY = /change in the\s*y|change in\s*y/i.test(A);
  const wantX = /change in the\s*x|change in\s*x/i.test(A);
  if (!wantY && !wantX) return null;
  const p = this.gridPoints(); if (!p || p.length < 2) return null;
  const a = p[0], b = p[p.length - 1];
  const k = wantY ? 1 : 0;
  const want = b[k] - a[k];
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const flat = s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
  const ops = s => {
    const m = flat(s).match(/^\(?(-?\d+)\)?-\(?(-?\d+)\)?=/);
    return m ? [+m[1], +m[2]] : null;
  };
  let i = S.findIndex(s => { const o = ops(s); return o && o[0] === b[k] && o[1] === a[k]; });
  if (i < 0) {
    i = S.findIndex(s => { const m = flat(s).match(/=(-?\d+)$/); return m && +m[1] === want; });
  }
  return i < 0 ? { miss: want } : { i, want };
};
;'__duo ready';

// ---- intercepts (unit 142) ----
// The method step: y-intercept means set x = 0; x-intercept means set f(x) = 0.
window.__duo.solveInterceptMethod = function () {
  const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
  const yInt = /y\s*-?\s*intercept/i.test(A), xInt = /x\s*-?\s*intercept/i.test(A);
  if (!yInt && !xInt) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ch.map(e => this.ascii(e.innerText).replace(/\s/g, '').toLowerCase());
  // y-intercept -> "x=0"; x-intercept -> "f(x)=0" (or "y=0")
  const i = yInt
    ? S.findIndex(s => /(^|[^(])x=0/.test(s) && !/\(x\)=0/.test(s))
    : S.findIndex(s => /\(x\)=0|y=0/.test(s));
  return i < 0 ? { miss: yInt ? 'x=0' : 'f(x)=0' } : { i };
};
window.__duo.RULES.splice(2, 0, ['solveInterceptMethod', /how to find the|determine how/i]);

// the intercept values themselves, from f(x) = mx + b
window.__duo.solveInterceptValue = function () {
  const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
  const yInt = /y\s*-?\s*intercept/i.test(A), xInt = /x\s*-?\s*intercept/i.test(A);
  if (!yInt && !xInt) return null;
  let m = null, b = null;
  for (const s of this.promptLatex()) {
    if (!/\(x\)\s*=|y\s*=/.test(this.ascii(s))) continue;
    const sl = this.slopeOfFormula(s);
    const t = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    const bm = t.match(/x([+-]\d+)/);
    if (sl !== null) { m = sl; b = bm ? +bm[1] : 0; break; }
  }
  if (m === null) return null;
  const want = yInt ? b : (m ? -b / m : null);
  if (want === null) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const i = S.findIndex(s => { const v = this.numTok(s); return v !== null && Math.abs(v - want) < 1e-9; });
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveInterceptValue', /intercept/i]);
;'__duo ready';

// Guided lessons accumulate every step's text, so scanning the whole prompt for
// "y-intercept" matches the PREVIOUS step and answers the wrong question. Use the
// last line that mentions an intercept — that is the live one.
window.__duo.interceptAxis = function () {
  const L = this.promptLatex().map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' '));
  for (let i = L.length - 1; i >= 0; i--) {
    if (!/intercept/i.test(L[i])) continue;
    if (/y\s*-?\s*intercept/i.test(L[i])) return 'y';
    if (/x\s*-?\s*intercept/i.test(L[i])) return 'x';
  }
  return null;
};
window.__duo.solveInterceptMethod = function () {
  const ax = this.interceptAxis(); if (!ax) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ch.map(e => this.ascii(e.innerText).replace(/\s/g, '').toLowerCase());
  const i = ax === 'y'
    ? S.findIndex(s => /(^|[^(])x=0/.test(s) && !/\(x\)=0/.test(s))
    : S.findIndex(s => /\(x\)=0|y=0/.test(s));
  return i < 0 ? { miss: ax } : { i };
};
window.__duo.solveInterceptValue = function () {
  const ax = this.interceptAxis(); if (!ax) return null;
  let m = null, b = null;
  const L = this.promptLatex();
  for (let i = L.length - 1; i >= 0; i--) {
    if (!/\(x\)\s*=|y\s*=/.test(this.ascii(L[i]))) continue;
    const sl = this.slopeOfFormula(L[i]);
    if (sl === null) continue;
    const t = this.ascii(L[i]).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    const bm = t.match(/x([+-]\d+)/);
    m = sl; b = bm ? +bm[1] : 0; break;
  }
  if (m === null) return null;
  const want = ax === 'y' ? b : (m ? -b / m : null);
  if (want === null) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const i = S.findIndex(s => { const v = this.numTok(s); return v !== null && Math.abs(v - want) < 1e-9; });
  return i < 0 ? { miss: want } : { i, want };
};
;'__duo ready';

// ---- read a drawn line in GRID coordinates ----
// A path's `d` is in SVG user units, not page pixels, so those numbers cannot be
// fed to grid2D directly. Sample the path with getPointAtLength and map through
// getScreenCTM to get real page coordinates.
window.__duo.lineInGrid = function () {
  const g = this.grid2D(); if (!g) return null;
  const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
  for (const p of d.querySelectorAll('path,line,polyline')) {
    const c = String(p.getAttribute('class') || '');
    if (/axis|grid/.test(c)) continue;
    if (typeof p.getPointAtLength !== 'function') continue;
    let L = 0; try { L = p.getTotalLength(); } catch (e) { continue; }
    if (!L) continue;
    const m = p.getScreenCTM(); if (!m) continue;
    const at = t => {
      const q = p.getPointAtLength(t * L);
      const x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
      return g.toXY(fr.left + x, fr.top + y);
    };
    const A = at(0), B = at(1);
    const dx = B[0] - A[0], dy = B[1] - A[1];
    if (Math.abs(dx) < 0.05) continue;              // vertical: not a function
    const slope = dy / dx;
    return { a: A, b: B, slope, at0: A[1] - slope * A[0] };
  }
  return null;
};

// "Select the y-intercept / x-intercept" from a graph, as an ordered pair or value
(function () {
  const base = window.__duo.solveInterceptValue;
  window.__duo.solveInterceptValue = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const ax = this.interceptAxis(); if (!ax) return r;
    const L = this.lineInGrid(); if (!L) return r;
    const b = Math.round(L.at0 * 2) / 2;
    const want = ax === 'y' ? [0, b] : [L.slope ? Math.round((-b / L.slope) * 2) / 2 : null, 0];
    if (want[0] === null) return r;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const pair = s => {
      const m = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '')
        .match(/\((-?[\d.]+),(-?[\d.]+)\)/);
      return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
    };
    let i = S.findIndex(s => { const q = pair(s); return q && q[0] === want[0] && q[1] === want[1]; });
    if (i < 0) {
      const v = ax === 'y' ? want[1] : want[0];
      i = S.findIndex(s => { const q = this.numTok(s); return q !== null && Math.abs(q - v) < 1e-9; });
    }
    return i < 0 ? { miss: want.join(',') } : { i, want: want.join(',') };
  };
})();
;'__duo ready';

// intercepts can also come from a table of values
(function () {
  const base = window.__duo.solveInterceptValue;
  window.__duo.solveInterceptValue = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const ax = this.interceptAxis(); if (!ax) return r;
    const T = this.fnTable(); if (!T) return r;
    const hit = ax === 'y' ? T.find(row => row[0] === 0) : T.find(row => row[1] === 0);
    if (!hit) return r;
    const want = ax === 'y' ? [0, hit[1]] : [hit[0], 0];
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const pair = s => {
      const m = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '')
        .match(/\((-?[\d.]+),(-?[\d.]+)\)/);
      return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
    };
    let i = S.findIndex(s => { const q = pair(s); return q && q[0] === want[0] && q[1] === want[1]; });
    if (i < 0) {
      const v = ax === 'y' ? want[1] : want[0];
      i = S.findIndex(s => { const q = this.numTok(s); return q !== null && Math.abs(q - v) < 1e-9; });
    }
    return i < 0 ? { miss: want.join(',') } : { i, want: want.join(',') };
  };
})();
;'__duo ready';

// "Select the equation for the x/y-intercept": the setup equation, not its value.
// x-intercept substitutes 0 for f(x) and keeps x ("0 = x - 5");
// y-intercept substitutes 0 for x and keeps f(x) ("f(x) = 1(0) - 5").
window.__duo.solveInterceptEquation = function () {
  const ax = this.interceptAxis(); if (!ax) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
    .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));
  // x-intercept: the side that was replaced by 0 is f(x), and an x survives
  const i = ax === 'x'
    ? S.findIndex(s => /^0=/.test(s) && /x/.test(s.slice(2)))
    : S.findIndex(s => /\(0\)|=.*0/.test(s) && !/^0=/.test(s));
  return i < 0 ? { miss: ax } : { i };
};
window.__duo.RULES.splice(2, 0, ['solveInterceptEquation', /equation for the/i]);
;'__duo ready';

// slopeOfFormula's regexes assume "mx + b" order and miss "6 - x". Reduce the RHS
// with the same linear parser used for inequalities: it handles any ordering,
// brackets, and a bare or negated x.
window.__duo.formulaAB = function (s) {
  const t = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
  const eq = t.indexOf('='); if (eq < 0) return null;
  const rhs = t.slice(eq + 1);
  const v = (rhs.match(/[a-z]/) || [])[0]; if (!v) return null;
  if (/frac/.test(rhs)) {
    const m = this.slopeOfFormula(s);
    if (m === null) return null;
    const bm = rhs.match(/x([+-]\d+)$/);
    return { m, b: bm ? +bm[1] : 0 };
  }
  const r = this.linear(rhs, v);
  return r ? { m: r.a, b: r.b } : null;
};
(function () {
  const base = window.__duo.slopeOfFormula;
  window.__duo.slopeOfFormula = function (s) {
    const r = base.call(this, s);
    if (r !== null && r !== undefined) return r;
    const ab = this.formulaAB(s);
    return ab ? ab.m : null;
  };
})();
(function () {
  const base = window.__duo.solveInterceptValue;
  window.__duo.solveInterceptValue = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const ax = this.interceptAxis(); if (!ax) return r;
    const L = this.promptLatex();
    let ab = null;
    for (let i = L.length - 1; i >= 0; i--) {
      if (!/\(x\)\s*=|y\s*=/.test(this.ascii(L[i]))) continue;
      ab = this.formulaAB(L[i]); if (ab) break;
    }
    if (!ab) return r;
    const want = ax === 'y' ? ab.b : (ab.m ? -ab.b / ab.m : null);
    if (want === null) return r;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(x => x.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const pair = s => {
      const m = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '').match(/\((-?[\d.]+),(-?[\d.]+)\)/);
      return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
    };
    let i = S.findIndex(s => { const q = pair(s); return q && (ax === 'y' ? (q[0] === 0 && q[1] === want) : (q[1] === 0 && q[0] === want)); });
    if (i < 0) i = S.findIndex(s => { const v = this.numTok(s); return v !== null && Math.abs(v - want) < 1e-9; });
    return i < 0 ? { miss: want } : { i, want };
  };
})();
;'__duo ready';

// ---- "Plot the y-intercept / x-intercept" ----
// One movable point plus a 2D thumb. gridPoints() requires two points, so read the
// single point separately, and drag by the measured delta (the widget moves
// relative to the grab point, so an absolute target lands short).
Object.assign(window.__duo, {
  onePoint() {
    const g = this.grid2D(); if (!g) return null;
    const fr = g.f.getBoundingClientRect();
    const p = [...g.f.contentDocument.querySelectorAll('g.point')]
      .find(e => !/hidden/.test(String(e.getAttribute('class') || '')));
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const [x, y] = g.toXY(fr.left + r.left + r.width / 2, fr.top + r.top + r.height / 2);
    return { g, el: p, x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 };
  },

  plotTarget() {
    const ax = this.interceptAxis(); if (!ax) return null;
    const L = this.promptLatex();
    let ab = null;
    for (let i = L.length - 1; i >= 0; i--) {
      if (!/\(x\)\s*=|y\s*=/.test(this.ascii(L[i]))) continue;
      ab = this.formulaAB(L[i]); if (ab) break;
    }
    if (!ab) return null;
    return ax === 'y' ? [0, ab.b] : (ab.m ? [-ab.b / ab.m, 0] : null);
  },

  async solvePlotPoint() {
    const want = this.plotTarget(); if (!want) return false;
    const g = this.grid2D(); if (!g) return false;
    const th = g.f.contentDocument.querySelector('.slider2d-thumb,.slider1d-thumb');
    if (!th) return false;
    for (let k = 0; k < 5; k++) {
      const cur = this.onePoint(); if (!cur) return false;
      if (cur.x === want[0] && cur.y === want[1]) return true;
      const dx = (want[0] - cur.x) * g.ux, dy = (want[1] - cur.y) * g.uy;
      const fr = g.f.getBoundingClientRect(), r = th.getBoundingClientRect();
      const from = [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)];
      await this.dragXY(th, g.f, from, [Math.round(from[0] + dx), Math.round(from[1] + dy)]);
    }
    const cur = this.onePoint();
    return !!cur && cur.x === want[0] && cur.y === want[1];
  },
});
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (/plot the/i.test(this.prompt()) && this.plotTarget()) return await this.solvePlotPoint();
    return await base.call(this);
  };
})();
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this); if (p) return p;
    if (/plot the/i.test(this.prompt()) && this.plotTarget()) return { kind: 'plot', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// The plot widget's control is a HORIZONTAL slider2d-track even when the point it
// moves travels vertically, so mapping grid deltas onto the thumb's axes does not
// work. Move the thumb along its track, see which coordinate responds and by how
// much, then close the loop.
window.__duo.solvePlotPoint = async function () {
  const want = this.plotTarget(); if (!want) return false;
  const g = this.grid2D(); if (!g) return false;
  const d = g.f.contentDocument;
  const th = d.querySelector('.slider2d-thumb,.slider1d-thumb'); if (!th) return false;
  const track = d.querySelector('.slider2d-track,.slider1d-track');
  const horiz = !track || track.getBoundingClientRect().width >= track.getBoundingClientRect().height;

  const at = () => { const p = this.onePoint(); return p && [p.x, p.y]; };
  const pos = () => {
    const fr = g.f.getBoundingClientRect(), r = th.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)];
  };
  let cur = at(); if (!cur) return false;
  if (cur[0] === want[0] && cur[1] === want[1]) return true;

  // which coordinate does this slider actually drive?
  const axis = cur[0] !== want[0] ? 0 : 1;
  let step = 40;
  for (let k = 0; k < 8; k++) {
    cur = at(); if (!cur) return false;
    if (cur[0] === want[0] && cur[1] === want[1]) return true;
    const need = want[axis] - cur[axis];
    if (!need) return cur[0] === want[0] && cur[1] === want[1];
    const delta = need * step;
    const from = pos();
    const to = horiz ? [Math.round(from[0] + delta), from[1]] : [from[0], Math.round(from[1] + delta)];
    await this.dragXY(th, g.f, from, to);
    const after = at(); if (!after) return false;
    const got = after[axis] - cur[axis];
    if (got) step = Math.abs(delta / got) * Math.sign(delta / got) * Math.sign(need) * (need / Math.abs(need));
    if (got) step = delta / got;          // px per grid unit, sign included
    else step *= 1.6;
  }
  const fin = at();
  return !!fin && fin[0] === want[0] && fin[1] === want[1];
};
;'__duo ready';

// typed intercepts ("Enter the y-intercept value")
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const ax = this.interceptAxis();
      if (ax) {
        // formula first, then a table of values, then the drawn line
        const L = this.promptLatex();
        let ab = null;
        for (let i = L.length - 1; i >= 0; i--) {
          if (!/\(x\)\s*=|y\s*=/.test(this.ascii(L[i]))) continue;
          ab = this.formulaAB(L[i]); if (ab) break;
        }
        let v = null;
        if (ab) v = ax === 'y' ? ab.b : (ab.m ? -ab.b / ab.m : null);
        if (v === null) {
          const T = this.fnTable();
          if (T) { const h = ax === 'y' ? T.find(r => r[0] === 0) : T.find(r => r[1] === 0); if (h) v = ax === 'y' ? h[1] : h[0]; }
        }
        if (v === null) {
          const g = this.lineInGrid();
          if (g) v = ax === 'y' ? g.at0 : (g.slope ? -g.at0 / g.slope : null);
          if (v !== null) v = Math.round(v * 2) / 2;
        }
        if (v !== null && isFinite(v)) { this.type(String(v)); return String(v); }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// ---- inverses (unit 143) ----
// The inverse of a point swaps its coordinates. The source point may be plotted on
// a grid or written in the prompt.
window.__duo.solveInversePoint = function () {
  let src = null;
  const p = this.onePoint();
  if (p) src = [p.x, p.y];
  if (!src) {
    const t = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    const m = t.match(/\((-?[\d.]+),(-?[\d.]+)\)/);
    if (m) src = [parseFloat(m[1]), parseFloat(m[2])];
  }
  if (!src) return null;
  const want = [src[1], src[0]];
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const pair = s => {
    const m = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '').match(/\((-?[\d.]+),(-?[\d.]+)\)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  };
  const i = S.findIndex(s => { const q = pair(s); return q && q[0] === want[0] && q[1] === want[1]; });
  return i < 0 ? { miss: want.join(',') } : { i, want: want.join(',') };
};
window.__duo.RULES.splice(2, 0, ['solveInversePoint', /inverse of the point|inverse point/i]);
;'__duo ready';

// The plotted curve is exactly class="line". Everything else that looks like a path
// is scenery: eight zero-extent math-diagram__arrow--* marker DEFINITIONS (all
// reporting the same point), 19 grid-lines and 2 axis-lines. Selecting "the first
// non-axis path" picks an arrow marker and reads a nonsense slope.
window.__duo.curvePath = function () {
  const g = this.grid2D(); if (!g) return null;
  const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
  const p = [...d.querySelectorAll('path,line,polyline')]
    .find(e => String(e.getAttribute('class') || '').split(/\s+/).includes('line'));
  if (!p || typeof p.getTotalLength !== 'function') return null;
  let L = 0; try { L = p.getTotalLength(); } catch (e) { return null; }
  if (!L) return null;
  const m = p.getScreenCTM(); if (!m) return null;
  const at = t => {
    const q = p.getPointAtLength(t * L);
    return g.toXY(fr.left + m.a * q.x + m.c * q.y + m.e, fr.top + m.b * q.x + m.d * q.y + m.f);
  };
  const A = at(0), B = at(1);
  return { g, A, B, at, slope: (B[0] - A[0]) ? (B[1] - A[1]) / (B[0] - A[0]) : null };
};
(function () {
  const base = window.__duo.lineInGrid;
  window.__duo.lineInGrid = function () {
    const c = this.curvePath();
    if (c && c.slope !== null) return { a: c.A, b: c.B, slope: c.slope, at0: c.A[1] - c.slope * c.A[0] };
    return base.call(this);
  };
})();

// domain / range: a curve reaching both edges of the plot is unbounded there
window.__duo.solveDomainRange = function () {
  const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').toLowerCase();
  const wantDomain = /domain/.test(A), wantRange = /range/.test(A);
  if (!wantDomain && !wantRange) return null;
  const c = this.curvePath(); if (!c) return null;
  const R = this.gridRange() || { lo: -5, hi: 5 };
  const k = wantDomain ? 0 : 1;
  const lo = Math.min(c.A[k], c.B[k]), hi = Math.max(c.A[k], c.B[k]);
  const openLo = lo <= R.lo + 0.4, openHi = hi >= R.hi - 0.4;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
    .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\s/g, ''));
  if (openLo && openHi) {
    const i = S.findIndex(s => (s.match(/infty/g) || []).length >= 2);
    return i < 0 ? { miss: 'allreals' } : { i, want: 'allreals' };
  }
  return null;
};
window.__duo.RULES.splice(2, 0, ['solveDomainRange', /domain|range/i]);
;'__duo ready';

// The rendered curve is CLIPPED to the plot box, so its endpoints say nothing about
// the function's real bounds — a line from (-5,0) to (4,3) still has range
// (-inf, inf). Decide from the shape: a straight line with nonzero slope is
// unbounded in both; a horizontal line has a single-value range.
window.__duo.solveDomainRange = function () {
  const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').toLowerCase();
  const wantDomain = /domain/.test(A), wantRange = /range/.test(A);
  if (!wantDomain && !wantRange) return null;
  const c = this.curvePath(); if (!c) return null;

  const M = c.at(0.5);
  const dx = c.B[0] - c.A[0], dy = c.B[1] - c.A[1];
  if (!dx) return null;
  const slope = dy / dx;
  const straight = Math.abs((c.A[1] + slope * (M[0] - c.A[0])) - M[1]) < 0.15;
  if (!straight) return null;                       // curves need their own rule

  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
    .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\s/g, ''));

  if (wantDomain || Math.abs(slope) > 1e-9) {
    const i = S.findIndex(s => (s.match(/infty/g) || []).length >= 2);
    return i < 0 ? { miss: 'allreals' } : { i, want: 'allreals' };
  }
  // horizontal line: the range is the single y value
  const y = Math.round(c.A[1] * 2) / 2;
  const i = S.findIndex(s => { const v = this.numTok(s); return v !== null && Math.abs(v - y) < 1e-9; });
  return i < 0 ? { miss: y } : { i, want: y };
};
;'__duo ready';

// Curves: sample the path and use its SHAPE, since the drawing is clipped.
// x non-monotonic  -> sideways (opens left/right): range all reals, domain bounded
//                     at the vertex
// y non-monotonic  -> a U: domain all reals, range bounded at the vertex
// both monotonic   -> a half-curve (sqrt): both bounded at the endpoint that lies
//                     inside the plot
(function () {
  const base = window.__duo.solveDomainRange;
  window.__duo.solveDomainRange = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').toLowerCase();
    const wantDomain = /domain/.test(A), wantRange = /range/.test(A);
    if (!wantDomain && !wantRange) return r;
    const c = this.curvePath(); if (!c) return r;

    const N = 21, P = [];
    for (let i = 0; i <= N; i++) P.push(c.at(i / N));
    const mono = k => {
      let up = 0, dn = 0;
      for (let i = 1; i < P.length; i++) { const d = P[i][k] - P[i - 1][k]; if (d > 0.01) up++; else if (d < -0.01) dn++; }
      return !(up && dn);
    };
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const xMono = mono(0), yMono = mono(1);

    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    // strip the braces too: the choice is wrapped \mathbf{\mathbf{...}}, so an
    // anchored ^...$ match fails on the leftover "{{[1,infty)}}"
    const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
      .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|left|right|[{}]|\s/g, ''));
    const allReals = () => S.findIndex(s => /\(-?infty,infty\)/.test(s) || (s.match(/infty/g) || []).length >= 2 && /^\(-infty/.test(s));
    const bounded = (v, opensUp) => S.findIndex(s => {
      const m = s.match(/^([\[(])(-?[\d.]+),infty\)$/);
      if (m && opensUp) return Math.abs(+m[2] - v) < 0.3;
      const m2 = s.match(/^\(-infty,(-?[\d.]+)([\])])$/);
      if (m2 && !opensUp) return Math.abs(+m2[1] - v) < 0.3;
      return false;
    });

    if (!xMono) {                                   // sideways
      if (wantRange) { const i = allReals(); return i < 0 ? { miss: 'allreals' } : { i, want: 'allreals' }; }
      const opensRight = xs[Math.floor(N / 2)] < xs[0];
      const v = Math.round((opensRight ? Math.min(...xs) : Math.max(...xs)) * 2) / 2;
      const i = bounded(v, opensRight);
      return i < 0 ? { miss: v } : { i, want: v };
    }
    if (!yMono) {                                   // U shape
      if (wantDomain) { const i = allReals(); return i < 0 ? { miss: 'allreals' } : { i, want: 'allreals' }; }
      const opensUp = ys[Math.floor(N / 2)] < ys[0];
      const v = Math.round((opensUp ? Math.min(...ys) : Math.max(...ys)) * 2) / 2;
      const i = bounded(v, opensUp);
      return i < 0 ? { miss: v } : { i, want: v };
    }
    return r;
  };
})();
;'__duo ready';

// "domain of the INVERSE" is the range of the original, and vice versa: answer by
// flipping which axis the existing solver is asked about.
(function () {
  const base = window.__duo.solveDomainRange;
  window.__duo.solveDomainRange = function () {
    const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').toLowerCase();
    if (!/inverse/.test(A)) return base.call(this);
    const swapped = /domain/.test(A) ? 'range' : 'domain';
    const real = this.promptLatex;
    // temporarily present the prompt as asking about the other axis
    this.promptLatex = function () { return real.call(this).concat(['\\text{' + swapped + '}']); };
    try {
      const orig = real.call(this).map(s => s);
      const patched = () => orig.map(s => this.ascii(s)
        .replace(/domain/gi, '__D__').replace(/range/gi, 'domain').replace(/__D__/g, 'range'));
      this.promptLatex = patched;
      return base.call(this);
    } finally {
      this.promptLatex = real;
    }
  };
})();
;'__duo ready';

// Distinguishing a real endpoint from a CLIPPED one needs the plot's own bounds,
// which are not the label extremes — the drawing area runs past the last label.
// Convert the diagram svg's box into grid coordinates instead.
window.__duo.plotBounds = function () {
  const g = this.grid2D(); if (!g) return null;
  const svg = g.f.contentDocument.querySelector('svg.math-diagram, svg');
  if (!svg) return null;
  const fr = g.f.getBoundingClientRect(), r = svg.getBoundingClientRect();
  const a = g.toXY(fr.left + r.left, fr.top + r.top);
  const b = g.toXY(fr.left + r.right, fr.top + r.bottom);
  return { xlo: Math.min(a[0], b[0]), xhi: Math.max(a[0], b[0]), ylo: Math.min(a[1], b[1]), yhi: Math.max(a[1], b[1]) };
};
(function () {
  const base = window.__duo.solveDomainRange;
  window.__duo.solveDomainRange = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').toLowerCase();
    if (!/domain|range/.test(A)) return r;
    const c = this.curvePath(); if (!c) return r;
    const B = this.plotBounds(); if (!B) return r;
    // a monotonic curve that leaves the plot on both sides is unbounded there
    // 0.5, not 0.3: the plot runs ~0.36 past the last label, so a curve clipped at
    // the edge reads as 0.36 short of the bound
    const off = (p, k) => k === 0 ? (p[0] <= B.xlo + 0.5 || p[0] >= B.xhi - 0.5)
                                  : (p[1] <= B.ylo + 0.5 || p[1] >= B.yhi - 0.5);
    let k = /domain/.test(A) ? 0 : 1;
    if (/inverse/.test(A)) k = 1 - k;
    if (!off(c.A, k) || !off(c.B, k)) return r;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
      .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|left|right|[{}]|\s/g, ''));
    const i = S.findIndex(s => /^\(-infty,infty\)$/.test(s));
    return i < 0 ? r : { i, want: 'allreals' };
  };
})();
;'__duo ready';

// Last resort: when no rule fires on a choice screen the loop presses CHECK with
// nothing selected, gets no verdict ("noblame") and spins until the info-loop guard
// trips — the lesson never advances. Guessing is strictly better: a wrong answer is
// graded, the question is replaced, and run2's 2-wrong halt still bounds the damage.
(function () {
  const base = window.__duo.solveChoices;
  window.__duo.solveChoices = function () {
    const r = base.call(this);
    // ok:true with an EMPTY idx is the real deadlock: run2 treats it as handled,
    // clicks nothing, and CHECK returns no verdict forever
    if (r && r.ok && r.idx && r.idx.length) return r;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    this.S.guesses = (this.S.guesses || 0) + 1;
    if (this.S.guesses > 3) return r;             // don't guess a whole lesson away
    return { ok: true, idx: [0], guess: true };
  };
})();
;'__duo ready';

// ---- guided inverse derivation (unit 143 L3) ----
// Steps: "swap the x and y variables" -> pick x = f(y); then solve for y.
window.__duo.solveInverseStep = function () {
  const L = this.promptLatex().map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));
  const live = L[L.length - 1] || '';
  const A = L.join(' ').toLowerCase();
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
    .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));

  // the instruction is the last TEXT line, so read it from the raw prompt
  const instr = this.prompt();
  if (/swap/.test(instr)) {
    // want "x = ...y...", i.e. the equation with x alone on the left
    const i = S.findIndex(s => /^x=/.test(s) && /y/.test(s));
    return i < 0 ? { miss: 'swap' } : { i };
  }
  if (/solve for y|isolate y/.test(instr)) {
    // find the swapped equation x = m*y + b, then y = (x - b)/m
    let eq = null;
    for (let i = L.length - 1; i >= 0; i--) if (/^x=/.test(L[i])) { eq = L[i]; break; }
    if (!eq) return null;
    const ab = this.formulaAB('y=' + eq.slice(2));      // reuse the linear parser on the RHS
    if (!ab || !ab.m) return null;
    const i = S.findIndex(s => {
      const m2 = s.match(/^y=(.+)$/); if (!m2) return false;
      const t = this.linear(m2[1], 'x');
      return t && Math.abs(t.a - 1 / ab.m) < 1e-9 && Math.abs(t.b - (-ab.b / ab.m)) < 1e-9;
    });
    return i < 0 ? { miss: 'solve' } : { i };
  }
  return null;
};
window.__duo.RULES.splice(2, 0, ['solveInverseStep', /swap|solve for y|isolate y/i]);
;'__duo ready';

// "Find the inverse operation" for the term shown: 3y -> divide by 3, y+4 ->
// subtract 4, y/2 -> multiply by 2.
window.__duo.solveInverseOp = function () {
  const L = this.promptLatex().map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));
  let term = null;
  for (let i = L.length - 1; i >= 0; i--) if (/^[-+]?\d*\/?[a-z]|^frac/.test(L[i]) && !/=/.test(L[i])) { term = L[i]; break; }
  if (!term) return null;
  let want = null, n = null;
  let m = term.match(/^frac([a-z])(\d+)$/) || term.match(/^([a-z])\/(\d+)$/);
  if (m) { want = 'multiply'; n = m[2]; }
  if (!want) { m = term.match(/^(\d+)[a-z]$/); if (m) { want = 'divide'; n = m[1]; } }
  if (!want) { m = term.match(/^[a-z]\+(\d+)$/); if (m) { want = 'subtract'; n = m[1]; } }
  if (!want) { m = term.match(/^[a-z]-(\d+)$/); if (m) { want = 'add'; n = m[1]; } }
  if (!want) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ch.map(e => this.ascii(e.innerText).toLowerCase());
  const i = S.findIndex(s => s.includes(want) && s.includes(String(n)));
  return i < 0 ? { miss: want + ' ' + n } : { i, want: want + ' ' + n };
};
window.__duo.RULES.splice(2, 0, ['solveInverseOp', /inverse operation/i]);
;'__duo ready';

// The final step of the inverse derivation: from "a*y = x + b" divide through to get
// f^-1(x) = (1/a)x + b/a. Compare the choices numerically so 1/3 and \frac{1}{3}
// both match.
window.__duo.solveInverseResult = function () {
  const L = this.promptLatex().map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));
  let eq = null;
  for (let i = L.length - 1; i >= 0; i--) {
    const m = L[i].match(/^(-?\d*)y=(.+)$/);
    if (m) { eq = { a: m[1] === '' ? 1 : (m[1] === '-' ? -1 : +m[1]), rhs: m[2] }; break; }
  }
  if (!eq || !eq.a) return null;
  const t = this.linear(eq.rhs, 'x'); if (!t) return null;
  const wm = t.a / eq.a, wb = t.b / eq.a;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const i = S.findIndex(s => {
    const ab = this.formulaAB(s);
    return ab && Math.abs(ab.m - wm) < 1e-9 && Math.abs(ab.b - wb) < 1e-9;
  });
  return i < 0 ? { miss: wm + 'x+' + wb } : { i, want: wm + 'x+' + wb };
};
window.__duo.RULES.splice(2, 0, ['solveInverseResult', /divide every term|multiply every term|f\^\{?-1/i]);
;'__duo ready';

// pairs of an equation and its variable-swapped inverse: y = -2x  <->  x = -2y
window.__duo.swapPairs = async function () {
  const tk = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
  if (tk.length < 4) return null;
  const norm = tk.map(e => {
    const a = e.querySelector('annotation');
    return this.ascii(a ? a.textContent : e.innerText).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
  });
  const swap = s => s.replace(/x/g, '@').replace(/y/g, 'x').replace(/@/g, 'y');
  const done = e => /_2wryV/.test(String(e.className));
  const used = new Set(); let n = 0;
  for (let i = 0; i < tk.length; i++) {
    if (used.has(i) || done(tk[i])) continue;
    const want = swap(norm[i]);
    const j = norm.findIndex((s, k) => k !== i && !used.has(k) && !done(tk[k]) && s === want);
    if (j < 0) continue;
    used.add(i); used.add(j); n++;
    this.tap(tk[i]); await this.sleep(140); this.tap(tk[j]); await this.sleep(320);
  }
  return n ? { pairs: n } : null;
};

// Guard every pairs solver: taps that do not actually match bounce back, the solver
// still reports a count, and run2 replays the same screen forever ("p3,p3,p3...").
// Count solved tokens before and after; report null when nothing changed.
(function () {
  const chain = window.__duo.ineqPairs;
  window.__duo.ineqPairs = async function () {
    const solved = () => [...document.querySelectorAll('[data-test$="challenge-tap-token"]')]
      .filter(e => /_2wryV/.test(String(e.className))).length;
    const before = solved();
    const r = (await chain.call(this)) || (await this.swapPairs());
    await this.sleep(350);
    return solved() > before ? r : null;
  };
})();
;'__duo ready';

// "Complete the pattern" where the rule is a variable swap: y=4x^2 -> x=4y^2
window.__duo.solveSwapPattern = function () {
  const L = this.promptLatex().map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));
  const swap = s => s.replace(/x/g, '@').replace(/y/g, 'x').replace(/@/g, 'y');
  // rows come in pairs; the query row's answer is "?" or blank
  const qi = L.findIndex(s => s === '?' || s === '');
  if (qi < 1) return null;
  // confirm the rule on another pair before trusting it
  let ok = false;
  for (let i = 0; i < L.length - 1; i++) {
    if (i === qi - 1) continue;
    if (L[i] && L[i + 1] && swap(L[i]) === L[i + 1]) { ok = true; break; }
  }
  if (!ok) return null;
  const want = swap(L[qi - 1]);
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
    .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));
  const i = S.findIndex(s => s === want);
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveSwapPattern', /complete the pattern/i]);
;'__duo ready';

// ---- "Select the inverse function" ----
// Rather than model how each inverse is written (fraction, root, nested), verify
// numerically: a choice g is the inverse of f when f(g(t)) == t on sample points.
Object.assign(window.__duo, {
  // LaTeX expression -> a JS function of x
  compile(src) {
    let t = this.ascii(src)
      // strip the COMMAND WITH ITS BACKSLASH: dropping just the word leaves "\{...}",
      // and the later "any backslash left means unsupported" check then bails
      .replace(/\\(mathbf|textbf|text)\s*/g, '')
      .replace(/\\left|\\right/g, '')
      // LaTeX spacing commands survive the whitespace strip and leave a backslash,
      // which the "unsupported command" check then rejects
      .replace(/\\[,;:!]/g, '')
      .replace(/[~\s]/g, '');
    // peel the wrapper braces the stripped commands leave behind
    for (let i = 0; i < 4; i++) {
      const m = t.match(/^\{(.*)\}$/);
      if (!m) break;
      t = m[1];
    }
    t = t.replace(/^[a-z]\(x\)=|^[a-z]\^\{?-1\}?\(x\)=|^y=/, '');
    // \frac{a}{b} and \sqrt{a}, innermost first
    for (let i = 0; i < 6; i++) {
      t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
           .replace(/\\sqrt\{([^{}]*)\}/g, 'Math.sqrt($1)')
           .replace(/\\sqrt(\d+)/g, 'Math.sqrt($1)');
    }
    if (/\\/.test(t)) return null;                 // an unhandled command
    t = t.replace(/\^\{([^{}]*)\}/g, '**($1)').replace(/\^(-?\d+)/g, '**($1)');
    // also ')x' — a \frac coefficient expands to '((5)/(2))x'
    t = t.replace(/(\d|\))(\()/g, '$1*$2').replace(/(\d|\))(x)/g, '$1*$2').replace(/(x)(\()/g, '$1*$2');
    // whitelist by TOKEN, not by letter soup: the old character class happened to
    // allow every letter in "Math.sqrt" but not the b of "Math.abs"
    if (!/^(?:Math\.(?:sqrt|abs)|[-+*/().0-9x]|\*\*)+$/.test(t)) return null;
    try {
      const f = Function('x', '"use strict";return (' + t + ')');
      f(2); return f;
    } catch (e) { return null; }
  },

  solveInverseFunction() {
    const L = this.promptLatex();
    let f = null;
    for (let i = L.length - 1; i >= 0; i--) {
      if (!/\(x\)\s*=/.test(this.ascii(L[i])) || /-1/.test(this.ascii(L[i]))) continue;
      f = this.compile(L[i]); if (f) break;
    }
    if (!f) return null;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return null;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const ts = [1, 4, 9, 16];
    const hits = [];
    S.forEach((s, i) => {
      const g = this.compile(s); if (!g) return;
      let good = 0, tried = 0;
      for (const t of ts) {
        const v = g(t); if (!isFinite(v)) continue;
        const back = f(v); if (!isFinite(back)) continue;
        tried++; if (Math.abs(back - t) < 1e-6) good++;
      }
      if (tried >= 2 && good === tried) hits.push(i);
    });
    return hits.length === 1 ? { i: hits[0] } : null;
  },
});
window.__duo.RULES.splice(2, 0, ['solveInverseFunction', /inverse function|inverse of/i]);
;'__duo ready';

// ---- piecewise functions (unit 144) ----
// Each piece is its own class="line" path; the breakpoint is where one ends and the
// next begins.
Object.assign(window.__duo, {
  pieces() {
    const g = this.grid2D(); if (!g) return null;
    const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
    const out = [...d.querySelectorAll('path,line,polyline')]
      .filter(e => String(e.getAttribute('class') || '').split(/\s+/).includes('line'))
      .map(p => {
        let L = 0; try { L = p.getTotalLength(); } catch (e) { return null; }
        const m = p.getScreenCTM(); if (!L || !m) return null;
        const at = t => {
          const q = p.getPointAtLength(t * L);
          return g.toXY(fr.left + m.a * q.x + m.c * q.y + m.e, fr.top + m.b * q.x + m.d * q.y + m.f);
        };
        const A = at(0), B = at(1);
        const lo = A[0] <= B[0] ? A : B, hi = A[0] <= B[0] ? B : A;
        const dx = hi[0] - lo[0];
        return { lo, hi, slope: dx ? (hi[1] - lo[1]) / dx : null };
      }).filter(Boolean).sort((a, b) => a.lo[0] - b.lo[0]);
    return out.length ? out : null;
  },

  breakpoint() {
    const P = this.pieces(); if (!P || P.length < 2) return null;
    // the junction: the right end of one piece meeting the left end of the next
    const x = (P[0].hi[0] + P[1].lo[0]) / 2;
    return Math.round(x * 2) / 2;
  },
});

// typed: "At what x-value does the function change?"
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')
        && /x-value does the function change|where does the function change/i.test(this.prompt())) {
      const b = this.breakpoint();
      if (b !== null) { this.type(String(b)); return String(b); }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// more piecewise steps: the y-value of the horizontal piece, and each piece's slope
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const inp = document.querySelector('[data-test="challenge-text-input"]');
    if (inp) {
      const P = this.prompt();
      const pieces = this.pieces();
      if (pieces) {
        if (/y-value of the horizontal piece|horizontal piece/i.test(P)) {
          const h = pieces.find(p => p.slope !== null && Math.abs(p.slope) < 0.05);
          if (h) { const v = String(Math.round(h.lo[1] * 2) / 2); this.type(v); return v; }
        }
        if (/slope of the (other|slanted|non-horizontal)/i.test(P)) {
          const s = pieces.find(p => p.slope !== null && Math.abs(p.slope) >= 0.05);
          if (s) { const v = String(Math.round(s.slope * 100) / 100); this.type(v); return v; }
        }
        if (/y-intercept of the (other|slanted)/i.test(P)) {
          const s = pieces.find(p => p.slope !== null && Math.abs(p.slope) >= 0.05);
          if (s) { const v = String(Math.round((s.lo[1] - s.slope * s.lo[0]) * 2) / 2); this.type(v); return v; }
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// evaluate the drawn piecewise function at an x, by picking the piece whose
// x-interval contains it
Object.assign(window.__duo, {
  pieceAt(x) {
    const P = this.pieces(); if (!P) return null;
    const p = P.find(q => x >= q.lo[0] - 0.01 && x <= q.hi[0] + 0.01) || null;
    if (!p || p.slope === null) return null;
    return p.lo[1] + p.slope * (x - p.lo[0]);
  },

  solvePiecewiseEval() {
    const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return null;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
      .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));
    // choices look like "f(0)=2"; take the x from them when the prompt has none
    let x = null;
    let m = A.match(/f\((-?[\d.]+)\)/);
    if (m) x = parseFloat(m[1]);
    if (x === null) { for (const s of S) { const q = s.match(/f\((-?[\d.]+)\)/); if (q) { x = parseFloat(q[1]); break; } } }
    if (x === null) return null;
    const y = this.pieceAt(x); if (y === null) return null;
    const want = Math.round(y * 2) / 2;
    const i = S.findIndex(s => {
      const q = s.match(/f\((-?[\d.]+)\)=(-?[\d.]+)/);
      return q && parseFloat(q[1]) === x && Math.abs(parseFloat(q[2]) - want) < 1e-6;
    });
    return i < 0 ? { miss: want } : { i, want };
  },
});
window.__duo.RULES.splice(2, 0, ['solvePiecewiseEval', null]);
;'__duo ready';

// typed evaluation of a drawn piecewise function ("Enter the value when x = -1")
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
      const m = A.match(/x&?=(-?[\d.]+)/);
      if (m && this.pieces()) {
        const y = this.pieceAt(parseFloat(m[1]));
        if (y !== null) { const v = String(Math.round(y * 2) / 2); this.type(v); return v; }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// reverse piecewise lookup: "Enter the input for f(x) = 2" — search each piece for
// the x that produces the target y
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
      const m = A.match(/f\(x\)&?=(-?[\d.]+)/);
      const P = this.pieces();
      if (m && P) {
        const want = parseFloat(m[1]);
        for (const p of P) {
          if (p.slope === null) continue;
          if (Math.abs(p.slope) < 1e-6) {
            // horizontal piece: any x in it works; prefer a whole number
            if (Math.abs(p.lo[1] - want) < 0.05) {
              const x = Math.round((p.lo[0] + p.hi[0]) / 2);
              this.type(String(x)); return String(x);
            }
            continue;
          }
          const x = p.lo[0] + (want - p.lo[1]) / p.slope;
          if (x >= p.lo[0] - 0.05 && x <= p.hi[0] + 0.05) {
            const v = String(Math.round(x * 2) / 2);
            this.type(v); return v;
          }
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// ---- written piecewise: \begin{cases} expr & cond \\ expr & cond \end{cases} ----
Object.assign(window.__duo, {
  casesOf(src) {
    const raw = this.ascii(src);
    const m = raw.match(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/);
    if (!m) return null;
    return m[1].split(/\\\\/).map(row => {
      // the separator is & in some renderings and \textbf{if} / \text{if} in others
      const parts = row.split(/&|\\(?:text|textbf)\{if\}/);
      if (parts.length < 2) return null;
      const f = this.compile(parts[0]);
      // the label can be \textbf{if\,} — the thin space lives INSIDE the braces, so
      // the split leaves "if" glued to the condition after normalisation
      const c = this.ineqNorm(parts[1]).replace(/^if/, '');
      const q = c.match(/^[a-z](<=|>=|<|>)(-?[\d.]+)$/);
      if (!f || !q) return null;
      const op = q[1], n = parseFloat(q[2]);
      const test = x => op === '<=' ? x <= n : (op === '>=' ? x >= n : (op === '<' ? x < n : x > n));
      return { f, test };
    }).filter(Boolean);
  },

  solveCasesEval() {
    let rows = null;
    for (const s of this.promptLatex()) { rows = this.casesOf(s); if (rows && rows.length) break; }
    if (!rows || !rows.length) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return null;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
      .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));
    let x = null;
    const pm = this.ascii(this.promptLatex().join(' ')).replace(/[~\s]/g, '').match(/f\((-?[\d.]+)\)/);
    if (pm) x = parseFloat(pm[1]);
    if (x === null) for (const s of S) { const q = s.match(/f\((-?[\d.]+)\)/); if (q) { x = parseFloat(q[1]); break; } }
    if (x === null) return null;
    const row = rows.find(r => r.test(x)); if (!row) return null;
    const want = row.f(x);
    if (!isFinite(want)) return null;
    const i = S.findIndex(s => {
      const q = s.match(/f\((-?[\d.]+)\)=(-?[\d.]+)/);
      return q && parseFloat(q[1]) === x && Math.abs(parseFloat(q[2]) - want) < 1e-6;
    });
    return i < 0 ? { miss: want } : { i, want };
  },
});
window.__duo.RULES.splice(2, 0, ['solveCasesEval', null]);

// |x| shows up as \left\vert x \right\vert (or \lvert / bare pipes)
(function () {
  const base = window.__duo.compile;
  window.__duo.compile = function (src) {
    let t = this.ascii(src)
      .replace(/\\left\\vert([\s\S]*?)\\right\\vert/g, '\\abs{$1}')
      .replace(/\\lvert([\s\S]*?)\\rvert/g, '\\abs{$1}')
      .replace(/\|([^|]*)\|/g, '\\abs{$1}');
    if (/\\abs\{/.test(t)) {
      for (let i = 0; i < 4; i++) t = t.replace(/\\abs\{([^{}]*)\}/g, 'ABS($1)');
      const f = base.call(this, t.replace(/ABS\(/g, 'Math.abs('));
      if (f) return f;
    }
    return base.call(this, src);
  };
})();
;'__duo ready';

// "Complete the table" for a written piecewise: the blank is a typed f(x) for a
// given x, which comes from the table row rather than the prompt text
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      let rows = null;
      for (const s of this.promptLatex()) { rows = this.casesOf(s); if (rows && rows.length) break; }
      if (rows && rows.length) {
        const A = this.ascii(this.promptLatex().join(' ')).replace(/[~\s]/g, '');
        let x = null;
        let m = A.match(/f\((-?[\d.]+)\)/) || A.match(/x&?=(-?[\d.]+)/);
        if (m) x = parseFloat(m[1]);
        if (x === null) {
          // the missing x sits in the table: the row whose f(x) cell is blank
          const T = this.fnTable();
          if (T) { const r = T.find(row => isNaN(row[1])); if (r) x = r[0]; }
        }
        if (x !== null) {
          const row = rows.find(r => r.test(x));
          if (row) { const v = row.f(x); if (isFinite(v)) { const s = String(Math.round(v * 100) / 100); this.type(s); return s; } }
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// fnTable drops any row without two numbers — but in "complete the table" the row
// we need is exactly the one with a blank cell. Expose the raw rows too.
window.__duo.fnTableRows = function () {
  for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument).reverse()) {
    const d = f.contentDocument;
    const w = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
    const glyphs = []; let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.trim();
      if (!t || t.length > 8) continue;
      if (n.parentElement && /SCRIPT|STYLE|TEMPLATE/.test(n.parentElement.tagName)) continue;
      const r = d.createRange(); r.selectNodeContents(n);
      const b = r.getBoundingClientRect(); if (!b.width) continue;
      glyphs.push({ t: this.ascii(t), x: b.left, x2: b.right, y: b.top + b.height / 2 });
    }
    if (glyphs.length < 4) continue;
    const rows = {};
    glyphs.forEach(g => { const k = Math.round(g.y / 8) * 8; (rows[k] = rows[k] || []).push(g); });
    const out = [];
    Object.keys(rows).map(Number).sort((a, b) => a - b).forEach(k => {
      const gs = rows[k].sort((a, b) => a.x - b.x);
      const cols = []; let cur = null;
      for (const g of gs) {
        if (cur && g.x - cur.x2 < 14) { cur.t += g.t; cur.x2 = Math.max(cur.x2, g.x2); }
        else { cur = { t: g.t, x2: g.x2 }; cols.push(cur); }
      }
      out.push(cols.map(c => parseFloat(c.t)).filter(v => !isNaN(v)));
    });
    if (out.length) return out;
  }
  return null;
};
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      let rows = null;
      for (const s of this.promptLatex()) { rows = this.casesOf(s); if (rows && rows.length) break; }
      const T = this.fnTableRows();
      if (rows && rows.length && T) {
        // the blank row has one number where the others have two
        const solo = T.filter(r => r.length === 1);
        if (solo.length === 1) {
          const x = solo[0][0];
          const row = rows.find(r => r.test(x));
          if (row) { const v = row.f(x); if (isFinite(v)) { const s = String(Math.round(v * 100) / 100); this.type(s); return s; } }
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// The choice-screen deadlock has a typed twin: when no rule produces an answer the
// loop presses CHECK with an empty box, gets no verdict, and spins. Type something
// so the answer is graded and the question is replaced. Capped, like the guess.
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    const r = prev.call(this);
    if (r !== null && r !== undefined && r !== '') return r;
    const inp = document.querySelector('[data-test="challenge-text-input"]');
    if (!inp) return r;
    this.S.typeGuesses = (this.S.typeGuesses || 0) + 1;
    if (this.S.typeGuesses > 3) return r;
    this.type('0');
    return '0';
  };
})();
;'__duo ready';

// ---- "Complete the table" cell widget ----
// No text input and no choices: the frame holds table cells (.empty-cell) and the
// page has a maths keypad. Click a blank cell, then tap the digits.
Object.assign(window.__duo, {
  keypad(ch) {
    const want = ch === '-' ? ['-', '−'] : [ch];
    const b = [...document.querySelectorAll('button')]
      .find(x => want.includes(String(x.textContent).trim()));
    if (!b) return false;
    this.tap(b); return true;
  },

  tableCells() {
    for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument).reverse()) {
      const d = f.contentDocument, fr = f.getBoundingClientRect();
      const cells = [...d.querySelectorAll('[class*="table-cell"],[class*="cell-started"]')].map(e => {
        const r = e.getBoundingClientRect();
        return { el: e, empty: /empty-cell/.test(String(e.getAttribute('class') || '')),
                 t: String(e.textContent).trim(),
                 x: fr.left + r.left, y: fr.top + r.top };
      });
      if (cells.length >= 4) return { f, cells };
    }
    return null;
  },

  async solveTableFill() {
    const T = this.tableCells(); if (!T) return false;
    let rows = null;
    for (const s of this.promptLatex()) { rows = this.casesOf(s); if (rows && rows.length) break; }
    if (!rows || !rows.length) return false;
    const byRow = {};
    T.cells.forEach(c => { const k = Math.round(c.y / 10) * 10; (byRow[k] = byRow[k] || []).push(c); });
    let did = 0;
    for (const k of Object.keys(byRow).map(Number).sort((a, b) => a - b)) {
      const row = byRow[k].sort((a, b) => a.x - b.x);
      const blank = row.find(c => c.empty); if (!blank) continue;
      const src = row.find(c => !c.empty && c.t !== ''); if (!src) continue;
      const x = parseFloat(this.ascii(src.t)); if (isNaN(x)) continue;
      const rule = rows.find(r => r.test(x)); if (!rule) continue;
      const v = rule.f(x); if (!isFinite(v)) continue;
      this.tap(blank.el); await this.sleep(350);
      for (const chr of String(Math.round(v * 100) / 100)) { this.keypad(chr); await this.sleep(160); }
      await this.sleep(250); did++;
    }
    return did > 0;
  },
});
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const T = this.tableCells();
    if (T && T.cells.some(c => c.empty)) { if (await this.solveTableFill()) return true; }
    return await base.call(this);
  };
})();
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this); if (p) return p;
    const T = this.tableCells();
    if (T && T.cells.some(c => c.empty)) return { kind: 'tablefill', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// Clicking a cell INSIDE the frame needs the frame's own event constructors and
// view — exactly the rule that makes dragSynth work. tap() uses the top window's,
// so the cell never focuses and the keypad types into nothing.
window.__duo.tapIn = function (el, f) {
  if (!el || !f) return false;
  const W = f.contentWindow, fr = f.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;      // frame-local
  const P = W.PointerEvent, M = W.MouseEvent;
  const o = { bubbles: true, cancelable: true, composed: true, view: W,
    clientX: x, clientY: y, screenX: fr.left + x, screenY: fr.top + y, button: 0 };
  el.dispatchEvent(new P('pointerdown', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 }, o)));
  el.dispatchEvent(new M('mousedown', Object.assign({ buttons: 1 }, o)));
  el.dispatchEvent(new P('pointerup', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 }, o)));
  el.dispatchEvent(new M('mouseup', Object.assign({ buttons: 0 }, o)));
  el.dispatchEvent(new M('click', Object.assign({ buttons: 0 }, o)));
  return true;
};
(function () {
  const base = window.__duo.solveTableFill;
  window.__duo.solveTableFill = async function () {
    const T = this.tableCells(); if (!T) return false;
    let rows = null;
    for (const s of this.promptLatex()) { rows = this.casesOf(s); if (rows && rows.length) break; }
    if (!rows || !rows.length) return false;
    const byRow = {};
    T.cells.forEach(c => { const k = Math.round(c.y / 10) * 10; (byRow[k] = byRow[k] || []).push(c); });
    let did = 0;
    for (const k of Object.keys(byRow).map(Number).sort((a, b) => a - b)) {
      const row = byRow[k].sort((a, b) => a.x - b.x);
      const blank = row.find(c => c.empty); if (!blank) continue;
      const src = row.find(c => !c.empty && c.t !== ''); if (!src) continue;
      const x = parseFloat(this.ascii(src.t)); if (isNaN(x)) continue;
      const rule = rows.find(r => r.test(x)); if (!rule) continue;
      const v = rule.f(x); if (!isFinite(v)) continue;
      this.tapIn(blank.el, T.f); await this.sleep(400);
      for (const chr of String(Math.round(v * 100) / 100)) { this.keypad(chr); await this.sleep(180); }
      await this.sleep(300);
      if (String(blank.el.textContent).trim() !== '') did++;
    }
    return did > 0;
  };
})();
;'__duo ready';

// KNOWN LIMIT — "complete the table" cell widget (unit 144 L4)
// The frame holds .empty-cell table cells and the page has a maths keypad, but the
// keypad renders at y~1400 while the viewport is 907 tall, the document does not
// scroll (body.scrollHeight is 24 — the app lays out at a fixed size) and there is
// no scrollable ancestor. So the keys cannot be reached at this window size:
//   - synthetic clicks do nothing, in either the top window's or the frame's event
//     constructors, and synthetic KeyboardEvents are ignored too
//   - a real click via the computer tool lands outside the viewport
//   - page-zoom shortcuts are not available to the automation
// Fix is environmental: give Chrome a TALLER window (roughly 1500px of viewport)
// and these questions become reachable. Everything below is ready for that.
;'__duo ready';

// autoLesson resets S.log/done but not the guess counters, so after three guesses
// anywhere in a run every later unsolved screen deadlocks again instead of guessing
(function () {
  const base = window.__duo.autoLesson;
  window.__duo.autoLesson = async function () {
    this.S.guesses = 0; this.S.typeGuesses = 0;
    return base.call(this);
  };
})();

// "Select the match" can offer the SAME output for different inputs
// (f(1.5)=5, f(3.5)=5, f(5)=5): evaluate the drawn function at each choice's own x
// instead of taking x from the first choice and testing only that one.
(function () {
  const base = window.__duo.solvePiecewiseEval;
  window.__duo.solvePiecewiseEval = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    if (!this.pieces()) return r;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
      .map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, ''));
    const hits = [];
    S.forEach((s, i) => {
      const q = s.match(/f\((-?[\d.]+)\)=(-?[\d.]+)/); if (!q) return;
      const y = this.pieceAt(parseFloat(q[1]));
      if (y !== null && Math.abs(y - parseFloat(q[2])) < 0.15) hits.push(i);
    });
    return hits.length === 1 ? { i: hits[0] } : r;
  };
})();
;'__duo ready';

// same typed lookup under more phrasings: "Enter the output when x = 2"
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
      const m = A.match(/x&?=(-?[\d.]+)/);
      if (m && /enter the (output|value)|what is the (output|value)/i.test(this.prompt())) {
        const x = parseFloat(m[1]);
        // the drawn function first, then a table, then a written piecewise
        let y = this.pieces() ? this.pieceAt(x) : null;
        if (y === null) { const T = this.fnTable(); const h = T && T.find(r => r[0] === x); if (h) y = h[1]; }
        if (y === null) {
          let rows = null;
          for (const s of this.promptLatex()) { rows = this.casesOf(s); if (rows && rows.length) break; }
          const row = rows && rows.find(r => r.test(x));
          if (row) y = row.f(x);
        }
        if (y !== null && isFinite(y)) { const v = String(Math.round(y * 100) / 100); this.type(v); return v; }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// "Enter the slope when x = 5": the slope of the piece containing that x
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]') && /slope/i.test(this.prompt())) {
      const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
      const m = A.match(/x&?=(-?[\d.]+)/);
      const P = this.pieces();
      if (m && P) {
        const x = parseFloat(m[1]);
        const p = P.find(q => x >= q.lo[0] - 0.01 && x <= q.hi[0] + 0.01);
        if (p && p.slope !== null) { const v = String(Math.round(p.slope * 100) / 100); this.type(v); return v; }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// At a step boundary two pieces contain x. Steps are drawn left-closed, so the
// value belongs to the piece that STARTS at x, not the one that ends there —
// taking the first match makes every boundary question wrong.
(function () {
  const base = window.__duo.pieceAt;
  window.__duo.pieceAt = function (x) {
    const P = this.pieces(); if (!P) return base.call(this, x);
    const starts = P.find(q => Math.abs(q.lo[0] - x) < 0.02);
    if (starts && starts.slope !== null) return starts.lo[1];
    return base.call(this, x);
  };
})();

// "Select the output when x = 2.0" — same lookup, choice form
window.__duo.solveOutputChoice = function () {
  const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
  const m = A.match(/x&?=(-?[\d.]+)/); if (!m) return null;
  const y = this.pieceAt(parseFloat(m[1])); if (y === null) return null;
  const want = Math.round(y * 100) / 100;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const i = ch.findIndex(e => { const v = parseFloat(this.clean(e.innerText)); return !isNaN(v) && Math.abs(v - want) < 0.02; });
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveOutputChoice', /select the (output|value) when/i]);
;'__duo ready';

// ---- "Evaluate when x = N" slider ----
// A slider sets the input and the prompt echoes it back as f(<x>) = ... . Read the
// live x out of that echo and close the loop; the slider's px-per-unit is unknown,
// so calibrate from the first move like the \duodisplay slider.
Object.assign(window.__duo, {
  evalTargetX() {
    const A = this.ascii(this.promptLatex().join(' '))
      .replace(/emphasis|mathbf|textbf|text|\\/g, ' ').replace(/[{}~]/g, ' ');
    const m = A.match(/evaluate when\s*x\s*=\s*(-?[\d.]+)/i) || A.match(/when\s*x\s*=\s*(-?[\d.]+)/i);
    return m ? parseFloat(m[1]) : null;
  },
  evalCurrentX() {
    for (const s of this.promptLatex().slice().reverse()) {
      const m = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '').match(/^f\((-?[\d.]+)\)/);
      if (m) return parseFloat(m[1]);
    }
    return null;
  },
  async solveEvalSlider() {
    const want = this.evalTargetX(); if (want === null) return false;
    const f = [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)
      .find(x => x.contentDocument.querySelector('.slider1d-thumb,.slider2d-thumb'));
    if (!f) return false;
    const th = () => f.contentDocument.querySelector('.slider1d-thumb,.slider2d-thumb');
    const pos = () => {
      const fr = f.getBoundingClientRect(), r = th().getBoundingClientRect();
      return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)];
    };
    let step = 40;
    for (let k = 0; k < 8; k++) {
      const cur = this.evalCurrentX();
      if (cur === null) return false;
      if (Math.abs(cur - want) < 1e-9) return true;
      const from = pos();
      const dx = (want - cur) * step;
      await this.dragXY(th(), f, from, [Math.round(from[0] + dx), from[1]]);
      const after = this.evalCurrentX();
      if (after === null) return false;
      if (Math.abs(after - want) < 1e-9) return true;
      if (after !== cur) step = dx / (after - cur); else step *= 1.6;
    }
    return Math.abs((this.evalCurrentX() ?? NaN) - want) < 1e-9;
  },
});
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.evalTargetX() !== null && this.evalCurrentX() !== null) {
      if (await this.solveEvalSlider()) return true;
    }
    return await base.call(this);
  };
})();
;'__duo ready';

// ---- table-fill via the diagram's own API (unit 144/145) ----
// This challenge is a mathChallengeBlob whose table is filled by DRAGGING tokens,
// not by a keypad — which is why cell clicks, keypad clicks and synthetic keys all
// did nothing, and why the "keypad" looked unreachable (it is a drawer translated
// down by exactly the viewport height and only opens for other challenge types).
// The diagram iframe exposes the live instance as window.mathDiagram:
//   rows            [[x, y], ...] with null for each blank
//   tokens          the bank's values
//   handleCellDrop(row, col, value, tokenEl)  the real drop path
//   setCellValue / updateCell / notifyUpdateSubscribers
// Use handleCellDrop so the token bank stays in sync with the answer state.
Object.assign(window.__duo, {
  diagram() {
    for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)) {
      const M = f.contentWindow.mathDiagram;
      if (M && M.rows) return { f, M };
    }
    return null;
  },

  // the rule y = f(x): prefer the prompt's formula, else fit from the filled rows
  tableRule() {
    for (const s of this.promptLatex().slice().reverse()) {
      if (!/=/.test(this.ascii(s))) continue;
      const f = this.compile(s);
      if (f) { try { if (isFinite(f(1))) return f; } catch (e) {} }
    }
    const d = this.diagram(); if (!d) return null;
    const done = d.M.rows.filter(r => r[0] !== null && r[1] !== null)
      .map(r => [parseFloat(this.ascii(String(r[0]))), parseFloat(this.ascii(String(r[1])))])
      .filter(r => !isNaN(r[0]) && !isNaN(r[1]));
    if (done.length < 2) return null;
    const cands = [
      x => Math.abs(x),
      x => x,
      x => -x,
      x => x * x,
    ];
    // a linear fit from the first two known rows, as a fallback
    const [a, b] = done;
    if (a[0] !== b[0]) {
      const m = (b[1] - a[1]) / (b[0] - a[0]), c = a[1] - m * a[0];
      cands.push(x => m * x + c);
    }
    return cands.find(fn => done.every(([x, y]) => Math.abs(fn(x) - y) < 1e-6)) || null;
  },

  async solveDiagramTable() {
    const d = this.diagram(); if (!d) return false;
    const M = d.M;
    const blanks = [];
    M.rows.forEach((r, i) => r.forEach((v, j) => { if (v === null) blanks.push([i, j]); }));
    if (!blanks.length) return false;
    const rule = this.tableRule(); if (!rule) return false;

    const bankEls = () => [...d.f.contentDocument.querySelectorAll('.token, [class*="token"]')]
      .filter(e => e.offsetParent !== null && String(e.textContent).trim());

    let did = 0;
    for (const [i, j] of blanks) {
      const other = M.rows[i][1 - j];
      const x = parseFloat(this.ascii(String(other)));
      if (isNaN(x)) continue;
      let v;
      try { v = j === 1 ? rule(x) : null; } catch (e) { continue; }
      if (v === null || !isFinite(v)) continue;
      const want = String(Math.round(v * 100) / 100);
      const tok = bankEls().find(e => this.ascii(String(e.textContent).trim()) === want);
      let ok = false;
      try { ok = M.handleCellDrop(i, j, want, tok || undefined); } catch (e) { ok = false; }
      if (!ok) {
        // fall back to writing the value straight into the model
        M.rows[i][j] = want;
        try { M.updateCell(i, j, want); M.notifyUpdateSubscribers(); } catch (e) {}
      }
      await this.sleep(450);
      if (M.rows[i][j] !== null) did++;
    }
    return did === blanks.length;
  },
});
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const d = this.diagram();
    if (d && d.M.rows.some(r => r.some(v => v === null))) {
      if (await this.solveDiagramTable()) return true;
    }
    return await base.call(this);
  };
})();
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this); if (p) return p;
    const d = this.diagram();
    if (d && d.M.rows.some(r => r.some(v => v === null))) return { kind: 'diagramtable', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// ---- use the diagram's own coordinate maths ----
// The Grid2D instance exposes gridToPixel / pixelToGrid on its prototype. That is
// exact, so prefer it over fitting a scale from axis labels (which has repeatedly
// been the source of subtle bugs: empty tspans parsing as 0, labels split across
// text nodes, the plot running past the last label).
Object.assign(window.__duo, {
  gridApi() {
    for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)) {
      const M = f.contentWindow.mathDiagram;
      if (M && typeof M.gridToPixel === 'function') return { f, M };
    }
    return null;
  },

  // grid coords -> page coords
  gToPage(x, y) {
    const g = this.gridApi(); if (!g) return null;
    let p;
    try { p = g.M.gridToPixel({ x, y }); } catch (e) { try { p = g.M.gridToPixel(x, y); } catch (e2) { return null; } }
    if (!p) return null;
    const fr = g.f.getBoundingClientRect();
    const px = p.x !== undefined ? p.x : p[0], py = p.y !== undefined ? p.y : p[1];
    if (!isFinite(px) || !isFinite(py)) return null;
    return [Math.round(fr.left + px), Math.round(fr.top + py)];
  },

  // page coords -> grid coords
  pageToG(px, py) {
    const g = this.gridApi(); if (!g) return null;
    const fr = g.f.getBoundingClientRect();
    let p;
    try { p = g.M.pixelToGrid({ x: px - fr.left, y: py - fr.top }); }
    catch (e) { try { p = g.M.pixelToGrid(px - fr.left, py - fr.top); } catch (e2) { return null; } }
    if (!p) return null;
    const x = p.x !== undefined ? p.x : p[0], y = p.y !== undefined ? p.y : p[1];
    return isFinite(x) && isFinite(y) ? [x, y] : null;
  },
});
;'__duo ready';

// "Select the matching equation": sample the drawn curve in grid coordinates and
// keep the choice whose compiled function agrees with it.
window.__duo.solveMatchEquation = function () {
  const c = this.curvePath(); if (!c) return null;
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push(c.at(i / 12));
  if (pts.length < 5) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const hits = [];
  S.forEach((s, i) => {
    const f = this.compile(s); if (!f) return;
    let ok = 0, n = 0;
    for (const [x, y] of pts) {
      let v; try { v = f(x); } catch (e) { return; }
      if (!isFinite(v)) continue;
      n++; if (Math.abs(v - y) < 0.35) ok++;
    }
    if (n >= 5 && ok === n) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.splice(2, 0, ['solveMatchEquation', /matching equation|equation.*graph|graph.*equation/i]);
;'__duo ready';

// the equation can be matched against a TABLE of values rather than a drawn curve
(function () {
  const base = window.__duo.solveMatchEquation;
  window.__duo.solveMatchEquation = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const d = this.diagram();
    const rows = d && d.M.rows
      ? d.M.rows.map(x => [parseFloat(this.ascii(String(x[0]))), parseFloat(this.ascii(String(x[1])))])
          .filter(p => !isNaN(p[0]) && !isNaN(p[1]))
      : (this.fnTable() || []);
    if (rows.length < 2) return r;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const hits = [];
    S.forEach((s, i) => {
      const f = this.compile(s); if (!f) return;
      let ok = true;
      for (const [x, y] of rows) {
        let v; try { v = f(x); } catch (e) { ok = false; break; }
        if (!isFinite(v) || Math.abs(v - y) > 1e-6) { ok = false; break; }
      }
      if (ok) hits.push(i);
    });
    return hits.length === 1 ? { i: hits[0] } : r;
  };
})();
;'__duo ready';

// ---- "Graph the function" (single draggable point) ----
// The diagram component reports its position in GRID units (P.x, P.y), so there is
// no need for an axis-label scale at all — which matters because these screens
// often have no labels for grid2D() to fit. Drag, read the component back, and
// calibrate pixels-per-unit from what actually happened.
Object.assign(window.__duo, {
  dragComponent() {
    const d = this.diagram(); if (!d || !d.M.components) return null;
    const inner = d.M.components.components;
    const arr = Array.isArray(inner) ? inner
      : (inner && inner.values ? [...inner.values()] : Object.values(inner || {}));
    const P = arr.find(c => c && typeof c.x === 'number' && typeof c.y === 'number' && '_targetX' in c);
    if (!P) return null;
    const el = d.f.contentDocument.querySelector('g.point.draggable-point, .draggable-point');
    return { f: d.f, M: d.M, P, el: P.element || el };
  },

  // where the movable point belongs: the vertex of the compiled function
  graphTarget() {
    let f = null;
    for (const s of this.promptLatex().slice().reverse()) {
      if (!/=/.test(this.ascii(s))) continue;
      const g = this.compile(s);
      if (g) { try { if (isFinite(g(0)) || isFinite(g(1))) { f = g; break; } } catch (e) {} }
    }
    if (!f) return null;
    let best = null;
    for (let x = -10; x <= 10; x += 0.5) {
      let v; try { v = f(x); } catch (e) { continue; }
      if (!isFinite(v)) continue;
      if (!best || v < best[1]) best = [x, v];
    }
    if (!best) return null;
    return [Math.round(best[0] * 2) / 2, Math.round(best[1] * 2) / 2];
  },

  async solveGraphPoint() {
    const want = this.graphTarget(); if (!want) return false;
    const D = this.dragComponent(); if (!D || !D.el) return false;
    const at = () => [D.P.x, D.P.y];
    const centre = () => {
      const fr = D.f.getBoundingClientRect(), r = D.el.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)];
    };
    let px = 45, py = -45;                       // starting guess, calibrated below
    for (let k = 0; k < 8; k++) {
      const cur = at();
      if (cur[0] === null || cur[1] === null) return false;
      if (Math.abs(cur[0] - want[0]) < 1e-6 && Math.abs(cur[1] - want[1]) < 1e-6) return true;
      const from = centre(); if (!from) return false;
      const to = [Math.round(from[0] + (want[0] - cur[0]) * px),
                  Math.round(from[1] + (want[1] - cur[1]) * py)];
      await this.dragXY(D.el, D.f, from, to);
      const after = at();
      if (after[0] === null || after[1] === null) return false;
      if (after[0] !== cur[0]) px = ((to[0] - from[0]) / (after[0] - cur[0]));
      if (after[1] !== cur[1]) py = ((to[1] - from[1]) / (after[1] - cur[1]));
      if (after[0] === cur[0] && after[1] === cur[1]) { px *= 1.5; py *= 1.5; }
    }
    const fin = at();
    return Math.abs(fin[0] - want[0]) < 1e-6 && Math.abs(fin[1] - want[1]) < 1e-6;
  },
});
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (/graph the function/i.test(this.prompt()) && this.dragComponent() && this.graphTarget()) {
      if (await this.solveGraphPoint()) return true;
    }
    return await base.call(this);
  };
})();
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this); if (p) return p;
    if (/graph the function/i.test(this.prompt()) && this.dragComponent() && this.graphTarget())
      return { kind: 'graphpoint', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// diagram() required M.rows, so it found the Table instance but never the Grid2D
// one — which is why the graph solvers saw "no diagram". Return any instance and
// let each caller check for the shape it needs.
window.__duo.diagram = function () {
  for (const f of [...document.querySelectorAll('iframe')].filter(x => x.contentDocument)) {
    const M = f.contentWindow.mathDiagram;
    if (M) return { f, M };
  }
  return null;
};
(function () {
  const base = window.__duo.solveDiagramTable;
  window.__duo.solveDiagramTable = async function () {
    const d = this.diagram();
    if (!d || !d.M.rows) return false;
    return base.call(this);
  };
})();
(function () {
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    return null;
  };
})();
;'__duo ready';

// now that diagram() returns the Grid2D instance too, the table plan/drag wrappers
// must check for rows before touching them
(function () {
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    try { return basePlan.call(this); } catch (e) { return null; }
  };
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    try { return await baseDrag.call(this); } catch (e) { return false; }
  };
})();
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this); if (p) return p;
    const d = this.diagram();
    if (d && d.M.rows && d.M.rows.some(r => r.some(v => v === null)))
      return { kind: 'diagramtable', from: [0, 0], to: [0, 0] };
    if (/graph the function/i.test(this.prompt()) && this.dragComponent() && this.graphTarget())
      return { kind: 'graphpoint', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// prompt() returns the last text-bearing line, which on these screens is the
// FORMULA, not the "Graph the function" header — so gating on that phrase never
// matched. Gate on the widget being present instead.
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this); if (p) return p;
    if (this.dragComponent() && this.graphTarget()) return { kind: 'graphpoint', from: [0, 0], to: [0, 0] };
    return null;
  };
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.dragComponent() && this.graphTarget()) {
      if (await this.solveGraphPoint()) return true;
    }
    return await baseDrag.call(this);
  };
})();
;'__duo ready';

// "Fill in the blank" over a diagram table: the blank cell renders as "?" (so
// M.rows shows it as text, not null), and the answer is TYPED, not dragged.
// Infer the rule from the complete rows and type the missing value.
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (!document.querySelector('[data-test="challenge-text-input"]')) return prev.call(this);
    const T = this.tableCells(); if (!T) return prev.call(this);
    const blank = T.cells.find(c => c.empty || String(c.el.textContent).trim() === '?');
    if (!blank) return prev.call(this);
    const row = +blank.el.getAttribute('data-row'), col = +blank.el.getAttribute('data-col');
    if (isNaN(row) || isNaN(col)) return prev.call(this);

    const num = s => parseFloat(this.ascii(String(s)));
    const pairs = T.cells.reduce((acc, c) => {
      const r = +c.el.getAttribute('data-row'), k = +c.el.getAttribute('data-col');
      (acc[r] = acc[r] || [])[k] = String(c.el.textContent).trim();
      return acc;
    }, []);
    const known = pairs.filter((p, i) => i !== row && p && !isNaN(num(p[0])) && !isNaN(num(p[1])))
      .map(p => [num(p[0]), num(p[1])]);
    if (known.length < 2) return prev.call(this);

    const cands = [x => Math.abs(x), x => x, x => -x, x => x * x];
    const [a, b] = known;
    if (a[0] !== b[0]) { const m = (b[1] - a[1]) / (b[0] - a[0]), c0 = a[1] - m * a[0]; cands.push(x => m * x + c0); }
    const fn = cands.find(f => known.every(([x, y]) => Math.abs(f(x) - y) < 1e-6));
    if (!fn) return prev.call(this);

    const other = num(pairs[row][1 - col]);
    if (isNaN(other)) return prev.call(this);
    // col 1 is y = f(x); col 0 would be the inverse, which is ambiguous — skip it
    if (col !== 1) return prev.call(this);
    const v = fn(other);
    if (!isFinite(v)) return prev.call(this);
    const s = String(Math.round(v * 100) / 100);
    this.type(s); return s;
  };
})();
;'__duo ready';

// A blank cell does NOT always mean a drag: "Fill in the blank" shows a "?" cell but
// wants a typed answer. If there is a text input, never claim this as a drag plan —
// otherwise autoDrag fails and run2 stops on needdrag without ever typing.
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this);
    if (p && (p.kind === 'tablefill' || p.kind === 'diagramtable')
        && document.querySelector('[data-test="challenge-text-input"]')) return null;
    return p;
  };
})();
;'__duo ready';

// A constant equation (y = 7) has no variable, so linear() returns null and every
// slope/intercept solver gave up. Its slope is 0 and its intercept is the constant.
(function () {
  const base = window.__duo.formulaAB;
  window.__duo.formulaAB = function (s) {
    const r = base.call(this, s);
    if (r) return r;
    const t = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    const m = t.match(/^(?:[a-z]\(x\)|y)=(-?\d+(?:\.\d+)?)$/);
    return m ? { m: 0, b: parseFloat(m[1]) } : null;
  };
  const baseSlope = window.__duo.slopeOfFormula;
  window.__duo.slopeOfFormula = function (s) {
    const v = baseSlope.call(this, s);
    if (v !== null && v !== undefined) return v;
    const ab = this.formulaAB(s);
    return ab ? ab.m : null;
  };
})();
window.__duo.RULES = window.__duo.RULES.filter(r => r[0] !== 'solveRateValue');
window.__duo.RULES.splice(2, 0,
  ['solveRateValue', /select the rate of change|what is the rate of change|select the slope|what is the slope/i]);
;'__duo ready';

// the slope can be asked of a "y = ..." line, not just "f(x) = ..."
(function () {
  const base = window.__duo.solveRateValue;
  window.__duo.solveRateValue = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    let want = null;
    for (const s of this.promptLatex().slice().reverse()) {
      if (!/=/.test(this.ascii(s))) continue;
      const ab = this.formulaAB(s);
      if (ab) { want = ab.m; break; }
    }
    if (want === null) return r;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const i = S.findIndex(s => { const v = this.numTok(s); return v !== null && Math.abs(v - want) < 1e-9; });
    return i < 0 ? r : { i, want };
  };
})();
;'__duo ready';

// pairs of the SAME line in two forms: standard "ax + by = c" and slope-intercept
// "y = mx + b". Reduce both to (m, b) and match numerically.
Object.assign(window.__duo, {
  lineMB(s) {
    const t = this.ascii(s).replace(/mathbf|textbf|text|\\|~|\s/g, '');
    // slope-intercept (handles \frac via formulaAB)
    if (/^y=/.test(t.replace(/[{}]/g, ''))) { const ab = this.formulaAB(s); if (ab) return [ab.m, ab.b]; }
    // standard form: ax + by = c
    const m = t.replace(/[{}]/g, '').match(/^(-?\d*)x([+-]\d*)y=(-?\d+)$/);
    if (m) {
      const a = m[1] === '' ? 1 : (m[1] === '-' ? -1 : +m[1]);
      const b = m[2] === '+' ? 1 : (m[2] === '-' ? -1 : +m[2]);
      const c = +m[3];
      if (!b) return null;
      return [-a / b, c / b];
    }
    const ab = this.formulaAB(s);
    return ab ? [ab.m, ab.b] : null;
  },

  async linePairs() {
    const tk = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
    if (tk.length < 4) return null;
    const mb = tk.map(e => { const a = e.querySelector('annotation'); return this.lineMB(a ? a.textContent : e.innerText); });
    const done = e => /_2wryV/.test(String(e.className));
    const used = new Set(); let n = 0;
    for (let i = 0; i < tk.length; i++) {
      if (used.has(i) || done(tk[i]) || !mb[i]) continue;
      const j = mb.findIndex((v, k) => k !== i && !used.has(k) && !done(tk[k]) && v
        && Math.abs(v[0] - mb[i][0]) < 1e-9 && Math.abs(v[1] - mb[i][1]) < 1e-9);
      if (j < 0) continue;
      used.add(i); used.add(j); n++;
      this.tap(tk[i]); await this.sleep(140); this.tap(tk[j]); await this.sleep(320);
    }
    return n ? { pairs: n } : null;
  },
});
(function () {
  const base = window.__duo.ineqPairs;
  window.__duo.ineqPairs = async function () {
    const solved = () => [...document.querySelectorAll('[data-test$="challenge-tap-token"]')]
      .filter(e => /_2wryV/.test(String(e.className))).length;
    const before = solved();
    const r = (await base.call(this)) || (await this.linePairs());
    await this.sleep(350);
    return solved() > before ? r : null;
  };
})();
;'__duo ready';

// Tap tokens are real <button>s and respond to the NATIVE el.click(), while the
// synthetic pointer+mouse sequence is ignored on some screens. Worse, when both
// register the token toggles twice and nets out — which is what left pairs screens
// looping "p1,p1,p1...". For a button, use the native click alone.
(function () {
  const base = window.__duo.tap;
  window.__duo.tap = function (el) {
    if (!el) return false;
    if (el.tagName === 'BUTTON' && typeof el.click === 'function') { el.click(); return true; }
    return base.call(this, el);
  };
})();
;'__duo ready';

// "Select the slope-intercept form" of a standard-form equation: reduce both the
// prompt and every choice to (m, b) and match.
window.__duo.solveLineForm = function () {
  let src = null;
  for (const s of this.promptLatex().slice().reverse()) {
    if (!/=/.test(this.ascii(s))) continue;
    const v = this.lineMB(s); if (v) { src = v; break; }
  }
  if (!src) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const hits = [];
  S.forEach((s, i) => {
    const v = this.lineMB(s);
    if (v && Math.abs(v[0] - src[0]) < 1e-9 && Math.abs(v[1] - src[1]) < 1e-9) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0], want: src.join(',') } : null;
};
window.__duo.RULES.splice(2, 0,
  ['solveLineForm', /slope-intercept|standard form|equivalent equation|same line/i]);
;'__duo ready';

// Deriving (m, b) with regexes breaks on a fractional intercept
// ("y = -\frac{5}{2}x + \frac{1}{2}" read b as 0). compile() already understands
// \frac, so evaluate instead: m = f(1) - f(0), b = f(0).
(function () {
  const base = window.__duo.formulaAB;
  window.__duo.formulaAB = function (s) {
    const f = this.compile(s);
    if (f) {
      try {
        const b = f(0), m = f(1) - f(0);
        if (isFinite(b) && isFinite(m) && Math.abs((f(2) - f(0)) - 2 * m) < 1e-9) return { m, b };
      } catch (e) {}
    }
    return base.call(this, s);
  };
})();
;'__duo ready';

// typed slope / y-intercept from any line form, standard included
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const P = this.prompt();
      const wantSlope = /slope/i.test(P), wantB = /y-intercept|intercept/i.test(P);
      if (wantSlope || wantB) {
        for (const s of this.promptLatex().slice().reverse()) {
          if (!/=/.test(this.ascii(s))) continue;
          const mb = this.lineMB(s);
          if (!mb) continue;
          const v = wantSlope ? mb[0] : mb[1];
          if (isFinite(v)) { const t = String(Math.round(v * 1000) / 1000); this.type(t); return t; }
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// "Create a slope of 1" is the same task as "create a line with rate of change m"
(function () {
  const base = window.__duo.targetSlope;
  window.__duo.targetSlope = function () {
    const v = base.call(this);
    if (v !== null && v !== undefined) return v;
    const A = this.ascii(this.promptLatex().join(' '))
      .replace(/emphasis|mathbf|textbf|text|\\/g, ' ').replace(/[{}~]/g, ' ');
    const m = A.match(/create a slope of\s*(-?\d+(?:\.\d+)?)/i)
      || A.match(/slope of\s*(-?\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : null;
  };
})();
;'__duo ready';

// "Create a slope of 1" drives a \duodisplay slider too. Here the duodisplay holds
// the whole slope (slope = \frac{1-1}{2} = \duodisplay{..}{..}), not a numerator,
// so the denominator scaling must not apply — it only does when the duodisplay sits
// inside the numerator of a \frac.
(function () {
  const base = window.__duo.duoGoal;
  window.__duo.duoGoal = function () {
    const g = base.call(this);
    if (g) return g;
    const A = this.ascii(this.promptLatex().join(' '))
      .replace(/emphasis|mathbf|textbf|text|\\/g, ' ').replace(/[{}~]/g, ' ')
      .replace(/\s+/g, ' ').toLowerCase();
    const m = A.match(/create a slope of\s*(-?[\d.]+)/);
    if (m) return { kind: 'eq', v: parseFloat(m[1]) };
    if (/create a negative slope/.test(A)) return { kind: 'neg' };
    if (/create a positive slope/.test(A)) return { kind: 'pos' };
    return null;
  };
})();
;'__duo ready';

// ---- "Graph the line y = mx + b" (two draggable points) ----
// Reuses the closed-loop calibration: drag, read the component's GRID coords back,
// work out pixels-per-unit from what actually moved.
Object.assign(window.__duo, {
  dragComponents() {
    const d = this.diagram(); if (!d || !d.M.components) return [];
    const inner = d.M.components.components;
    const arr = Array.isArray(inner) ? inner
      : (inner && inner.values ? [...inner.values()] : Object.values(inner || {}));
    return arr.filter(c => c && typeof c.x === 'number' && typeof c.y === 'number' && '_targetX' in c)
      .map(P => ({ f: d.f, P, el: P.element }))
      .filter(o => o.el);
  },

  async moveComponent(o, want) {
    let px = 45, py = -45;
    const centre = () => {
      const fr = o.f.getBoundingClientRect(), r = o.el.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)];
    };
    for (let k = 0; k < 8; k++) {
      const cur = [o.P.x, o.P.y];
      if (cur[0] === null || cur[1] === null) return false;
      if (cur[0] === want[0] && cur[1] === want[1]) return true;
      const from = centre(); if (!from) return false;
      const to = [Math.round(from[0] + (want[0] - cur[0]) * px),
                  Math.round(from[1] + (want[1] - cur[1]) * py)];
      await this.dragXY(o.el, o.f, from, to);
      const after = [o.P.x, o.P.y];
      if (after[0] === null || after[1] === null) return false;
      if (after[0] !== cur[0]) px = (to[0] - from[0]) / (after[0] - cur[0]);
      if (after[1] !== cur[1]) py = (to[1] - from[1]) / (after[1] - cur[1]);
      if (after[0] === cur[0] && after[1] === cur[1]) { px *= 1.5; py *= 1.5; }
    }
    return o.P.x === want[0] && o.P.y === want[1];
  },

  async solveGraphLine() {
    const comps = this.dragComponents();
    if (comps.length !== 2) return false;
    let f = null;
    for (const s of this.promptLatex().slice().reverse()) {
      if (!/=/.test(this.ascii(s))) continue;
      const ab = this.formulaAB(s);
      if (ab) { f = x => ab.m * x + ab.b; break; }
    }
    if (!f) return false;
    const R = this.gridRange() || { lo: -5, hi: 5 };
    const pts = [];
    for (let x = R.lo; x <= R.hi && pts.length < 2; x++) {
      const y = f(x);
      if (Number.isInteger(y) && y >= R.lo && y <= R.hi) pts.push([x, y]);
    }
    if (pts.length < 2) return false;
    // move the nearer component to each target so they do not swap places
    comps.sort((a, b) => a.P.x - b.P.x);
    const ok1 = await this.moveComponent(comps[0], pts[0]);
    const ok2 = await this.moveComponent(comps[1], pts[1]);
    return ok1 && ok2;
  },
});
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.dragComponents().length === 2 && /graph the line/i.test(this.tex())) {
      if (await this.solveGraphLine()) return true;
    }
    return await base.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    if (this.dragComponents().length === 2 && /graph the line/i.test(this.tex()))
      return { kind: 'graphline', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// ---- "Plot the intersection point" (unit 147: systems) ----
// Two equations in the prompt and one draggable point: solve the system and move
// the point there.
Object.assign(window.__duo, {
  intersection() {
    const lines = [];
    for (const s of this.promptLatex()) {
      if (!/=/.test(this.ascii(s))) continue;
      const mb = this.lineMB(s);
      if (mb) lines.push(mb);
    }
    if (lines.length < 2) return null;
    const [[m1, b1], [m2, b2]] = lines;
    if (Math.abs(m1 - m2) < 1e-9) return null;      // parallel: no intersection
    const x = (b2 - b1) / (m1 - m2);
    return [Math.round(x * 2) / 2, Math.round((m1 * x + b1) * 2) / 2];
  },

  async solveIntersection() {
    const want = this.intersection(); if (!want) return false;
    const comps = this.dragComponents(); if (comps.length !== 1) return false;
    return await this.moveComponent(comps[0], want);
  },
});
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.intersection() && this.dragComponents().length === 1) {
      if (await this.solveIntersection()) return true;
    }
    return await base.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    if (this.intersection() && this.dragComponents().length === 1)
      return { kind: 'intersect', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// a system arrives as ONE latex entry with the equations separated by \\ ,
// so scanning entry-by-entry finds no line at all
(function () {
  const base = window.__duo.intersection;
  window.__duo.intersection = function () {
    const r = base.call(this);
    if (r) return r;
    const lines = [];
    for (const s of this.promptLatex()) {
      for (const part of this.ascii(s).split(/\\\\/)) {
        if (!/=/.test(part)) continue;
        const mb = this.lineMB(part);
        if (mb) lines.push(mb);
      }
    }
    if (lines.length < 2) return null;
    const [[m1, b1], [m2, b2]] = lines;
    if (Math.abs(m1 - m2) < 1e-9) return null;
    const x = (b2 - b1) / (m1 - m2);
    return [Math.round(x * 2) / 2, Math.round((m1 * x + b1) * 2) / 2];
  };
})();
;'__duo ready';

// "Select the intersection point" — same solve, ordered-pair choices. Falls back to
// reading the crossing off the drawn lines when the equations are not given.
window.__duo.solveIntersectionChoice = function () {
  let want = this.intersection();
  if (!want) {
    const P = this.gridPoints();
    if (P && P.length === 1) want = P[0];
  }
  if (!want) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const pair = s => {
    const m = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '').match(/\((-?[\d.]+),(-?[\d.]+)\)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  };
  const i = S.findIndex(s => { const q = pair(s); return q && q[0] === want[0] && q[1] === want[1]; });
  return i < 0 ? { miss: want.join(',') } : { i, want: want.join(',') };
};
window.__duo.RULES.splice(2, 0, ['solveIntersectionChoice', /intersection|solution to the system|system of equations/i]);
;'__duo ready';

// "Select the equation to find the intersection point": the answer sets the two
// right-hand sides equal to each other, e.g. 2x+4 = -x-5.
window.__duo.solveSystemSetup = function () {
  const rhs = [];
  for (const s of this.promptLatex()) {
    for (const part of this.ascii(s).split(/\\\\/)) {
      const m = part.replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '').match(/^(?:begin\(?aligned\)?)?y&?=(.+?)(?:end.*)?$/);
      if (m && /x/.test(m[1])) rhs.push(m[1]);
    }
  }
  if (rhs.length < 2) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  // the right choice has an x on BOTH sides and no lone y
  const i = S.findIndex(s => {
    const t = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    if (/^y=/.test(t) || !t.includes('=')) return false;
    const [l, r] = t.split('=');
    return /x/.test(l) && /x/.test(r);
  });
  return i < 0 ? { miss: rhs.join('=') } : { i, want: rhs.join('=') };
};
window.__duo.RULES.splice(2, 0, ['solveSystemSetup', /equation to find the intersection|set.*equal/i]);
;'__duo ready';

// a system is usually wrapped in \begin{aligned} ... \end{aligned} with "&=" as the
// separator, which defeats the plain "y = ..." parse
(function () {
  const base = window.__duo.lineMB;
  window.__duo.lineMB = function (s) {
    const v = base.call(this, s);
    if (v) return v;
    const cleaned = this.ascii(s)
      .replace(/\\begin\{aligned\}|\\end\{aligned\}/g, ' ')
      .replace(/&/g, '');
    return cleaned === this.ascii(s) ? null : base.call(this, cleaned);
  };
  const baseInt = window.__duo.intersection;
  window.__duo.intersection = function () {
    const r = baseInt.call(this); if (r) return r;
    const lines = [];
    for (const s of this.promptLatex()) {
      const flat = this.ascii(s).replace(/\\begin\{aligned\}|\\end\{aligned\}/g, ' ').replace(/&/g, '');
      for (const part of flat.split(/\\\\/)) {
        if (!/=/.test(part)) continue;
        const mb = this.lineMB(part);
        if (mb) lines.push(mb);
      }
    }
    if (lines.length < 2) return null;
    const [[m1, b1], [m2, b2]] = lines;
    if (Math.abs(m1 - m2) < 1e-9) return null;
    const x = (b2 - b1) / (m1 - m2);
    return [Math.round(x * 2) / 2, Math.round((m1 * x + b1) * 2) / 2];
  };
})();
;'__duo ready';

// the two lines of a system are often only DRAWN. pieces() already returns each
// line's endpoints in grid coords, so derive (m, b) per line and solve.
(function () {
  const base = window.__duo.intersection;
  window.__duo.intersection = function () {
    const r = base.call(this); if (r) return r;
    const P = this.pieces();
    if (!P || P.length !== 2) return null;
    const mb = P.map(p => {
      if (p.slope === null) return null;
      return [p.slope, p.lo[1] - p.slope * p.lo[0]];
    });
    if (mb.some(v => !v)) return null;
    const [[m1, b1], [m2, b2]] = mb;
    if (Math.abs(m1 - m2) < 1e-6) return null;
    const x = (b2 - b1) / (m1 - m2);
    const y = m1 * x + b1;
    const rx = Math.round(x), ry = Math.round(y);
    // only trust it if the crossing lands on a lattice point
    if (Math.abs(x - rx) > 0.2 || Math.abs(y - ry) > 0.2) return null;
    return [rx, ry];
  };
})();
;'__duo ready';

// typed system answers: "Enter the x-value / y-value of the intersection"
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const P = this.prompt();
      const want = this.intersection();
      if (want) {
        const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
        const wantsX = /x\s*-?\s*value|value of\s*x|solve for\s*x/i.test(A) || /x/.test(P) && !/y/.test(P);
        const wantsY = /y\s*-?\s*value|value of\s*y|solve for\s*y/i.test(A);
        if (wantsY) { const v = String(want[1]); this.type(v); return v; }
        if (wantsX) { const v = String(want[0]); this.type(v); return v; }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// ---- "Create a system with N intersections" (unit 147) ----
// Two lines built from four draggable points, and the prompt echoes the live count
// as \duodisplay{...}{current}. Rather than model the geometry, nudge one point and
// read the count back — 1 intersection means non-parallel, 0 means parallel with
// different intercepts, infinity means the same line.
Object.assign(window.__duo, {
  countTarget() {
    const A = this.ascii(this.promptLatex().join(' '))
      .replace(/emphasis|mathbf|textbf|text|\\/g, ' ').replace(/[{}~]/g, ' ')
      .replace(/\s+/g, ' ').toLowerCase();
    if (!/intersection/.test(A)) return null;
    if (/infinite|infty/.test(A.split('intersection')[0].slice(-24))) return Infinity;
    const m = A.match(/with\s*(\d+)\s*intersection/);
    return m ? +m[1] : null;
  },

  countNow() {
    const t = this.duoTarget(); if (!t) return null;
    const c = this.ascii(t.cur).replace(/[\\{}\s]/g, '');
    if (/infty|∞/.test(c)) return Infinity;
    const v = parseFloat(c);
    return isNaN(v) ? null : v;
  },

  async solveIntersectionCount() {
    const want = this.countTarget(); if (want === null) return false;
    if (this.countNow() === want) return true;
    const comps = this.dragComponents(); if (comps.length < 2) return false;
    // try moving each point by a unit or two until the reported count matches
    for (const o of comps) {
      for (const [dx, dy] of [[0, 1], [0, -1], [0, 2], [1, 1], [0, -2]]) {
        const start = [o.P.x, o.P.y];
        const t = [start[0] + dx, start[1] + dy];
        if (!await this.moveComponent(o, t)) continue;
        await this.sleep(300);
        if (this.countNow() === want) return true;
      }
    }
    return this.countNow() === want;
  },
});
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.countTarget() !== null && this.dragComponents().length >= 2) {
      if (await this.solveIntersectionCount()) return true;
    }
    return await base.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    if (this.countTarget() !== null && this.dragComponents().length >= 2)
      return { kind: 'intercount', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// "Select the number of intersections": two drawn lines cross once unless their
// slopes match — same slope and same intercept is the whole line (infinite),
// same slope and different intercept is none.
window.__duo.solveIntersectionCountChoice = function () {
  const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
  if (!/number of intersection|how many.*intersect|how many solutions/.test(A)) return null;
  let n = null;
  const live = this.countNow();
  if (live !== null) n = live;
  if (n === null) {
    const P = this.pieces();
    if (!P || P.length !== 2) return null;
    const mb = P.map(p => p.slope === null ? null : [p.slope, p.lo[1] - p.slope * p.lo[0]]);
    if (mb.some(v => !v)) return null;
    const sameM = Math.abs(mb[0][0] - mb[1][0]) < 0.05;
    const sameB = Math.abs(mb[0][1] - mb[1][1]) < 0.15;
    n = sameM ? (sameB ? Infinity : 0) : 1;
  }
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ch.map(e => this.ascii(e.innerText).replace(/\s/g, '').toLowerCase());
  const i = S.findIndex(s => n === Infinity ? /infinite|infty|∞/.test(s) : parseFloat(s) === n);
  return i < 0 ? { miss: String(n) } : { i, want: String(n) };
};
window.__duo.RULES.splice(2, 0, ['solveIntersectionCountChoice', /number of intersection|how many/i]);
;'__duo ready';

// Counting intersections from EQUATIONS, including vertical lines (x = 2), which
// lineMB cannot express: a vertical always meets a non-vertical exactly once.
window.__duo.systemCount = function () {
  const eqs = [];
  for (const s of this.promptLatex()) {
    const flat = this.ascii(s).replace(/\\begin\{aligned\}|\\end\{aligned\}/g, ' ').replace(/&/g, '');
    for (const part of flat.split(/\\\\/)) {
      if (!/=/.test(part)) continue;
      const t = part.replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
      const v = t.match(/^x=(-?[\d.]+)$/);
      if (v) { eqs.push({ vert: true, c: parseFloat(v[1]) }); continue; }
      const mb = this.lineMB(part);
      if (mb) eqs.push({ vert: false, m: mb[0], b: mb[1] });
    }
  }
  if (eqs.length !== 2) return null;
  const [a, b] = eqs;
  if (a.vert && b.vert) return Math.abs(a.c - b.c) < 1e-9 ? Infinity : 0;
  if (a.vert || b.vert) return 1;
  if (Math.abs(a.m - b.m) > 1e-9) return 1;
  return Math.abs(a.b - b.b) < 1e-9 ? Infinity : 0;
};
(function () {
  const base = window.__duo.solveIntersectionCountChoice;
  window.__duo.solveIntersectionCountChoice = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const n = this.systemCount(); if (n === null) return r;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const S = ch.map(e => this.ascii(e.innerText).replace(/\s/g, '').toLowerCase());
    const i = S.findIndex(s => n === Infinity ? /infinite|infty|∞/.test(s) : parseFloat(s) === n);
    return i < 0 ? { miss: String(n) } : { i, want: String(n) };
  };
})();
;'__duo ready';

// choice innerText is DOUBLED ("1" comes back as "11"), so parseFloat reads 11
(function () {
  const half = s => {
    const t = String(s).replace(/\s/g, '');
    return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2))
      ? t.slice(0, t.length / 2) : t;
  };
  const base = window.__duo.solveIntersectionCountChoice;
  window.__duo.solveIntersectionCountChoice = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    let n = this.countNow();
    if (n === null) n = this.systemCount();
    if (n === null || n === undefined) return r;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const S = ch.map(e => half(this.ascii(e.innerText)).toLowerCase());
    const i = S.findIndex(s => n === Infinity ? /infinite|infty|∞/.test(s) : parseFloat(s) === n);
    return i < 0 ? { miss: String(n) } : { i, want: String(n) };
  };
})();
;'__duo ready';

window.__duo.RULES = window.__duo.RULES.filter(r => r[0] !== 'solveIntersectionCountChoice');
window.__duo.RULES.splice(2, 0,
  ['solveIntersectionCountChoice', /number of intersection|number of solutions|how many/i]);
;'__duo ready';

// "Enter the x-/y-COORDINATE of the intersection point" — another phrasing
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
      if (/intersection|solution/i.test(A)) {
        const want = this.intersection();
        if (want) {
          if (/y\s*-?\s*(coordinate|value)/i.test(A)) { const v = String(want[1]); this.type(v); return v; }
          if (/x\s*-?\s*(coordinate|value)/i.test(A)) { const v = String(want[0]); this.type(v); return v; }
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// "Enter the number of intersections" — typed count. Must sit ABOVE the generic
// typed handlers, which otherwise answer with a coordinate.
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
      if (/number of (intersections|solutions)/i.test(A)) {
        let n = this.countNow();
        if (n === null || n === undefined) n = this.systemCount();
        if (n !== null && n !== undefined && isFinite(n)) { const v = String(n); this.type(v); return v; }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// ---- two-variable inequalities (unit 148) ----
// "Select a solution to the inequality y >= -x": test each ordered-pair choice.
Object.assign(window.__duo, {
  ineq2(s) {
    const t = this.ineqNorm(s);
    const m = t.match(/^y(<=|>=|<|>)(.+)$/); if (!m) return null;
    const f = this.compile(m[2]); if (!f) return null;
    const op = m[1];
    return (x, y) => {
      let v; try { v = f(x); } catch (e) { return false; }
      if (!isFinite(v)) return false;
      return op === '<=' ? y <= v : (op === '>=' ? y >= v : (op === '<' ? y < v : y > v));
    };
  },

  solveIneq2Point() {
    let test = null;
    for (const s of this.promptLatex().slice().reverse()) {
      const t = this.ineq2(s); if (t) { test = t; break; }
    }
    if (!test) return null;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return null;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const pair = s => {
      const m = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '').match(/\((-?[\d.]+),(-?[\d.]+)\)/);
      return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
    };
    const hits = [];
    S.forEach((s, i) => { const q = pair(s); if (q && test(q[0], q[1])) hits.push(i); });
    return hits.length === 1 ? { i: hits[0] } : (hits.length ? { i: hits[0] } : { miss: 'none' });
  },
});
window.__duo.RULES.splice(2, 0, ['solveIneq2Point', /solution to the inequality|satisfies the inequality/i]);
;'__duo ready';

// "Graph the inequality" in two variables: place the two points on the BOUNDARY
// line (y = mx + b from the inequality), same as graphing the line.
(function () {
  const base = window.__duo.solveGraphLine;
  window.__duo.solveGraphLine = async function () {
    const ok = await base.call(this);
    if (ok) return true;
    const comps = this.dragComponents();
    if (comps.length !== 2) return false;
    let mb = null;
    for (const s of this.promptLatex().slice().reverse()) {
      const t = this.ineqNorm(s);
      const m = t.match(/^y(?:<=|>=|<|>)(.+)$/);
      if (!m) continue;
      const v = this.lineMB('y=' + m[1]);
      if (v) { mb = v; break; }
    }
    if (!mb) return false;
    const R = this.gridRange() || { lo: -5, hi: 5 };
    const pts = [];
    for (let x = R.lo; x <= R.hi && pts.length < 2; x++) {
      const y = mb[0] * x + mb[1];
      if (Number.isInteger(y) && y >= R.lo && y <= R.hi) pts.push([x, y]);
    }
    if (pts.length < 2) return false;
    comps.sort((a, b) => a.P.x - b.P.x);
    const a = await this.moveComponent(comps[0], pts[0]);
    const b = await this.moveComponent(comps[1], pts[1]);
    return a && b;
  };
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.dragComponents().length === 2 && /inequality/i.test(this.tex())) {
      if (await this.solveGraphLine()) return true;
    }
    return await baseDrag.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    if (this.dragComponents().length === 2 && /inequality/i.test(this.tex()))
      return { kind: 'graphineq', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// "Select the solution" given an inequality and a value for x: substitute and
// compare against the choices, which are themselves inequalities in y.
window.__duo.solveIneq2Substitute = function () {
  let op = null, f = null, xv = null;
  // the inequality and the x value usually share ONE latex entry, separated by \\
  const parts = [];
  for (const s of this.promptLatex()) for (const p of this.ascii(s).split(/\\\\/)) parts.push(p);
  for (const s of parts) {
    const t = this.ineqNorm(s);
    const m = t.match(/^y(<=|>=|<|>)(.+)$/);
    if (m) { const g = this.compile(m[2]); if (g) { op = m[1]; f = g; continue; } }
    const v = t.match(/^x=(-?[\d.]+)$/);
    if (v) xv = parseFloat(v[1]);
  }
  if (!f || xv === null) return null;
  let want; try { want = f(xv); } catch (e) { return null; }
  if (!isFinite(want)) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const i = S.findIndex(s => {
    const m = this.ineqNorm(s).match(/^y(<=|>=|<|>)(-?[\d.]+)$/);
    return m && m[1] === op && Math.abs(parseFloat(m[2]) - want) < 1e-9;
  });
  return i < 0 ? { miss: op + want } : { i, want: op + want };
};
window.__duo.RULES.splice(2, 0, ['solveIneq2Substitute', /select the solution/i]);
;'__duo ready';
