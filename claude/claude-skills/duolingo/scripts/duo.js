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
'__duo ready'
