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
      keypad: [...document.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label')),
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

  // Tile bank fills left-to-right; place by VALUE in answer order.
  // ponytail: marks used tiles with a data attr instead of tracking indices,
  // because the bank reflows after every placement and indices go stale.
  async place(...vals) {
    const d = this.frame();
    for (const v of vals) {
      const t = [...d.querySelectorAll('.token-bank .token')]
        .find(e => e.textContent.trim() === String(v) && !e.dataset.u);
      if (!t) return { fail: v, have: [...d.querySelectorAll('.token-bank .token')].map(e => e.textContent.trim()) };
      t.dataset.u = 1; t.click(); await this.sleep(350);
    }
    return this.read();
  },

  key(label) { [...document.querySelectorAll('button[aria-label]')].find(b => b.getAttribute('aria-label') === label).click(); },

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

'__duo ready'
