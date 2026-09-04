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
    // ponytail: some challenge types' grading_function assumes a live input
    // widget and throws when called with no user selection — bail like any
    // other "grader can't help" case instead of crashing the whole run().
    let r; try { r = new Function('return (' + b.grading_function + ')')()(b); }
    catch (e) { return null; }
    // ponytail: array-shaped [false, {value}] on some types, object-shaped
    // {displayAnswer:{value}} on others (e.g. triangle angle-sum problems).
    const v = (r && r[1] && r[1].value) || (r && r.displayAnswer && r.displayAnswer.value) || '';
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
    // ponytail: a halted run() can leave a CHECKed question sitting on CONTINUE.
    // Re-reading it looks answerable (still has choices/input), but calling the
    // grader a second time on an already-answered blob throws. Clear it first.
    if (r.blame && /CONTINUE/i.test(r.next || '')) { await this.go(); return { ok: true, was: r.type, next: this.read() }; }
    if (!this.auto(r)) return { stop: 'manual', type: r.type, r };

    if (r.input) {
      const a = this.answer();
      if (!a) return { stop: 'no grader answer', r };
      this.type(a[0]);
    } else {
      const s = this.solveChoices();
      // ponytail: bail rather than guess — a wrong CHECK costs a heart, a
      // handback costs nothing. solveChoices can return null (no match found),
      // not just {ok:false}.
      if (!s || !s.ok) return { stop: 'choice match failed', s, r };
      this.choose(...s.idx);
    }
    const after = await this.go();
    if (after.blame === 'blame-incorrect') return { stop: 'wrong', r, after };
    // clear the post-answer CONTINUE so the next read() is a real question
    if (after.next) await this.go();
    return { ok: true, was: r.type, next: this.read() };
  },

  // Run until something needs a human/mouse. Returns the trail for one report.
  // ponytail: solve() had no try/catch, so a thrown error (e.g. grading_function
  // eval, or player-next going null mid-transition) silently killed the promise
  // chain and looked like a stuck loop with no signal at all. Surface it instead.
  async run(n = 15) {
    const trail = [];
    for (let i = 0; i < n; i++) {
      let s;
      try { s = await this.solve(); }
      catch (e) { s = { stop: 'error', error: String(e && e.message || e), r: this.read() }; }
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

// guided steps render their choices a beat late — re-read once before deciding
// a screen is a no-answer explainer

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
      // "16\pi" vs "\pi r^2": pi cancels on both sides, so drop it.
      .replace(/\\pi/g, '(3.141592653589793)')
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
    // gridPoints() may hand back widget components rather than [x,y] pairs
    const XY = list => (list || []).map(p => Array.isArray(p) ? p : [p.x, p.y]);
    const want = this.linePair(m); if (!want) return false;
    const g = this.grid2D(); if (!g) return false;
    const px = (x, y) => [Math.round(g.x0 + x * g.ux), Math.round(g.y0 + y * g.uy)];

    for (let pass = 0; pass < 5; pass++) {
      const cur = XY(this.gridPoints()); if (cur.length < 2) return false;
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
    const cur = XY(this.gridPoints());
    if (cur.length < 2) return false;
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
window.__duo.RULES.splice(2, 0, ['solveInterceptMethod', /how to find the|determine how/i]);

// the intercept values themselves, from f(x) = mx + b
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

// "Graph the inequalities" (plural): FOUR draggable points forming two boundary
// lines. Pair the points into two lines by their current grouping, then place each
// pair on its own boundary.
(function () {
  const base = window.__duo.solveGraphLine;
  window.__duo.solveGraphLine = async function () {
    const comps = this.dragComponents();
    if (comps.length !== 4) return base.call(this);
    const mbs = [];
    for (const s of this.promptLatex()) {
      for (const part of this.ascii(s).split(/\\\\/)) {
        const t = this.ineqNorm(part);
        const m = t.match(/^y(?:<=|>=|<|>)(.+)$/);
        if (!m) continue;
        const v = this.lineMB('y=' + m[1]);
        if (v) mbs.push(v);
      }
    }
    if (mbs.length !== 2) return base.call(this);
    const R = this.gridRange() || { lo: -5, hi: 5 };
    const ptsFor = mb => {
      const out = [];
      for (let x = R.lo; x <= R.hi && out.length < 2; x++) {
        const y = mb[0] * x + mb[1];
        if (Number.isInteger(y) && y >= R.lo && y <= R.hi) out.push([x, y]);
      }
      return out;
    };
    // the components arrive in LINE order (line 1's two points, then line 2's), so
    // do not re-sort them — regrouping by position mixes the two boundaries and the
    // widget still tracks which point belongs to which line
    const groups = [[comps[0], comps[1]], [comps[2], comps[3]]];
    let ok = true;
    for (let g = 0; g < 2; g++) {
      const pts = ptsFor(mbs[g]);
      if (pts.length < 2) return false;
      const pair = groups[g].slice().sort((a, b) => a.P.x - b.P.x);
      ok = (await this.moveComponent(pair[0], pts[0])) && ok;
      ok = (await this.moveComponent(pair[1], pts[1])) && ok;
    }
    return ok;
  };
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.dragComponents().length === 4 && /inequalit/i.test(this.tex())) {
      if (await this.solveGraphLine()) return true;
    }
    return await baseDrag.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    if (this.dragComponents().length === 4 && /inequalit/i.test(this.tex()))
      return { kind: 'graphineq2', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// the plot gate used prompt(), which returns the FORMULA line rather than the
// "Plot the y-intercept" header — gate on the widget plus a computable target
(function () {
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    if (this.plotTarget() && (this.onePoint() || this.dragComponents().length === 1))
      return { kind: 'plot', from: [0, 0], to: [0, 0] };
    return null;
  };
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.plotTarget()) {
      const comps = this.dragComponents();
      if (comps.length === 1) { if (await this.moveComponent(comps[0], this.plotTarget())) return true; }
      if (await this.solvePlotPoint()) return true;
    }
    return await baseDrag.call(this);
  };
})();
;'__duo ready';

// ---- exponent-law pairs (unit 149) ----
// "x^2 \cdot x^5" <-> "x^{2+5}". Evaluate both at a couple of sample bases rather
// than modelling the law, so product/quotient/power forms all work.
Object.assign(window.__duo, {
  powVal(s) {
    let t = this.ascii(s)
      .replace(/\\(mathbf|textbf|text)\s*/g, '')
      .replace(/\\cdot|\\times/g, '*')
      // "16\pi" vs "\pi r^2": pi cancels on both sides, so drop it.
      .replace(/\\pi/g, '(3.141592653589793)')
      .replace(/\\left|\\right/g, '')
      .replace(/[~\s]/g, '');
    for (let i = 0; i < 4; i++) {
      const m = t.match(/^\{(.*)\}$/); if (!m) break; t = m[1];
    }
    t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
         .replace(/\^\{([^{}]*)\}/g, '**($1)')
         .replace(/\^(-?\d+)/g, '**($1)');
    if (/\\|\{|\}/.test(t)) return null;
    if (!/^[-+*/().0-9x]|\*\*/.test(t)) return null;
    if (!/^[-+*/().0-9x]*$/.test(t.replace(/\*\*/g, '*'))) return null;
    try {
      const f = Function('x', '"use strict";return (' + t + ')');
      const a = f(2), b = f(3);
      return (isFinite(a) && isFinite(b)) ? a + '|' + b : null;
    } catch (e) { return null; }
  },

  async powPairs() {
    const tk = [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
    if (tk.length < 4) return null;
    const val = tk.map(e => { const a = e.querySelector('annotation'); return this.powVal(a ? a.textContent : e.innerText); });
    const done = e => /_2wryV/.test(String(e.className));
    const used = new Set(); let n = 0;
    for (let i = 0; i < tk.length; i++) {
      if (used.has(i) || done(tk[i]) || !val[i]) continue;
      const j = val.findIndex((v, k) => k !== i && !used.has(k) && !done(tk[k]) && v === val[i]);
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
    const r = (await base.call(this)) || (await this.powPairs());
    await this.sleep(350);
    return solved() > before ? r : null;
  };
})();
;'__duo ready';

// ---- brute-force pairs fallback ----
// Every new unit brings a new pairing rule, and each one used to stall the loop
// until a solver was written. Match-the-pairs has no penalty for a wrong guess —
// the tokens simply do not stick — so just try combinations until they all latch.
// This removes the whole class of pairs stalls.
window.__duo.bruteForcePairs = async function () {
  const all = () => [...document.querySelectorAll('[data-test$="challenge-tap-token"]')];
  const done = e => /_2wryV/.test(String(e.className));
  if (all().length < 4) return null;
  let matched = 0;
  for (let pass = 0; pass < 3; pass++) {
    const tk = all();
    const open = tk.map((e, i) => done(e) ? -1 : i).filter(i => i >= 0);
    if (!open.length) break;
    let progressed = false;
    for (let a = 0; a < open.length; a++) {
      for (let b = a + 1; b < open.length; b++) {
        const cur = all();
        if (done(cur[open[a]]) || done(cur[open[b]])) continue;
        const before = all().filter(done).length;
        this.tap(cur[open[a]]); await this.sleep(120);
        this.tap(cur[open[b]]); await this.sleep(300);
        const after = all().filter(done).length;
        if (after > before) { matched++; progressed = true; }
        else {
          // clear any lingering selection so the next try starts clean
          this.tap(all()[open[a]]); await this.sleep(90);
        }
      }
    }
    if (!progressed) break;
  }
  return matched ? { pairs: matched } : null;
};
(function () {
  const base = window.__duo.ineqPairs;
  window.__duo.ineqPairs = async function () {
    const solved = () => [...document.querySelectorAll('[data-test$="challenge-tap-token"]')]
      .filter(e => /_2wryV/.test(String(e.className))).length;
    const before = solved();
    let r = await base.call(this);
    if (solved() === before) r = await this.bruteForcePairs();
    await this.sleep(300);
    return solved() > before ? (r || { pairs: 1 }) : null;
  };
})();
;'__duo ready';

// \duoblank{...} holds the answer verbatim, but a lazy [^}]* capture truncates it
// at the first closing brace of a nested \frac. Extract with balanced braces, then
// match a choice by normalised text — this covers a lot of screens for free.
Object.assign(window.__duo, {
  blankRaw() {
    const src = this.promptLatex().join(' ');
    const key = '\\duoblank{';
    const at = src.lastIndexOf(key);
    if (at < 0) return null;
    let i = at + key.length, depth = 1, out = '';
    while (i < src.length && depth) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (!depth) break; }
      out += c; i++;
    }
    return depth === 0 ? out : null;
  },

  solveBlankChoice() {
    const raw = this.blankRaw(); if (!raw) return null;
    const norm = s => this.ascii(s).replace(/\\(mathbf|textbf|text)\s*/g, '')
      .replace(/[~\s{}]/g, '').replace(/\\cdot/g, '*');
    const want = norm(raw);
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return null;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    let i = S.findIndex(s => norm(s) === want);
    if (i < 0) {
      // fall back to numeric equality, so 1/10+7/10 also matches 8/10
      const v = this.evalExpr(raw.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))'));
      if (v !== null) i = S.findIndex(s => {
        const w = this.evalExpr(this.ascii(s).replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))'));
        return w !== null && Math.abs(w - v) < 1e-9;
      });
    }
    return i < 0 ? { miss: want } : { i, want };
  },
});
window.__duo.RULES.splice(2, 0, ['solveBlankChoice', null]);
;'__duo ready';

// ---- never let an unsolved DRAG screen stall the lesson ----
// Choice screens guess and typed screens type "0"; drag screens still logged
// 'needdrag' and broke out, which is the last remaining hard stall. Pressing CHECK
// anyway gets the answer graded and replaced — same trade as the other fallbacks,
// bounded by run2's 2-wrong halt.
(function () {
  let src = String(window.__duo.run2);
  const patched = src.replace(/this\.S\.log\.push\('needdrag'\);\s*break;/,
    `this.S.log.push('needdrag');
     this.S.dragGuesses = (this.S.dragGuesses || 0) + 1;
     if (this.S.dragGuesses > 2) break;
     this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1500);
     const bg = await this.blame(); this.S.log.push(bg || 'noblame');
     if (bg === 'incorrect' && ++miss >= 2) { this.S.log.push('halt:2wrong'); break; }
     const cg = document.querySelector('[data-test="player-next"]');
     if (cg && /CONTINUE/i.test(cg.innerText)) { this.tap(cg); await this.sleep(1400); }
     info = 0; continue;`);
  if (patched !== src) window.__duo.run2 = eval('(' + patched + ')');
  else console.warn('[duo] needdrag fallback did not apply');
})();
(function () {
  const base = window.__duo.autoLesson;
  window.__duo.autoLesson = async function () {
    this.S.dragGuesses = 0;
    return base.call(this);
  };
})();
;'__duo ready';

// ---- per-lesson stats (XP, accuracy) ----
// Reads totalXp from the user API either side of the lesson and records the delta,
// so each finished lesson gets a line: unit/level, correct, wrong, XP gained.
(function () {
  const base = window.__duo.autoLesson;
  window.__duo.autoLesson = async function () {
    const uid = (() => {
      try {
        const m = document.cookie.match(/jwt_token=([^;]+)/);
        return m ? JSON.parse(atob(m[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub : null;
      } catch (e) { return null; }
    })();
    const xp = async () => {
      if (!uid) return null;
      try {
        const r = await fetch('/2017-06-30/users/' + uid + '?fields=totalXp,streak', { credentials: 'include' });
        const j = await r.json();
        return { xp: j.totalXp, streak: j.streak };
      } catch (e) { return null; }
    };
    const st0 = JSON.parse(localStorage.getItem('duoAuto'));
    const before = await xp();
    const r = await base.call(this);
    const after = await xp();
    const wrong = this.S.log.filter(x => x === 'incorrect').length;
    const rec = {
      unit: st0.unit, level: st0.level,
      correct: this.S.done, wrong,
      xp: (before && after) ? (after.xp - before.xp) : null,
      totalXp: after ? after.xp : null,
      streak: after ? after.streak : null,
      done: r.ok, at: new Date().toISOString().slice(11, 19),
    };
    const st = JSON.parse(localStorage.getItem('duoAuto'));
    st.stats = (st.stats || []).concat([rec]).slice(-60);
    localStorage.setItem('duoAuto', JSON.stringify(st));
    return Object.assign(r, { rec });
  };
})();
window.__duo.statsLine = function () {
  const st = JSON.parse(localStorage.getItem('duoAuto') || '{}');
  const s = st.stats || [];
  const tot = s.reduce((a, r) => a + (r.xp || 0), 0);
  return s.slice(-8).map(r =>
    'u' + r.unit + 'l' + r.level + ' ' + r.correct + '✓/' + r.wrong + '✗'
    + ' +' + (r.xp === null ? '?' : r.xp) + 'xp' + (r.done ? '' : ' (halted)')
  ).join('\n') + '\nsession XP total: ' + tot
    + (s.length && s[s.length - 1].totalXp ? ' | lifetime ' + s[s.length - 1].totalXp : '')
    + (s.length && s[s.length - 1].streak ? ' | streak ' + s[s.length - 1].streak : '');
};
;'__duo ready';

// ---- radicals as fractional exponents (unit 150) ----
// \sqrt[8]{b} == b^{1/8}. Teach compile() the n-th root form, then match choices by
// evaluating both at sample bases.
(function () {
  const base = window.__duo.compile;
  window.__duo.compile = function (src) {
    let t = this.ascii(src);
    // \sqrt[n]{expr} -> (expr)**(1/n)   (do this before the plain \sqrt rule)
    for (let i = 0; i < 4; i++) {
      t = t.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, '(($2)**(1/($1)))');
    }
    return base.call(this, t);
  };
})();
window.__duo.solveRadicalMatch = function () {
  let want = null;
  for (const s of this.promptLatex().slice().reverse()) {
    if (/select|match|which/i.test(this.ascii(s)) && !/sqrt|\^/.test(this.ascii(s))) continue;
    const f = this.compile(s);
    if (!f) continue;
    try { const a = f(2), b = f(3); if (isFinite(a) && isFinite(b)) { want = a + '|' + b; break; } } catch (e) {}
  }
  if (!want) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const hits = [];
  S.forEach((s, i) => {
    const f = this.compile(s); if (!f) return;
    try {
      const a = f(2), b = f(3);
      if (isFinite(a) && isFinite(b) && Math.abs(a - +want.split('|')[0]) < 1e-9
          && Math.abs(b - +want.split('|')[1]) < 1e-9) hits.push(i);
    } catch (e) {}
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.splice(2, 0, ['solveRadicalMatch', null]);
;'__duo ready';

// compile() is a function of x, but the questions use whatever letter they like
// (b, n, t). Rewrite any lone single letter to x before compiling; letters inside
// Math.sqrt / Math.abs are safe because they sit next to other letters.
(function () {
  const base = window.__duo.compile;
  window.__duo.compile = function (src) {
    const f = base.call(this, src);
    if (f) return f;
    const t = this.ascii(src).replace(/(?<![A-Za-z.])[a-z](?![A-Za-z])/g, 'x');
    return t === this.ascii(src) ? null : base.call(this, t);
  };
})();
;'__duo ready';

// typed answers where \duoblank{} holds the value — including a fraction, which is
// typed as "3/10" rather than as LaTeX
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const raw = this.blankRaw();
      if (raw) {
        let t = this.ascii(raw)
          .replace(/\\(mathbf|textbf|text)\s*/g, '')
          .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
          .replace(/[{}~\s]/g, '');
        if (/^[-+*/().0-9]+$/.test(t)) {
          // a bare arithmetic blank ("1/10+7/10") should be entered as its value
          const v = this.evalExpr(t);
          const out = (v !== null && !/\//.test(t)) ? String(v) : t;
          this.type(out); return out;
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// ---- simplify radicals (unit 150 L4) ----
// Guided steps: largest perfect-square factor, then the split, then the result.
Object.assign(window.__duo, {
  radicand() {
    for (const s of this.promptLatex().slice().reverse()) {
      const m = this.ascii(s).replace(/[~\s]/g, '').match(/\\sqrt\{(\d+)\}/);
      if (m) return +m[1];
    }
    return null;
  },
  largestSquareFactor(n) {
    let best = 1;
    for (let k = 2; k * k <= n; k++) if (n % (k * k) === 0) best = k * k;
    return best;
  },
  solveRadicalStep() {
    const n = this.radicand(); if (!n) return null;
    // the instruction sits in an earlier latex line; prompt() returns the last
    // text-bearing one, which here is the list of factors
    const P = this.ascii(this.promptLatex().join(' '))
      .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').toLowerCase();
    const sq = this.largestSquareFactor(n);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return null;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const num = s => { const v = parseFloat(this.clean(s)); return isNaN(v) ? null : v; };

    if (/perfect square factor/i.test(P)) {
      const i = S.findIndex(s => num(s) === sq);
      return i < 0 ? { miss: sq } : { i, want: sq };
    }
    if (/square root of|take the square root/i.test(P)) {
      const i = S.findIndex(s => num(s) === Math.sqrt(sq));
      return i < 0 ? { miss: Math.sqrt(sq) } : { i, want: Math.sqrt(sq) };
    }
    // otherwise: match a choice that equals sqrt(n) numerically
    const hits = [];
    S.forEach((s, i) => {
      const f = this.compile(s);
      if (!f) return;
      try { const v = f(1); if (isFinite(v) && Math.abs(v - Math.sqrt(n)) < 1e-9) hits.push(i); } catch (e) {}
    });
    return hits.length === 1 ? { i: hits[0] } : null;
  },
});
window.__duo.RULES.splice(2, 0, ['solveRadicalStep', /radical|perfect square|square root/i]);
;'__duo ready';

// Guided radical steps: gate on the SHAPE of the choices, not on the prompt text —
// the text accumulates across steps, so "largest perfect square factor" is still
// present when the question has moved on to the split.
window.__duo.solveRadicalStep = function () {
  const n = this.radicand(); if (!n) return null;
  const sq = this.largestSquareFactor(n);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
    .map(s => this.ascii(s).replace(/\\(mathbf|textbf|text)\s*/g, '').replace(/[~\s]/g, ''));

  // a·b split: pick the pair containing the largest perfect square
  if (S.every(s => /\\cdot|·|\*/.test(s))) {
    const i = S.findIndex(s => {
      const ns = (s.match(/\d+/g) || []).map(Number);
      return ns.includes(sq) && ns.length >= 2 && ns.reduce((a, b) => a * b, 1) % n === 0;
    });
    return i < 0 ? { miss: 'split' + sq } : { i, want: 'split' + sq };
  }
  // plain integers: the perfect-square factor, or its root
  if (S.every(s => /^-?\d+$/.test(s.replace(/[{}]/g, '')))) {
    const vals = S.map(s => parseFloat(s.replace(/[{}]/g, '')));
    let i = vals.indexOf(sq);
    if (i < 0) i = vals.indexOf(Math.sqrt(sq));
    return i < 0 ? { miss: sq } : { i, want: sq };
  }
  // otherwise pick whatever evaluates to sqrt(n)
  const hits = [];
  S.forEach((s, i) => {
    const f = this.compile(s); if (!f) return;
    try { const v = f(1); if (isFinite(v) && Math.abs(v - Math.sqrt(n)) < 1e-9) hits.push(i); } catch (e) {}
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
;'__duo ready';

// implicit multiplication before a function call: "4\sqrt{3}" becomes
// "4Math.sqrt(3)", which is a syntax error and made every coefficient-times-radical
// choice uncompilable
(function () {
  const base = window.__duo.compile;
  window.__duo.compile = function (src) {
    const f = base.call(this, src);
    if (f) return f;
    let t = this.ascii(src)
      .replace(/\\times|\\cdot/g, '*')
      .replace(/(\d)\s*(\\sqrt|\\frac)/g, '$1*$2');
    return t === this.ascii(src) ? null : base.call(this, t);
  };
})();
;'__duo ready';

// radicand() scanned in reverse and so picked the \sqrt{3} from the working rather
// than the \sqrt{12} the question started from. Take the FIRST one.
window.__duo.radicand = function () {
  for (const s of this.promptLatex()) {
    const m = this.ascii(s).replace(/[~\s]/g, '').match(/\\sqrt\{(\d+)\}/);
    if (m) return +m[1];
  }
  return null;
};
;'__duo ready';

// ---- combine like radicals (unit 151) ----
// "4\sqrt{11} + 5\sqrt{11}" -> "(4 + 5)\sqrt{11}". The distractor changes the
// radicand, so the answer is the choice that keeps the LIVE expression's radicand
// (the guided text also contains an earlier worked example — take the last match).
window.__duo.solveLikeRadicals = function () {
  const lines = this.promptLatex().map(s => this.ascii(s).replace(/[~\s]/g, ''));
  let r = null;
  for (const s of lines) {
    const m = s.match(/(-?\d*)\\sqrt\{(\d+)\}[+-](-?\d*)\\sqrt\{(\d+)\}/);
    if (m && m[2] === m[4]) r = m[2];
  }
  if (!r) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
  const hits = [];
  S.forEach((s, i) => { if (new RegExp('\\\\sqrt\\{' + r + '\\}').test(this.ascii(s).replace(/[~\s]/g, ''))) hits.push(i); });
  return hits.length === 1 ? { i: hits[0], want: r } : null;
};
window.__duo.RULES.splice(2, 0, ['solveLikeRadicals', null]);
;'__duo ready';

// "largest perfect square factor" where the choices carry variables: a term is a
// perfect square when its coefficient is one AND every exponent is even.
window.__duo.solvePerfectSquareTerm = function () {
  const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
  if (!/perfect square/.test(A)) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = (ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText)))
    .map(s => this.ascii(s).replace(/\\(mathbf|textbf|text)\s*/g, '').replace(/[~\s{}]/g, ''));
  const isSquare = s => {
    const co = s.match(/^(\d+)/);
    if (co && Math.sqrt(+co[1]) % 1 !== 0) return false;
    const exps = [...s.matchAll(/\^(-?\d+)/g)].map(m => +m[1]);
    if (exps.some(e => e % 2 !== 0)) return false;
    // a bare variable with no exponent is x^1, not a square
    if (/[a-z](?!\^)/.test(s.replace(/\^\d+/g, ''))) return false;
    return true;
  };
  const hits = []; S.forEach((s, i) => { if (isSquare(s)) hits.push(i); });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.splice(2, 0, ['solvePerfectSquareTerm', /perfect square/i]);
;'__duo ready';

// "Complete the pattern" where the rule is standard form -> slope-intercept
(function () {
  const base = window.__duo.solveSlopePattern;
  window.__duo.solveSlopePattern = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const L = this.promptLatex().map(s => this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~/g, '').replace(/\s+/g, ''));
    const qi = L.findIndex(s => s === '?' || s === '');
    if (qi < 1) return r;
    const mb = this.lineMB(this.promptLatex()[qi - 1]);
    if (!mb) return r;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const S = ann.length === ch.length ? ann : ch.map(e => this.ascii(e.innerText));
    const i = S.findIndex(s => {
      const v = this.lineMB(s);
      return v && Math.abs(v[0] - mb[0]) < 1e-9 && Math.abs(v[1] - mb[1]) < 1e-9;
    });
    return i < 0 ? r : { i, want: mb.join(',') };
  };
})();
;'__duo ready';

// ---- polynomial sum via the token-slot widget (unit 154) ----
// A third mathDiagram shape: `entries` is a flat list of slots and the tokens hang
// off `tokenBank.tokenSlots` as slot.__token. Drops go through
// handleCellDrop(index, value, tokenEl), the same call the real drag makes.
Object.assign(window.__duo, {
  bankTokens() {
    const d = this.diagram(); if (!d || !d.M.tokenBank) return [];
    let slots = d.M.tokenBank.tokenSlots;
    slots = Array.isArray(slots) ? slots : [...slots];
    return slots.map(s => ({ el: s.__token, t: this.ascii(String((s.__token && s.__token.textContent) || '')).trim() }))
      .filter(o => o.el && o.t);
  },

  // "(6x^2 + 4x + 3) + (x^2 + 5x + 5)" -> {2:7, 1:9, 0:8}
  polySum() {
    const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|~/g, '').replace(/\s+/g, '');
    const groups = A.match(/\(([^()]*)\)/g);
    if (!groups || groups.length < 2) return null;
    const acc = {};
    for (const g of groups) {
      const body = g.slice(1, -1);
      const terms = body.match(/[+-]?[^+-]+/g) || [];
      for (const raw of terms) {
        const t = raw.replace(/\s/g, ''); if (!t) continue;
        // the variable is not always x — these questions use y, t, n as well
        const v = (body.match(/[a-z]/) || ['x'])[0];
        const m = t.match(new RegExp('^([+-]?)(\\d*)(?:' + v + '(?:\\^(\\d+))?)?$'));
        if (!m) return null;
        const sign = m[1] === '-' ? -1 : 1;
        const coef = m[2] === '' ? 1 : +m[2];
        const deg = new RegExp(v).test(t) ? (m[3] ? +m[3] : 1) : 0;
        acc[deg] = (acc[deg] || 0) + sign * coef;
      }
    }
    return acc;
  },

  async solvePolySum() {
    const d = this.diagram(); if (!d || !d.M.entries || !d.M.handleCellDrop) return false;
    const acc = this.polySum(); if (!acc) return false;
    const degs = Object.keys(acc).map(Number).filter(k => acc[k] !== 0).sort((a, b) => b - a);
    const va = (this.ascii(this.promptLatex().join(' ')).match(/\(([^()]*)\)/) || [])[1] || '';
    const v = (va.match(/[a-z]/) || ['x'])[0];
    const fmt = k => (k === 0 ? String(acc[k]) : (acc[k] === 1 ? '' : String(acc[k])) + v + (k > 1 ? String(k) : ''));
    const want = [];
    degs.forEach((k, i) => { if (i) want.push('+'); want.push(fmt(k)); });
    if (want.length !== d.M.entries.length) return false;
    const used = new Set();
    for (let i = 0; i < want.length; i++) {
      if (d.M.entries[i] !== null) continue;
      const tok = this.bankTokens().find((o, j) => !used.has(o.el) && o.t === want[i]);
      if (!tok) return false;
      used.add(tok.el);
      try { d.M.handleCellDrop(i, tok.t, tok.el); } catch (e) { return false; }
      await this.sleep(320);
    }
    return d.M.entries.every(e => e !== null);
  },
});
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const d = this.diagram();
    if (d && d.M.entries && d.M.entries.some(e => e === null) && this.polySum()) {
      if (await this.solvePolySum()) return true;
    }
    return await baseDrag.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    const d = this.diagram();
    if (d && d.M.entries && d.M.entries.some(e => e === null) && this.polySum())
      return { kind: 'polysum', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// IMPORTANT: writing the model directly (handleCellDrop / setCellValue) fills
// `entries` and even updates the DOM, but the answer is still graded WRONG — the
// grader reads state that only a genuine drag produces. Drag the token element onto
// the cell element instead, reusing dragXY (the same mechanism that works for
// sliders and points).
;'__duo ready';

// ---- "Create an equivalent expression": distribute a leading minus ----
// "3y^2 - (y + 5)" -> 3y^2, -, y, +, -5   (the bank decides whether the third term
// is written as "+ -5" or "- 5", so try both spellings against the tokens).
Object.assign(window.__duo, {
  expandExpr() {
    // strip the wrapper braces too, or the trailing "}" defeats the $ anchor
    const A = this.ascii(this.promptLatex().join(' '))
      .replace(/mathbf|textbf|text|\\|~/g, '').replace(/[{}]/g, ' ').replace(/\s+/g, '');
    const m = A.match(/([^=]*?)([+-])\(([^()]*)\)\s*$/);
    if (!m) return null;
    const head = m[1].replace(/^.*?(?=[\d a-z])/, ''), sign = m[2] === '-' ? -1 : 1;
    const inner = m[3];
    const terms = (inner.match(/[+-]?[^+-]+/g) || []).map(t => t.trim()).filter(Boolean);
    const out = [head];
    for (const t of terms) {
      const neg = t.startsWith('-');
      const body = t.replace(/^[+-]/, '');
      const flip = (sign < 0) !== neg;      // resulting sign
      out.push({ sign: flip ? '-' : '+', body });
    }
    return out;
  },

  async solveEquivExpand() {
    const d = this.diagram(); if (!d || !d.M.entries) return false;
    const parts = this.expandExpr(); if (!parts || parts.length < 2) return false;
    const toks = this.bankTokens();
    const has = t => toks.find(o => o.t === t && o.el.isConnected);

    // build the slot sequence, preferring "+ -5" when a signed token exists
    const seq = [String(parts[0]).replace(/[^0-9a-z^]/g, '')];
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      const signed = (p.sign === '-' ? '-' : '') + p.body;
      if (p.sign === '-' && has('-') && has(p.body)) { seq.push('-', p.body); }
      else if (has('+') && has(signed)) { seq.push('+', signed); }
      else if (has(p.sign) && has(p.body)) { seq.push(p.sign, p.body); }
      else return false;
    }
    if (seq.length !== d.M.entries.length) return false;

    const fr = () => d.f.getBoundingClientRect();
    const centre = el => {
      const r = el.getBoundingClientRect(), f = fr();
      return [Math.round(f.left + r.left + r.width / 2), Math.round(f.top + r.top + r.height / 2)];
    };
    for (let i = 0; i < seq.length; i++) {
      if (d.M.entries[i] !== null) continue;
      const tok = this.bankTokens().find(o => o.t === seq[i] && o.el.isConnected);
      // the widget drops into its first empty slot, not the cell under the pointer,
      // so aim at that one and feed the tokens strictly in order
      const idx = d.M.entries.indexOf(null);
      const cell = d.M.cellElements && d.M.cellElements[idx < 0 ? i : idx];
      if (!tok || !cell) return false;
      await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell));
      await this.sleep(350);
    }
    return d.M.entries.every(e => e !== null);
  },
});
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const d = this.diagram();
    if (d && d.M.entries && d.M.entries.some(e => e === null)) {
      if (this.polySum() && await this.solvePolySum()) return true;
      if (await this.solveEquivExpand()) return true;
    }
    return await baseDrag.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    const d = this.diagram();
    if (d && d.M.entries && d.M.entries.some(e => e === null)) return { kind: 'tokenslots', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// expandExpr must read the EXPRESSION line only — joining all prompt lines puts the
// header text into the leading term. Also drop "^" so "3y^2" matches the token "3y2".
window.__duo.expandExpr = function () {
  for (const line of this.promptLatex().slice().reverse()) {
    const A = this.ascii(line)
      .replace(/mathbf|textbf|text|\\|~/g, '').replace(/[{}]/g, ' ').replace(/\s+/g, '');
    const m = A.match(/^([^=]*?)([+-])\(([^()]*)\)$/);
    if (!m) continue;
    const sign = m[2] === '-' ? -1 : 1;
    const terms = (m[3].match(/[+-]?[^+-]+/g) || []).map(t => t.trim()).filter(Boolean);
    const out = [m[1].replace(/\^/g, '')];
    for (const t of terms) {
      const neg = t.startsWith('-');
      out.push({ sign: ((sign < 0) !== neg) ? '-' : '+', body: t.replace(/^[+-]/, '').replace(/\^/g, '') });
    }
    return out;
  }
  return null;
};
;'__duo ready';

// polySum only handled "(A) + (B)". Generalise to any signed sequence of groups,
// e.g. "(2x^2 + 7x + 1) - (x^2 + 3x + 4)" -> x^2 + 4x - 3.
window.__duo.polySum = function () {
  for (const line of this.promptLatex().slice().reverse()) {
    const A = this.ascii(line)
      .replace(/mathbf|textbf|text|\\|~/g, '').replace(/[{}]/g, '').replace(/\s+/g, '');
    const groups = [...A.matchAll(/([+-])?\(([^()]*)\)/g)];
    if (groups.length < 2) continue;
    const acc = {}; let bad = false;
    groups.forEach((g, gi) => {
      const gs = (gi === 0 ? 1 : (g[1] === '-' ? -1 : 1));
      for (const raw of (g[2].match(/[+-]?[^+-]+/g) || [])) {
        const t = raw.trim(); if (!t) continue;
        const v = (g[2].match(/[a-z]/) || ['x'])[0];
        const m = t.match(new RegExp('^([+-]?)(\\d*)(?:' + v + '(?:\\^?(\\d+))?)?$'));
        if (!m) { bad = true; return; }
        const sign = m[1] === '-' ? -1 : 1;
        const coef = m[2] === '' ? 1 : +m[2];
        const deg = new RegExp(v).test(t) ? (m[3] ? +m[3] : 1) : 0;
        acc[deg] = (acc[deg] || 0) + gs * sign * coef;
      }
    });
    if (!bad && Object.keys(acc).length) return acc;
  }
  return null;
};

// build the slot sequence from the combined polynomial, using "-" when the bank has
// one (the tokens decide whether a negative term is "+ -3" or "- 3")
;'__duo ready';

// ---- factor pairs (unit 155) ----
// "Find the factor pairs of 15" with choices like "3 and 5" — usually multi-select,
// so return every pair whose product matches.
window.__duo.solveFactorPairs = function () {
  const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
  const m = A.match(/factor pairs? of\s*(-?\d+)/i) || A.match(/factors? of\s*(-?\d+)/i);
  if (!m) return null;
  const n = Math.abs(+m[1]);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ch.map(e => this.ascii(e.innerText));
  const idx = [];
  S.forEach((s, i) => {
    const ns = (s.match(/\d+/g) || []).map(Number);
    // innerText is doubled, so take the first two numbers
    if (ns.length >= 2 && ns[0] * ns[1] === n) idx.push(i);
  });
  return idx.length ? { ok: true, idx } : null;
};
(function () {
  const base = window.__duo.solveChoices;
  window.__duo.solveChoices = function () {
    const A = this.ascii(this.promptLatex().join(' '));
    if (/factor pairs?/i.test(A)) {
      const r = this.solveFactorPairs();
      if (r) return r;
    }
    return base.call(this);
  };
})();
;'__duo ready';

// choice innerText is doubled ("(x+3)(x+5)" comes back twice), which broke the
// \duoblank string match whenever the choices had no LaTeX annotations
(function () {
  const half = s => {
    const t = String(s);
    return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2))
      ? t.slice(0, t.length / 2) : t;
  };
  const base = window.__duo.solveBlankChoice;
  window.__duo.solveBlankChoice = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const raw = this.blankRaw(); if (!raw) return r;
    const norm = s => half(this.ascii(s).replace(/\\(mathbf|textbf|text)\s*/g, '').replace(/[~\s{}]/g, ''));
    const want = norm(raw);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const i = ch.findIndex(e => norm(e.innerText) === want);
    return i < 0 ? r : { i, want };
  };
})();
;'__duo ready';

// The guided text accumulates, so "Find the factor pairs of 15" was still present
// when the question had moved on to writing the factored form — and the factor-pair
// branch hijacked it. Gate on the CHOICES looking like "a and b".
(function () {
  const base = window.__duo.solveChoices;
  window.__duo.solveChoices = function () {
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const looksLikePairs = ch.length && ch.every(e => /\d+\s*and\s*\d+/i.test(this.ascii(e.innerText)));
    if (looksLikePairs) {
      const r = this.solveFactorPairs();
      if (r) return r;
    }
    return base.call(this);
  };
})();
;'__duo ready';

// \duoblank{} carries the answer verbatim, so when it resolves to exactly one choice
// it must WIN over everything else. An older multi-select path was returning
// idx:[0,1] here — selecting both, which toggles down to the wrong one.
(function () {
  const base = window.__duo.solveChoices;
  window.__duo.solveChoices = function () {
    if (document.querySelectorAll('[data-test="challenge-choice"]').length) {
      for (const fn of ['solveBlankChoice', 'solveDuoblank']) {
        if (typeof this[fn] !== 'function') continue;
        let r; try { r = this[fn](); } catch (e) { continue; }
        if (r && r.i !== undefined) return { ok: true, idx: [r.i], via: fn };
      }
    }
    return base.call(this);
  };
})();
;'__duo ready';

// ---- algebraic equivalence (unit 155: expand / factor) ----
// Any "which of these equals this expression" question — factored vs expanded,
// either direction — is answered by evaluating both at a few sample values and
// comparing. One rule instead of a solver per form.
window.__duo.solveAlgEquiv = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const half = s => {
    const t = String(s).replace(/\s/g, '');
    return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t;
  };
  const S = ann.length === ch.length ? ann : ch.map(e => half(this.ascii(e.innerText)));

  const sample = f => { try { return [f(2), f(3), f(5)].map(v => Math.round(v * 1e6) / 1e6).join('|'); } catch (e) { return null; } };
  const fns = S.map(s => this.compile(s));
  if (fns.filter(Boolean).length < 2) return null;
  const sigs = fns.map(f => f ? sample(f) : null);

  // the source expression: the last prompt line that compiles and is not a choice
  let want = null;
  for (const line of this.promptLatex().slice().reverse()) {
    const t = this.ascii(line);
    if (!/[a-z]/.test(t) || /select|which|choose|match/i.test(t)) continue;
    const f = this.compile(line); if (!f) continue;
    const sg = sample(f); if (!sg) continue;
    // ignore a line that is itself one of the choices
    if (sigs.includes(sg) && sigs.filter(x => x === sg).length === 1 && S.some(s => this.ascii(s).replace(/\s/g,'') === t.replace(/\s/g,''))) continue;
    want = sg; break;
  }
  if (!want) return null;
  const hits = [];
  sigs.forEach((s, i) => { if (s && s === want) hits.push(i); });
  return hits.length === 1 ? { i: hits[0], want } : null;
};
window.__duo.RULES.splice(2, 0, ['solveAlgEquiv', null]);
;'__duo ready';

// "Create the standard form" of a product: expand (x+4)(x+6) -> x^2 + 10x + 24 and
// fill the token slots. Reuses the slot-filling logic; only the coefficients differ.
window.__duo.polyExpand = function () {
  for (const line of this.promptLatex().slice().reverse()) {
    const A = this.ascii(line)
      .replace(/mathbf|textbf|text|\\|~/g, '').replace(/[{}]/g, '').replace(/\s+/g, '');
    const m = A.match(/^\(([^()]*)\)\(([^()]*)\)$/);
    if (!m) continue;
    const v = (A.match(/[a-z]/) || ['x'])[0];
    const lin = s => {
      const mm = s.match(new RegExp('^([+-]?\\d*)' + v + '([+-]\\d+)?$'));
      if (!mm) return null;
      const a = mm[1] === '' || mm[1] === '+' ? 1 : (mm[1] === '-' ? -1 : +mm[1]);
      return { a, b: mm[2] ? +mm[2] : 0 };
    };
    const p = lin(m[1]), q = lin(m[2]);
    if (!p || !q) continue;
    return { 2: p.a * q.a, 1: p.a * q.b + p.b * q.a, 0: p.b * q.b, v };
  }
  return null;
};
(function () {
  const base = window.__duo.polySum;
  window.__duo.polySum = function () {
    const r = base.call(this);
    if (r) return r;
    const e = this.polyExpand();
    if (!e) return null;
    const { v, ...acc } = e;
    return acc;
  };
})();
;'__duo ready';

// adjacent groups "(x+4)(x+6)" are a PRODUCT; the sum parser was matching them as
// "(A) (B)" and returning A+B. Expansion must be tried first.
(function () {
  const base = window.__duo.polySum;
  window.__duo.polySum = function () {
    const e = this.polyExpand();
    if (e) { const { v, ...acc } = e; return acc; }
    return base.call(this);
  };
})();
;'__duo ready';

// With REAL drags the token lands in the slot under the pointer, so aim at the
// intended slot (cellElements[i]) — not at "the first empty one", which reorders
// the answer as earlier slots fill.
window.__duo.solvePolySum = async function () {
  const d = this.diagram(); if (!d || !d.M.entries) return false;
  const acc = this.polySum(); if (!acc) return false;
  const degs = Object.keys(acc).map(Number).filter(k => acc[k] !== 0).sort((a, b) => b - a);
  if (!degs.length) return false;
  let v = 'x';
  for (const line of this.promptLatex().slice().reverse()) {
    const g = this.ascii(line).match(/\(([^()]*)\)/);
    if (g) { v = (g[1].match(/[a-z]/) || ['x'])[0]; break; }
  }
  const term = k => {
    const c = Math.abs(acc[k]);
    return k === 0 ? String(c) : (c === 1 ? '' : String(c)) + v + (k > 1 ? String(k) : '');
  };
  const toks = () => this.bankTokens();
  const has = t => toks().some(o => o.t === t && o.el.isConnected);
  const seq = [(acc[degs[0]] < 0 ? '-' : '') + term(degs[0])];
  for (let i = 1; i < degs.length; i++) {
    const k = degs[i], neg = acc[k] < 0;
    if (neg && has('-') && has(term(k))) seq.push('-', term(k));
    else if (has('+') && has((neg ? '-' : '') + term(k))) seq.push('+', (neg ? '-' : '') + term(k));
    else if (has(neg ? '-' : '+') && has(term(k))) seq.push(neg ? '-' : '+', term(k));
    else return false;
  }
  if (seq.length !== d.M.entries.length) return false;

  const centre = el => {
    const r = el.getBoundingClientRect(), f = d.f.getBoundingClientRect();
    return [Math.round(f.left + r.left + r.width / 2), Math.round(f.top + r.top + r.height / 2)];
  };
  for (let i = 0; i < seq.length; i++) {
    if (d.M.entries[i] !== null) continue;
    const tok = toks().find(o => o.t === seq[i] && o.el.isConnected);
    const cell = d.M.cellElements && d.M.cellElements[i];
    if (!tok || !cell) return false;
    await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell));
    await this.sleep(340);
  }
  return d.M.entries.every(e => e !== null);
};
;'__duo ready';

// "Find factors of 12 that add to 7" — pair choices like (2,6) / (3,4). Needs both
// the product AND the sum, so the plain factor-pair rule picks the wrong one.
window.__duo.solveFactorSum = function () {
  const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
  const mp = A.match(/factors of\s*(-?\d+)/i) || A.match(/ac\s*=\s*(-?\d+)/i);
  const ms = A.match(/add(?:s)? to\s*(-?\d+)/i) || A.match(/b\s*=\s*(-?\d+)/i);
  if (!mp || !ms) return null;
  const prod = +mp[1], sum = +ms[1];
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const i = ch.findIndex(e => {
    const ns = (half(this.ascii(e.innerText)).match(/-?\d+/g) || []).map(Number);
    return ns.length >= 2 && ns[0] * ns[1] === prod && ns[0] + ns[1] === sum;
  });
  return i < 0 ? { miss: prod + '/' + sum } : { i, want: prod + '/' + sum };
};
window.__duo.RULES.splice(2, 0, ['solveFactorSum', null]);
;'__duo ready';

// ---- second differences (unit 156: quadratic sequences) ----
// "Select the constant second difference between the outputs": read the output
// column from the table and difference it twice.
window.__duo.solveSecondDiff = function () {
  const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
  const wantSecond = /second difference/.test(A);
  const wantFirst = /first difference/.test(A);
  if (!wantSecond && !wantFirst) return null;
  let ys = null;
  const T = this.fnTable();
  if (T && T.length >= 3) ys = T.map(r => r[1]);
  if (!ys) {
    const d = this.diagram();
    if (d && d.M.rows) ys = d.M.rows.map(r => parseFloat(this.ascii(String(r[1]))));
  }
  if (!ys || ys.length < 3 || ys.some(v => isNaN(v))) return null;
  const d1 = ys.slice(1).map((v, i) => v - ys[i]);
  const want = wantFirst ? d1[0] : d1.slice(1).map((v, i) => v - d1[i])[0];
  if (want === undefined || !isFinite(want)) return null;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const i = ch.findIndex(e => parseFloat(half(this.ascii(e.innerText))) === want);
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveSecondDiff', /difference/i]);
;'__duo ready';

// "Select the differences between the outputs" — the choice is the whole list of
// first differences, not a single value.
window.__duo.solveDiffList = function () {
  const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
  if (!/differences? between the outputs|the differences/.test(A)) return null;
  const T = this.fnTable(); if (!T || T.length < 3) return null;
  const ys = T.map(r => r[1]);
  const second = /second difference/.test(A);
  let d = ys.slice(1).map((v, i) => v - ys[i]);
  if (second) d = d.slice(1).map((v, i) => v - d[i]);
  const key = a => a.join(',');
  const want = key(d);
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const i = ch.findIndex(e => {
    const ns = (half(this.ascii(e.innerText)).match(/-?\d+/g) || []).map(Number);
    return key(ns) === want;
  });
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveDiffList', /difference/i]);
;'__duo ready';

// ---- unit 156 fixes, both found by the fail-capture ----
// 1. "linear vs quadratic": classify by the highest power in the formula.
window.__duo.solveLinearQuadratic = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ch.map(e => this.ascii(e.innerText).toLowerCase());
  if (!S.some(s => /linear/.test(s)) || !S.some(s => /quadratic/.test(s))) return null;
  let deg = null;
  for (const line of this.promptLatex().slice().reverse()) {
    const t = this.ascii(line).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    if (!/=/.test(t)) continue;
    const powers = [...t.matchAll(/\^(\d+)/g)].map(m => +m[1]);
    if (powers.length) { deg = Math.max(...powers); break; }
    if (/[a-z]/.test(t.split('=')[1] || '')) { deg = 1; break; }
  }
  if (deg === null) {
    // fall back to the table: a constant second difference means quadratic
    const T = this.fnTable();
    if (T && T.length >= 3) {
      const ys = T.map(r => r[1]);
      const d1 = ys.slice(1).map((v, i) => v - ys[i]);
      const d2 = d1.slice(1).map((v, i) => v - d1[i]);
      deg = d2.every(v => Math.abs(v) < 1e-9) ? 1 : 2;
    }
  }
  if (deg === null) return null;
  const want = deg >= 2 ? 'quadratic' : 'linear';
  const i = S.findIndex(s => s.includes(want));
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveLinearQuadratic', null]);

// 2. typed differences ("Enter the constant first/second difference")
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
      if (/difference/.test(A)) {
        const T = this.fnTable();
        if (T && T.length >= 3) {
          const ys = T.map(r => r[1]);
          const d1 = ys.slice(1).map((v, i) => v - ys[i]);
          const v = /second difference/.test(A) ? d1.slice(1).map((x, i) => x - d1[i])[0] : d1[0];
          if (v !== undefined && isFinite(v)) { const s = String(v); this.type(s); return s; }
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// "Create f(2) = 6" where the slider IS a coefficient inside the expression:
// f(2) = \duodisplay{..}{cur} \cdot 2^2 + 2. Solve for the value that makes the
// expression hit the target — evaluate with the slider at 0 and 1 (it enters
// linearly) and interpolate.
(function () {
  const base = window.__duo.duoGoal;
  window.__duo.duoGoal = function () {
    const g = base.call(this);
    if (g) return g;
    const lines = this.promptLatex();
    const A = this.ascii(lines.join(' '))
      .replace(/emphasis|mathbf|textbf|text|\\/g, ' ').replace(/[{}~]/g, ' ').replace(/\s+/g, ' ');
    const tm = A.match(/create\s*f\(\s*-?\d+\s*\)\s*=\s*(-?[\d.]+)/i);
    if (!tm) return null;
    const target = parseFloat(tm[1]);
    let expr = null;
    for (const line of lines.slice().reverse()) {
      if (/duodisplay/.test(this.ascii(line))) { expr = this.ascii(line); break; }
    }
    if (expr === null) return null;
    const withVal = v => expr
      .replace(/\\duodisplay\{[^{}]*\}\{[^{}]*\}/, '(' + v + ')')
      .replace(/^[^=]*=/, '');
    const f0 = this.evalExpr(withVal(0)), f1 = this.evalExpr(withVal(1));
    if (f0 === null || f1 === null) return null;
    const slope = f1 - f0;
    if (!slope) return null;
    const v = (target - f0) / slope;
    return isFinite(v) ? { kind: 'eq', v: Math.round(v * 1000) / 1000 } : null;
  };
})();
;'__duo ready';

// "Select the x-value for f(x) = 4" — inverse lookup against the table, the drawn
// curve, or a formula. (solveTableInverse only handled the table form.)
window.__duo.solveXForValue = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, '').replace(/\s+/g, '');
  const m = A.match(/f\(x\)&?=(-?[\d.]+)/); if (!m) return null;
  const y = parseFloat(m[1]);
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const xs = ch.map(e => parseFloat(half(this.ascii(e.innerText))));

  const T = this.fnTable();
  if (T) { const hit = T.find(r => r[1] === y); if (hit) { const i = xs.indexOf(hit[0]); if (i >= 0) return { i, want: hit[0] }; } }

  // formula: test each candidate x
  for (const line of this.promptLatex().slice().reverse()) {
    if (!/\(x\)\s*=|y\s*=/.test(this.ascii(line))) continue;
    if (/f\(x\)\s*=\s*-?[\d.]+\s*$/.test(this.ascii(line).replace(/[{}\\]|mathbf|textbf|text/g, ''))) continue;
    const f = this.compile(line); if (!f) continue;
    const hits = [];
    xs.forEach((x, i) => { if (!isNaN(x)) { try { if (Math.abs(f(x) - y) < 1e-9) hits.push(i); } catch (e) {} } });
    if (hits.length === 1) return { i: hits[0], want: xs[hits[0]] };
  }
  // drawn piecewise
  if (this.pieces()) {
    const hits = [];
    xs.forEach((x, i) => { const v = this.pieceAt(x); if (v !== null && Math.abs(v - y) < 0.15) hits.push(i); });
    if (hits.length === 1) return { i: hits[0], want: xs[hits[0]] };
  }
  return null;
};
window.__duo.RULES.splice(2, 0, ['solveXForValue', /x\s*-?\s*value/i]);
;'__duo ready';

// ---- parabolas (unit 157) ----
// Axis of symmetry / vertex, read from the drawn curve by sampling it and finding
// the turning point.
Object.assign(window.__duo, {
  vertexOf() {
    const c = this.curvePath(); if (!c) return null;
    const P = [];
    for (let i = 0; i <= 40; i++) P.push(c.at(i / 40));
    if (P.length < 5) return null;
    let lo = P[0], hi = P[0];
    for (const p of P) { if (p[1] < lo[1]) lo = p; if (p[1] > hi[1]) hi = p; }
    // the turning point is whichever extreme is not at an end of the drawn arc
    const ends = [P[0], P[P.length - 1]];
    const isEnd = p => ends.some(e => Math.abs(e[0] - p[0]) < 0.2 && Math.abs(e[1] - p[1]) < 0.2);
    const v = !isEnd(lo) ? lo : (!isEnd(hi) ? hi : null);
    if (!v) return null;
    return [Math.round(v[0] * 2) / 2, Math.round(v[1] * 2) / 2];
  },

  solveAxisOfSymmetry() {
    const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
    if (!/axis of symmetry|vertex/.test(A)) return null;
    let v = this.vertexOf();
    if (!v) {
      // from a formula: x = -b/2a
      for (const line of this.promptLatex().slice().reverse()) {
        const t = this.ascii(line).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
        const m = t.match(/=(-?\d*)x\^2([+-]\d*)x?([+-]\d+)?/);
        if (!m) continue;
        const a = m[1] === '' || m[1] === '+' ? 1 : (m[1] === '-' ? -1 : +m[1]);
        const b = m[2] === '+' ? 1 : (m[2] === '-' ? -1 : +m[2]);
        if (a) { v = [-b / (2 * a), null]; break; }
      }
    }
    if (!v) return null;
    const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return null;
    const wantVertex = /vertex/.test(A) && !/axis/.test(A);
    const i = ch.findIndex(e => {
      const s = half(this.ascii(e.innerText));
      if (wantVertex) {
        const m = s.match(/\((-?[\d.]+),(-?[\d.]+)\)/);
        return m && parseFloat(m[1]) === v[0] && (v[1] === null || parseFloat(m[2]) === v[1]);
      }
      const m = s.match(/^x=(-?[\d.]+)$/);
      return m && parseFloat(m[1]) === v[0];
    });
    return i < 0 ? { miss: v.join(',') } : { i, want: v.join(',') };
  },
});
window.__duo.RULES.splice(2, 0, ['solveAxisOfSymmetry', /axis of symmetry|vertex/i]);
;'__duo ready';

// A parabola is drawn as SEVERAL class="line" paths (one per branch), so sampling
// only the first gives half the curve and no turning point. Sample them all.
;'__duo ready';

// The drawn arc is CLIPPED, so its lowest sampled point is usually just the edge,
// not the vertex. Fit y = ax^2 + bx + c to the samples and take x = -b/2a.
window.__duo.vertexOf = function () {
  const g = this.grid2D(); if (!g) return null;
  const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
  const pts = [];
  for (const p of d.querySelectorAll('path,line,polyline')) {
    if (!String(p.getAttribute('class') || '').split(/\s+/).includes('line')) continue;
    if (typeof p.getPointAtLength !== 'function') continue;
    let L = 0; try { L = p.getTotalLength(); } catch (e) { continue; }
    const m = p.getScreenCTM(); if (!L || !m) continue;
    for (let i = 0; i <= 30; i++) {
      const q = p.getPointAtLength((i / 30) * L);
      pts.push(g.toXY(fr.left + m.a * q.x + m.c * q.y + m.e, fr.top + m.b * q.x + m.d * q.y + m.f));
    }
  }
  if (pts.length < 8) return null;
  // least-squares quadratic fit
  let S = [0, 0, 0, 0, 0], T = [0, 0, 0];
  for (const [x, y] of pts) {
    S[0] += 1; S[1] += x; S[2] += x * x; S[3] += x * x * x; S[4] += x * x * x * x;
    T[0] += y; T[1] += x * y; T[2] += x * x * y;
  }
  const M = [[S[4], S[3], S[2]], [S[3], S[2], S[1]], [S[2], S[1], S[0]]];
  const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(M); if (!D || !isFinite(D)) return null;
  const sub = (col, v) => M.map((row, r) => row.map((val, c) => (c === col ? v[r] : val)));
  const a = det3(sub(0, [T[2], T[1], T[0]])) / D;
  const b = det3(sub(1, [T[2], T[1], T[0]])) / D;
  const c = det3(sub(2, [T[2], T[1], T[0]])) / D;
  if (!isFinite(a) || Math.abs(a) < 1e-6) return null;
  const vx = -b / (2 * a), vy = a * vx * vx + b * vx + c;
  if (!isFinite(vx) || !isFinite(vy)) return null;
  return [Math.round(vx * 2) / 2, Math.round(vy * 2) / 2];
};
;'__duo ready';

// typed parabola answers: minimum / maximum value (the vertex's y), and the axis or
// vertex x when asked for
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
      if (/minimum value|maximum value|axis of symmetry|vertex/.test(A)) {
        const v = this.vertexOf();
        if (v) {
          const wantY = /minimum value|maximum value|y\s*-?\s*value/.test(A);
          const out = String(wantY ? v[1] : v[0]);
          this.type(out); return out;
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// Range of a parabola given by FORMULA: y = a(x-h)^2 + k has range [k, inf) when
// a > 0 and (-inf, k] when a < 0. Closed bracket, since the vertex is attained.
window.__duo.solveParabolaRange = function () {
  const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
  if (!/range|domain/.test(A)) return null;
  let f = null;
  for (const line of this.promptLatex().slice().reverse()) {
    if (!/\(x\)\s*=|y\s*=/.test(this.ascii(line))) continue;
    const g = this.compile(line); if (!g) continue;
    try { if (isFinite(g(0)) && isFinite(g(1)) && isFinite(g(-1))) { f = g; break; } } catch (e) {}
  }
  if (!f) return null;
  // sample to find the extreme and confirm it is a parabola-like curve
  let best = null, opensUp = true;
  for (let x = -50; x <= 50; x += 0.5) {
    let v; try { v = f(x); } catch (e) { continue; }
    if (!isFinite(v)) continue;
    if (!best || v < best[1]) best = [x, v];
  }
  let worst = null;
  for (let x = -50; x <= 50; x += 0.5) {
    let v; try { v = f(x); } catch (e) { continue; }
    if (!isFinite(v)) continue;
    if (!worst || v > worst[1]) worst = [x, v];
  }
  if (!best || !worst) return null;
  opensUp = Math.abs(best[0]) < 49;               // a finite minimum means it opens up
  const k = Math.round((opensUp ? best[1] : worst[1]) * 1000) / 1000;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const isDomain = /domain/.test(A) && !/range/.test(A);
  const i = ch.findIndex(e => {
    const s = half(this.ascii(e.innerText)).replace(/\s/g, '');
    if (isDomain) return /^\(-?[∞infty]+,[∞infty]+\)$/.test(s.replace(/-infty|infty|∞/g, '∞').replace('(-∞','(-∞'));
    return opensUp ? new RegExp('^\\[' + k + ',(∞|infty)\\)$').test(s)
                   : new RegExp('^\\((-∞|-infty),' + k + '\\]$').test(s);
  });
  return i < 0 ? { miss: k } : { i, want: k };
};
window.__duo.RULES.splice(2, 0, ['solveParabolaRange', /range|domain/i]);
;'__duo ready';

// "Select the match" for a constraint like f(0) = 11: evaluate each candidate
// FORMULA at the given input and keep the one that satisfies it. Generic — works
// for any f(a)=b constraint, not just parabolas.
window.__duo.solveFormulaForConstraint = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, '').replace(/\s+/g, '');
  const m = A.match(/f\((-?[\d.]+)\)=(-?[\d.]+)/); if (!m) return null;
  const x = parseFloat(m[1]), y = parseFloat(m[2]);
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const S = ann.length === ch.length ? ann : ch.map(e => half(this.ascii(e.innerText)));
  const hits = [];
  S.forEach((s, i) => {
    if (!/=/.test(s)) return;
    const f = this.compile(s); if (!f) return;
    try { if (Math.abs(f(x) - y) < 1e-9) hits.push(i); } catch (e) {}
  });
  return hits.length === 1 ? { i: hits[0], want: y } : null;
};
window.__duo.RULES.splice(2, 0, ['solveFormulaForConstraint', null]);
;'__duo ready';

// "Place the point at the vertex" — one draggable point, target from the parabola
// fit (or from the formula when no curve is drawn).
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
    if (/vertex|minimum|maximum/.test(A)) {
      const comps = this.dragComponents();
      if (comps.length === 1) {
        let v = this.vertexOf();
        if (!v) {
          for (const line of this.promptLatex().slice().reverse()) {
            const f = this.compile(line); if (!f) continue;
            let best = null;
            for (let x = -20; x <= 20; x += 0.5) {
              let y; try { y = f(x); } catch (e) { continue; }
              if (isFinite(y) && (!best || y < best[1])) best = [x, y];
            }
            if (best && Math.abs(best[0]) < 19) { v = [Math.round(best[0] * 2) / 2, Math.round(best[1] * 2) / 2]; break; }
          }
        }
        if (v && await this.moveComponent(comps[0], v)) return true;
      }
    }
    return await baseDrag.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
    if (/vertex|minimum|maximum/.test(A) && this.dragComponents().length === 1)
      return { kind: 'vertexpoint', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// "Enter the leading / linear / constant coefficient" of a quadratic
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
      const which = /leading coefficient/.test(A) ? 2
        : (/linear coefficient/.test(A) ? 1
        : (/constant (coefficient|term)/.test(A) ? 0 : null));
      if (which !== null) {
        for (const line of this.promptLatex().slice().reverse()) {
          const t = this.ascii(line).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
          const rhs = (t.split('=')[1] || ''); if (!rhs) continue;
          const v = (rhs.match(/[a-z]/) || ['x'])[0];
          const coef = {};
          for (const raw of (rhs.match(/[+-]?[^+-]+/g) || [])) {
            const m = raw.match(new RegExp('^([+-]?)(\\d*)(?:' + v + '(?:\\^(\\d+))?)?$'));
            if (!m) { continue; }
            const sign = m[1] === '-' ? -1 : 1;
            const c = m[2] === '' ? 1 : +m[2];
            const deg = new RegExp(v).test(raw) ? (m[3] ? +m[3] : 1) : 0;
            coef[deg] = (coef[deg] || 0) + sign * c;
          }
          if (Object.keys(coef).length) {
            const out = String(coef[which] || 0);
            this.type(out); return out;
          }
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// "Graph a function with zeros at -2, 2" where the slider fills a factor:
// y = (x+2)(x - \duodisplay{..}{cur}). Pick the slider value that makes the stated
// zeros true — test candidates by substituting into the factored form.
(function () {
  const base = window.__duo.duoGoal;
  window.__duo.duoGoal = function () {
    const g = base.call(this); if (g) return g;
    const lines = this.promptLatex();
    const A = this.ascii(lines.join(' '))
      .replace(/emphasis|mathbf|textbf|text|\\/g, ' ').replace(/[{}~]/g, ' ').replace(/\s+/g, ' ');
    // a LaTeX \, thin space between the zeros leaves a stray comma: "-2, ,2"
    // "Graph a function with zeros at" and "Graph zeros at" are both used
    // phrasings seen: "zeros at -2, 2", "with zeros -3, 2", "Graph zeros at ..."
    const zm = A.match(/zeros?\s*(?:at\s*)?(-?[\d.]+)\s*,[\s,]*(-?[\d.]+)/i);
    if (!zm) return null;
    const zeros = [parseFloat(zm[1]), parseFloat(zm[2])];
    let expr = null;
    for (const line of lines.slice().reverse()) {
      if (/duodisplay/.test(this.ascii(line))) { expr = this.ascii(line); break; }
    }
    if (!expr) return null;
    for (let v = -10; v <= 10; v += 0.5) {
      const src = expr.replace(/\\duodisplay\{[^{}]*\}\{[^{}]*\}/, '(' + v + ')');
      const f = this.compile(src); if (!f) continue;
      let ok = true;
      for (const z of zeros) { try { if (Math.abs(f(z)) > 1e-9) { ok = false; break; } } catch (e) { ok = false; break; } }
      if (ok) return { kind: 'eq', v };
    }
    return null;
  };
})();
;'__duo ready';

// "Graph the function through (-4,0), (5,0)" — the prompt names the exact points,
// so place each draggable point on one of them (left-to-right).
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const A = this.ascii(this.promptLatex().join(' '))
      .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
    const pts = [...A.matchAll(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)]
      .map(m => [parseFloat(m[1]), parseFloat(m[2])]);
    const comps = this.dragComponents();
    if (/through|passes/i.test(A) && pts.length >= 2 && comps.length === pts.length) {
      const want = pts.slice().sort((a, b) => a[0] - b[0]);
      const cs = comps.slice().sort((a, b) => a.P.x - b.P.x);
      let ok = true;
      for (let i = 0; i < cs.length; i++) ok = (await this.moveComponent(cs[i], want[i])) && ok;
      if (ok) return true;
    }
    return await baseDrag.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    const A = this.ascii(this.promptLatex().join(' ')).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
    const n = [...A.matchAll(/\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)/g)].length;
    if (/through|passes/i.test(A) && n >= 2 && this.dragComponents().length === n)
      return { kind: 'through', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// "Select the x-intercepts" of a parabola: fit the curve and solve a x^2+bx+c = 0,
// or read the roots from a factored formula. Choices are pairs of ordered pairs.
window.__duo.parabolaFit = function () {
  const g = this.grid2D(); if (!g) return null;
  const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
  const pts = [];
  for (const p of d.querySelectorAll('path,line,polyline')) {
    if (!String(p.getAttribute('class') || '').split(/\s+/).includes('line')) continue;
    if (typeof p.getPointAtLength !== 'function') continue;
    let L = 0; try { L = p.getTotalLength(); } catch (e) { continue; }
    const m = p.getScreenCTM(); if (!L || !m) continue;
    for (let i = 0; i <= 30; i++) {
      const q = p.getPointAtLength((i / 30) * L);
      pts.push(g.toXY(fr.left + m.a * q.x + m.c * q.y + m.e, fr.top + m.b * q.x + m.d * q.y + m.f));
    }
  }
  if (pts.length < 8) return null;
  let S = [0, 0, 0, 0, 0], T = [0, 0, 0];
  for (const [x, y] of pts) {
    S[0] += 1; S[1] += x; S[2] += x * x; S[3] += x ** 3; S[4] += x ** 4;
    T[0] += y; T[1] += x * y; T[2] += x * x * y;
  }
  const M = [[S[4], S[3], S[2]], [S[3], S[2], S[1]], [S[2], S[1], S[0]]];
  const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(M); if (!D) return null;
  const sub = (col, v) => M.map((row, r) => row.map((val, c) => (c === col ? v[r] : val)));
  const V = [T[2], T[1], T[0]];
  return { a: det3(sub(0, V)) / D, b: det3(sub(1, V)) / D, c: det3(sub(2, V)) / D };
};
window.__duo.solveXIntercepts = function () {
  // strip the LaTeX first: "\mathbf{x}\textbf{-intercepts}" leaves markup between
  // the x and the word, which defeats a naive /x\s*-?\s*intercepts/ test
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  if (!/x\s*-?\s*intercepts|zeros|roots/.test(A)) return null;
  let roots = null;
  const F = this.parabolaFit();
  if (F && Math.abs(F.a) > 1e-6) {
    const disc = F.b * F.b - 4 * F.a * F.c;
    if (disc >= 0) {
      const r1 = (-F.b - Math.sqrt(disc)) / (2 * F.a), r2 = (-F.b + Math.sqrt(disc)) / (2 * F.a);
      roots = [r1, r2].map(v => Math.round(v * 2) / 2).sort((x, y) => x - y);
    }
  }
  if (!roots) {
    for (const line of this.promptLatex().slice().reverse()) {
      const f = this.compile(line); if (!f) continue;
      const rs = [];
      for (let x = -20; x <= 20; x += 0.5) { try { if (Math.abs(f(x)) < 1e-9) rs.push(x); } catch (e) {} }
      if (rs.length === 2) { roots = rs; break; }
    }
  }
  if (!roots) return null;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const i = ch.findIndex(e => {
    const ps = [...half(this.ascii(e.innerText)).matchAll(/\((-?[\d.]+),(-?[\d.]+)\)/g)]
      .map(m => [parseFloat(m[1]), parseFloat(m[2])]);
    if (ps.length !== 2) return false;
    if (!ps.every(p => Math.abs(p[1]) < 1e-9)) return false;   // must be on the x-axis
    const xs = ps.map(p => p[0]).sort((a, b) => a - b);
    return Math.abs(xs[0] - roots[0]) < 0.3 && Math.abs(xs[1] - roots[1]) < 0.3;
  });
  return i < 0 ? { miss: roots.join(',') } : { i, want: roots.join(',') };
};
window.__duo.RULES.splice(2, 0, ['solveXIntercepts', /intercept|zeros|roots/i]);
;'__duo ready';

// "Select the equation for the zeros of f(x)" — the answer is 0 = <the same
// expression>. Compare each choice's right-hand side to f(x) by evaluation.
window.__duo.solveZerosEquation = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  if (!/equation for the zeros|set .* equal to zero/.test(A)) return null;
  let f = null;
  for (const line of this.promptLatex().slice().reverse()) {
    const t = this.ascii(line);
    if (!/\(x\)\s*=/.test(t)) continue;
    const g = this.compile(t); if (!g) continue;
    try { if (isFinite(g(2)) && isFinite(g(3))) { f = g; break; } } catch (e) {}
  }
  if (!f) return null;
  const sig = g => { try { return [g(2), g(3), g(5)].map(v => Math.round(v * 1e6) / 1e6).join('|'); } catch (e) { return null; } };
  const want = sig(f); if (!want) return null;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ann.length === ch.length ? ann : ch.map(e => half(this.ascii(e.innerText)));
  const hits = [];
  S.forEach((s, i) => {
    // strip \mathbf{...} BEFORE splitting on "=", or the right-hand side keeps the
    // wrapper's closing brace and fails to compile
    const flat = this.ascii(s).replace(/\\(mathbf|textbf|text)\s*/g, '').replace(/^\{|\}$/g, '');
    const rhs = flat.replace(/^[^=]*=/, '');
    const g = this.compile(rhs); if (!g) return;
    if (sig(g) === want) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.splice(2, 0, ['solveZerosEquation', /zeros|equal to zero/i]);
;'__duo ready';

// ---- zeros of a function (unit 158) ----
// "Select the zeros" / "Enter a zero" for any factored or polynomial f: find the
// roots numerically from the compiled function. Covers (x-4)(x+8), (3x-6)(x-1) and
// the linear case alike.
window.__duo.zerosOf = function () {
  for (const line of this.promptLatex().slice().reverse()) {
    const t = this.ascii(line);
    if (!/\(x\)\s*=|y\s*=/.test(t)) continue;
    const f = this.compile(t); if (!f) continue;
    const roots = [];
    // scan on a fine grid and refine each sign change by bisection
    let prev = null;
    for (let x = -30; x <= 30; x += 0.05) {
      let v; try { v = f(x); } catch (e) { continue; }
      if (!isFinite(v)) { prev = null; continue; }
      if (Math.abs(v) < 1e-9) { const r = Math.round(x * 1000) / 1000; if (!roots.some(q => Math.abs(q - r) < 1e-3)) roots.push(r); }
      else if (prev && prev.v * v < 0) {
        let lo = prev.x, hi = x;
        for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; (f(lo) * f(mid) <= 0) ? (hi = mid) : (lo = mid); }
        const r = Math.round(((lo + hi) / 2) * 1000) / 1000;
        if (!roots.some(q => Math.abs(q - r) < 1e-3)) roots.push(r);
      }
      prev = { x, v };
    }
    if (roots.length) return roots.map(r => Math.abs(r - Math.round(r)) < 1e-6 ? Math.round(r) : r).sort((a, b) => a - b);
  }
  return null;
};
window.__duo.solveZeros = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  if (!/zeros?\b|roots?\b/.test(A)) return null;
  const roots = this.zerosOf(); if (!roots) return null;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const key = a => a.slice().sort((x, y) => x - y).join(',');
  const want = key(roots);
  const i = ch.findIndex(e => {
    const ns = (half(this.ascii(e.innerText)).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    return ns.length === roots.length && key(ns) === want;
  });
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveZeros', /zeros?|roots?/i]);

// typed: "Enter a zero of the function"
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' '))
        .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').toLowerCase();
      if (/zeros?\b|roots?\b/.test(A)) {
        const r = this.zerosOf();
        if (r && r.length) { const s = String(r[0]); this.type(s); return s; }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// zeros read off a DRAWN curve (no formula in the prompt): use the parabola fit's
// discriminant, else the x-values where the sampled curve crosses y = 0
(function () {
  const base = window.__duo.zerosOf;
  window.__duo.zerosOf = function () {
    const r = base.call(this);
    if (r && r.length) return r;
    const F = this.parabolaFit();
    if (F && Math.abs(F.a) > 1e-6) {
      const disc = F.b * F.b - 4 * F.a * F.c;
      if (disc >= -0.05) {
        const d = Math.sqrt(Math.max(disc, 0));
        return [(-F.b - d) / (2 * F.a), (-F.b + d) / (2 * F.a)]
          .map(v => Math.round(v * 2) / 2).sort((a, b) => a - b);
      }
    }
    // straight or piecewise: find sign changes in the sampled points
    const g = this.grid2D(); if (!g) return null;
    const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
    const pts = [];
    for (const p of d.querySelectorAll('path,line,polyline')) {
      if (!String(p.getAttribute('class') || '').split(/\s+/).includes('line')) continue;
      if (typeof p.getPointAtLength !== 'function') continue;
      let L = 0; try { L = p.getTotalLength(); } catch (e) { continue; }
      const m = p.getScreenCTM(); if (!L || !m) continue;
      for (let i = 0; i <= 60; i++) {
        const q = p.getPointAtLength((i / 60) * L);
        pts.push(g.toXY(fr.left + m.a * q.x + m.c * q.y + m.e, fr.top + m.b * q.x + m.d * q.y + m.f));
      }
    }
    if (pts.length < 8) return null;
    pts.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if (y0 === 0) out.push(x0);
      else if (y0 * y1 < 0) out.push(x0 + (x1 - x0) * (0 - y0) / (y1 - y0));
    }
    if (!out.length) return null;
    const rounded = out.map(v => Math.round(v * 2) / 2);
    return [...new Set(rounded)].sort((a, b) => a - b);
  };
})();
;'__duo ready';

// ---- factoring helpers (unit 158) ----
// "Find the factors of 12" with single-number choices — multi-select every divisor.
window.__duo.solveFactorsOf = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const m = A.match(/factors of\s*(-?\d+)/); if (!m) return null;
  const n = Math.abs(+m[1]);
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const vals = ch.map(e => parseFloat(half(this.ascii(e.innerText))));
  if (vals.some(v => isNaN(v))) return null;         // pair-style choices: not this rule
  const idx = [];
  vals.forEach((v, i) => { if (v && n % v === 0) idx.push(i); });
  return idx.length ? { ok: true, idx } : null;
};
(function () {
  const base = window.__duo.solveChoices;
  window.__duo.solveChoices = function () {
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const allNumbers = ch.length > 2 && ch.every(e => /^\s*-?\d+\s*$/.test(
      this.ascii(e.innerText).replace(/\s/g, '').replace(/^(.+)\1$/, '$1')));
    if (allNumbers) { const r = this.solveFactorsOf(); if (r) return r; }
    return base.call(this);
  };
})();

// "Identify the sign of the 7x term" in x^2 - 7x + 12 = 0
window.__duo.solveSignOfTerm = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const m = A.match(/sign of the\s*(-?\d*)\s*([a-z](?:\^\d+)?)?\s*term/);
  if (!m) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ch.map(e => this.ascii(e.innerText).toLowerCase());
  if (!S.some(s => /positive/.test(s)) || !S.some(s => /negative/.test(s))) return null;
  const needle = (m[1] || '') + (m[2] || '');
  let sign = null;
  for (const line of this.promptLatex().slice().reverse()) {
    const t = this.ascii(line).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    const at = t.indexOf(needle);
    if (at < 0) continue;
    // walk back to the sign in front of the term
    let j = at - 1;
    while (j >= 0 && /\d/.test(t[j])) j--;
    sign = t[j] === '-' ? 'negative' : 'positive';
    break;
  }
  if (!sign) return null;
  const i = S.findIndex(s => s.includes(sign));
  return i < 0 ? { miss: sign } : { i, want: sign };
};
window.__duo.RULES.splice(2, 0, ['solveSignOfTerm', /sign of/i]);
;'__duo ready';

// Equivalence when both sides are EQUATIONS: "x^2 - 7x + 12 = 0" vs
// "(x-3)(x-4) = 0". Compare the non-trivial side of each.
(function () {
  const sideOf = function (s) {
    const flat = this.ascii(s).replace(/\\(mathbf|textbf|text)\s*/g, '').replace(/^\{|\}$/g, '');
    if (!flat.includes('=')) return flat;
    const parts = flat.split('=');
    const good = parts.find(p => /[a-z]/.test(p) && !/^\s*0\s*$/.test(p));
    return good !== undefined ? good : parts[0];
  };
  const base = window.__duo.solveAlgEquiv;
  window.__duo.solveAlgEquiv = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (ch.length < 2) return null;
    const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
    const half = s => { const t = String(s).replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
    const S = ann.length === ch.length ? ann : ch.map(e => half(this.ascii(e.innerText)));
    const sig = f => { try { return [f(2), f(3), f(5)].map(v => Math.round(v * 1e6) / 1e6).join('|'); } catch (e) { return null; } };
    const fns = S.map(s => this.compile(sideOf.call(this, s)));
    const sigs = fns.map(f => f ? sig(f) : null);
    let want = null;
    for (const line of this.promptLatex().slice().reverse()) {
      const t = this.ascii(line);
      if (!/[a-z]/.test(t) || /select|which|choose|create|match/i.test(t)) continue;
      const f = this.compile(sideOf.call(this, line)); if (!f) continue;
      const sg = sig(f); if (sg) { want = sg; break; }
    }
    if (!want) return null;
    const hits = []; sigs.forEach((s, i) => { if (s && s === want) hits.push(i); });
    return hits.length === 1 ? { i: hits[0], want } : null;
  };
})();
;'__duo ready';

// solveFactorSum matched the STALE "factors of 12 ... add to 7" text and answered a
// later factored-form question with it. Gate on the choices actually being bare
// number pairs like "(3,4)".
(function () {
  const base = window.__duo.solveFactorSum;
  window.__duo.solveFactorSum = function () {
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const pairs = ch.length && ch.every(e => {
      const t = this.ascii(e.innerText).replace(/\s/g, '');
      const h = (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t;
      return /^\(?-?\d+(,|and)-?\d+\)?$/.test(h);
    });
    if (!pairs) return null;
    return base.call(this);
  };
})();
;'__duo ready';

// When duoGoal() resolves, the \duodisplay slider path must win over the older
// generic 'slider' planner, which returns v:null and leaves autoDrag with nothing.
(function () {
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    if (this.duoGoal() && this.duoCur() !== null) return { kind: 'duoslider', from: [0, 0], to: [0, 0] };
    return basePlan.call(this);
  };
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.duoGoal() && this.duoCur() !== null) {
      if (await this.solveDuoSlider()) return true;
    }
    return await baseDrag.call(this);
  };
})();
;'__duo ready';

// "Graph the function f(x) = x(x+2)" with two draggable points: for a quadratic the
// two points are its zeros (both on the x-axis).
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const comps = this.dragComponents();
    if (comps.length === 2 && /graph the function/i.test(this.tex())) {
      const roots = this.zerosOf();
      if (roots && roots.length === 2) {
        const cs = comps.slice().sort((a, b) => a.P.x - b.P.x);
        const want = roots.slice().sort((a, b) => a - b).map(x => [x, 0]);
        let ok = true;
        for (let i = 0; i < 2; i++) ok = (await this.moveComponent(cs[i], want[i])) && ok;
        if (ok) return true;
      }
    }
    return await baseDrag.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const p = basePlan.call(this); if (p) return p;
    if (this.dragComponents().length === 2 && /graph the function/i.test(this.tex())) {
      const r = this.zerosOf();
      if (r && r.length === 2) return { kind: 'graphzeros', from: [0, 0], to: [0, 0] };
    }
    return null;
  };
})();
;'__duo ready';

// "Select the vertex type": a parabola opening up has a MINIMUM vertex, opening
// down a MAXIMUM. Read the sign of the leading coefficient from the fit or formula.
window.__duo.solveVertexType = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const S = ch.map(e => this.ascii(e.innerText).toLowerCase());
  if (!S.some(s => /maximum/.test(s)) || !S.some(s => /minimum/.test(s))) return null;
  let a = null;
  const F = this.parabolaFit();
  if (F && Math.abs(F.a) > 1e-6) a = F.a;
  if (a === null) {
    for (const line of this.promptLatex().slice().reverse()) {
      const f = this.compile(line); if (!f) continue;
      try {
        const v = f(0), l = f(-50), r = f(50);
        if (isFinite(v) && isFinite(l) && isFinite(r)) { a = (l + r) / 2 - v; break; }
      } catch (e) {}
    }
  }
  if (a === null) return null;
  const want = a > 0 ? 'minimum' : 'maximum';
  const i = S.findIndex(s => s.includes(want));
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.splice(2, 0, ['solveVertexType', /vertex type|maximum|minimum/i]);
;'__duo ready';

// ---- break the formulaAB <-> slopeOfFormula cycle ----
// formulaAB falls back to slopeOfFormula for \frac coefficients, and a later
// slopeOfFormula wrapper falls back to formulaAB. Together they recurse until the
// stack blows, which took out plan() entirely. Give each a non-recursing core.
(function () {
  const compile = window.__duo.compile;
  // authoritative: derive m and b numerically, no cross-calls
  window.__duo.formulaAB = function (s) {
    const f = compile.call(this, s);
    if (f) {
      try {
        const b = f(0), m = f(1) - f(0);
        if (isFinite(b) && isFinite(m) && Math.abs((f(2) - f(0)) - 2 * m) < 1e-9) return { m, b };
      } catch (e) {}
    }
    const t = this.ascii(s).replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
    const c = t.match(/^(?:[a-z]\(x\)|y)=(-?\d+(?:\.\d+)?)$/);
    return c ? { m: 0, b: parseFloat(c[1]) } : null;
  };
  window.__duo.slopeOfFormula = function (s) {
    const ab = this.formulaAB(s);
    return ab ? ab.m : null;
  };
})();
;'__duo ready';

// "Create a graph with vertex (-2,-2)" where the slider fills h in
// f(x) = (x - \duodisplay{..}{cur})^2 + k: pick the value whose resulting parabola
// has the stated vertex.
(function () {
  const base = window.__duo.duoGoal;
  window.__duo.duoGoal = function () {
    const g = base.call(this); if (g) return g;
    const lines = this.promptLatex();
    const A = this.ascii(lines.join(' '))
      .replace(/emphasis|mathbf|textbf|text|\\/g, ' ').replace(/[{}~]/g, ' ').replace(/\s+/g, ' ');
    const vm = A.match(/vertex\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i);
    if (!vm) return null;
    const hx = parseFloat(vm[1]), hy = parseFloat(vm[2]);
    let expr = null;
    for (const line of lines.slice().reverse()) {
      if (/duodisplay/.test(this.ascii(line))) { expr = this.ascii(line); break; }
    }
    if (!expr) return null;
    for (let v = -10; v <= 10; v += 0.5) {
      const src = expr.replace(/\\duodisplay\{[^{}]*\}\{[^{}]*\}/, '(' + v + ')');
      const f = this.compile(src); if (!f) continue;
      try {
        if (Math.abs(f(hx) - hy) < 1e-9
            && f(hx - 1) > f(hx) - 1e-9 && f(hx + 1) > f(hx) - 1e-9) return { kind: 'eq', v };
      } catch (e) {}
    }
    return null;
  };
})();
;'__duo ready';

// "Select the y-value when x = 6" for a formula — evaluate it. (solveOutputChoice
// only knew the drawn-piecewise case and the phrase "output/value when".)
window.__duo.solveValueAtX = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').replace(/\s+/g, ' ');
  if (!/(y\s*-?\s*value|value|output)\s*(when|at|for)/i.test(A)) return null;
  const m = A.replace(/\s/g, '').match(/x=(-?[\d.]+)/); if (!m) return null;
  const x = parseFloat(m[1]);
  let y = null;
  for (const line of this.promptLatex().slice().reverse()) {
    const t = this.ascii(line);
    if (!/=/.test(t) || /value|when/i.test(t)) continue;
    const f = this.compile(t); if (!f) continue;
    try { const v = f(x); if (isFinite(v)) { y = v; break; } } catch (e) {}
  }
  if (y === null && this.pieces()) y = this.pieceAt(x);
  if (y === null) { const T = this.fnTable(); const h = T && T.find(r => r[0] === x); if (h) y = h[1]; }
  if (y === null || !isFinite(y)) return null;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const i = ch.findIndex(e => Math.abs(parseFloat(half(this.ascii(e.innerText))) - y) < 1e-9);
  return i < 0 ? { miss: y } : { i, want: y };
};
window.__duo.RULES.splice(2, 0, ['solveValueAtX', /value|output/i]);
;'__duo ready';

// ---- nonlinear systems (unit 160) ----
// "y = x^2 - x - 6" and "y = x + 2" -> the setup is "x + 2 = x^2 - x - 6".
// The old solveSystemSetup only recognised linear right-hand sides.
(function () {
  const base = window.__duo.solveSystemSetup;
  window.__duo.solveSystemSetup = function () {
    const r = base.call(this); if (r && r.i !== undefined) return r;
    // collect every "y = <rhs>" in the prompt
    const rhs = [];
    for (const line of this.promptLatex()) {
      for (const part of this.ascii(line).split(/\\\\/)) {
        const t = part.replace(/mathbf|textbf|text|\\|\{|\}|~|\s/g, '');
        const m = t.match(/^y=(.+)$/);
        if (m && /[a-z]/.test(m[1])) rhs.push(m[1]);
      }
    }
    if (rhs.length < 2) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return null;
    const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
    const S = ch.map(e => half(this.ascii(e.innerText)).replace(/\s/g, ''));
    // the answer has an x on BOTH sides and no lone y
    const i = S.findIndex(s => {
      if (!s.includes('=') || /^y=/.test(s)) return false;
      const [l, r2] = s.split('=');
      return /x/.test(l) && /x/.test(r2);
    });
    return i < 0 ? { miss: rhs.join('=') } : { i, want: rhs.join('=') };
  };
})();
window.__duo.RULES = window.__duo.RULES.filter(r => r[0] !== 'solveSystemSetup');
window.__duo.RULES.splice(2, 0,
  ['solveSystemSetup', /equation to find|intersection|set.*equal|solve the system/i]);
;'__duo ready';

// solveAlgEquiv is greedy — on a "substitute one equation into the other" screen it
// matched a choice by value and beat solveSystemSetup. Put the setup rule ahead of
// it, and have solveAlgEquiv decline when the choices are equations with x on both
// sides (the signature of a setup question).
window.__duo.RULES = window.__duo.RULES.filter(r => r[0] !== 'solveSystemSetup');
window.__duo.RULES.unshift(['solveSystemSetup', /equation to find|intersection|set.*equal|solve the system|substitute/i]);
(function () {
  const base = window.__duo.solveAlgEquiv;
  window.__duo.solveAlgEquiv = function () {
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
    const setupish = ch.length && ch.some(e => {
      const s = half(this.ascii(e.innerText));
      if (!s.includes('=') || /^y=/.test(s)) return false;
      const [l, r] = s.split('=');
      return /x/.test(l) && /x/.test(r);
    });
    if (setupish) return null;
    return base.call(this);
  };
})();
;'__duo ready';

// ---- guided equation rearrangement ----
// "Subtract x and 2 from both sides", "add 4 to both sides", etc. Rather than model
// each operation, keep the choice whose equation is EQUIVALENT to the original:
// (L - R) must be a constant multiple of (origL - origR) across sample points.
window.__duo.solveRearrange = function () {
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const diffOf = src => {
    const flat = this.ascii(src).replace(/\\(mathbf|textbf|text)\s*/g, '').replace(/^\{|\}$/g, '');
    if (!flat.includes('=')) return null;
    const [l, r] = flat.split('=');
    const fl = this.compile(l), fr = this.compile(r);
    if (!fl || !fr) return null;
    try {
      const v = [1, 2, 3, 5].map(x => fl(x) - fr(x));
      return v.every(n => isFinite(n)) ? v : null;
    } catch (e) { return null; }
  };
  // the original equation: the last prompt line with an '=' and an x on each side
  let orig = null;
  for (const line of this.promptLatex().slice().reverse()) {
    const d = diffOf(line);
    if (d && d.some(v => Math.abs(v) > 1e-9)) { orig = d; break; }
  }
  if (!orig) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const ann = [...document.querySelectorAll('[data-test="challenge-choice"] annotation')].map(a => a.textContent);
  const S = ann.length === ch.length ? ann : ch.map(e => half(this.ascii(e.innerText)));
  const prop = (a, b) => {
    let k = null;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(b[i]) < 1e-9) { if (Math.abs(a[i]) > 1e-9) return false; continue; }
      const t = a[i] / b[i];
      if (k === null) k = t; else if (Math.abs(t - k) > 1e-6) return false;
    }
    return k !== null && Math.abs(k) > 1e-9;
  };
  const hits = [];
  S.forEach((s, i) => { const d = diffOf(s); if (d && prop(d, orig)) hits.push(i); });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveRearrange', /both sides|subtract|add .* to|rearrange|standard form/i]);
;'__duo ready';

// zerosOf only looked at lines shaped "f(x) = ..." or "y = ...", so it missed the
// standard "0 = (x - 4)(x + 2)" form that the guided solve produces.
(function () {
  const base = window.__duo.zerosOf;
  window.__duo.zerosOf = function () {
    for (const line of this.promptLatex().slice().reverse()) {
      const flat = this.ascii(line).replace(/\\(mathbf|textbf|text)\s*/g, '').replace(/^\{|\}$/g, '');
      const m = flat.match(/^\s*0\s*=\s*(.+)$/) || flat.match(/^(.+?)\s*=\s*0\s*$/);
      if (!m) continue;
      const f = this.compile(m[1]); if (!f) continue;
      const roots = [];
      let prev = null;
      for (let x = -30; x <= 30; x += 0.05) {
        let v; try { v = f(x); } catch (e) { continue; }
        if (!isFinite(v)) { prev = null; continue; }
        if (Math.abs(v) < 1e-9) { const r = Math.round(x * 1000) / 1000; if (!roots.some(q => Math.abs(q - r) < 1e-3)) roots.push(r); }
        else if (prev && prev.v * v < 0) {
          let lo = prev.x, hi = x;
          for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; (f(lo) * f(mid) <= 0) ? (hi = mid) : (lo = mid); }
          const r = Math.round(((lo + hi) / 2) * 1000) / 1000;
          if (!roots.some(q => Math.abs(q - r) < 1e-3)) roots.push(r);
        }
        prev = { x, v };
      }
      if (roots.length) return roots.map(r => Math.abs(r - Math.round(r)) < 1e-6 ? Math.round(r) : r).sort((a, b) => a - b);
    }
    return base.call(this);
  };
})();
// zeros must outrank the factor-pair rule, whose "(a,b)" choice shape also matches
window.__duo.RULES = window.__duo.RULES.filter(r => r[0] !== 'solveZeros');
window.__duo.RULES.unshift(['solveZeros', /zeros?|roots?|solutions?/i]);
;'__duo ready';

// "Find y when x is -2" — the phrasing uses "is", not "=", so the x= matchers all
// missed it and an earlier handler typed the x value itself.
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' '))
        .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').replace(/\s+/g, ' ');
      const m = A.match(/find\s*y\s*when\s*x\s*(?:is|=)\s*(-?[\d.]+)/i)
        || A.match(/when\s*x\s*is\s*(-?[\d.]+)/i);
      if (m) {
        const x = parseFloat(m[1]);
        for (const line of this.promptLatex().slice().reverse()) {
          const t = this.ascii(line);
          if (!/=/.test(t) || /find|when/i.test(t)) continue;
          const f = this.compile(t); if (!f) continue;
          try { const v = f(x); if (isFinite(v)) { const s = String(Math.round(v * 1000) / 1000); this.type(s); return s; } } catch (e) {}
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// ---- nonlinear intersections (unit 160) ----
// "Plot the intersection points" of y = x^2 and y = 4: solve f(x) = g(x)
// numerically, which covers curve-vs-line as well as line-vs-line.
window.__duo.intersectionsNL = function () {
  const fs = [];
  for (const line of this.promptLatex()) {
    for (const part of this.ascii(line).split(/\\\\/)) {
      // splitting a "\mathbf{y = x^2 \\ y = 4}" line on \\ leaves an unbalanced
      // brace on each half, so strip braces outright rather than just at the ends
      const t = part.replace(/\\(mathbf|textbf|text)\s*/g, '').replace(/[{}]/g, ' ').trim();
      if (!/^y\s*=/.test(t)) continue;
      const f = this.compile(t);
      if (f) fs.push(f);
    }
  }
  if (fs.length < 2) return null;
  const [f, g] = fs;
  const out = []; let prev = null;
  for (let x = -20; x <= 20; x += 0.02) {
    let d; try { d = f(x) - g(x); } catch (e) { prev = null; continue; }
    if (!isFinite(d)) { prev = null; continue; }
    if (Math.abs(d) < 1e-9) out.push(x);
    else if (prev && prev.d * d < 0) {
      let lo = prev.x, hi = x;
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; ((f(lo) - g(lo)) * (f(m) - g(m)) <= 0) ? (hi = m) : (lo = m); }
      out.push((lo + hi) / 2);
    }
    prev = { x, d };
  }
  const uniq = [];
  for (const x of out) {
    const r = Math.round(x * 2) / 2;
    if (!uniq.some(q => Math.abs(q - r) < 1e-6)) uniq.push(r);
  }
  return uniq.length ? uniq.sort((a, b) => a - b).map(x => {
    let y; try { y = f(x); } catch (e) { y = null; }
    return [x, y === null ? null : Math.round(y * 2) / 2];
  }) : null;
};
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
    if (/intersection/.test(A)) {
      const pts = this.intersectionsNL();
      const comps = this.dragComponents();
      if (pts && comps.length === pts.length) {
        const cs = comps.slice().sort((a, b) => a.P.x - b.P.x);
        let ok = true;
        for (let i = 0; i < cs.length; i++) ok = (await this.moveComponent(cs[i], pts[i])) && ok;
        if (ok) return true;
      }
    }
    return await baseDrag.call(this);
  };
  const basePlan = window.__duo.plan;
  window.__duo.plan = function () {
    const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
    if (/intersection/.test(A)) {
      const pts = this.intersectionsNL();
      if (pts && this.dragComponents().length === pts.length)
        return { kind: 'intersectNL', from: [0, 0], to: [0, 0] };
    }
    return basePlan.call(this);
  };
})();
;'__duo ready';

// "Select the number of solutions" for a NONLINEAR system (a parabola and a line
// can meet 0, 1 or 2 times) — count the intersections numerically, or from the two
// drawn curves.
(function () {
  const base = window.__duo.solveIntersectionCountChoice;
  window.__duo.solveIntersectionCountChoice = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    let n = null;
    const pts = this.intersectionsNL();
    if (pts) n = pts.length;
    if (n === null) {
      // both curves drawn: sample each and count sign changes of the difference
      const P = this.pieces();
      if (P && P.length === 2) n = 1;
    }
    if (n === null) return r;
    const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const i = ch.findIndex(e => parseFloat(half(this.ascii(e.innerText))) === n);
    return i < 0 ? r : { i, want: n };
  };
})();
;'__duo ready';

// "Select the intersection point" for a NONLINEAR system — the old chooser only
// solved two straight lines. Route through intersectionsNL and match the pair.
(function () {
  const base = window.__duo.solveIntersectionChoice;
  window.__duo.solveIntersectionChoice = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const pts = this.intersectionsNL(); if (!pts || !pts.length) return r;
    const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const i = ch.findIndex(e => {
      const m = half(this.ascii(e.innerText)).match(/\((-?[\d.]+),(-?[\d.]+)\)/);
      if (!m) return false;
      const x = parseFloat(m[1]), y = parseFloat(m[2]);
      return pts.some(p => Math.abs(p[0] - x) < 0.05 && p[1] !== null && Math.abs(p[1] - y) < 0.05);
    });
    return i < 0 ? r : { i, want: pts.map(p => p.join(',')).join(' ') };
  };
})();
window.__duo.RULES = window.__duo.RULES.filter(r => r[0] !== 'solveIntersectionChoice');
window.__duo.RULES.unshift(['solveIntersectionChoice', /intersection|solution to the system/i]);
;'__duo ready';

// ---- intersections of two DRAWN curves ----
// Graph-only screens give no formula, so sample each class="line" path, build a
// lookup y(x) per curve, and find where their difference changes sign.
window.__duo.drawnIntersections = function () {
  const g = this.grid2D(); if (!g) return null;
  const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
  const curves = [];
  for (const p of d.querySelectorAll('path,line,polyline')) {
    if (!String(p.getAttribute('class') || '').split(/\s+/).includes('line')) continue;
    if (typeof p.getPointAtLength !== 'function') continue;
    let L = 0; try { L = p.getTotalLength(); } catch (e) { continue; }
    const m = p.getScreenCTM(); if (!L || !m) continue;
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const q = p.getPointAtLength((i / 120) * L);
      pts.push(g.toXY(fr.left + m.a * q.x + m.c * q.y + m.e, fr.top + m.b * q.x + m.d * q.y + m.f));
    }
    pts.sort((a, b) => a[0] - b[0]);
    if (pts.length > 4) curves.push(pts);
  }
  if (curves.length !== 2) return null;
  const yAt = (pts, x) => {
    if (x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] >= x) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        if (x1 === x0) return y1;
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
      }
    }
    return null;
  };
  const lo = Math.max(curves[0][0][0], curves[1][0][0]);
  const hi = Math.min(curves[0][curves[0].length - 1][0], curves[1][curves[1].length - 1][0]);
  if (!(hi > lo)) return null;
  const out = []; let prev = null;
  for (let x = lo; x <= hi; x += (hi - lo) / 400) {
    const a = yAt(curves[0], x), b = yAt(curves[1], x);
    if (a === null || b === null) { prev = null; continue; }
    const diff = a - b;
    if (Math.abs(diff) < 0.02) out.push([x, a]);
    else if (prev && prev.d * diff < 0) {
      const t = prev.d / (prev.d - diff);
      const xx = prev.x + (x - prev.x) * t;
      out.push([xx, yAt(curves[0], xx)]);
    }
    prev = { x, d: diff };
  }
  const uniq = [];
  for (const [x, y] of out) {
    const rx = Math.round(x * 2) / 2, ry = y === null ? null : Math.round(y * 2) / 2;
    if (!uniq.some(q => Math.abs(q[0] - rx) < 0.4)) uniq.push([rx, ry]);
  }
  return uniq.length ? uniq.sort((a, b) => a[0] - b[0]) : null;
};
(function () {
  const base = window.__duo.intersectionsNL;
  window.__duo.intersectionsNL = function () {
    const r = base.call(this);
    if (r && r.length) return r;
    return this.drawnIntersections();
  };
})();
;'__duo ready';

// Points read off a drawing land a little off (interpolation + line thickness), so
// match a choice within ~0.6 of a unit rather than demanding equality.
(function () {
  const base = window.__duo.solveIntersectionChoice;
  window.__duo.solveIntersectionChoice = function () {
    const r = base.call(this);
    if (r && r.i !== undefined) return r;
    const pts = this.intersectionsNL(); if (!pts || !pts.length) return r;
    const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (!ch.length) return r;
    const scored = ch.map((e, i) => {
      const m = half(this.ascii(e.innerText)).match(/\((-?[\d.]+),(-?[\d.]+)\)/);
      if (!m) return { i, d: Infinity };
      const x = parseFloat(m[1]), y = parseFloat(m[2]);
      let best = Infinity;
      for (const p of pts) {
        if (p[1] === null) continue;
        best = Math.min(best, Math.abs(p[0] - x) + Math.abs(p[1] - y));
      }
      return { i, d: best };
    }).sort((a, b) => a.d - b.d);
    if (scored[0].d <= 0.7 && (scored.length < 2 || scored[1].d - scored[0].d > 0.3))
      return { i: scored[0].i, want: 'near' };
    return r;
  };
})();
;'__duo ready';

// 1. systems written with \begin{aligned} y &= ... \\ y &= ... : the "&" survived
//    the brace strip and stopped the equations compiling
(function () {
  const base = window.__duo.intersectionsNL;
  window.__duo.intersectionsNL = function () {
    const r = base.call(this);
    if (r && r.length) return r;
    const fs = [];
    for (const line of this.promptLatex()) {
      const cleaned = this.ascii(line)
        .replace(/\\begin\{aligned\}|\\end\{aligned\}/g, ' ')
        .replace(/\\(mathbf|textbf|text)\s*/g, '')
        .replace(/&/g, '')
        .replace(/[{}]/g, ' ');
      for (const part of cleaned.split(/\\\\/)) {
        const t = part.trim();
        if (!/^y\s*=/.test(t)) continue;
        const f = this.compile(t); if (f) fs.push(f);
      }
    }
    if (fs.length < 2) return null;
    const [f, g] = fs;
    const out = []; let prev = null;
    for (let x = -20; x <= 20; x += 0.02) {
      let d; try { d = f(x) - g(x); } catch (e) { prev = null; continue; }
      if (!isFinite(d)) { prev = null; continue; }
      if (Math.abs(d) < 1e-9) out.push(x);
      else if (prev && prev.d * d < 0) {
        let lo = prev.x, hi = x;
        for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; ((f(lo) - g(lo)) * (f(m) - g(m)) <= 0) ? (hi = m) : (lo = m); }
        out.push((lo + hi) / 2);
      }
      prev = { x, d };
    }
    const uniq = [];
    for (const x of out) { const r2 = Math.round(x * 2) / 2; if (!uniq.some(q => Math.abs(q - r2) < 1e-6)) uniq.push(r2); }
    return uniq.length ? uniq.sort((a, b) => a - b).map(x => [x, Math.round(f(x) * 2) / 2]) : null;
  };
})();

// 2. typed "Enter the value when x = -5" for a formula
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' '))
        .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').replace(/\s+/g, ' ');
      if (/enter the (value|output)/i.test(A)) {
        const m = A.replace(/\s/g, '').match(/x=(-?[\d.]+)/);
        if (m) {
          const x = parseFloat(m[1]);
          for (const line of this.promptLatex().slice().reverse()) {
            const t = this.ascii(line);
            if (!/=/.test(t) || /enter|value|when/i.test(t)) continue;
            const f = this.compile(t); if (!f) continue;
            try { const v = f(x); if (isFinite(v)) { const s = String(Math.round(v * 1000) / 1000); this.type(s); return s; } } catch (e) {}
          }
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// ---- sequences (unit 161) ----
// "Select the next term" for 3, 6, 12: detect arithmetic (constant difference) or
// geometric (constant ratio) and extend.
window.__duo.nextTerm = function () {
  for (const line of this.promptLatex().slice().reverse()) {
    const t = this.ascii(line).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
    const ns = (t.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (ns.length < 3) continue;
    const d = ns.slice(1).map((v, i) => v - ns[i]);
    if (d.every(v => Math.abs(v - d[0]) < 1e-9)) return ns[ns.length - 1] + d[0];
    if (ns.every(v => v !== 0)) {
      const q = ns.slice(1).map((v, i) => v / ns[i]);
      if (q.every(v => Math.abs(v - q[0]) < 1e-9)) return ns[ns.length - 1] * q[0];
    }
    // second-difference (quadratic) sequences
    if (d.length >= 2) {
      const d2 = d.slice(1).map((v, i) => v - d[i]);
      if (d2.every(v => Math.abs(v - d2[0]) < 1e-9))
        return ns[ns.length - 1] + d[d.length - 1] + d2[0];
    }
  }
  return null;
};
window.__duo.solveNextTerm = function () {
  const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
  if (!/next term|next number|continues the (pattern|sequence)/.test(A)) return null;
  const v = this.nextTerm(); if (v === null) return null;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const i = ch.findIndex(e => Math.abs(parseFloat(half(this.ascii(e.innerText))) - v) < 1e-9);
  return i < 0 ? { miss: v } : { i, want: v };
};
window.__duo.RULES.unshift(['solveNextTerm', /next term|next number|pattern|sequence/i]);
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
      if (/next term|next number/.test(A)) {
        const v = this.nextTerm();
        if (v !== null) { const s = String(v); this.type(s); return s; }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// \duoblank{} carries the answer verbatim, so for TYPED questions it must outrank
// every heuristic — the sequence handler was reading 15, 3, 45 out of
// "15 \cdot 3 = \duoblank{45}" and typing a made-up next term.
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const raw = this.blankRaw();
      if (raw) {
        let t = this.ascii(raw)
          .replace(/\\(mathbf|textbf|text)\s*/g, '')
          .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
          .replace(/[{}~\s]/g, '');
        if (/^[-+*/().0-9]+$/.test(t)) {
          const v = this.evalExpr(t);
          const out = (v !== null && !/\//.test(t)) ? String(v) : t;
          this.type(out); return out;
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// "Select the common difference" / "common ratio" of a sequence
window.__duo.solveCommonDiff = function () {
  const A = this.ascii(this.promptLatex().join(' '))
    .replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const wantRatio = /common ratio/.test(A);
  const wantDiff = /common difference/.test(A);
  if (!wantRatio && !wantDiff) return null;
  let ns = null;
  for (const line of this.promptLatex().slice().reverse()) {
    const t = this.ascii(line).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
    const v = (t.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (v.length >= 3) { ns = v; break; }
  }
  if (!ns) return null;
  let want;
  if (wantRatio) {
    if (ns.some(v => v === 0)) return null;
    want = ns[1] / ns[0];
  } else want = ns[1] - ns[0];
  if (!isFinite(want)) return null;
  const half = s => { const t = s.replace(/\s/g, ''); return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2)) ? t.slice(0, t.length / 2) : t; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return null;
  const i = ch.findIndex(e => Math.abs(parseFloat(half(this.ascii(e.innerText))) - want) < 1e-9);
  return i < 0 ? { miss: want } : { i, want };
};
window.__duo.RULES.unshift(['solveCommonDiff', /common (difference|ratio)/i]);
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
      if (/common (difference|ratio)/.test(A)) {
        const r = this.solveCommonDiff();
        const v = r && (r.want !== undefined ? r.want : r.miss);
        if (v !== undefined && v !== null) { const s = String(v); this.type(s); return s; }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// "Create the common ratio" for 54, 36, 24, 16 — three token slots make a fraction
// term2 / term1 (e.g. 36 / 54).
window.__duo.solveRatioSlots = async function () {
  const d = this.diagram(); if (!d || !d.M.entries || d.M.entries.length !== 3) return false;
  const A = this.ascii(this.promptLatex().join(' ')).toLowerCase();
  if (!/common ratio|ratio/.test(A)) return false;
  let ns = null;
  for (const line of this.promptLatex().slice().reverse()) {
    const t = this.ascii(line).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ');
    const v = (t.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (v.length >= 2) { ns = v; break; }
  }
  if (!ns) return false;
  const seq = [String(ns[1]), '/', String(ns[0])];
  const centre = el => {
    const r = el.getBoundingClientRect(), f = d.f.getBoundingClientRect();
    return [Math.round(f.left + r.left + r.width / 2), Math.round(f.top + r.top + r.height / 2)];
  };
  for (let i = 0; i < seq.length; i++) {
    if (d.M.entries[i] !== null) continue;
    const tok = this.bankTokens().find(o => o.t === seq[i] && o.el.isConnected);
    const cell = d.M.cellElements && d.M.cellElements[i];
    if (!tok || !cell) return false;
    await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell));
    await this.sleep(340);
  }
  return d.M.entries.every(e => e !== null);
};
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const d = this.diagram();
    if (d && d.M.entries && d.M.entries.some(e => e === null)) {
      if (await this.solveRatioSlots()) return true;
    }
    return await baseDrag.call(this);
  };
})();
;'__duo ready';

// Typed "common ratio" wants an exact value: 27/81 as 1/3, not 0.3333333333333333.
// Emit a reduced fraction whenever the ratio isn't an exact short decimal.
window.__duo.exactFrac = function (ns, i) {
  const a = ns[i + 1], b = ns[i];
  const sc = v => { const s = String(v); const d = s.includes('.') ? s.split('.')[1].length : 0; return d; };
  const p = Math.pow(10, Math.max(sc(a), sc(b)));
  let n = Math.round(a * p), d = Math.round(b * p);
  const g = (x, y) => y ? g(y, x % y) : Math.abs(x);
  const k = g(n, d); n /= k; d /= k;
  if (d < 0) { n = -n; d = -d; }
  return d === 1 ? String(n) : n + '/' + d;
};

// Guided lessons accumulate prompt lines, so /common ratio/ over the whole prompt
// hijacked later steps ("write a recursive formula") and typed a ratio at them.
// Gate on the CURRENT instruction only: the last \textbf line.
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]') &&
        /common ratio/.test(this.curInstruction())) {
      // numbers come from the sequence line, which is the last \mathbf line
      for (const line of this.promptLatex().slice().reverse()) {
        if (!/mathbf/.test(line)) continue;
        const v = (this.ascii(line).replace(/mathbf|textbf|text|\\|\{|\}|~/g, ' ')
                   .match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if (v.length >= 3 && !v.some(x => x === 0)) {
          const s = this.exactFrac(v, 0); this.type(s); return s;
        }
      }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// "First, substitute <v> for <x>" — the choices are literal substitutions
// (f(2) = 3^2 vs f(2) = 2^3). Pick the one whose RHS is the formula's RHS with
// the variable textually replaced, not an evaluated value.
// exponents render as plain digits in innerText (3^2 -> "32"), so drop ^ before comparing
window.__duo.subNorm = function (s) { return String(s).replace(/[{}\\\s^]|mathbf|textbf|text|cdot|\*/g, ''); };
window.__duo.RULES.unshift(['solveSubstitute', /substitut/i]);
;'__duo ready';

// Choice innerText flattens exponents (3^2 reads as "32"), so string-matching a
// substitution step is unreliable. The MathML <annotation> carries real LaTeX —
// read that and compare by VALUE, which covers both the "substitute" step
// (2^3 vs 3^2) and the "expand" step (3*2 vs 3*3).
window.__duo.choiceLatex = function (el) {
  const a = el.querySelector('annotation');
  return a ? a.textContent : this.ascii(el.innerText);
};
;'__duo ready';

// curInstruction only looked at \textbf/\mathbf, so a plain \text step
// ("Select the expanded form.") left it reporting the previous step's wording.

// Guided exponential steps ("substitute", "expand the power", "select the
// expanded form") all reduce to: the last equation line has a value, pick the
// choice with the same value. Beats string matching, which the flattened
// innerText breaks.
window.__duo.solveValueMatch = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  let want = null;
  for (const line of this.promptLatex()) {
    const t = this.ascii(line).replace(/mathbf|textbf|text|\\(?![a-z])|[{}]|~|\s/g, '');
    const q = t.match(/=([^=]+)$/);
    if (!q) continue;
    const g = this.compile(q[1]);
    try { const val = g && g(0); if (isFinite(val)) want = val; } catch (e) {}
  }
  if (want === null) return null;
  const i = ch.findIndex(e => {
    const g = this.compile(this.choiceLatex(e).split('=').pop());
    try { return g && Math.abs(g(0) - want) < 1e-9; } catch (err) { return false; }
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveValueMatch', /expand|substitut|simplif/i]);
;'__duo ready';

// "Substitute V for x" is a LITERAL rewrite, not an evaluation: with f(x)=4^x
// and V=3 the answer is 4^3, and 3^4 is the decoy with a different value, so
// value-matching picks wrong. Compare LaTeX from the MathML annotation instead.
window.__duo.solveSubstitute = function () {
  const m = this.curInstruction().match(/substitut\w*\s+(-?[\d.]+)\s+(?:for|into)\s+([a-z])/);
  if (!m) return null;
  const val = m[1], v = m[2];
  const flat = s => String(s).replace(/mathbf|textbf|text|\\|[{}]|~|\s|cdot/g, '');
  let rhs = null;
  for (const line of this.promptLatex()) {
    const q = flat(this.ascii(line)).match(new RegExp('^[a-z]\\(' + v + '\\)=([^=]+)$'));
    if (q) rhs = q[1];
  }
  if (!rhs) return null;
  const want = rhs.split('').map(c => c === v ? val : c).join('');
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => flat(this.choiceLatex(e)).split('=').pop() === want);
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveSubstitute', /substitut/i]);
;'__duo ready';

// Grid2D exponential graphing: a curve component (options.fOfX) plus one
// draggable point. "Graph an exponential with base 3" against y = 5 * 2^x means
// dragging that point until the curve's base matches. grid.gridToPixel converts
// graph coords to iframe pixels.
window.__duo.gridPoints = function () {
  const d = this.diagram(); if (!d || !d.M.components) return [];
  return [...d.M.components.components.values()]
    .filter(v => v.options && 'x' in v.options && !v.options.isStatic);
};
// base b: the prompt asks for a base, the point sits at (1, current base).
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (/base/.test(this.curInstruction()) && await this.solveGraphBase()) return true;
    return await baseDrag.call(this);
  };
})();
;'__duo ready';

// Grid2D "slider2d": an SVG track with one notch per allowed value and a thumb.
// grid.slider gives {min,max,step}; drag the thumb onto the notch for the value
// the prompt asks for. Nothing in components is draggable for these screens.
window.__duo.slider2d = function () {
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const thumb = doc.querySelector('.slider2d-thumb, [class*="slider2d-thumb"]');
  const notches = [...doc.querySelectorAll('.slider2d-notch, [class*="slider2d-notch"]')];
  const g = d.M.grid;
  if (!thumb || !notches.length || !g || !g.slider) return null;
  return { d, thumb, notches, s: g.slider };
};
window.__duo.setSlider2d = async function (want) {
  const S = this.slider2d(); if (!S) return false;
  const i = Math.round((want - S.s.min) / S.s.step);
  if (i < 0 || i >= S.notches.length) return false;
  // the slider group has a zero-size bounding rect, so getBoundingClientRect is
  // useless here; go through the SVG screen CTM instead.
  const fr = S.d.f.getBoundingClientRect();
  const svg = S.thumb.ownerSVGElement;
  const scr = (el, lx, ly) => {
    const p = svg.createSVGPoint(); p.x = lx; p.y = ly;
    const q = p.matrixTransform(el.getScreenCTM());
    return [Math.round(fr.left + q.x), Math.round(fr.top + q.y)];
  };
  const n = S.notches[i];
  const from = scr(S.thumb, +S.thumb.getAttribute('x') + (+S.thumb.getAttribute('width') || 0) / 2,
                             +S.thumb.getAttribute('y') + (+S.thumb.getAttribute('height') || 0) / 2);
  const to = scr(n, +n.getAttribute('cx'), +n.getAttribute('cy'));
  await this.dragXY(S.thumb, S.d.f, from, to);
  await this.sleep(320);
  return true;
};
;'__duo ready';

(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveGraphBase()) return true;
    return await baseDrag.call(this);
  };
})();
;'__duo ready';

// "Select the match": the subject is a drawn curve and the choices are the
// words linear / quadratic / exponential. Classify by sampling the path:
// constant 2nd difference and a sign change in slope => quadratic, constant
// ratio of successive deltas => exponential, constant slope => linear.
window.__duo.curveKind = function () {
  const c = this.curvePath(); if (!c) return null;
  const P = []; for (let i = 0; i <= 20; i++) P.push(c.at(i / 20));
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  if (xs.some(v => !isFinite(v)) || ys.some(v => !isFinite(v))) return null;
  const d1 = []; for (let i = 1; i < P.length; i++) d1.push((ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]));
  const spread = a => Math.max(...a) - Math.min(...a);
  const scale = Math.max(1e-9, spread(ys));
  if (spread(d1) < 0.05 * Math.max(1, Math.abs(d1[0])) + 1e-6) return 'linear';
  const d2 = []; for (let i = 1; i < d1.length; i++) d2.push(d1[i] - d1[i - 1]);
  const ratios = []; for (let i = 1; i < d1.length; i++) if (Math.abs(d1[i - 1]) > 1e-6) ratios.push(d1[i] / d1[i - 1]);
  const rSpread = ratios.length ? spread(ratios) / Math.max(1e-9, Math.abs(ratios[0])) : Infinity;
  const cSpread = spread(d2) / Math.max(1e-9, Math.abs(d2[0] || 1));
  // an exponential never turns around; a quadratic does (or its slope changes sign)
  const turns = d1.some(v => v > 0) && d1.some(v => v < 0);
  if (turns) return 'quadratic';
  return rSpread < cSpread ? 'exponential' : 'quadratic';
};
window.__duo.RULES.unshift(['solveCurveKind', /select the match|what (kind|type)/i]);
;'__duo ready';

window.__duo.RULES.unshift(['solveCurveKind', /select the (match|function type)|what (kind|type)/i]);

// "Enter the output when x = 2" — evaluate the function given in the prompt.
(function () {
  const prev = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]')) {
      const o = this.solveOutputAt();
      if (o !== null) { const s = String(o); this.type(s); return s; }
    }
    return prev.call(this);
  };
})();
;'__duo ready';

// prompt lines keep stray backslashes/marks after the LaTeX strip, so anchoring
// on ^[a-z]( failed. One shared cleaner for formula extraction.
window.__duo.flatLine = function (line) {
  return this.ascii(line).replace(/mathbf|textbf|emphasis|text|\\|[{}]|~|\s/g, '')
    .replace(/^[^A-Za-z0-9(-]+/, '');
};
window.__duo.solveOutputAt = function () {
  const ins = this.curInstruction();
  const m = ins.match(/(?:output|value)\s+when\s+([a-z])\s*=\s*(-?[\d.]+)/) ||
            ins.match(/find\s+[a-z]\(\s*(-?[\d.]+)\s*\)/);
  if (!m) return null;
  const two = m[2] !== undefined;
  const F = this.formulaIn(two ? m[1] : 'x');
  if (!F) return null;
  let out; try { out = F.f(parseFloat(two ? m[2] : m[1])); } catch (e) { return null; }
  return isFinite(out) ? out : null;
};
// classify from the formula when one is printed; fall back to the drawn curve
window.__duo.solveCurveKind = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase());
  if (!words.some(w => /linear|quadratic|exponential/.test(w))) {
    // same question, numeric choices: "select the value when x = 3"
    const o = this.solveOutputAt();
    if (o === null) return null;
    const i = ch.findIndex(e => Math.abs(parseFloat(this.flatLine(this.choiceLatex(e))) - o) < 1e-9);
    return i < 0 ? null : { i };
  }
  const F = this.formulaIn('x');
  let k = null;
  if (F) {
    const s = F.src.replace(/\s/g, '');
    k = /\^x|\^\{x/.test(s) ? 'exponential' : /x\^2|x\^\{2/.test(s) ? 'quadratic' : 'linear';
  } else k = this.curveKind();
  if (!k) return null;
  const i = words.findIndex(w => w.includes(k));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveCurveKind', /select the (match|function type|value)|what (kind|type)/i]);
;'__duo ready';

// compile() only understood numeric exponents, so exponentials (10^x, 2^{x+1})
// never compiled. Normalize a variable exponent before handing it over.
(function () {
  const base = window.__duo.compile;
  window.__duo.compile = function (src) {
    if (typeof src === 'string' && /\^\s*[a-z{]/.test(src)) {
      const t = src.replace(/\^\{([^{}]*)\}/g, '**($1)').replace(/\^([a-z])/g, '**($1)');
      const g = base.call(this, t);
      if (g) return g;
    }
    return base.call(this, src);
  };
})();
// keep the printed formula even when it will not compile, so the function-type
// classifier can still read its shape
;'__duo ready';

// Some questions put the data in a TABLE inside the diagram iframe rather than
// in the prompt LaTeX: "x f(x) 0 1 1 6 2 36 3 216". Read it as (x, y) pairs.
// "constant factor between outputs" / "common ratio" / "common difference"
window.__duo.solveTableStep = function () {
  const ins = this.curInstruction();
  const wantRatio = /ratio|factor|multipl/.test(ins);
  const wantDiff = /difference|add/.test(ins);
  if (!wantRatio && !wantDiff) return null;
  const P = this.tableXY(); if (!P) return null;
  const ys = P.map(p => p[1]);
  const want = wantRatio ? ys[1] / ys[0] : ys[1] - ys[0];
  if (!isFinite(want)) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => Math.abs(parseFloat(this.flatLine(this.choiceLatex(e))) - want) < 1e-9);
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveTableStep', /constant factor|common (ratio|difference)/i]);
;'__duo ready';

// When no formula is printed, the value table is the function. Look the answer
// up directly, or extrapolate: constant ratio => exponential, constant
// difference => linear.
(function () {
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = base.call(this); if (v !== null) return v;
    const m = this.curInstruction().match(/(?:output|value)\s+when\s+[a-z]\s*=\s*(-?[\d.]+)/);
    return m ? this.tableValueAt(parseFloat(m[1])) : null;
  };
})();
;'__duo ready';

// The table uses a Unicode minus and marks the asked-for cell with "?", so a
// plain \d scan mis-paired the columns. Tokenize numbers and holes together.
window.__duo.tableXY = function () {
  const d = this.diagram(); if (!d) return null;
  const txt = d.f.contentDocument.body.innerText
    .replace(/[−–—]/g, '-').replace(/\s+/g, ' ');
  const toks = txt.match(/-?\d+(?:\.\d+)?|\?/g) || [];
  if (toks.length < 4 || toks.length % 2) return null;
  const P = [];
  for (let i = 0; i < toks.length; i += 2) {
    if (toks[i] === '?') return null;               // unknown x is a different shape
    P.push([Number(toks[i]), toks[i + 1] === '?' ? null : Number(toks[i + 1])]);
  }
  const dx = P[1][0] - P[0][0];
  if (!dx || P.some((p, i) => i && Math.abs(p[0] - P[i - 1][0] - dx) > 1e-9)) return null;
  return P;
};
window.__duo.tableValueAt = function (x) {
  const P = this.tableXY(); if (!P) return null;
  const hit = P.find(p => Math.abs(p[0] - x) < 1e-9);
  if (hit && hit[1] !== null) return hit[1];
  const K = P.filter(p => p[1] !== null);           // ignore the hole when fitting
  if (K.length < 2) return null;
  const rs = [], ds = [];
  for (let i = 1; i < K.length; i++) {
    const n = (K[i][0] - K[i - 1][0]);
    if (K[i - 1][1]) rs.push(Math.pow(K[i][1] / K[i - 1][1], 1 / n));
    ds.push((K[i][1] - K[i - 1][1]) / n);
  }
  const same = a => a.length && a.every(v => Math.abs(v - a[0]) < 1e-9);
  if (same(rs)) return K[0][1] * Math.pow(rs[0], x - K[0][0]);
  if (same(ds)) return K[0][1] + ds[0] * (x - K[0][0]);
  return null;
};
;'__duo ready';

// A value table with a "?" cell made plan() return tablefill even when the
// screen is really multiple choice ("select the value when x = 0"), so the
// choice rules never ran. Multiple choice always wins.
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this);
    if (p && p.kind === 'tablefill' &&
        document.querySelector('[data-test="challenge-choice"]')) return null;
    return p;
  };
})();
;'__duo ready';

// choices are sometimes full equations ("f(0) = 1"), so compare the RHS
(function () {
  const base = window.__duo.solveCurveKind;
  window.__duo.solveCurveKind = function () {
    const r = base.call(this); if (r) return r;
    const o = this.solveOutputAt(); if (o === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - o) < 1e-9; });
    return i < 0 ? null : { i };
  };
})();
;'__duo ready';

// Horizontal asymptote: the limit the function settles on at one end. Take it
// from the formula when there is one, otherwise from the flat tail of the
// drawn curve.
window.__duo.asymptoteY = function () {
  const F = this.formulaIn('x');
  if (F && F.f) {
    for (const xs of [[-40, -30, -20], [40, 30, 20]]) {
      try {
        const v = xs.map(x => F.f(x));
        if (v.every(isFinite) && Math.abs(v[0] - v[1]) < 1e-6 && Math.abs(v[1] - v[2]) < 1e-6)
          return Math.round(v[0] * 1e6) / 1e6;
      } catch (e) {}
    }
    return null;
  }
  const c = this.curvePath(); if (!c) return null;
  for (const ts of [[0, 0.05, 0.1], [1, 0.95, 0.9]]) {
    const v = ts.map(t => c.at(t)[1]);
    if (v.every(isFinite) && Math.abs(v[0] - v[1]) < 0.12 && Math.abs(v[1] - v[2]) < 0.12)
      return Math.round(v[0]);
  }
  return null;
};
window.__duo.solveAsymptote = function () {
  if (!/asymptote/.test(this.curInstruction())) return null;
  const y = this.asymptoteY(); if (y === null) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - y) < 0.2; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveAsymptote', /asymptote/i]);
;'__duo ready';

// "Graph the function f(x) = 8^x": one draggable point pinned to a single x by
// its constraints. Drag it to (x, f(x)).
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveGraphPoint()) return true;
    return await baseDrag.call(this);
  };
})();
;'__duo ready';

// y at a given x, from whichever representation the screen provides.
window.__duo.valueAtX = function (x) {
  const F = this.formulaIn('x');
  if (F && F.f) { try { const v = F.f(x); if (isFinite(v)) return v; } catch (e) {} }
  const t = this.tableValueAt(x); if (t !== null && t !== undefined) return t;
  const c = this.curvePath(); if (!c) return null;
  let best = null, bd = Infinity;
  for (let i = 0; i <= 400; i++) {
    const p = c.at(i / 400);
    const dd = Math.abs(p[0] - x);
    if (dd < bd) { bd = dd; best = p[1]; }
  }
  return bd < 0.25 ? Math.round(best * 100) / 100 : null;
};
window.__duo.solveIntercept = function () {
  const ins = this.curInstruction();
  if (!/y-?intercept/.test(ins)) return null;
  const y = this.valueAtX(0); if (y === null) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - y) < 0.2; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveIntercept', /y-?intercept/i]);
;'__duo ready';

// the LaTeX strip leaves "y -intercept" with a space, so /y-?intercept/ missed
(function () {
  const RE = /y\s*-?\s*intercept/i;
  const base = window.__duo.solveIntercept;
  window.__duo.solveIntercept = function () {
    if (!RE.test(this.curInstruction())) return null;
    const y = this.valueAtX(0); if (y === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - y) < 0.2; });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveIntercept', RE]);
})();
;'__duo ready';

// grid.gridToPixel takes ONE argument, the [x, y] pair, and returns [px, py].
// Calling it as (x, y) threw "Invalid attempt to destructure non-iterable".
;'__duo ready';

// The point's LIVE position is p.x / p.y (options keeps the initial values), and
// the drag must start from the element's real rect — starting from the
// grid-computed position overshoots and the point clamps to its constraint.
window.__duo.dragPointTo = async function (pt, gx, gy) {
  const d = this.diagram(), g = d.M.grid;
  const fr = d.f.getBoundingClientRect();
  const ctm = pt.element.ownerSVGElement.getScreenCTM();
  const at = (x, y) => { const [px, py] = g.gridToPixel([x, y]);
    return [Math.round(fr.left + px + ctm.e), Math.round(fr.top + py + ctm.f)]; };
  const el = pt.element.querySelector('circle') || pt.element;
  const r = el.getBoundingClientRect();
  const from = [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)];
  await this.dragXY(pt.element, d.f, from, at(gx, gy));
  await this.sleep(320);
};
window.__duo.solveGraphPoint = async function () {
  const F = this.formulaIn('x'); if (!F || !F.f) return false;
  const pts = this.gridPoints(); if (pts.length !== 1) return false;
  const p = pts[0], c = p.options.constraints;
  const x = c && c.xMin === c.xMax ? c.xMin : p.x;
  let y; try { y = F.f(x); } catch (e) { return false; }
  if (!isFinite(y)) return false;
  if (c && (y < c.yMin || y > c.yMax)) return false;
  if (Math.abs(p.y - y) < 1e-9) return true;
  await this.dragPointTo(p, x, y);
  return Math.abs(this.gridPoints()[0].y - y) < 1e-9;
};
;'__duo ready';

// A plain graph's axis tick labels ("-5 -4 -3 ... 1 2 3") parse as number pairs,
// so tableXY happily invented a table out of a picture. Require the x / f(x)
// header row that a real value table always has.
(function () {
  const base = window.__duo.tableXY;
  window.__duo.tableXY = function () {
    const d = this.diagram(); if (!d) return null;
    const head = d.f.contentDocument.body.innerText.replace(/\s+/g, ' ').slice(0, 24)
      .normalize('NFKC').toLowerCase();
    if (!/^x\s*(f\(x\)|y)\b/.test(head)) return null;
    return base.call(this);
  };
})();

// "Select the match": choices are candidate functions; keep the one that agrees
// with the drawn curve at several sample x values.
window.__duo.solveMatchCurve = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const c = this.curvePath(); if (!c) return null;
  const S = []; for (let i = 1; i < 10; i++) S.push(c.at(i / 10));
  const ok = [];
  ch.forEach((e, i) => {
    const g = this.compile(this.flatLine(this.choiceLatex(e)).split('=').pop());
    if (!g) return;
    let bad = 0;
    for (const [x, y] of S) { try { if (Math.abs(g(x) - y) > 0.25) bad++; } catch (err) { bad++; } }
    if (!bad) ok.push(i);
  });
  return ok.length === 1 ? { i: ok[0] } : null;
};
window.__duo.RULES.unshift(['solveMatchCurve', /select the match/i]);
;'__duo ready';

// \b after "f(x)" never matches (")" then space are both non-word), so the
// header guard rejected every real table.
(function () {
  const base = window.__duo.tableXY;
  window.__duo.tableXY = function () {
    const d = this.diagram(); if (!d) return null;
    const head = d.f.contentDocument.body.innerText.replace(/\s+/g, ' ').slice(0, 24)
      .normalize('NFKC').toLowerCase();
    if (!/^x\s*(f\(x\)|y)/.test(head)) return null;
    return base.call(this);
  };
})();

// "First, find the initial value when x = 0" — same lookup, different wording.
(function () {
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = base.call(this); if (v !== null && v !== undefined) return v;
    const m = this.curInstruction().match(/(?:initial value|value|output)\s*(?:when|at)?\s*[a-z]?\s*=?\s*(-?[\d.]+)/);
    if (m) { const t = this.valueAtX(parseFloat(m[1])); if (t !== null && t !== undefined) return t; }
    if (/initial value/.test(this.curInstruction())) return this.valueAtX(0);
    return null;
  };
})();
;'__duo ready';

// standalone (the earlier guard wrappers stacked and the innermost one still
// rejected every table) — define tableXY outright, no wrapping
window.__duo.tableXY = function () {
  const d = this.diagram(); if (!d) return null;
  const txt = d.f.contentDocument.body.innerText
    .replace(/[−–—]/g, '-').replace(/\s+/g, ' ');
  const head = txt.slice(0, 24).normalize('NFKC').toLowerCase();
  if (!/^x\s*(f\(x\)|y)/.test(head)) return null;   // axis ticks are not a table
  const toks = txt.match(/-?\d+(?:\.\d+)?|\?/g) || [];
  if (toks.length < 4 || toks.length % 2) return null;
  const P = [];
  for (let i = 0; i < toks.length; i += 2) {
    if (toks[i] === '?') return null;
    P.push([Number(toks[i]), toks[i + 1] === '?' ? null : Number(toks[i + 1])]);
  }
  const dx = P[1][0] - P[0][0];
  if (!dx || P.some((p, i) => i && Math.abs(p[0] - P[i - 1][0] - dx) > 1e-9)) return null;
  return P;
};
;'__duo ready';

// exponential fit from the value table: y = a * r^x
window.__duo.fitTable = function () {
  const P = (this.tableXY() || []).filter(p => p[1] !== null);
  if (P.length < 2) return null;
  const r = Math.pow(P[1][1] / P[0][1], 1 / (P[1][0] - P[0][0]));
  if (!isFinite(r) || r <= 0) return null;
  const a = P[0][1] / Math.pow(r, P[0][0]);
  for (const [x, y] of P) if (Math.abs(a * Math.pow(r, x) - y) > 1e-6 * Math.max(1, Math.abs(y))) return null;
  return { a, r };
};
(function () {
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = base.call(this); if (v !== null && v !== undefined) return v;
    const ins = this.curInstruction();
    const F = this.fitTable();
    if (F && /common ratio|multiplier|constant factor|growth factor/.test(ins)) return F.r;
    if (F && /initial|starting/.test(ins)) return F.a;
    return null;
  };
})();
// "Write the exponential equation" — score each candidate against the table.
window.__duo.solveEquationChoice = function () {
  const P = (this.tableXY() || []).filter(p => p[1] !== null);
  if (P.length < 2) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const ok = [];
  ch.forEach((e, i) => {
    const g = this.compile(this.flatLine(this.choiceLatex(e)).split('=').pop().replace(/cdot/g, '*'));
    if (!g) return;
    let bad = 0;
    for (const [x, y] of P) { try { if (Math.abs(g(x) - y) > 1e-6 * Math.max(1, Math.abs(y))) bad++; } catch (err) { bad++; } }
    if (!bad) ok.push(i);
  });
  return ok.length === 1 ? { i: ok[0] } : null;
};
window.__duo.RULES.unshift(['solveEquationChoice', /equation|formula/i]);
;'__duo ready';

// "Create f(0) = 1" with f(x) = <slider> * 2^x: try each slider value in the
// displayed formula and keep the one that satisfies the requested output.
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveSliderTarget()) return true;
    return await baseDrag.call(this);
  };
})();
;'__duo ready';

// flatLine strips the braces, so \duodisplay{-2}{2} became the ambiguous
// "duodisplay-22". Work from the raw LaTeX where the two arguments are delimited.
window.__duo.solveSliderTarget = async function () {
  const S = this.slider2d(); if (!S) return false;
  let want = null, at = null;
  for (const t of this.promptLatex().map(l => this.flatLine(l))) {
    const m = t.match(/f\((-?[\d.]+)\)=(-?[\d.]+)$/);
    if (m) { at = parseFloat(m[1]); want = parseFloat(m[2]); }
  }
  if (want === null) return false;
  const raw = this.promptLatex().find(l => /duodisplay/.test(this.ascii(l)));
  if (!raw) return false;
  for (let k = S.s.min; k <= S.s.max; k += S.s.step) {
    const body = this.ascii(raw)
      .replace(/\\duodisplay\{[^{}]*\}\{[^{}]*\}/g, '(' + k + ')')
      .replace(/\\mathbf|\\textbf|\\text|\\cdot/g, m => m === '\\cdot' ? '*' : '')
      .replace(/[{}\s]/g, '')
      .split('=').pop();
    const g = this.compile(body);
    if (!g) continue;
    let v; try { v = g(at); } catch (e) { continue; }
    if (isFinite(v) && Math.abs(v - want) < 1e-9) return await this.setSlider2d(k);
  }
  return false;
};
;'__duo ready';

// intercepts are sometimes offered as points, not bare values: (0, 2)
window.__duo.choicePair = function (el) {
  const m = this.flatLine(this.choiceLatex(el)).match(/\((-?[\d.]+),(-?[\d.]+)\)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
};
(function () {
  const RE = /y\s*-?\s*intercept/i;
  window.__duo.solveIntercept = function () {
    if (!RE.test(this.curInstruction())) return null;
    const y = this.valueAtX(0); if (y === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    let i = ch.findIndex(e => { const p = this.choicePair(e);
      return p && Math.abs(p[0]) < 1e-9 && Math.abs(p[1] - y) < 0.2; });
    if (i < 0) i = ch.findIndex(e => { const v = this.choiceValue(e);
      return v !== null && this.choicePair(e) === null && Math.abs(v - y) < 0.2; });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveIntercept', RE]);
})();
;'__duo ready';

// "Create a growth factor of 4" / "with base 3" — the target is stated outright
// and goes straight onto the slider.
window.__duo.solveGraphBase = async function () {
  const A = this.promptLatex().map(l => this.flatLine(l)).join(' ');
  const m = A.match(/(?:base|growthfactor|decayfactor|commonratio|multiplier)of?(-?[\d.]+)/i);
  if (!m) return false;
  return await this.setSlider2d(parseFloat(m[1]));
};
;'__duo ready';

// "Select the growth factor" — same quantity as the common ratio, read off the
// value table or the printed a * b^x formula.
window.__duo.growthFactor = function () {
  const F = this.fitTable(); if (F) return F.r;
  const src = this.formulaIn('x'); if (!src) return null;
  const m = src.src.replace(/cdot/g, '*').match(/(-?[\d.]+)\s*\*\*?\s*\(?x/) ||
            src.src.match(/(-?[\d.]+)\^x/);
  return m ? parseFloat(m[1]) : null;
};
(function () {
  const RE = /(growth|decay)\s*factor|common\s*ratio|multiplier|constant\s*factor/i;
  const base = window.__duo.solveTableStep;
  window.__duo.solveTableStep = function () {
    const r = base.call(this); if (r) return r;
    if (!RE.test(this.curInstruction())) return null;
    const g = this.growthFactor(); if (g === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - g) < 1e-9; });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveTableStep', RE]);
})();
;'__duo ready';

// flatLine leaves \cdot as the bare word "cdot", which never compiled
window.__duo.formulaIn = function (v) {
  v = v || 'x';
  let f = null, src = null;
  for (const line of this.promptLatex()) {
    const t = this.flatLine(line);
    const q = t.match(new RegExp('^(?:[a-z]\\(' + v + '\\)|y)=([^=]+)$'));
    if (q) { src = q[1]; const g = this.compile(src.replace(/cdot|times/g, '*')); if (g) f = g; }
  }
  return src ? { f, src } : null;
};
;'__duo ready';

// "f(x) = 6 \cdot 6^x" is a \mathbf line but contains letters ("cdot"), so it
// was winning over the real instruction. Prefer \text/\textbf; \mathbf only as
// a fallback.
window.__duo.curInstruction = function () {
  const L = this.promptLatex();
  const pick = re => {
    for (let i = L.length - 1; i >= 0; i--) {
      if (!re.test(L[i])) continue;
      const t = this.ascii(L[i]).replace(/mathbf|textbf|emphasis|text|\\|[{}]|~/g, ' ');
      if (/[a-z]{3}/i.test(t.replace(/cdot|frac|sqrt|times/g, ''))) return t.replace(/\s+/g, ' ').trim().toLowerCase();
    }
    return null;
  };
  return pick(/\\text(bf)?\{/) || pick(/mathbf/) ||
         this.ascii(L[L.length - 1] || '').toLowerCase();
};
;'__duo ready';

// Reading the curve at a single nearest sample is fragile on a steep
// exponential. Fit y = a * b^x over many samples and use the fit instead.
window.__duo.fitCurveExp = function () {
  const c = this.curvePath(); if (!c) return null;
  const P = []; for (let i = 0; i <= 60; i++) { const p = c.at(i / 60); if (isFinite(p[0]) && p[1] > 0) P.push(p); }
  if (P.length < 6) return null;
  // least squares on ln y = ln a + x ln b
  let sx = 0, sy = 0, sxx = 0, sxy = 0; const n = P.length;
  for (const [x, y] of P) { const l = Math.log(y); sx += x; sy += l; sxx += x * x; sxy += x * l; }
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const b0 = (sy - m * sx) / n;
  const a = Math.exp(b0), r = Math.exp(m);
  if (!isFinite(a) || !isFinite(r)) return null;
  for (const [x, y] of P) if (Math.abs(a * Math.pow(r, x) - y) > 0.35 + 0.1 * Math.abs(y)) return null;
  return { a: Math.round(a * 100) / 100, r: Math.round(r * 100) / 100 };
};
(function () {
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/initial|starting/.test(ins)) {
      const T = this.fitTable(); if (T) return T.a;
      const F = this.formulaIn('x'); if (F && F.f) { try { const v = F.f(0); if (isFinite(v)) return v; } catch (e) {} }
      const C = this.fitCurveExp(); if (C) return C.a;
    }
    return base.call(this);
  };
  const bg = window.__duo.growthFactor;
  window.__duo.growthFactor = function () {
    const v = bg.call(this); if (v !== null) return v;
    const C = this.fitCurveExp(); return C ? C.r : null;
  };
})();
;'__duo ready';

// \frac{1}{2} survives only in the raw LaTeX — flatLine strips the braces and
// turns it into "frac12". Compile the raw text first.
window.__duo.choiceValue = function (el) {
  const raw = this.choiceLatex(el).split('=').pop()
    .replace(/\\mathbf|\\textbf|\\text/g, '').replace(/\\cdot|\\times/g, '*');
  const g = this.compile(raw);
  if (g) { try { const v = g(0); if (isFinite(v)) return v; } catch (e) {} }
  const t = this.flatLine(this.choiceLatex(el)).split('=').pop();
  const h = t.replace(/frac(-?\d+(?:\.\d+)?)(-?\d+(?:\.\d+)?)$/, '($1)/($2)');
  const g2 = this.compile(h);
  if (g2) { try { const v = g2(0); if (isFinite(v)) return v; } catch (e) {} }
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
};
;'__duo ready';

// "Complete the pattern": rows alternate formula / its base, one base missing.
// The blank follows its own formula, so read the base out of that formula.
window.__duo.solvePattern = function () {
  if (!/complete the pattern/.test(this.curInstruction())) return null;
  const L = this.promptLatex();
  let want = null;
  for (let i = 0; i < L.length; i++) {
    if (this.flatLine(L[i]) !== '') continue;
    const prev = this.ascii(L[i - 1] || '');
    const m = prev.match(/\\left\((.+?)\\right\)\s*\^/) || prev.match(/\(([^()]+)\)\s*\^/);
    if (!m) continue;
    const g = this.compile(m[1]);
    if (g) { try { const v = g(0); if (isFinite(v)) { want = v; break; } } catch (e) {} }
  }
  if (want === null) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - want) < 1e-9; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solvePattern', /complete the pattern/i]);
;'__duo ready';

// Transformations: "Graph g(x) = f(x) + 2" against a display line
// "g(x) = f(x) + \duodisplay{-2}{0}" — the slider holds the shift, and the
// wanted value is the constant in the instruction.
(function () {
  const baseDrag = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveShiftSlider()) return true;
    return await baseDrag.call(this);
  };
})();
;'__duo ready';

// the goal line reads "Graphg(x)=f(x)+2" after flattening, so anchoring at ^ failed
;'__duo ready';

// Two curves drawn (f and g): measure the constant vertical gap between them
// and pick the transformation choice that states it.
window.__duo.allCurves = function () {
  const g = this.grid2D(); if (!g) return [];
  const doc = g.f.contentDocument, fr = g.f.getBoundingClientRect();
  return [...doc.querySelectorAll('path,polyline')]
    .filter(p => String(p.getAttribute('class') || '').split(/\s+/).includes('line'))
    .map(p => {
      let L = 0; try { L = p.getTotalLength(); } catch (e) { return null; }
      const m = p.getScreenCTM(); if (!L || !m) return null;
      return t => { const q = p.getPointAtLength(t * L);
        return g.toXY(fr.left + m.a * q.x + m.c * q.y + m.e, fr.top + m.b * q.x + m.d * q.y + m.f); };
    }).filter(Boolean);
};
window.__duo.solveTransform = function () {
  if (!/transformation/.test(this.curInstruction())) return null;
  let k = this.curveGap();
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (k === null) return null;
  const val = e => { const m = this.flatLine(this.choiceLatex(e)).match(/\(x\)([+-])(\d+(?:\.\d+)?)/);
    return m ? (m[1] === '-' ? -1 : 1) * parseFloat(m[2]) : null; };
  // the gap sign depends on which path the DOM lists first; accept either
  let i = ch.findIndex(e => val(e) === k);
  if (i < 0) i = ch.findIndex(e => val(e) === -k);
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveTransform', /transformation/i]);
;'__duo ready';

// \left( \right) survive flatLine as the words "left"/"right", so "g(x)=f(x)+3"
// never matched. Strip the LaTeX sizing/spacing words before pattern matching.
window.__duo.solveShiftSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  for (const line of this.promptLatex()) {
    const t = this.plainMath(line);
    const m = t.match(/([a-z])\(x\)=([a-z])\(x\)([+-])(\d+(?:\.\d+)?)/);
    if (m && m[1] !== m[2]) return await this.setSlider2d((m[3] === '-' ? -1 : 1) * parseFloat(m[4]));
    const h = t.match(/([a-z])\(x\)=([a-z])\(x([+-])(\d+(?:\.\d+)?)\)/);
    if (h && h[1] !== h[2]) return await this.setSlider2d((h[3] === '-' ? -1 : 1) * parseFloat(h[4]));
  }
  return false;
};
;'__duo ready';

// Several autoDrag wrappers each set the slider in turn, so a later one undid
// the correct value set by an earlier one. Single dispatcher: first hit wins.
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d()) {
      for (const fn of ['solveShiftSlider', 'solveSliderTarget', 'solveGraphBase']) {
        if (await this[fn]()) return true;
      }
    }
    if (await this.solveGraphPoint()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// curveGap was nearest-sample matching with a tight tolerance and often gave up.
// Sample densely and interpolate the second curve at the first curve's x values.
window.__duo.curveGap = function () {
  const C = this.allCurves(); if (C.length !== 2) return null;
  const dense = at => { const P = []; for (let i = 0; i <= 200; i++) { const p = at(i / 200); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); } return P.sort((a, b) => a[0] - b[0]); };
  const A = dense(C[0]), B = dense(C[1]);
  if (A.length < 10 || B.length < 10) return null;
  const interp = (P, x) => {
    if (x < P[0][0] || x > P[P.length - 1][0]) return null;
    for (let i = 1; i < P.length; i++) if (P[i][0] >= x) {
      const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return null;
  };
  const ds = [];
  for (let i = 0; i < A.length; i += 4) { const y = interp(B, A[i][0]); if (y !== null) ds.push(y - A[i][1]); }
  if (ds.length < 8) return null;
  ds.sort((a, b) => a - b);
  const med = ds[Math.floor(ds.length / 2)];
  const good = ds.filter(d => Math.abs(d - med) < 0.35);
  if (good.length < ds.length * 0.7) return null;
  return Math.round(med);
};
;'__duo ready';

// Transformed functions stated in the prompt: f(x) = 7x - 5, g(x) = f(x) + 3.
// Build g from f and answer questions about g (its value, or its equation).
window.__duo.solveTransformedValue = function () {
  const T = this.transformed(); if (!T) return null;
  const ins = this.curInstruction();
  const m = ins.match(new RegExp(T.gname + '\\s*\\(\\s*(-?[\\d.]+)\\s*\\)'));
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (m) {
    let want; try { want = T.g(parseFloat(m[1])); } catch (e) { return null; }
    if (!isFinite(want)) return null;
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - want) < 1e-9; });
    return i < 0 ? null : { i };
  }
  // "select the equation for g(x)": test each candidate against g
  if (/equation/.test(ins)) {
    const xs = [-2, -1, 0, 1, 2, 3];
    const ok = [];
    ch.forEach((e, i) => {
      const c = this.compile(this.flatLine(this.choiceLatex(e)).split('=').pop().replace(/cdot/g, '*'));
      if (!c) return;
      let bad = 0;
      for (const x of xs) { try { if (Math.abs(c(x) - T.g(x)) > 1e-6) bad++; } catch (err) { bad++; } }
      if (!bad) ok.push(i);
    });
    return ok.length === 1 ? { i: ok[0] } : null;
  }
  // "select the vertical shift from f to g"
  if (/shift/.test(ins) && T.k.out !== undefined) {
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - T.k.out) < 1e-9; });
    return i < 0 ? null : { i };
  }
  return null;
};
window.__duo.RULES.unshift(['solveTransformedValue', /value of|equation for|shift from/i]);
;'__duo ready';

// an aligned block puts both definitions on one flattened line:
// "f(x)=7x-5g(x)=f(x)+3" — split before each "<letter>(x)=" before parsing
window.__duo.mathParts = function () {
  const out = [];
  for (const line of this.promptLatex()) {
    for (const part of this.plainMath(line).split(/(?=[a-z]\(x\)=)/)) {
      const t = part.trim(); if (t) out.push(t);
    }
  }
  return out;
};
window.__duo.transformed = function () {
  let f = null, k = null, gname = 'g';
  for (const t of this.mathParts()) {
    const q = t.match(/^([a-z])\(x\)=([^=]+)$/); if (!q) continue;
    const s = q[2].match(/^([a-z])\(x\)([+-])(\d+(?:\.\d+)?)$/);
    const m = q[2].match(/^([a-z])\(x([+-])(\d+(?:\.\d+)?)\)$/);
    if (s) { gname = q[1]; k = { out: (s[2] === '-' ? -1 : 1) * parseFloat(s[3]) }; continue; }
    if (m) { gname = q[1]; k = { in: (m[2] === '-' ? -1 : 1) * parseFloat(m[3]) }; continue; }
    const g = this.compile(q[2].replace(/cdot|times/g, '*')); if (g) f = g;
  }
  if (!f || !k) return null;
  const g = k.out !== undefined ? (x => f(x) + k.out) : (x => f(x + k.in));
  return { f, g, k, gname };
};
;'__duo ready';

// stripping the bare word "vert" also ate the "vert" inside "vertical".
// Remove the LaTeX words only where they stand alone as commands.
window.__duo.plainMath = function (line) {
  return this.ascii(line)
    .replace(/\\(mathbf|textbf|text|emphasis|left|right|vert|cdot|times|begin|end)\b/g,
             m => (m === '\\cdot' || m === '\\times') ? '*' : '')
    .replace(/\{aligned\}|\{array\}|[{}&~,\s\\]/g, '')
    .replace(/^[^A-Za-z0-9(-]+/, '');
};
;'__duo ready';

// shifts are also stated in words: "g(x) is 12 units above f(x)"
window.__duo.statedShift = function () {
  for (const t of this.mathParts().concat([this.curInstruction()])) {
    const m = t.replace(/\s/g, '').match(/is(-?\d+(?:\.\d+)?)unitsa?(above|below|up|down)/i);
    if (m) return (/below|down/i.test(m[2]) ? -1 : 1) * parseFloat(m[1]);
  }
  return null;
};
(function () {
  const base = window.__duo.solveShiftSlider;
  window.__duo.solveShiftSlider = async function () {
    if (base && await base.call(this)) return true;
    const k = this.statedShift();
    return k === null ? false : await this.setSlider2d(k);
  };
  const bv = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const r = bv.call(this); if (r) return r;
    if (!/shift/.test(this.curInstruction())) return null;
    const k = this.statedShift() !== null ? this.statedShift() : this.curveGap();
    if (k === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - k) < 1e-9; });
    return i < 0 ? null : { i };
  };
  const bt = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = bt.call(this); if (v !== null && v !== undefined) return v;
    if (/shift/.test(this.curInstruction())) {
      const k = this.statedShift() !== null ? this.statedShift() : this.curveGap();
      if (k !== null) return k;
    }
    return null;
  };
})();
;'__duo ready';

// "Create the transformation of f(x) to g(x)" with token slots: assemble
// g(x) = f(x) + 12 from the bank (which also holds decoys like h(x)).
window.__duo.solveBuildTransform = async function () {
  const d = this.diagram(); if (!d || !d.M.entries || d.M.entries.length !== 5) return false;
  const k = this.statedShift(); if (k === null) return false;
  const names = (this.mathParts().join(' ').match(/([a-z])\(x\)/g) || [])
    .map(s => s[0]).filter((v, i, a) => a.indexOf(v) === i);
  if (names.length < 2) return false;
  const [gn, fn] = names;                        // "g(x) is 12 units above f(x)"
  const seq = [gn + '(x)', '=', fn + '(x)', k < 0 ? '-' : '+', String(Math.abs(k))];
  const fr = d.f.getBoundingClientRect();
  const centre = el => { const r = el.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  for (let i = 0; i < seq.length; i++) {
    if (d.M.entries[i] !== null) continue;
    const tok = this.bankTokens().find(o => o.t.replace(/\s/g, '') === seq[i] && o.el.isConnected);
    const cell = d.M.cellElements && d.M.cellElements[i];
    if (!tok || !cell) return false;
    await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell));
    await this.sleep(320);
  }
  return d.M.entries.every(e => e !== null);
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveBuildTransform()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// name order must come from the shift sentence ("g(x) is 12 units above f(x)"),
// not from the title line, which lists f first and built the equation backwards
window.__duo.shiftNames = function () {
  for (const t of this.mathParts().concat([this.curInstruction()])) {
    const s = t.replace(/\s/g, '');
    const m = s.match(/([a-z])\(x\)is-?\d+(?:\.\d+)?unitsa?(?:above|below|up|down)([a-z])\(x\)/i);
    if (m) return [m[1], m[2]];
  }
  return null;
};
(function () {
  const base = window.__duo.solveBuildTransform;
  window.__duo.solveBuildTransform = async function () {
    const d = this.diagram(); if (!d || !d.M.entries || d.M.entries.length !== 5) return false;
    const k = this.statedShift(); const N = this.shiftNames();
    if (k === null || !N) return await base.call(this);
    const seq = [N[0] + '(x)', '=', N[1] + '(x)', k < 0 ? '-' : '+', String(Math.abs(k))];
    const fr = d.f.getBoundingClientRect();
    const centre = el => { const r = el.getBoundingClientRect();
      return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
    for (let i = 0; i < seq.length; i++) {
      if (d.M.entries[i] !== null) continue;
      const tok = this.bankTokens().find(o => o.t.normalize('NFKC').replace(/\s/g, '') === seq[i] && o.el.isConnected);
      const cell = d.M.cellElements && d.M.cellElements[i];
      if (!tok || !cell) return false;
      await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell));
      await this.sleep(320);
    }
    return d.M.entries.every(e => e !== null);
  };
})();
;'__duo ready';

// If autoDrag runs twice on one screen the second drag moves the thumb again and
// undoes a correct answer (and CHECK goes back to aria-disabled). Read the
// current value first and do nothing when it already matches.
window.__duo.sliderValue = function () {
  const S = this.slider2d(); if (!S) return null;
  const tx = +S.thumb.getAttribute('x') + (+S.thumb.getAttribute('width') || 0) / 2;
  let bi = 0, bd = Infinity;
  S.notches.forEach((n, i) => { const d = Math.abs(+n.getAttribute('cx') - tx); if (d < bd) { bd = d; bi = i; } });
  return S.s.min + bi * S.s.step;
};
(function () {
  const base = window.__duo.setSlider2d;
  window.__duo.setSlider2d = async function (want) {
    const cur = this.sliderValue();
    if (cur !== null && Math.abs(cur - want) < 1e-9) return true;
    return await base.call(this, want);
  };
})();
;'__duo ready';

// solveShiftSlider walked raw lines, but both definitions often share one line;
// mathParts already splits them.
window.__duo.solveShiftSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  for (const t of this.mathParts()) {
    const m = t.match(/^([a-z])\(x\)=([a-z])\(x\)([+-])(\d+(?:\.\d+)?)$/);
    if (m && m[1] !== m[2]) return await this.setSlider2d((m[3] === '-' ? -1 : 1) * parseFloat(m[4]));
    const h = t.match(/^([a-z])\(x\)=([a-z])\(x([+-])(\d+(?:\.\d+)?)\)$/);
    if (h && h[1] !== h[2]) return await this.setSlider2d((h[3] === '-' ? -1 : 1) * parseFloat(h[4]));
  }
  const k = this.statedShift();
  return k === null ? false : await this.setSlider2d(k);
};
;'__duo ready';

// The no-op guard left CHECK disabled: the widget only enables it after a real
// pointer interaction. Always drag; guard against re-solving the same screen by
// remembering a fingerprint of it instead.
window.__duo.setSlider2d = async function (want) {
  const S = this.slider2d(); if (!S) return false;
  const i = Math.round((want - S.s.min) / S.s.step);
  if (i < 0 || i >= S.notches.length) return false;
  const fr = S.d.f.getBoundingClientRect();
  const svg = S.thumb.ownerSVGElement;
  const scr = (lx, ly) => { const p = svg.createSVGPoint(); p.x = lx; p.y = ly;
    const q = p.matrixTransform(svg.getScreenCTM());
    return [Math.round(fr.left + q.x), Math.round(fr.top + q.y)]; };
  const n = S.notches[i];
  const from = scr(+S.thumb.getAttribute('x') + (+S.thumb.getAttribute('width') || 0) / 2,
                   +S.thumb.getAttribute('y') + (+S.thumb.getAttribute('height') || 0) / 2);
  const to = scr(+n.getAttribute('cx'), +n.getAttribute('cy'));
  await this.dragXY(S.thumb, S.d.f, from, to);
  await this.sleep(320);
  return true;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    const key = this.promptLatex().join('|').slice(0, 200);
    if (this.__dragKey === key && this.__dragOk) return true;   // already solved
    const r = await base.call(this);
    this.__dragKey = key; this.__dragOk = r;
    return r;
  };
})();
;'__duo ready';

// run2 only reaches autoDrag when plan() is truthy, but slider2d / draggable
// point screens produce no plan, so those lessons stalled with the drag solvers
// never called. Make plan() report those interactive widgets too.
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this); if (p) return p;
    if (this.slider2d()) return { kind: 'slider2d', from: [0, 0], to: [0, 0] };
    if (this.gridPoints().length === 1) return { kind: 'gridpoint', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// "Create the expression for g(x)" from a token bank: slots are
// [g(x)] [=] [term] [op] [term]. Brute-force the three right-hand tokens and
// keep the combination that matches g numerically — no algebra needed.
window.__duo.solveBuildExpression = async function () {
  const d = this.diagram(); if (!d || !d.M.entries || d.M.entries.length !== 5) return false;
  if (!d.M.entries.every(e => e === null)) return false;
  const T = this.transformed(); if (!T) return null;
  const toks = this.bankTokens();
  const lhs = toks.find(o => o.t.normalize('NFKC').replace(/\s/g, '') === T.gname + '(x)');
  const eq = toks.find(o => o.t.trim() === '=');
  if (!lhs || !eq) return false;
  const rest = toks.filter(o => o !== lhs && o !== eq);
  const val = o => { const g = this.compile(o.t.normalize('NFKC').replace(/\s/g, '')); return g || null; };
  const xs = [-2, -1, 0, 1, 2, 3];
  let hit = null;
  for (const a of rest) { const fa = val(a); if (!fa) continue;
    for (const op of rest) { const s = op.t.trim(); if (s !== '+' && s !== '-') continue;
      for (const b of rest) { if (b === a || b === op) continue;
        const fb = val(b); if (!fb) continue;
        let ok = true;
        for (const x of xs) { try {
          const v = s === '+' ? fa(x) + fb(x) : fa(x) - fb(x);
          if (Math.abs(v - T.g(x)) > 1e-6) { ok = false; break; }
        } catch (e) { ok = false; break; } }
        if (ok) { hit = [lhs, eq, a, op, b]; break; }
      } if (hit) break; } if (hit) break; }
  if (!hit) return false;
  const fr = d.f.getBoundingClientRect();
  const centre = el => { const r = el.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  for (let i = 0; i < hit.length; i++) {
    const cell = d.M.cellElements && d.M.cellElements[i];
    if (!cell || !hit[i].el.isConnected) return false;
    await this.dragXY(hit[i].el, d.f, centre(hit[i].el), centre(cell));
    await this.sleep(320);
  }
  return d.M.entries.every(e => e !== null);
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveBuildExpression()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// typed variants: "enter the vertical shift from f to g",
// "enter the output of g when x = 6"
(function () {
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    const T = this.transformed();
    if (T) {
      const m = ins.replace(/\s/g, '').match(/outputof([a-z])when[a-z]=(-?[\d.]+)/i) ||
                ins.replace(/\s/g, '').match(/([a-z])\((-?[\d.]+)\)/);
      if (m) {
        const fn = m[1] === T.gname ? T.g : T.f;
        try { const v = fn(parseFloat(m[2])); if (isFinite(v)) return v; } catch (e) {}
      }
      if (/shift/.test(ins) && T.k.out !== undefined) return T.k.out;
    }
    return base.call(this);
  };
})();
;'__duo ready';

// "Translate the graph right by 2" against a template g(x) = f(x - <slider>).
// The template already carries the sign, so right maps to +2 there; when the
// template reads f(x + <slider>) it maps to -2. Same idea for up/down.
window.__duo.solveTranslate = async function () {
  const S = this.slider2d(); if (!S) return false;
  const ins = this.curInstruction().replace(/\s/g, '');
  const m = ins.match(/(right|left|up|down)by(-?\d+(?:\.\d+)?)/i);
  if (!m) return false;
  const n = parseFloat(m[2]);
  const dir = m[1].toLowerCase();
  const tpl = this.mathParts().find(t => /duodisplay/.test(t)) || '';
  let want;
  if (dir === 'right' || dir === 'left') {
    const minusInside = /x-duodisplay/.test(tpl);
    want = (dir === 'right' ? 1 : -1) * n * (minusInside ? 1 : -1);
  } else {
    const minusOutside = /\)-duodisplay/.test(tpl);
    want = (dir === 'up' ? 1 : -1) * n * (minusOutside ? -1 : 1);
  }
  return await this.setSlider2d(want);
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveTranslate()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// same translation, other wording: "graph a left shift of 2"
(function () {
  const base = window.__duo.solveTranslate;
  window.__duo.solveTranslate = async function () {
    if (await base.call(this)) return true;
    const S = this.slider2d(); if (!S) return false;
    const ins = this.curInstruction().replace(/\s/g, '');
    const m = ins.match(/(right|left|up|down)shiftof(-?\d+(?:\.\d+)?)/i) ||
              ins.match(/shift(?:the\w*)?(right|left|up|down)(?:by)?(-?\d+(?:\.\d+)?)/i);
    if (!m) return false;
    const n = parseFloat(m[2]), dir = m[1].toLowerCase();
    const tpl = this.mathParts().find(t => /duodisplay/.test(t)) || '';
    let want;
    if (dir === 'right' || dir === 'left') {
      want = (dir === 'right' ? 1 : -1) * n * (/x-duodisplay/.test(tpl) ? 1 : -1);
    } else {
      want = (dir === 'up' ? 1 : -1) * n * (/\)-duodisplay/.test(tpl) ? -1 : 1);
    }
    return await this.setSlider2d(want);
  };
})();
;'__duo ready';

// horizontal shift between two drawn curves: the h that best aligns them
window.__duo.curveShiftX = function () {
  const C = this.allCurves(); if (C.length !== 2) return null;
  const dense = at => { const P = []; for (let i = 0; i <= 200; i++) { const p = at(i / 200); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); } return P.sort((a, b) => a[0] - b[0]); };
  const A = dense(C[0]), B = dense(C[1]);
  if (A.length < 10 || B.length < 10) return null;
  const interp = (P, x) => {
    if (x < P[0][0] || x > P[P.length - 1][0]) return null;
    for (let i = 1; i < P.length; i++) if (P[i][0] >= x) {
      const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return null;
  };
  let best = null, bestErr = Infinity;
  for (let h = -8; h <= 8; h += 0.5) {
    let n = 0, err = 0;
    for (let i = 0; i < A.length; i += 4) {
      const y = interp(B, A[i][0] + h);
      if (y === null) continue;
      err += Math.abs(y - A[i][1]); n++;
    }
    if (n < 8) continue;
    const e = err / n;
    if (e < bestErr) { bestErr = e; best = h; }
  }
  return bestErr < 0.25 ? Math.round(best) : null;
};
(function () {
  const base = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const r = base.call(this); if (r) return r;
    const ins = this.curInstruction();
    if (!/horizontal shift/.test(ins)) return null;
    const h = this.curveShiftX(); if (h === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    let i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - h) < 1e-9; });
    if (i < 0) i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v + h) < 1e-9; });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /horizontal shift/i]);
})();
;'__duo ready';

// g(x) = f(x - 9) is a shift of +9: the shift is the negation of the constant
// inside the argument.
(function () {
  const base = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = this.curInstruction();
    if (/horizontal shift/.test(ins)) {
      const T = this.transformed();
      const h = T && T.k.in !== undefined ? -T.k.in : this.curveShiftX();
      if (h !== null && h !== undefined) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - h) < 1e-9; });
        if (i >= 0) return { i };
      }
    }
    return base.call(this);
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/horizontal shift/.test(this.curInstruction())) {
      const T = this.transformed();
      if (T && T.k.in !== undefined) return -T.k.in;
      const h = this.curveShiftX(); if (h !== null) return h;
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Select the output of g when x = 3" — same computation as the typed form,
// just matched against the choices.
(function () {
  const base = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const r = base.call(this); if (r) return r;
    const o = this.solveOutputAt();
    if (o === null || o === undefined) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - o) < 1e-9; });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /output of|value of|shift|equation for/i]);
})();
;'__duo ready';

// g(x) = f(x + 2) against a template f(x - <slider>) needs the slider at -2:
// the template's own sign decides, exactly as in solveTranslate.
(function () {
  const base = window.__duo.solveShiftSlider;
  window.__duo.solveShiftSlider = async function () {
    const S = this.slider2d(); if (!S) return false;
    const tpl = this.mathParts().find(t => /duodisplay/.test(t)) || '';
    for (const t of this.mathParts()) {
      if (/duodisplay/.test(t)) continue;
      const h = t.match(/^([a-z])\(x\)=([a-z])\(x([+-])(\d+(?:\.\d+)?)\)$/);
      if (h && h[1] !== h[2]) {
        const n = (h[3] === '-' ? -1 : 1) * parseFloat(h[4]);
        return await this.setSlider2d(/x-duodisplay/.test(tpl) ? -n : n);
      }
      const m = t.match(/^([a-z])\(x\)=([a-z])\(x\)([+-])(\d+(?:\.\d+)?)$/);
      if (m && m[1] !== m[2]) {
        const n = (m[3] === '-' ? -1 : 1) * parseFloat(m[4]);
        return await this.setSlider2d(/\)-duodisplay/.test(tpl) ? -n : n);
      }
    }
    return await base.call(this);
  };
})();
;'__duo ready';

// Without a \duodisplay template the slider carries no sign convention, so
// guessing is a coin flip. Set a value, then check the drawn curve against the
// expected g(x) and flip if it does not match.
window.__duo.curveMatches = function (fn) {
  for (const at of this.allCurves()) {
    let n = 0, bad = 0;
    for (let i = 0; i <= 40; i++) {
      const [x, y] = at(i / 40);
      if (!isFinite(x) || !isFinite(y)) continue;
      let v; try { v = fn(x); } catch (e) { continue; }
      if (!isFinite(v)) continue;
      n++; if (Math.abs(v - y) > 0.3) bad++;
    }
    if (n >= 10 && bad <= n * 0.1) return true;
  }
  return false;
};
(function () {
  const base = window.__duo.solveShiftSlider;
  window.__duo.solveShiftSlider = async function () {
    const S = this.slider2d(); if (!S) return false;
    const T = this.transformed();
    const ok = await base.call(this);
    if (!ok || !T) return ok;
    await this.sleep(250);
    if (this.curveMatches(T.g)) return true;
    const cur = this.sliderValue();
    if (cur === null) return true;
    await this.setSlider2d(-cur);                 // wrong sign convention; flip
    await this.sleep(250);
    return true;
  };
})();
;'__duo ready';

// Transformation choices now include horizontal shifts and dilations
// (f(3x), f(x-3), f(x)+3). Score each candidate by rebuilding it from the drawn
// f and testing it against the drawn g — no need to classify the wording.
window.__duo.solveTransform = function () {
  const ins = this.curInstruction();
  if (!/transformation/.test(ins)) return null;
  const C = this.allCurves();
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  // formula route first: both f and g stated
  const T = this.transformed();
  if (T) {
    const xs = [-2, -1, 0, 1, 2, 3];
    const ok = [];
    ch.forEach((e, i) => {
      const t = this.plainMath(this.choiceLatex(e));
      const m = t.match(/^[a-z]\(x\)=[a-z]\((.+)\)$/) || t.match(/^[a-z]\(x\)=[a-z]\(x\)([+-].+)$/);
      if (!m) return;
      let cand;
      if (/^[+-]/.test(m[1])) { const k = parseFloat(m[1]); cand = x => T.f(x) + k; }
      else { const inner = this.compile(m[1]); if (!inner) return; cand = x => T.f(inner(x)); }
      let bad = 0;
      for (const x of xs) { try { if (Math.abs(cand(x) - T.g(x)) > 1e-6) bad++; } catch (err) { bad++; } }
      if (!bad) ok.push(i);
    });
    if (ok.length === 1) return { i: ok[0] };
  }
  if (C.length !== 2) return null;
  const k = this.curveGap();
  if (k !== null && k !== 0) {
    const val = e => { const m = this.plainMath(this.choiceLatex(e)).match(/\(x\)([+-])(\d+(?:\.\d+)?)$/);
      return m ? (m[1] === '-' ? -1 : 1) * parseFloat(m[2]) : null; };
    let i = ch.findIndex(e => val(e) === k);
    if (i < 0) i = ch.findIndex(e => val(e) === -k);
    if (i >= 0) return { i };
  }
  const h = this.curveShiftX();
  if (h !== null && h !== 0) {
    const val = e => { const m = this.plainMath(this.choiceLatex(e)).match(/\(x([+-])(\d+(?:\.\d+)?)\)$/);
      return m ? (m[1] === '-' ? -1 : 1) * parseFloat(m[2]) : null; };
    let i = ch.findIndex(e => val(e) === -h);
    if (i < 0) i = ch.findIndex(e => val(e) === h);
    if (i >= 0) return { i };
  }
  return null;
};
(function () {
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/horizontal shift/.test(this.curInstruction())) {
      const T = this.transformed();
      if (T && T.k.in !== undefined) return -T.k.in;
      const h = this.curveShiftX(); if (h !== null) return h;
    }
    return base.call(this);
  };
})();
;'__duo ready';

// Unit 166: dilations. "Create a vertical stretch of 2" sets the slider that
// multiplies the function; a compression of n means a factor of 1/n.
window.__duo.statedDilation = function () {
  const t = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '');
  const m = t.match(/(vertical|horizontal)(stretch|compression|shrink)o?f?(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?/i);
  if (!m) return null;
  let n = parseFloat(m[3]); if (m[4]) n = n / parseFloat(m[4]);
  const shrink = /compression|shrink/i.test(m[2]);
  return { axis: m[1].toLowerCase(), k: shrink ? 1 / n : n };
};
window.__duo.solveDilation = async function () {
  const S = this.slider2d(); if (!S) return false;
  const D = this.statedDilation(); if (!D) return false;
  const want = D.k;
  if (want < S.s.min || want > S.s.max) {
    const inv = 1 / D.k;                       // template may hold the reciprocal
    if (inv >= S.s.min && inv <= S.s.max) return await this.setSlider2d(inv);
    return false;
  }
  return await this.setSlider2d(want);
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveDilation()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "Select the vertical stretch value from f(x) to g(x)": the ratio g/f, read
// from the stated formulas or measured off the two drawn curves.
window.__duo.stretchFactor = function () {
  for (const t of this.mathParts()) {
    const m = t.match(/^([a-z])\(x\)=(\d+(?:\.\d+)?)(?:\*|cdot)?([a-z])\(x\)$/);
    if (m && m[1] !== m[3]) return parseFloat(m[2]);
    const fr = t.match(/^([a-z])\(x\)=frac(\d+)(\d+)([a-z])\(x\)$/);
    if (fr && fr[1] !== fr[4]) return parseFloat(fr[2]) / parseFloat(fr[3]);
  }
  const C = this.allCurves(); if (C.length !== 2) return null;
  const dense = at => { const P = []; for (let i = 0; i <= 200; i++) { const p = at(i / 200); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); } return P.sort((a, b) => a[0] - b[0]); };
  const A = dense(C[0]), B = dense(C[1]);
  const interp = (P, x) => { if (x < P[0][0] || x > P[P.length - 1][0]) return null;
    for (let i = 1; i < P.length; i++) if (P[i][0] >= x) { const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return null; };
  const rs = [];
  for (let i = 0; i < A.length; i += 4) {
    const y = interp(B, A[i][0]);
    if (y === null || Math.abs(A[i][1]) < 0.5) continue;
    rs.push(y / A[i][1]);
  }
  if (rs.length < 8) return null;
  rs.sort((a, b) => a - b);
  const med = rs[Math.floor(rs.length / 2)];
  if (rs.filter(r => Math.abs(r - med) < 0.15).length < rs.length * 0.7) return null;
  return Math.round(med * 100) / 100;
};
(function () {
  const RE = /stretch|compress|shrink|dilation/i;
  const base = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const k = this.stretchFactor();
      if (k !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - k) < 0.05; });
        if (i >= 0) return { i };
      }
    }
    return base.call(this);
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) { const k = this.stretchFactor(); if (k !== null) return k; }
    return bo.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// transformed() only knew shifts. Teach it dilations: g(x)=2f(x) (vertical) and
// g(x)=f(2x) (horizontal), so every g-question works off one builder.
window.__duo.transformed = function () {
  let f = null, k = null, gname = 'g';
  for (const t of this.mathParts()) {
    const q = t.match(/^([a-z])\(x\)=([^=]+)$/); if (!q) continue;
    const r = q[2];
    let m;
    if ((m = r.match(/^([a-z])\(x\)([+-])(\d+(?:\.\d+)?)$/)))
      { gname = q[1]; k = { out: (m[2] === '-' ? -1 : 1) * parseFloat(m[3]) }; continue; }
    if ((m = r.match(/^([a-z])\(x([+-])(\d+(?:\.\d+)?)\)$/)))
      { gname = q[1]; k = { in: (m[2] === '-' ? -1 : 1) * parseFloat(m[3]) }; continue; }
    if ((m = r.match(/^(-?\d+(?:\.\d+)?)(?:\*|cdot)?([a-z])\(x\)$/)))
      { gname = q[1]; k = { mul: parseFloat(m[1]) }; continue; }
    if ((m = r.match(/^frac(\d+)(\d+)([a-z])\(x\)$/)))
      { gname = q[1]; k = { mul: parseFloat(m[1]) / parseFloat(m[2]) }; continue; }
    if ((m = r.match(/^([a-z])\((-?\d+(?:\.\d+)?)x\)$/)))
      { gname = q[1]; k = { inmul: parseFloat(m[2]) }; continue; }
    const g = this.compile(r.replace(/cdot|times/g, '*')); if (g) f = g;
  }
  if (!f || !k) return null;
  const g = k.out !== undefined ? (x => f(x) + k.out)
          : k.in !== undefined ? (x => f(x + k.in))
          : k.mul !== undefined ? (x => k.mul * f(x))
          : (x => f(k.inmul * x));
  return { f, g, k, gname };
};
;'__duo ready';

// Choices span shifts AND dilations (f(x)+2, 2f(x), f(2x)). With two curves
// drawn, rebuild each candidate from the drawn f and keep the one that matches
// the drawn g. Works without any formula in the prompt.
window.__duo.solveTransformFromCurves = function () {
  const C = this.allCurves(); if (C.length < 2) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const dense = at => { const P = []; for (let i = 0; i <= 200; i++) { const p = at(i / 200); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); } return P.sort((a, b) => a[0] - b[0]); };
  const interp = P => x => { if (x < P[0][0] || x > P[P.length - 1][0]) return null;
    for (let i = 1; i < P.length; i++) if (P[i][0] >= x) { const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return null; };
  const cand = e => {
    const t = this.plainMath(this.choiceLatex(e));
    let m;
    if ((m = t.match(/^[a-z]\(x\)=[a-z]\(x\)([+-])(\d+(?:\.\d+)?)$/)))
      { const k = (m[1] === '-' ? -1 : 1) * parseFloat(m[2]); return (F, x) => { const v = F(x); return v === null ? null : v + k; }; }
    if ((m = t.match(/^[a-z]\(x\)=[a-z]\(x([+-])(\d+(?:\.\d+)?)\)$/)))
      { const k = (m[1] === '-' ? -1 : 1) * parseFloat(m[2]); return (F, x) => F(x + k); }
    if ((m = t.match(/^[a-z]\(x\)=(-?\d+(?:\.\d+)?)(?:\*|cdot)?[a-z]\(x\)$/)))
      { const k = parseFloat(m[1]); return (F, x) => { const v = F(x); return v === null ? null : k * v; }; }
    if ((m = t.match(/^[a-z]\(x\)=[a-z]\((-?\d+(?:\.\d+)?)x\)$/)))
      { const k = parseFloat(m[1]); return (F, x) => F(k * x); }
    return null;
  };
  // any drawn curve may be f or g (screens sometimes draw a third), so try
  // every ordered pair and accept only an unambiguous single match
  const pairs = [];
  for (let a = 0; a < C.length; a++) for (let b = 0; b < C.length; b++) if (a !== b) pairs.push([a, b]);
  for (const [fi, gi] of pairs) {
    const F = interp(dense(C[fi])), G = interp(dense(C[gi]));
    const hits = [];
    ch.forEach((e, i) => {
      const fn = cand(e); if (!fn) return;
      let n = 0, bad = 0;
      for (let x = -4; x <= 4; x += 0.25) {
        const want = G(x); if (want === null) continue;
        const got = fn(F, x); if (got === null) continue;
        n++; if (Math.abs(got - want) > 0.3) bad++;
      }
      if (n >= 10 && bad <= n * 0.1) hits.push(i);
    });
    if (hits.length === 1) return { i: hits[0] };
  }
  return null;
};
(function () {
  const base = window.__duo.solveTransform;
  window.__duo.solveTransform = function () {
    const r = base.call(this); if (r) return r;
    return /transformation/.test(this.curInstruction()) ? this.solveTransformFromCurves() : null;
  };
})();
;'__duo ready';

// "Create a compression factor of 0.5" states the factor itself, whereas
// "a vertical compression of 3" means a factor of 1/3. A value below 1 is
// already a factor; only whole-number compressions get inverted.
window.__duo.statedDilation = function () {
  const t = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '');
  const m = t.match(/(vertical|horizontal)?(stretch|compression|shrink|dilation)(factor)?o?f?(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?/i);
  if (!m) return null;
  let n = parseFloat(m[4]); if (m[5]) n = n / parseFloat(m[5]);
  const shrink = /compression|shrink/i.test(m[2]);
  const k = (shrink && n > 1) ? 1 / n : n;
  return { axis: (m[1] || 'vertical').toLowerCase(), k };
};
;'__duo ready';

// "The value of k in g(x) = k * f(x) is ___" — k is the stretch factor, read
// from the curves or the stated dilation.
(function () {
  const RE = /value of k|k in g\(x\)/i;
  const base = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const D = this.statedDilation();
      const k = this.stretchFactor() !== null ? this.stretchFactor() : (D ? D.k : null);
      if (k !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - k) < 0.02; });
        if (i >= 0) return { i };
      }
    }
    return base.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// "Graph the transformation" where the prompt states g(x) = 1.25 f(x):
// the multiplier goes straight onto the slider.
(function () {
  const base = window.__duo.solveDilation;
  window.__duo.solveDilation = async function () {
    const S = this.slider2d(); if (!S) return false;
    const T = this.transformed();
    if (T && T.k.mul !== undefined && T.k.mul >= S.s.min && T.k.mul <= S.s.max)
      return await this.setSlider2d(T.k.mul);
    if (T && T.k.inmul !== undefined && T.k.inmul >= S.s.min && T.k.inmul <= S.s.max)
      return await this.setSlider2d(T.k.inmul);
    return await base.call(this);
  };
})();
;'__duo ready';

// g(x) = f(\frac{1}{4}x): a fractional inner multiplier. flatLine renders the
// fraction as "frac14", so parse that form too.
(function () {
  const base = window.__duo.transformed;
  window.__duo.transformed = function () {
    const T = base.call(this); if (T) return T;
    let f = null, k = null, gname = 'g';
    for (const t of this.mathParts()) {
      const q = t.match(/^([a-z])\(x\)=([^=]+)$/); if (!q) continue;
      let m;
      if ((m = q[2].match(/^([a-z])\(frac(\d+)(\d+)x\)$/)))
        { gname = q[1]; k = { inmul: parseFloat(m[2]) / parseFloat(m[3]) }; continue; }
      if ((m = q[2].match(/^frac(\d+)(\d+)([a-z])\(x\)$/)))
        { gname = q[1]; k = { mul: parseFloat(m[1]) / parseFloat(m[2]) }; continue; }
      if ((m = q[2].match(/^([a-z])\((-?\d+(?:\.\d+)?)x\)$/)))
        { gname = q[1]; k = { inmul: parseFloat(m[2]) }; continue; }
      const g = this.compile(q[2].replace(/cdot|times/g, '*')); if (g) f = g;
    }
    if (!f || !k) return null;
    const g = k.mul !== undefined ? (x => k.mul * f(x)) : (x => f(k.inmul * x));
    return { f, g, k, gname };
  };
})();
;'__duo ready';

// choices may hold fractional multipliers: g(x)=f(\frac{1}{4}x), g(x)=\frac{1}{2}f(x)
(function () {
  const base = window.__duo.solveTransformFromCurves;
  window.__duo.candTransform = function (el) {
    const t = this.plainMath(this.choiceLatex(el));
    let m;
    if ((m = t.match(/^[a-z]\(x\)=[a-z]\(x\)([+-])(\d+(?:\.\d+)?)$/)))
      { const k = (m[1] === '-' ? -1 : 1) * parseFloat(m[2]); return (F, x) => { const v = F(x); return v === null ? null : v + k; }; }
    if ((m = t.match(/^[a-z]\(x\)=[a-z]\(x([+-])(\d+(?:\.\d+)?)\)$/)))
      { const k = (m[1] === '-' ? -1 : 1) * parseFloat(m[2]); return (F, x) => F(x + k); }
    if ((m = t.match(/^[a-z]\(x\)=(-?)frac(\d+)(\d+)[a-z]\(x\)$/)))
      { const k = (m[1] ? -1 : 1) * parseFloat(m[2]) / parseFloat(m[3]); return (F, x) => { const v = F(x); return v === null ? null : k * v; }; }
    if ((m = t.match(/^[a-z]\(x\)=(-?\d+(?:\.\d+)?)(?:\*|cdot)?[a-z]\(x\)$/)))
      { const k = parseFloat(m[1]); return (F, x) => { const v = F(x); return v === null ? null : k * v; }; }
    if ((m = t.match(/^[a-z]\(x\)=[a-z]\((-?)frac(\d+)(\d+)x\)$/)))
      { const k = (m[1] ? -1 : 1) * parseFloat(m[2]) / parseFloat(m[3]); return (F, x) => F(k * x); }
    if ((m = t.match(/^[a-z]\(x\)=[a-z]\((-?\d+(?:\.\d+)?)x\)$/)))
      { const k = parseFloat(m[1]); return (F, x) => F(k * x); }
    return null;
  };
  window.__duo.solveTransformFromCurves = function () {
    const C = this.allCurves(); if (C.length < 2) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (ch.length < 2) return null;
    const dense = at => { const P = []; for (let i = 0; i <= 200; i++) { const p = at(i / 200); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); } return P.sort((a, b) => a[0] - b[0]); };
    const interp = P => x => { if (x < P[0][0] || x > P[P.length - 1][0]) return null;
      for (let i = 1; i < P.length; i++) if (P[i][0] >= x) { const [x0, y0] = P[i - 1], [x1, y1] = P[i];
        return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return null; };
    const pairs = [];
    for (let a = 0; a < C.length; a++) for (let b = 0; b < C.length; b++) if (a !== b) pairs.push([a, b]);
    for (const [fi, gi] of pairs) {
      const F = interp(dense(C[fi])), G = interp(dense(C[gi]));
      const hits = [];
      ch.forEach((e, i) => {
        const fn = this.candTransform(e); if (!fn) return;
        let n = 0, bad = 0;
        for (let x = -4; x <= 4; x += 0.25) {
          const want = G(x); if (want === null) continue;
          const got = fn(F, x); if (got === null) continue;
          n++; if (Math.abs(got - want) > 0.3) bad++;
        }
        if (n >= 10 && bad <= n * 0.1) hits.push(i);
      });
      if (hits.length === 1) return { i: hits[0] };
    }
    return null;
  };
})();
;'__duo ready';

// horizontal stretch: g(x) = f(x/k) stretches by k, so with g(x) = f(c x)
// the stretch value is 1/c. Measure c from the curves when no formula is given.
window.__duo.horizontalFactor = function () {
  const T = this.transformed();
  if (T && T.k.inmul !== undefined) return 1 / T.k.inmul;
  const C = this.allCurves(); if (C.length < 2) return null;
  const dense = at => { const P = []; for (let i = 0; i <= 200; i++) { const p = at(i / 200); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); } return P.sort((a, b) => a[0] - b[0]); };
  const interp = P => x => { if (x < P[0][0] || x > P[P.length - 1][0]) return null;
    for (let i = 1; i < P.length; i++) if (P[i][0] >= x) { const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return null; };
  const F = interp(dense(C[0])), G = interp(dense(C[1]));
  let best = null, bestErr = Infinity;
  for (const c of [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.25, 1.5, 2, 3, 4]) {
    let n = 0, err = 0;
    for (let x = -4; x <= 4; x += 0.25) {
      const want = G(x), got = F(c * x);
      if (want === null || got === null) continue;
      err += Math.abs(got - want); n++;
    }
    if (n < 10) continue;
    const e = err / n;
    if (e < bestErr) { bestErr = e; best = c; }
  }
  return bestErr < 0.25 && best ? Math.round((1 / best) * 100) / 100 : null;
};
(function () {
  const RE = /horizontal (stretch|compress|shrink|dilation|scale)/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) { const k = this.horizontalFactor(); if (k !== null) return k; }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const k = this.horizontalFactor();
      if (k !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - k) < 0.02; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// "Graph g(x) = f(2x)" against the template g(x) = f(<slider> x): the goal line
// states the multiplier and the slider holds it directly.
window.__duo.solveInnerMulSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  const tpl = this.mathParts().find(t => /duodisplay/.test(t));
  if (!tpl || !/duodisplay[\d.\-]+x\)/.test(tpl)) return false;
  for (const t of this.mathParts()) {
    if (/duodisplay/.test(t)) continue;
    const m = t.match(/^[a-z]\(x\)=[a-z]\((-?\d+(?:\.\d+)?)x\)$/);
    if (m) return await this.setSlider2d(parseFloat(m[1]));
    const f = t.match(/^[a-z]\(x\)=[a-z]\((-?)frac(\d+)(\d+)x\)$/);
    if (f) return await this.setSlider2d((f[1] ? -1 : 1) * parseFloat(f[2]) / parseFloat(f[3]));
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveInnerMulSlider()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// A horizontal COMPRESSION value is the inner multiplier c in f(cx); a
// horizontal STRETCH value is its reciprocal. Report whichever the prompt asks.
window.__duo.innerMultiplier = function () {
  const k = this.horizontalFactor();      // returns 1/c
  return k === null || k === 0 ? null : Math.round((1 / k) * 100) / 100;
};
(function () {
  const RE = /horizontal (stretch|compress\w*|shrink|dilation|scale)/i;
  const want = function () {
    const ins = this.curInstruction();
    if (!RE.test(ins)) return null;
    return /compress|shrink/i.test(ins) ? this.innerMultiplier() : this.horizontalFactor();
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = want.call(this); if (v !== null && v !== undefined) return v;
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const v = want.call(this);
    if (v !== null && v !== undefined) {
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 0.02; });
      if (i >= 0) return { i };
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// Unit 168: "Set the independent variable to 4" — a bare instruction naming the
// slider's target value. Covers any "set ... to N" wording.
window.__duo.solveSetSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  const txt = this.mathParts().concat([this.curInstruction()]).join(' ');
  const m = txt.match(/set\s+[^.]*?\s+to\s+(-?\d+(?:\.\d+)?)/i);
  if (!m) return false;
  const v = parseFloat(m[1]);
  if (v < S.s.min || v > S.s.max) return false;
  return await this.setSlider2d(v);
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveSetSlider()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// mathParts strips spaces, so the "set ... to N" regex needs the despaced form
window.__duo.solveSetSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  const txt = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '');
  const m = txt.match(/set[a-z]*?to(-?\d+(?:\.\d+)?)/i);
  if (!m) return false;
  const v = parseFloat(m[1]);
  if (v < S.s.min || v > S.s.max) return false;
  return await this.setSlider2d(v);
};
;'__duo ready';

// "Plot the data": the prompt lists the points and the grid holds one draggable
// marker per point. Match markers to targets nearest-first so the shortest
// drags happen first and markers do not swap places.
window.__duo.solvePlotData = async function () {
  const pts = this.gridPoints(); if (pts.length < 2) return false;
  const txt = this.mathParts().join(' ').replace(/\s/g, '');
  const targets = [...txt.matchAll(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/g)]
    .map(m => [parseFloat(m[1]), parseFloat(m[2])]);
  if (targets.length !== pts.length) return false;
  const free = pts.slice(), left = targets.slice();
  while (left.length) {
    let bi = 0, bj = 0, bd = Infinity;
    free.forEach((p, i) => left.forEach((t, j) => {
      const d = Math.hypot(p.x - t[0], p.y - t[1]);
      if (d < bd) { bd = d; bi = i; bj = j; }
    }));
    const p = free[bi], t = left[bj];
    if (Math.hypot(p.x - t[0], p.y - t[1]) > 1e-9) await this.dragPointTo(p, t[0], t[1]);
    free.splice(bi, 1); left.splice(bj, 1);
  }
  return this.gridPoints().every(p => targets.some(t => Math.hypot(p.x - t[0], p.y - t[1]) < 1e-6));
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solvePlotData()) return true;
    return await base.call(this);
  };
  const bp = window.__duo.plan;
  window.__duo.plan = function () {
    const p = bp.call(this); if (p) return p;
    if (this.gridPoints().length > 1) return { kind: 'plotdata', from: [0, 0], to: [0, 0] };
    return null;
  };
})();
;'__duo ready';

// plainMath strips commas, which destroys coordinate pairs — keep them here.
window.__duo.promptPairs = function () {
  const txt = this.promptLatex()
    .map(l => this.ascii(l).replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
                           .replace(/[{}&~\s\\]/g, ''))
    .join(' ');
  return [...txt.matchAll(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/g)]
    .map(m => [parseFloat(m[1]), parseFloat(m[2])]);
};
(function () {
  const base = window.__duo.solvePlotData;
  window.__duo.solvePlotData = async function () {
    const pts = this.gridPoints(); if (pts.length < 2) return false;
    const targets = this.promptPairs();
    if (targets.length !== pts.length) return await base.call(this);
    const free = pts.slice(), left = targets.slice();
    while (left.length) {
      let bi = 0, bj = 0, bd = Infinity;
      free.forEach((p, i) => left.forEach((t, j) => {
        const d = Math.hypot(p.x - t[0], p.y - t[1]);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }));
      const p = free[bi], t = left[bj];
      if (Math.hypot(p.x - t[0], p.y - t[1]) > 1e-9) await this.dragPointTo(p, t[0], t[1]);
      free.splice(bi, 1); left.splice(bj, 1);
    }
    return this.gridPoints().every(p => targets.some(t => Math.hypot(p.x - t[0], p.y - t[1]) < 1e-6));
  };
})();
;'__duo ready';

// Unit 168 stats: "Create a positive trend" drives a correlation slider.
// Pick a decisive value (not just any value with the right sign) so the drag is
// real — CHECK stays disabled until the widget sees a pointer interaction.
window.__duo.solveTrendSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  const txt = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
  if (!/correlation|trend/.test(txt)) return false;
  let want = null;
  if (/positive|increasing|upward/.test(txt)) want = S.s.max;
  else if (/negative|decreasing|downward/.test(txt)) want = S.s.min;
  else if (/no(correlation|trend)|zero/.test(txt)) want = 0;
  if (want === null) return false;
  const cur = this.sliderValue();
  if (cur !== null && Math.abs(cur - want) < 1e-9) {   // nudge, then return
    const other = want === S.s.max ? want - S.s.step : want + S.s.step;
    await this.setSlider2d(other); await this.sleep(220);
  }
  return await this.setSlider2d(want);
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveTrendSlider()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// a scatter plot can have a single missing point, so allow one marker
(function () {
  const base = window.__duo.solvePlotData;
  window.__duo.solvePlotData = async function () {
    const pts = this.gridPoints();
    const targets = this.promptPairs();
    if (pts.length !== 1 || targets.length !== 1) return await base.call(this);
    const [t] = targets, p = pts[0];
    if (Math.hypot(p.x - t[0], p.y - t[1]) > 1e-9) await this.dragPointTo(p, t[0], t[1]);
    const q = this.gridPoints()[0];
    return !!q && Math.hypot(q.x - t[0], q.y - t[1]) < 1e-6;
  };
})();
;'__duo ready';

// "Select the approximate correlation coefficient" — compute Pearson's r over
// the plotted points and snap to the nearest offered value.
window.__duo.plottedPoints = function () {
  const d = this.diagram(); if (!d || !d.M.components) return [];
  return [...d.M.components.components.values()]
    .filter(v => v.options && 'x' in v.options)
    .map(v => [v.x, v.y]);
};
window.__duo.correlation = function () {
  const P = this.plottedPoints(); if (P.length < 3) return null;
  const n = P.length;
  const mx = P.reduce((a, p) => a + p[0], 0) / n, my = P.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of P) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (!sxx || !syy) return 0;
  const r = sxy / Math.sqrt(sxx * syy);
  return isFinite(r) ? r : null;
};
(function () {
  const RE = /correlation coefficient/i;
  const base = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const r = this.correlation();
      if (r !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        let bi = -1, bd = Infinity;
        ch.forEach((e, i) => { const v = this.choiceValue(e);
          if (v === null) return; const d = Math.abs(v - r); if (d < bd) { bd = d; bi = i; } });
        if (bi >= 0) return { i: bi };
      }
    }
    return base.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// Unit 169: "Graph the trend line y = 2x - 1" with one slider whose meaning
// (slope or intercept) is not stated. Try each value and keep the one whose
// drawn line matches the target — a handful of drags, no guessing.
window.__duo.solveTrendLine = async function () {
  const S = this.slider2d(); if (!S) return false;
  let f = null;
  for (const t of this.mathParts()) {
    const m = t.match(/^(?:y|[a-z]\(x\))=([^=]+)$/);
    if (m) { const g = this.compile(m[1].replace(/cdot|times/g, '*')); if (g) f = g; }
  }
  if (!f) return false;
  if (this.curveMatches(f)) {                      // already right: nudge and return
    const cur = this.sliderValue();
    const other = cur === S.s.max ? cur - S.s.step : cur + S.s.step;
    await this.setSlider2d(other); await this.sleep(200);
    await this.setSlider2d(cur); return true;
  }
  for (let v = S.s.min; v <= S.s.max; v += S.s.step) {
    if (Math.abs(v - this.sliderValue()) < 1e-9) continue;
    await this.setSlider2d(v); await this.sleep(220);
    if (this.curveMatches(f)) return true;
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveTrendLine()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "Select the predicted input when y = 1" — the inverse direction: find the x
// on the trend line (formula or drawn) that produces the given y.
window.__duo.inputForY = function (y) {
  let f = null;
  for (const t of this.mathParts()) {
    const m = t.match(/^(?:y|[a-z]\(x\))=([^=]+)$/);
    if (m) { const g = this.compile(m[1].replace(/cdot|times/g, '*')); if (g) f = g; }
  }
  if (!f) {
    const c = this.allCurves(); if (!c.length) return null;
    const P = []; for (let i = 0; i <= 200; i++) { const p = c[0](i / 200); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); }
    P.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < P.length; i++) {
      const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) return Math.round((x0 + (x1 - x0) * (y - y0) / (y1 - y0)) * 100) / 100;
    }
    return null;
  }
  let best = null, bd = Infinity;
  for (let x = -20; x <= 20; x += 0.01) {
    let v; try { v = f(x); } catch (e) { continue; }
    const d = Math.abs(v - y);
    if (d < bd) { bd = d; best = x; }
  }
  return bd < 0.02 ? Math.round(best * 100) / 100 : null;
};
(function () {
  const RE = /predicted input|input when|value of x when/i;
  const base = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = this.curInstruction();
    if (RE.test(ins)) {
      const m = ins.replace(/\s/g, '').match(/y=(-?\d+(?:\.\d+)?)/);
      if (m) {
        const x = this.inputForY(parseFloat(m[1]));
        if (x !== null) {
          const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
          const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - x) < 0.05; });
          if (i >= 0) return { i };
        }
      }
    }
    return base.call(this);
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (RE.test(ins)) {
      const m = ins.replace(/\s/g, '').match(/y=(-?\d+(?:\.\d+)?)/);
      if (m) { const x = this.inputForY(parseFloat(m[1])); if (x !== null) return x; }
    }
    return bo.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// "Select two points on the trend line": each choice offers a pair of points;
// keep the pair that actually lies on the drawn line.
window.__duo.solvePointsOnLine = function () {
  if (!/points on the (trend )?line/.test(this.curInstruction())) return null;
  const c = this.curvePath(); if (!c) return null;
  const P = []; for (let i = 0; i <= 200; i++) { const p = c.at(i / 200); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); }
  P.sort((a, b) => a[0] - b[0]);
  if (P.length < 5) return null;
  const yAt = x => { if (x < P[0][0] - 0.5 || x > P[P.length - 1][0] + 0.5) return null;
    for (let i = 1; i < P.length; i++) if (P[i][0] >= x) { const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      return x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
    return P[P.length - 1][1]; };
  // extrapolate along the fitted line for x outside the drawn range
  const m = (P[P.length - 1][1] - P[0][1]) / (P[P.length - 1][0] - P[0][0]);
  const b = P[0][1] - m * P[0][0];
  const at = x => { const v = yAt(x); return v === null ? m * x + b : v; };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const hits = [];
  ch.forEach((e, i) => {
    const raw = this.choiceLatex(e).replace(/\\(mathbf|textbf|text|left|right)\b/g, '').replace(/[{}\s\\]/g, '');
    const pairs = [...raw.matchAll(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/g)].map(q => [parseFloat(q[1]), parseFloat(q[2])]);
    if (pairs.length < 2) return;
    if (pairs.every(p => Math.abs(at(p[0]) - p[1]) < 0.3)) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solvePointsOnLine', /points on the/i]);
;'__duo ready';

// Unit 169 residuals, done in guided steps. The highlighted "connected" point is
// drawn twice, so it is the coordinate that appears more than once.
window.__duo.connectedPoint = function () {
  const P = this.plottedPoints();
  const key = p => p[0] + ',' + p[1];
  const seen = {};
  for (const p of P) seen[key(p)] = (seen[key(p)] || 0) + 1;
  const dup = Object.keys(seen).filter(k => seen[k] > 1);
  if (dup.length !== 1) return null;
  return dup[0].split(',').map(Number);
};
window.__duo.lineYAt = function (x) {
  const c = this.curvePath(); if (!c) return null;
  const P = []; for (let i = 0; i <= 200; i++) { const p = c.at(i / 200); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); }
  P.sort((a, b) => a[0] - b[0]); if (P.length < 5) return null;
  const m = (P[P.length - 1][1] - P[0][1]) / (P[P.length - 1][0] - P[0][0]);
  const b = P[0][1] - m * P[0][0];
  return Math.round((m * x + b) * 100) / 100;
};
(function () {
  const RE = /residual|connected point|predicted y|actual y/i;
  const answer = function () {
    const ins = this.curInstruction();
    if (!RE.test(ins)) return null;
    const pt = this.connectedPoint(); if (!pt) return null;
    if (/actual y/.test(ins)) return pt[1];
    if (/predicted y/.test(ins)) return this.lineYAt(pt[0]);
    if (/residual/.test(ins)) {
      const p = this.lineYAt(pt[0]);
      return p === null ? null : Math.round((pt[1] - p) * 100) / 100;
    }
    return null;
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = answer.call(this); if (v !== null && v !== undefined) return v;
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const v = answer.call(this);
    if (v !== null && v !== undefined) {
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 0.05; });
      if (i >= 0) return { i };
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// Final residual step: "Subtract the predicted value from the actual value."
// Re-measuring the line here is wrong — the graph re-renders between steps — so
// use the two values this lesson already accepted, read back off the page.
window.__duo.answeredSteps = function () {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  const grab = re => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };
  return {
    actual: grab(/actual [^.]*?value[^.]*?\.\s*(-?\d+(?:\.\d+)?)/i),
    predicted: grab(/predicted [^.]*?value[^.]*?\.\s*(-?\d+(?:\.\d+)?)/i)
  };
};
(function () {
  const RE = /subtract the predicted|residual/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) {
      const A = this.answeredSteps();
      if (A.actual !== null && A.predicted !== null)
        return Math.round((A.actual - A.predicted) * 100) / 100;
    }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const A = this.answeredSteps();
      if (A.actual !== null && A.predicted !== null) {
        const v = A.actual - A.predicted;
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 0.05; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// When the prompt spells the arithmetic out ("residual = 2 - 3 ="), just
// evaluate it. Beats every heuristic and is immune to the graph re-rendering.
window.__duo.trailingExpression = function () {
  for (const t of this.mathParts().slice().reverse()) {
    const m = t.match(/=\s*(-?[\d.]+(?:[+\-*/][\d.]+)+)\s*=\s*$/) ||
              t.match(/^(-?[\d.]+(?:[+\-*/][\d.]+)+)=$/);
    if (!m) continue;
    const g = this.compile(m[1]);
    if (g) { try { const v = g(0); if (isFinite(v)) return Math.round(v * 1e6) / 1e6; } catch (e) {} }
  }
  return null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = this.trailingExpression(); if (v !== null) return v;
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const v = this.trailingExpression();
    if (v !== null) {
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-6; });
      if (i >= 0) return { i };
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// "Select the expression for the residual": the answer is the subtraction
// written actual - predicted, so match the operand ORDER, not just the value
// (6-5 and 5-6 both appear as choices).
window.__duo.solveResidualExpr = function () {
  if (!/expression for the residual/.test(this.curInstruction())) return null;
  const pt = this.connectedPoint();
  const actual = pt ? pt[1] : this.answeredSteps().actual;
  if (actual === null || actual === undefined) return null;
  const pred = pt ? this.lineYAt(pt[0]) : this.answeredSteps().predicted;
  if (pred === null || pred === undefined) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const m = this.plainMath(this.choiceLatex(e)).match(/^(-?[\d.]+)-(-?[\d.]+)$/);
    return m && Math.abs(parseFloat(m[1]) - actual) < 0.05 && Math.abs(parseFloat(m[2]) - pred) < 0.05;
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveResidualExpr', /expression for the residual/i]);
;'__duo ready';

// The connected point is not always drawn twice. Test every plotted point:
// the right choice is "point's y - line's y at that x", and only one candidate
// matches in that order.
window.__duo.solveResidualExpr = function () {
  if (!/expression for the residual/.test(this.curInstruction())) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const ops = ch.map(e => {
    const m = this.plainMath(this.choiceLatex(e)).match(/^(-?[\d.]+)-(-?[\d.]+)$/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
  });
  const hits = new Set();
  for (const p of this.plottedPoints()) {
    const ly = this.lineYAt(p[0]); if (ly === null) continue;
    ops.forEach((o, i) => {
      if (o && Math.abs(o[0] - p[1]) < 0.05 && Math.abs(o[1] - ly) < 0.05) hits.add(i);
    });
  }
  return hits.size === 1 ? { i: [...hits][0] } : null;
};
;'__duo ready';

// "Select the match at x = 5" with choices "predicted > observed" /
// "predicted < observed": compare the line to the data point at that x.
window.__duo.solvePredVsObs = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/\s+/g, ' '));
  if (!words.some(w => /predicted\s*[<>]\s*observed|observed\s*[<>]\s*predicted/.test(w))) return null;
  const m = this.curInstruction().replace(/\s/g, '').match(/x=(-?[\d.]+)/);
  if (!m) return null;
  const x = parseFloat(m[1]);
  const pt = this.plottedPoints().find(p => Math.abs(p[0] - x) < 1e-6);
  const ly = this.lineYAt(x);
  if (!pt || ly === null || Math.abs(ly - pt[1]) < 1e-9) return null;
  const predHigher = ly > pt[1];
  const i = words.findIndex(w => {
    const q = w.match(/(predicted|observed)\s*([<>])\s*(predicted|observed)/);
    if (!q) return false;
    const leftIsPred = q[1] === 'predicted';
    const gt = q[2] === '>';
    return (leftIsPred === gt) ? predHigher : !predHigher;
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solvePredVsObs', /select the match at|predicted|observed/i]);
;'__duo ready';

// Sometimes the prompt states both values outright ("observed = 11,
// predicted = 4") and the choices are the candidate expressions.
window.__duo.statedObsPred = function () {
  const t = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '');
  const o = t.match(/observed,?=(-?[\d.]+)/i), p = t.match(/predicted,?=(-?[\d.]+)/i);
  return (o && p) ? { obs: parseFloat(o[1]), pred: parseFloat(p[1]) } : null;
};
(function () {
  const base = window.__duo.solveResidualExpr;
  window.__duo.solveResidualExpr = function () {
    const S = this.statedObsPred();
    if (S) {
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      const i = ch.findIndex(e => {
        const m = this.plainMath(this.choiceLatex(e)).match(/^(-?[\d.]+)-(-?[\d.]+)$/);
        return m && Math.abs(parseFloat(m[1]) - S.obs) < 0.05 && Math.abs(parseFloat(m[2]) - S.pred) < 0.05;
      });
      if (i >= 0) return { i };
    }
    return base.call(this);
  };
  window.__duo.RULES.unshift(['solveResidualExpr', /observed|predicted|residual/i]);
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const S = this.statedObsPred();
    if (S && /residual/.test(this.curInstruction())) return Math.round((S.obs - S.pred) * 100) / 100;
    return bo.call(this);
  };
})();
;'__duo ready';

// Unit 170: two-way tables. "Column totals" leaves the TOTAL row empty; read the
// body numbers row-major from the frame text, sum each column, and drag the
// matching tokens in.
window.__duo.solveTableTotals = async function () {
  const T = this.tableCells(); if (!T) return false;
  const empty = T.cells.filter(c => c.empty); if (!empty.length) return false;
  const d = this.diagram(); if (!d) return false;
  const txt = d.f.contentDocument.body.innerText.replace(/[−–—]/g, '-').replace(/\s+/g, ' ');
  const body = txt.split(/TOTAL/i)[0];
  const ns = (body.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const filled = T.cells.length - empty.length;
  if (!ns.length || ns.length !== filled) return false;
  const cols = empty.length, rows = filled / cols;
  if (!Number.isInteger(rows)) return false;
  const ins = this.curInstruction();
  const wantRow = /row total/i.test(ins);
  const sums = [];
  if (wantRow) { for (let r = 0; r < rows; r++) sums.push(ns.slice(r * cols, r * cols + cols).reduce((a, b) => a + b, 0)); }
  else { for (let c = 0; c < cols; c++) { let s = 0; for (let r = 0; r < rows; r++) s += ns[r * cols + c]; sums.push(s); } }
  if (sums.length !== empty.length) return false;
  const fr = d.f.getBoundingClientRect();
  const centre = el => { const r = el.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  for (let i = 0; i < empty.length; i++) {
    const tok = this.bankTokens().find(o => parseFloat(o.t) === sums[i] && o.el.isConnected);
    const cell = empty[i].el || empty[i].element;
    if (!tok || !cell) return false;
    await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell));
    await this.sleep(320);
  }
  return true;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveTableTotals()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// The frame text includes the header ("9TH 10TH"), which polluted the numbers.
// tableCells already carries each cell's value and x/y, so group by coordinate.
window.__duo.solveTableTotals = async function () {
  const T = this.tableCells(); if (!T) return false;
  const d = this.diagram(); if (!d) return false;
  const empty = T.cells.filter(c => c.empty);
  const full = T.cells.filter(c => !c.empty && isFinite(parseFloat(c.t)));
  if (!empty.length || !full.length) return false;
  const near = (a, b) => Math.abs(a - b) < 12;
  const byRow = /row total/i.test(this.curInstruction()) ||
                empty.every(c => near(c.x, empty[0].x)) === false && empty.every(c => near(c.y, empty[0].y)) === false;
  const sums = empty.map(e => {
    const sameCol = full.filter(c => near(c.x, e.x));
    const sameRow = full.filter(c => near(c.y, e.y));
    const grp = byRow ? sameRow : (sameCol.length ? sameCol : sameRow);
    return grp.length ? grp.reduce((a, c) => a + parseFloat(c.t), 0) : null;
  });
  if (sums.some(s => s === null)) return false;
  const fr = d.f.getBoundingClientRect();
  const centre = el => { const r = el.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  for (let i = 0; i < empty.length; i++) {
    const tok = this.bankTokens().find(o => parseFloat(o.t) === sums[i] && o.el.isConnected);
    if (!tok || !empty[i].el) return false;
    await this.dragXY(tok.el, d.f, centre(tok.el), centre(empty[i].el));
    await this.sleep(320);
  }
  return true;
};
;'__duo ready';

// "Enter the missing frequency": one body cell is blank and the TOTAL row/column
// is filled, so the answer is total minus the other entries in that line.
window.__duo.missingFrequency = function () {
  const T = this.tableCells(); if (!T) return null;
  const cells = T.cells;
  const blank = cells.find(c => c.empty || c.t === '?'); if (!blank) return null;
  const val = c => parseFloat(c.t);
  const near = (a, b) => Math.abs(a - b) < 12;
  const maxY = Math.max(...cells.map(c => c.y)), maxX = Math.max(...cells.map(c => c.x));
  for (const [same, totalAt] of [[c => near(c.x, blank.x), c => near(c.y, maxY)],
                                 [c => near(c.y, blank.y), c => near(c.x, maxX)]]) {
    const line = cells.filter(same);
    const total = line.find(c => c !== blank && totalAt(c) && isFinite(val(c)));
    if (!total) continue;
    const others = line.filter(c => c !== blank && c !== total && isFinite(val(c)));
    if (!others.length) continue;
    const v = val(total) - others.reduce((a, c) => a + val(c), 0);
    if (isFinite(v)) return v;
  }
  return null;
};
(function () {
  const RE = /missing (frequency|value|entry)|fill in the (blank|table)/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) { const v = this.missingFrequency(); if (v !== null) return v; }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const v = this.missingFrequency();
      if (v !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-6; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// "Complete the table with frequencies": blanks sit in the body and the TOTAL
// line is filled, so each blank is total minus the rest of its column (or row).
window.__duo.solveTableBlanks = async function () {
  const T = this.tableCells(); if (!T) return false;
  const d = this.diagram(); if (!d) return false;
  const cells = T.cells;
  const blanks = cells.filter(c => c.empty); if (!blanks.length) return false;
  const val = c => parseFloat(c.t);
  const near = (a, b) => Math.abs(a - b) < 12;
  const maxY = Math.max(...cells.map(c => c.y)), maxX = Math.max(...cells.map(c => c.x));
  const want = blanks.map(b => {
    for (const [same, isTotal] of [[c => near(c.x, b.x), c => near(c.y, maxY)],
                                   [c => near(c.y, b.y), c => near(c.x, maxX)]]) {
      const line = cells.filter(same);
      const total = line.find(c => c !== b && isTotal(c) && isFinite(val(c)));
      if (!total) continue;
      const others = line.filter(c => c !== b && c !== total && isFinite(val(c)));
      if (others.length !== line.length - 2) continue;
      const v = val(total) - others.reduce((a, c) => a + val(c), 0);
      if (isFinite(v)) return v;
    }
    return null;
  });
  if (want.some(v => v === null)) return false;
  const fr = d.f.getBoundingClientRect();
  const centre = el => { const r = el.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  for (let i = 0; i < blanks.length; i++) {
    const tok = this.bankTokens().find(o => parseFloat(o.t) === want[i] && o.el.isConnected);
    if (!tok || !blanks[i].el) return false;
    await this.dragXY(tok.el, d.f, centre(tok.el), centre(blanks[i].el));
    await this.sleep(320);
  }
  return true;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveTableBlanks()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// Two-way table with labels: read every leaf text node in the frame with its
// position, then treat the top row as column headers and the left column as row
// headers. Joint frequency = the cell where a row and column label meet;
// marginal frequency = that label's TOTAL entry.
window.__duo.labeledTable = function () {
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const items = [...doc.querySelectorAll('div,span,text,tspan')]
    .filter(e => e.children.length === 0 && e.textContent.trim())
    .map(e => { const r = e.getBoundingClientRect();
      return { t: e.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (items.length < 6) return null;
  const num = i => /^-?\d+(\.\d+)?$/.test(i.t);
  const heads = items.filter(i => !num(i));
  const vals = items.filter(num);
  if (!heads.length || !vals.length) return null;
  const topY = Math.min(...heads.map(h => h.y));
  const cols = heads.filter(h => Math.abs(h.y - topY) < 20).sort((a, b) => a.x - b.x);
  const rows = heads.filter(h => Math.abs(h.y - topY) >= 20).sort((a, b) => a.y - b.y);
  if (!cols.length || !rows.length) return null;
  const at = (r, c) => {
    let best = null, bd = Infinity;
    for (const v of vals) {
      const dd = Math.abs(v.y - r.y) + Math.abs(v.x - c.x);
      if (dd < bd) { bd = dd; best = v; }
    }
    return best && bd < 120 ? parseFloat(best.t) : null;
  };
  return { cols, rows, at, norm: s => s.toLowerCase().replace(/[^a-z0-9]/g, '') };
};
window.__duo.frequencyAnswer = function () {
  const ins = this.curInstruction();
  if (!/frequency/.test(ins)) return null;
  const T = this.labeledTable(); if (!T) return null;
  const q = T.norm(ins);
  const find = list => list.filter(h => q.includes(T.norm(h.t)));
  const rowHit = find(T.rows).filter(h => !/^total$/i.test(h.t));
  const colHit = find(T.cols).filter(h => !/^total$/i.test(h.t));
  if (/joint/.test(ins) && rowHit.length && colHit.length) return T.at(rowHit[0], colHit[0]);
  if (/marginal/.test(ins)) {
    const totalCol = T.cols.find(c => /^total$/i.test(c.t));
    const totalRow = T.rows.find(r => /^total$/i.test(r.t));
    if (rowHit.length && totalCol) return T.at(rowHit[0], totalCol);
    if (colHit.length && totalRow) return T.at(totalRow, colHit[0]);
    // no explicit total header: sum the label's line
    if (rowHit.length) return T.cols.reduce((a, c) => { const v = T.at(rowHit[0], c); return v === null ? a : a + v; }, 0);
    if (colHit.length) return T.rows.reduce((a, r) => { const v = T.at(r, colHit[0]); return v === null ? a : a + v; }, 0);
  }
  if (rowHit.length && colHit.length) return T.at(rowHit[0], colHit[0]);
  return null;
};
(function () {
  const RE = /frequency/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) { const v = this.frequencyAnswer(); if (v !== null && v !== undefined) return v; }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const v = this.frequencyAnswer();
      if (v !== null && v !== undefined) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-6; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// Unit 171+ mixes in definition questions with nothing to compute. A short
// glossary keyed on distinctive prompt wording; each entry lists the word the
// blank wants. Falls through when the prompt is not a definition.
window.__duo.GLOSSARY = [
  [/dot plot uses dots.*show the/i, ['frequency']],
  [/histogram/i, ['bins', 'intervals', 'frequency']],
  [/box plot|box-and-whisker/i, ['quartiles', 'median']],
  [/middle value|half the (data|values) (are|is) below/i, ['median']],
  [/most (frequent|common) value/i, ['mode']],
  [/sum of the values divided|average of the/i, ['mean']],
  [/spread of the middle|interquartile/i, ['range', 'iqr']],
  [/difference between the (largest|maximum) and/i, ['range']],
  [/outlier/i, ['outlier']],
  [/strength and direction/i, ['correlation']],
  [/line of best fit|trend line/i, ['residual', 'slope']],
  [/predicted value|expected value on the line/i, ['predicted']],
  [/observed value|actual data point/i, ['observed']],
  [/symmetric|skewed/i, ['skewed', 'symmetric']],
];
window.__duo.solveGlossary = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const ins = this.curInstruction();
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
  for (const [re, answers] of this.GLOSSARY) {
    if (!re.test(ins)) continue;
    for (const a of answers) {
      const i = words.findIndex(w => w === a || w.startsWith(a));
      if (i >= 0) return { i };
    }
  }
  return null;
};
window.__duo.RULES.unshift(['solveGlossary', /fill in the blank|uses dots|plot|median|mean|mode|outlier/i]);
;'__duo ready';

// "Make the total frequency 11" with a displayed sum "total = 7 + <slider>":
// solve the shown arithmetic for the slider value.
window.__duo.solveSumSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  const parts = this.mathParts();
  const goal = parts.concat([this.curInstruction()]).join(' ').replace(/\s/g, '')
    .match(/make(?:the)?[a-z]*?(-?\d+(?:\.\d+)?)$/i);
  if (!goal) return false;
  const target = parseFloat(goal[1]);
  const line = parts.find(t => /duodisplay/.test(t) && /=/.test(t));
  if (!line) return false;
  const rhs = line.split('=').pop();
  for (let v = S.s.min; v <= S.s.max; v += S.s.step) {
    const expr = rhs.replace(/duodisplay-?[\d.]+-?[\d.]+/, '(' + v + ')')
                    .replace(/duodisplay/, '(' + v + ')');
    const g = this.compile(expr); if (!g) continue;
    let out; try { out = g(0); } catch (e) { continue; }
    if (isFinite(out) && Math.abs(out - target) < 1e-9) return await this.setSlider2d(v);
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveSumSlider()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// two fixes: find the goal in an individual prompt line (the joined string ends
// with the template, not the target), and substitute into the RAW LaTeX where
// \duodisplay{6}{1} still has delimited arguments.
window.__duo.solveSumSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  let target = null;
  for (const t of this.mathParts().concat([this.curInstruction().replace(/\s/g, '')])) {
    const m = t.match(/make[a-z]*?(-?\d+(?:\.\d+)?)$/i);
    if (m) { target = parseFloat(m[1]); break; }
  }
  if (target === null) return false;
  const raw = this.promptLatex().find(l => /duodisplay/.test(this.ascii(l)) && /=/.test(this.ascii(l)));
  if (!raw) return false;
  for (let v = S.s.min; v <= S.s.max; v += S.s.step) {
    const expr = this.ascii(raw)
      .replace(/\\duodisplay\{[^{}]*\}\{[^{}]*\}/g, '(' + v + ')')
      // \frac{1}{3} must become (1)/(3) BEFORE braces are stripped
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
      .replace(/\\(mathbf|textbf|text)\b/g, '')
      .replace(/\\cdot|\\times/g, '*')
      // "16\pi" vs "\pi r^2": pi cancels on both sides, so drop it.
      .replace(/\\pi/g, '(3.141592653589793)')
      .replace(/[{}\s\\]/g, '')
      .split('=').pop();
    const g = this.compile(expr); if (!g) continue;
    let out; try { out = g(0); } catch (e) { continue; }
    if (isFinite(out) && Math.abs(out - target) < 1e-9) return await this.setSlider2d(v);
  }
  return false;
};
;'__duo ready';

window.__duo.GLOSSARY.unshift(
  [/taller stacks/i, ['more']],
  [/shorter stacks/i, ['less', 'fewer']],
  [/each dot represents/i, ['onedatapoint', 'one', 'datapoint']],
  [/wider (box|spread)/i, ['more']],
  [/the (mean|average) is (pulled|affected)/i, ['outliers', 'outlier']],
  [/resistant to outliers|not affected by outliers/i, ['median']],
);
;'__duo ready';

// run2 checks plan() BEFORE the choice branch, so any plan on a screen that is
// really multiple choice (or a text input) sends it down the drag path and the
// question never gets answered. Interactive-widget plans only apply when there
// is nothing to click or type.
(function () {
  const base = window.__duo.plan;
  window.__duo.plan = function () {
    const p = base.call(this);
    if (!p) return null;
    const soft = ['slider2d', 'gridpoint', 'plotdata', 'tablefill'].includes(p.kind);
    if (soft && (document.querySelector('[data-test="challenge-choice"]') ||
                 document.querySelector('[data-test="challenge-text-input"]'))) return null;
    return p;
  };
})();
;'__duo ready';

// Unit 171 dot plots live in their own iframe (class "dot-plot") and are drawn
// as plain SVG marks, not diagram components. Read the marks' screen x, group
// them into columns, and map each column to its axis label.
window.__duo.dotPlot = function () {
  const f = [...document.querySelectorAll('iframe')]
    .find(fr => { try { return /dot-plot/.test(fr.contentDocument.body.innerHTML.slice(0, 4000)); } catch (e) { return false; } });
  if (!f) return null;
  const doc = f.contentDocument;
  const marks = [...doc.querySelectorAll('circle,ellipse,image,path')]
    .filter(e => /dot|point|marker/i.test(e.getAttribute('class') || ''))
    .map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })
    .filter(m => m.x || m.y);
  const labels = [...doc.querySelectorAll('div,span,text,tspan')]
    .filter(e => e.children.length === 0 && /^-?\d+(\.\d+)?$/.test(e.textContent.trim()))
    .map(e => { const r = e.getBoundingClientRect(); return { v: parseFloat(e.textContent.trim()), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (!marks.length || !labels.length) return null;
  const axisY = Math.max(...labels.map(l => l.y));
  const axis = labels.filter(l => Math.abs(l.y - axisY) < 20);
  if (!axis.length) return null;
  const counts = {};
  for (const l of axis) counts[l.v] = 0;
  for (const m of marks) {
    let best = null, bd = Infinity;
    for (const l of axis) { const d = Math.abs(l.x - m.x); if (d < bd) { bd = d; best = l; } }
    if (best && bd < 30) counts[best.v]++;
  }
  return counts;
};
window.__duo.dotPlotAnswer = function () {
  const ins = this.curInstruction();
  if (!/frequency/.test(ins)) return null;
  const C = this.dotPlot(); if (!C) return null;
  if (/total frequency/.test(ins)) return Object.values(C).reduce((a, b) => a + b, 0);
  const m = ins.replace(/\s/g, '').match(/value(-?\d+(?:\.\d+)?)/);
  if (m) { const v = parseFloat(m[1]); return v in C ? C[v] : null; }
  return null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = this.dotPlotAnswer(); if (v !== null && v !== undefined) return v;
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const v = this.dotPlotAnswer();
    if (v !== null && v !== undefined) {
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-6; });
      if (i >= 0) return { i };
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// each dot renders as several stacked <path> layers, so collapse marks that sit
// on the same spot before counting
(function () {
  const base = window.__duo.dotPlot;
  window.__duo.dotPlot = function () {
    const f = [...document.querySelectorAll('iframe')]
      .find(fr => { try { return /dot-plot/.test(fr.contentDocument.body.innerHTML.slice(0, 4000)); } catch (e) { return false; } });
    if (!f) return base.call(this);
    const doc = f.contentDocument;
    let marks = [...doc.querySelectorAll('circle,ellipse,image,path')]
      .filter(e => /dot|point|marker/i.test(e.getAttribute('class') || ''))
      .map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })
      .filter(m => m.x || m.y);
    const uniq = [];
    for (const m of marks) if (!uniq.some(u => Math.abs(u.x - m.x) < 6 && Math.abs(u.y - m.y) < 6)) uniq.push(m);
    marks = uniq;
    const labels = [...doc.querySelectorAll('div,span,text,tspan')]
      .filter(e => e.children.length === 0 && /^-?\d+(\.\d+)?$/.test(e.textContent.trim()))
      .map(e => { const r = e.getBoundingClientRect(); return { v: parseFloat(e.textContent.trim()), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (!marks.length || !labels.length) return null;
    const axisY = Math.max(...labels.map(l => l.y));
    const axis = labels.filter(l => Math.abs(l.y - axisY) < 20);
    if (!axis.length) return null;
    const counts = {};
    for (const l of axis) counts[l.v] = 0;
    for (const m of marks) {
      let best = null, bd = Infinity;
      for (const l of axis) { const d = Math.abs(l.x - m.x); if (d < bd) { bd = d; best = l; } }
      if (best && bd < 30) counts[best.v]++;
    }
    return counts;
  };
})();
;'__duo ready';

// Dot plot "Plot the data 8, 9, 10, 10, 11, 12": one draggable dot per axis
// value, dragged UP to that value's frequency.
window.__duo.solveDotPlotBuild = async function () {
  const pts = this.gridPoints(); if (pts.length < 2) return false;
  if (!pts.every(p => Math.abs(p.y) < 1e-9 || p.y >= 0)) return false;
  const line = this.promptLatex()
    .map(l => this.ascii(l).replace(/\\(mathbf|textbf|text|left|right)\b/g, '').replace(/[{}\s\\]/g, ''))
    .find(t => /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?)+$/.test(t));
  if (!line) return false;
  const data = line.split(',').map(Number);
  const freq = {};
  for (const v of data) freq[v] = (freq[v] || 0) + 1;
  for (const p of pts) {
    const want = freq[p.x] || 0;
    if (Math.abs(p.y - want) < 1e-9) continue;
    await this.dragPointTo(p, p.x, want);
  }
  return this.gridPoints().every(p => Math.abs(p.y - (freq[p.x] || 0)) < 1e-6);
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveDotPlotBuild()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// the LaTeX puts a thin space between items, so the flattened list is
// "8,,9,,10,,10,,11,,12" — collapse repeated separators before parsing
(function () {
  const base = window.__duo.solveDotPlotBuild;
  window.__duo.solveDotPlotBuild = async function () {
    const pts = this.gridPoints(); if (pts.length < 2) return false;
    const line = this.promptLatex()
      .map(l => this.ascii(l).replace(/\\(mathbf|textbf|text|left|right)\b/g, '').replace(/[{}\s\\]/g, '').replace(/,+/g, ','))
      .find(t => /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?)+$/.test(t));
    if (!line) return await base.call(this);
    const freq = {};
    for (const v of line.split(',').map(Number)) freq[v] = (freq[v] || 0) + 1;
    for (const p of pts) {
      const want = freq[p.x] || 0;
      if (Math.abs(p.y - want) < 1e-9) continue;
      await this.dragPointTo(p, p.x, want);
    }
    return this.gridPoints().every(p => Math.abs(p.y - (freq[p.x] || 0)) < 1e-6);
  };
})();
;'__duo ready';

// Dot-plot dots ignore synthetic pointer events entirely — they only respond to
// a real OS-level mouse drag (the Chrome `computer` tool). This helper computes
// the drags needed; the caller performs them.
// Dots move BETWEEN columns (they are not stretched vertically): a column needs
// as many dots as the value's frequency in the data.
window.__duo.dotPlotDrags = function () {
  const pts = this.gridPoints(); if (pts.length < 2) return null;
  const line = this.promptLatex()
    .map(l => this.ascii(l).replace(/\\(mathbf|textbf|text|left|right)\b/g, '').replace(/[{}\s\\]/g, '').replace(/,+/g, ','))
    .find(t => /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?)+$/.test(t));
  if (!line) return null;
  const data = line.split(',').map(Number);
  const need = {};
  for (const v of data) need[v] = (need[v] || 0) + 1;
  const have = {};
  for (const p of pts) have[p.x] = (have[p.x] || 0) + 1;
  const surplus = [], deficit = [];
  for (const p of pts) {
    const n = need[p.x] || 0;
    if ((have[p.x] || 0) > n) { surplus.push(p); have[p.x]--; }
  }
  for (const x of Object.keys(need).map(Number))
    for (let k = (have[x] || 0); k < need[x]; k++) deficit.push(x);
  if (surplus.length !== deficit.length) return null;
  const d = this.diagram(), fr = d.f.getBoundingClientRect(), g = d.M.grid;
  const scr = p => { const el = p.element.querySelector('circle') || p.element, r = el.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  const colX = x => { const same = pts.find(p => p.x === x); return same ? scr(same)[0] : null; };
  const out = [];
  surplus.forEach((p, i) => {
    const x = deficit[i], cx = colX(x);
    if (cx === null) return;
    const from = scr(p);
    out.push({ from, to: [cx, from[1] - 26] });   // land above the column to stack
  });
  return out.length ? out : null;
};
;'__duo ready';

// total frequency = how many dots are plotted; when the dots are diagram
// components rather than raw SVG marks, just count them
(function () {
  const base = window.__duo.dotPlotAnswer;
  window.__duo.dotPlotAnswer = function () {
    const v = base.call(this); if (v !== null && v !== undefined) return v;
    const ins = this.curInstruction();
    if (!/frequency/.test(ins)) return null;
    const pts = this.plottedPoints();
    if (!pts.length) return null;
    if (/total frequency/.test(ins)) return pts.length;
    const m = ins.replace(/\s/g, '').match(/value(-?\d+(?:\.\d+)?)/);
    if (m) { const x = parseFloat(m[1]); return pts.filter(p => Math.abs(p[0] - x) < 1e-9).length; }
    return null;
  };
})();
;'__duo ready';

// The Chrome `computer` tool works in SCREENSHOT space (1568 wide), while the
// page reports CSS pixels (innerWidth 1864 here). Emit both so the caller can
// drag with the right numbers — mixing the two silently misses every target.
window.__duo.toShot = function (xy) {
  const s = 1568 / window.innerWidth;
  return [Math.round(xy[0] * s), Math.round(xy[1] * s)];
};
(function () {
  const base = window.__duo.dotPlotDrags;
  window.__duo.dotPlotDrags = function () {
    const d = base.call(this); if (!d) return null;
    return d.map(g => ({ from: this.toShot(g.from), to: this.toShot(g.to), css: g }));
  };
})();
;'__duo ready';

// dots are sometimes <g class="point static normal"> wrappers, not bare shapes
(function () {
  const base = window.__duo.dotPlot;
  window.__duo.dotPlot = function () {
    const f = [...document.querySelectorAll('iframe')]
      .find(fr => { try { return /dot-plot/.test(fr.contentDocument.body.innerHTML.slice(0, 4000)); } catch (e) { return false; } });
    if (!f) return base.call(this);
    const doc = f.contentDocument;
    let marks = [...doc.querySelectorAll('g,circle,ellipse,image,path')]
      .filter(e => /(^|\s)(point|dot|marker)(\s|$)/i.test(e.getAttribute('class') || ''))
      .map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; })
      .filter(m => m.w > 0);
    const uniq = [];
    for (const m of marks) if (!uniq.some(u => Math.abs(u.x - m.x) < 6 && Math.abs(u.y - m.y) < 6)) uniq.push(m);
    marks = uniq;
    const labels = [...doc.querySelectorAll('div,span,text,tspan')]
      .filter(e => e.children.length === 0 && /^-?\d+(\.\d+)?$/.test(e.textContent.trim()))
      .map(e => { const r = e.getBoundingClientRect(); return { v: parseFloat(e.textContent.trim()), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (!marks.length || !labels.length) return null;
    const axisY = Math.max(...labels.map(l => l.y));
    const axis = labels.filter(l => Math.abs(l.y - axisY) < 20);
    if (!axis.length) return null;
    const counts = {};
    for (const l of axis) counts[l.v] = 0;
    for (const m of marks) {
      let best = null, bd = Infinity;
      for (const l of axis) { const d = Math.abs(l.x - m.x); if (d < bd) { bd = d; best = l; } }
      if (best && bd < 30) counts[best.v]++;
    }
    return counts;
  };
})();
;'__duo ready';

// Dot-plot "plot the data" needs a real OS mouse drag, which no in-page solver
// can do. Hand it back immediately (run2 logs needdrag and stops) instead of
// letting a generic drag solver submit a wrong answer and burn a heart.
window.__duo.needsRealMouse = function () {
  if (!/plot the data|complete the (dot )?plot/i.test(this.curInstruction())) return false;
  return !!this.dotPlotDrags() || this.gridPoints().length > 1;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.needsRealMouse()) return false;
    return await base.call(this);
  };
})();
;'__duo ready';

// Unit 173+: rigid motions. When a point and its image are both plotted, the
// mirror line sits halfway between them, so the distance from either point to
// the line is half the separation.
window.__duo.reflectionDistance = function () {
  const P = this.plottedPoints();
  if (P.length !== 2) return null;
  const d = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
  const half = d / 2;
  return Math.abs(half - Math.round(half)) < 1e-6 ? Math.round(half) : Math.round(half * 100) / 100;
};
(function () {
  const RE = /distance from [a-z].{0,24}line of reflection|distance to the (mirror|line of reflection)/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) { const v = this.reflectionDistance(); if (v !== null) return v; }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const v = this.reflectionDistance();
      if (v !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-6; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// "Place the line as the line of reflection": a slider moves a vertical (or
// horizontal) line; it belongs at the midpoint between the point and its image.
// The line's own two endpoints share a coordinate, which is how they are told
// apart from the point pair.
window.__duo.solveMirrorSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  if (!/line of reflection|mirror/i.test(this.curInstruction())) return false;
  const P = this.plottedPoints(); if (P.length < 4) return false;
  const groupBy = i => { const m = {}; for (const p of P) (m[p[i]] = m[p[i]] || []).push(p); return m; };
  let pair = null, axis = null;
  for (const i of [0, 1]) {
    const g = groupBy(i);
    const lineKey = Object.keys(g).find(k => g[k].length === 2 && P.length - 2 === 2);
    if (!lineKey) continue;
    const rest = P.filter(p => String(p[i]) !== lineKey);
    if (rest.length === 2) { pair = rest; axis = i; break; }
  }
  if (!pair) return false;
  const mid = (pair[0][axis] + pair[1][axis]) / 2;
  if (mid < S.s.min || mid > S.s.max) return false;
  return await this.setSlider2d(mid);
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveMirrorSlider()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// Real shape: several labelled points and their images (A→A', B→B'). Pair each
// point with its image by the coordinate they share, then the mirror sits at
// the common midpoint. The line's own two endpoints are the pair sitting at the
// slider's current value.
window.__duo.solveMirrorSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  if (!/line of reflection|mirror/i.test(this.curInstruction())) return false;
  const cur = this.sliderValue();
  let P = this.plottedPoints(); if (P.length < 4) return false;
  for (const axis of [0, 1]) {
    const other = 1 - axis;
    // drop the line: two points whose axis coordinate is the slider's value
    const pts = P.filter(p => cur === null || p[axis] !== cur);
    if (pts.length < 2 || pts.length % 2) continue;
    const groups = {};
    for (const p of pts) (groups[p[other]] = groups[p[other]] || []).push(p);
    const mids = [];
    let ok = true;
    for (const k of Object.keys(groups)) {
      const g = groups[k];
      if (g.length !== 2) { ok = false; break; }
      mids.push((g[0][axis] + g[1][axis]) / 2);
    }
    if (!ok || !mids.length) continue;
    if (mids.some(m => Math.abs(m - mids[0]) > 1e-9)) continue;
    const mid = mids[0];
    if (mid < S.s.min || mid > S.s.max) continue;
    return await this.setSlider2d(mid);
  }
  return false;
};
;'__duo ready';

// "Perform the transformation: reflection" — one draggable point and a drawn
// mirror line. Find the line in grid coordinates (grid.pixelToGrid on its
// rendered position), reflect the point across it, and drag it there.
window.__duo.mirrorLine = function () {
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const doc = d.f.contentDocument, fr = d.f.getBoundingClientRect();
  const cands = [...doc.querySelectorAll('line,path')]
    .filter(e => { const c = e.getAttribute('class') || '';
      return /arrow|reference|reflection|mirror/i.test(c) && !/axis|grid/i.test(c); })
    .map(e => e.getBoundingClientRect())
    .filter(r => r.width > 20 || r.height > 20);
  if (!cands.length) return null;
  const r = cands.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
  const g = d.M.grid;
  const toGrid = (px, py) => { try { return g.pixelToGrid([px, py]); } catch (e) { return null; } };
  const a = toGrid(r.left, r.top), b = toGrid(r.right, r.bottom);
  if (!a || !b) return null;
  if (r.width > r.height) return { horiz: true, at: (a[1] + b[1]) / 2 };
  return { horiz: false, at: (a[0] + b[0]) / 2 };
};
window.__duo.solveReflectPoint = async function () {
  if (!/reflect/i.test(this.curInstruction())) return false;
  const pts = this.gridPoints(); if (pts.length !== 1) return false;
  const L = this.mirrorLine(); if (!L) return false;
  const p = pts[0];
  const at = Math.round(L.at * 2) / 2;
  const target = L.horiz ? [p.x, 2 * at - p.y] : [2 * at - p.x, p.y];
  if (Math.abs(target[0] - p.x) < 1e-9 && Math.abs(target[1] - p.y) < 1e-9) return false;
  await this.dragPointTo(p, target[0], target[1]);
  const q = this.gridPoints()[0];
  return !!q && Math.abs(q.x - target[0]) < 1e-6 && Math.abs(q.y - target[1]) < 1e-6;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveReflectPoint()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// the mirror's class is "axis-of-reflection", which my /axis/ exclusion ate
window.__duo.mirrorLine = function () {
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const doc = d.f.contentDocument, fr = d.f.getBoundingClientRect();
  const el = [...doc.querySelectorAll('line,path')]
    .filter(e => /axis-of-reflection|line-of-reflection|reference-line|mirror/i.test(e.getAttribute('class') || ''))
    .map(e => e.getBoundingClientRect())
    .filter(r => r.width > 20 || r.height > 20)
    .sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height))[0];
  if (!el) return null;
  const g = d.M.grid;
  const toGrid = (px, py) => { try { return g.pixelToGrid([px, py]); } catch (e) { return null; } };
  const a = toGrid(el.left, el.top), b = toGrid(el.right, el.bottom);
  if (!a || !b) return null;
  return el.width >= el.height
    ? { horiz: true, at: (a[1] + b[1]) / 2 }
    : { horiz: false, at: (a[0] + b[0]) / 2 };
};
;'__duo ready';

// Reflect EVERY draggable point (a segment or polygon, not just one point), and
// snap the mirror's measured position to the value that sends the points to
// whole-number coordinates.
window.__duo.solveReflectPoint = async function () {
  if (!/reflect/i.test(this.curInstruction())) return false;
  const pts = this.gridPoints(); if (!pts.length) return false;
  const L = this.mirrorLine(); if (!L) return false;
  const axis = L.horiz ? 1 : 0;
  const cands = [Math.round(L.at), Math.round(L.at * 2) / 2];
  let at = null;
  for (const c of cands) {
    if (pts.every(p => Math.abs((2 * c - p[axis ? 'y' : 'x']) % 1) < 1e-6)) { at = c; break; }
  }
  if (at === null) at = Math.round(L.at * 2) / 2;
  const targets = pts.map(p => axis ? [p.x, 2 * at - p.y] : [2 * at - p.x, p.y]);
  if (targets.every((t, i) => Math.abs(t[0] - pts[i].x) < 1e-9 && Math.abs(t[1] - pts[i].y) < 1e-9)) return false;
  for (let i = 0; i < pts.length; i++) {
    const p = this.gridPoints()[i]; if (!p) return false;
    if (Math.abs(p.x - targets[i][0]) < 1e-9 && Math.abs(p.y - targets[i][1]) < 1e-9) continue;
    await this.dragPointTo(p, targets[i][0], targets[i][1]);
  }
  const now = this.gridPoints();
  return targets.every(t => now.some(q => Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6));
};
;'__duo ready';

// The rendered rect is offset from the diagram's own pixel space (there is a
// translate on the group), so pixelToGrid on screen coordinates was wrong.
// Use the <line>'s own x1/y1/x2/y2 attributes, which are already in that space.
window.__duo.mirrorLine = function () {
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const doc = d.f.contentDocument, g = d.M.grid;
  const el = [...doc.querySelectorAll('line,path')]
    .find(e => /axis-of-reflection|line-of-reflection|reference-line|mirror/i.test(e.getAttribute('class') || ''));
  if (!el) return null;
  const n = a => parseFloat(el.getAttribute(a));
  const x1 = n('x1'), y1 = n('y1'), x2 = n('x2'), y2 = n('y2');
  const toGrid = (px, py) => { try { return g.pixelToGrid([px, py]); } catch (e) { return null; } };
  if ([x1, y1, x2, y2].every(v => isFinite(v))) {
    const a = toGrid(x1, y1), b = toGrid(x2, y2);
    if (!a || !b) return null;
    return Math.abs(a[0] - b[0]) < 1e-6
      ? { horiz: false, at: a[0] }
      : { horiz: true, at: a[1] };
  }
  const r = el.getBoundingClientRect();
  const c = toGrid(r.left + r.width / 2, r.top + r.height / 2);
  if (!c) return null;
  return r.width >= r.height ? { horiz: true, at: c[1] } : { horiz: false, at: c[0] };
};
;'__duo ready';

// the class selector also matched a 0x0 <path> template in <defs>; prefer a real
// <line> that carries x1/x2 coordinates
window.__duo.mirrorLine = function () {
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const doc = d.f.contentDocument, g = d.M.grid;
  const RE = /axis-of-reflection|line-of-reflection|reference-line|mirror/i;
  const withCoords = [...doc.querySelectorAll('line')]
    .filter(e => RE.test(e.getAttribute('class') || ''))
    .filter(e => ['x1', 'y1', 'x2', 'y2'].every(a => isFinite(parseFloat(e.getAttribute(a)))));
  const toGrid = (px, py) => { try { return g.pixelToGrid([px, py]); } catch (e) { return null; } };
  if (withCoords.length) {
    const el = withCoords[0], n = a => parseFloat(el.getAttribute(a));
    const a = toGrid(n('x1'), n('y1')), b = toGrid(n('x2'), n('y2'));
    if (!a || !b) return null;
    return Math.abs(a[0] - b[0]) < 1e-6 ? { horiz: false, at: a[0] } : { horiz: true, at: a[1] };
  }
  const el = [...doc.querySelectorAll('line,path')]
    .filter(e => RE.test(e.getAttribute('class') || ''))
    .map(e => e.getBoundingClientRect())
    .filter(r => r.width > 20 || r.height > 20)
    .sort((x, y) => Math.max(y.width, y.height) - Math.max(x.width, x.height))[0];
  if (!el) return null;
  const c = toGrid(el.left + el.width / 2, el.top + el.height / 2);
  if (!c) return null;
  return el.width >= el.height ? { horiz: true, at: c[1] } : { horiz: false, at: c[0] };
};
;'__duo ready';

// "Select the rigid motion from A to A'": split the plotted vertices into the
// two congruent shapes, then test candidate maps — translation, reflection in a
// horizontal/vertical line, rotation by 90/180/270 — and name the one that fits.
window.__duo.rigidMotion = function () {
  const P = this.plottedPoints();
  if (P.length < 2 || P.length % 2) return null;
  const half = P.length / 2;
  const A = P.slice(0, half), B = P.slice(half);
  const same = (X, Y) => X.length === Y.length &&
    X.every(p => Y.some(q => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6));
  // translation
  const v = [B[0][0] - A[0][0], B[0][1] - A[0][1]];
  if (same(A.map(p => [p[0] + v[0], p[1] + v[1]]), B)) return 'translation';
  // reflection in a vertical or horizontal line
  const xs = A.map(p => p[0]).concat(B.map(p => p[0]));
  const ys = A.map(p => p[1]).concat(B.map(p => p[1]));
  for (let k = Math.min(...xs) * 2; k <= Math.max(...xs) * 2; k += 1)
    if (same(A.map(p => [k - p[0], p[1]]), B)) return 'reflection';
  for (let k = Math.min(...ys) * 2; k <= Math.max(...ys) * 2; k += 1)
    if (same(A.map(p => [p[0], k - p[1]]), B)) return 'reflection';
  // rotation about any half-integer centre in range
  const rot = (p, c, deg) => {
    const dx = p[0] - c[0], dy = p[1] - c[1];
    if (deg === 90) return [c[0] - dy, c[1] + dx];
    if (deg === 180) return [c[0] - dx, c[1] - dy];
    return [c[0] + dy, c[1] - dx];
  };
  for (let cx = Math.min(...xs); cx <= Math.max(...xs); cx += 0.5)
    for (let cy = Math.min(...ys); cy <= Math.max(...ys); cy += 0.5)
      for (const deg of [90, 180, 270])
        if (same(A.map(p => rot(p, [cx, cy], deg)), B)) return 'rotation';
  return null;
};
window.__duo.solveRigidMotion = function () {
  const ins = this.curInstruction();
  if (!/rigid motion|which (transformation|motion)|select the match/i.test(ins)) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase());
  if (!words.some(w => /translat|rotat|reflect/.test(w))) return null;
  const k = this.rigidMotion(); if (!k) return null;
  const i = words.findIndex(w => w.includes(k.slice(0, 7)));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveRigidMotion', /rigid motion|which (transformation|motion)|select the match/i]);
;'__duo ready';

// Right-triangle questions ("select the side length opposite the 23° angle",
// "select the hypotenuse"). Read the diagram's labels with their positions: the
// side opposite a vertex is the label farthest from that vertex, and the
// hypotenuse is the side opposite the right angle.
window.__duo.diagramLabels = function () {
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  return [...doc.querySelectorAll('div,span,text,tspan')]
    .filter(e => e.children.length === 0 && e.textContent.trim())
    .map(e => { const r = e.getBoundingClientRect();
      return { t: e.textContent.trim().normalize('NFKC'), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })
    .filter(l => l.x || l.y);
};
window.__duo.rightAngleXY = function () {
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const el = [...doc.querySelectorAll('rect,path,polygon,polyline')]
    .find(e => /right-angle|square-angle|perpendicular/i.test(e.getAttribute('class') || ''));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
window.__duo.solveTriangleSide = function () {
  const ins = this.curInstruction();
  const L = this.diagramLabels(); if (!L) return null;
  const isNum = l => /^-?\d+(\.\d+)?$/.test(l.t);
  const sides = L.filter(l => isNum(l) || /^[a-z]$/i.test(l.t));
  if (sides.length < 3) return null;
  let vertex = null;
  const m = ins.replace(/\s/g, '').match(/opposite(?:the)?(-?\d+(?:\.\d+)?)/);
  if (m) vertex = L.find(l => l.t.replace(/\s/g, '').startsWith(m[1] + '°') || l.t.replace(/\s/g, '') === m[1] + '°');
  if (!vertex && /hypotenuse/i.test(ins)) vertex = this.rightAngleXY();
  if (!vertex) return null;
  let best = null, bd = -1;
  for (const s of sides) {
    const dd = Math.hypot(s.x - vertex.x, s.y - vertex.y);
    if (dd > bd) { bd = dd; best = s; }
  }
  if (!best) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const want = best.t.replace(/\s/g, '');
  const i = ch.findIndex(e => this.plainMath(this.choiceLatex(e)).replace(/\s/g, '') === want);
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveTriangleSide', /hypotenuse|opposite the|adjacent to/i]);
;'__duo ready';

// "adjacent to the 67° angle" means the LEG touching that vertex, so the
// hypotenuse (the longest side) has to be excluded before taking the nearest.
(function () {
  const base = window.__duo.solveTriangleSide;
  window.__duo.solveTriangleSide = function () {
    const ins = this.curInstruction();
    if (!/adjacent to/i.test(ins)) return base.call(this);
    const L = this.diagramLabels(); if (!L) return null;
    const nums = L.filter(l => /^-?\d+(\.\d+)?$/.test(l.t));
    if (nums.length < 3) return null;
    const m = ins.replace(/\s/g, '').match(/adjacentto(?:the)?(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const vertex = L.find(l => l.t.replace(/\s/g, '').startsWith(m[1] + '°'));
    if (!vertex) return null;
    const hyp = nums.reduce((a, b) => parseFloat(b.t) > parseFloat(a.t) ? b : a);
    const legs = nums.filter(n => n !== hyp);
    let best = null, bd = Infinity;
    for (const s of legs) {
      const dd = Math.hypot(s.x - vertex.x, s.y - vertex.y);
      if (dd < bd) { bd = dd; best = s; }
    }
    if (!best) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => this.plainMath(this.choiceLatex(e)).replace(/\s/g, '') === best.t.replace(/\s/g, ''));
    return i < 0 ? null : { i };
  };
})();
;'__duo ready';

// No right-angle marker class exists on these triangles. Read the actual
// polygon: its longest edge is the hypotenuse, and each side label sits at an
// edge midpoint, so the label nearest that edge names it.
window.__duo.trianglePolygon = function () {
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const el = [...doc.querySelectorAll('polygon,polyline')]
    .find(e => /(^|\s)shape(\s|$)|polygon/i.test(e.getAttribute('class') || ''));
  if (!el) return null;
  const raw = el.getAttribute('points'); if (!raw) return null;
  const ns = raw.trim().split(/[\s,]+/).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < ns.length; i += 2) pts.push([ns[i], ns[i + 1]]);
  if (pts.length < 3) return null;
  const ctm = el.getScreenCTM(); if (!ctm) return null;
  const svg = el.ownerSVGElement;
  const scr = p => { const q = svg.createSVGPoint(); q.x = p[0]; q.y = p[1];
    const t = q.matrixTransform(ctm); return [t.x, t.y]; };
  return pts.slice(0, 3).map(scr);
};
window.__duo.solveHypotenuse = function () {
  if (!/hypotenuse/i.test(this.curInstruction())) return null;
  const V = this.trianglePolygon(); if (!V) return null;
  const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
    len: Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1]),
    mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]
  }));
  const hyp = edges.reduce((a, b) => b.len > a.len ? b : a);
  const L = (this.diagramLabels() || []).filter(l => /^[a-z]$/i.test(l.t) || /^-?\d+(\.\d+)?$/.test(l.t));
  if (!L.length) return null;
  let best = null, bd = Infinity;
  for (const l of L) { const dd = Math.hypot(l.x - hyp.mid[0], l.y - hyp.mid[1]); if (dd < bd) { bd = dd; best = l; } }
  if (!best) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => this.plainMath(this.choiceLatex(e)).replace(/\s/g, '') === best.t.replace(/\s/g, ''));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveHypotenuse', /hypotenuse/i]);
;'__duo ready';

// The triangle is a <path> with rounded corners (M/Q), not a <polygon>, so read
// its geometry by sampling: farthest point from the centroid is one vertex, the
// farthest from that is the second, and the point farthest from that line is
// the third.
window.__duo.trianglePolygon = function () {
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const el = [...doc.querySelectorAll('path,polygon,polyline')]
    .find(e => /polygon|(^|\s)shape(\s|$)/i.test(e.getAttribute('class') || ''));
  if (!el || typeof el.getTotalLength !== 'function') return null;
  let L = 0; try { L = el.getTotalLength(); } catch (e) { return null; }
  if (!L) return null;
  const ctm = el.getScreenCTM(); if (!ctm) return null;
  const svg = el.ownerSVGElement;
  const P = [];
  for (let i = 0; i < 300; i++) {
    const q = el.getPointAtLength((i / 300) * L);
    const p = svg.createSVGPoint(); p.x = q.x; p.y = q.y;
    const t = p.matrixTransform(ctm);
    P.push([t.x, t.y]);
  }
  const cx = P.reduce((a, p) => a + p[0], 0) / P.length;
  const cy = P.reduce((a, p) => a + p[1], 0) / P.length;
  const far = (from, list) => list.reduce((a, p) =>
    Math.hypot(p[0] - from[0], p[1] - from[1]) > Math.hypot(a[0] - from[0], a[1] - from[1]) ? p : a);
  const A = far([cx, cy], P);
  const B = far(A, P);
  const distLine = p => Math.abs((B[0] - A[0]) * (A[1] - p[1]) - (A[0] - p[0]) * (B[1] - A[1])) /
                        Math.hypot(B[0] - A[0], B[1] - A[1]);
  const C = P.reduce((a, p) => distLine(p) > distLine(a) ? p : a);
  return [A, B, C];
};
;'__duo ready';

// "Identify the side opposite the labeled angle" — no degree value in the
// wording, and label-distance alone is fragile. Use the triangle's real
// geometry: find the vertex nearest the angle marker, then the edge that does
// not touch it.
window.__duo.angleLabel = function () {
  const L = this.diagramLabels() || [];
  const angles = L.filter(l => /°/.test(l.t));
  const m = this.curInstruction().replace(/\s/g, '').match(/(?:opposite|adjacentto)(?:the)?(-?\d+(?:\.\d+)?)/);
  if (m) { const hit = angles.find(a => a.t.replace(/\s/g, '').startsWith(m[1] + '°')); if (hit) return hit; }
  return angles.length === 1 ? angles[0] : null;
};
window.__duo.solveOppositeSide = function () {
  const ins = this.curInstruction();
  if (!/opposite|adjacent/i.test(ins)) return null;
  const V = this.trianglePolygon(); if (!V) return null;
  const A = this.angleLabel(); if (!A) return null;
  // the vertex the angle marker sits at
  let vi = 0, bd = Infinity;
  V.forEach((v, i) => { const d = Math.hypot(v[0] - A.x, v[1] - A.y); if (d < bd) { bd = d; vi = i; } });
  const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
    a, b, len: Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1]),
    mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]
  }));
  const hyp = edges.reduce((x, y) => y.len > x.len ? y : x);
  const want = /adjacent/i.test(ins)
    ? edges.find(e => (e.a === vi || e.b === vi) && e !== hyp)
    : edges.find(e => e.a !== vi && e.b !== vi);
  if (!want) return null;
  const labs = (this.diagramLabels() || []).filter(l => !/°/.test(l.t) && (/^[a-z]$/i.test(l.t) || /^-?\d+(\.\d+)?$/.test(l.t)));
  let best = null, bb = Infinity;
  for (const l of labs) { const d = Math.hypot(l.x - want.mid[0], l.y - want.mid[1]); if (d < bb) { bb = d; best = l; } }
  if (!best) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => this.plainMath(this.choiceLatex(e)).replace(/\s/g, '') === best.t.replace(/\s/g, ''));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveOppositeSide', /opposite|adjacent/i]);
;'__duo ready';

// "Enter the sine ratio as a fraction": build it from the triangle's geometry —
// sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent,
// each side read from the label nearest that edge's midpoint.
window.__duo.triangleSides = function () {
  const V = this.trianglePolygon(); if (!V) return null;
  const A = this.angleLabel(); if (!A) return null;
  let vi = 0, bd = Infinity;
  V.forEach((v, i) => { const d = Math.hypot(v[0] - A.x, v[1] - A.y); if (d < bd) { bd = d; vi = i; } });
  const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
    a, b, len: Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1]),
    mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]
  }));
  const hyp = edges.reduce((x, y) => y.len > x.len ? y : x);
  const opp = edges.find(e => e.a !== vi && e.b !== vi);
  const adj = edges.find(e => e !== hyp && e !== opp);
  if (!hyp || !opp || !adj) return null;
  const labs = (this.diagramLabels() || []).filter(l => /^-?\d+(\.\d+)?$/.test(l.t));
  const nameOf = e => { let best = null, bb = Infinity;
    for (const l of labs) { const d = Math.hypot(l.x - e.mid[0], l.y - e.mid[1]); if (d < bb) { bb = d; best = l; } }
    return best ? parseFloat(best.t) : null; };
  const o = nameOf(opp), a = nameOf(adj), h = nameOf(hyp);
  return (o === null || a === null || h === null) ? null : { opp: o, adj: a, hyp: h };
};
(function () {
  const RE = /(sine|cosine|tangent|sin|cos|tan)\s*ratio/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (RE.test(ins)) {
      const S = this.triangleSides();
      if (S) {
        const pair = /sine|sin/i.test(ins) && !/cos/i.test(ins) ? [S.opp, S.hyp]
                   : /cosine|cos/i.test(ins) ? [S.adj, S.hyp]
                   : /tangent|tan/i.test(ins) ? [S.opp, S.adj] : null;
        if (pair) return pair[0] + '/' + pair[1];
      }
    }
    return bo.call(this);
  };
  const bt = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]') && RE.test(this.curInstruction())) {
      const v = this.solveOutputAt();
      if (typeof v === 'string' && v.includes('/')) { this.type(v); return v; }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// The diagram iframe can still show the PREVIOUS question's triangle when the
// choices have already updated, which produced confidently wrong answers.
// Only trust the geometry when every numeric choice appears as a diagram label.
window.__duo.diagramFresh = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (!ch.length) return true;
  const labs = (this.diagramLabels() || []).map(l => l.t.replace(/°/g, '').trim());
  const vals = ch.map(e => this.plainMath(this.choiceLatex(e)).trim()).filter(v => /^-?\d+(\.\d+)?$/.test(v));
  if (!vals.length) return true;
  return vals.every(v => labs.includes(v));
};
(function () {
  for (const name of ['solveHypotenuse', 'solveOppositeSide', 'solveTriangleSide']) {
    const base = window.__duo[name];
    if (!base) continue;
    window.__duo[name] = function () { return this.diagramFresh() ? base.call(this) : null; };
  }
})();
;'__duo ready';

// Duolingo leaves earlier questions' diagram iframes in the DOM, and diagram()
// grabbed the FIRST one — so the solver read a previous triangle while the
// current choices belonged to a new one. Prefer the visible iframe.
window.__duo.visibleFrame = function () {
  const fs = [...document.querySelectorAll('iframe')].filter(f => {
    const r = f.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return false;
    if (r.bottom < 0 || r.top > (window.innerHeight || 0)) return false;
    const st = getComputedStyle(f);
    return st.visibility !== 'hidden' && st.display !== 'none' && parseFloat(st.opacity || '1') > 0.05;
  });
  return fs.length ? fs[fs.length - 1] : null;
};
(function () {
  const base = window.__duo.diagram;
  window.__duo.diagram = function () {
    const f = this.visibleFrame();
    if (f) {
      try {
        const w = f.contentWindow;
        if (w && w.mathDiagram) return { f, M: w.mathDiagram };
      } catch (e) {}
    }
    return base.call(this);
  };
  const bl = window.__duo.diagramLabels;
  window.__duo.diagramLabels = function () {
    const f = this.visibleFrame(); if (!f) return bl.call(this);
    try {
      return [...f.contentDocument.querySelectorAll('div,span,text,tspan')]
        .filter(e => e.children.length === 0 && e.textContent.trim())
        .map(e => { const r = e.getBoundingClientRect();
          return { t: e.textContent.trim().normalize('NFKC'), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })
        .filter(l => l.x || l.y);
    } catch (e) { return bl.call(this); }
  };
})();
;'__duo ready';

// trig ratios offered as fraction CHOICES, plus "enter the length of the side
// opposite/adjacent" typed answers
(function () {
  const RE = /(sine|cosine|tangent|sin|cos|tan)\s*ratio/i;
  const ratioOf = function () {
    const ins = this.curInstruction();
    const S = this.triangleSides(); if (!S) return null;
    if (/cosine|(^|[^a-z])cos/i.test(ins)) return [S.adj, S.hyp];
    if (/tangent|(^|[^a-z])tan/i.test(ins)) return [S.opp, S.adj];
    if (/sine|(^|[^a-z])sin/i.test(ins)) return [S.opp, S.hyp];
    return null;
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction()) && this.diagramFresh()) {
      const p = ratioOf.call(this);
      if (p) {
        const want = p[0] / p[1];
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - want) < 1e-9; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);

  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/length of the side (opposite|adjacent)/i.test(ins) && this.diagramFresh()) {
      const S = this.triangleSides();
      if (S) return /adjacent/i.test(ins) ? S.adj : S.opp;
    }
    if (/length of the hypotenuse/i.test(ins) && this.diagramFresh()) {
      const S = this.triangleSides(); if (S) return S.hyp;
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Solve for x" in a right triangle: the prompt shows a trig equation such as
// sin(30°) = x/2 or tan(40°) = 7/x. Solve it numerically and round the way the
// prompt asks (default: nearest tenth if not a whole number).
window.__duo.solveTrigEquation = function () {
  const parts = this.mathParts().concat([this.curInstruction().replace(/\s/g, '')]);
  const D = Math.PI / 180;
  for (const t of parts) {
    const m = t.match(/(sin|cos|tan)\(?(-?\d+(?:\.\d+)?)(?:°|degrees?)?\)?=(.+)$/i);
    if (!m) continue;
    const fn = { sin: Math.sin, cos: Math.cos, tan: Math.tan }[m[1].toLowerCase()];
    const lhs = fn(parseFloat(m[2]) * D);
    const rhs = m[3].replace(/[°]/g, '');
    let x = null;
    let q = rhs.match(/^x\/(-?\d+(?:\.\d+)?)$/);            // x / a  = lhs
    if (q) x = lhs * parseFloat(q[1]);
    if (x === null && (q = rhs.match(/^(-?\d+(?:\.\d+)?)\/x$/))) x = parseFloat(q[1]) / lhs;
    if (x === null && (q = rhs.match(/^frac{?x}?{?(-?\d+(?:\.\d+)?)}?$/))) x = lhs * parseFloat(q[1]);
    if (x === null && (q = rhs.match(/^fracx(-?\d+(?:\.\d+)?)$/))) x = lhs * parseFloat(q[1]);
    if (x === null && (q = rhs.match(/^frac(-?\d+(?:\.\d+)?)x$/))) x = parseFloat(q[1]) / lhs;
    if (x === null || !isFinite(x)) continue;
    const whole = Math.abs(x - Math.round(x)) < 1e-6;
    const dp = /nearest hundredth/i.test(this.curInstruction()) ? 2
             : /nearest whole|nearest integer/i.test(this.curInstruction()) ? 0 : 1;
    return whole ? Math.round(x) : Number(x.toFixed(dp));
  }
  return null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/solve for x|find x|value of x/i.test(this.curInstruction())) {
      const v = this.solveTrigEquation(); if (v !== null) return v;
    }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (/solve for x|find x|value of x/i.test(this.curInstruction())) {
      const v = this.solveTrigEquation();
      if (v !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 0.06; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /solve for x|find x|value of x/i]);
})();
;'__duo ready';

// Same geometry, but keep the label TEXT so an unknown side ("x") is usable.
window.__duo.triangleLabels = function () {
  const V = this.trianglePolygon(); if (!V) return null;
  const A = this.angleLabel(); if (!A) return null;
  let vi = 0, bd = Infinity;
  V.forEach((v, i) => { const d = Math.hypot(v[0] - A.x, v[1] - A.y); if (d < bd) { bd = d; vi = i; } });
  const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
    a, b, len: Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1]),
    mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]
  }));
  const hyp = edges.reduce((x, y) => y.len > x.len ? y : x);
  const opp = edges.find(e => e.a !== vi && e.b !== vi);
  const adj = edges.find(e => e !== hyp && e !== opp);
  const labs = (this.diagramLabels() || []).filter(l => !/°/.test(l.t));
  const nameOf = e => { let best = null, bb = Infinity;
    for (const l of labs) { const d = Math.hypot(l.x - e.mid[0], l.y - e.mid[1]); if (d < bb) { bb = d; best = l; } }
    return best ? best.t.trim() : null; };
  if (!hyp || !opp || !adj) return null;
  return { opp: nameOf(opp), adj: nameOf(adj), hyp: nameOf(hyp), angle: A.t.replace(/[^\d.]/g, '') };
};
// "Set up the equation using the sine ratio": pick the choice whose right-hand
// side is exactly opposite/hypotenuse (or the cos/tan equivalent).
window.__duo.solveSetupEquation = function () {
  const ins = this.curInstruction();
  if (!/set up the equation/i.test(ins)) return null;
  const T = this.triangleLabels(); if (!T) return null;
  const want = /cosine|cos/i.test(ins) ? [T.adj, T.hyp]
             : /tangent|tan/i.test(ins) ? [T.opp, T.adj]
             : [T.opp, T.hyp];
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/\s|°|degree[s]?/gi, '');
    const m = t.match(/=(.+)$/); if (!m) return false;
    const r = m[1];
    return r === want[0] + '/' + want[1] || r === 'frac' + want[0] + want[1];
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveSetupEquation', /set up the equation/i]);
;'__duo ready';

// "Find the measure of the other/top acute angle" — the two acute angles of a
// right triangle sum to 90°, and any triangle's angles sum to 180°.
window.__duo.missingAngle = function () {
  const ins = this.curInstruction();
  if (!/(measure of|find).*(angle)/i.test(ins)) return null;
  const labs = (this.diagramLabels() || []).filter(l => /°/.test(l.t))
    .map(l => parseFloat(l.t.replace(/[^\d.]/g, ''))).filter(isFinite);
  if (!labs.length) return null;
  const known = labs.filter(v => Math.abs(v - 90) > 1e-6);
  if (/acute/i.test(ins) && known.length === 1) return 90 - known[0];
  if (known.length === 2) return 180 - known[0] - known[1];
  if (labs.length === 2) return 180 - labs[0] - labs[1];
  return null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = this.missingAngle(); if (v !== null && isFinite(v)) return v;
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const v = this.missingAngle();
    if (v !== null && isFinite(v)) {
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-6; });
      if (i >= 0) return { i };
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /measure of.*angle|acute angle/i]);
})();
;'__duo ready';

// The prompt often names the OTHER acute angle (30°) while the diagram labels
// only its complement (60°). Compute each vertex's actual angle, find the right
// angle, and pick the vertex whose measure matches what the prompt asks for.
window.__duo.triangleVertexAngles = function () {
  const V = this.trianglePolygon(); if (!V) return null;
  const ang = i => {
    const a = V[i], b = V[(i + 1) % 3], c = V[(i + 2) % 3];
    const u = [b[0] - a[0], b[1] - a[1]], w = [c[0] - a[0], c[1] - a[1]];
    const d = (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w));
    return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
  };
  return V.map((v, i) => ({ v, deg: ang(i), i }));
};
window.__duo.triangleLabelsAt = function (targetDeg) {
  const V = this.trianglePolygon(); if (!V) return null;
  const A = this.triangleVertexAngles(); if (!A) return null;
  const lab = this.angleLabel();
  let vi = null;
  if (targetDeg !== null && targetDeg !== undefined) {
    let bd = Infinity;
    A.forEach(a => { const d = Math.abs(a.deg - targetDeg); if (d < bd) { bd = d; vi = a.i; } });
    if (bd > 8) vi = null;
  }
  if (vi === null && lab) { let bd = Infinity;
    A.forEach(a => { const d = Math.hypot(a.v[0] - lab.x, a.v[1] - lab.y); if (d < bd) { bd = d; vi = a.i; } }); }
  if (vi === null) return null;
  const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
    a, b, len: Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1]),
    mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]
  }));
  const hyp = edges.reduce((x, y) => y.len > x.len ? y : x);
  const opp = edges.find(e => e.a !== vi && e.b !== vi);
  const adj = edges.find(e => e !== hyp && e !== opp);
  if (!hyp || !opp || !adj) return null;
  const labs = (this.diagramLabels() || []).filter(l => !/°/.test(l.t));
  const nameOf = e => { let best = null, bb = Infinity;
    for (const l of labs) { const d = Math.hypot(l.x - e.mid[0], l.y - e.mid[1]); if (d < bb) { bb = d; best = l; } }
    return best ? best.t.trim() : null; };
  return { opp: nameOf(opp), adj: nameOf(adj), hyp: nameOf(hyp) };
};
(function () {
  const base = window.__duo.solveSetupEquation;
  window.__duo.solveSetupEquation = function () {
    const ins = this.curInstruction();
    if (!/set up the (equation|sine|cosine|tangent)|sine ratio for|cosine ratio for|tangent ratio for/i.test(ins)) return base.call(this);
    const m = ins.replace(/\s/g, '').match(/(?:forthe)?(-?\d+(?:\.\d+)?)(?:°|degree)/);
    const T = this.triangleLabelsAt(m ? parseFloat(m[1]) : null);
    if (!T) return base.call(this);
    const want = /cosine|cos/i.test(ins) ? [T.adj, T.hyp]
               : /tangent|tan/i.test(ins) ? [T.opp, T.adj]
               : [T.opp, T.hyp];
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => {
      const t = this.plainMath(this.choiceLatex(e)).replace(/\s|°|degree[s]?/gi, '');
      const q = t.match(/=(.+)$/); if (!q) return false;
      return q[1] === want[0] + '/' + want[1] || q[1] === 'frac' + want[0] + want[1];
    });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveSetupEquation', /set up the|ratio for the/i]);
})();
;'__duo ready';

// "Select the match" where the choices are trig expressions like sin(45°) or
// tan(40°): evaluate each and keep the one equal to the value in the prompt.
window.__duo.evalTrigExpr = function (text) {
  const t = String(text).replace(/\\mathbf|\\textbf|\\text|[{}\\\s]/g, '').replace(/°|degrees?/gi, '');
  const m = t.match(/^(sin|cos|tan)\((-?\d+(?:\.\d+)?)\)$/i);
  if (!m) { const g = this.compile(t); if (!g) return null;
    try { const v = g(0); return isFinite(v) ? v : null; } catch (e) { return null; } }
  const D = Math.PI / 180;
  const f = { sin: Math.sin, cos: Math.cos, tan: Math.tan }[m[1].toLowerCase()];
  const v = f(parseFloat(m[2]) * D);
  return isFinite(v) ? v : null;
};
window.__duo.solveTrigMatch = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const vals = ch.map(e => this.evalTrigExpr(this.choiceLatex(e)));
  if (vals.filter(v => v !== null).length < 2) return null;
  // the target: a number or trig expression in the prompt
  let want = null;
  for (const t of this.mathParts().slice().reverse()) {
    const v = this.evalTrigExpr(t);
    if (v !== null) { want = v; break; }
  }
  if (want === null) {
    const T = this.triangleLabels();
    if (T && /sin|sine/i.test(this.curInstruction())) want = parseFloat(T.opp) / parseFloat(T.hyp);
    else if (T && /cos/i.test(this.curInstruction())) want = parseFloat(T.adj) / parseFloat(T.hyp);
    else if (T && /tan/i.test(this.curInstruction())) want = parseFloat(T.opp) / parseFloat(T.adj);
  }
  if (want === null || !isFinite(want)) return null;
  let bi = -1, bd = Infinity;
  vals.forEach((v, i) => { if (v === null) return; const d = Math.abs(v - want); if (d < bd) { bd = d; bi = i; } });
  return (bi >= 0 && bd < 0.02) ? { i: bi } : null;
};
window.__duo.RULES.unshift(['solveTrigMatch', /select the match|sin|cos|tan/i]);
;'__duo ready';

window.__duo.GLOSSARY.unshift(
  [/opposite.{0,12}adjacent\s*=\s*1|ratio\s*=\s*1/i, ['theyareequal', 'equal', 'thesame']],
  [/tan.{0,6}=\s*1/i, ['theyareequal', 'equal', '45']],
  [/sin.{0,6}=\s*cos/i, ['45']],
  [/as the angle (increases|grows)/i, ['increases', 'larger']],
  [/as the angle (decreases|shrinks)/i, ['decreases', 'smaller']],
  [/longest side/i, ['hypotenuse']],
  [/side across from|across from the/i, ['opposite']],
  [/next to the angle|beside the angle/i, ['adjacent']],
);
;'__duo ready';

// solveGlossary was gated on a narrow keyword list, so word-answer screens fell
// through to the blind guess. The solver already returns null when it does not
// recognise the prompt, so gate it on having word choices at all.
window.__duo.RULES.unshift(['solveGlossary', /./]);
;'__duo ready';

// "Find the value of x" in a right triangle: work out which two sides are known
// vs unknown relative to the marked angle, then apply the matching ratio.
window.__duo.solveTriangleX = function () {
  if (!this.diagramFresh()) return null;
  const A = this.triangleVertexAngles(); if (!A) return null;
  const lab = this.angleLabel(); if (!lab) return null;
  const deg = parseFloat(lab.t.replace(/[^\d.]/g, ''));
  if (!isFinite(deg)) return null;
  const T = this.triangleLabelsAt(deg); if (!T) return null;
  const num = s => (s !== null && /^-?\d+(\.\d+)?$/.test(String(s))) ? parseFloat(s) : null;
  const isX = s => /^[a-z]$/i.test(String(s || ''));
  const D = Math.PI / 180, r = deg * D;
  const o = num(T.opp), a = num(T.adj), h = num(T.hyp);
  let x = null;
  if (o !== null && isX(T.hyp)) x = o / Math.sin(r);
  else if (a !== null && isX(T.hyp)) x = a / Math.cos(r);
  else if (o !== null && isX(T.adj)) x = o / Math.tan(r);
  else if (a !== null && isX(T.opp)) x = a * Math.tan(r);
  else if (h !== null && isX(T.opp)) x = h * Math.sin(r);
  else if (h !== null && isX(T.adj)) x = h * Math.cos(r);
  if (x === null || !isFinite(x)) return null;
  const whole = Math.abs(x - Math.round(x)) < 1e-6;
  const ins = this.curInstruction();
  const dp = /hundredth/i.test(ins) ? 2 : /whole|integer/i.test(ins) ? 0 : 1;
  return whole ? Math.round(x) : Number(x.toFixed(dp));
};
(function () {
  const RE = /find the value of x|solve for x|find x|value of x/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) {
      const v = this.solveTrigEquation(); if (v !== null) return v;
      const w = this.solveTriangleX(); if (w !== null) return w;
    }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const v = this.solveTrigEquation() !== null ? this.solveTrigEquation() : this.solveTriangleX();
      if (v !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 0.06; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// Choices that are whole trig equations (tan(45°)=x/5 vs cos(45°)=5/x): check
// each against the triangle's actual side roles and keep the consistent one.
window.__duo.solveEquationMatch = function () {
  if (!this.diagramFresh()) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const parsed = ch.map(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/degree[s]?|°/gi, '');
    const m = t.match(/^(sin|cos|tan)\((-?\d+(?:\.\d+)?)\)=(?:frac)?([a-z0-9.]+?)\/?([a-z0-9.]+)$/i);
    return m ? { fn: m[1].toLowerCase(), deg: parseFloat(m[2]), num: m[3], den: m[4] } : null;
  });
  if (parsed.filter(Boolean).length < 2) return null;
  const hits = [];
  parsed.forEach((p, i) => {
    if (!p) return;
    const T = this.triangleLabelsAt(p.deg); if (!T) return;
    const want = p.fn === 'sin' ? [T.opp, T.hyp] : p.fn === 'cos' ? [T.adj, T.hyp] : [T.opp, T.adj];
    if (String(want[0]) === p.num && String(want[1]) === p.den) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveEquationMatch', /select the match|which equation|set up/i]);
;'__duo ready';

// With only two labels for three edges, nearest-label lookup gave the same label
// to two edges. Assign labels to edges ONE-TO-ONE (closest pair first) and leave
// the unlabelled edge null.
window.__duo.triangleLabelsAt = function (targetDeg) {
  const V = this.trianglePolygon(); if (!V) return null;
  const A = this.triangleVertexAngles(); if (!A) return null;
  const lab = this.angleLabel();
  let vi = null;
  if (targetDeg !== null && targetDeg !== undefined) {
    let bd = Infinity;
    A.forEach(a => { const d = Math.abs(a.deg - targetDeg); if (d < bd) { bd = d; vi = a.i; } });
    if (bd > 8) vi = null;
  }
  if (lab) {   // the marked vertex wins when it is unambiguous
    let bd = Infinity, li = null;
    A.forEach(a => { const d = Math.hypot(a.v[0] - lab.x, a.v[1] - lab.y); if (d < bd) { bd = d; li = a.i; } });
    if (li !== null && (vi === null || Math.abs(A[li].deg - (targetDeg ?? A[li].deg)) < 8)) vi = li;
  }
  if (vi === null) return null;
  const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
    a, b, len: Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1]),
    mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]
  }));
  const hyp = edges.reduce((x, y) => y.len > x.len ? y : x);
  const opp = edges.find(e => e.a !== vi && e.b !== vi);
  const adj = edges.find(e => e !== hyp && e !== opp);
  if (!hyp || !opp || !adj) return null;
  const labs = (this.diagramLabels() || []).filter(l => !/°/.test(l.t));
  const names = new Map();
  const free = edges.slice(), pool = labs.slice();
  while (pool.length && free.length) {
    let bl = 0, be = 0, bd = Infinity;
    pool.forEach((l, li) => free.forEach((e, ei) => {
      const d = Math.hypot(l.x - e.mid[0], l.y - e.mid[1]);
      if (d < bd) { bd = d; bl = li; be = ei; }
    }));
    names.set(free[be], pool[bl].t.trim());
    pool.splice(bl, 1); free.splice(be, 1);
  }
  return { opp: names.get(opp) ?? null, adj: names.get(adj) ?? null, hyp: names.get(hyp) ?? null,
           lenOpp: opp.len, lenAdj: adj.len, lenHyp: hyp.len };
};
;'__duo ready';

// Pythagorean setup choices (1^2 + 1^2 = x^2 vs 1^2 + x^2 = 1^2): the correct
// one has the HYPOTENUSE alone on one side.
window.__duo.solvePythagoras = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const T = this.triangleLabelsAt(null);
  const V = this.trianglePolygon();
  let hypName = T && T.hyp;
  if (!hypName && V) {                        // fall back: longest edge's label
    const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
      len: Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1]),
      mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2] }));
    const h = edges.reduce((x, y) => y.len > x.len ? y : x);
    const labs = (this.diagramLabels() || []).filter(l => !/°/.test(l.t));
    let best = null, bd = Infinity;
    for (const l of labs) { const d = Math.hypot(l.x - h.mid[0], l.y - h.mid[1]); if (d < bd) { bd = d; best = l; } }
    hypName = best ? best.t.trim() : null;
  }
  if (!hypName) return null;
  const i = ch.findIndex(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/\s/g, '');
    const m = t.match(/^(.+)=(.+)$/); if (!m) return false;
    const lhs = m[1], rhs = m[2];
    const alone = s => s === hypName + '^2' || s === hypName + '2';
    const hasPlus = s => s.includes('+');
    return (alone(rhs) && hasPlus(lhs)) || (alone(lhs) && hasPlus(rhs));
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solvePythagoras', /select the match|which equation|pythag/i]);
;'__duo ready';

// complementary (sums to 90) / supplementary (sums to 180) angles
window.__duo.solveComplement = function () {
  const ins = this.curInstruction();
  const m = ins.replace(/\s/g, '').match(/(complementary|supplementary)angle(?:to|of)?(-?\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const want = (/^c/i.test(m[1]) ? 90 : 180) - parseFloat(m[2]);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const v = parseFloat(this.plainMath(this.choiceLatex(e)).replace(/degree[s]?|°/gi, ''));
    return isFinite(v) && Math.abs(v - want) < 1e-6;
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveComplement', /complementary|supplementary/i]);

// cofunction pattern: sin(θ) = cos(90 − θ), so "complete the pattern" rows pair
// a sine with the cosine of the complement.
window.__duo.solveCofunction = function () {
  if (!/complete the pattern/i.test(this.curInstruction())) return null;
  const L = this.promptLatex().map(l => this.plainMath(l).replace(/degree[s]?|°/gi, ''));
  let want = null;
  for (let i = 0; i < L.length; i++) {
    if (L[i] !== '') continue;
    const prev = L[i - 1] || '';
    const m = prev.match(/(sin|cos|tan)\((-?\d+(?:\.\d+)?)\)/i);
    if (!m) continue;
    const other = m[1].toLowerCase() === 'sin' ? 'cos' : m[1].toLowerCase() === 'cos' ? 'sin' : 'tan';
    want = other + '(' + (90 - parseFloat(m[2])) + ')';
    break;
  }
  if (!want) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => this.plainMath(this.choiceLatex(e)).replace(/degree[s]?|°|\s/gi, '') === want);
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveCofunction', /complete the pattern/i]);
;'__duo ready';

// Symbolic cofunction identities: sin(θ)=cos(90°−θ) is the only true pairing
// (sin↔cos); verify numerically at a sample angle so any phrasing works.
window.__duo.solveIdentity = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const D = Math.PI / 180, F = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
  const hits = [];
  ch.forEach((e, i) => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/degree[s]?|°|theta/gi, m => /theta/i.test(m) ? 'T' : '');
    const m = t.match(/^(sin|cos|tan)\(T\)=(sin|cos|tan)\(90-T\)$/i);
    if (!m) return;
    const f = F[m[1].toLowerCase()], g = F[m[2].toLowerCase()];
    const ok = [20, 35, 50, 70].every(a => Math.abs(f(a * D) - g((90 - a) * D)) < 1e-9);
    if (ok) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveIdentity', /select the match|identity|theta/i]);
;'__duo ready';

// Choices like \frac{\sin(53°)}{\cos(53°)} — evaluate whole trig expressions,
// including fractions and products of trig calls.
window.__duo.evalTrigExpr = function (text) {
  let t = String(text)
    .replace(/\\mathbf|\\textbf|\\text/g, '')
    .replace(/\\degree|°|degrees?/gi, '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\/g, '')
    .replace(/\s/g, '');
  for (let i = 0; i < 3; i++) {
    const m = t.match(/^\{(.*)\}$/); if (!m) break; t = m[1];
  }
  t = t.replace(/[{}]/g, '');
  if (!/^[-+*/().0-9a-z]+$/i.test(t)) return null;
  const D = Math.PI / 180;
  const js = t.replace(/(sin|cos|tan)\(([^()]*)\)/gi,
    (m0, f, a) => 'Math.' + f.toLowerCase() + '((' + a + ')*' + D + ')');
  if (/[a-z]/i.test(js.replace(/Math\.(sin|cos|tan)/g, ''))) return null;
  try {
    const v = Function('"use strict";return (' + js + ')')();
    return isFinite(v) ? v : null;
  } catch (e) { return null; }
};
;'__duo ready';

// Choices that are complete equations: keep the one that is numerically TRUE.
// Covers sin/cos = tan, cofunction identities, and plain arithmetic claims.
window.__duo.solveTrueEquation = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const hits = [];
  ch.forEach((e, i) => {
    const raw = this.choiceLatex(e);
    const parts = raw.split('=');
    if (parts.length !== 2) return;
    const a = this.evalTrigExpr(parts[0]), b = this.evalTrigExpr(parts[1]);
    if (a === null || b === null) return;
    if (Math.abs(a - b) < 1e-9) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveTrueEquation', /select the match|which (equation|statement)|identity/i]);
;'__duo ready';

// "Enter the value of sin(θ)" / "select the match" for a ratio: read the
// triangle's numeric sides and give the exact fraction (Duolingo wants 15/17,
// not 0.882).
window.__duo.thetaRatio = function (fn) {
  const T = this.triangleLabelsAt(null); if (!T) return null;
  const n = s => (s !== null && /^-?\d+(\.\d+)?$/.test(String(s))) ? parseFloat(s) : null;
  const o = n(T.opp), a = n(T.adj), h = n(T.hyp);
  const pair = fn === 'sin' ? [o, h] : fn === 'cos' ? [a, h] : [o, a];
  return (pair[0] === null || pair[1] === null) ? null : pair;
};
(function () {
  const RE = /value of (sin|cos|tan)|(sin|cos|tan)\s*\(?\s*(theta|θ)/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (RE.test(ins) && this.diagramFresh()) {
      const fn = /cos/i.test(ins) ? 'cos' : /tan/i.test(ins) ? 'tan' : 'sin';
      const p = this.thetaRatio(fn);
      if (p) {
        const g = (x, y) => y ? g(y, x % y) : Math.abs(x);
        const k = g(p[0], p[1]);
        return (p[1] / k === 1) ? String(p[0] / k) : (p[0] / k) + '/' + (p[1] / k);
      }
    }
    return bo.call(this);
  };
  const bt = window.__duo.typeAnswer;
  window.__duo.typeAnswer = function () {
    if (document.querySelector('[data-test="challenge-text-input"]') && RE.test(this.curInstruction())) {
      const v = this.solveOutputAt();
      if (typeof v === 'string' && /\d/.test(v)) { this.type(v); return v; }
    }
    return bt.call(this);
  };
  const bm = window.__duo.solveTrigMatch;
  window.__duo.solveTrigMatch = function () {
    const r = bm.call(this); if (r) return r;
    // choices are the bare names sin(θ)/cos(θ)/tan(θ) — match the shown fraction
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const names = ch.map(e => (this.plainMath(this.choiceLatex(e)).match(/^(sin|cos|tan)/i) || [])[1]);
    if (names.filter(Boolean).length !== ch.length) return null;
    let want = null;
    for (const t of this.mathParts().slice().reverse()) {
      const m = t.replace(/\s/g, '').match(/^(?:frac)?(\d+)\/?(\d+)$/);
      if (m) { want = [parseFloat(m[1]), parseFloat(m[2])]; break; }
    }
    if (!want) return null;
    for (const fn of ['sin', 'cos', 'tan']) {
      const p = this.thetaRatio(fn);
      if (p && p[0] === want[0] && p[1] === want[1]) {
        const i = names.findIndex(nm => nm && nm.toLowerCase() === fn);
        if (i >= 0) return { i };
      }
    }
    return null;
  };
})();
;'__duo ready';

// Unit 178: inverse trig. "Calculate the angle to the nearest whole number"
// with a shown equation like sin^{-1}(15/17) or tan(θ)=3/4.
window.__duo.solveInverseTrig = function () {
  const D = 180 / Math.PI;
  const INV = { sin: Math.asin, cos: Math.acos, tan: Math.atan };
  for (const t of this.mathParts().concat([this.curInstruction().replace(/\s/g, '')])) {
    const s = t.replace(/\s|°|degrees?/gi, '');
    let m = s.match(/(sin|cos|tan)\^?\{?-1\}?\(([^()]+)\)/i)          // sin^{-1}(15/17)
         || s.match(/arc(sin|cos|tan)\(([^()]+)\)/i);
    if (m) {
      const v = this.evalTrigExpr(m[2]) ?? this.evalTrigExpr('(' + m[2] + ')');
      if (v !== null) { const a = INV[m[1].toLowerCase()](v) * D; if (isFinite(a)) return a; }
    }
    m = s.match(/(sin|cos|tan)\(?(?:theta|θ|x)\)?=(.+)$/i);            // tan(θ) = 3/4
    if (m) {
      const v = this.evalTrigExpr(m[2]);
      if (v !== null) { const a = INV[m[1].toLowerCase()](v) * D; if (isFinite(a)) return a; }
    }
  }
  // no equation printed: derive the ratio from the triangle
  const ins = this.curInstruction();
  const fn = /cos/i.test(ins) ? 'cos' : /tan/i.test(ins) ? 'tan' : /sin/i.test(ins) ? 'sin' : null;
  if (fn && this.diagramFresh()) {
    const p = this.thetaRatio(fn);
    if (p) { const a = INV[fn](p[0] / p[1]) * D; if (isFinite(a)) return a; }
  }
  return null;
};
(function () {
  const RE = /calculate the angle|find the angle|measure of (the )?angle|angle to the nearest|inverse/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (RE.test(ins)) {
      const a = this.solveInverseTrig();
      if (a !== null) {
        const dp = /hundredth/i.test(ins) ? 2 : /tenth/i.test(ins) ? 1 : 0;
        return Number(a.toFixed(dp));
      }
    }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const a = this.solveInverseTrig();
      if (a !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        let bi = -1, bd = Infinity;
        ch.forEach((e, i) => { const q = this.choiceValue(e); if (q === null) return;
          const d = Math.abs(q - a); if (d < bd) { bd = d; bi = i; } });
        if (bi >= 0 && bd < 1.5) return { i: bi };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// Law of Sines: each side pairs with the angle OPPOSITE it. Work out that
// pairing from the triangle's geometry, then keep the choice that respects it.
window.__duo.sideAnglePairs = function () {
  const V = this.trianglePolygon(); if (!V) return null;
  const labs = this.diagramLabels() || [];
  const angles = labs.filter(l => /°/.test(l.t));
  const sides = labs.filter(l => !/°/.test(l.t) && (/^-?\d+(\.\d+)?$/.test(l.t) || /^[a-z]$/i.test(l.t)));
  if (angles.length < 2 || sides.length < 2) return null;
  const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
    a, b, mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2] }));
  const nearest = (pt, list, key) => list.reduce((best, c) =>
    Math.hypot(c[key][0] - pt.x, c[key][1] - pt.y) < Math.hypot(best[key][0] - pt.x, best[key][1] - pt.y) ? c : best);
  const vtxOf = a => { let bi = 0, bd = Infinity;
    V.forEach((v, i) => { const d = Math.hypot(v[0] - a.x, v[1] - a.y); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const out = [];
  for (const s of sides) {
    const e = nearest(s, edges, 'mid');
    const opp = angles.find(a => { const vi = vtxOf(a); return vi !== e.a && vi !== e.b; });
    if (opp) out.push({ side: s.t.trim(), angle: opp.t.replace(/[^\d.]/g, '') });
  }
  return out.length >= 2 ? out : null;
};
window.__duo.solveLawOfSines = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const P = this.sideAnglePairs(); if (!P) return null;
  const ok = (side, ang) => P.some(p => p.side === side && Math.abs(parseFloat(p.angle) - parseFloat(ang)) < 0.5);
  const hits = [];
  ch.forEach((e, i) => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/degree[s]?|°/gi, '');
    const m = t.match(/^frac([a-z0-9.]+)sin\((\d+(?:\.\d+)?)\)=frac([a-z0-9.]+)sin\((\d+(?:\.\d+)?)\)$/i);
    if (!m) return;
    if (ok(m[1], m[2]) && ok(m[3], m[4])) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveLawOfSines', /select the match|law of sines|which equation/i]);
;'__duo ready';

// Law of Sines also appears inverted: sin(A)/a = sin(B)/b, and the unknown may
// be the ANGLE (sin(x)) rather than a side.
(function () {
  const base = window.__duo.solveLawOfSines;
  window.__duo.solveLawOfSines = function () {
    const r = base.call(this); if (r) return r;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (ch.length < 2) return null;
    const P = this.sideAnglePairs(); if (!P) return null;
    const norm = s => String(s).trim();
    const ok = (ang, side) => P.some(p => norm(p.side) === norm(side) &&
      (norm(p.angle) === norm(ang) || Math.abs(parseFloat(p.angle) - parseFloat(ang)) < 0.5));
    const hits = [];
    ch.forEach((e, i) => {
      const t = this.plainMath(this.choiceLatex(e)).replace(/degree[s]?|°/gi, '');
      const m = t.match(/^fracsin\(([a-z0-9.]+)\)([a-z0-9.]+)=fracsin\(([a-z0-9.]+)\)([a-z0-9.]+)$/i);
      if (!m) return;
      // an unknown angle x pairs with whichever side has no numeric angle
      const pairOk = (ang, side) => /^[a-z]$/i.test(ang)
        ? P.some(p => norm(p.side) === norm(side) && !P.some(q => q.side === side && /^\d/.test(q.angle) === false))
          || P.some(p => norm(p.side) === norm(side))
        : ok(ang, side);
      if (pairOk(m[1], m[2]) && pairOk(m[3], m[4])) hits.push(i);
    });
    if (hits.length === 1) return { i: hits[0] };
    // fall back to the strict numeric pairing only
    const strict = [];
    ch.forEach((e, i) => {
      const t = this.plainMath(this.choiceLatex(e)).replace(/degree[s]?|°/gi, '');
      const m = t.match(/^fracsin\((\d+(?:\.\d+)?)\)([a-z0-9.]+)=fracsin\((\d+(?:\.\d+)?)\)([a-z0-9.]+)$/i);
      if (m && ok(m[1], m[2]) && ok(m[3], m[4])) strict.push(i);
    });
    return strict.length === 1 ? { i: strict[0] } : null;
  };
})();
;'__duo ready';

// A bare letter can label either a side or an unknown ANGLE. Decide by
// position: near a vertex means angle, near an edge midpoint means side.
window.__duo.sideAnglePairs = function () {
  const V = this.trianglePolygon(); if (!V) return null;
  const labs = this.diagramLabels() || [];
  const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
    a, b, mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2] }));
  const dV = l => Math.min(...V.map(v => Math.hypot(v[0] - l.x, v[1] - l.y)));
  const dE = l => Math.min(...edges.map(e => Math.hypot(e.mid[0] - l.x, e.mid[1] - l.y)));
  const angles = [], sides = [];
  for (const l of labs) {
    const t = l.t.trim();
    if (/°/.test(t)) { angles.push(l); continue; }
    if (!/^-?\d+(\.\d+)?$/.test(t) && !/^[a-z]$/i.test(t)) continue;
    (dV(l) <= dE(l) ? angles : sides).push(l);
  }
  if (angles.length < 2 || sides.length < 2) return null;
  const vtxOf = a => { let bi = 0, bd = Infinity;
    V.forEach((v, i) => { const d = Math.hypot(v[0] - a.x, v[1] - a.y); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const edgeOf = s => edges.reduce((best, e) =>
    Math.hypot(e.mid[0] - s.x, e.mid[1] - s.y) < Math.hypot(best.mid[0] - s.x, best.mid[1] - s.y) ? e : best);
  const out = [];
  for (const s of sides) {
    const e = edgeOf(s);
    const opp = angles.find(a => { const vi = vtxOf(a); return vi !== e.a && vi !== e.b; });
    if (opp) out.push({ side: s.t.trim(), angle: opp.t.replace(/°/g, '').trim() });
  }
  return out.length >= 2 ? out : null;
};
(function () {
  const base = window.__duo.solveLawOfSines;
  window.__duo.solveLawOfSines = function () {
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (ch.length < 2) return null;
    const P = this.sideAnglePairs(); if (!P) return base.call(this);
    const norm = s => String(s).trim();
    const ok = (ang, side) => P.some(p => norm(p.side) === norm(side) && norm(p.angle) === norm(ang));
    const hits = [];
    ch.forEach((e, i) => {
      const t = this.plainMath(this.choiceLatex(e)).replace(/degree[s]?|°/gi, '');
      let m = t.match(/^fracsin\(([a-z0-9.]+)\)([a-z0-9.]+)=fracsin\(([a-z0-9.]+)\)([a-z0-9.]+)$/i);
      if (m) { if (ok(m[1], m[2]) && ok(m[3], m[4])) hits.push(i); return; }
      m = t.match(/^frac([a-z0-9.]+)sin\(([a-z0-9.]+)\)=frac([a-z0-9.]+)sin\(([a-z0-9.]+)\)$/i);
      if (m && ok(m[2], m[1]) && ok(m[4], m[3])) hits.push(i);
    });
    return hits.length === 1 ? { i: hits[0] } : base.call(this);
  };
})();
;'__duo ready';

// Vertex-vs-edge distance is too close to call for a corner label. The choices
// themselves say which symbols are angles: anything inside sin(...) is an angle.
(function () {
  const base = window.__duo.sideAnglePairs;
  window.__duo.sideAnglePairs = function () {
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const texts = ch.map(e => this.plainMath(this.choiceLatex(e)).replace(/degree[s]?|°/gi, ''));
    const inSin = new Set();
    for (const t of texts) for (const m of t.matchAll(/sin\(([a-z0-9.]+)\)/gi)) inSin.add(m[1]);
    if (!inSin.size) return base.call(this);
    const V = this.trianglePolygon(); if (!V) return base.call(this);
    const labs = this.diagramLabels() || [];
    const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({
      a, b, mid: [(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2] }));
    const angles = [], sides = [];
    for (const l of labs) {
      const raw = l.t.trim(), key = raw.replace(/°/g, '');
      if (!/^-?\d+(\.\d+)?$/.test(key) && !/^[a-z]$/i.test(key)) continue;
      (/°/.test(raw) || inSin.has(key) ? angles : sides).push(l);
    }
    if (angles.length < 2 || sides.length < 2) return base.call(this);
    const vtxOf = a => { let bi = 0, bd = Infinity;
      V.forEach((v, i) => { const d = Math.hypot(v[0] - a.x, v[1] - a.y); if (d < bd) { bd = d; bi = i; } }); return bi; };
    const edgeOf = s => edges.reduce((best, e) =>
      Math.hypot(e.mid[0] - s.x, e.mid[1] - s.y) < Math.hypot(best.mid[0] - s.x, best.mid[1] - s.y) ? e : best);
    const out = [];
    for (const s of sides) {
      const e = edgeOf(s);
      const opp = angles.find(a => { const vi = vtxOf(a); return vi !== e.a && vi !== e.b; });
      if (opp) out.push({ side: s.t.trim(), angle: opp.t.replace(/°/g, '').trim() });
    }
    return out.length >= 2 ? out : base.call(this);
  };
})();
;'__duo ready';

// Solve the Law of Sines for whichever quantity is unknown:
//   unknown side  x = a * sin(X) / sin(A)
//   unknown angle X = asin( x * sin(A) / a )
window.__duo.solveLawOfSinesValue = function () {
  const P = this.sideAnglePairs(); if (!P || P.length < 2) return null;
  const D = Math.PI / 180;
  const isNum = s => /^-?\d+(\.\d+)?$/.test(String(s));
  const known = P.find(p => isNum(p.side) && isNum(p.angle));
  if (!known) return null;
  const k = parseFloat(known.side) / Math.sin(parseFloat(known.angle) * D);
  for (const p of P) {
    if (p === known) continue;
    if (!isNum(p.side) && isNum(p.angle)) {              // unknown side
      const v = k * Math.sin(parseFloat(p.angle) * D);
      if (isFinite(v)) return { kind: 'side', v };
    }
    if (isNum(p.side) && !isNum(p.angle)) {              // unknown angle
      const s = parseFloat(p.side) / k;
      if (Math.abs(s) <= 1) { const v = Math.asin(s) * 180 / Math.PI; if (isFinite(v)) return { kind: 'angle', v }; }
    }
  }
  return null;
};
(function () {
  const RE = /value of x|measure of x|find x|solve for x/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (RE.test(ins) && this.diagramFresh()) {
      const r = this.solveLawOfSinesValue();
      if (r) { const dp = /hundredth/i.test(ins) ? 2 : /tenth/i.test(ins) ? 1 : 0;
        return Number(r.v.toFixed(dp)); }
    }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction()) && this.diagramFresh()) {
      const r = this.solveLawOfSinesValue();
      if (r) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        let bi = -1, bd = Infinity;
        ch.forEach((e, i) => { const q = this.choiceValue(e); if (q === null) return;
          const d = Math.abs(q - r.v); if (d < bd) { bd = d; bi = i; } });
        if (bi >= 0 && bd < 1.5) return { i: bi };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// Law of Cosines guided steps: "subtract to find the value of x^2" wants the
// x^2 value, not x. Evaluate whatever arithmetic the prompt has built up.
window.__duo.solveStepExpression = function () {
  const ins = this.curInstruction();
  const wantSquare = /value of x\^?2|x\^2/i.test(ins);
  // the last printed line that is a complete arithmetic expression
  for (const t of this.mathParts().slice().reverse()) {
    const s = t.replace(/\s|°|degrees?/gi, '');
    const m = s.match(/^(?:x\^?2=)?(.+?)=?$/);
    if (!m) continue;
    const body = m[1];
    if (!/[-+*/]/.test(body) && !/sin|cos|tan/i.test(body)) continue;
    const v = this.evalTrigExpr(body);
    if (v === null || !isFinite(v)) continue;
    const dp = /hundredth/i.test(ins) ? 2 : /whole|integer/i.test(ins) ? 0 : 1;
    return wantSquare ? Number(v.toFixed(dp)) : Number(v.toFixed(dp));
  }
  return null;
};
(function () {
  const RE = /subtract to find|multiply to find|add to find|value of x\^?2|evaluate/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) {
      const v = this.solveStepExpression(); if (v !== null) return v;
    }
    return bo.call(this);
  };
})();

// Law of Cosines: c^2 = a^2 + b^2 - 2ab*cos(C)
window.__duo.lawOfCosines = function () {
  const P = this.sideAnglePairs();
  const labs = (this.diagramLabels() || []);
  const nums = labs.filter(l => /^-?\d+(\.\d+)?$/.test(l.t)).map(l => parseFloat(l.t));
  const angs = labs.filter(l => /°/.test(l.t)).map(l => parseFloat(l.t.replace(/[^\d.]/g, '')));
  if (nums.length < 2 || angs.length < 1) return null;
  const [a, b] = nums, C = angs[0];
  const D = Math.PI / 180;
  const c2 = a * a + b * b - 2 * a * b * Math.cos(C * D);
  return isFinite(c2) ? { c2, c: Math.sqrt(c2) } : null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/x\^?2/i.test(ins) && this.diagramFresh()) {
      const L = this.lawOfCosines();
      if (L) { const dp = /hundredth/i.test(ins) ? 2 : 1; return Number(L.c2.toFixed(dp)); }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Take the square root to find x" — the guided step wants sqrt of the x^2 the
// lesson just established, which is printed on the page as the accepted answer
// to the previous step.
window.__duo.prevStepValue = function () {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  const m = t.match(/value of\s*𝑥?\s*\^?2?[^.]*\.\s*(-?\d+(?:\.\d+)?)/i)
        || t.match(/𝑥\s*2\s*=\s*(-?\d+(?:\.\d+)?)/)
        || t.match(/x\s*\^?2\s*=\s*(-?\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/square root/i.test(ins)) {
      let sq = this.prevStepValue();
      if (sq === null && this.diagramFresh()) { const L = this.lawOfCosines(); if (L) sq = L.c2; }
      if (sq !== null && sq >= 0) {
        const dp = /hundredth/i.test(ins) ? 2 : /whole|integer/i.test(ins) ? 0 : 1;
        return Number(Math.sqrt(sq).toFixed(dp));
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Select the point translated 1 unit left and 1 unit up" — apply the stated
// vector to the plotted point and match the coordinate-pair choice.
window.__duo.solveTranslatedPoint = function () {
  const ins = this.curInstruction().replace(/\s/g, '');
  if (!/translat/i.test(ins)) return null;
  let dx = 0, dy = 0, seen = false;
  for (const m of ins.matchAll(/(\d+)units?(left|right|up|down)/gi)) {
    const n = parseFloat(m[1]); seen = true;
    if (/left/i.test(m[2])) dx -= n; else if (/right/i.test(m[2])) dx += n;
    else if (/up/i.test(m[2])) dy += n; else dy -= n;
  }
  if (!seen) return null;
  const P = this.plottedPoints();
  const src = P.length === 1 ? P[0] : (this.promptPairs()[0] || null);
  if (!src) return null;
  const want = [src[0] + dx, src[1] + dy];
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const p = this.choicePair(e);
    return p && Math.abs(p[0] - want[0]) < 1e-6 && Math.abs(p[1] - want[1]) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveTranslatedPoint', /translat/i]);
;'__duo ready';

// "Complete the table" for a mapping rule T(x, y) = (x + 4, y − 4): read each
// row's x and y from the table, apply the rule, and drag in the matching pair.
window.__duo.transformRule = function () {
  for (const t of this.mathParts()) {
    const m = t.replace(/\s/g, '').match(/^[A-Za-z]\(x,y\)=\((.+),(.+)\)$/);
    if (!m) continue;
    const fx = this.compile(m[1].replace(/y/g, '(0)')), fy = this.compile(m[2].replace(/x/g, '(0)'));
    const mkX = expr => { const c = this.compile(expr.replace(/y/g, '(0)')); return c; };
    const gx = mkX(m[1]);
    const gyRaw = m[2].replace(/x/g, '(0)').replace(/y/g, 'x');
    const gy = this.compile(gyRaw);
    if (gx && gy) return { x: gx, y: gy };
  }
  return null;
};
window.__duo.solveTransformTable = async function () {
  const T = this.tableCells(); if (!T) return false;
  const R = this.transformRule(); if (!R) return false;
  const d = this.diagram(); if (!d) return false;
  const cells = T.cells;
  const empties = cells.map((c, i) => [c, i]).filter(([c]) => c.empty);
  if (!empties.length) return false;
  const num = s => { const v = parseFloat(String(s).replace(/[−–—]/g, '-')); return isFinite(v) ? v : null; };
  const fr = d.f.getBoundingClientRect();
  const centre = el => { const r = el.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  for (const [cell, idx] of empties) {
    const x = num(cells[idx - 2] && cells[idx - 2].t), y = num(cells[idx - 1] && cells[idx - 1].t);
    if (x === null || y === null) return false;
    let want;
    try { want = '(' + R.x(x) + ', ' + R.y(y) + ')'; } catch (e) { return false; }
    const norm = s => String(s).replace(/[−–—]/g, '-').replace(/\s/g, '');
    const tok = this.bankTokens().find(o => norm(o.t) === norm(want) && o.el.isConnected);
    if (!tok || !cell.el) return false;
    await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell.el));
    await this.sleep(320);
  }
  return true;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveTransformTable()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// plainMath strips commas, which destroys "T(x,y)=(x+4,y-4)". Parse the rule
// from a comma-preserving flatten instead.
window.__duo.transformRule = function () {
  const lines = this.promptLatex().map(l => this.ascii(l)
    .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
    .replace(/[{}&~\s\\]/g, '')
    .replace(/[−–—]/g, '-'));
  for (const t of lines) {
    const m = t.match(/^[A-Za-z]\(x,y\)=\(([^,]+),([^)]+)\)$/);
    if (!m) continue;
    const gx = this.compile(m[1].replace(/\by\b/g, '(0)'));
    const gy = this.compile(m[2].replace(/\bx\b/g, '(0)').replace(/\by\b/g, 'x'));
    if (gx && gy) return { x: gx, y: gy };
  }
  return null;
};
;'__duo ready';

// "Translate the segment" with a rule T(x,y) = (x+2, y−4): apply the rule to
// every draggable point.
window.__duo.solveApplyRule = async function () {
  const R = this.transformRule(); if (!R) return false;
  const pts = this.gridPoints(); if (!pts.length) return false;
  const targets = pts.map(p => { try { return [R.x(p.x), R.y(p.y)]; } catch (e) { return null; } });
  if (targets.some(t => !t || !isFinite(t[0]) || !isFinite(t[1]))) return false;
  if (targets.every((t, i) => Math.abs(t[0] - pts[i].x) < 1e-9 && Math.abs(t[1] - pts[i].y) < 1e-9)) return false;
  for (let i = 0; i < pts.length; i++) {
    const p = this.gridPoints()[i]; if (!p) return false;
    if (Math.abs(p.x - targets[i][0]) < 1e-9 && Math.abs(p.y - targets[i][1]) < 1e-9) continue;
    await this.dragPointTo(p, targets[i][0], targets[i][1]);
  }
  const now = this.gridPoints();
  return targets.every(t => now.some(q => Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6));
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveApplyRule()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "Select the image of (-5, 3) under the translation T(x,y) = ..." — apply the
// rule to the point named in the prompt and match the coordinate choice.
window.__duo.solveImageOfPoint = function () {
  const ins = this.curInstruction();
  if (!/image of/i.test(ins)) return null;
  const R = this.transformRule(); if (!R) return null;
  const src = this.promptPairs()[0]; if (!src) return null;
  let want;
  try { want = [R.x(src[0]), R.y(src[1])]; } catch (e) { return null; }
  if (!isFinite(want[0]) || !isFinite(want[1])) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const p = this.choicePair(e);
    return p && Math.abs(p[0] - want[0]) < 1e-6 && Math.abs(p[1] - want[1]) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveImageOfPoint', /image of/i]);
;'__duo ready';

// "Select the transformation rule": infer the mapping from a before/after pair
// (either two plotted shapes, or a table row), then keep the matching choice.
window.__duo.inferRule = function () {
  const T = this.tableCells();
  if (T) {                                   // table row: x, y, T(x,y)
    const c = T.cells;
    for (let i = 2; i < c.length; i += 3) {
      const x = parseFloat(String(c[i - 2].t).replace(/[−–—]/g, '-'));
      const y = parseFloat(String(c[i - 1].t).replace(/[−–—]/g, '-'));
      const m = String(c[i].t).replace(/[−–—]/g, '-').match(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/);
      if (isFinite(x) && isFinite(y) && m) return { dx: parseFloat(m[1]) - x, dy: parseFloat(m[2]) - y };
    }
  }
  const P = this.plottedPoints();
  if (P.length >= 2 && P.length % 2 === 0) {
    const h = P.length / 2, A = P.slice(0, h), B = P.slice(h);
    const dx = B[0][0] - A[0][0], dy = B[0][1] - A[0][1];
    if (A.every((p, i) => Math.abs(B[i][0] - p[0] - dx) < 1e-6 && Math.abs(B[i][1] - p[1] - dy) < 1e-6))
      return { dx, dy };
  }
  return null;
};
window.__duo.solveRuleChoice = function () {
  if (!/transformation rule|which rule|select the rule/i.test(this.curInstruction())) return null;
  const R = this.inferRule(); if (!R) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const t = this.ascii(this.choiceLatex(e)).replace(/\\(mathbf|textbf|text|left|right)\b/g, '')
      .replace(/[{}\s\\]/g, '').replace(/[−–—]/g, '-');
    const m = t.match(/\(x([+-]\d+(?:\.\d+)?)?,y([+-]\d+(?:\.\d+)?)?\)/);
    if (!m) return false;
    return parseFloat(m[1] || '0') === R.dx && parseFloat(m[2] || '0') === R.dy;
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveRuleChoice', /transformation rule|which rule|select the rule/i]);
;'__duo ready';

// Choices as coordinate maps ((y,x), (-x,y), (x,-y), (x+3,y-1)...): apply each
// to the pre-image points and keep the one that reproduces the image.
window.__duo.parseCoordMap = function (text) {
  const t = this.ascii(text).replace(/\\(mathbf|textbf|text|left|right)\b/g, '')
    .replace(/[{}\s\\]/g, '').replace(/[−–—]/g, '-');
  const m = t.match(/^\(?([^,]+),([^)]+)\)?$/); if (!m) return null;
  const mk = expr => {
    const s = expr.replace(/(\d)([xy])/g, '$1*$2');
    if (!/^[-+*/().0-9xy]+$/.test(s)) return null;
    try { return Function('x', 'y', '"use strict";return (' + s + ')'); } catch (e) { return null; }
  };
  const fx = mk(m[1]), fy = mk(m[2]);
  return (fx && fy) ? (p => { try { return [fx(p[0], p[1]), fy(p[0], p[1])]; } catch (e) { return null; } }) : null;
};
window.__duo.solveCoordMapChoice = function () {
  const ins = this.curInstruction();
  if (!/transformation|rule|maps|takes/i.test(ins)) return null;
  const P = this.plottedPoints();
  if (P.length < 2 || P.length % 2) return null;
  const h = P.length / 2, A = P.slice(0, h), B = P.slice(h);
  const same = (X, Y) => X.every(p => Y.some(q => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6));
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const hits = [];
  ch.forEach((e, i) => {
    const f = this.parseCoordMap(this.choiceLatex(e)); if (!f) return;
    const img = A.map(f);
    if (img.some(p => !p)) return;
    if (same(img, B) && same(B, img)) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveCoordMapChoice', /transformation|rule|maps|takes/i]);
;'__duo ready';

// "Select the point reflected over the y-axis / x-axis / origin"
window.__duo.solveAxisReflection = function () {
  const ins = this.curInstruction().replace(/\s/g, '');
  if (!/reflect/i.test(ins)) return null;
  const P = this.plottedPoints();
  const src = P.length === 1 ? P[0] : (this.promptPairs()[0] || null);
  if (!src) return null;
  let want = null;
  if (/overthey-?axis|acrossthey-?axis/i.test(ins)) want = [-src[0], src[1]];
  else if (/overthex-?axis|acrossthex-?axis/i.test(ins)) want = [src[0], -src[1]];
  else if (/origin/i.test(ins)) want = [-src[0], -src[1]];
  else if (/overtheliney=x|acrossy=x/i.test(ins)) want = [src[1], src[0]];
  if (!want) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const p = this.choicePair(e);
    return p && Math.abs(p[0] - want[0]) < 1e-6 && Math.abs(p[1] - want[1]) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveAxisReflection', /reflect/i]);
;'__duo ready';

// The mapping table lives in the diagram iframe as text: "x y T(x,y) -3 0
// (-3,0) 2 -7 (2,7) ...". Parse it into (pre-image, image) rows so the rule can
// be checked without any plotted points.
window.__duo.tableRuleRows = function () {
  const d = this.diagram(); if (!d) return null;
  let txt;
  try { txt = d.f.contentDocument.body.innerText; } catch (e) { return null; }
  txt = txt.replace(/[−–—]/g, '-').replace(/\s+/g, ' ');
  const toks = txt.match(/\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)|-?\d+(?:\.\d+)?/g) || [];
  const rows = [];
  for (let i = 0; i + 2 < toks.length; ) {
    const a = toks[i], b = toks[i + 1], c = toks[i + 2];
    if (/^\(/.test(a) || /^\(/.test(b) || !/^\(/.test(c)) { i++; continue; }
    const m = c.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
    if (!m) { i++; continue; }
    rows.push({ pre: [parseFloat(a), parseFloat(b)], img: [parseFloat(m[1]), parseFloat(m[2])] });
    i += 3;
  }
  return rows.length ? rows : null;
};
(function () {
  const base = window.__duo.solveCoordMapChoice;
  window.__duo.solveCoordMapChoice = function () {
    const r = base.call(this); if (r) return r;
    const rows = this.tableRuleRows(); if (!rows) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const hits = [];
    ch.forEach((e, i) => {
      const t = this.ascii(this.choiceLatex(e)).replace(/^[^=]*=/, '');
      const f = this.parseCoordMap(t); if (!f) return;
      const ok = rows.every(row => { const p = f(row.pre);
        return p && Math.abs(p[0] - row.img[0]) < 1e-6 && Math.abs(p[1] - row.img[1]) < 1e-6; });
      if (ok) hits.push(i);
    });
    return hits.length === 1 ? { i: hits[0] } : null;
  };
  window.__duo.RULES.unshift(['solveCoordMapChoice', /equation for the transformation|transformation|rule/i]);
})();
;'__duo ready';

// transformRule compiled each output as a single-variable expression, so a rule
// that swaps them — T(x,y) = (-y, -x) — evaluated to nonsense. Use the 2-arg
// coordinate-map parser instead.
window.__duo.transformRule = function () {
  const lines = this.promptLatex().map(l => this.ascii(l)
    .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
    .replace(/[{}&~\s\\]/g, '')
    .replace(/[−–—]/g, '-'));
  for (const t of lines) {
    const m = t.match(/^[A-Za-z]\(x,y\)=(\(.+\))$/);
    if (!m) continue;
    const f = this.parseCoordMap(m[1]);
    if (f) return { map: f, x: v => f([v, 0])[0], y: v => f([0, v])[1] };
  }
  return null;
};
(function () {
  const base = window.__duo.solveTransformTable;
  window.__duo.solveTransformTable = async function () {
    const T = this.tableCells(); if (!T) return await base.call(this);
    const R = this.transformRule(); if (!R || !R.map) return await base.call(this);
    const d = this.diagram(); if (!d) return false;
    const cells = T.cells;
    const empties = cells.map((c, i) => [c, i]).filter(([c]) => c.empty);
    if (!empties.length) return false;
    const num = s => { const v = parseFloat(String(s).replace(/[−–—]/g, '-')); return isFinite(v) ? v : null; };
    const fr = d.f.getBoundingClientRect();
    const centre = el => { const r = el.getBoundingClientRect();
      return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
    const norm = s => String(s).replace(/[−–—]/g, '-').replace(/\s/g, '');
    for (const [cell, idx] of empties) {
      const x = num(cells[idx - 2] && cells[idx - 2].t), y = num(cells[idx - 1] && cells[idx - 1].t);
      if (x === null || y === null) return false;
      const p = R.map([x, y]); if (!p) return false;
      const want = '(' + p[0] + ',' + p[1] + ')';
      const tok = this.bankTokens().find(o => norm(o.t) === norm(want) && o.el.isConnected);
      if (!tok || !cell.el) return false;
      await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell.el));
      await this.sleep(320);
    }
    return true;
  };
})();
;'__duo ready';

// The blank can also be an INPUT cell (x or y) with the image given. Try each
// numeric token in the blank and keep the one the rule maps to that image.
(function () {
  const base = window.__duo.solveTransformTable;
  window.__duo.solveTransformTable = async function () {
    const T = this.tableCells(); const R = this.transformRule();
    if (!T || !R || !R.map) return await base.call(this);
    const d = this.diagram(); if (!d) return false;
    const cells = T.cells;
    const empties = cells.map((c, i) => [c, i]).filter(([c]) => c.empty);
    if (!empties.length) return false;
    // only handle input blanks here; the image-column case is the base solver's
    if (!empties.some(([, i]) => i % 3 !== 2)) return await base.call(this);
    const num = s => { const v = parseFloat(String(s).replace(/[−–—]/g, '-')); return isFinite(v) ? v : null; };
    const pair = s => { const m = String(s).replace(/[−–—]/g, '-').match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
      return m ? [parseFloat(m[1]), parseFloat(m[2])] : null; };
    const fr = d.f.getBoundingClientRect();
    const centre = el => { const r = el.getBoundingClientRect();
      return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
    for (const [cell, idx] of empties) {
      const row = Math.floor(idx / 3) * 3;
      const img = pair(cells[row + 2] && cells[row + 2].t);
      if (!img) return false;
      const known = idx % 3 === 0 ? num(cells[row + 1].t) : num(cells[row].t);
      if (known === null) return false;
      const tok = this.bankTokens().find(o => {
        const v = num(o.t); if (v === null || !o.el.isConnected) return false;
        const p = idx % 3 === 0 ? R.map([v, known]) : R.map([known, v]);
        return p && Math.abs(p[0] - img[0]) < 1e-6 && Math.abs(p[1] - img[1]) < 1e-6;
      });
      if (!tok || !cell.el) return false;
      await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell.el));
      await this.sleep(320);
    }
    return true;
  };
})();
;'__duo ready';

// A table can have blanks in BOTH the image column and the input columns at
// once; the two earlier solvers each handled only one kind. Handle every blank
// in one pass, choosing the token by the column it sits in.
window.__duo.solveTransformTable = async function () {
  const T = this.tableCells(); const R = this.transformRule();
  if (!T || !R || !R.map) return false;
  const d = this.diagram(); if (!d) return false;
  const cells = T.cells;
  const empties = cells.map((c, i) => [c, i]).filter(([c]) => c.empty);
  if (!empties.length) return false;
  const num = s => { const v = parseFloat(String(s).replace(/[−–—]/g, '-')); return isFinite(v) ? v : null; };
  const pair = s => { const m = String(s).replace(/[−–—]/g, '-').match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : null; };
  const norm = s => String(s).replace(/[−–—]/g, '-').replace(/\s/g, '');
  const fr = d.f.getBoundingClientRect();
  const centre = el => { const r = el.getBoundingClientRect();
    return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; };
  const val = c => c.empty ? null : c.t;
  for (const [cell, idx] of empties) {
    const row = Math.floor(idx / 3) * 3;
    let tok = null;
    if (idx % 3 === 2) {                                   // image blank
      const x = num(val(cells[row])), y = num(val(cells[row + 1]));
      if (x === null || y === null) return false;
      const p = R.map([x, y]); if (!p) return false;
      const want = '(' + p[0] + ',' + p[1] + ')';
      tok = this.bankTokens().find(o => norm(o.t) === norm(want) && o.el.isConnected);
    } else {                                               // input blank
      const img = pair(val(cells[row + 2])); if (!img) return false;
      const other = idx % 3 === 0 ? num(val(cells[row + 1])) : num(val(cells[row]));
      if (other === null) return false;
      tok = this.bankTokens().find(o => {
        const v = num(o.t); if (v === null || !o.el.isConnected) return false;
        const p = idx % 3 === 0 ? R.map([v, other]) : R.map([other, v]);
        return p && Math.abs(p[0] - img[0]) < 1e-6 && Math.abs(p[1] - img[1]) < 1e-6;
      });
    }
    if (!tok || !cell.el) return false;
    await this.dragXY(tok.el, d.f, centre(tok.el), centre(cell.el));
    await this.sleep(320);
  }
  return true;
};
;'__duo ready';

// freeTokens called this.bankTokens, which the wrapper had replaced with a
// function calling freeTokens — infinite recursion. Pass the raw list in.
window.__duo.freeFrom = function (list) {
  const T = this.tableCells();
  const rects = T ? T.cells.map(c => c.el && c.el.getBoundingClientRect()).filter(Boolean) : [];
  return list.filter(o => {
    if (!o.el.isConnected) return false;
    const r = o.el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return !rects.some(q => cx >= q.left - 2 && cx <= q.right + 2 && cy >= q.top - 2 && cy <= q.bottom + 2);
  });
};
window.__duo.freeTokens = function () { return this.freeFrom(this.bankTokens()); };
(function () {
  const base = window.__duo.solveTransformTable;
  window.__duo.solveTransformTable = async function () {
    const used = new Set();
    const realBank = this.bankTokens.bind(this);
    const self = this;
    this.bankTokens = function () { return self.freeFrom(realBank()).filter(o => !used.has(o.el)); };
    const realDrag = this.dragXY.bind(this);
    this.dragXY = async function (el, f, from, to) { used.add(el); return await realDrag(el, f, from, to); };
    try { return await base.call(this); }
    finally { this.bankTokens = realBank; this.dragXY = realDrag; }
  };
})();
;'__duo ready';

// Guided Pythagoras ends with "x^2 = 27; find the value of x" and offers the
// answer in radical form. Read the x^2 value from the prompt and match by
// numeric value, so \sqrt{27} wins over the decoy 13.5.
window.__duo.solveFromXSquared = function () {
  let sq = null;
  for (const t of this.mathParts().slice().reverse()) {
    const m = t.replace(/\s/g, '').match(/^x\^?2=(-?[\d.]+)$/i);
    if (m) { sq = parseFloat(m[1]); break; }
  }
  if (sq === null || sq < 0) return null;
  const want = Math.sqrt(sq);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const t = this.ascii(this.choiceLatex(e)).replace(/^[^=]*=/, '');
    const v = this.evalTrigExpr(t.replace(/\\sqrt\{([^{}]*)\}/g, '(($1)**0.5)'));
    return v !== null && Math.abs(v - want) < 1e-6;
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveFromXSquared', /find the value of x|value of x|solve for x/i]);
;'__duo ready';

// "Select the length of the leg / hypotenuse": compute it from the triangle's
// two known sides and match by VALUE, so radical forms (10√2, √(8^2-4^2)) and
// decimals both work.
window.__duo.radValue = function (text) {
  let t = this.ascii(text).replace(/^[^=]*=/, '')
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, '(($1)**0.5)')
    .replace(/\\sqrt\s*(\d+)/g, '(($1)**0.5)')
    .replace(/(\d)\s*\(\(/g, '$1*((')
    .replace(/\^/g, '**');
  return this.evalTrigExpr(t);
};
window.__duo.solvePythagSide = function () {
  const ins = this.curInstruction();
  if (!/length of the (leg|hypotenuse|side)/i.test(ins)) return null;
  if (!this.diagramFresh()) return null;
  const nums = (this.diagramLabels() || [])
    .filter(l => /^-?\d+(\.\d+)?$/.test(l.t)).map(l => parseFloat(l.t));
  if (nums.length < 2) return null;
  const T = this.triangleLabelsAt(null);
  let want = null;
  if (/hypotenuse/i.test(ins)) want = Math.sqrt(nums[0] ** 2 + nums[1] ** 2);
  else {
    const hyp = Math.max(...nums), leg = Math.min(...nums);
    want = Math.sqrt(hyp ** 2 - leg ** 2);
  }
  if (!isFinite(want)) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = this.radValue(this.choiceLatex(e));
    return v !== null && Math.abs(v - want) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solvePythagSide', /length of the (leg|hypotenuse|side)/i]);
;'__duo ready';

// "Create a segment with N units": two draggable endpoints; move one so the
// segment has the requested length, keeping it on the grid.
window.__duo.solveSegmentLength = async function () {
  const ins = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '');
  if (!/segmentwith/i.test(ins)) return false;
  const m = ins.match(/(\d+(?:\.\d+)?)units?/i); if (!m) return false;
  const want = parseFloat(m[1]);
  const pts = this.gridPoints(); if (pts.length !== 2) return false;
  const [a, b] = pts;
  const cur = Math.hypot(b.x - a.x, b.y - a.y);
  if (Math.abs(cur - want) < 1e-9) return false;
  const g = this.diagram().M.grid;
  const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
  const inRange = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  // keep the segment axis-aligned: move b along whichever axis it already shares
  const cands = [];
  if (a.x === b.x) { cands.push([a.x, a.y + want], [a.x, a.y - want]); }
  else if (a.y === b.y) { cands.push([a.x + want, a.y], [a.x - want, a.y]); }
  else { cands.push([a.x, a.y + want], [a.x + want, a.y]); }
  for (const t of cands) {
    if (!inRange(t[0], t[1])) continue;
    await this.dragPointTo(this.gridPoints()[1], t[0], t[1]);
    const q = this.gridPoints();
    if (q.length === 2 && Math.abs(Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) - want) < 1e-6) return true;
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveSegmentLength()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "Select the length of AC": labelled points on the grid — find the two named
// points by their letter labels and measure between them.
window.__duo.namedPoints = function () {
  const V = this.plottedPoints();
  const labs = (this.diagramLabels() || []).filter(l => /^[A-Z]$/.test(l.t.trim()));
  if (!V.length || !labs.length) return null;
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const g = d.M.grid, fr = d.f.getBoundingClientRect();
  const out = {};
  for (const l of labs) {
    let px;
    try { px = g.pixelToGrid([l.x - fr.left, l.y - fr.top]); } catch (e) { continue; }
    let best = null, bd = Infinity;
    for (const p of V) { const dd = Math.hypot(p[0] - px[0], p[1] - px[1]); if (dd < bd) { bd = dd; best = p; } }
    if (best && bd < 3) out[l.t.trim()] = best;
  }
  return Object.keys(out).length >= 2 ? out : null;
};
window.__duo.solveNamedDistance = function () {
  const ins = this.curInstruction();
  const m = ins.replace(/\s/g, '').match(/lengthof([A-Za-z])([A-Za-z])/);
  if (!m) return null;
  const N = this.namedPoints(); if (!N) return null;
  const a = N[m[1].toUpperCase()], b = N[m[2].toUpperCase()];
  if (!a || !b) return null;
  const want = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - want) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveNamedDistance', /length of [A-Za-z]{2}/i]);
;'__duo ready';

// Segment addition on a number line: letters mark the points, numbers label the
// gaps between consecutive letters, so AC is the sum of the gaps from A to C.
window.__duo.segmentGaps = function () {
  const labs = this.diagramLabels() || [];
  const letters = labs.filter(l => /^[A-Z]$/.test(l.t.trim())).sort((a, b) => a.x - b.x);
  const nums = labs.filter(l => /^-?\d+(\.\d+)?$/.test(l.t.trim()));
  if (letters.length < 2 || !nums.length) return null;
  const gaps = [];
  for (let i = 1; i < letters.length; i++) {
    const lo = letters[i - 1].x, hi = letters[i].x;
    const inGap = nums.filter(n => n.x > lo - 4 && n.x < hi + 4);
    if (inGap.length !== 1) return null;
    gaps.push({ from: letters[i - 1].t.trim(), to: letters[i].t.trim(), len: parseFloat(inGap[0].t) });
  }
  return gaps.length ? { letters: letters.map(l => l.t.trim()), gaps } : null;
};
(function () {
  const base = window.__duo.solveNamedDistance;
  window.__duo.solveNamedDistance = function () {
    const r = base.call(this); if (r) return r;
    const m = this.curInstruction().replace(/\s/g, '').match(/lengthof([A-Za-z])([A-Za-z])/);
    if (!m) return null;
    const S = this.segmentGaps(); if (!S) return null;
    const a = S.letters.indexOf(m[1].toUpperCase()), b = S.letters.indexOf(m[2].toUpperCase());
    if (a < 0 || b < 0) return null;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += S.gaps[i].len;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - sum) < 1e-6; });
    return i < 0 ? null : { i };
  };
})();
;'__duo ready';

// "Select the matching equation": AC = 2 + 6 — the SUM expression, not the
// evaluated total (AC = 8 is not even offered; AC = 6 is a decoy).
window.__duo.solveSegmentEquation = function () {
  const ins = this.curInstruction();
  if (!/matching equation|which equation/i.test(ins)) return null;
  const S = this.segmentGaps(); if (!S) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const hits = [];
  ch.forEach((e, i) => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/\s/g, '');
    const m = t.match(/^([A-Z])([A-Z])=(.+)$/); if (!m) return;
    const a = S.letters.indexOf(m[1]), b = S.letters.indexOf(m[2]);
    if (a < 0 || b < 0) return;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const want = S.gaps.slice(lo, hi).map(g => g.len);
    const got = m[3].split('+').map(Number);
    if (got.length === want.length && got.every((v, k) => Math.abs(v - want[k]) < 1e-6)) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveSegmentEquation', /matching equation|which equation/i]);
;'__duo ready';

// typed forms: "enter the length of AC" / "enter the length of the segment"
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/length of/i.test(ins)) {
      const m = ins.replace(/\s/g, '').match(/lengthof([A-Za-z])([A-Za-z])/);
      if (m) {
        const S = this.segmentGaps();
        if (S) {
          const a = S.letters.indexOf(m[1].toUpperCase()), b = S.letters.indexOf(m[2].toUpperCase());
          if (a >= 0 && b >= 0) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            let sum = 0; for (let i = lo; i < hi; i++) sum += S.gaps[i].len;
            return sum;
          }
        }
        const N = this.namedPoints();
        if (N) { const p = N[m[1].toUpperCase()], q = N[m[2].toUpperCase()];
          if (p && q) return Math.hypot(q[0] - p[0], q[1] - p[1]); }
      }
      if (/segment/i.test(ins)) {
        const pts = this.gridPoints();
        if (pts.length === 2) return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const P = this.plottedPoints();
        if (P.length === 2) return Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
        const S = this.segmentGaps();
        if (S) return S.gaps.reduce((a, g) => a + g.len, 0);
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "midpoint = <2-D slider>": place the slider handle at the midpoint of the
// segment's two endpoints.
window.__duo.solveMidpoint = async function () {
  const ins = this.mathParts().concat([this.curInstruction()]).join(' ');
  if (!/midpoint/i.test(ins)) return false;
  const P = this.plottedPoints();
  const ends = P.length >= 2 ? P.slice(0, 2) : this.promptPairs().slice(0, 2);
  if (!ends || ends.length < 2) return false;
  const mid = [(ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2];
  const pts = this.gridPoints();
  if (pts.length === 1) {
    await this.dragPointTo(pts[0], mid[0], mid[1]);
    const q = this.gridPoints()[0];
    return !!q && Math.abs(q.x - mid[0]) < 1e-6 && Math.abs(q.y - mid[1]) < 1e-6;
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveMidpoint()) return true;
    return await base.call(this);
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/midpoint/i.test(this.curInstruction())) {
      const P = this.plottedPoints();
      const ends = P.length >= 2 ? P.slice(0, 2) : this.promptPairs().slice(0, 2);
      if (ends && ends.length === 2) {
        const mid = [(ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2];
        return '(' + mid[0] + ', ' + mid[1] + ')';
      }
    }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (/midpoint/i.test(this.curInstruction())) {
      const P = this.plottedPoints();
      const ends = P.length >= 2 ? P.slice(0, 2) : this.promptPairs().slice(0, 2);
      if (ends && ends.length === 2) {
        const mid = [(ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2];
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const p = this.choicePair(e);
          return p && Math.abs(p[0] - mid[0]) < 1e-6 && Math.abs(p[1] - mid[1]) < 1e-6; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /midpoint/i]);
})();
;'__duo ready';

// "Create a segment with midpoint (1, 1)": shift BOTH endpoints by the offset
// between the current midpoint and the requested one.
window.__duo.solveMakeMidpoint = async function () {
  const txt = this.promptLatex().map(l => this.ascii(l)
    .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '').replace(/[{}&~\s\\]/g, '')
    .replace(/[−–—]/g, '-')).join(' ');
  if (!/midpoint/i.test(txt)) return false;
  const pts = this.gridPoints(); if (pts.length !== 2) return false;
  const pairs = [...txt.matchAll(/\((-?[\d.]+),(-?[\d.]+)\)/g)].map(m => [parseFloat(m[1]), parseFloat(m[2])]);
  const cur = [(pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2];
  // the requested midpoint is the pair that is NOT the current one
  const want = pairs.find(p => Math.abs(p[0] - cur[0]) > 1e-9 || Math.abs(p[1] - cur[1]) > 1e-9);
  if (!want) return false;
  const dx = want[0] - cur[0], dy = want[1] - cur[1];
  if (!dx && !dy) return false;
  const targets = pts.map(p => [p.x + dx, p.y + dy]);
  for (let i = 0; i < 2; i++) {
    const p = this.gridPoints()[i]; if (!p) return false;
    await this.dragPointTo(p, targets[i][0], targets[i][1]);
  }
  const q = this.gridPoints();
  return q.length === 2 &&
    Math.abs((q[0].x + q[1].x) / 2 - want[0]) < 1e-6 &&
    Math.abs((q[0].y + q[1].y) / 2 - want[1]) < 1e-6;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveMakeMidpoint()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "Select the coordinates of B" given endpoint A and the midpoint M:
// B = 2M - A. Falls back to reading B straight off the plot when it is drawn.
window.__duo.solveOtherEndpoint = function () {
  const ins = this.curInstruction();
  const m = ins.replace(/\s/g, '').match(/coordinatesof([A-Za-z])/i);
  if (!m) return null;
  const want = m[1].toUpperCase();
  const N = this.namedPoints();
  if (N && N[want]) {
    const p = N[want];
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const q = this.choicePair(e);
      return q && Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6; });
    if (i >= 0) return { i };
  }
  const txt = this.promptLatex().map(l => this.ascii(l)
    .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '').replace(/[{}&~\s\\]/g, '')
    .replace(/[−–—]/g, '-')).join(' ');
  const mid = txt.match(/midpoint[^(]*\((-?[\d.]+),(-?[\d.]+)\)/i);
  const other = txt.match(/([A-Za-z])\s*=?\s*\((-?[\d.]+),(-?[\d.]+)\)/);
  if (!mid || !other) return null;
  const M = [parseFloat(mid[1]), parseFloat(mid[2])];
  const A = [parseFloat(other[2]), parseFloat(other[3])];
  const B = [2 * M[0] - A[0], 2 * M[1] - A[1]];
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const q = this.choicePair(e);
    return q && Math.abs(q[0] - B[0]) < 1e-6 && Math.abs(q[1] - B[1]) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveOtherEndpoint', /coordinates of/i]);
;'__duo ready';

// "Select the horizontal / vertical magnitude of the translation": the shift
// between the pre-image and image, from the plotted points or a stated rule.
window.__duo.translationVector = function () {
  const R = this.inferRule(); if (R) return [R.dx, R.dy];
  const T = this.transformRule();
  if (T && T.map) { const o = T.map([0, 0]); if (o) return [o[0], o[1]]; }
  const rows = this.tableRuleRows();
  if (rows && rows.length) { const r = rows[0];
    return [r.img[0] - r.pre[0], r.img[1] - r.pre[1]]; }
  return null;
};
window.__duo.solveMagnitude = function () {
  const ins = this.curInstruction();
  if (!/magnitude of the translation|horizontal magnitude|vertical magnitude/i.test(ins)) return null;
  const v = this.translationVector(); if (!v) return null;
  const want = /vertical/i.test(ins) ? v[1] : v[0];
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  let i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - want) < 1e-6; });
  if (i < 0) i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(Math.abs(q) - Math.abs(want)) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveMagnitude', /magnitude/i]);
;'__duo ready';

// "Create the vector that matches the translation from P to P'": the static
// pair gives the vector; move the draggable arrow's head so tail+v == head.
window.__duo.solveMakeVector = async function () {
  if (!/create the vector/i.test(this.curInstruction())) return false;
  const drag = this.gridPoints(); if (drag.length !== 2) return false;
  const dragSet = new Set(drag.map(p => p.x + ',' + p.y));
  const statics = this.plottedPoints().filter(p => !dragSet.has(p[0] + ',' + p[1]));
  if (statics.length !== 2) return false;
  const v = [statics[1][0] - statics[0][0], statics[1][1] - statics[0][1]];
  const g = this.diagram().M.grid;
  const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
  for (const [ti, hi] of [[0, 1], [1, 0]]) {
    const tail = drag[ti], want = [tail.x + v[0], tail.y + v[1]];
    if (want[0] < x0 || want[0] > x1 || want[1] < y0 || want[1] > y1) continue;
    const head = this.gridPoints()[hi];
    if (Math.abs(head.x - want[0]) < 1e-9 && Math.abs(head.y - want[1]) < 1e-9) return true;
    await this.dragPointTo(head, want[0], want[1]);
    const q = this.gridPoints();
    if (q.length === 2 && Math.abs(q[hi].x - want[0]) < 1e-6 && Math.abs(q[hi].y - want[1]) < 1e-6) return true;
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveMakeVector()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "4 units right, 4 units down": the vector is stated in words rather than
// shown as a point pair.
window.__duo.statedVector = function () {
  const txt = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '');
  let dx = 0, dy = 0, seen = false;
  for (const m of txt.matchAll(/(\d+(?:\.\d+)?)units?(left|right|up|down)/gi)) {
    const n = parseFloat(m[1]); seen = true;
    if (/left/i.test(m[2])) dx -= n; else if (/right/i.test(m[2])) dx += n;
    else if (/up/i.test(m[2])) dy += n; else dy -= n;
  }
  return seen ? [dx, dy] : null;
};
(function () {
  const base = window.__duo.solveMakeVector;
  window.__duo.solveMakeVector = async function () {
    if (await base.call(this)) return true;
    const v = this.statedVector(); if (!v) return false;
    const drag = this.gridPoints(); if (drag.length !== 2) return false;
    const g = this.diagram().M.grid;
    const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
    for (const [ti, hi] of [[0, 1], [1, 0]]) {
      const tail = drag[ti], want = [tail.x + v[0], tail.y + v[1]];
      if (want[0] < x0 || want[0] > x1 || want[1] < y0 || want[1] > y1) continue;
      const head = this.gridPoints()[hi];
      if (Math.abs(head.x - want[0]) < 1e-9 && Math.abs(head.y - want[1]) < 1e-9) return true;
      await this.dragPointTo(head, want[0], want[1]);
      const q = this.gridPoints();
      if (q.length === 2 && Math.abs(q[hi].x - want[0]) < 1e-6 && Math.abs(q[hi].y - want[1]) < 1e-6) return true;
    }
    return false;
  };
})();
;'__duo ready';

// The page renders the prompt text twice, so "4 units right, 4 units down"
// summed to (8, -8). Count each direction once.
window.__duo.statedVector = function () {
  const txt = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '');
  const seen = {};
  for (const m of txt.matchAll(/(\d+(?:\.\d+)?)units?(left|right|up|down)/gi)) {
    const dir = m[2].toLowerCase();
    if (seen[dir] === undefined) seen[dir] = parseFloat(m[1]);
  }
  if (!Object.keys(seen).length) return null;
  const dx = (seen.right || 0) - (seen.left || 0);
  const dy = (seen.up || 0) - (seen.down || 0);
  return [dx, dy];
};
;'__duo ready';

// "Translate the point" with the vector drawn as an arrow: exactly one point is
// the movable one, the other two are the arrow's tail and head.
window.__duo.solveTranslatePoint = async function () {
  if (!/translate the point/i.test(this.curInstruction())) return false;
  const v = this.statedVector(); if (!v) return false;
  const pts = this.gridPoints(); if (pts.length < 1) return false;
  // the arrow's endpoints differ by exactly the vector; the leftover is the point
  let movable = null;
  for (const p of pts) {
    const isArrowEnd = pts.some(q => q !== p &&
      ((Math.abs(q.x - p.x - v[0]) < 1e-9 && Math.abs(q.y - p.y - v[1]) < 1e-9) ||
       (Math.abs(p.x - q.x - v[0]) < 1e-9 && Math.abs(p.y - q.y - v[1]) < 1e-9)));
    if (!isArrowEnd) { movable = p; break; }
  }
  if (!movable) return false;
  const want = [movable.x + v[0], movable.y + v[1]];
  await this.dragPointTo(movable, want[0], want[1]);
  const q = this.gridPoints();
  return q.some(p => Math.abs(p.x - want[0]) < 1e-6 && Math.abs(p.y - want[1]) < 1e-6);
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveTranslatePoint()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// curInstruction returns the vector line ("3 units right 2 units down"), not the
// "Translate the point" title, so the gate never matched. Gate on the whole
// prompt instead.
(function () {
  const base = window.__duo.solveTranslatePoint;
  window.__duo.solveTranslatePoint = async function () {
    const all = this.mathParts().concat([this.curInstruction()]).join(' ');
    if (!/translate the point|translate the figure|translate the segment/i.test(all)) return false;
    const v = this.statedVector(); if (!v) return false;
    const pts = this.gridPoints(); if (!pts.length) return false;
    const isEnd = p => pts.some(q => q !== p &&
      ((Math.abs(q.x - p.x - v[0]) < 1e-9 && Math.abs(q.y - p.y - v[1]) < 1e-9) ||
       (Math.abs(p.x - q.x - v[0]) < 1e-9 && Math.abs(p.y - q.y - v[1]) < 1e-9)));
    const movable = pts.filter(p => !isEnd(p));
    if (!movable.length) return false;
    for (const p of movable) {
      const want = [p.x + v[0], p.y + v[1]];
      await this.dragPointTo(p, want[0], want[1]);
    }
    return true;
  };
})();
;'__duo ready';

// mathParts strips spaces, so "Translate the point" arrives as
// "Translatethepoint" — match the despaced form.
(function () {
  const base = window.__duo.solveTranslatePoint;
  window.__duo.solveTranslatePoint = async function () {
    const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
    if (!/translatethe(point|figure|segment|shape)/.test(all)) return false;
    const v = this.statedVector(); if (!v) return false;
    const pts = this.gridPoints(); if (!pts.length) return false;
    const isEnd = p => pts.some(q => q !== p &&
      ((Math.abs(q.x - p.x - v[0]) < 1e-9 && Math.abs(q.y - p.y - v[1]) < 1e-9) ||
       (Math.abs(p.x - q.x - v[0]) < 1e-9 && Math.abs(p.y - q.y - v[1]) < 1e-9)));
    const movable = pts.filter(p => !isEnd(p));
    if (!movable.length || movable.length === pts.length) return false;
    for (const p of movable) await this.dragPointTo(p, p.x + v[0], p.y + v[1]);
    return true;
  };
})();
;'__duo ready';

// "Select the translation": choices are worded vectors ("3 units right, 2 units
// down"). Measure the actual shift, then parse each choice the same way.
window.__duo.parseWordVector = function (text) {
  const t = this.ascii(text).replace(/\\(mathbf|textbf|text)\b/g, '').replace(/[{}\\]/g, '')
    .replace(/\s/g, '').toLowerCase();
  const seen = {};
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)units?(left|right|up|down)/g))
    if (seen[m[2]] === undefined) seen[m[2]] = parseFloat(m[1]);
  if (!Object.keys(seen).length) return null;
  return [(seen.right || 0) - (seen.left || 0), (seen.up || 0) - (seen.down || 0)];
};
window.__duo.solveSelectTranslation = function () {
  if (!/select the translation|which translation/i.test(this.curInstruction())) return null;
  let v = this.translationVector();
  if (!v) {
    const P = this.plottedPoints();
    if (P.length >= 2 && P.length % 2 === 0) {
      const h = P.length / 2, A = P.slice(0, h), B = P.slice(h);
      const d = [B[0][0] - A[0][0], B[0][1] - A[0][1]];
      if (A.every((p, i) => Math.abs(B[i][0] - p[0] - d[0]) < 1e-6 && Math.abs(B[i][1] - p[1] - d[1]) < 1e-6)) v = d;
    }
  }
  if (!v) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const w = this.parseWordVector(this.choiceLatex(e));
    return w && Math.abs(w[0] - v[0]) < 1e-6 && Math.abs(w[1] - v[1]) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveSelectTranslation', /select the translation|which translation/i]);
;'__duo ready';

// typed magnitudes: "enter the vertical/horizontal magnitude of the translation"
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/magnitude of the translation|horizontal magnitude|vertical magnitude/i.test(ins)) {
      let v = this.translationVector();
      if (!v) {
        const P = this.plottedPoints();
        if (P.length >= 2 && P.length % 2 === 0) {
          const h = P.length / 2, A = P.slice(0, h), B = P.slice(h);
          const d = [B[0][0] - A[0][0], B[0][1] - A[0][1]];
          if (A.every((p, i) => Math.abs(B[i][0] - p[0] - d[0]) < 1e-6 && Math.abs(B[i][1] - p[1] - d[1]) < 1e-6)) v = d;
        }
      }
      if (!v) v = this.statedVector();
      if (v) return /vertical/i.test(ins) ? v[1] : v[0];
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// Pre-image and image drawn as POLYGONS (no plotted points): measure the shift
// from the two shapes' centroids, in grid units.
window.__duo.shapeShift = function () {
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const doc = d.f.contentDocument, g = d.M.grid;
  const shapes = [...doc.querySelectorAll('path,polygon,polyline')]
    .filter(e => /polygon|(^|\s)shape(\s|$)/i.test(e.getAttribute('class') || ''))
    .filter(e => typeof e.getTotalLength === 'function');
  if (shapes.length < 2) return null;
  const centroid = el => {
    let L = 0; try { L = el.getTotalLength(); } catch (e) { return null; }
    if (!L) return null;
    const ctm = el.getScreenCTM(); if (!ctm) return null;
    const svg = el.ownerSVGElement;
    const fr = d.f.getBoundingClientRect();
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      const q = el.getPointAtLength((i / 60) * L);
      const p = svg.createSVGPoint(); p.x = q.x; p.y = q.y;
      const t = p.matrixTransform(ctm);
      let gp; try { gp = g.pixelToGrid([t.x - fr.left, t.y - fr.top]); } catch (e) { continue; }
      sx += gp[0]; sy += gp[1]; n++;
    }
    return n ? [sx / n, sy / n] : null;
  };
  const A = centroid(shapes[0]), B = centroid(shapes[1]);
  if (!A || !B) return null;
  const v = [Math.round(B[0] - A[0]), Math.round(B[1] - A[1])];
  return (v[0] || v[1]) ? v : null;
};
(function () {
  const base = window.__duo.solveMakeVector;
  window.__duo.solveMakeVector = async function () {
    if (await base.call(this)) return true;
    const all = this.mathParts().join(' ').replace(/\s/g, '').toLowerCase();
    if (!/createthevector/.test(all)) return false;
    let v = this.shapeShift(); if (!v) return false;
    const drag = this.gridPoints(); if (drag.length !== 2) return false;
    const g = this.diagram().M.grid;
    const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
    for (const [ti, hi] of [[0, 1], [1, 0]]) {
      const tail = drag[ti], want = [tail.x + v[0], tail.y + v[1]];
      if (want[0] < x0 || want[0] > x1 || want[1] < y0 || want[1] > y1) continue;
      await this.dragPointTo(this.gridPoints()[hi], want[0], want[1]);
      const q = this.gridPoints();
      if (q.length === 2 && Math.abs(q[hi].x - want[0]) < 1e-6 && Math.abs(q[hi].y - want[1]) < 1e-6) return true;
    }
    return false;
  };
})();
;'__duo ready';

// worded-vector choices also appear for shape-to-shape transformations
(function () {
  const RE = /select the (translation|transformation)|which translation/i;
  const base = window.__duo.solveSelectTranslation;
  window.__duo.solveSelectTranslation = function () {
    const r = base.call(this); if (r) return r;
    if (!RE.test(this.curInstruction())) return null;
    const v = this.shapeShift(); if (!v) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const w = this.parseWordVector(this.choiceLatex(e));
      return w && Math.abs(w[0] - v[0]) < 1e-6 && Math.abs(w[1] - v[1]) < 1e-6; });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveSelectTranslation', RE]);
})();
;'__duo ready';

// magnitudes for the shape-to-shape case (no plotted points, only polygons)
(function () {
  const RE = /magnitude of the translation|horizontal magnitude|vertical magnitude/i;
  const anyVector = function () {
    let v = this.translationVector();
    if (!v) {
      const P = this.plottedPoints();
      if (P.length >= 2 && P.length % 2 === 0) {
        const h = P.length / 2, A = P.slice(0, h), B = P.slice(h);
        const d = [B[0][0] - A[0][0], B[0][1] - A[0][1]];
        if (A.every((p, i) => Math.abs(B[i][0] - p[0] - d[0]) < 1e-6 && Math.abs(B[i][1] - p[1] - d[1]) < 1e-6)) v = d;
      }
    }
    if (!v) v = this.shapeShift();
    if (!v) v = this.statedVector();
    return v;
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (RE.test(ins)) { const v = anyVector.call(this); if (v) return /vertical/i.test(ins) ? v[1] : v[0]; }
    return bo.call(this);
  };
  const bm = window.__duo.solveMagnitude;
  window.__duo.solveMagnitude = function () {
    const r = bm.call(this); if (r) return r;
    const ins = this.curInstruction();
    if (!RE.test(ins)) return null;
    const v = anyVector.call(this); if (!v) return null;
    const want = /vertical/i.test(ins) ? v[1] : v[0];
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - want) < 1e-6; });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveMagnitude', RE]);
})();
;'__duo ready';

// "Select the distance from A to A'": the gap between a point and its image.
// Works from named points, from a plotted pair, or (for a reflection) twice the
// distance to the mirror line.
window.__duo.pointToImageDistance = function () {
  const N = this.namedPoints();
  if (N) {
    const keys = Object.keys(N);
    if (keys.length >= 2) {
      const a = N[keys[0]], b = N[keys[1]];
      return Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
  }
  const P = this.plottedPoints();
  if (P.length === 2) return Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
  const L = this.mirrorLine();
  if (L && P.length === 1) {
    const d = L.horiz ? Math.abs(P[0][1] - L.at) : Math.abs(P[0][0] - L.at);
    return 2 * d;
  }
  const v = this.shapeShift();
  if (v) return Math.hypot(v[0], v[1]);
  return null;
};
(function () {
  const RE = /distance from [a-z].{0,8}to [a-z]/i;
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const d = this.pointToImageDistance();
      if (d !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - d) < 1e-6; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) { const d = this.pointToImageDistance(); if (d !== null) return d; }
    return bo.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// typed "distance from A to the line of reflection" — half the A→A' gap, or the
// perpendicular distance to the drawn mirror.
(function () {
  const RE = /distance from [a-z].{0,24}line of reflection|distance to the (mirror|line)/i;
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) {
      const L = this.mirrorLine(), P = this.plottedPoints();
      if (L && P.length) {
        const d = L.horiz ? Math.abs(P[0][1] - L.at) : Math.abs(P[0][0] - L.at);
        if (isFinite(d)) return d;
      }
      const r = this.reflectionDistance(); if (r !== null) return r;
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// Labels can carry primes (A', B'), which the plain /^[A-Z]$/ filter rejected.
window.__duo.namedPoints = function () {
  const V = this.plottedPoints();
  const labs = (this.diagramLabels() || [])
    .filter(l => /^[A-Z]['’]?$/.test(l.t.trim().replace(/\s/g, '')));
  if (!V.length || !labs.length) return null;
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const g = d.M.grid, fr = d.f.getBoundingClientRect();
  const out = {};
  for (const l of labs) {
    let px;
    try { px = g.pixelToGrid([l.x - fr.left, l.y - fr.top]); } catch (e) { continue; }
    let best = null, bd = Infinity;
    for (const p of V) { const dd = Math.hypot(p[0] - px[0], p[1] - px[1]); if (dd < bd) { bd = dd; best = p; } }
    if (best && bd < 3) out[l.t.trim().replace(/\s|’/g, "'")] = best;
  }
  return Object.keys(out).length >= 2 ? out : null;
};
(function () {
  const base = window.__duo.solveNamedDistance;
  window.__duo.solveNamedDistance = function () {
    const ins = this.curInstruction().replace(/\s/g, '').replace(/[’]/g, "'");
    const m = ins.match(/lengthof([a-z])('?)([a-z])('?)/i);
    if (m) {
      const N = this.namedPoints();
      if (N) {
        const a = N[(m[1] + m[2]).toUpperCase()], b = N[(m[3] + m[4]).toUpperCase()];
        if (a && b) {
          const want = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
          const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - want) < 1e-6; });
          if (i >= 0) return { i };
        }
      }
    }
    return base.call(this);
  };
  window.__duo.RULES.unshift(['solveNamedDistance', /length of/i]);
})();
;'__duo ready';

// diagramLabels' rects are already iframe-local, so subtracting the frame offset
// pushed every label off the grid and namedPoints always came back null.
window.__duo.namedPoints = function () {
  const V = this.plottedPoints();
  const labs = (this.diagramLabels() || [])
    .filter(l => /^[A-Z]['’]?$/.test(l.t.trim().replace(/\s/g, '')));
  if (!V.length || !labs.length) return null;
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const g = d.M.grid;
  const out = {};
  for (const l of labs) {
    let px;
    try { px = g.pixelToGrid([l.x, l.y]); } catch (e) { continue; }
    let best = null, bd = Infinity;
    for (const p of V) { const dd = Math.hypot(p[0] - px[0], p[1] - px[1]); if (dd < bd) { bd = dd; best = p; } }
    if (best && bd < 3.5) out[l.t.trim().replace(/\s|’/g, "'")] = best;
  }
  return Object.keys(out).length >= 2 ? out : null;
};
;'__duo ready';

// "Distance from B to the line of reflection" with several labelled points:
// look B up by name, then measure to the mirror.
window.__duo.namedToMirror = function () {
  const ins = this.curInstruction().replace(/\s/g, '').replace(/[’]/g, "'");
  const m = ins.match(/distancefrom([a-z])('?)to/i); if (!m) return null;
  const L = this.mirrorLine(); if (!L) return null;
  const N = this.namedPoints();
  const p = N && N[(m[1] + m[2]).toUpperCase()];
  if (!p) return null;
  const d = L.horiz ? Math.abs(p[1] - L.at) : Math.abs(p[0] - L.at);
  return isFinite(d) ? d : null;
};
(function () {
  const RE = /distance from [a-z].{0,30}line of reflection/i;
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (RE.test(this.curInstruction())) {
      const d = this.namedToMirror();
      if (d !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - d) < 1e-6; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (RE.test(this.curInstruction())) { const d = this.namedToMirror(); if (d !== null) return d; }
    return bo.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', RE]);
})();
;'__duo ready';

// Excluding EVERY point sharing the slider's coordinate also removed real shape
// vertices. The mirror's own endpoints are the pair on that coordinate with the
// widest span — drop exactly those two.
window.__duo.solveMirrorSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  if (!/line of reflection|mirror/i.test(this.curInstruction())) return false;
  const cur = this.sliderValue();
  const P = this.plottedPoints(); if (P.length < 4) return false;
  for (const axis of [0, 1]) {
    const other = 1 - axis;
    const online = P.filter(p => cur !== null && Math.abs(p[axis] - cur) < 1e-9);
    if (online.length < 2) continue;
    // widest-separated pair on that line = the arrow's two ends
    let e1 = null, e2 = null, best = -1;
    for (let i = 0; i < online.length; i++) for (let j = i + 1; j < online.length; j++) {
      const d = Math.abs(online[i][other] - online[j][other]);
      if (d > best) { best = d; e1 = online[i]; e2 = online[j]; }
    }
    const rest = P.filter(p => p !== e1 && p !== e2);
    if (rest.length < 2 || rest.length % 2) continue;
    const groups = {};
    for (const p of rest) (groups[p[other]] = groups[p[other]] || []).push(p);
    const mids = []; let ok = true;
    for (const k of Object.keys(groups)) {
      const g = groups[k];
      if (g.length !== 2) { ok = false; break; }
      mids.push((g[0][axis] + g[1][axis]) / 2);
    }
    if (!ok || !mids.length) continue;
    if (mids.some(m => Math.abs(m - mids[0]) > 1e-9)) continue;
    const mid = mids[0];
    if (mid < S.s.min || mid > S.s.max) continue;
    return await this.setSlider2d(mid);
  }
  return false;
};
;'__duo ready';

// Unit 184: rotations. "Select the matching direction of rotation" — work out
// the signed angle from a point to its image about the centre. Screen y grows
// DOWNWARD in grid coords here, so a positive cross product is counterclockwise.
window.__duo.rotationInfo = function () {
  const N = this.namedPoints();
  let pre = null, img = null;
  if (N) {
    const k = Object.keys(N);
    const plain = k.find(x => !/'/.test(x)), prime = k.find(x => /'/.test(x));
    if (plain && prime) { pre = N[plain]; img = N[prime]; }
  }
  if (!pre) {
    const P = this.plottedPoints();
    if (P.length === 2) { pre = P[0]; img = P[1]; }
  }
  if (!pre || !img) return null;
  // centre: a static point equidistant from both, else the origin
  const P = this.plottedPoints();
  let c = [0, 0];
  for (const p of P) {
    if (p === pre || p === img) continue;
    const d1 = Math.hypot(pre[0] - p[0], pre[1] - p[1]);
    const d2 = Math.hypot(img[0] - p[0], img[1] - p[1]);
    if (Math.abs(d1 - d2) < 1e-6 && d1 > 1e-6) { c = p; break; }
  }
  const a = [pre[0] - c[0], pre[1] - c[1]], b = [img[0] - c[0], img[1] - c[1]];
  const cross = a[0] * b[1] - a[1] * b[0];
  const dot = a[0] * b[0] + a[1] * b[1];
  let deg = Math.atan2(cross, dot) * 180 / Math.PI;
  const ccw = deg > 0;
  deg = Math.round(Math.abs(deg));
  return { deg, ccw, centre: c };
};
window.__duo.solveRotationDirection = function () {
  if (!/direction of rotation|which direction/i.test(this.curInstruction())) return null;
  const R = this.rotationInfo(); if (!R) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
  const i = words.findIndex(w => R.ccw ? w.startsWith('counter') : (w.startsWith('clock') && !w.startsWith('counter')));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveRotationDirection', /direction of rotation|which direction/i]);
;'__duo ready';

// The prompt often just states a signed angle (-330°): negative is clockwise,
// positive counterclockwise. No geometry needed.
(function () {
  const base = window.__duo.solveRotationDirection;
  window.__duo.solveRotationDirection = function () {
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
    if (!words.some(w => /clockwise/.test(w))) return base.call(this);
    const txt = this.promptLatex().map(l => this.ascii(l)).join(' ').replace(/[−–—]/g, '-');
    const m = txt.match(/(-?\d+(?:\.\d+)?)\s*(?:°|\\degree|degrees?)/);
    if (m) {
      const ccw = parseFloat(m[1]) > 0;
      const i = words.findIndex(w => ccw ? w.startsWith('counter') : (w.startsWith('clock')));
      if (i >= 0) return { i };
    }
    return base.call(this);
  };
})();
;'__duo ready';

// "30° clockwise" -> pick the signed form (-30°); "N° counterclockwise" -> +N.
window.__duo.solveSignedAngle = function () {
  const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
  const m = all.match(/(-?\d+(?:\.\d+)?)(?:°|degrees?)(counterclockwise|clockwise)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const want = /counter/.test(m[2]) ? Math.abs(n) : -Math.abs(n);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/degrees?|°/gi, '').replace(/[−–—]/g, '-');
    const v = parseFloat(t);
    return isFinite(v) && Math.abs(v - want) < 1e-6;
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveSignedAngle', /clockwise/i]);

// "Select the angle of rotation from A to A'": measure it.
window.__duo.solveRotationAngle = function () {
  if (!/angle of rotation/i.test(this.curInstruction())) return null;
  const R = this.rotationInfo(); if (!R) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const norm = a => ((a % 360) + 360) % 360;
  const want = norm(R.ccw ? R.deg : -R.deg);
  let i = ch.findIndex(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/degrees?|°/gi, '').replace(/[−–—]/g, '-');
    const v = parseFloat(t);
    return isFinite(v) && Math.abs(norm(v) - want) < 1;
  });
  if (i < 0) i = ch.findIndex(e => {
    const v = parseFloat(this.plainMath(this.choiceLatex(e)).replace(/degrees?|°/gi, '').replace(/[−–—]/g, '-'));
    return isFinite(v) && Math.abs(Math.abs(v) - R.deg) < 1;
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveRotationAngle', /angle of rotation/i]);
;'__duo ready';

// Nearest-label matching gave A' the centre point (labels sit close together).
// Assign labels to points ONE-TO-ONE, closest pair first.
window.__duo.namedPoints = function () {
  const V = this.plottedPoints();
  const labs = (this.diagramLabels() || [])
    .filter(l => /^[A-Za-z]['’]?$/.test(l.t.trim().replace(/\s/g, '')));
  if (!V.length || !labs.length) return null;
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const g = d.M.grid;
  const pos = [];
  for (const l of labs) {
    let px; try { px = g.pixelToGrid([l.x, l.y]); } catch (e) { continue; }
    pos.push({ name: l.t.trim().replace(/\s|’/g, "'"), px });
  }
  const out = {}, freeP = V.slice(), freeL = pos.slice();
  while (freeL.length && freeP.length) {
    let bl = 0, bp = 0, bd = Infinity;
    freeL.forEach((l, li) => freeP.forEach((p, pi) => {
      const dd = Math.hypot(p[0] - l.px[0], p[1] - l.px[1]);
      if (dd < bd) { bd = dd; bl = li; bp = pi; }
    }));
    if (bd > 3.5) break;
    out[freeL[bl].name] = freeP[bp];
    freeL.splice(bl, 1); freeP.splice(bp, 1);
  }
  return Object.keys(out).length >= 2 ? out : null;
};
(function () {
  const base = window.__duo.rotationInfo;
  window.__duo.rotationInfo = function () {
    const N = this.namedPoints();
    if (N) {
      const keys = Object.keys(N);
      const plain = keys.find(k => /^[A-Z]$/.test(k));
      const prime = keys.find(k => /^[A-Z]'$/.test(k));
      const cen = keys.find(k => /^[a-z]$/.test(k));       // lowercase = centre
      if (plain && prime) {
        const pre = N[plain], img = N[prime];
        const c = cen ? N[cen] : [0, 0];
        const a = [pre[0] - c[0], pre[1] - c[1]], b = [img[0] - c[0], img[1] - c[1]];
        const cross = a[0] * b[1] - a[1] * b[0], dot = a[0] * b[0] + a[1] * b[1];
        const deg = Math.atan2(cross, dot) * 180 / Math.PI;
        return { deg: Math.round(Math.abs(deg)), ccw: deg > 0, centre: c };
      }
    }
    return base.call(this);
  };
})();
;'__duo ready';

// Labels sit offset from their points (consistently to the right), so greedy
// nearest-first stole the wrong point. Choose the assignment minimising TOTAL
// distance — with <= 6 labels a full permutation search is cheap and exact.
window.__duo.namedPoints = function () {
  const V = this.plottedPoints();
  const labs = (this.diagramLabels() || [])
    .filter(l => /^[A-Za-z]['’]?$/.test(l.t.trim().replace(/\s/g, '')));
  if (!V.length || !labs.length) return null;
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const g = d.M.grid;
  const L = [];
  for (const l of labs) {
    let px; try { px = g.pixelToGrid([l.x, l.y]); } catch (e) { continue; }
    L.push({ name: l.t.trim().replace(/\s|’/g, "'"), px });
  }
  if (L.length < 2 || L.length > 6 || V.length < L.length) return null;
  const idx = V.map((_, i) => i);
  let best = null, bestCost = Infinity;
  const perm = (chosen, remaining) => {
    if (chosen.length === L.length) {
      let c = 0;
      chosen.forEach((pi, li) => { c += Math.hypot(V[pi][0] - L[li].px[0], V[pi][1] - L[li].px[1]); });
      if (c < bestCost) { bestCost = c; best = chosen.slice(); }
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      chosen.push(remaining[i]);
      perm(chosen, remaining.filter((_, k) => k !== i));
      chosen.pop();
    }
  };
  perm([], idx);
  if (!best) return null;
  const out = {};
  best.forEach((pi, li) => { out[L[li].name] = V[pi]; });
  return out;
};
;'__duo ready';

// typed "enter the angle of rotation from A to A'"
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/angle of rotation/i.test(this.curInstruction())) {
      const R = this.rotationInfo();
      if (R && R.deg) return R.ccw ? R.deg : -R.deg;
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Rotate 90° counterclockwise": apply the stated rotation about the marked
// centre (lowercase label, else the origin) to every draggable point.
window.__duo.solveRotatePoints = async function () {
  const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
  const m = all.match(/(-?\d+(?:\.\d+)?)(?:°|degrees?)(counterclockwise|clockwise)/);
  if (!m) return false;
  const n = Math.abs(parseFloat(m[1]));
  const ccw = /counter/.test(m[2]);
  const pts = this.gridPoints(); if (!pts.length) return false;
  const N = this.namedPoints();
  let c = [0, 0];
  if (N) { const k = Object.keys(N).find(x => /^[a-z]$/.test(x)); if (k) c = N[k]; }
  const rad = (ccw ? 1 : -1) * n * Math.PI / 180;
  const cs = Math.cos(rad), sn = Math.sin(rad);
  const rot = p => {
    const dx = p[0] - c[0], dy = p[1] - c[1];
    return [Math.round((c[0] + dx * cs - dy * sn) * 1e6) / 1e6,
            Math.round((c[1] + dx * sn + dy * cs) * 1e6) / 1e6];
  };
  const targets = pts.map(p => rot([p.x, p.y]));
  if (targets.every((t, i) => Math.abs(t[0] - pts[i].x) < 1e-9 && Math.abs(t[1] - pts[i].y) < 1e-9)) return false;
  for (let i = 0; i < pts.length; i++) {
    const p = this.gridPoints()[i]; if (!p) return false;
    if (Math.abs(p.x - targets[i][0]) < 1e-9 && Math.abs(p.y - targets[i][1]) < 1e-9) continue;
    await this.dragPointTo(p, targets[i][0], targets[i][1]);
  }
  const now = this.gridPoints();
  return targets.every(t => now.some(q => Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6));
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveRotatePoints()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// A bare "90°" with no direction word means counterclockwise (Duolingo's
// convention); a negative angle means clockwise. Also allow a lone lowercase
// centre label, which namedPoints rejects for needing two labels.
window.__duo.centrePoint = function () {
  const N = this.namedPoints();
  if (N) { const k = Object.keys(N).find(x => /^[a-z]$/.test(x)); if (k) return N[k]; }
  const labs = (this.diagramLabels() || []).filter(l => /^[a-z]$/.test(l.t.trim()));
  const d = this.diagram();
  if (labs.length === 1 && d && d.M.grid) {
    let px; try { px = d.M.grid.pixelToGrid([labs[0].x, labs[0].y]); } catch (e) { px = null; }
    if (px) {
      let best = null, bd = Infinity;
      for (const p of this.plottedPoints()) {
        const dd = Math.hypot(p[0] - px[0], p[1] - px[1]);
        if (dd < bd) { bd = dd; best = p; }
      }
      if (best && bd < 3.5) return best;
    }
  }
  return [0, 0];
};
(function () {
  const base = window.__duo.solveRotatePoints;
  window.__duo.solveRotatePoints = async function () {
    if (await base.call(this)) return true;
    const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
    if (!/rotate/.test(all)) return false;
    const m = all.match(/(-?\d+(?:\.\d+)?)(?:°|degrees?)/);
    if (!m) return false;
    const n = parseFloat(m[1]);
    const rad = n * Math.PI / 180;          // positive = counterclockwise
    const c = this.centrePoint();
    const pts = this.gridPoints(); if (!pts.length) return false;
    const cs = Math.cos(rad), sn = Math.sin(rad);
    const targets = pts.map(p => {
      const dx = p.x - c[0], dy = p.y - c[1];
      return [Math.round((c[0] + dx * cs - dy * sn) * 1e6) / 1e6,
              Math.round((c[1] + dx * sn + dy * cs) * 1e6) / 1e6];
    });
    if (targets.every((t, i) => Math.abs(t[0] - pts[i].x) < 1e-9 && Math.abs(t[1] - pts[i].y) < 1e-9)) return false;
    for (let i = 0; i < pts.length; i++) {
      const p = this.gridPoints()[i]; if (!p) return false;
      await this.dragPointTo(p, targets[i][0], targets[i][1]);
    }
    const now = this.gridPoints();
    return targets.every(t => now.some(q => Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6));
  };
})();
;'__duo ready';

// "Select the position of A from center C": the offset A - C, worded as
// "2 left, 1 up" style choices.
window.__duo.solvePositionFromCentre = function () {
  const ins = this.curInstruction().replace(/\s/g, '');
  const m = ins.match(/positionof([a-z])('?)from(?:center|centre)([a-z])/i);
  if (!m) return null;
  const N = this.namedPoints(); if (!N) return null;
  const p = N[(m[1] + m[2]).toUpperCase()] || N[m[1] + m[2]];
  const c = N[m[3]] || N[m[3].toLowerCase()] || this.centrePoint();
  if (!p || !c) return null;
  const v = [p[0] - c[0], p[1] - c[1]];
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const w = this.parseWordVector(this.choiceLatex(e));
    return w && Math.abs(w[0] - v[0]) < 1e-6 && Math.abs(w[1] - v[1]) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solvePositionFromCentre', /position of .{0,12}from (center|centre)/i]);

// the worded choices here omit the word "units" ("2 left", "1 up")
(function () {
  const base = window.__duo.parseWordVector;
  window.__duo.parseWordVector = function (text) {
    const r = base.call(this, text); if (r) return r;
    const t = this.ascii(text).replace(/\\(mathbf|textbf|text)\b/g, '').replace(/[{}\\]/g, '')
      .replace(/\s+/g, ' ').toLowerCase();
    const seen = {};
    for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(left|right|up|down)/g))
      if (seen[m[2]] === undefined) seen[m[2]] = parseFloat(m[1]);
    if (!Object.keys(seen).length) return null;
    return [(seen.right || 0) - (seen.left || 0), (seen.up || 0) - (seen.down || 0)];
  };
})();
;'__duo ready';

// "Select the match" with polygon names: count the drawn shape's corners
// (points where the outline changes direction sharply) and name it.
window.__duo.SHAPE_NAMES = { 3: 'triangle', 4: 'quadrilateral', 5: 'pentagon',
  6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon' };
window.__duo.countCorners = function () {
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const el = [...doc.querySelectorAll('path,polygon,polyline')]
    .find(e => /polygon|(^|\s)shape(\s|$)/i.test(e.getAttribute('class') || ''));
  if (!el || typeof el.getTotalLength !== 'function') return null;
  let L = 0; try { L = el.getTotalLength(); } catch (e) { return null; }
  if (!L) return null;
  const N = 360, P = [];
  for (let i = 0; i < N; i++) { const q = el.getPointAtLength((i / N) * L); P.push([q.x, q.y]); }
  let corners = 0;
  for (let i = 0; i < N; i++) {
    const a = P[(i - 6 + N) % N], b = P[i], c = P[(i + 6) % N];
    const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    if (lu < 1e-6 || lv < 1e-6) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    if (ang > 0.5) corners++;               // sharp turn
  }
  // each corner spans several samples; collapse by the sample window
  return Math.max(3, Math.round(corners / 11));
};
window.__duo.solveShapeName = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
  if (!words.some(w => /gon|triangle|square|rectangle|rhombus/.test(w))) return null;
  const n = this.countCorners(); if (!n) return null;
  const name = this.SHAPE_NAMES[n];
  if (!name) return null;
  let i = words.findIndex(w => w.startsWith(name));
  if (i < 0 && n === 4) i = words.findIndex(w => /square|rectangle|rhombus|quadrilateral/.test(w));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveShapeName', /select the match|what shape|name the shape/i]);
;'__duo ready';

// "rotational symmetry" vs "reflectional symmetry": sample the drawn outline,
// then test whether it maps onto itself under a rotation (<360°) or a mirror.
window.__duo.shapeSamples = function () {
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const el = [...doc.querySelectorAll('path,polygon,polyline')]
    .find(e => /polygon|(^|\s)shape(\s|$)/i.test(e.getAttribute('class') || ''));
  if (!el || typeof el.getTotalLength !== 'function') return null;
  let L = 0; try { L = el.getTotalLength(); } catch (e) { return null; }
  if (!L) return null;
  const P = [];
  for (let i = 0; i < 240; i++) { const q = el.getPointAtLength((i / 240) * L); P.push([q.x, q.y]); }
  return P;
};
window.__duo.symmetryOf = function () {
  const P = this.shapeSamples(); if (!P) return null;
  const cx = P.reduce((a, p) => a + p[0], 0) / P.length;
  const cy = P.reduce((a, p) => a + p[1], 0) / P.length;
  const span = Math.max(...P.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  const tol = span * 0.06;
  const near = q => P.some(p => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol);
  const maps = f => P.every(p => near(f(p)));
  let rot = false;
  for (const deg of [180, 120, 90, 72, 60]) {
    const r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    if (maps(p => { const dx = p[0] - cx, dy = p[1] - cy;
      return [cx + dx * cs - dy * sn, cy + dx * sn + dy * cs]; })) { rot = true; break; }
  }
  let ref = false;
  for (let a = 0; a < 180; a += 15) {
    const r = a * Math.PI / 180, c2 = Math.cos(2 * r), s2 = Math.sin(2 * r);
    if (maps(p => { const dx = p[0] - cx, dy = p[1] - cy;
      return [cx + dx * c2 + dy * s2, cy + dx * s2 - dy * c2]; })) { ref = true; break; }
  }
  return { rot, ref };
};
window.__duo.solveSymmetry = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
  if (!words.some(w => /symmetry/.test(w))) return null;
  const S = this.symmetryOf(); if (!S) return null;
  if (S.ref && !S.rot) { const i = words.findIndex(w => w.startsWith('reflection') || w.startsWith('reflectional')); if (i >= 0) return { i }; }
  if (S.rot && !S.ref) { const i = words.findIndex(w => w.startsWith('rotational')); if (i >= 0) return { i }; }
  return null;
};
window.__duo.RULES.unshift(['solveSymmetry', /symmetry|select the match/i]);
;'__duo ready';

// "Select the number of lines of symmetry": sweep mirror angles and count the
// distinct ones that map the outline onto itself.
window.__duo.countSymmetryLines = function () {
  const P = this.shapeSamples(); if (!P) return null;
  const cx = P.reduce((a, p) => a + p[0], 0) / P.length;
  const cy = P.reduce((a, p) => a + p[1], 0) / P.length;
  const span = Math.max(...P.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  const tol = span * 0.06;
  const near = q => P.some(p => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol);
  const hits = [];
  for (let a = 0; a < 180; a += 1) {
    const r = a * Math.PI / 180, c2 = Math.cos(2 * r), s2 = Math.sin(2 * r);
    const ok = P.every(p => { const dx = p[0] - cx, dy = p[1] - cy;
      return near([cx + dx * c2 + dy * s2, cy + dx * s2 - dy * c2]); });
    if (ok) hits.push(a);
  }
  // collapse angles that are within a few degrees of each other
  const groups = [];
  for (const a of hits) {
    if (!groups.some(g => Math.min(Math.abs(g - a), 180 - Math.abs(g - a)) < 8)) groups.push(a);
  }
  return groups.length;
};
window.__duo.solveSymmetryCount = function () {
  if (!/number of lines of symmetry|how many lines of symmetry/i.test(this.curInstruction())) return null;
  const n = this.countSymmetryLines(); if (n === null) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - n) < 1e-9; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveSymmetryCount', /lines of symmetry/i]);
;'__duo ready';

// typed "enter the number of lines of symmetry" (and the rotational analogue)
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/lines of symmetry/i.test(ins)) {
      const n = this.countSymmetryLines(); if (n !== null) return n;
    }
    if (/order of (rotational )?symmetry/i.test(ins)) {
      const P = this.shapeSamples();
      if (P) {
        const cx = P.reduce((a, p) => a + p[0], 0) / P.length;
        const cy = P.reduce((a, p) => a + p[1], 0) / P.length;
        const span = Math.max(...P.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
        const tol = span * 0.06;
        const near = q => P.some(p => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol);
        let order = 1;
        for (let k = 2; k <= 12; k++) {
          const r = 2 * Math.PI / k, cs = Math.cos(r), sn = Math.sin(r);
          const ok = P.every(p => { const dx = p[0] - cx, dy = p[1] - cy;
            return near([cx + dx * cs - dy * sn, cy + dx * sn + dy * cs]); });
          if (ok) { order = k; break; }
        }
        return order;
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Count the number of sides" and the interior-angle facts that follow.
// Corner detection: sample the outline and count sharp direction changes,
// collapsing the consecutive samples that make up one corner.
window.__duo.polygonSides = function () {
  const P = this.shapeSamples(); if (!P) return null;
  const N = P.length;
  const flags = [];
  for (let i = 0; i < N; i++) {
    const a = P[(i - 5 + N) % N], b = P[i], c = P[(i + 5) % N];
    const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    if (lu < 1e-6 || lv < 1e-6) { flags.push(false); continue; }
    const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    flags.push(ang > 0.45);
  }
  let runs = 0;
  for (let i = 0; i < N; i++) if (flags[i] && !flags[(i - 1 + N) % N]) runs++;
  return runs >= 3 ? runs : null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/number of sides|count the sides/i.test(ins)) {
      const n = this.polygonSides(); if (n) return n;
    }
    if (/sum of the interior angles/i.test(ins)) {
      const n = this.polygonSides(); if (n) return (n - 2) * 180;
    }
    if (/each interior angle|one interior angle/i.test(ins)) {
      const n = this.polygonSides(); if (n) return (n - 2) * 180 / n;
    }
    if (/exterior angle/i.test(ins)) {
      const n = this.polygonSides(); if (n) return 360 / n;
    }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = this.curInstruction();
    if (/number of sides|sum of the interior angles|interior angle|exterior angle/i.test(ins)) {
      const v = this.solveOutputAt();
      if (typeof v === 'number' && isFinite(v)) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-6; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /number of sides|interior angle|exterior angle/i]);
})();
;'__duo ready';

// "Select ALL the angles of rotation": test each offered angle against the
// shape and return every one that maps it onto itself (multi-select).
window.__duo.solveAllRotationAngles = function () {
  if (!/select all the angles|all the angles of rotation/i.test(this.curInstruction())) return null;
  const P = this.shapeSamples(); if (!P) return null;
  const cx = P.reduce((a, p) => a + p[0], 0) / P.length;
  const cy = P.reduce((a, p) => a + p[1], 0) / P.length;
  const span = Math.max(...P.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  const tol = span * 0.06;
  const near = q => P.some(p => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol);
  const maps = deg => { const r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    return P.every(p => { const dx = p[0] - cx, dy = p[1] - cy;
      return near([cx + dx * cs - dy * sn, cy + dx * sn + dy * cs]); }); };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const idx = [];
  ch.forEach((e, i) => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/degrees?|°/gi, '').replace(/[−–—]/g, '-');
    const v = parseFloat(t);
    if (isFinite(v) && maps(v)) idx.push(i);
  });
  return idx.length ? { idx, ok: true, multi: true } : null;
};
(function () {
  const base = window.__duo.solveChoices;
  window.__duo.solveChoices = function () {
    if (/select all the angles|all the angles of rotation/i.test(this.curInstruction())) {
      const r = this.solveAllRotationAngles();
      if (r) return { want: r.idx.map(String), idx: r.idx, ok: true, via: 'solveAllRotationAngles' };
    }
    return base.call(this);
  };
})();
;'__duo ready';

// Classify the drawn polygon by its own geometry: side lengths and angles give
// regular/irregular and scalene/isosceles/equilateral/right.
window.__duo.polygonVertices = function () {
  const P = this.shapeSamples(); if (!P) return null;
  const N = P.length, V = [];
  for (let i = 0; i < N; i++) {
    const a = P[(i - 5 + N) % N], b = P[i], c = P[(i + 5) % N];
    const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    if (lu < 1e-6 || lv < 1e-6) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    if (ang > 0.45) V.push({ i, p: b, ang });
  }
  // one vertex per run of flagged samples: keep the sharpest in each run
  const out = [];
  let run = [];
  for (let k = 0; k < V.length; k++) {
    if (!run.length || V[k].i - run[run.length - 1].i <= 2) run.push(V[k]);
    else { out.push(run.reduce((a, b) => b.ang > a.ang ? b : a).p); run = [V[k]]; }
  }
  if (run.length) out.push(run.reduce((a, b) => b.ang > a.ang ? b : a).p);
  return out.length >= 3 ? out : null;
};
window.__duo.classifyPolygon = function () {
  const V = this.polygonVertices(); if (!V) return null;
  const n = V.length;
  const sides = V.map((p, i) => Math.hypot(V[(i + 1) % n][0] - p[0], V[(i + 1) % n][1] - p[1]));
  const mx = Math.max(...sides), mn = Math.min(...sides);
  const equalSides = (mx - mn) / mx < 0.08;
  const angs = V.map((p, i) => {
    const a = V[(i - 1 + n) % n], c = V[(i + 1) % n];
    const u = [a[0] - p[0], a[1] - p[1]], w = [c[0] - p[0], c[1] - p[1]];
    return Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w))))) * 180 / Math.PI;
  });
  const equalAngles = (Math.max(...angs) - Math.min(...angs)) < 6;
  const hasRight = angs.some(a => Math.abs(a - 90) < 4);
  let pairs = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    if (Math.abs(sides[i] - sides[j]) / mx < 0.08) pairs++;
  return { n, regular: equalSides && equalAngles, equalSides, hasRight,
           kind: n === 3 ? (equalSides ? 'equilateral' : pairs >= 1 ? 'isosceles' : 'scalene') : null };
};
window.__duo.solveClassifyShape = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
  if (!words.some(w => /regular|irregular|scalene|isosceles|equilateral|right/.test(w))) return null;
  const C = this.classifyPolygon(); if (!C) return null;
  const wants = [];
  if (C.kind) wants.push(C.kind);
  wants.push(C.regular ? 'regular' : 'irregular');
  if (C.hasRight) wants.push('right');
  for (const w of wants) {
    const i = words.findIndex(x => x.startsWith(w));
    if (i >= 0) return { i };
  }
  return null;
};
window.__duo.RULES.unshift(['solveClassifyShape', /regular|irregular|scalene|isosceles|equilateral|select the match/i]);
;'__duo ready';

// "Which shape has rotational / reflectional symmetry" — a knowledge question
// about named quadrilaterals, not something measurable from the diagram.
window.__duo.SHAPE_SYM = {
  square:            { rot: true,  ref: true },
  rectangle:         { rot: true,  ref: true },
  rhombus:           { rot: true,  ref: true },
  parallelogram:     { rot: true,  ref: false },
  kite:              { rot: false, ref: true },
  isoscelestrapezoid:{ rot: false, ref: true },
  trapezoid:         { rot: false, ref: false },
  scalenetriangle:   { rot: false, ref: false },
  isoscelestriangle: { rot: false, ref: true },
  equilateraltriangle:{ rot: true, ref: true },
  regularpentagon:   { rot: true,  ref: true },
  regularhexagon:    { rot: true,  ref: true },
};
window.__duo.solveShapeSymmetryFact = function () {
  const all = this.mathParts().concat([this.curInstruction()]).join(' ').toLowerCase();
  const wantRot = /rotational symmetry/.test(all);
  const wantRef = /reflectional symmetry|line symmetry/.test(all);
  if (!wantRot && !wantRef) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
  const known = words.map(w => this.SHAPE_SYM[w] || null);
  if (known.filter(Boolean).length < 2) return null;
  const hits = [];
  known.forEach((k, i) => {
    if (!k) return;
    if (wantRot && k.rot && !(wantRef && !k.ref)) hits.push(i);
    else if (wantRef && !wantRot && k.ref) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveShapeSymmetryFact', /symmetry/i]);
;'__duo ready';

// choice innerText is doubled ("kitekite"), so exact-key lookup always missed
(function () {
  const base = window.__duo.solveShapeSymmetryFact;
  window.__duo.solveShapeSymmetryFact = function () {
    const all = this.mathParts().concat([this.curInstruction()]).join(' ').toLowerCase();
    const wantRot = /rotational symmetry/.test(all);
    const wantRef = /reflectional symmetry|line symmetry/.test(all);
    if (!wantRot && !wantRef) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const half = s => (s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2)) ? s.slice(0, s.length / 2) : s;
    const words = ch.map(e => half(this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, '')));
    const known = words.map(w => this.SHAPE_SYM[w] || null);
    if (known.filter(Boolean).length < 2) return base.call(this);
    const hits = [];
    known.forEach((k, i) => { if (!k) return;
      if (wantRot && !wantRef && k.rot) hits.push(i);
      else if (wantRef && !wantRot && k.ref) hits.push(i);
      else if (wantRot && wantRef && k.rot && k.ref) hits.push(i); });
    return hits.length === 1 ? { i: hits[0] } : null;
  };
})();
;'__duo ready';

// "Select AN angle of rotational symmetry" (single answer): the smallest offered
// angle that maps the drawn shape onto itself.
window.__duo.solveOneRotationAngle = function () {
  if (!/angle of rotational symmetry/i.test(this.curInstruction())) return null;
  const P = this.shapeSamples(); if (!P) return null;
  const cx = P.reduce((a, p) => a + p[0], 0) / P.length;
  const cy = P.reduce((a, p) => a + p[1], 0) / P.length;
  const span = Math.max(...P.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  const tol = span * 0.06;
  const near = q => P.some(p => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol);
  const maps = deg => { const r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    return P.every(p => { const dx = p[0] - cx, dy = p[1] - cy;
      return near([cx + dx * cs - dy * sn, cy + dx * sn + dy * cs]); }); };
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const cands = [];
  ch.forEach((e, i) => {
    const v = parseFloat(this.plainMath(this.choiceLatex(e)).replace(/degrees?|°/gi, '').replace(/[−–—]/g, '-'));
    if (isFinite(v) && maps(v)) cands.push({ i, v: Math.abs(v) });
  });
  if (!cands.length) {
    // fall back to the polygon's side count: 360/n
    const n = this.polygonSides();
    if (n) { const want = 360 / n;
      const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(Math.abs(v) - want) < 1; });
      if (i >= 0) return { i }; }
    return null;
  }
  cands.sort((a, b) => a.v - b.v);
  return { i: cands[0].i };
};
window.__duo.RULES.unshift(['solveOneRotationAngle', /angle of rotational symmetry/i]);
;'__duo ready';

// Unit 186: congruence. "Select the side length of the congruent figure" — the
// matching side of the image has the same length as the labelled pre-image
// side, so the answer is simply the numeric label already on the diagram.
window.__duo.solveCongruentSide = function () {
  const ins = this.curInstruction();
  if (!/congruent|corresponding/i.test(ins)) return null;
  const nums = (this.diagramLabels() || [])
    .filter(l => /^-?\d+(\.\d+)?$/.test(l.t.trim())).map(l => parseFloat(l.t));
  if (!nums.length) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const vals = ch.map(e => this.choiceValue(e));
  // exactly one offered value appears as a label on the figure
  const hits = [];
  vals.forEach((v, i) => { if (v !== null && nums.some(n => Math.abs(n - v) < 1e-9)) hits.push(i); });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveCongruentSide', /congruent|corresponding/i]);
;'__duo ready';

// No numeric labels on these congruence screens — measure the drawn figure's
// side length in GRID units instead.
window.__duo.shapeSideLength = function () {
  const V = this.polygonVertices(); if (!V || V.length < 3) return null;
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const g = d.M.grid;
  const G = [];
  for (const p of V) { let q; try { q = g.pixelToGrid([p[0], p[1]]); } catch (e) { return null; } G.push(q); }
  const n = G.length;
  const sides = G.map((p, i) => Math.hypot(G[(i + 1) % n][0] - p[0], G[(i + 1) % n][1] - p[1]));
  const r = Math.round(sides[0]);
  return sides.every(s => Math.abs(s - r) < 0.25) ? r : Math.round(sides[0] * 100) / 100;
};
(function () {
  const base = window.__duo.solveCongruentSide;
  window.__duo.solveCongruentSide = function () {
    const r = base.call(this); if (r) return r;
    if (!/congruent|corresponding|side length/i.test(this.curInstruction())) return null;
    const s = this.shapeSideLength(); if (s === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - s) < 0.2; });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveCongruentSide', /congruent|corresponding|side length/i]);
})();
;'__duo ready';

// "Create a figure that is congruent": move the draggable vertices to a
// translated copy of the static figure — congruent by construction.
window.__duo.solveMakeCongruent = async function () {
  const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
  if (!/createafigure.*congruent|congruentfigure/.test(all)) return false;
  const drag = this.gridPoints(); if (drag.length < 3) return false;
  const dset = new Set(drag.map(p => p.x + ',' + p.y));
  const stat = this.plottedPoints().filter(p => !dset.has(p[0] + ',' + p[1]));
  if (stat.length !== drag.length) return false;
  const g = this.diagram().M.grid;
  const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
  const offsets = [];
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) offsets.push([dx, dy]);
  offsets.sort((a, b) => (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b[0]) + Math.abs(b[1])));
  for (const [dx, dy] of offsets) {
    if (!dx && !dy) continue;
    const targets = stat.map(p => [p[0] + dx, p[1] + dy]);
    if (targets.some(t => t[0] < x0 || t[0] > x1 || t[1] < y0 || t[1] > y1)) continue;
    if (targets.some(t => stat.some(s => s[0] === t[0] && s[1] === t[1]))) continue;
    for (let i = 0; i < drag.length; i++) {
      const p = this.gridPoints()[i]; if (!p) return false;
      if (Math.abs(p.x - targets[i][0]) < 1e-9 && Math.abs(p.y - targets[i][1]) < 1e-9) continue;
      await this.dragPointTo(p, targets[i][0], targets[i][1]);
    }
    const now = this.gridPoints();
    if (targets.every(t => now.some(q => Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6))) return true;
    return false;
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveMakeCongruent()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "AB = A'B'" style comparisons: rigid motions preserve length, so measure both
// segments from the labelled points and compare.
window.__duo.solveSegmentCompare = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const N = this.namedPoints(); if (!N) return null;
  const len = (a, b) => (N[a] && N[b]) ? Math.hypot(N[b][0] - N[a][0], N[b][1] - N[a][1]) : null;
  const hits = [];
  ch.forEach((e, i) => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/[’]/g, "'");
    const m = t.match(/^([A-Z]'?)([A-Z]'?)([<>=])([A-Z]'?)([A-Z]'?)$/);
    if (!m) return;
    const l1 = len(m[1], m[2]), l2 = len(m[4], m[5]);
    if (l1 === null || l2 === null) return;
    const ok = m[3] === '=' ? Math.abs(l1 - l2) < 0.05
             : m[3] === '<' ? l1 < l2 - 0.05 : l1 > l2 + 0.05;
    if (ok) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveSegmentCompare', /select the match|compare/i]);
;'__duo ready';

// "Enter the area of the congruent figures": shoelace formula over the drawn
// polygon's vertices, in grid units.
window.__duo.polygonArea = function () {
  const V = this.polygonVertices(); if (!V || V.length < 3) return null;
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const g = d.M.grid;
  const G = [];
  for (const p of V) { let q; try { q = g.pixelToGrid([p[0], p[1]]); } catch (e) { return null; } G.push(q); }
  let a = 0;
  for (let i = 0; i < G.length; i++) {
    const j = (i + 1) % G.length;
    a += G[i][0] * G[j][1] - G[j][0] * G[i][1];
  }
  const area = Math.abs(a) / 2;
  const r = Math.round(area);
  return Math.abs(area - r) < 0.25 ? r : Math.round(area * 100) / 100;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/area of/i.test(ins)) { const a = this.polygonArea(); if (a !== null) return a; }
    if (/perimeter of/i.test(ins)) {
      const V = this.polygonVertices(), d = this.diagram();
      if (V && d && d.M.grid) {
        const g = d.M.grid, G = [];
        let bad = false;
        for (const p of V) { let q; try { q = g.pixelToGrid([p[0], p[1]]); } catch (e) { bad = true; break; } G.push(q); }
        if (!bad) {
          let per = 0;
          for (let i = 0; i < G.length; i++) { const j = (i + 1) % G.length;
            per += Math.hypot(G[j][0] - G[i][0], G[j][1] - G[i][1]); }
          const r = Math.round(per);
          return Math.abs(per - r) < 0.3 ? r : Math.round(per * 100) / 100;
        }
      }
    }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (/area of|perimeter of/i.test(this.curInstruction())) {
      const v = this.solveOutputAt();
      if (typeof v === 'number' && isFinite(v)) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 0.2; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /area of|perimeter of/i]);
})();
;'__duo ready';

// wording varies: "Create a figure/triangle/shape that is congruent"
(function () {
  const base = window.__duo.solveMakeCongruent;
  window.__duo.solveMakeCongruent = async function () {
    const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
    if (!/create[a-z]*that?is?congruent|congruentfigure|createacongruent/.test(all)) {
      if (!(/create/.test(all) && /congruent/.test(all))) return false;
    }
    const drag = this.gridPoints(); if (drag.length < 3) return false;
    const dset = new Set(drag.map(p => p.x + ',' + p.y));
    const stat = this.plottedPoints().filter(p => !dset.has(p[0] + ',' + p[1]));
    if (stat.length !== drag.length) return false;
    const g = this.diagram().M.grid;
    const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
    const offs = [];
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) if (dx || dy) offs.push([dx, dy]);
    offs.sort((a, b) => (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b[0]) + Math.abs(b[1])));
    for (const [dx, dy] of offs) {
      const targets = stat.map(p => [p[0] + dx, p[1] + dy]);
      if (targets.some(t => t[0] < x0 || t[0] > x1 || t[1] < y0 || t[1] > y1)) continue;
      if (targets.some(t => stat.some(s => s[0] === t[0] && s[1] === t[1]))) continue;
      for (let i = 0; i < drag.length; i++) {
        const p = this.gridPoints()[i]; if (!p) return false;
        if (Math.abs(p.x - targets[i][0]) < 1e-9 && Math.abs(p.y - targets[i][1]) < 1e-9) continue;
        await this.dragPointTo(p, targets[i][0], targets[i][1]);
      }
      const now = this.gridPoints();
      return targets.every(t => now.some(q => Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6));
    }
    return false;
  };
})();
;'__duo ready';

// "Select a pair of corresponding vertices": the pre-image vertex and its
// image. Work out the transformation from the two figures, then keep the choice
// whose two named points actually map onto each other.
window.__duo.solveCorrespondingVertices = function () {
  if (!/corresponding vert/i.test(this.curInstruction())) return null;
  const N = this.namedPoints(); if (!N) return null;
  const plain = Object.keys(N).filter(k => !/'/.test(k));
  const prime = Object.keys(N).filter(k => /'/.test(k));
  if (!plain.length || !prime.length) return null;
  const A = plain.map(k => N[k]), B = prime.map(k => N[k]);
  // a rigid motion preserves the vertex ORDER around each figure, so match by
  // the shift/rotation that maps the whole set
  const cA = [A.reduce((s, p) => s + p[0], 0) / A.length, A.reduce((s, p) => s + p[1], 0) / A.length];
  const cB = [B.reduce((s, p) => s + p[0], 0) / B.length, B.reduce((s, p) => s + p[1], 0) / B.length];
  const map = {};
  for (const k of plain) {
    const rel = [N[k][0] - cA[0], N[k][1] - cA[1]];
    let best = null, bd = Infinity;
    for (const q of prime) {
      const rq = [N[q][0] - cB[0], N[q][1] - cB[1]];
      const d = Math.hypot(rq[0] - rel[0], rq[1] - rel[1]);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) map[k] = best;
  }
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/[’]/g, "'").replace(/and|,/gi, '');
    const m = t.match(/([A-Z])([A-Z]')/) || t.match(/([A-Z])'?\s*([A-Z]')/);
    return m && map[m[1]] === m[2];
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveCorrespondingVertices', /corresponding vert/i]);
;'__duo ready';

// Unit 187: dilations. With a scale factor k, the image sits farther from the
// centre when k > 1, closer when k < 1, and the same distance when k == 1.
window.__duo.scaleFactorFromPrompt = function () {
  const lines = this.promptLatex().map(l => this.ascii(l)
    .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/[{}&~\s\\]/g, '').replace(/[−–—]/g, '-'));
  for (const t of lines) {
    const m = t.match(/scalefactor=(.+)$/i);
    if (!m) continue;
    const g = this.compile(m[1]);
    if (g) { try { const v = g(0); if (isFinite(v)) return v; } catch (e) {} }
    const f = m[1].match(/^\(?\(?(-?[\d.]+)\)?\/\(?(-?[\d.]+)\)?\)?$/);
    if (f) { const v = parseFloat(f[1]) / parseFloat(f[2]); if (isFinite(v)) return v; }
  }
  return null;
};
window.__duo.solveDilationDistance = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
  if (!words.some(w => /closer|farther|further|samedistance/.test(w))) return null;
  const k = this.scaleFactorFromPrompt(); if (k === null) return null;
  const want = Math.abs(k - 1) < 1e-9 ? 'same' : (Math.abs(k) > 1 ? 'far' : 'clos');
  const i = words.findIndex(w => want === 'same' ? w.startsWith('same')
                               : want === 'far' ? (w.startsWith('farther') || w.startsWith('further'))
                               : w.startsWith('closer'));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveDilationDistance', /scale factor|closer|farther/i]);
;'__duo ready';

// the LaTeX thin space \, survives as a stray comma, so the captured expression
// began with "," and never compiled
(function () {
  const base = window.__duo.scaleFactorFromPrompt;
  window.__duo.scaleFactorFromPrompt = function () {
    const v = base.call(this); if (v !== null) return v;
    const lines = this.promptLatex().map(l => this.ascii(l)
      .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
      .replace(/[{}&~\s\\]/g, '').replace(/[−–—]/g, '-'));
    for (const t of lines) {
      const m = t.match(/scalefactor=[,\s]*(.+)$/i);
      if (!m) continue;
      const expr = m[1].replace(/^[,\s]+/, '');
      const g = this.compile(expr);
      if (g) { try { const q = g(0); if (isFinite(q)) return q; } catch (e) {} }
      const f = expr.match(/\(*(-?[\d.]+)\)*\/\(*(-?[\d.]+)\)*/);
      if (f) { const q = parseFloat(f[1]) / parseFloat(f[2]); if (isFinite(q)) return q; }
      const n = parseFloat(expr); if (isFinite(n)) return n;
    }
    return null;
  };
})();
;'__duo ready';

// "Dilate the point with scale factor k": image = centre + k * (point - centre).
window.__duo.solveDilatePoints = async function () {
  const all = this.mathParts().concat([this.curInstruction()]).join(' ').toLowerCase();
  if (!/dilat|scale factor/.test(all)) return false;
  const k = this.scaleFactorFromPrompt(); if (k === null) return false;
  const pts = this.gridPoints(); if (!pts.length) return false;
  const c = this.centrePoint();
  const targets = pts.map(p => [
    Math.round((c[0] + k * (p.x - c[0])) * 1e6) / 1e6,
    Math.round((c[1] + k * (p.y - c[1])) * 1e6) / 1e6]);
  if (targets.every((t, i) => Math.abs(t[0] - pts[i].x) < 1e-9 && Math.abs(t[1] - pts[i].y) < 1e-9)) return false;
  const g = this.diagram().M.grid;
  const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
  if (targets.some(t => t[0] < x0 || t[0] > x1 || t[1] < y0 || t[1] > y1)) return false;
  for (let i = 0; i < pts.length; i++) {
    const p = this.gridPoints()[i]; if (!p) return false;
    if (Math.abs(p.x - targets[i][0]) < 1e-9 && Math.abs(p.y - targets[i][1]) < 1e-9) continue;
    await this.dragPointTo(p, targets[i][0], targets[i][1]);
  }
  const now = this.gridPoints();
  return targets.every(t => now.some(q => Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6));
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveDilatePoints()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// thin spaces land on BOTH sides of the "=" ("scale factor ,= ,3")
(function () {
  const base = window.__duo.scaleFactorFromPrompt;
  window.__duo.scaleFactorFromPrompt = function () {
    const v = base.call(this); if (v !== null) return v;
    const lines = this.promptLatex().map(l => this.ascii(l)
      .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
      .replace(/[{}&~\s\\]/g, '').replace(/[−–—]/g, '-'));
    for (const t of lines) {
      const m = t.match(/scalefactor[,\s]*=[,\s]*(.+)$/i);
      if (!m) continue;
      const expr = m[1].replace(/^[,\s]+/, '');
      const g = this.compile(expr);
      if (g) { try { const q = g(0); if (isFinite(q)) return q; } catch (e) {} }
      const f = expr.match(/\(*(-?[\d.]+)\)*\/\(*(-?[\d.]+)\)*/);
      if (f) { const q = parseFloat(f[1]) / parseFloat(f[2]); if (isFinite(q)) return q; }
      const n = parseFloat(expr); if (isFinite(n)) return n;
    }
    return null;
  };
  // the dilation centre is a STATIC point, never the draggable one
  const bc = window.__duo.centrePoint;
  window.__duo.centrePoint = function () {
    const drag = new Set(this.gridPoints().map(p => p.x + ',' + p.y));
    const statics = this.plottedPoints().filter(p => !drag.has(p[0] + ',' + p[1]));
    const labs = (this.diagramLabels() || []).filter(l => /^[a-z]$/.test(l.t.trim()));
    const d = this.diagram();
    if (labs.length === 1 && d && d.M.grid && statics.length) {
      let px; try { px = d.M.grid.pixelToGrid([labs[0].x, labs[0].y]); } catch (e) { px = null; }
      if (px) {
        let best = null, bd = Infinity;
        for (const p of statics) { const dd = Math.hypot(p[0] - px[0], p[1] - px[1]); if (dd < bd) { bd = dd; best = p; } }
        if (best && bd < 3.5) return best;
      }
    }
    if (statics.length === 1) return statics[0];
    return bc.call(this);
  };
})();
;'__duo ready';

// "Select the scale factor from A to A'": ratio of the distances from the
// centre, measured off the plotted points.
window.__duo.measuredScaleFactor = function () {
  const N = this.namedPoints();
  let pre = null, img = null, c = null;
  if (N) {
    const keys = Object.keys(N);
    const plain = keys.find(k => /^[A-Z]$/.test(k));
    const prime = keys.find(k => /^[A-Z]'$/.test(k));
    const cen = keys.find(k => /^[a-z]$/.test(k));
    if (plain && prime) { pre = N[plain]; img = N[prime]; c = cen ? N[cen] : null; }
  }
  if (!c) c = this.centrePoint();
  if (!pre || !img || !c) return null;
  const d1 = Math.hypot(pre[0] - c[0], pre[1] - c[1]);
  const d2 = Math.hypot(img[0] - c[0], img[1] - c[1]);
  if (d1 < 1e-9) return null;
  const k = d2 / d1;
  return isFinite(k) ? Math.round(k * 1000) / 1000 : null;
};
window.__duo.solveScaleFactorChoice = function () {
  if (!/scale factor/i.test(this.curInstruction())) return null;
  const k = this.measuredScaleFactor(); if (k === null) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - k) < 0.02; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveScaleFactorChoice', /scale factor/i]);
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/scale factor/i.test(this.curInstruction())) {
      const k = this.measuredScaleFactor();
      if (k !== null) {
        if (Math.abs(k - Math.round(k)) < 1e-6) return Math.round(k);
        for (let d = 2; d <= 10; d++) { const n = k * d;
          if (Math.abs(n - Math.round(n)) < 1e-6) return Math.round(n) + '/' + d; }
        return k;
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// Rounding k to 3 decimals (0.333) made the fraction search miss 1/3.
// Keep the exact ratio and snap to a small fraction.
window.__duo.measuredScaleFactorRaw = function () {
  const N = this.namedPoints();
  let pre = null, img = null, c = null;
  if (N) {
    const keys = Object.keys(N);
    const plain = keys.find(k => /^[A-Z]$/.test(k));
    const prime = keys.find(k => /^[A-Z]'$/.test(k));
    const cen = keys.find(k => /^[a-z]$/.test(k));
    if (plain && prime) { pre = N[plain]; img = N[prime]; c = cen ? N[cen] : null; }
  }
  if (!c) c = this.centrePoint();
  if (!pre || !img || !c) return null;
  const d1 = Math.hypot(pre[0] - c[0], pre[1] - c[1]);
  const d2 = Math.hypot(img[0] - c[0], img[1] - c[1]);
  return d1 < 1e-9 ? null : d2 / d1;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/scale factor/i.test(this.curInstruction())) {
      const k = this.measuredScaleFactorRaw();
      if (k !== null && isFinite(k)) {
        if (Math.abs(k - Math.round(k)) < 1e-4) return Math.round(k);
        for (let d = 2; d <= 12; d++) {
          const n = k * d;
          if (Math.abs(n - Math.round(n)) < 1e-3) return Math.round(n) + '/' + d;
        }
        return Math.round(k * 100) / 100;
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Select the length of the dilated segment with scale factor k": the answer is
// the MULTIPLICATION expression (4 * 5), not the sum or the power.
window.__duo.solveDilatedLength = function () {
  const ins = this.curInstruction();
  if (!/dilated (segment|side|length)|length of the dilated/i.test(ins)) return null;
  const k = this.scaleFactorFromPrompt();
  const nums = (this.diagramLabels() || [])
    .filter(l => /^-?\d+(\.\d+)?$/.test(l.t.trim())).map(l => parseFloat(l.t));
  const len = nums.length ? nums[0] : this.shapeSideLength();
  if (k === null || len === null || len === undefined) return null;
  const want = len * k;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  // prefer a product of exactly the two numbers, then any expression with the
  // right value
  let i = ch.findIndex(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/cdot|times/g, '*');
    const m = t.match(/^(-?[\d.]+)\*(-?[\d.]+)$/);
    return m && Math.abs(parseFloat(m[1]) * parseFloat(m[2]) - want) < 1e-6
             && [len, k].every(v => [parseFloat(m[1]), parseFloat(m[2])].some(x => Math.abs(x - v) < 1e-6));
  });
  if (i < 0) i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - want) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveDilatedLength', /dilated/i]);
;'__duo ready';

// scale factor k: k > 1 makes the image larger, k < 1 smaller, k == 1 same size
window.__duo.solveScaleSize = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const half = s => (s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2)) ? s.slice(0, s.length / 2) : s;
  const words = ch.map(e => half(this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, '')));
  if (!words.some(w => /larger|smaller|samesize/.test(w))) return null;
  const k = this.scaleFactorFromPrompt(); if (k === null) return null;
  const want = Math.abs(k - 1) < 1e-9 ? 'samesize' : (Math.abs(k) > 1 ? 'larger' : 'smaller');
  const i = words.findIndex(w => w.startsWith(want));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveScaleSize', /scale factor|dilat/i]);
;'__duo ready';

// "Select/enter the dilated length with scale factor k": measure the drawn
// segment in grid units (or read its label) and multiply by k.
window.__duo.dilatedLengthValue = function () {
  const ins = this.curInstruction();
  if (!/dilated/i.test(ins)) return null;
  let k = this.scaleFactorFromPrompt();
  if (k === null) { const m = ins.replace(/\s/g, '').match(/scalefactor,?=?,?(-?[\d.]+)/i); if (m) k = parseFloat(m[1]); }
  if (k === null) return null;
  let len = null;
  const nums = (this.diagramLabels() || [])
    .filter(l => /^-?\d+(\.\d+)?$/.test(l.t.trim())).map(l => parseFloat(l.t));
  if (nums.length) len = nums[0];
  if (len === null) {
    const P = this.plottedPoints();
    if (P.length === 2) len = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
  }
  if (len === null) len = this.shapeSideLength();
  if (len === null || !isFinite(len)) return null;
  const v = len * k;
  return Math.abs(v - Math.round(v)) < 1e-4 ? Math.round(v) : Math.round(v * 100) / 100;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = this.dilatedLengthValue(); if (v !== null) return v;
    return bo.call(this);
  };
  const bd = window.__duo.solveDilatedLength;
  window.__duo.solveDilatedLength = function () {
    const r = bd.call(this); if (r) return r;
    const v = this.dilatedLengthValue(); if (v === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 0.05; });
    return i < 0 ? null : { i };
  };
  window.__duo.RULES.unshift(['solveDilatedLength', /dilated/i]);
})();
;'__duo ready';

// "congruent" vs "not congruent": compare the two drawn shapes' sorted side
// lengths — a rigid motion preserves them, a dilation does not.
window.__duo.twoShapeSides = function () {
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const doc = d.f.contentDocument, g = d.M.grid;
  const shapes = [...doc.querySelectorAll('path,polygon,polyline')]
    .filter(e => /polygon|(^|\s)shape(\s|$)/i.test(e.getAttribute('class') || ''))
    .filter(e => typeof e.getTotalLength === 'function');
  if (shapes.length < 2) return null;
  const sidesOf = el => {
    let L = 0; try { L = el.getTotalLength(); } catch (e) { return null; }
    if (!L) return null;
    const ctm = el.getScreenCTM(); if (!ctm) return null;
    const svg = el.ownerSVGElement;
    const N = 240, P = [];
    for (let i = 0; i < N; i++) {
      const q = el.getPointAtLength((i / N) * L);
      const p = svg.createSVGPoint(); p.x = q.x; p.y = q.y;
      const t = p.matrixTransform(ctm);
      P.push([t.x, t.y]);
    }
    // corners
    const V = [];
    for (let i = 0; i < N; i++) {
      const a = P[(i - 5 + N) % N], b = P[i], c = P[(i + 5) % N];
      const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
      const lu = Math.hypot(...u), lv = Math.hypot(...v);
      if (lu < 1e-6 || lv < 1e-6) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
      if (ang > 0.45) V.push({ i, p: b, ang });
    }
    const corners = []; let run = [];
    for (let k = 0; k < V.length; k++) {
      if (!run.length || V[k].i - run[run.length - 1].i <= 2) run.push(V[k]);
      else { corners.push(run.reduce((a, b) => b.ang > a.ang ? b : a).p); run = [V[k]]; }
    }
    if (run.length) corners.push(run.reduce((a, b) => b.ang > a.ang ? b : a).p);
    if (corners.length < 3) return null;
    const n = corners.length;
    return corners.map((p, i) => Math.hypot(corners[(i + 1) % n][0] - p[0], corners[(i + 1) % n][1] - p[1]))
                  .sort((a, b) => a - b);
  };
  const A = sidesOf(shapes[0]), B = sidesOf(shapes[1]);
  return (A && B) ? { A, B } : null;
};
window.__duo.solveCongruentOrNot = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const half = s => (s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2)) ? s.slice(0, s.length / 2) : s;
  const words = ch.map(e => half(this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, '')));
  if (!words.some(w => /^congruent$/.test(w)) || !words.some(w => /^notcongruent$/.test(w))) return null;
  const S = this.twoShapeSides(); if (!S || S.A.length !== S.B.length) return null;
  const same = S.A.every((v, i) => Math.abs(v - S.B[i]) / Math.max(v, S.B[i]) < 0.06);
  const i = words.findIndex(w => same ? w === 'congruent' : w === 'notcongruent');
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveCongruentOrNot', /congruent|select the match/i]);
;'__duo ready';

// "Select a pair of corresponding sides": in similar/congruent figures the
// corresponding sides are the ones whose lengths share the figures' scale
// factor. Choices name them like "AB and A'B'".
window.__duo.solveCorrespondingSides = function () {
  if (!/corresponding sides/i.test(this.curInstruction())) return null;
  const N = this.namedPoints(); if (!N) return null;
  const len = (a, b) => (N[a] && N[b]) ? Math.hypot(N[b][0] - N[a][0], N[b][1] - N[a][1]) : null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const parsed = ch.map(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/[’]/g, "'").replace(/and/gi, '');
    const m = t.match(/([A-Z]'?)([A-Z]'?)([A-Z]'?)([A-Z]'?)/);
    return m ? { a: [m[1], m[2]], b: [m[3], m[4]] } : null;
  });
  // the right pair: one side from the pre-image, one from the image, with a
  // consistent ratio across the whole figure
  const ratios = parsed.map(p => {
    if (!p) return null;
    const l1 = len(p.a[0], p.a[1]), l2 = len(p.b[0], p.b[1]);
    const primeA = p.a.some(x => /'/.test(x)), primeB = p.b.some(x => /'/.test(x));
    if (l1 === null || l2 === null || l1 < 1e-9) return null;
    if (primeA === primeB) return null;              // both from the same figure
    return l2 / l1;
  });
  const valid = ratios.map((r, i) => ({ r, i })).filter(x => x.r !== null);
  if (!valid.length) return null;
  // prefer the ratio that matches the figures' overall scale
  const S = this.twoShapeSides();
  if (S && S.A.length && S.B.length) {
    const k = S.B[S.B.length - 1] / S.A[S.A.length - 1];
    const hit = valid.find(x => Math.abs(x.r - k) < 0.08 * k);
    if (hit) return { i: hit.i };
  }
  return valid.length === 1 ? { i: valid[0].i } : null;
};
window.__duo.RULES.unshift(['solveCorrespondingSides', /corresponding sides/i]);
;'__duo ready';

// "Select a pair of corresponding angles": reuse the vertex correspondence —
// choices read like "∠B and ∠B'".
window.__duo.vertexCorrespondence = function () {
  const N = this.namedPoints(); if (!N) return null;
  const plain = Object.keys(N).filter(k => /^[A-Z]$/.test(k));
  const prime = Object.keys(N).filter(k => /^[A-Z]'$/.test(k));
  if (!plain.length || plain.length !== prime.length) return null;
  const cA = [plain.reduce((s, k) => s + N[k][0], 0) / plain.length,
              plain.reduce((s, k) => s + N[k][1], 0) / plain.length];
  const cB = [prime.reduce((s, k) => s + N[k][0], 0) / prime.length,
              prime.reduce((s, k) => s + N[k][1], 0) / prime.length];
  // scale-invariant matching: compare normalised offsets from each centroid
  const norm = (p, c, list) => {
    const r = Math.max(...list.map(k => Math.hypot(N[k][0] - c[0], N[k][1] - c[1]))) || 1;
    return [(p[0] - c[0]) / r, (p[1] - c[1]) / r];
  };
  const map = {};
  for (const k of plain) {
    const a = norm(N[k], cA, plain);
    let best = null, bd = Infinity;
    for (const q of prime) {
      const b = norm(N[q], cB, prime);
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) map[k] = best;
  }
  return map;
};
window.__duo.solveCorrespondingAngles = function () {
  if (!/corresponding (angles|vert)/i.test(this.curInstruction())) return null;
  const map = this.vertexCorrespondence(); if (!map) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/[’]/g, "'").replace(/angle|and|,/gi, '');
    const m = t.match(/([A-Z])([A-Z]')/);
    return m && map[m[1]] === m[2];
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveCorrespondingAngles', /corresponding (angles|vert)/i]);
;'__duo ready';

// "Create a figure that is similar": a scaled copy of the static figure. Try a
// few scale factors and offsets until every vertex lands on the grid.
window.__duo.solveMakeSimilar = async function () {
  const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
  if (!/create/.test(all) || !/similar/.test(all)) return false;
  const drag = this.gridPoints(); if (drag.length < 3) return false;
  const dset = new Set(drag.map(p => p.x + ',' + p.y));
  const stat = this.plottedPoints().filter(p => !dset.has(p[0] + ',' + p[1]));
  if (stat.length !== drag.length) return false;
  const g = this.diagram().M.grid;
  const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
  const cx = stat.reduce((s, p) => s + p[0], 0) / stat.length;
  const cy = stat.reduce((s, p) => s + p[1], 0) / stat.length;
  for (const k of [2, 0.5, 3, 1 / 3]) {
    // scale about the figure's own centroid, then shift onto free space
    const base = stat.map(p => [cx + k * (p[0] - cx), cy + k * (p[1] - cy)]);
    if (base.some(t => Math.abs(t[0] - Math.round(t[0])) > 1e-6 || Math.abs(t[1] - Math.round(t[1])) > 1e-6)) continue;
    const offs = [];
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) offs.push([dx, dy]);
    offs.sort((a, b) => (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b[0]) + Math.abs(b[1])));
    for (const [dx, dy] of offs) {
      const targets = base.map(t => [t[0] + dx, t[1] + dy]);
      if (targets.some(t => t[0] < x0 || t[0] > x1 || t[1] < y0 || t[1] > y1)) continue;
      if (targets.some(t => stat.some(s => s[0] === t[0] && s[1] === t[1]))) continue;
      for (let i = 0; i < drag.length; i++) {
        const p = this.gridPoints()[i]; if (!p) return false;
        if (Math.abs(p.x - targets[i][0]) < 1e-9 && Math.abs(p.y - targets[i][1]) < 1e-9) continue;
        await this.dragPointTo(p, targets[i][0], targets[i][1]);
      }
      const now = this.gridPoints();
      return targets.every(t => now.some(q => Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6));
    }
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveMakeSimilar()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// Scaling about the centroid lands on non-integer coordinates when the centroid
// is not a lattice point. Scale about a VERTEX instead, which always keeps
// integer targets, and try each vertex/scale/offset until one fits the grid.
window.__duo.solveMakeSimilar = async function () {
  const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
  if (!/create/.test(all) || !/similar/.test(all)) return false;
  const drag = this.gridPoints(); if (drag.length < 3) return false;
  const dset = new Set(drag.map(p => p.x + ',' + p.y));
  const stat = this.plottedPoints().filter(p => !dset.has(p[0] + ',' + p[1]));
  if (stat.length !== drag.length) return false;
  const g = this.diagram().M.grid;
  const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
  const offs = [];
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) offs.push([dx, dy]);
  offs.sort((a, b) => (Math.abs(a[0]) + Math.abs(a[1])) - (Math.abs(b[0]) + Math.abs(b[1])));
  for (const k of [2, 0.5, 3]) {
    for (const c of stat) {
      const base = stat.map(p => [c[0] + k * (p[0] - c[0]), c[1] + k * (p[1] - c[1])]);
      if (base.some(t => Math.abs(t[0] - Math.round(t[0])) > 1e-6 || Math.abs(t[1] - Math.round(t[1])) > 1e-6)) continue;
      for (const [dx, dy] of offs) {
        const targets = base.map(t => [Math.round(t[0]) + dx, Math.round(t[1]) + dy]);
        if (targets.some(t => t[0] < x0 || t[0] > x1 || t[1] < y0 || t[1] > y1)) continue;
        if (targets.some(t => stat.some(s => s[0] === t[0] && s[1] === t[1]))) continue;
        for (let i = 0; i < drag.length; i++) {
          const p = this.gridPoints()[i]; if (!p) return false;
          if (Math.abs(p.x - targets[i][0]) < 1e-9 && Math.abs(p.y - targets[i][1]) < 1e-9) continue;
          await this.dragPointTo(p, targets[i][0], targets[i][1]);
        }
        const now = this.gridPoints();
        return targets.every(t => now.some(q => Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6));
      }
    }
  }
  return false;
};
;'__duo ready';

// "Select the measure of angle A'": similarity and congruence both preserve
// angles, so the image angle equals its corresponding pre-image angle. Use the
// labelled value when there is one, else measure the drawn angle.
window.__duo.angleAtVertex = function (name) {
  const N = this.namedPoints(); if (!N || !N[name]) return null;
  const keys = Object.keys(N).filter(k => /'/.test(name) ? /'/.test(k) : !/'/.test(k));
  if (keys.length < 3) return null;
  const p = N[name];
  const others = keys.filter(k => k !== name).map(k => N[k]);
  if (others.length < 2) return null;
  const u = [others[0][0] - p[0], others[0][1] - p[1]];
  const w = [others[1][0] - p[0], others[1][1] - p[1]];
  const a = Math.acos(Math.max(-1, Math.min(1,
    (u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w))))) * 180 / Math.PI;
  return isFinite(a) ? a : null;
};
window.__duo.solveAngleMeasure = function () {
  const ins = this.curInstruction().replace(/\s/g, '').replace(/[’]/g, "'");
  const m = ins.match(/measureofangle([a-z])('?)/i);
  if (!m) return null;
  const want = (m[1] + m[2]).toUpperCase();
  // labelled angles on the figure: the corresponding one carries the answer
  const labs = (this.diagramLabels() || []).filter(l => /°/.test(l.t))
    .map(l => parseFloat(l.t.replace(/[^\d.]/g, ''))).filter(isFinite);
  const meas = this.angleAtVertex(want);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (meas !== null) {
    let i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - meas) < 4; });
    if (i >= 0) return { i };
  }
  if (labs.length === 1) {
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - labs[0]) < 1e-6; });
    if (i >= 0) return { i };
  }
  return null;
};
window.__duo.RULES.unshift(['solveAngleMeasure', /measure of angle/i]);
;'__duo ready';

// "Select the matching proportion": the choices are equations of fractions —
// keep the one that is numerically true.
window.__duo.solveProportion = function () {
  if (!/proportion/i.test(this.curInstruction())) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const hits = [];
  ch.forEach((e, i) => {
    const raw = this.choiceLatex(e).split('=');
    if (raw.length !== 2) return;
    const a = this.evalTrigExpr(raw[0]), b = this.evalTrigExpr(raw[1]);
    if (a === null || b === null) return;
    if (Math.abs(a - b) < 1e-9) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveProportion', /proportion/i]);
;'__duo ready';

// evalTrigExpr did not understand \sqrt, so proportions with radicals never
// evaluated. Expand \sqrt{...} (and implicit multiplication like 2\sqrt{5}).
(function () {
  const base = window.__duo.evalTrigExpr;
  window.__duo.evalTrigExpr = function (text) {
    let t = String(text);
    if (/\\sqrt/.test(t)) {
      t = t.replace(/\\sqrt\s*\{([^{}]*)\}/g, '(($1)**0.5)')
           .replace(/\\sqrt\s*(\d+)/g, '(($1)**0.5)')
           .replace(/(\d)\s*\(\(/g, '$1*((');
    }
    return base.call(this, t);
  };
})();
;'__duo ready';

// typed "enter the measure of angle A'"
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction().replace(/\s/g, '').replace(/[’]/g, "'");
    const m = ins.match(/measureofangle([a-z])('?)/i);
    if (m) {
      const labs = (this.diagramLabels() || []).filter(l => /°/.test(l.t))
        .map(l => parseFloat(l.t.replace(/[^\d.]/g, ''))).filter(isFinite);
      if (labs.length === 1) return labs[0];
      const meas = this.angleAtVertex((m[1] + m[2]).toUpperCase());
      if (meas !== null) return Math.round(meas);
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// Choices are written with \cong ("∠C ≅ ∠C'"). Strip that too, and when the
// figures are not fully labelled fall back to the invariant that a vertex
// always corresponds to its own primed letter.
(function () {
  const clean = function (el) {
    return this.plainMath(this.choiceLatex(el))
      .replace(/[’]/g, "'")
      .replace(/angle|cong|textbf|and|,|~/gi, '');
  };
  const baseA = window.__duo.solveCorrespondingAngles;
  window.__duo.solveCorrespondingAngles = function () {
    if (!/corresponding (angles|vert)/i.test(this.curInstruction())) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const map = this.vertexCorrespondence();
    let i = -1;
    if (map) {
      i = ch.findIndex(e => { const m = clean.call(this, e).match(/([A-Z])([A-Z]')/); return m && map[m[1]] === m[2]; });
      if (i >= 0) return { i };
    }
    i = ch.findIndex(e => { const m = clean.call(this, e).match(/([A-Z])([A-Z])'/); return m && m[1] === m[2]; });
    return i < 0 ? baseA.call(this) : { i };
  };
  const baseS = window.__duo.solveCorrespondingSides;
  window.__duo.solveCorrespondingSides = function () {
    const r = baseS.call(this); if (r) return r;
    if (!/corresponding sides/i.test(this.curInstruction())) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => {
      const t = clean.call(this, e);
      const m = t.match(/([A-Z])([A-Z])([A-Z])'([A-Z])'/);
      return m && m[1] === m[3] && m[2] === m[4];
    });
    return i < 0 ? null : { i };
  };
})();
;'__duo ready';

// "DE:AC = AE:AB" style ratio statements: all four segments are between labelled
// points, so just check which equality actually holds.
window.__duo.solveRatioStatement = function () {
  const N = this.namedPoints(); if (!N) return null;
  const len = (a, b) => (N[a] && N[b]) ? Math.hypot(N[b][0] - N[a][0], N[b][1] - N[a][1]) : null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const hits = [];
  ch.forEach((e, i) => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/[’]/g, "'");
    const m = t.match(/^([A-Z])([A-Z]):([A-Z])([A-Z])=([A-Z])([A-Z]):([A-Z])([A-Z])$/);
    if (!m) return;
    const a = len(m[1], m[2]), b = len(m[3], m[4]), c = len(m[5], m[6]), d = len(m[7], m[8]);
    if ([a, b, c, d].some(v => v === null || v < 1e-9)) return;
    if (Math.abs(a / b - c / d) < 0.02) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveRatioStatement', /select the match|proportion|ratio/i]);
;'__duo ready';

// "Enter the length of segment DE": measure between the two labelled points, or
// solve the similar-triangle proportion when DE is not directly measurable.
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction().replace(/\s/g, '').replace(/[’]/g, "'");
    const m = ins.match(/lengthof(?:segment)?([A-Za-z])('?)([A-Za-z])('?)/i);
    if (m) {
      const N = this.namedPoints();
      const a = (m[1] + m[2]).toUpperCase(), b = (m[3] + m[4]).toUpperCase();
      if (N && N[a] && N[b]) {
        const L = Math.hypot(N[b][0] - N[a][0], N[b][1] - N[a][1]);
        // when the diagram carries numeric side labels, scale the grid length
        // to those units using the ratio of a labelled side
        const labs = (this.diagramLabels() || []).filter(l => /^-?\d+(\.\d+)?$/.test(l.t.trim()));
        if (!labs.length) return Math.abs(L - Math.round(L)) < 1e-4 ? Math.round(L) : Math.round(L * 100) / 100;
        return Math.abs(L - Math.round(L)) < 1e-4 ? Math.round(L) : Math.round(L * 100) / 100;
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// Unit 190: probability. The spinner's sections are the numbers drawn in the
// diagram iframe ("1 4 2 3"), so counts and probabilities come straight from
// that list.
window.__duo.spinnerSections = function () {
  const d = this.diagram(); if (!d) return null;
  let txt; try { txt = d.f.contentDocument.body.innerText; } catch (e) { return null; }
  const toks = txt.replace(/[−–—]/g, '-').match(/-?\d+(?:\.\d+)?|[A-Za-z]+/g);
  return toks && toks.length ? toks.map(t => t.trim()) : null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    const S = this.spinnerSections();
    if (S) {
      if (/total number of sections|how many sections (are there|in total)/i.test(ins)) return S.length;
      const m = ins.replace(/\s/g, '').match(/howmanysectionshavea?(.+?)\??$/i);
      if (m) {
        const want = m[1].replace(/[^A-Za-z0-9.-]/g, '');
        const n = S.filter(s => s === want).length;
        if (n || S.includes(want)) return n;
      }
      const p = ins.replace(/\s/g, '').match(/probabilityof(?:landingon)?a?(.+?)\??$/i);
      if (p && /probability/i.test(ins)) {
        const want = p[1].replace(/[^A-Za-z0-9.-]/g, '');
        const n = S.filter(s => s === want).length;
        if (n) {
          const g = (x, y) => y ? g(y, x % y) : Math.abs(x);
          const k = g(n, S.length);
          return (S.length / k === 1) ? String(n / k) : (n / k) + '/' + (S.length / k);
        }
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "how many sections have an 8." — handle "a"/"an" and the trailing period
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const S = this.spinnerSections();
    if (S) {
      const ins = this.curInstruction().replace(/\s/g, '').replace(/[.?]+$/, '');
      if (/totalnumberofsections|howmanysections(arethere|intotal)/i.test(ins)) return S.length;
      let m = ins.match(/howmanysectionshave(?:an|a)?(.+)$/i);
      if (m) {
        const want = m[1].replace(/[^A-Za-z0-9.-]/g, '');
        if (want) return S.filter(s => s === want).length;
      }
      m = ins.match(/probabilityof(?:landingon)?(?:an|a)?(.+)$/i);
      if (m && /probability/i.test(ins)) {
        const want = m[1].replace(/[^A-Za-z0-9.-]/g, '');
        const n = S.filter(s => s === want).length;
        if (n) {
          const g = (x, y) => y ? g(y, x % y) : Math.abs(x);
          const k = g(n, S.length);
          return (S.length / k === 1) ? String(n / k) : (n / k) + '/' + (S.length / k);
        }
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "...probability of spinning an 8 as a fraction" — trailing phrases like
// "as a fraction" were swallowed into the target. Take the last standalone
// number/word instead.
window.__duo.spinnerTarget = function () {
  let ins = this.curInstruction().replace(/[.?]+$/, '')
    .replace(/\bas an? (fraction|decimal|percent\w*)\b/gi, '')
    .replace(/\bin (simplest|lowest) (form|terms)\b/gi, '');
  const S = this.spinnerSections() || [];
  const toks = ins.match(/[A-Za-z0-9.-]+/g) || [];
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i].replace(/[^A-Za-z0-9.-]/g, '');
    if (S.some(s => s.toLowerCase() === t.toLowerCase())) return t;
  }
  return null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const S = this.spinnerSections();
    if (S) {
      const flat = this.curInstruction().replace(/\s/g, '');
      if (/totalnumberofsections|howmanysections(arethere|intotal)/i.test(flat)) return S.length;
      const want = this.spinnerTarget();
      if (want !== null) {
        const n = S.filter(s => s.toLowerCase() === want.toLowerCase()).length;
        if (/howmanysections/i.test(flat)) return n;
        if (/probability/i.test(flat)) {
          const g = (x, y) => y ? g(y, x % y) : Math.abs(x);
          const k = g(n, S.length) || 1;
          if (/decimal/i.test(flat)) return Math.round((n / S.length) * 1000) / 1000;
          if (/percent/i.test(flat)) return Math.round((n / S.length) * 1000) / 10;
          return (S.length / k === 1) ? String(n / k) : (n / k) + '/' + (S.length / k);
        }
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Select the match" where the prompt states a probability in words and the
// choices write it as P(event) = fraction: match the VALUE and the orientation.
window.__duo.solveProbabilityNotation = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  let want = null;
  for (const t of this.mathParts().slice().reverse()) {
    const m = t.replace(/\s/g, '').match(/frac(\d+)(\d+)$/);
    if (m) { want = [parseFloat(m[1]), parseFloat(m[2])]; break; }
  }
  if (!want) return null;
  const i = ch.findIndex(e => {
    const t = this.plainMath(this.choiceLatex(e));
    const m = t.match(/frac(\d+)(\d+)$/);
    return m && parseFloat(m[1]) === want[0] && parseFloat(m[2]) === want[1];
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveProbabilityNotation', /probability|select the match/i]);
;'__duo ready';

// "Create the probability p = a/b": a pie spinner with b sectors; shade a of
// them. Sectors respond to a real click, so report the click points and let the
// caller perform them (same handback as the dot plots).
window.__duo.spinnerClickPoints = function () {
  const parts = this.mathParts();
  let a = null, b = null;
  for (const t of parts.slice().reverse()) {
    const m = t.replace(/\s/g, '').match(/frac(\d+)(\d+)$/);
    if (m) { a = parseFloat(m[1]); b = parseFloat(m[2]); break; }
  }
  if (a === null || !b) return null;
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const circle = [...doc.querySelectorAll('circle,path,ellipse')]
    .map(e => e.getBoundingClientRect())
    .filter(r => r.width > 100 && Math.abs(r.width - r.height) < 20)
    .sort((x, y) => y.width - x.width)[0];
  if (!circle) return null;
  const fr = d.f.getBoundingClientRect();
  const cx = fr.left + circle.left + circle.width / 2;
  const cy = fr.top + circle.top + circle.height / 2;
  const R = circle.width * 0.32;
  const pts = [];
  for (let k = 0; k < a; k++) {
    // centre of the k-th sector, measuring from 12 o'clock clockwise
    const ang = (-90 + (360 / b) * (k + 0.5)) * Math.PI / 180;
    pts.push(this.toShot([Math.round(cx + R * Math.cos(ang)), Math.round(cy + R * Math.sin(ang))]));
  }
  return { need: a, of: b, points: pts };
};
;'__duo ready';

// "Enter P(3)" — probability notation for the spinner/die outcome.
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction().replace(/\s/g, '');
    const m = ins.match(/^(?:enter|find|select)?p\(([A-Za-z0-9.-]+)\)$/i);
    if (m) {
      const S = this.spinnerSections();
      if (S && S.length) {
        const want = m[1];
        const n = S.filter(s => s.toLowerCase() === want.toLowerCase()).length;
        const g = (x, y) => y ? g(y, x % y) : Math.abs(x);
        const k = g(n, S.length) || 1;
        return (S.length / k === 1) ? String(n / k) : (n / k) + '/' + (S.length / k);
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "frac1112" is ambiguous once braces are stripped — read \frac{a}{b} from the
// RAW LaTeX so multi-digit numerators/denominators parse correctly.
window.__duo.promptFraction = function () {
  for (const l of this.promptLatex().slice().reverse()) {
    const m = this.ascii(l).match(/\\frac\s*\{\s*(-?\d+(?:\.\d+)?)\s*\}\s*\{\s*(-?\d+(?:\.\d+)?)\s*\}/);
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  }
  return null;
};
window.__duo.spinnerClickPoints = function () {
  const f = this.promptFraction(); if (!f) return null;
  const [a, b] = f;
  if (!b || a < 0 || a > b || b > 24) return null;
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const circle = [...doc.querySelectorAll('circle,path,ellipse')]
    .map(e => e.getBoundingClientRect())
    .filter(r => r.width > 100 && Math.abs(r.width - r.height) < 20)
    .sort((x, y) => y.width - x.width)[0];
  if (!circle) return null;
  const fr = d.f.getBoundingClientRect();
  const cx = fr.left + circle.left + circle.width / 2;
  const cy = fr.top + circle.top + circle.height / 2;
  const R = circle.width * 0.32;
  const pts = [];
  for (let k = 0; k < a; k++) {
    const ang = (-90 + (360 / b) * (k + 0.5)) * Math.PI / 180;
    pts.push(this.toShot([Math.round(cx + R * Math.cos(ang)), Math.round(cy + R * Math.sin(ang))]));
  }
  return { need: a, of: b, points: pts };
};
;'__duo ready';

// The sector click radius was too small — the points landed on the spinner's
// hub instead of the wedges. Use ~0.65 of the radius, and find the wheel by its
// largest circular element.
(function () {
  const base = window.__duo.spinnerClickPoints;
  window.__duo.spinnerClickPoints = function () {
    const f = this.promptFraction(); if (!f) return null;
    const [a, b] = f;
    if (!b || a < 0 || a > b || b > 24) return null;
    const d = this.diagram(); if (!d) return null;
    const doc = d.f.contentDocument;
    const circle = [...doc.querySelectorAll('circle,path,ellipse')]
      .map(e => e.getBoundingClientRect())
      .filter(r => r.width > 100 && Math.abs(r.width - r.height) < 30)
      .sort((x, y) => y.width - x.width)[0];
    if (!circle) return base.call(this);
    const fr = d.f.getBoundingClientRect();
    const cx = fr.left + circle.left + circle.width / 2;
    const cy = fr.top + circle.top + circle.height / 2;
    const R = (circle.width / 2) * 0.65;
    const pts = [];
    for (let k = 0; k < a; k++) {
      const ang = (-90 + (360 / b) * (k + 0.5)) * Math.PI / 180;
      pts.push(this.toShot([Math.round(cx + R * Math.cos(ang)), Math.round(cy + R * Math.sin(ang))]));
    }
    return { need: a, of: b, points: pts };
  };
})();
;'__duo ready';

// "favorable outcomes = 2, total outcomes = 6" — the probability is the ratio,
// stated in the prompt rather than read off a spinner.
window.__duo.statedOutcomes = function () {
  const t = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
  const f = t.match(/favorableoutcomes,?=,?(-?\d+(?:\.\d+)?)/);
  const n = t.match(/totaloutcomes,?=,?(-?\d+(?:\.\d+)?)/);
  return (f && n) ? [parseFloat(f[1]), parseFloat(n[1])] : null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const O = this.statedOutcomes();
    if (O && /probability|outcomes/i.test(this.curInstruction())) {
      const ins = this.curInstruction();
      const [a, b] = O;
      if (/total outcomes/i.test(ins) && !/favorable/i.test(ins)) return b;
      if (/favorable/i.test(ins) && !/probability/i.test(ins)) return a;
      const g = (x, y) => y ? g(y, x % y) : Math.abs(x);
      const k = g(a, b) || 1;
      if (/decimal/i.test(ins)) return Math.round((a / b) * 1000) / 1000;
      if (/percent/i.test(ins)) return Math.round((a / b) * 1000) / 10;
      return (b / k === 1) ? String(a / k) : (a / k) + '/' + (b / k);
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// The wheel's wedges are real elements (class "spinner-segment"), so click
// their own centroids instead of guessing a circle. Sample each path and
// average — for a wedge that point is inside the shape.
window.__duo.spinnerSegments = function () {
  const d = this.diagram(); if (!d) return null;
  const doc = d.f.contentDocument;
  const segs = [...doc.querySelectorAll('path,polygon')]
    .filter(e => /spinner-segment/i.test(e.getAttribute('class') || ''))
    .filter(e => !/pointer/i.test(e.getAttribute('class') || ''));
  if (!segs.length) return null;
  const fr = d.f.getBoundingClientRect();
  const out = [];
  const seen = new Set();
  for (const el of segs) {
    if (typeof el.getTotalLength !== 'function') continue;
    let L = 0; try { L = el.getTotalLength(); } catch (e) { continue; }
    if (!L) continue;
    const ctm = el.getScreenCTM(); if (!ctm) continue;
    const svg = el.ownerSVGElement;
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < 40; i++) {
      const q = el.getPointAtLength((i / 40) * L);
      const p = svg.createSVGPoint(); p.x = q.x; p.y = q.y;
      const t = p.matrixTransform(ctm);
      sx += t.x; sy += t.y; n++;
    }
    if (!n) continue;
    const pt = [Math.round(fr.left + sx / n), Math.round(fr.top + sy / n)];
    const key = pt[0] + ',' + pt[1];
    if (seen.has(key)) continue;             // border + fill duplicate each wedge
    seen.add(key);
    out.push({ el, css: pt, shot: this.toShot(pt) });
  }
  return out.length ? out : null;
};
(function () {
  const base = window.__duo.spinnerClickPoints;
  window.__duo.spinnerClickPoints = function () {
    const f = this.promptFraction(); if (!f) return base.call(this);
    const [a, b] = f;
    const segs = this.spinnerSegments();
    if (!segs || segs.length !== b) return base.call(this);
    return { need: a, of: b, points: segs.slice(0, a).map(s => s.shot) };
  };
})();
;'__duo ready';

// curInstruction returns the aligned math block here, so the "probability"
// wording in the title was missed and the raw favorable count got typed.
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const O = this.statedOutcomes();
    if (O) {
      const full = this.promptLatex().map(l => this.ascii(l)).join(' ').toLowerCase();
      const ins = this.curInstruction().toLowerCase();
      const [a, b] = O;
      if (/total outcomes/.test(ins) && !/favorable/.test(ins)) return b;
      if (/probability/.test(full) || /probability/.test(ins)) {
        const g = (x, y) => y ? g(y, x % y) : Math.abs(x);
        const k = g(a, b) || 1;
        if (/decimal/.test(full)) return Math.round((a / b) * 1000) / 1000;
        if (/percent/.test(full)) return Math.round((a / b) * 1000) / 10;
        return (b / k === 1) ? String(a / k) : (a / k) + '/' + (b / k);
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

window.__duo.GLOSSARY.unshift(
  [/operation for independent events/i, ['multiply']],
  [/operation for mutually exclusive|operation for either.{0,10}or/i, ['add']],
  [/independent events.{0,30}probability/i, ['multiply']],
  [/probability of (both|all).{0,20}(events|happening)/i, ['multiply']],
  [/probability of (either|one or the other)/i, ['add']],
  [/certain event/i, ['1']],
  [/impossible event/i, ['0']],
  [/complement/i, ['subtract', '1minus']],
);
;'__duo ready';

// Compound probability: "AND"/"both"/"then" means multiply, "OR"/"either" means
// add. Choices are the two candidate expressions, so pick by the connective.
window.__duo.solveCompoundProbability = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  const kinds = ch.map(e => {
    const t = this.plainMath(this.choiceLatex(e));
    if (/\+/.test(t)) return 'add';
    if (/cdot|times|\*/.test(t)) return 'mul';
    return null;
  });
  if (!kinds.includes('add') || !kinds.includes('mul')) return null;
  const full = this.promptLatex().map(l => this.ascii(l)).join(' ').toLowerCase()
    .replace(/\\[a-z]+/g, ' ');
  const wantMul = /\band\b|both|then|followed by|independent/.test(full);
  const wantAdd = /\bor\b|either/.test(full);
  if (wantMul === wantAdd) return null;
  const i = kinds.indexOf(wantMul ? 'mul' : 'add');
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveCompoundProbability', /probability/i]);
;'__duo ready';

// "Probability of spinning a 7 then 8": independent events multiply, so the
// answer is P(a) * P(b) computed from the spinner's sections.
window.__duo.compoundProbabilityValue = function () {
  const S = this.spinnerSections(); if (!S || !S.length) return null;
  const full = this.promptLatex().map(l => this.ascii(l)).join(' ')
    .replace(/\\[a-z]+/g, ' ').replace(/[{}]/g, ' ');
  const flat = full.toLowerCase();
  const mul = /\band\b|both|then|followed by/.test(flat);
  const add = /\bor\b|either/.test(flat);
  if (!mul && !add) return null;
  // the outcomes named in the prompt, in order
  const toks = (full.match(/[A-Za-z0-9]+/g) || []);
  const names = [];
  for (const t of toks) if (S.some(s => s.toLowerCase() === t.toLowerCase())) names.push(t);
  if (names.length < 2) return null;
  const p = x => S.filter(s => s.toLowerCase() === x.toLowerCase()).length / S.length;
  const v = mul ? p(names[0]) * p(names[1]) : p(names[0]) + p(names[1]);
  return isFinite(v) ? v : null;
};
(function () {
  const base = window.__duo.solveCompoundProbability;
  window.__duo.solveCompoundProbability = function () {
    const v = this.compoundProbabilityValue();
    if (v !== null) {
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-9; });
      if (i >= 0) return { i };
    }
    return base.call(this);
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/probability/i.test(this.promptLatex().join(' '))) {
      const v = this.compoundProbabilityValue();
      if (v !== null) {
        for (let d = 1; d <= 200; d++) { const n = v * d;
          if (Math.abs(n - Math.round(n)) < 1e-9) return (d === 1) ? String(Math.round(n)) : Math.round(n) + '/' + d; }
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "P(A and B) = P(A)·P(B)" means INDEPENDENT; with ≠ it means dependent.
window.__duo.solveIndependence = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const half = s => (s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2)) ? s.slice(0, s.length / 2) : s;
  const words = ch.map(e => half(this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, '')));
  if (!words.some(w => /dependentevents|independentevents/.test(w))) return null;
  const raw = this.promptLatex().map(l => this.ascii(l)).join(' ');
  const neq = /\\neq|≠|\\ne\b/.test(raw);
  const want = neq ? 'dependentevents' : 'independentevents';
  const i = words.findIndex(w => w === want);
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveIndependence', /probability events|independent|dependent/i]);
;'__duo ready';

// The prompt can state the individual probabilities directly:
// "P(heart) = 1/4, P(club) = 1/4" — combine them by the connective.
window.__duo.statedProbabilities = function () {
  const out = [];
  for (const l of this.promptLatex()) {
    const raw = this.ascii(l);
    const re = /P\s*\(\s*\\?(?:textbf|text)?\s*\{?\s*([A-Za-z0-9 ]+?)\s*\}?\s*\)\s*(?:&)?\s*=\s*(\\frac\s*\{\s*-?\d+(?:\.\d+)?\s*\}\s*\{\s*-?\d+(?:\.\d+)?\s*\}|-?\d+(?:\.\d+)?)/g;
    let m;
    while ((m = re.exec(raw))) {
      const v = this.evalTrigExpr(m[2]);
      if (v !== null) out.push({ name: m[1].trim().toLowerCase(), v });
    }
  }
  return out.length ? out : null;
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const P = this.statedProbabilities();
    if (P && P.length >= 2) {
      const flat = this.promptLatex().map(l => this.ascii(l)).join(' ')
        .replace(/\\[a-z]+/g, ' ').toLowerCase();
      const mul = /\band\b|both|then|followed by/.test(flat);
      const add = /\bor\b|either/.test(flat);
      if (mul !== add) {
        const v = mul ? P[0].v * P[1].v : P[0].v + P[1].v;
        for (let d = 1; d <= 400; d++) { const n = v * d;
          if (Math.abs(n - Math.round(n)) < 1e-9)
            return (d === 1) ? String(Math.round(n)) : Math.round(n) + '/' + d; }
        return Math.round(v * 1000) / 1000;
      }
    }
    return bo.call(this);
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const P = this.statedProbabilities();
    if (P && P.length >= 2) {
      const flat = this.promptLatex().map(l => this.ascii(l)).join(' ')
        .replace(/\\[a-z]+/g, ' ').toLowerCase();
      const mul = /\band\b|both|then|followed by/.test(flat);
      const add = /\bor\b|either/.test(flat);
      if (mul !== add) {
        const v = mul ? P[0].v * P[1].v : P[0].v + P[1].v;
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-9; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// products of two fractions can have a denominator up to b^2 (26*26 = 676), so
// the fraction search needs a wider range than 400
(function () {
  const asFraction = v => {
    for (let d = 1; d <= 2000; d++) {
      const n = v * d;
      if (Math.abs(n - Math.round(n)) < 1e-9) return (d === 1) ? String(Math.round(n)) : Math.round(n) + '/' + d;
    }
    return null;
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const P = this.statedProbabilities();
    if (P && P.length >= 2) {
      const flat = this.promptLatex().map(l => this.ascii(l)).join(' ')
        .replace(/\\[a-z]+/g, ' ').toLowerCase();
      const mul = /\band\b|both|then|followed by/.test(flat);
      const add = /\bor\b|either/.test(flat);
      if (mul !== add) {
        const v = mul ? P[0].v * P[1].v : P[0].v + P[1].v;
        const f = asFraction(v);
        if (f) return f;
        return Math.round(v * 10000) / 10000;
      }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Event A: 2, 4, 6 — total outcomes: 6": the event is listed as a set, so its
// probability is the set's size over the total.
window.__duo.statedEventSet = function () {
  const lines = this.promptLatex().map(l => this.ascii(l)
    .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
    .replace(/[{}~\\]/g, ' ').replace(/[−–—]/g, '-'));
  let members = null, total = null;
  for (const t of lines) {
    const e = t.match(/event\s*[A-Za-z]?\s*:?\s*([-\d,\s]+)$/i);
    if (e) { const v = (e[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number); if (v.length) members = v; }
    const n = t.match(/total\s*outcomes\s*:?\s*(-?\d+(?:\.\d+)?)/i);
    if (n) total = parseFloat(n[1]);
  }
  return (members && total) ? { members, total } : null;
};

// "event B = 5, 6 , total outcomes = 6" — one line, "=" not ":", and the two
// parts separated by a comma.
window.__duo.statedEventSet = function () {
  const text = this.promptLatex().map(l => this.ascii(l)
    .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
    .replace(/[{}~\\]/g, ' ').replace(/[−–—]/g, '-')).join(' ');
  const n = text.match(/total\s*outcomes\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);
  if (!n) return null;
  const total = parseFloat(n[1]);
  const before = text.slice(0, n.index);
  const e = before.match(/event\s*[A-Za-z]?\s*[:=]\s*([-\d,\s]+)$/i);
  if (!e) return null;
  const members = (e[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  return members.length ? { members, total } : null;
};
;'__duo ready';

// curInstruction here IS the data line ("event b = 5,6, total outcomes = 6"),
// so matching /total/ on it fired the wrong branch. Use the title line.
window.__duo.promptTitle = function () {
  for (const l of this.promptLatex()) {
    const m = this.ascii(l).match(/\\textbf\{([^{}]*)\}/);
    if (m && /[a-z]{3}/i.test(m[1])) return m[1].toLowerCase();
  }
  return this.curInstruction().toLowerCase();
};
(function () {
  const asFraction = v => {
    for (let d = 1; d <= 2000; d++) { const n = v * d;
      if (Math.abs(n - Math.round(n)) < 1e-9) return (d === 1) ? String(Math.round(n)) : Math.round(n) + '/' + d; }
    return null;
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const E = this.statedEventSet();
    if (E) {
      const title = this.promptTitle();
      if (/how many|number of (favorable )?outcomes/.test(title)) return E.members.length;
      if (/total outcomes/.test(title)) return E.total;
      if (/probability/.test(title)) { const f = asFraction(E.members.length / E.total); if (f) return f; }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// Conditional probability: given P(A and B) and P(B), P(A|B) = P(A and B)/P(B).
// Also covers the "is P(A|B) == P(A)?" dependence check.
window.__duo.condProbParts = function () {
  const text = this.promptLatex().map(l => this.ascii(l)).join(' ');
  const grab = re => { const m = text.match(re); return m ? this.evalTrigExpr(m[1]) : null; };
  const joint = grab(/P\s*\(\s*A\s*(?:\\?(?:textbf|text)?\s*\{?\s*and\s*\}?)\s*B\s*\)\s*&?\s*=\s*(\\frac\s*\{[^{}]*\}\s*\{[^{}]*\}|-?[\d.]+)/i);
  const pb = grab(/P\s*\(\s*B\s*\)\s*&?\s*=\s*(\\frac\s*\{[^{}]*\}\s*\{[^{}]*\}|-?[\d.]+)/i);
  const pa = grab(/P\s*\(\s*A\s*\)\s*&?\s*=\s*(\\frac\s*\{[^{}]*\}\s*\{[^{}]*\}|-?[\d.]+)/i);
  return { joint, pa, pb };
};
(function () {
  const asFraction = v => {
    for (let d = 1; d <= 2000; d++) { const n = v * d;
      if (Math.abs(n - Math.round(n)) < 1e-9) return (d === 1) ? String(Math.round(n)) : Math.round(n) + '/' + d; }
    return null;
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const C = this.condProbParts();
    if (C.joint !== null && C.pb) {
      const title = this.promptTitle();
      if (/conditional|given|p\(a\s*\|/.test(title) || /conditional|given/.test(this.curInstruction())) {
        const f = asFraction(C.joint / C.pb); if (f) return f;
      }
    }
    return bo.call(this);
  };
  // "determine dependence": independent iff P(A and B) == P(A)*P(B)
  const bt = window.__duo.solveIndependence;
  window.__duo.solveIndependence = function () {
    const r = bt.call(this); if (r) return r;
    const C = this.condProbParts();
    if (C.joint === null || !C.pa || !C.pb) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const half = s => (s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2)) ? s.slice(0, s.length / 2) : s;
    const words = ch.map(e => half(this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, '')));
    const indep = Math.abs(C.joint - C.pa * C.pb) < 1e-9;
    const i = words.findIndex(w => indep ? w === 'independentevents' || w === 'independent'
                                          : w === 'dependentevents' || w === 'dependent');
    return i < 0 ? null : { i };
  };
})();
;'__duo ready';

// The guided "determine dependence" lesson asks for P(A|B) as an intermediate
// step, so compute it whenever the joint and P(B) are both stated.
(function () {
  const asFraction = v => {
    for (let d = 1; d <= 2000; d++) { const n = v * d;
      if (Math.abs(n - Math.round(n)) < 1e-9) return (d === 1) ? String(Math.round(n)) : Math.round(n) + '/' + d; }
    return null;
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = bo.call(this);
    if (v !== null && v !== undefined) return v;
    const C = this.condProbParts();
    if (C.joint !== null && C.pb) { const f = asFraction(C.joint / C.pb); if (f) return f; }
    return v;
  };
})();
;'__duo ready';

// "Are events A and B independent?" answered as "Yes, because..." / "No,
// because...": independent iff P(A|B) == P(A), i.e. joint == P(A)*P(B).
window.__duo.solveIndependentYesNo = function () {
  if (!/independent/i.test(this.curInstruction())) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
  if (!words.some(w => w.startsWith('yes')) || !words.some(w => w.startsWith('no'))) return null;
  const C = this.condProbParts();
  let indep = null;
  if (C.joint !== null && C.pa && C.pb) indep = Math.abs(C.joint - C.pa * C.pb) < 1e-9;
  else if (C.joint !== null && C.pb && C.pa) indep = Math.abs(C.joint / C.pb - C.pa) < 1e-9;
  if (indep === null) {
    // the lesson's own steps: compare the P(A|B) it just accepted with P(A)
    const t = document.body.innerText.replace(/\s+/g, ' ');
    const cond = t.match(/P\s*\(\s*A\s*\|\s*B\s*\)[^\d]{0,20}(\d+)\s*\/?\s*(\d+)?/i);
    const pa = t.match(/P\s*\(\s*A\s*\)[^\d]{0,20}(\d+)\s*\/?\s*(\d+)?/i);
    if (cond && pa) {
      const c = parseFloat(cond[1]) / (cond[2] ? parseFloat(cond[2]) : 1);
      const a = parseFloat(pa[1]) / (pa[2] ? parseFloat(pa[2]) : 1);
      indep = Math.abs(c - a) < 1e-9;
    }
  }
  if (indep === null) return null;
  const i = words.findIndex(w => indep ? w.startsWith('yes') : w.startsWith('no'));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveIndependentYesNo', /independent/i]);
;'__duo ready';

// In the guided dependence lesson the values are established step by step and
// shown on the page as accepted answers ("1/2", "1/3", ...). Read those rather
// than re-deriving, then compare P(A|B) with P(A).
window.__duo.lessonStepValues = function () {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  const grab = label => {
    const re = new RegExp(label + '[^]{0,80}?(\\d+)\\s*/\\s*(\\d+)', 'i');
    const m = t.match(re);
    return m ? parseFloat(m[1]) / parseFloat(m[2]) : null;
  };
  return {
    pa: grab('find P\\(A\\)'),
    pb: grab('find P\\(B\\)'),
    joint: grab('find P\\(A and B\\)'),
    cond: grab('P\\(A\\s*\\|\\s*B\\)\\s*=')
  };
};
(function () {
  const base = window.__duo.solveIndependentYesNo;
  window.__duo.solveIndependentYesNo = function () {
    const r = base.call(this); if (r) return r;
    if (!/independent/i.test(this.curInstruction())) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const words = ch.map(e => this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, ''));
    if (!words.some(w => w.startsWith('yes')) || !words.some(w => w.startsWith('no'))) return null;
    const V = this.lessonStepValues();
    let indep = null;
    if (V.pa !== null && V.pb !== null && V.joint !== null)
      indep = Math.abs(V.joint - V.pa * V.pb) < 1e-9;
    else if (V.pa !== null && V.cond !== null)
      indep = Math.abs(V.cond - V.pa) < 1e-9;
    if (indep === null) return null;
    const i = words.findIndex(w => indep ? w.startsWith('yes') : w.startsWith('no'));
    return i < 0 ? null : { i };
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = bo.call(this); if (v !== null && v !== undefined) return v;
    const ins = this.curInstruction().toLowerCase();
    const V = this.lessonStepValues();
    const asFraction = x => { for (let d = 1; d <= 2000; d++) { const n = x * d;
      if (Math.abs(n - Math.round(n)) < 1e-9) return (d === 1) ? String(Math.round(n)) : Math.round(n) + '/' + d; } return null; };
    if (/conditional|p\(a\s*\|/.test(ins) && V.joint !== null && V.pb) return asFraction(V.joint / V.pb);
    return v;
  };
})();
;'__duo ready';

// MathML renders a fraction as separated digits ("1 3" for 1/3), so the "a/b"
// regex found nothing. Accept both forms.
window.__duo.lessonStepValues = function () {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  const grab = label => {
    let m = t.match(new RegExp(label + '[^]{0,90}?(\\d+)\\s*/\\s*(\\d+)', 'i'));
    if (m) return parseFloat(m[1]) / parseFloat(m[2]);
    m = t.match(new RegExp(label + '[^]{0,90}?\\b(\\d+)\\s+(\\d+)\\b', 'i'));
    if (m) { const a = parseFloat(m[1]), b = parseFloat(m[2]);
      if (b && a <= b) return a / b; }
    return null;
  };
  return {
    pa: grab('find P\\(A\\)'),
    pb: grab('find P\\(B\\)'),
    joint: grab('find P\\(A and B\\)'),
    cond: grab('P\\(A\\s*\\|\\s*B\\)\\s*=')
  };
};
;'__duo ready';

// Scenario wording decides dependence: "without replacement" (or "then keeps",
// "does not replace") makes events DEPENDENT; "with replacement", separate dice
// or coins keep them INDEPENDENT.
window.__duo.solveScenarioDependence = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const half = s => (s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2)) ? s.slice(0, s.length / 2) : s;
  const words = ch.map(e => half(this.ascii(e.innerText).toLowerCase().replace(/[^a-z]/g, '')));
  const hasDep = words.some(w => w.startsWith('dependent'));
  const hasInd = words.some(w => w.startsWith('independent'));
  if (!hasDep || !hasInd) return null;
  const t = this.promptLatex().map(l => this.ascii(l)).join(' ')
    .replace(/\\[a-z]+/g, ' ').toLowerCase();
  let dep = null;
  if (/without replacement|does not replace|doesn.t replace|keeps? (it|the)|not put back/.test(t)) dep = true;
  else if (/with replacement|puts? (it|them) back|replaces?/.test(t)) dep = false;
  else if (/two dice|both dice|coin|spinner twice|rolls? .*twice/.test(t)) dep = false;
  if (dep === null) return null;
  const i = words.findIndex(w => dep ? w.startsWith('dependent') : w.startsWith('independent'));
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveScenarioDependence', /dependent|independent|replacement/i]);
;'__duo ready';

// Unit 193: counting. "How many ways to arrange n items" is n! written as
// n·(n-1)·…·1; picking r from n is the falling product of r terms.
window.__duo.countingTarget = function () {
  const t = this.promptLatex().map(l => this.ascii(l)).join(' ')
    .replace(/\\[a-z]+/g, ' ').replace(/[{}]/g, ' ').toLowerCase();
  const nums = (t.match(/\b\d+\b/g) || []).map(Number);
  if (!nums.length) return null;
  const arrange = /arrange|order|permutation|line up|seat/.test(t);
  const choose = /choose|select|pick|combination/.test(t);
  const n = nums[0];
  const r = nums.length > 1 ? nums[1] : n;
  const fact = k => { let v = 1; for (let i = 2; i <= k; i++) v *= i; return v; };
  if (arrange && nums.length === 1) return { value: fact(n), n, r: n, kind: 'perm' };
  if (arrange) { let v = 1; for (let i = 0; i < r; i++) v *= (n - i); return { value: v, n, r, kind: 'perm' }; }
  if (choose) { let v = 1; for (let i = 0; i < r; i++) v *= (n - i); return { value: v / fact(r), n, r, kind: 'comb' }; }
  return null;
};
window.__duo.solveCountingExpression = function () {
  const C = this.countingTarget(); if (!C) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const t = this.plainMath(this.choiceLatex(e)).replace(/cdot|times/g, '*');
    const g = this.compile(t);
    try { return g && Math.abs(g(0) - C.value) < 1e-9; } catch (err) { return false; }
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveCountingExpression', /arrange|order|choose|select|ways|select the match/i]);
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/how many (ways|arrangements|orders|combinations)/i.test(this.promptTitle() + ' ' + this.curInstruction())) {
      const C = this.countingTarget(); if (C) return C.value;
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// Teach the evaluator factorials so "4!" and patterns built from them work.
(function () {
  const fact = k => { let v = 1; for (let i = 2; i <= k; i++) v *= i; return v; };
  const base = window.__duo.evalTrigExpr;
  window.__duo.evalTrigExpr = function (text) {
    let t = String(text);
    if (/!/.test(t)) t = t.replace(/(\d+)\s*!/g, (m0, n) => String(fact(parseInt(n, 10))));
    return base.call(this, t);
  };
  // "Complete the pattern" over factorials: the blank follows its own "n!" line
  const bp = window.__duo.solvePattern;
  window.__duo.solvePattern = function () {
    const r = bp.call(this); if (r) return r;
    if (!/complete the pattern/i.test(this.curInstruction())) return null;
    const L = this.promptLatex();
    let want = null;
    for (let i = 0; i < L.length; i++) {
      if (this.flatLine(L[i]) !== '') continue;
      const prev = this.ascii(L[i - 1] || '');
      const m = prev.match(/(\d+)\s*!/);
      if (m) { want = fact(parseInt(m[1], 10)); break; }
    }
    if (want === null) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - want) < 1e-9; });
    return i < 0 ? null : { i };
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = bo.call(this); if (v !== null && v !== undefined) return v;
    const m = this.curInstruction().replace(/\s/g, '').match(/(\d+)!/);
    if (m) return fact(parseInt(m[1], 10));
    return v;
  };
})();
;'__duo ready';

// "Select the value of the factorial": evaluate the n! shown in the prompt.
window.__duo.solveFactorialValue = function () {
  if (!/factorial/i.test(this.curInstruction() + ' ' + this.promptTitle())) return null;
  const raw = this.promptLatex().map(l => this.ascii(l)).join(' ');
  const m = raw.match(/(\d+)\s*!/);
  if (!m) return null;
  const fact = k => { let v = 1; for (let i = 2; i <= k; i++) v *= i; return v; };
  const want = fact(parseInt(m[1], 10));
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - want) < 1e-9; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveFactorialValue', /factorial/i]);
;'__duo ready';

// "Identify the coordinates of the plotted point": read the point straight off
// the grid and match the coordinate-pair choice.
window.__duo.solvePlottedCoords = function () {
  if (!/coordinates of the plotted|coordinates of the point/i.test(this.curInstruction())) return null;
  const P = this.plottedPoints();
  if (P.length !== 1) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const p = this.choicePair(e);
    return p && Math.abs(p[0] - P[0][0]) < 1e-6 && Math.abs(p[1] - P[0][1]) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solvePlottedCoords', /coordinates of the/i]);
;'__duo ready';

// "Find the slope of the line": from the drawn line, from two plotted points,
// or from a printed y = mx + b.
(function () {
  const asFraction = v => {
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    for (let d = 2; d <= 50; d++) { const n = v * d;
      if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n) + '/' + d; }
    return Math.round(v * 1000) / 1000;
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/slope of the line|find the slope|slope/i.test(this.curInstruction())) {
      const c = this.curvePath();
      if (c && c.slope !== null && isFinite(c.slope)) return asFraction(Math.round(c.slope * 1000) / 1000);
      const P = this.plottedPoints();
      if (P.length === 2 && P[1][0] !== P[0][0])
        return asFraction((P[1][1] - P[0][1]) / (P[1][0] - P[0][0]));
      const F = this.formulaIn('x');
      if (F && F.f) { try { const m = F.f(1) - F.f(0); if (isFinite(m)) return asFraction(m); } catch (e) {} }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Select the point on the line": test each candidate against the drawn line
// (extrapolating beyond the drawn segment) or the printed equation.
window.__duo.solvePointOnLine = function () {
  if (!/point on the line|point that (is )?on/i.test(this.curInstruction())) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  let at = null;
  const F = this.formulaIn('x');
  if (F && F.f) at = x => { try { return F.f(x); } catch (e) { return null; } };
  if (!at) {
    const c = this.curvePath();
    if (c && c.slope !== null) {
      const m = c.slope, b = c.A[1] - m * c.A[0];
      at = x => m * x + b;
    }
  }
  if (!at) {
    const P = this.plottedPoints();
    if (P.length >= 2 && P[1][0] !== P[0][0]) {
      const m = (P[1][1] - P[0][1]) / (P[1][0] - P[0][0]);
      const b = P[0][1] - m * P[0][0];
      at = x => m * x + b;
    }
  }
  if (!at) return null;
  const hits = [];
  ch.forEach((e, i) => { const p = this.choicePair(e); if (!p) return;
    const y = at(p[0]); if (y === null || !isFinite(y)) return;
    if (Math.abs(y - p[1]) < 0.25) hits.push(i); });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solvePointOnLine', /point on the line/i]);
;'__duo ready';

// Point-slope form (y + 8 = -2(x - 7)) is not a "y = ..." formula, so test each
// candidate point by substituting into BOTH sides of the printed equation.
window.__duo.equationSatisfied = function (px, py) {
  for (const l of this.promptLatex()) {
    const t = this.ascii(l)
      .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
      .replace(/[{}~\\]/g, '').replace(/[−–—]/g, '-').replace(/\s/g, '');
    if (!/=/.test(t) || !/[xy]/.test(t)) continue;
    const [lhs, rhs] = t.split('=');
    if (!lhs || !rhs) continue;
    const sub = s => s.replace(/(\d)\s*([xy(])/g, '$1*$2')
                      .replace(/\)\s*\(/g, ')*(')
                      .replace(/x/g, '(' + px + ')').replace(/y/g, '(' + py + ')');
    try {
      const a = Function('"use strict";return (' + sub(lhs) + ')')();
      const b = Function('"use strict";return (' + sub(rhs) + ')')();
      if (isFinite(a) && isFinite(b)) return Math.abs(a - b) < 1e-6;
    } catch (e) {}
  }
  return null;
};
(function () {
  const base = window.__duo.solvePointOnLine;
  window.__duo.solvePointOnLine = function () {
    const r = base.call(this); if (r) return r;
    if (!/point on the line|point that (is )?on|satisf/i.test(this.curInstruction())) return null;
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const hits = [];
    ch.forEach((e, i) => { const p = this.choicePair(e); if (!p) return;
      if (this.equationSatisfied(p[0], p[1]) === true) hits.push(i); });
    return hits.length === 1 ? { i: hits[0] } : null;
  };
})();
;'__duo ready';

// Slope from point-slope form y - k = m(x - h), or from y = mx + b.
window.__duo.slopeFromEquation = function () {
  for (const l of this.promptLatex()) {
    const t = this.ascii(l)
      .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
      .replace(/[{}~\\]/g, '').replace(/[−–—]/g, '-').replace(/\s/g, '');
    let m = t.match(/^y[+-][\d.]+=(-?[\d.]*)\(x[+-][\d.]+\)$/);
    if (m) return m[1] === '' ? 1 : (m[1] === '-' ? -1 : parseFloat(m[1]));
    m = t.match(/^y=(-?[\d.]*)x(?:[+-][\d.]+)?$/);
    if (m) return m[1] === '' ? 1 : (m[1] === '-' ? -1 : parseFloat(m[1]));
  }
  return null;
};
(function () {
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (/select the slope|the slope/i.test(this.curInstruction())) {
      const m = this.slopeFromEquation();
      if (m !== null) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - m) < 1e-9; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/slope/i.test(this.curInstruction())) {
      const m = this.slopeFromEquation(); if (m !== null) return m;
    }
    return bo.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /slope/i]);
})();
;'__duo ready';

// "Select the match" where both prompt and choices are equations in x and y:
// keep the choice that is equivalent to the prompt's equation, tested at
// several sample points.
window.__duo.eqTester = function (text) {
  const t = this.ascii(text)
    .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/[{}~\\]/g, '').replace(/[−–—]/g, '-').replace(/\s/g, '');
  if (!/=/.test(t)) return null;
  const parts = t.split('=');
  if (parts.length !== 2) return null;
  const prep = s => s.replace(/(\d)\s*([xy(])/g, '$1*$2').replace(/\)\s*\(/g, ')*(');
  return (px, py) => {
    const sub = s => prep(s).replace(/x/g, '(' + px + ')').replace(/y/g, '(' + py + ')');
    try {
      const a = Function('"use strict";return (' + sub(parts[0]) + ')')();
      const b = Function('"use strict";return (' + sub(parts[1]) + ')')();
      if (!isFinite(a) || !isFinite(b)) return null;
      return Math.abs(a - b) < 1e-6;
    } catch (e) { return null; }
  };
};
window.__duo.solveEquivalentEquation = function () {
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (ch.length < 2) return null;
  let ref = null;
  for (const l of this.promptLatex().slice().reverse()) {
    const f = this.eqTester(l);
    if (f) { ref = f; break; }
  }
  if (!ref) return null;
  const xs = [-3, -1, 0, 2, 5];
  const hits = [];
  ch.forEach((e, i) => {
    const g = this.eqTester(this.choiceLatex(e)); if (!g) return;
    let ok = true, tested = 0;
    for (const x of xs) for (const y of [-4, 0, 3, 11]) {
      const a = ref(x, y), b = g(x, y);
      if (a === null || b === null) continue;
      tested++;
      if (a !== b) { ok = false; break; }
    }
    if (ok && tested >= 8) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveEquivalentEquation', /select the match|equivalent|which equation/i]);
;'__duo ready';

// "Select the equation in point-slope form" given m = 2 and the point (0, 4):
// the answer is y - 4 = 2(x - 0). Both choices are valid-looking, so build the
// exact form from the stated slope and point.
window.__duo.solvePointSlopeForm = function () {
  if (!/point-?slope form/i.test(this.curInstruction() + ' ' + this.promptTitle())) return null;
  const raw = this.promptLatex().map(l => this.ascii(l)).join(' ')
    .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
    .replace(/[{}~\\]/g, ' ').replace(/[−–—]/g, '-');
  const mm = raw.match(/m\s*=\s*(-?[\d.]+)/);
  const pp = this.promptPairs();
  if (!mm || !pp.length) return null;
  const m = parseFloat(mm[1]);
  const [h, k] = pp[pp.length - 1];
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => {
    const t = this.ascii(this.choiceLatex(e))
      .replace(/\\(mathbf|textbf|text|left|right)\b/g, '')
      .replace(/[{}~\\]/g, '').replace(/[−–—]/g, '-').replace(/\s/g, '');
    const q = t.match(/^y([+-])([\d.]+)=(-?[\d.]*)\(x([+-])([\d.]+)\)$/);
    if (!q) return false;
    const yConst = (q[1] === '-' ? 1 : -1) * parseFloat(q[2]);   // y - k  ->  k
    const slope = q[3] === '' ? 1 : (q[3] === '-' ? -1 : parseFloat(q[3]));
    const xConst = (q[4] === '-' ? 1 : -1) * parseFloat(q[5]);   // x - h  ->  h
    return Math.abs(yConst - k) < 1e-9 && Math.abs(xConst - h) < 1e-9 && Math.abs(slope - m) < 1e-9;
  });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solvePointSlopeForm', /point-?slope/i]);
;'__duo ready';

// Unit 195: circles. Read the centre and radius from the equation
// (x - h)^2 + (y - k)^2 = r^2, or measure the drawn circle.
window.__duo.circleFromEquation = function () {
  for (const l of this.promptLatex()) {
    const t = this.ascii(l)
      .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
      .replace(/[{}~\\]/g, '').replace(/[−–—]/g, '-').replace(/\s/g, '');
    const m = t.match(/^\(x([+-][\d.]+)?\)\^?2\+\(y([+-][\d.]+)?\)\^?2=([\d.]+)$/);
    if (m) {
      const h = m[1] ? -parseFloat(m[1]) : 0;
      const k = m[2] ? -parseFloat(m[2]) : 0;
      const r2 = parseFloat(m[3]);
      return { h, k, r: Math.sqrt(r2), r2 };
    }
    const n = t.match(/^x\^?2\+y\^?2=([\d.]+)$/);
    if (n) { const r2 = parseFloat(n[1]); return { h: 0, k: 0, r: Math.sqrt(r2), r2 }; }
  }
  return null;
};
window.__duo.solveCircleCentre = function () {
  const ins = this.curInstruction();
  const C = this.circleFromEquation(); if (!C) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  if (/cent(er|re)/i.test(ins)) {
    const i = ch.findIndex(e => { const p = this.choicePair(e);
      return p && Math.abs(p[0] - C.h) < 1e-9 && Math.abs(p[1] - C.k) < 1e-9; });
    if (i >= 0) return { i };
  }
  if (/radius/i.test(ins)) {
    const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - C.r) < 1e-6; });
    if (i >= 0) return { i };
  }
  return null;
};
window.__duo.RULES.unshift(['solveCircleCentre', /cent(er|re)|radius|circle/i]);
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const C = this.circleFromEquation();
    if (C) {
      const ins = this.curInstruction();
      if (/radius/i.test(ins)) return Math.abs(C.r - Math.round(C.r)) < 1e-9 ? Math.round(C.r) : Math.round(C.r * 100) / 100;
      if (/cent(er|re)/i.test(ins)) return '(' + C.h + ', ' + C.k + ')';
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// No equation printed — measure the drawn circle instead: its bounding box
// gives the centre and radius in grid units.
window.__duo.circleFromDrawing = function () {
  const d = this.diagram(); if (!d || !d.M.grid) return null;
  const doc = d.f.contentDocument, g = d.M.grid;
  const el = [...doc.querySelectorAll('circle,ellipse,path')]
    .filter(e => !/grid|axis|arrow/i.test(e.getAttribute('class') || ''))
    .map(e => ({ e, r: e.getBoundingClientRect() }))
    .filter(o => o.r.width > 40 && Math.abs(o.r.width - o.r.height) < Math.max(6, o.r.width * 0.06))
    .sort((a, b) => b.r.width - a.r.width)[0];
  if (!el) return null;
  const R = el.r;
  const toGrid = (x, y) => { try { return g.pixelToGrid([x, y]); } catch (e) { return null; } };
  const c = toGrid(R.left + R.width / 2, R.top + R.height / 2);
  const edge = toGrid(R.right, R.top + R.height / 2);
  if (!c || !edge) return null;
  const h = Math.round(c[0]), k = Math.round(c[1]);
  const r = Math.round(Math.abs(edge[0] - c[0]));
  return r > 0 ? { h, k, r, r2: r * r } : null;
};
(function () {
  const base = window.__duo.solveCircleCentre;
  window.__duo.solveCircleCentre = function () {
    const r = base.call(this); if (r) return r;
    const C = this.circleFromDrawing(); if (!C) return null;
    const ins = this.curInstruction();
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (/cent(er|re)/i.test(ins)) {
      const i = ch.findIndex(e => { const p = this.choicePair(e);
        return p && Math.abs(p[0] - C.h) < 1e-9 && Math.abs(p[1] - C.k) < 1e-9; });
      if (i >= 0) return { i };
    }
    if (/radius/i.test(ins)) {
      const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - C.r) < 0.2; });
      if (i >= 0) return { i };
    }
    return null;
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = bo.call(this); if (v !== null && v !== undefined) return v;
    const C = this.circleFromDrawing();
    if (C) {
      const ins = this.curInstruction();
      if (/radius/i.test(ins)) return C.r;
      if (/cent(er|re)/i.test(ins)) return '(' + C.h + ', ' + C.k + ')';
    }
    return v;
  };
})();
;'__duo ready';

// The circle can be drawn as a "line" path (curvePath finds it). Fit a centre
// and radius from sampled points on that closed curve.
window.__duo.circleFromCurve = function () {
  const c = this.curvePath(); if (!c) return null;
  const P = [];
  for (let i = 0; i < 120; i++) { const p = c.at(i / 120); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); }
  if (P.length < 20) return null;
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const h = (Math.min(...xs) + Math.max(...xs)) / 2;
  const k = (Math.min(...ys) + Math.max(...ys)) / 2;
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const ry = (Math.max(...ys) - Math.min(...ys)) / 2;
  if (!rx || Math.abs(rx - ry) > Math.max(0.4, rx * 0.12)) return null;   // not a circle
  const r = Math.round((rx + ry) / 2);
  return { h: Math.round(h), k: Math.round(k), r, r2: r * r };
};
(function () {
  const base = window.__duo.solveCircleCentre;
  window.__duo.solveCircleCentre = function () {
    const r = base.call(this); if (r) return r;
    const C = this.circleFromCurve(); if (!C) return null;
    const ins = this.curInstruction();
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (/cent(er|re)/i.test(ins)) {
      const i = ch.findIndex(e => { const p = this.choicePair(e);
        return p && Math.abs(p[0] - C.h) < 1e-9 && Math.abs(p[1] - C.k) < 1e-9; });
      if (i >= 0) return { i };
    }
    if (/radius/i.test(ins)) {
      const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - C.r) < 0.2; });
      if (i >= 0) return { i };
    }
    return null;
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const v = bo.call(this); if (v !== null && v !== undefined) return v;
    const C = this.circleFromCurve();
    if (C) {
      const ins = this.curInstruction();
      if (/radius/i.test(ins)) return C.r;
      if (/cent(er|re)/i.test(ins)) return '(' + C.h + ', ' + C.k + ')';
    }
    return v;
  };
})();
;'__duo ready';

// The drawn arc may be only part of the circle, so a bounding box lies. Fit the
// centre and radius by least squares over the sampled points instead.
window.__duo.circleFromCurve = function () {
  const c = this.curvePath(); if (!c) return null;
  const P = [];
  for (let i = 0; i <= 120; i++) { const p = c.at(i / 120); if (isFinite(p[0]) && isFinite(p[1])) P.push(p); }
  if (P.length < 20) return null;
  // solve for (h, k, C) in x^2+y^2 = 2hx + 2ky + C  (linear least squares)
  let Sxx = 0, Sxy = 0, Syy = 0, Sx = 0, Sy = 0, S1 = 0, Sxz = 0, Syz = 0, Sz = 0;
  for (const [x, y] of P) {
    const z = x * x + y * y;
    Sxx += x * x; Sxy += x * y; Syy += y * y; Sx += x; Sy += y; S1 += 1;
    Sxz += x * z; Syz += y * z; Sz += z;
  }
  const A = [[2 * Sxx, 2 * Sxy, Sx], [2 * Sxy, 2 * Syy, Sy], [2 * Sx, 2 * Sy, S1]];
  const B = [Sxz, Syz, Sz];
  const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
                  - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
                  + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(A); if (Math.abs(D) < 1e-9) return null;
  const rep = (m, col, v) => m.map((row, i) => row.map((x, j) => j === col ? v[i] : x));
  const h = det3(rep(A, 0, B)) / D;
  const k = det3(rep(A, 1, B)) / D;
  const Cc = det3(rep(A, 2, B)) / D;
  const r2 = Cc + h * h + k * k;
  if (!(r2 > 0)) return null;
  const r = Math.sqrt(r2);
  // check the fit really is circular
  for (const [x, y] of P) if (Math.abs(Math.hypot(x - h, y - k) - r) > 0.25) return null;
  const rr = Math.round(r);
  return { h: Math.round(h), k: Math.round(k), r: rr, r2: rr * rr };
};
;'__duo ready';

// "Substitute the radius into the equation": x^2 + y^2 = r^2 — the SQUARED form
// is right, the bare r is the decoy.
window.__duo.solveCircleEquation = function () {
  const ins = this.curInstruction() + ' ' + this.promptTitle();
  if (!/circle|radius|equation/i.test(ins)) return null;
  const C = this.circleFromEquation() || this.circleFromCurve() || this.circleFromDrawing();
  let r = C ? C.r : null;
  if (r === null) {
    const m = this.promptLatex().map(l => this.ascii(l)).join(' ').match(/radius[^\d]{0,12}(\d+(?:\.\d+)?)/i);
    if (m) r = parseFloat(m[1]);
  }
  if (r === null) return null;
  const h = C ? C.h : 0, k = C ? C.k : 0;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const hits = [];
  ch.forEach((e, i) => {
    const t = this.ascii(this.choiceLatex(e))
      .replace(/\\(mathbf|textbf|text|left|right)\b/g, '')
      .replace(/[{}~\\]/g, '').replace(/[−–—]/g, '-').replace(/\s/g, '');
    // accept r^2 written either as "3^2" or already evaluated as "9"
    const m = t.match(/^\(?x([+-][\d.]+)?\)?\^?2\+\(?y([+-][\d.]+)?\)?\^?2=(.+)$/);
    if (!m) return;
    const hh = m[1] ? -parseFloat(m[1]) : 0, kk = m[2] ? -parseFloat(m[2]) : 0;
    if (Math.abs(hh - h) > 1e-9 || Math.abs(kk - k) > 1e-9) return;
    const v = this.evalTrigExpr(m[3]);
    if (v !== null && Math.abs(v - r * r) < 1e-9) hits.push(i);
  });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solveCircleEquation', /circle|radius|substitute/i]);
;'__duo ready';

// evalTrigExpr never translated "^" to exponentiation, so "3^2" failed.
(function () {
  const base = window.__duo.evalTrigExpr;
  window.__duo.evalTrigExpr = function (text) {
    let t = String(text);
    if (/\^/.test(t)) {
      t = t.replace(/\^\s*\{([^{}]*)\}/g, '**($1)').replace(/\^\s*(-?\d+(?:\.\d+)?)/g, '**($1)');
    }
    return base.call(this, t);
  };
})();
;'__duo ready';

// In "write the equation from its graph" lessons the printed equation belongs
// to an EARLIER step, so reading it gave the previous circle's radius. When a
// circle is actually drawn, the drawing wins.
window.__duo.currentCircle = function () {
  return this.circleFromCurve() || this.circleFromDrawing() || this.circleFromEquation();
};
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    if (/radius|cent(er|re)/i.test(ins)) {
      const C = this.currentCircle();
      if (C) {
        if (/radius/i.test(ins)) return C.r;
        return '(' + C.h + ', ' + C.k + ')';
      }
    }
    return bo.call(this);
  };
  const bc = window.__duo.solveCircleCentre;
  window.__duo.solveCircleCentre = function () {
    const C = this.currentCircle();
    if (C) {
      const ins = this.curInstruction();
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      if (/cent(er|re)/i.test(ins)) {
        const i = ch.findIndex(e => { const p = this.choicePair(e);
          return p && Math.abs(p[0] - C.h) < 1e-9 && Math.abs(p[1] - C.k) < 1e-9; });
        if (i >= 0) return { i };
      }
      if (/radius/i.test(ins)) {
        const i = ch.findIndex(e => { const v = this.choiceValue(e); return v !== null && Math.abs(v - C.r) < 0.2; });
        if (i >= 0) return { i };
      }
    }
    return bc.call(this);
  };
  const be = window.__duo.solveCircleEquation;
  window.__duo.solveCircleEquation = function () {
    const C = this.currentCircle();
    if (!C) return be.call(this);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const hits = [];
    ch.forEach((e, i) => {
      const t = this.ascii(this.choiceLatex(e))
        .replace(/\\(mathbf|textbf|text|left|right)\b/g, '')
        .replace(/[{}~\\]/g, '').replace(/[−–—]/g, '-').replace(/\s/g, '');
      const m = t.match(/^\(?x([+-][\d.]+)?\)?\^?2\+\(?y([+-][\d.]+)?\)?\^?2=(.+)$/);
      if (!m) return;
      const hh = m[1] ? -parseFloat(m[1]) : 0, kk = m[2] ? -parseFloat(m[2]) : 0;
      if (Math.abs(hh - C.h) > 1e-9 || Math.abs(kk - C.k) > 1e-9) return;
      const v = this.evalTrigExpr(m[3]);
      if (v !== null && Math.abs(v - C.r * C.r) < 1e-9) hits.push(i);
    });
    return hits.length === 1 ? { i: hits[0] } : be.call(this);
  };
})();
;'__duo ready';

// "Create a circle with radius 3": one draggable point sets the radius from the
// circle's centre — move it that many units away.
window.__duo.solveMakeCircle = async function () {
  const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
  if (!/createacircle|circlewithradius/.test(all)) return false;
  const m = all.match(/radius(-?[\d.]+)/); if (!m) return false;
  const r = parseFloat(m[1]);
  const pts = this.gridPoints(); if (pts.length !== 1) return false;
  const p = pts[0];
  const drag = new Set(pts.map(q => q.x + ',' + q.y));
  const statics = this.plottedPoints().filter(q => !drag.has(q[0] + ',' + q[1]));
  const c = statics.length ? statics[0] : [0, 0];
  const g = this.diagram().M.grid;
  const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
  for (const t of [[c[0] + r, c[1]], [c[0] - r, c[1]], [c[0], c[1] + r], [c[0], c[1] - r]]) {
    if (t[0] < x0 || t[0] > x1 || t[1] < y0 || t[1] > y1) continue;
    if (Math.abs(p.x - t[0]) < 1e-9 && Math.abs(p.y - t[1]) < 1e-9) return true;
    await this.dragPointTo(p, t[0], t[1]);
    const q = this.gridPoints()[0];
    if (q && Math.abs(q.x - t[0]) < 1e-6 && Math.abs(q.y - t[1]) < 1e-6) return true;
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (await this.solveMakeCircle()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// The radius can also be set by a slider rather than a draggable point.
(function () {
  const base = window.__duo.solveMakeCircle;
  window.__duo.solveMakeCircle = async function () {
    const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
    if (!/createacircle|circlewithradius/.test(all)) return false;
    const m = all.match(/radius(-?[\d.]+)/); if (!m) return await base.call(this);
    const r = parseFloat(m[1]);
    const S = this.slider2d();
    if (S && r >= S.s.min && r <= S.s.max) return await this.setSlider2d(r);
    return await base.call(this);
  };
})();
;'__duo ready';

// "Create the circle" given its equation: the slider holds the radius, which is
// sqrt of the right-hand side.
(function () {
  const base = window.__duo.solveMakeCircle;
  window.__duo.solveMakeCircle = async function () {
    const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
    if (/createthecircle|createacircle/.test(all)) {
      const C = this.circleFromEquation();
      const S = this.slider2d();
      if (C && S && C.r >= S.s.min && C.r <= S.s.max) return await this.setSlider2d(C.r);
    }
    return await base.call(this);
  };
})();
;'__duo ready';

// "Select the point on the circle": the point whose distance from the centre
// equals the radius.
window.__duo.solvePointOnCircle = function () {
  if (!/point on the circle/i.test(this.curInstruction())) return null;
  const C = this.currentCircle(); if (!C) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const hits = [];
  ch.forEach((e, i) => { const p = this.choicePair(e); if (!p) return;
    if (Math.abs(Math.hypot(p[0] - C.h, p[1] - C.k) - C.r) < 0.05) hits.push(i); });
  return hits.length === 1 ? { i: hits[0] } : null;
};
window.__duo.RULES.unshift(['solvePointOnCircle', /point on the circle/i]);
;'__duo ready';

// The equation can be written with the terms in either order (y^2 + x^2 = 9),
// which the x-first pattern missed.
window.__duo.circleFromEquation = function () {
  for (const l of this.promptLatex()) {
    const t = this.ascii(l)
      .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
      .replace(/[{}~\\]/g, '').replace(/[−–—]/g, '-').replace(/\s/g, '');
    if (!/=/.test(t)) continue;
    const [lhs, rhs] = t.split('=');
    if (!lhs || !rhs) continue;
    const r2 = parseFloat(rhs);
    if (!isFinite(r2) || r2 <= 0) continue;
    const gx = lhs.match(/\(?x([+-][\d.]+)?\)?\^?2/);
    const gy = lhs.match(/\(?y([+-][\d.]+)?\)?\^?2/);
    if (!gx || !gy) continue;
    const h = gx[1] ? -parseFloat(gx[1]) : 0;
    const k = gy[1] ? -parseFloat(gy[1]) : 0;
    return { h, k, r: Math.sqrt(r2), r2 };
  }
  return null;
};
;'__duo ready';

// Vertex form y = a(x - h)^2 + k  ->  vertex (h, k). Complements the existing
// curve-fitting vertex finder, which needs a drawn parabola.
window.__duo.vertexFromEquation = function () {
  for (const l of this.promptLatex()) {
    const t = this.ascii(l)
      .replace(/\\(mathbf|textbf|text|emphasis|left|right)\b/g, '')
      .replace(/[{}~\\]/g, '').replace(/[−–—]/g, '-').replace(/\s/g, '');
    const m = t.match(/^y=(-?[\d.]*)\(x([+-][\d.]+)\)\^?2([+-][\d.]+)?$/);
    if (m) {
      const h = -parseFloat(m[2]);
      const k = m[3] ? parseFloat(m[3]) : 0;
      return [h, k];
    }
    const n = t.match(/^y=(-?[\d.]*)x\^?2([+-][\d.]+)?$/);
    if (n) return [0, n[2] ? parseFloat(n[2]) : 0];
  }
  return null;
};
(function () {
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    if (/vertex of the parabola|the vertex/i.test(this.curInstruction())) {
      const v = this.vertexFromEquation();
      if (v) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const p = this.choicePair(e);
          return p && Math.abs(p[0] - v[0]) < 1e-9 && Math.abs(p[1] - v[1]) < 1e-9; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /vertex/i]);
})();
;'__duo ready';

// wording varies: "Create a segment of length 5" as well as "with 5 units"
(function () {
  const base = window.__duo.solveSegmentLength;
  window.__duo.solveSegmentLength = async function () {
    const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
    if (!/segment(with|oflength)|createasegment/.test(all)) return await base.call(this);
    const m = all.match(/(?:oflength|with)(-?\d+(?:\.\d+)?)(?:units?)?/) || all.match(/(\d+(?:\.\d+)?)units?/);
    if (!m) return await base.call(this);
    const want = parseFloat(m[1]);
    const pts = this.gridPoints(); if (pts.length !== 2) return await base.call(this);
    const [a, b] = pts;
    if (Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - want) < 1e-9) return false;
    const g = this.diagram().M.grid;
    const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
    const inR = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const cands = [[a.x + want, a.y], [a.x - want, a.y], [a.x, a.y + want], [a.x, a.y - want]];
    for (const t of cands) {
      if (!inR(t[0], t[1])) continue;
      await this.dragPointTo(this.gridPoints()[1], t[0], t[1]);
      const q = this.gridPoints();
      if (q.length === 2 && Math.abs(Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) - want) < 1e-6) return true;
    }
    return false;
  };
})();
;'__duo ready';

// "Select the distance between the points": measure the two plotted points (or
// the pair named in the prompt) and match by VALUE, so radical answers work.
window.__duo.solvePointDistance = function () {
  if (!/distance between/i.test(this.curInstruction())) return null;
  let a = null, b = null;
  const P = this.plottedPoints();
  if (P.length === 2) { a = P[0]; b = P[1]; }
  else { const pp = this.promptPairs(); if (pp.length >= 2) { a = pp[0]; b = pp[1]; } }
  if (!a || !b) return null;
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const v = this.radValue(this.choiceLatex(e));
    return v !== null && Math.abs(v - d) < 1e-6; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solvePointDistance', /distance between/i]);
(function () {
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    if (/distance between/i.test(this.curInstruction())) {
      const P = this.plottedPoints();
      const pp = this.promptPairs();
      const a = P.length === 2 ? P[0] : pp[0], b = P.length === 2 ? P[1] : pp[1];
      if (a && b) { const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return Math.abs(d - Math.round(d)) < 1e-6 ? Math.round(d) : Math.round(d * 100) / 100; }
    }
    return bo.call(this);
  };
})();
;'__duo ready';

// "Create a segment with this length" + a separate "length = 5" line
(function () {
  const base = window.__duo.solveSegmentLength;
  window.__duo.solveSegmentLength = async function () {
    const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
    if (!/createasegment|segment(with|oflength)/.test(all)) return await base.call(this);
    let m = all.match(/length[=:](-?\d+(?:\.\d+)?)/)
         || all.match(/(?:oflength|with)(-?\d+(?:\.\d+)?)/)
         || all.match(/(\d+(?:\.\d+)?)units?/);
    if (!m) return await base.call(this);
    const want = parseFloat(m[1]);
    const pts = this.gridPoints(); if (pts.length !== 2) return await base.call(this);
    const [a] = pts;
    if (Math.abs(Math.hypot(pts[1].x - a.x, pts[1].y - a.y) - want) < 1e-9) return false;
    const g = this.diagram().M.grid;
    const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
    const inR = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    for (const t of [[a.x + want, a.y], [a.x - want, a.y], [a.x, a.y + want], [a.x, a.y - want]]) {
      if (!inR(t[0], t[1])) continue;
      await this.dragPointTo(this.gridPoints()[1], t[0], t[1]);
      const q = this.gridPoints();
      if (q.length === 2 && Math.abs(Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) - want) < 1e-6) return true;
    }
    return false;
  };
})();
;'__duo ready';

// A long segment may not fit from the existing anchor (length 7 on a -5..5
// grid), so move BOTH endpoints: search the grid for any pair at the required
// distance, preferring the smallest total movement.
(function () {
  const base = window.__duo.solveSegmentLength;
  window.__duo.solveSegmentLength = async function () {
    if (await base.call(this)) return true;
    const all = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '').toLowerCase();
    if (!/createasegment|segment(with|oflength)/.test(all)) return false;
    const m = all.match(/length[=:](-?\d+(?:\.\d+)?)/) || all.match(/(?:oflength|with)(-?\d+(?:\.\d+)?)/);
    if (!m) return false;
    const want = parseFloat(m[1]);
    const pts = this.gridPoints(); if (pts.length !== 2) return false;
    if (Math.abs(Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) - want) < 1e-9) return false;
    const g = this.diagram().M.grid;
    const [x0, x1] = g.xRange || [-10, 10], [y0, y1] = g.yRange || [-10, 10];
    let best = null, bestCost = Infinity;
    for (let ax = x0; ax <= x1; ax++) for (let ay = y0; ay <= y1; ay++)
      for (const [dx, dy] of [[want, 0], [-want, 0], [0, want], [0, -want]]) {
        const bx = ax + dx, by = ay + dy;
        if (bx < x0 || bx > x1 || by < y0 || by > y1) continue;
        const cost = Math.hypot(ax - pts[0].x, ay - pts[0].y) + Math.hypot(bx - pts[1].x, by - pts[1].y);
        if (cost < bestCost) { bestCost = cost; best = [[ax, ay], [bx, by]]; }
      }
    if (!best) return false;
    for (let i = 0; i < 2; i++) {
      const p = this.gridPoints()[i]; if (!p) return false;
      if (Math.abs(p.x - best[i][0]) < 1e-9 && Math.abs(p.y - best[i][1]) < 1e-9) continue;
      await this.dragPointTo(p, best[i][0], best[i][1]);
    }
    const q = this.gridPoints();
    return q.length === 2 && Math.abs(Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) - want) < 1e-6;
  };
})();
;'__duo ready';

// Partitioning a segment in a ratio a:b — the point sits a/(a+b) of the way
// along, so "the fraction for a 3:1 ratio" is 3/4.
window.__duo.ratioFraction = function () {
  const t = this.mathParts().concat([this.curInstruction()]).join(' ').replace(/\s/g, '');
  const m = t.match(/(\d+)[:.](\d+)ratio/i) || t.match(/ratioof(\d+)[:.](\d+)/i);
  if (!m) return null;
  const a = parseFloat(m[1]), b = parseFloat(m[2]);
  return (a + b) ? a / (a + b) : null;
};
window.__duo.solveRatioFraction = function () {
  const v = this.ratioFraction(); if (v === null) return null;
  if (!/fraction|ratio/i.test(this.curInstruction())) return null;
  const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
  const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-9; });
  return i < 0 ? null : { i };
};
window.__duo.RULES.unshift(['solveRatioFraction', /ratio|fraction/i]);
;'__duo ready';

// Unit 197: solids. "base area = <slider> * 5" style templates — solve for the
// slider so the stated target is met (reuses the sum-slider idea for products).
window.__duo.solveTargetSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  const raw = this.promptLatex().find(l => /duodisplay/.test(this.ascii(l)));
  if (!raw) return false;
  // the target: a number stated in the title ("Make the base area 30")
  let target = null, byPi = false;
  const parts = this.mathParts().concat([this.promptTitle()]);
  const asks = parts.some(t => /make|create|build/i.test(String(t)));
  for (const t of parts) {
    const f = String(t).replace(/\s/g, '');
    // the number may live in its own emphasised part, away from "Create a ..."
    // "Create f(1) = 2" puts punctuation between the verb and the target
    const m = f.match(/(?:make|create|build)[^=]*?=?\s*(-?\d+(?:\.\d+)?)(pi)?$/i)
           || (asks ? f.match(/^(-?\d+(?:\.\d+)?)(pi)?$/i) : null);
    if (m) { target = parseFloat(m[1]); byPi = !!m[2]; break; }
  }
  if (target === null) return false;
  for (let v = S.s.min; v <= S.s.max; v += S.s.step) {
    const expr = this.ascii(raw)
      .replace(/\\duodisplay\{[^{}]*\}\{[^{}]*\}/g, '(' + v + ')')
      // \frac{1}{3} must become (1)/(3) BEFORE braces are stripped
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
      .replace(/\\(mathbf|textbf|text)\b/g, '')
      .replace(/\\cdot|\\times/g, '*')
      // "16\pi" vs "\pi r^2": pi cancels on both sides, so drop it.
      .replace(/\\pi/g, byPi ? '' : '(3.141592653589793)')
      .replace(/[{}\s\\]/g, '')
      .split('=').pop();
    const g = this.compile(expr); if (!g) continue;
    let out; try { out = g(0); } catch (e) { continue; }
    if (isFinite(out) && Math.abs(out - target) < 1e-9) return await this.setSlider2d(v);
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveTargetSlider()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "Create a rectangular prism with height = 4": the stated quantity IS the
// slider value, written with "=" rather than "set ... to".
(function () {
  const base = window.__duo.solveSetSlider;
  window.__duo.solveSetSlider = async function () {
    if (await base.call(this)) return true;
    const S = this.slider2d(); if (!S) return false;
    const parts = this.mathParts();
    for (const t of parts) {
      const m = String(t).replace(/\s/g, '')
        .match(/^(?:height|width|length|base|radius|depth|side)[=:](-?\d+(?:\.\d+)?)$/i);
      if (!m) continue;
      const v = parseFloat(m[1]);
      if (v < S.s.min || v > S.s.max) continue;
      return await this.setSlider2d(v);
    }
    return false;
  };
})();
;'__duo ready';

// "Create a rectangular prism with volume = 16": one slider controls a
// dimension. The diagram labels every edge, so drop the labels equal to the
// slider's current value and the rest are the fixed dimensions.
window.__duo.solveVolumeSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  let target = null;
  for (const t of this.mathParts()) {
    const m = String(t).replace(/\s/g, '').match(/^(volume|area|surfacearea)[=:](-?\d+(?:\.\d+)?)$/i);
    if (m) { target = parseFloat(m[2]); break; }
  }
  if (target === null) return false;
  const cur = this.sliderValue(); if (cur === null) return false;
  const labs = (this.diagramLabels() || [])
    .filter(l => /^-?\d+(\.\d+)?$/.test(l.t.trim())).map(l => parseFloat(l.t));
  if (labs.length < 2) return false;
  const tri = /triangular/i.test(this.promptTitle() + ' ' + this.curInstruction());
  // Don't guess which label the slider drives: try every legal value, swap it
  // in for the labels currently showing `cur`, and keep the one that fits.
  // A prism labels some edges twice, so don't dedup by value: try every
  // 3-subset of the labels and let the target pick the right one.
  // Only ONE label is slider-driven even when several currently read `cur`,
  // so substitute a single occurrence at a time.
  const swaps = [];
  labs.forEach((x, k) => { if (Math.abs(x - cur) < 1e-9) swaps.push(k); });
  for (let v = S.s.min; v <= S.s.max + 1e-9; v += S.s.step)
   for (const k of swaps) {
    const L = labs.map((x, j) => j === k ? v : x);
    for (let a = 0; a < L.length; a++)
      for (let b = a + 1; b < L.length; b++)
        for (let c = b + 1; c < L.length; c++) {
          let vol = L[a] * L[b] * L[c];
          if (tri) vol /= 2;
          if (Math.abs(vol - target) < 1e-9) return await this.setSlider2d(v);
        }
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveVolumeSlider()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "Select the volume of the rectangular prism": multiply the three distinct
// edge labels (each edge length appears once per visible face).
window.__duo.prismDimensions = function () {
  const labs = (this.diagramLabels() || [])
    .filter(l => /^-?\d+(\.\d+)?$/.test(l.t.trim())).map(l => parseFloat(l.t));
  if (labs.length < 3) return null;
  const counts = {};
  for (const v of labs) counts[v] = (counts[v] || 0) + 1;
  const uniq = Object.keys(counts).map(Number);
  if (uniq.length === 3) return uniq;
  if (uniq.length === 2) {
    // a repeated dimension: the one appearing more often is used twice
    const [a, b] = uniq;
    return counts[a] > counts[b] ? [a, a, b] : [a, b, b];
  }
  if (uniq.length === 1) return [uniq[0], uniq[0], uniq[0]];
  return null;
};
(function () {
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = this.curInstruction();
    if (/volume of/i.test(ins)) {
      const D = this.prismDimensions();
      if (D) {
        const v = D.reduce((a, b) => a * b, 1);
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-9; });
        if (i >= 0) return { i };
      }
    }
    if (/surface area of/i.test(ins)) {
      const D = this.prismDimensions();
      if (D && D.length === 3) {
        const [a, b, c] = D;
        const v = 2 * (a * b + b * c + a * c);
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => { const q = this.choiceValue(e); return q !== null && Math.abs(q - v) < 1e-9; });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
  const bo = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = this.curInstruction();
    const D = this.prismDimensions();
    if (D) {
      if (/volume/i.test(ins)) return D.reduce((a, b) => a * b, 1);
      if (/surface area/i.test(ins) && D.length === 3) {
        const [a, b, c] = D; return 2 * (a * b + b * c + a * c);
      }
    }
    return bo.call(this);
  };
  window.__duo.RULES.unshift(['solveTransformedValue', /volume|surface area/i]);
})();
;'__duo ready';

// Match each numeric diagram label to the edge it annotates, so "height" vs
// "base" is read off the drawing instead of guessed from label order.
window.__duo.labeledEdges = function () {
  const f = this.visibleFrame(); if (!f) return null;
  const doc = f.contentDocument; if (!doc) return null;
  // diagramLabels() reports FRAME-LOCAL rects, so keep segments frame-local too.
  const segs = [];
  // SVG point coords are USER units; map them with getScreenCTM, never by
  // adding the svg's bounding rect (that ignores the viewBox scale).
  for (const el of doc.querySelectorAll('svg path,svg line,svg polygon,svg polyline')) {
    const svg = el.ownerSVGElement; if (!svg) continue;
    const m = svg.getScreenCTM(); if (!m) continue;
    const map = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
    let pts = [];
    if (el.tagName === 'line') {
      pts = [[+el.getAttribute('x1'), +el.getAttribute('y1')],
             [+el.getAttribute('x2'), +el.getAttribute('y2')]];
    } else if (el.getTotalLength) {
      const L = el.getTotalLength(); if (!L) continue;
      const n = Math.min(60, Math.max(8, Math.round(L / 6)));
      for (let i = 0; i <= n; i++) { const p = el.getPointAtLength(L * i / n); pts.push([p.x, p.y]); }
    }
    for (let i = 1; i < pts.length; i++) {
      const A = map(pts[i - 1][0], pts[i - 1][1]), B = map(pts[i][0], pts[i][1]);
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      if (len < 4) continue;
      segs.push({ mx: (A.x + B.x) / 2, my: (A.y + B.y) / 2,
                  dx: B.x - A.x, dy: B.y - A.y, len });
    }
  }
  if (!segs.length) return null;
  const out = [];
  for (const l of this.diagramLabels() || []) {
    if (!/^-?\d+(\.\d+)?$/.test(l.t.trim())) continue;
    let best = null, bd = Infinity;
    for (const s of segs) { const d = Math.hypot(s.mx - l.x, s.my - l.y); if (d < bd) { bd = d; best = s; } }
    if (!best) continue;
    const ang = Math.abs(Math.atan2(best.dy, best.dx) * 180 / Math.PI);
    out.push({ v: parseFloat(l.t), vertical: Math.min(ang, 180 - ang) > 60, dist: bd });
  }
  return out.length ? out : null;
};

// Guided prism steps: "enter the area of the bottom base" / "the height" /
// "the volume". The vertical edge is the height; the rest form the base.
(function () {
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = String(this.curInstruction() || '');
    if (/\b(base|height|volume)\b/i.test(ins)) {
      const E = this.labeledEdges();
      if (E && E.length >= 2) {
        const h = E.filter(e => e.vertical).map(e => e.v);
        const b = E.filter(e => !e.vertical).map(e => e.v);
        const areaOf = a => a.length >= 2 ? a.slice(0, 2).reduce((x, y) => x * y, 1) : null;
        if (/area of the .*base|base area/i.test(ins)) {
          const A = areaOf(b); if (A !== null) return /triangular/i.test(ins) ? A / 2 : A;
        }
        if (/\bheight\b/i.test(ins) && h.length === 1) return h[0];
        if (/\bvolume\b/i.test(ins) && h.length === 1) {
          const A = areaOf(b);
          if (A !== null) return (/triangular/i.test(ins) ? A / 2 : A) * h[0];
        }
      }
    }
    return base.call(this);
  };
})();
;'__duo ready';

// Volume/area questions sometimes offer LaTeX EXPRESSIONS as choices
// ("\frac{1}{2}\cdot4\cdot3\cdot2") rather than numbers.
(function () {
  const be = window.__duo.evalTrigExpr;
  window.__duo.evalTrigExpr = function (t) {
    return be.call(this, String(t == null ? '' : t)
      .replace(/\\(cdot|times)/g, '*').replace(/\\left|\\right/g, ''));
  };
  const bc = window.__duo.choiceValue;
  window.__duo.choiceValue = function (el) {
    const v = bc.call(this, el);
    if (v !== null && v !== undefined) return v;
    const a = el && el.querySelector('annotation');
    const raw = a ? a.textContent : ((el && el.textContent) || '');
    if (!/\\(cdot|times|frac)/.test(raw)) return v;
    const e = this.evalTrigExpr(raw);
    return (typeof e === 'number' && isFinite(e)) ? e : v;
  };
})();
;'__duo ready';

// "Select the volume of the triangular prism" — the earlier prismDimensions()
// path only handles rectangular solids and numeric choices.
(function () {
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '');
    if (/volume of/i.test(ins)) {
      const E = this.labeledEdges();
      if (E && E.length >= 3) {
        const labs = E.map(e => e.v);
        const tri = /triangular/i.test(ins + ' ' + this.promptTitle());
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const vals = ch.map(e => this.choiceValue(e));
        for (let a = 0; a < labs.length; a++)
          for (let b = a + 1; b < labs.length; b++)
            for (let c = b + 1; c < labs.length; c++) {
              const v = labs[a] * labs[b] * labs[c] / (tri ? 2 : 1);
              const i = vals.findIndex(q => q !== null && q !== undefined && Math.abs(q - v) < 1e-9);
              if (i >= 0) return { i };
            }
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// Guided solid steps state the target volume; when they do, prefer arithmetic
// over guessing which labelled edges form the base.
(function () {
  const statedVolume = function () {
    for (const t of this.mathParts()) {
      const m = String(t).replace(/\s/g, '').match(/^volume[=:](-?\d+(?:\.\d+)?)$/i);
      if (m) return parseFloat(m[1]);
    }
    return null;
  };
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = String(this.curInstruction() || '');
    const V = statedVolume.call(this);
    const E = this.labeledEdges();
    if (V !== null && E) {
      const h = E.filter(e => e.vertical).map(e => e.v);
      if (h.length === 1) {
        if (/area of the .*base|base area/i.test(ins)) return V / h[0];
        if (/\bheight\b/i.test(ins)) return h[0];
      }
    }
    return base.call(this);
  };
})();
;'__duo ready';

// "Select the cross section parallel/perpendicular to the base" — the answer is
// determined by the solid plus the slice direction, nothing in the drawing.
(function () {
  const TABLE = {
    cylinder:   { par: 'circle',    perp: 'rectangle' },
    cone:       { par: 'circle',    perp: 'triangle' },
    sphere:     { par: 'circle',    perp: 'circle' },
    triangular: { par: 'triangle',  perp: 'rectangle' },
    rectangular:{ par: 'rectangle', perp: 'rectangle' },
    cube:       { par: 'square',    perp: 'square' },
    pyramid:    { par: 'square',    perp: 'triangle' },
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '');
    // "select the base of the cylinder net" wants the same shape as a slice
    // parallel to the base.
    if (/cross section/i.test(ins) || /\bbase of the .*net\b/i.test(ins)) {
      const hay = (ins + ' ' + this.promptTitle() + ' ' +
        (document.querySelector('[data-test^="challenge "]') || {}).innerText || '').toLowerCase();
      let key = Object.keys(TABLE).find(k => hay.includes(k));
      // The solid is usually only drawn, never named: a curved outline means a
      // round solid, and both cylinder and cone slice parallel to a circle.
      if (!key) {
        const f = this.visibleFrame(), d = f && f.contentDocument;
        const paths = d ? [...d.querySelectorAll('svg path')] : [];
        const big = paths.filter(p => { const b = p.getBBox ? p.getBBox() : null; return b && b.width > 60 && b.height > 60; });
        if (big.some(p => /[CcAaSsQq]/.test(p.getAttribute('d') || ''))) key = 'cylinder';
      }
      if (key) {
        const want = TABLE[key][/perpendicular/i.test(ins) ? 'perp' : 'par'];
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => this.half(e.innerText).trim().toLowerCase() === want);
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// "Create a cylinder with volume = 12\pi": V = pi r^2 h, and the horizontal
// label may be either the radius or the diameter, so try both.
window.__duo.solveCylinderSlider = async function () {
  const S = this.slider2d(); if (!S) return false;
  const hay = (this.promptTitle() + ' ' + this.curInstruction()).toLowerCase();
  if (!/cylinder|cone|sphere/.test(hay)) return false;
  const m = this.promptLatex().join(' ').replace(/\s/g, '')
    .match(/(volume|basearea)\}?=\\?[a-z]*\{?(-?\d+(?:\.\d+)?)\\pi/i);
  if (!m) return false;
  const target = parseFloat(m[2]);          // in units of pi
  const third = /cone/.test(hay) ? 3 : 1;
  const cur = this.sliderValue(); if (cur === null) return false;
  if (/sphere/.test(hay)) {
    for (let v = S.s.min; v <= S.s.max + 1e-9; v += S.s.step)
      for (const rr of [v, v / 2])
        if (Math.abs(4 / 3 * rr * rr * rr - target) < 1e-9) return await this.setSlider2d(v);
    return false;
  }
  const E = (this.labeledEdges() || []).filter(e => e.dist < 40);
  if (E.length < 2) return false;
  for (let v = S.s.min; v <= S.s.max + 1e-9; v += S.s.step) {
    for (let k = 0; k < E.length; k++) {
      if (Math.abs(E[k].v - cur) > 1e-9) continue;
      const L = E.map((e, j) => ({ v: j === k ? v : e.v, vertical: e.vertical }));
      const h = L.filter(e => e.vertical).map(e => e.v);
      const r = L.filter(e => !e.vertical).map(e => e.v);
      if (h.length !== 1 || !r.length) continue;
      for (const rr of [r[0], r[0] / 2])
        if (Math.abs(rr * rr * h[0] / third - target) < 1e-9) return await this.setSlider2d(v);
    }
  }
  return false;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (this.slider2d() && await this.solveCylinderSlider()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// Guided solid steps print the whole equation ("81\pi = \pi\cdot r^2\cdot 1",
// "V = \pi\cdot 5^2\cdot 3"). Solve it by trying each choice in the unknown's
// place; pi is set to 1 on BOTH sides so "25\pi" choices compare cleanly.
(function () {
  const prep = t => String(t)
    .replace(/\\(mathbf|textbf|text|emphasis|displaystyle)\b/g, '')
    .replace(/\\(cdot|times)/g, '*').replace(/\\left|\\right/g, '')
    .replace(/\\pi/g, '*1').replace(/[{}]/g, '').replace(/\s/g, '')
    .replace(/(^|[=(*+\-/])\*+/g, '$1');
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '');
    if (/^select the (radius|height|volume|diameter|base area|area)/i.test(ins)) {
      const line = this.promptLatex().filter(l => /=/.test(l)).pop();
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      if (line && ch.length) {
        const eq = prep(line);
        const vals = ch.map(e => {
          const a = e.querySelector('annotation');
          const n = this.compile(prep(a ? a.textContent : e.innerText));
          try { return n ? n(0) : null; } catch (x) { return null; }
        });
        const [lhs, rhs] = eq.split('=');
        const unk = (eq.match(/[a-zA-Z]/g) || []).find(c => c !== 'e');
        if (unk) {
          for (let i = 0; i < vals.length; i++) {
            if (vals[i] === null) continue;
            const sub = s => s.replace(new RegExp(unk, 'g'), '(' + vals[i] + ')');
            const L = this.compile(sub(lhs)), R = this.compile(sub(rhs));
            try { if (L && R && Math.abs(L(0) - R(0)) < 1e-9) return { i }; } catch (x) {}
          }
        } else if (rhs) {
          const R = this.compile(rhs);
          try {
            const want = R(0);
            const i = vals.findIndex(v => v !== null && Math.abs(v - want) < 1e-9);
            if (i >= 0) return { i };
          } catch (x) {}
        }
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// Choice innerText is doubled ("kitekite"); several solvers need this.
window.__duo.half = function (s) {
  const t = String(s == null ? '' : s).replace(/\s/g, '');
  return (t.length % 2 === 0 && t.slice(0, t.length / 2) === t.slice(t.length / 2))
    ? t.slice(0, t.length / 2) : t;
};
;'__duo ready';

// Typed guided steps print the equation with the answer blanked:
// "7\pi = \pi\cdot\duoblank{1}^2\cdot 7". Solve for the blank numerically.
(function () {
  const prep = t => String(t)
    .replace(/\\(mathbf|textbf|text|emphasis|displaystyle)\b/g, '')
    .replace(/\\(cdot|times)/g, '*').replace(/\\left|\\right/g, '')
    .replace(/\\duoblank\{[^{}]*\}/g, 'x').replace(/\\pi/g, '*1')
    .replace(/[{}]/g, '').replace(/\s/g, '')
    // "\pi\cdot r" leaves a leading "*"; drop operators stranded at a boundary
    .replace(/(^|[=(*+\-/])\*+/g, '$1');
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const line = this.promptLatex().find(l => /duoblank/.test(l) && /=/.test(l));
    if (line) {
      const [ls, rs] = prep(line).split('=');
      const L = this.compile(ls), R = this.compile(rs);
      if (L && R) {
        const f = x => { try { return L(x) - R(x); } catch (e) { return NaN; } };
        // lengths are positive and usually small; scan then bisect
        let a = null;
        for (let x = 0.0625; x <= 400; x += 0.0625) {
          const v = f(x);
          if (!isFinite(v)) continue;
          if (Math.abs(v) < 1e-9) { a = x; break; }
          const p = f(x - 0.0625);
          if (isFinite(p) && p * v < 0) {
            let lo = x - 0.0625, hi = x;
            for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; (f(lo) * f(m) <= 0) ? hi = m : lo = m; }
            a = (lo + hi) / 2; break;
          }
        }
        if (a !== null) return Math.abs(a - Math.round(a)) < 1e-6 ? Math.round(a) : a;
      }
    }
    return base.call(this);
  };
})();
;'__duo ready';

// "Select the area of the lateral face of the cylinder": 2*pi*r*h, offered as
// LaTeX expressions. Compare with pi set to 1 on both sides.
(function () {
  const prep = t => String(t)
    .replace(/\\(mathbf|textbf|text|emphasis|displaystyle)\b/g, '')
    .replace(/\\(cdot|times)/g, '*').replace(/\\left|\\right/g, '')
    .replace(/\\pi/g, '*1').replace(/[{}]/g, '').replace(/\s/g, '')
    .replace(/(^|[=(*+\-/])\*+/g, '$1')
    .replace(/(\d)\(/g, '$1*(').replace(/\)(\d|\()/g, ')*$1');
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '');
    if (/lateral|surface area/i.test(ins)) {
      const E = (this.labeledEdges() || []).filter(e => e.dist < 40);
      const h = E.filter(e => e.vertical).map(e => e.v);
      const r = E.filter(e => !e.vertical).map(e => e.v);
      if (h.length === 1 && r.length) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const vals = ch.map(e => {
          const a = e.querySelector('annotation');
          const g = this.compile(prep(a ? a.textContent : e.innerText));
          try { return g ? g(0) : null; } catch (x) { return null; }
        });
        // "total surface area" must beat the lateral-only distractor, so try
        // the total first whenever the prompt is not explicitly lateral.
        const lateralOnly = /lateral/i.test(ins);
        const wants = [];
        for (const rr of [r[0], r[0] / 2]) {
          const lat = 2 * rr * h[0], tot = lat + 2 * rr * rr;
          wants.push(lateralOnly ? lat : tot);
        }
        for (const rr of [r[0], r[0] / 2]) {
          const lat = 2 * rr * h[0], tot = lat + 2 * rr * rr;
          wants.push(lateralOnly ? tot : lat);
        }
        for (const w of wants) {
          const i = vals.findIndex(v => v !== null && Math.abs(v - w) < 1e-9);
          if (i >= 0) return { i };
        }
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// "Select the volume" of a drawn cylinder/cone with pi-form numeric choices.
(function () {
  const prep = t => String(t)
    .replace(/\\(mathbf|textbf|text|emphasis|displaystyle)\b/g, '')
    .replace(/\\(cdot|times)/g, '*').replace(/\\left|\\right/g, '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/\\pi/g, '*1').replace(/[{}]/g, '').replace(/\s/g, '')
    .replace(/(^|[=(*+\-/])\*+/g, '$1')
    .replace(/(\d)\(/g, '$1*(').replace(/\)(\d|\()/g, ')*$1');
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '');
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (/\bvolume\b/i.test(ins) && ch.length) {
      const E = (this.labeledEdges() || []).filter(e => e.dist < 40);
      const h = E.filter(e => e.vertical).map(e => e.v);
      const r = E.filter(e => !e.vertical).map(e => e.v);
      const hay0 = (ins + ' ' + this.promptTitle()).toLowerCase();
      const val = e => {
        const a = e.querySelector('annotation');
        const g = this.compile(prep(a ? a.textContent : e.innerText));
        try { return g ? g(0) : null; } catch (x) { return null; }
      };
      // a sphere has one labelled radius and no height to separate out
      // The solid is often never named: one labelled edge (a radius) and no
      // second dimension means a sphere.
      if ((/sphere/.test(hay0) || E.length === 1) && E.length) {
        const vals = ch.map(val);
        for (const rr of [E[0].v, E[0].v / 2]) {
          const w = 4 / 3 * rr * rr * rr;
          const i = vals.findIndex(v => v !== null && Math.abs(v - w) < 1e-9);
          if (i >= 0) return { i };
        }
      }
      if (h.length === 1 && r.length) {
        const vals = ch.map(val);
        const hay = hay0;
        const thirds = /cone/.test(hay) ? [3] : /cylinder/.test(hay) ? [1] : [1, 3];
        for (const d of thirds)
          for (const rr of [r[0], r[0] / 2]) {
            const w = rr * rr * h[0] / d;
            const i = vals.findIndex(v => v !== null && Math.abs(v - w) < 1e-9);
            if (i >= 0) return { i };
          }
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// "Select the y-intercept" / "x-intercept" offered as coordinate pairs: the
// intercept must sit on the right axis AND inside the drawn axis range, which
// is usually enough to leave exactly one choice.
(function () {
  const axisRange = function () {
    const n = (this.diagramLabels() || [])
      .map(l => parseFloat(String(l.t).replace(/[−–—]/g, '-')))
      .filter(v => isFinite(v));
    return n.length ? Math.max(...n.map(Math.abs)) : null;
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '');
    const m = ins.match(/\b([xy])\s*-?\s*intercept/i);
    if (m) {
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      const pairs = ch.map(e => {
        const t = this.half(e.innerText).replace(/[−–—]/g, '-').match(/\((-?[\d.]+),(-?[\d.]+)\)/);
        return t ? [parseFloat(t[1]), parseFloat(t[2])] : null;
      });
      if (pairs.some(Boolean)) {
        const zeroAt = m[1].toLowerCase() === 'y' ? 0 : 1;   // y-intercept has x=0
        const R = axisRange.call(this);
        const ok = pairs.map(p => p && Math.abs(p[zeroAt]) < 1e-9 &&
          (R === null || Math.abs(p[1 - zeroAt]) <= R + 1e-9));
        if (ok.filter(Boolean).length === 1) return { i: ok.indexOf(true) };
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// Sample the drawn curve in grid coordinates: the basis for reading roots,
// intercepts and turning points off a graph.
window.__duo.curveXY = function () {
  const g = this.grid2D(); if (!g) return null;
  const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
  let best = null, bl = 0;
  for (const p of d.querySelectorAll('svg path')) {
    if (!p.getTotalLength) continue;
    const L = p.getTotalLength();
    const b = p.getBBox ? p.getBBox() : null;
    if (!b || b.width < 40) continue;          // skip ticks, arrows, gridlines
    if (L > bl) { bl = L; best = p; }
  }
  if (!best) return null;
  const m = best.ownerSVGElement.getScreenCTM(); if (!m) return null;
  const out = [];
  const n = Math.min(400, Math.max(60, Math.round(bl / 3)));
  for (let i = 0; i <= n; i++) {
    const q = best.getPointAtLength(bl * i / n);
    const X = m.a * q.x + m.c * q.y + m.e + fr.left, Y = m.b * q.x + m.d * q.y + m.f + fr.top;
    out.push(g.toXY(X, Y));
  }
  return out;
};

// x-values where the drawn curve crosses y = 0.
window.__duo.curveRoots = function () {
  const pts = this.curveXY(); if (!pts || pts.length < 3) return null;
  const roots = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (!isFinite(y0) || !isFinite(y1)) continue;
    if (y0 === 0) roots.push(x0);
    else if (y0 * y1 < 0) roots.push(x0 + (x1 - x0) * (-y0) / (y1 - y0));
  }
  // the sampled path may double back, so collapse near-duplicates
  roots.sort((a, b) => a - b);
  return roots.filter((r, i) => i === 0 || Math.abs(r - roots[i - 1]) > 0.25);
};

(function () {
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '');
    if (/x\s*-?\s*intercepts?\b/i.test(ins)) {
      const R = this.curveRoots();
      if (R && R.length) {
        const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const i = ch.findIndex(e => {
          const nums = [...this.half(e.innerText).replace(/[−–—]/g, '-')
            .matchAll(/\((-?[\d.]+),(-?[\d.]+)\)/g)];
          if (nums.length !== R.length) return false;
          return nums.every((mm, k) => Math.abs(parseFloat(mm[2])) < 1e-9 &&
            Math.abs(parseFloat(mm[1]) - R[k]) < 0.35);
        });
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// "Match the pairs": eight tap tokens, four expressions and their four values.
// These are timed, so pair everything by value in one pass and click straight
// through instead of round-tripping per tile.
window.__duo.solveMatchPairs = async function () {
  const tiles = [...document.querySelectorAll('[data-test$="-token"]')]
    .filter(b => b.querySelector('annotation'));
  if (tiles.length < 4) return false;
  const prep = t => String(t)
    .replace(/\\(mathbf|textbf|text|emphasis|displaystyle)\b/g, '')
    .replace(/\\(cdot|times)/g, '*').replace(/\\left|\\right/g, '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/\\pi/g, '*1').replace(/[{}]/g, '').replace(/\s/g, '')
    .replace(/(^|[=(*+\-/])\*+/g, '$1');
  // Pairs are often symbolic (factored vs expanded), which is identical at
  // x=0, so fingerprint each tile over several sample points.
  const XS = [0.7314, 1.3121, -2.1137, 3.4271];
  const vals = tiles.map(b => {
    const g = this.compile(prep(b.querySelector('annotation').textContent));
    if (!g) return null;
    try {
      const v = XS.map(x => g(x));
      return v.every(n => isFinite(n)) ? v : null;
    } catch (e) { return null; }
  });
  const same = (a, b) => a && b && a.every((n, k) =>
    Math.abs(n - b[k]) <= 1e-7 * Math.max(1, Math.abs(n), Math.abs(b[k])));
  const used = new Array(tiles.length).fill(false);
  let clicked = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (used[i] || vals[i] === null) continue;
    const j = vals.findIndex((v, k) => k > i && !used[k] && same(v, vals[i]));
    if (j < 0) continue;
    used[i] = used[j] = true;
    // React ignores el.click() on these; it needs the pointer sequence
    for (const el of [tiles[i], tiles[j]]) {
      const r = el.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, composed: true, view: window,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 }, o)));
      el.dispatchEvent(new MouseEvent('mousedown', Object.assign({ buttons: 1 }, o)));
      el.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 }, o)));
      el.dispatchEvent(new MouseEvent('mouseup', Object.assign({ buttons: 0 }, o)));
      el.dispatchEvent(new MouseEvent('click', Object.assign({ buttons: 0 }, o)));
      await new Promise(r2 => setTimeout(r2, 60));
    }
    clicked++;
    await new Promise(r => setTimeout(r, 120));
  }
  return clicked > 0;
};
(function () {
  const base = window.__duo.autoDrag;
  window.__duo.autoDrag = async function () {
    if (/match the pairs/i.test(this.curInstruction() || '') && await this.solveMatchPairs()) return true;
    return await base.call(this);
  };
})();
;'__duo ready';

// "Select the input when f(x) = 2" — the inverse read: find x on the drawn
// curve where y hits the stated output. (And the forward read, f(a) = ?)
(function () {
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '').replace(/[−–—]/g, '-');
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const m = ins.match(/input.*f\s*\(\s*x\s*\)\s*=\s*(-?[\d.]+)/i);
    if (m && ch.length) {
      const want = parseFloat(m[1]);
      const pts = this.curveXY();
      if (pts && pts.length > 2) {
        const hits = [];
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          if (!isFinite(y0) || !isFinite(y1)) continue;
          if ((y0 - want) * (y1 - want) <= 0 && y0 !== y1)
            hits.push(x0 + (x1 - x0) * (want - y0) / (y1 - y0));
        }
        if (hits.length) {
          const i = ch.findIndex(e => {
            const v = parseFloat(this.half(e.innerText).replace(/[−–—]/g, '-'));
            return isFinite(v) && hits.some(h => Math.abs(h - v) < 0.35);
          });
          if (i >= 0) return { i };
        }
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// "Select the match" against a polynomial: the choices name its degree, or its
// family (linear / quadratic / cubic / rational).
(function () {
  const NAMED = { constant: 0, linear: 1, quadratic: 2, cubic: 3, quartic: 4 };
  const degreeOf = function (tex) {
    const s = String(tex).replace(/\\(mathbf|textbf|text|displaystyle)\b/g, '')
      .replace(/[{}\s]/g, '');
    if (/\\frac\{?[^}]*[a-z]/.test(String(tex)) || /\/[a-z]/.test(s)) return null; // rational
    let d = 0;
    for (const m of s.matchAll(/[a-z](\^(-?\d+))?/g)) d = Math.max(d, m[2] ? parseInt(m[2]) : 1);
    return d;
  };
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '');
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (/select the match|degree/i.test(ins) && ch.length) {
      const texts = ch.map(e => this.half(e.innerText).toLowerCase());
      const tex = this.promptLatex().filter(l => !/textbf\{Select/i.test(l)).pop();
      // "Select the degree" offers bare numbers; "select the match" spells
      // out "degree 3" or names the family.
      const bare = /\bdegree\b/i.test(ins) && texts.every(t => /^-?\d+$/.test(t));
      if (tex && (bare || texts.every(t => /^degree-?\d+$/.test(t) || t in NAMED))) {
        const d = degreeOf(tex);
        if (d !== null) {
          const i = texts.findIndex(t => {
            const m = t.match(/^degree(-?\d+)$/) || t.match(/^(-?\d+)$/);
            return m ? parseInt(m[1]) === d : NAMED[t] === d;
          });
          if (i >= 0) return { i };
        }
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// Plotted points that aren't draggable live in the static-points group, so
// gridPoints() never sees them.
window.__duo.staticPoints = function () {
  const g = this.grid2D(); if (!g) return null;
  const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
  const out = [];
  for (const grp of d.querySelectorAll('.static-points > *')) {
    const r = grp.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    out.push(g.toXY(fr.left + r.left + r.width / 2, fr.top + r.top + r.height / 2)
      .map(v => Math.abs(v - Math.round(v)) < 0.2 ? Math.round(v) : v));
  }
  return out.length ? out : null;
};

// "Find the run/rise from the left point to the right point": read both plotted
// points and subtract, always left-to-right so the run stays positive.
(function () {
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const ins = String(this.curInstruction() || '');
    if (/\b(run|rise|slope)\b/i.test(ins) && /point/i.test(ins)) {
      const raw = (this.gridPoints() || []).length ? this.gridPoints() : (this.staticPoints() || []);
      const pts = raw.map(p => Array.isArray(p) ? p : [p.x, p.y])
        .filter(p => isFinite(p[0]) && isFinite(p[1]))
        .sort((a, b) => a[0] - b[0]);
      if (pts.length >= 2) {
        const A = pts[0], B = pts[pts.length - 1];
        const run = B[0] - A[0], rise = B[1] - A[1];
        if (/\brun\b/i.test(ins)) return run;
        if (/\brise\b/i.test(ins)) return rise;
        if (run) return rise / run;
      }
    }
    return base.call(this);
  };
})();
;'__duo ready';

// "Select the equation using the slope and y-intercept": fit the line through
// the two plotted points, then keep the choice that agrees at sample x values.
(function () {
  const prep = t => String(t)
    .replace(/\\(mathbf|textbf|text|emphasis|displaystyle)\b/g, '')
    .replace(/\\(cdot|times)/g, '*').replace(/\\left|\\right/g, '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    .replace(/[{}]/g, '').replace(/\s/g, '').replace(/[−–—]/g, '-')
    .replace(/^[a-z]\(x\)=|^y=/i, '');
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ins = String(this.curInstruction() || '');
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (/equation/i.test(ins) && ch.length) {
      let pts = (this.gridPoints() || []).map(p => Array.isArray(p) ? p : [p.x, p.y]);
      if (pts.length < 2) pts = this.staticPoints() || [];
      pts = pts.filter(p => isFinite(p[0]) && isFinite(p[1])).sort((a, b) => a[0] - b[0]);
      if (pts.length >= 2) {
        const A = pts[0], B = pts[pts.length - 1];
        if (B[0] !== A[0]) {
          const m = (B[1] - A[1]) / (B[0] - A[0]), b = A[1] - m * A[0];
          const XS = [-1.7, 0.6, 2.3];
          const i = ch.findIndex(e => {
            const a = e.querySelector('annotation');
            const g = this.compile(prep(a ? a.textContent : e.innerText));
            if (!g) return false;
            try { return XS.every(x => Math.abs(g(x) - (m * x + b)) < 1e-6); } catch (x) { return false; }
          });
          if (i >= 0) return { i };
        }
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// Classify a function given only a value table: constant first differences are
// linear, constant second differences quadratic, constant ratios exponential.
window.__duo.tablePairs = function () {
  const labs = (this.diagramLabels() || []).map(l => String(l.t).replace(/[−–—]/g, '-'));
  const head = labs.findIndex(t => /^f\(x\)$|^y$/i.test(t));
  if (head < 1) return null;
  const nums = labs.slice(head + 1).map(parseFloat);
  if (nums.length < 4 || nums.some(n => !isFinite(n))) return null;
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts.length >= 3 ? pts : null;
};
window.__duo.tableFamily = function () {
  const P = this.tablePairs(); if (!P) return null;
  const y = P.map(p => p[1]);
  const d1 = y.slice(1).map((v, i) => v - y[i]);
  const near = a => a.every(v => Math.abs(v - a[0]) < 1e-6 * Math.max(1, Math.abs(a[0])));
  if (near(d1)) return 'linear';
  const d2 = d1.slice(1).map((v, i) => v - d1[i]);
  if (d2.length && near(d2)) return 'quadratic';
  if (y.every(v => v !== 0)) {
    const r = y.slice(1).map((v, i) => v / y[i]);
    if (near(r)) return 'exponential';
  }
  return null;
};
(function () {
  const bt = window.__duo.solveTransformedValue;
  window.__duo.solveTransformedValue = function () {
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (ch.length && /select the match|which (function|type)/i.test(this.curInstruction() || '')) {
      const fam = this.tableFamily();
      if (fam) {
        const i = ch.findIndex(e => this.half(e.innerText).toLowerCase().startsWith(fam));
        if (i >= 0) return { i };
      }
    }
    return bt.call(this);
  };
})();
;'__duo ready';

// "Select the x-values of the x-intercepts" is MULTI-select, and on guided
// table lessons the intercepts come from the table's zero rows, not a graph.
(function () {
  const base = window.__duo.solveChoices;
  window.__duo.solveChoices = function () {
    const ins = this.promptLatex().map(l => this.ascii(l)).join(' ') + ' ' + (this.curInstruction() || '');
    if (/x\s*-?\s*values of the.*x\s*-?\s*intercepts/i.test(ins)) {
      const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      let xs = null;
      const P = this.tablePairs();
      if (P) xs = P.filter(p => Math.abs(p[1]) < 1e-9).map(p => p[0]);
      if ((!xs || !xs.length)) { const R = this.curveRoots(); if (R && R.length) xs = R; }
      if (xs && xs.length && ch.length) {
        const idx = [];
        ch.forEach((e, i) => {
          const v = parseFloat(this.half(e.innerText).replace(/[−–—]/g, '-'));
          if (isFinite(v) && xs.some(x => Math.abs(x - v) < 0.35)) idx.push(i);
        });
        if (idx.length) return { want: idx.map(i => this.half(ch[i].innerText)), idx, ok: true, via: 'xIntercepts' };
      }
    }
    return base.call(this);
  };
})();
;'__duo ready';

// \duoblank{n} carries the expected value as its argument. The equation solver
// is preferred, but two-unknown steps ("4 = \duoblank{-4} a") can't be solved
// numerically, and this reads straight off the prompt.
(function () {
  const base = window.__duo.solveOutputAt;
  window.__duo.solveOutputAt = function () {
    const r = base.call(this);
    if (r !== null && r !== undefined) return r;
    const line = this.promptLatex().filter(l => /duoblank/.test(l)).pop();
    if (line) {
      const m = line.match(/\\duoblank\{(-?\d+(?:\.\d+)?)\}/);
      if (m) return parseFloat(m[1]);
    }
    return r;
  };
})();
;'__duo ready';

// "x-intercepts: 2 and 4" -> pick the factored form that vanishes at both.
// Runs ahead of the generic expression solvers, which otherwise grab this.
(function () {
  const base = window.__duo.solveChoices;
  window.__duo.solveChoices = function () {
    const ins = String(this.curInstruction() || '').replace(/[−–—]/g, '-');
    const m = ins.match(/intercepts?\s*:?\s*(-?[\d.]+)\s*(?:and|,)\s*(-?[\d.]+)/i);
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (m && ch.length) {
      const roots = [parseFloat(m[1]), parseFloat(m[2])];
      const prep = t => String(t)
        .replace(/\\(mathbf|textbf|text|emphasis|displaystyle)\b/g, '')
        .replace(/\\(cdot|times)/g, '*').replace(/\\left|\\right/g, '')
        .replace(/[{}]/g, '').replace(/\s/g, '').replace(/[−–—]/g, '-')
        .replace(/^[a-z]\(x\)=|^y=/i, '')
        .replace(/\ba\b/g, '1')                       // the leading coefficient
        .replace(/(\d|\))(\()/g, '$1*$2');
      const i = ch.findIndex(e => {
        const a = e.querySelector('annotation');
        const g = this.compile(prep(a ? a.textContent : e.innerText));
        if (!g) return false;
        try { return roots.every(r => Math.abs(g(r)) < 1e-9) && Math.abs(g(roots[0] + 1)) > 1e-9; }
        catch (x) { return false; }
      });
      if (i >= 0) return { want: [String(i)], idx: [i], ok: true, via: 'factoredFromRoots' };
    }
    return base.call(this);
  };
})();
;'__duo ready';

// Duolingo has lost completed progress before, so keep an independent local
// record of every level this run finishes. Survives page reloads.
window.__duo.ledgerKey = 'duoLedger';
window.__duo.ledgerNote = function (unit, level, xp) {
  try {
    const L = JSON.parse(localStorage.getItem(this.ledgerKey) || '{}');
    const k = 'u' + unit + 'l' + level;
    L[k] = { at: new Date().toISOString(), xp: xp || 0 };
    localStorage.setItem(this.ledgerKey, JSON.stringify(L));
    return Object.keys(L).length;
  } catch (e) { return null; }
};
window.__duo.ledgerDump = function () {
  try { return localStorage.getItem(this.ledgerKey) || '{}'; } catch (e) { return '{}'; }
};
(function () {
  const base = window.__duo.autoLesson;
  window.__duo.autoLesson = async function () {
    const r = await base.call(this);
    if (r && r.ok) {
      const m = location.pathname.match(/unit\/(\d+)\/level\/(\d+)/);
      if (m) this.ledgerNote(m[1], m[2], this.S && this.S.xp);
    }
    return r;
  };
})();
;'__duo ready';

// Piecewise graphs draw each branch as its own path, so sample them all and
// let the caller pick the slanted or the flat one.
window.__duo.curvePieces = function () {
  const g = this.grid2D(); if (!g) return null;
  const d = g.f.contentDocument, fr = g.f.getBoundingClientRect();
  const out = [];
  for (const p of d.querySelectorAll('svg path')) {
    if (!p.getTotalLength || !p.getBBox) continue;
    const b = p.getBBox(), L = p.getTotalLength();
    if (b.width < 30 && b.height < 30) continue;
    const m = p.ownerSVGElement.getScreenCTM(); if (!m) continue;
    const pts = [];
    const n = Math.min(120, Math.max(12, Math.round(L / 6)));
    for (let i = 0; i <= n; i++) {
      const q = p.getPointAtLength(L * i / n);
      pts.push(g.toXY(m.a * q.x + m.c * q.y + m.e + fr.left, m.b * q.x + m.d * q.y + m.f + fr.top));
    }
    const ys = pts.map(q => q[1]), xs = pts.map(q => q[0]);
    out.push({ pts, flat: Math.max(...ys) - Math.min(...ys) < 0.2,
      vertical: Math.max(...xs) - Math.min(...xs) < 0.2,
      x0: Math.min(...xs), x1: Math.max(...xs) });
  }
  return out.length ? out : null;
};

// "Select the domain for the slanted line": keep the inequality that every
// sampled point of that branch satisfies.
(function () {
  const base = window.__duo.solveChoices;
  window.__duo.solveChoices = function () {
    const ins = String(this.curInstruction() || '');
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    if (/domain|range/i.test(ins) && ch.length) {
      const pieces = this.curvePieces();
      if (pieces) {
        let pick = null;
        if (/slanted|diagonal/i.test(ins)) pick = pieces.find(p => !p.flat && !p.vertical);
        else if (/horizontal|flat|constant/i.test(ins)) pick = pieces.find(p => p.flat);
        if (pick) {
          const useY = /range/i.test(ins);
          const vals = pick.pts.map(p => useY ? p[1] : p[0]);
          const ok = [];
          ch.forEach((e, i) => {
            const a = e.querySelector('annotation');
            const t = (a ? a.textContent : e.innerText).replace(/[−–—]/g, '-')
              .replace(/\\(mathbf|textbf|text|geq|leq|le|ge)\b/g, m => /geq|ge/.test(m) ? '>=' : /leq|le/.test(m) ? '<=' : '')
              .replace(/[{}\s]/g, '');
            const m2 = t.match(/^[a-z](>=|<=|<|>)(-?[\d.]+)$/i);
            if (!m2) return;
            const n = parseFloat(m2[2]), op = m2[1];
            const holds = vals.every(v =>
              op === '>=' ? v >= n - 0.15 : op === '<=' ? v <= n + 0.15 :
              op === '>' ? v > n - 0.15 : v < n + 0.15);
            if (holds) ok.push(i);
          });
          if (ok.length === 1) return { want: [String(ok[0])], idx: ok, ok: true, via: 'branchDomain' };
        }
      }
    }
    return base.call(this);
  };
})();
;'__duo ready';

// 2026-09-02: the grader said \mathbf{[-3,4]} and answer() split it on the
// comma into "[-3" and "4]" — nothing matched, a distractor got picked. Do not
// split inside brackets/parens (intervals, ordered pairs). And run the grader
// match FIRST: the wrapper chain above had grown to where a heuristic solver
// pre-empted an exact grader hit.
(function () {
  const D = window.__duo, base = D.answer;
  D.answer = function () {
    const b = this.blob(); if (!b || !b.grading_function) return null;
    let r; try { r = new Function('return (' + b.grading_function + ')')()(b); } catch (e) { return null; }
    const v = (r && r[1] && r[1].value) || (r && r.displayAnswer && r.displayAnswer.value) || '';
    const m = v.match(/mathbf\{([^}]*)\}/);
    if (!m) return base.call(this);
    return /[\[\]()]/.test(m[1]) ? [m[1].trim()] : m[1].split(',').map(x => x.trim());
  };
  const sc = D.solveChoices;
  D.solveChoices = function () {
    try {
      const want = (this.answer() || []).map(x => this.norm(x));
      const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
      const norm = e => { const a = e.querySelector('annotation'); return this.norm(a ? a.textContent : e.innerText); };
      const idx = c.map((e, i) => [i, norm(e)]).filter(([, t]) => want.includes(t)).map(([i]) => i);
      if (want.length && idx.length === want.length) return { want, idx, ok: true, via: 'graderFirst' };
    } catch (e) {}
    return sc.call(this);
  };
})();
;'__duo ready';

// ---- shirtPantsInteractive: answer the widget without touching it ----
// The widget iframe (same-origin srcdoc) exposes getOutputVariables(); the
// grader only ever sees that object. Replace the function, fire the widget's
// own onFirstInteraction hook (which posts the payload and enables CHECK), and
// verify with the grader before submitting. No drags, no pixels.
(function () {
  const D = window.__duo;

  D.widgetFrame = function () {
    return [...document.querySelectorAll('iframe')].find(f => {
      try { return f.contentDocument && typeof f.contentWindow.getOutputVariables === 'function' && f.getBoundingClientRect().height > 0; }
      catch (e) { return false; }
    }) || null;
  };

  D.grader = function () {
    const b = this.blob(); if (!b || !b.grading_function) return null;
    try { return new Function('return (' + b.grading_function + ')')(); } catch (e) { return null; }
  };

  // numbers the feedback names: \mathbf{0.1666}, \frac{1}{6}, (2, -3), "3, 4"
  D.feedbackNums = function (grade, probe) {
    let r; try { r = grade(probe); } catch (e) { return []; }
    const v = (r && r[1] && r[1].value) || (r && r.displayAnswer && r.displayAnswer.value) || '';
    const m = v.match(/mathbf\{(.*)\}\s*$/) || v.match(/mathbf\{([^}]*)\}/);
    if (!m) return [];
    let s = m[1].replace(/\\frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}/g, (_, a, b) => String(+a / +b)).replace(/[−–]/g, '-');
    const nums = (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    return { raw: s, nums };
  };

  D.interactiveCandidates = function (cur, fb) {
    const keys = Object.keys(cur || {}); const out = []; const nums = fb.nums || [];
    const put = o => out.push(o);
    if (keys.length === 1) {
      const k = keys[0], c = cur[k];
      for (const n of nums) put({ [k]: n });
      if (Array.isArray(c)) { put({ [k]: nums }); put({ [k]: nums.slice(0, c.length) }); }
      if (typeof c === 'string') { put({ [k]: fb.raw }); for (const n of nums) put({ [k]: String(n) }); }
      if (c && typeof c === 'object' && !Array.isArray(c)) {
        const ck = Object.keys(c);
        if (ck.length === nums.length) put({ [k]: Object.fromEntries(ck.map((kk, i) => [kk, nums[i]])) });
        if (ck.length === 2 && nums.length === 2) put({ [k]: Object.fromEntries([[ck[0], nums[1]], [ck[1], nums[0]]]) });
      }
      return out;
    }
    if (keys.length === nums.length) {
      put(Object.fromEntries(keys.map((k, i) => [k, nums[i]])));
      if (keys.length === 2) put(Object.fromEntries([[keys[0], nums[1]], [keys[1], nums[0]]]));
    }
    // one key changed at a time
    for (const k of keys) for (const n of nums) put(Object.assign({}, cur, { [k]: n }));
    return out;
  };

  // returns the winning payload, or null
  D.solveInteractive = async function () {
    const f = this.widgetFrame(); if (!f) return null;
    const w = f.contentWindow, grade = this.grader(); if (!grade) return null;
    let cur = {}; try { cur = w.getOutputVariables() || {}; } catch (e) {}
    const ok = o => { try { const r = grade(o); return Array.isArray(r) ? r[0] === true : !!(r && r.isCorrect); } catch (e) { return false; } };
    let win = null;
    if (ok(cur)) win = cur;                       // already correct (e.g. default state)
    else {
      const fb = this.feedbackNums(grade, cur);
      for (const c of this.interactiveCandidates(cur, fb)) if (ok(c)) { win = c; break; }
      // brute force one numeric key over a small integer / half grid
      if (!win) {
        const ks = Object.keys(cur).filter(k => typeof cur[k] === 'number');
        outer: for (const k of ks) for (let v = -30; v <= 30; v += 0.5) { const c = Object.assign({}, cur, { [k]: v }); if (ok(c)) { win = c; break outer; } }
      }
    }
    if (!win) return null;
    w.getOutputVariables = () => win;
    try { (w.duo && w.duo.onFirstInteraction || w.AndroidChallenge && w.AndroidChallenge.firstInteraction)(); } catch (e) {}
    try { w.duoDynamic && w.duoDynamic.onInteraction && w.duoDynamic.onInteraction(); } catch (e) {}
    try { w.parent.postMessage({ type: 'outputVariables', payload: win, fromInteraction: true }, 'https://www.duolingo.com'); } catch (e) {}
    await this.sleep(400);
    const n0 = document.querySelector('[data-test="player-next"]');
    return n0 && n0.getAttribute('aria-disabled') !== 'true' ? win : null;
  };

  // wire into run2: right after the lessondone check, before plan()/choices
  const src = String(D.run2), mark = "this.S.log.push('lessondone'); break; }";
  if (src.includes(mark)) {
    const ins = mark + `
    { const w3 = await this.solveInteractive();
      if (w3) { this.S.log.push('widget'); await this.sleep(300);
        this.tap(document.querySelector('[data-test="player-next"]')); await this.sleep(1400);
        const b3 = await this.blame(); this.S.log.push(b3 || 'noblame');
        if (b3 === 'correct') { this.S.done++; miss = 0; }
        else if (b3 === 'incorrect' && ++miss >= 2) { this.S.log.push('halt:2wrong'); break; }
        const nx3 = document.querySelector('[data-test="player-next"]');
        if (nx3 && /CONTINUE/i.test(nx3.innerText)) { this.tap(nx3); await this.sleep(1400); }
        info = 0; continue; } }`;
    D.run2 = eval('(' + src.replace(mark, ins) + ')');
  } else console.warn('[duo] interactive: run2 mark not found');
})();
;'__duo ready';

// ---- typeFill: the grader wants {keyboardInput:{value}} ----
// answer() probes grade(blob) and that throws here, so a heuristic typed "1"
// for 1/6 + 1/6. Probe with the right shape, read the Correct Answer, prefer a
// small fraction over a long decimal, and verify with the grader before typing.
(function () {
  const D = window.__duo, base = D.typeAnswer;
  D.asFraction = function (x) {
    if (Number.isInteger(x)) return String(x);
    for (let d = 2; d <= 200; d++) { const n = Math.round(x * d); if (Math.abs(n / d - x) < 1e-9) return n + '/' + d; }
    return String(x);
  };
  D.solveTypeFill = function () {
    const b = this.blob(); if (!b || b.layout !== 'typeFill' || !b.grading_function) return null;
    const grade = this.grader(); if (!grade) return null;
    const probe = v => { try { return grade({ keyboardInput: { value: v } }); } catch (e) { return null; } };
    const r0 = probe(''); const v = (r0 && r0[1] && r0[1].value) || '';
    const m = v.match(/mathbf\{([^}]*)\}/); if (!m) return null;
    let s = m[1].replace(/\\frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}/g, (_, a, c) => String(+a / +c)).replace(/[−–]/g, '-').replace(/\s/g, '');
    const cands = [];
    const n = parseFloat(s); if (isFinite(n)) { cands.push(this.asFraction(n), String(n), s); } else cands.push(s);
    for (const c of cands) { const r = probe(c); if (r && r[0] === true) return c; }
    return null;
  };
  D.typeAnswer = function () {
    const v = this.solveTypeFill();
    if (v !== null) { this.type(v); return v; }
    return base.call(this);
  };
})();
;'__duo ready';

// grading_function is sometimes SEVERAL declarations (parseTypeFillInput,
// parseNumber, grade) — not one expression. Load either shape.
window.__duo.grader = function () {
  const b = this.blob(); if (!b || !b.grading_function) return null;
  const s = b.grading_function;
  try { const f = new Function('return (' + s + ')')(); if (typeof f === 'function') return f; } catch (e) {}
  try { const f = new Function(s + '\n;return typeof grade === "function" ? grade : null;')(); if (typeof f === 'function') return f; } catch (e) {}
  return null;
};
;'__duo ready';

// graderFirst v2: brace-balanced \mathbf{...} (the old regex died on \{1,\,2\}),
// strip every LaTeX command on BOTH sides, compare whole before splitting.
(function () {
  const D = window.__duo, sc = D.solveChoices;
  D.graderText = function () {
    const grade = this.grader(); if (!grade) return null;
    let r; try { r = grade(this.blob()); } catch (e) { try { r = grade({ keyboardInput: { value: '' } }); } catch (e2) { return null; } }
    const v = (r && r[1] && r[1].value) || (r && r.displayAnswer && r.displayAnswer.value) || '';
    const i = v.indexOf('mathbf{'); if (i < 0) return null;
    let d = 0, j = i + 6;
    for (; j < v.length; j++) { if (v[j] === '{') d++; else if (v[j] === '}' && --d === 0) break; }
    return v.slice(i + 7, j);
  };
  D.texKey = function (s) {
    return this.norm(this.ascii(String(s)).replace(/\\[,;!: ]/g, '').replace(/\\(mathbf|textbf|text|mathrm|left|right)\b/g, '')
      .replace(/\\([{}])/g, '$1').replace(/\\[a-zA-Z]+/g, m => m.slice(1)).replace(/[{}\s]/g, '').replace(/[−–]/g, '-'));
  };
  D.solveChoices = function () {
    try {
      const a = this.graderText();
      if (a !== null) {
        const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
        const keys = c.map(e => { const an = e.querySelector('annotation'); return this.texKey(an ? an.textContent : e.innerText); });
        const whole = this.texKey(a);
        let idx = keys.map((k, i) => k === whole ? i : -1).filter(i => i >= 0);
        if (idx.length === 1) return { want: [whole], idx, ok: true, via: 'graderFirst' };
        if (!/[\[\]{}()]/.test(a)) {
          const parts = a.split(',').map(x => this.texKey(x)).filter(Boolean);
          idx = keys.map((k, i) => parts.includes(k) ? i : -1).filter(i => i >= 0);
          if (parts.length && idx.length === parts.length) return { want: parts, idx, ok: true, via: 'graderFirst' };
        }
      }
    } catch (e) {}
    return sc.call(this);
  };
})();
;'__duo ready';

// ---- multiStep (guided) lessons ----
// The top blob is layout:"multiStep"; each step carries its own grading_function
// and challengeState.guess.currentStepIndex says which one is live. Every
// grader probe must use the STEP blob. selectAll/selectOne graders take
// {button_N:{selected}} — enumerate subsets, keep the one grade() accepts.
(function () {
  const D = window.__duo;
  D.challengeState = function () {
    const el = document.querySelector('[data-test^="challenge "]'); if (!el) return null;
    let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber$'))], d = 0;
    while (f && d++ < 12) { if (f.memoizedProps && f.memoizedProps.challengeState) return f.memoizedProps.challengeState; f = f.return; }
    return null;
  };
  D.curBlob = function () {
    const b = this.blob(); if (!b) return null;
    if (b.layout !== 'multiStep' || !Array.isArray(b.steps)) return b;
    const cs = this.challengeState(); const i = cs && cs.guess ? cs.guess.currentStepIndex : null;
    if (i === null || i === undefined || !b.steps[i]) return b;
    return b.steps[i].blob || b;
  };
  const loadGrader = s => {
    try { const f = new Function('return (' + s + ')')(); if (typeof f === 'function') return f; } catch (e) {}
    try { const f = new Function(s + '\n;return typeof grade === "function" ? grade : null;')(); if (typeof f === 'function') return f; } catch (e) {}
    return null;
  };
  D.grader = function () { const b = this.curBlob(); return b && b.grading_function ? loadGrader(b.grading_function) : null; };

  D.solveTypeFill = function () {
    const b = this.curBlob(); if (!b || b.layout !== 'typeFill' || !b.grading_function) return null;
    const grade = this.grader(); if (!grade) return null;
    const probe = v => { try { return grade({ keyboardInput: { value: v } }); } catch (e) { return null; } };
    const r0 = probe(''); const v = (r0 && r0[1] && r0[1].value) || '';
    const m = v.match(/mathbf\{([^}]*)\}/); const cands = [];
    if (m) { const s = m[1].replace(/\\frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}/g, (_, a, c) => String(+a / +c)).replace(/[−–]/g, '-').replace(/\s/g, '');
      const n = parseFloat(s); if (isFinite(n)) cands.push(this.asFraction(n), String(n)); cands.push(s); }
    const sh = b.shirt && b.shirt.value && b.shirt.value.match(/duoblank\{([^}]*)\}/); if (sh) cands.push(sh[1].trim());
    for (const c of cands) { const r = probe(c); if (r && r[0] === true) return c; }
    return null;
  };

  D.solveSelect = function () {
    const b = this.curBlob(); if (!b || !/^select(All|One)$/.test(b.layout || '') || !Array.isArray(b.pants)) return null;
    const grade = this.grader(); if (!grade) return null;
    const btns = b.pants.filter(p => p && p.type === 'button' && p.id); if (!btns.length || btns.length > 8) return null;
    const ok = sel => { try { const r = grade(Object.fromEntries(btns.map(p => [p.id, { selected: sel.includes(p.id) }]))); return Array.isArray(r) ? r[0] === true : !!(r && r.isCorrect); } catch (e) { return false; } };
    let win = null;
    for (let mask = 1; mask < (1 << btns.length) && !win; mask++) {
      const sel = btns.filter((_, i) => mask & (1 << i)).map(p => p.id);
      if (b.layout === 'selectOne' && sel.length !== 1) continue;
      if (ok(sel)) win = sel;
    }
    if (!win) return null;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const keys = c.map(e => { const a = e.querySelector('annotation'); return this.texKey(a ? a.textContent : e.innerText); });
    const idx = [];
    for (const id of win) { const p = btns.find(p => p.id === id); const k = this.texKey((p.child && (p.child.value || p.child.text)) || '');
      const i = keys.indexOf(k); if (i < 0) return null; idx.push(i); }
    return { want: win, idx, ok: true, via: 'gradeSubset' };
  };

  const sc = D.solveChoices;
  D.solveChoices = function () { let r = null; try { r = this.solveSelect(); } catch (e) {} return r || sc.call(this); };
})();
;'__duo ready';

// choices are toggles: after a wrong try some are still aria-checked, and a
// tap on one of those UNselects it. Return the set to flip, not the set wanted.
(function () {
  const D = window.__duo, sc = D.solveChoices;
  D.solveChoices = function () {
    const r = sc.call(this); if (!r || !r.ok || !Array.isArray(r.idx)) return r;
    const c = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const on = c.map((e, i) => e.getAttribute('aria-checked') === 'true' ? i : -1).filter(i => i >= 0);
    if (!on.length) return r;
    const want = new Set(r.idx);
    r.idx = c.map((_, i) => i).filter(i => want.has(i) !== on.includes(i));
    return r;
  };
})();
;'__duo ready';

// Graders return EITHER [ok, {value}] OR {isCorrect, feedback:{value}, displayAnswer:{value}}.
// One reader for both, and the typed/choice probes use it.
(function () {
  const D = window.__duo;
  D.gOk = r => Array.isArray(r) ? r[0] === true : !!(r && r.isCorrect === true);
  D.gText = r => {
    if (!r) return '';
    if (Array.isArray(r)) return (r[1] && (r[1].value || r[1])) ? String(r[1].value || r[1]) : '';
    return String((r.displayAnswer && r.displayAnswer.value) || (r.feedback && r.feedback.value) || '');
  };
  D.gAnswer = function (r) {
    const v = this.gText(r); if (!v) return null;
    const i = v.indexOf('mathbf{');
    if (i >= 0) { let d = 0, j = i + 6; for (; j < v.length; j++) { if (v[j] === '{') d++; else if (v[j] === '}' && --d === 0) break; } return v.slice(i + 7, j); }
    const m = v.match(/Correct Answer:\s*\}?\s*(.+)$/); return m ? m[1].trim() : v.trim();
  };
  D.graderText = function () {
    const grade = this.grader(); if (!grade) return null;
    let r = null; for (const p of [this.curBlob(), { keyboardInput: { value: '' } }, {}]) { try { r = grade(p); if (r) break; } catch (e) {} }
    return r ? this.gAnswer(r) : null;
  };
  D.solveTypeFill = function () {
    const b = this.curBlob(); if (!b || !b.grading_function) return null;
    if (!(b.layout === 'typeFill' || (b.pants && b.pants.type === 'keyboard'))) return null;
    const grade = this.grader(); if (!grade) return null;
    const probe = v => { try { return grade({ keyboardInput: { value: v } }); } catch (e) { return null; } };
    const a = this.gAnswer(probe('')); const cands = [];
    if (a !== null) { const s = a.replace(/\\frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}/g, (_, x, y) => String(+x / +y)).replace(/[−–]/g, '-').replace(/\\[a-zA-Z]+|[{}\s]/g, '');
      const n = parseFloat(s); if (isFinite(n)) cands.push(this.asFraction(n), String(n)); cands.push(s); }
    const sh = b.shirt && b.shirt.value && b.shirt.value.match(/duoblank\{([^}]*)\}/); if (sh) cands.push(sh[1].trim());
    for (const c of cands) if (this.gOk(probe(c))) return c;
    return null;
  };
})();
;'__duo ready';

// ---- interactive widgets whose output has null slots (table fills) ----
// {updated_rows:[[2,null],[4,null]]}: fill the nulls, in order, from the numbers
// after "=" in the display answer, then from all its numbers, then from
// permutations of the widget's token bank. The grader verifies every candidate.
(function () {
  const D = window.__duo;
  D.feedbackNums = function (grade, probe) {
    let r; try { r = grade(probe); } catch (e) { return { raw: '', nums: [], eq: [] }; }
    const v = this.gText(r);
    const s = v.replace(/\\frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}/g, (_, a, b) => String(+a / +b)).replace(/[−–]/g, '-').replace(/\\[a-zA-Z]+/g, ' ');
    return { raw: s, nums: (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number),
      eq: [...s.matchAll(/=\s*(-?\d+(?:\.\d+)?)/g)].map(m => +m[1]) };
  };
  D.inputVars = function () {
    const b = this.curBlob(); const h = b && b.pants && b.pants.html; if (!h) return null;
    const m = h.match(/INPUT_VARIABLES\s*=\s*(\{[\s\S]*?\});/); if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  };
  const nullPaths = (o, p, out) => { if (Array.isArray(o)) o.forEach((v, i) => v === null ? out.push(p.concat(i)) : nullPaths(v, p.concat(i), out));
    else if (o && typeof o === 'object') for (const k in o) o[k] === null ? out.push(p.concat(k)) : nullPaths(o[k], p.concat(k), out); return out; };
  const fill = (cur, paths, vals) => { const c = JSON.parse(JSON.stringify(cur)); paths.forEach((p, i) => { let o = c; for (let j = 0; j < p.length - 1; j++) o = o[p[j]]; o[p[p.length - 1]] = vals[i]; }); return c; };
  const perms = (arr, k) => { const out = []; const go = (pre, rest) => { if (pre.length === k) { out.push(pre); return; } rest.forEach((v, i) => go(pre.concat(v), rest.slice(0, i).concat(rest.slice(i + 1)))); }; go([], arr); return out; };
  const base = D.interactiveCandidates;
  D.interactiveCandidates = function (cur, fb) {
    const out = base.call(this, cur, fb) || [];
    const paths = nullPaths(cur, [], []); if (!paths.length) return out;
    const n = paths.length;
    if (fb.eq && fb.eq.length >= n) out.push(fill(cur, paths, fb.eq.slice(0, n)));
    if (fb.nums && fb.nums.length >= n) { out.push(fill(cur, paths, fb.nums.slice(0, n))); out.push(fill(cur, paths, fb.nums.slice(-n))); }
    const iv = this.inputVars(); const toks = iv && Array.isArray(iv.tokens) ? iv.tokens.filter(t => typeof t === 'number') : [];
    if (toks.length && toks.length <= 8 && n <= toks.length) for (const p of perms(toks, n)) out.push(fill(cur, paths, p));
    return out;
  };
})();
;'__duo ready';
