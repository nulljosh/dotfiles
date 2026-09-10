// Browser-side solver, loaded into the Duolingo tab via page.addScriptTag by
// scripts/run.mjs. Self-contained: read the DOM/fiber, click/type the answer.
// Covers language, chess (puzzles + bot matches), and stories. Math is NOT
// here — it needs the old grader-extraction + geometry pipeline, which is
// still genuinely thousands of chained lines; run.mjs loads scripts/
// math-legacy.js (the untouched former duo.js) for the math track only and
// drives it with the same run.mjs loop via __duo.run(15)/run2(15).
//
// Everything below is the LIVE code kept from duo.js's tail (the language/
// chess/story/course-switch sections added 2026-09-08/09) — the rest of that
// file was ~30 layers of stale wrapper chains that no longer ran.
window.__duo = window.__duo || {};
(function () {
  const D = window.__duo;

  // ---- core: read the DOM, click by selector ----
  D.sleep = ms => new Promise(r => setTimeout(r, ms));

  D.read = function () {
    return {
      type: (document.querySelector('[data-test^="challenge "]') || {}).dataset
        ? document.querySelector('[data-test^="challenge "]').dataset.test.replace('challenge challenge-', '')
        : null,
      prompt: (document.querySelector('[data-test="challenge-header"]') || {}).innerText,
      choices: [...document.querySelectorAll('[data-test="challenge-choice"]')]
        .map((e, i) => [i, e.innerText.replace(/\n/g, ''), e.getAttribute('aria-checked')]),
      hearts: this.hearts(),
      input: !!document.querySelector('[data-test="challenge-text-input"]'),
      blame: (document.querySelector('[data-test^="blame"]') || { dataset: {} }).dataset.test,
      next: (document.querySelector('[data-test="player-next"]') || {}).innerText,
    };
  };

  D.hearts = function () {
    const e = document.querySelector('[data-test="hearts-count"],[data-test="player-hearts"]');
    return e ? parseInt(e.innerText, 10) : null;
  };

  D.go = async function () {   // CHECK or CONTINUE, then read what came next
    const n = document.querySelector('[data-test="player-next"]');
    if (n) n.click();
    await this.sleep(1400);
    return this.read();
  };

  // ---- fiber access ----
  D.chal = function () {
    const el = document.querySelector('[data-test^="challenge "]'); if (!el) return null;
    let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber$'))], d = 0;
    while (f && d++ < 12) { if (f.memoizedProps && f.memoizedProps.challenge) return f.memoizedProps.challenge; f = f.return; }
    return null;
  };

  D.chessBoard = function () {
    return [...document.querySelectorAll('[data-test^="challenge "] canvas')].sort((a, b) => b.width - a.width)[0] || null;
  };

  D.chessState = function () {
    const el = document.querySelector('[data-test^="challenge "]'); if (!el) return null;
    let f = el[Object.keys(el).find(k => k.startsWith('__reactFiber$'))], d = 0;
    while (f && d++ < 14) { if (f.memoizedProps && f.memoizedProps.challengeState) return f.memoizedProps.challengeState; f = f.return; }
    return null;
  };

  D.liveFen = function () {
    const cv = this.chessBoard(); if (!cv) return null;
    let f = cv[Object.keys(cv).find(k => k.startsWith('__reactFiber$'))], d = 0;
    const isFen = s => typeof s === 'string' && /^[rnbqkpRNBQKP1-8\/]+ [wb] /.test(s);
    while (f && d++ < 12) {
      let h = f.memoizedState;
      while (h) { const m = h.memoizedState; if (m && typeof m === 'object' && isFen(m.current)) return m.current; h = h.next; }
      f = f.return;
    }
    return null;
  };

  const fiberUp = (el, pick) => {
    const k = Object.keys(el).find(k => k.startsWith('__reactFiber'));
    let f = el && el[k];
    for (let i = 0; i < 40 && f; i++, f = f.return) { const r = pick(f.memoizedProps || {}); if (r) return r; }
    return null;
  };
  D.storyEl = function () {
    const c = document.querySelector('[data-test="stories-choice"], [data-test*="challenge-tap-token"]:not([data-test="challenge-tap-token-text"])');
    return c ? fiberUp(c, p => p.storyElement || p.currentChallenge) : null;
  };
  D.storyDump = function () {
    const e = this.storyEl() || {};
    return { type: e.type, keys: Object.keys(e), tests: [...new Set([...document.querySelectorAll('[data-test]')].map(x => x.dataset.test))].filter(t => !/quit|progress|audio|backdrop/.test(t)) };
  };

  // ---- language: the fiber's `challenge` object IS the answer key ----
  // Word-bank tokens here are real <button>s (unlike Math's bank), so native
  // click works. No per-type classes — one field-driven dispatch. Unknown
  // shape (or blob-graded Math challenge) → hand back null, never guess.
  const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const tokText = e => { const s = e.querySelector('[data-test="challenge-tap-token-text"]'); return txt(s || e); };
  const choiceText = c => txt({ innerText: typeof c === 'string' ? c : (c.text || c.phrase || c.character || c.transliteration || '') });
  // Placed tokens live outside [data-test="word-bank"] and match the same
  // selector; clicking one un-places it. Scope to the bank when there is one
  // (translate/tapComplete); match-pairs has no bank, so fall back to the page.
  const bank = () => [...((document.querySelector('[data-test="word-bank"]') || document).querySelectorAll('[data-test*="challenge-tap-token"]:not([data-test="challenge-tap-token-text"])'))]
    .filter(b => b.getAttribute('aria-disabled') !== 'true' && !b.disabled);

  D.solveLang = async function () {
    const c = this.chal(); if (!c || c.challengeBlob) return null;
    const dom = [...document.querySelectorAll('[data-test="challenge-choice"]')];
    const skip = document.querySelector('[data-test="player-skip"]');
    // listen / speak: never guess audio, take the skip Duolingo offers
    if (/^(listen|speak|selectPronunciation|listenComplete|listenSpeak)$/.test(c.type) && skip && !(c.correctTokens || []).length && typeof c.correctIndex !== 'number') { skip.click(); return 'skip:' + c.type; }
    if (Array.isArray(c.pairs) && c.pairs.length) {              // match the pairs
      const live = () => bank().filter(b => b.getAttribute('aria-disabled') !== 'true');
      for (const p of c.pairs) {
        const a = Object.values(p).filter(v => typeof v === 'string' && !/^https?:/.test(v)).map(s => s.toLowerCase());   // characterMatch: character/transliteration
        const hit = live().filter(b => a.includes(tokText(b))).slice(0, 2);
        if (hit.length < 2) continue;                              // never click a lone tile, it offsets every later pair
        for (const b of hit) { b.click(); await this.sleep(350); }
      }
      return live().length ? null : 'pairs';
    }
    const blank = Array.isArray(c.displayTokens) ? c.displayTokens.filter(t => t && t.isBlank).map(t => t.text).join('') : '';   // cloze: "Type the missing word"
    const ce = document.querySelector('[data-test^="challenge "] [contenteditable="true"]');
    if (ce && blank) {                                            // partialReverseTranslate: blank is a contenteditable span
      ce.focus(); document.execCommand('selectAll', false, null); document.execCommand('insertText', false, blank);
      await this.sleep(200); return 'type:ce';
    }
    const input = document.querySelector('[data-test="challenge-text-input"], textarea[data-test="challenge-translate-input"]');
    const sol = (c.correctSolutions && c.correctSolutions[0]) || (c.correctTokens && c.correctTokens.join(' ')) || blank || null;
    if (input && sol) {
      Object.getOwnPropertyDescriptor(input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(input, sol);
      input.dispatchEvent(new Event('input', { bubbles: true })); return 'type';
    }
    if (Array.isArray(c.correctTokens) && bank().length) {        // word bank, in order
      const words = c.correctTokens.map(t => t.trim()).filter(t => /[\p{L}\p{N}]/u.test(t));   // "¿" "," "?" are tokens but never tiles
      const have = words.every(t => bank().some(b => tokText(b) === t.toLowerCase()));
      const kb = document.querySelector('[data-test="player-toggle-keyboard"]') || [...document.querySelectorAll('button')].find(b => /USE KEYBOARD/i.test(b.innerText));
      if (!have && kb && sol) {                                    // a tile is missing: type the sentence instead
        kb.click(); await this.sleep(400);
        const ta = document.querySelector('textarea, [data-test="challenge-text-input"]'); if (!ta) return null;
        Object.getOwnPropertyDescriptor(ta.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(ta, sol);
        ta.dispatchEvent(new Event('input', { bubbles: true })); return 'type:kb';
      }
      for (const t of words) {
        const b = bank().find(b => tokText(b) === t.toLowerCase());
        if (!b) return null;                                       // token missing → hand back, no heart spent
        b.click(); await this.sleep(250);
      }
      return 'tokens';
    }
    if (Array.isArray(c.correctIndices) && c.correctIndices.length && !dom.length && bank().length) {   // tapComplete: fill blanks from the bank, in order
      for (const i of c.correctIndices) {
        const w = choiceText((c.choices || [])[i]); const b = bank().find(b => tokText(b) === w);
        if (!b) return null;
        b.click(); await this.sleep(250);
      }
      return 'tapIndices';
    }
    if (Array.isArray(c.correctIndices) && c.correctIndices.length && dom.length) {
      const want = c.correctIndices.map(i => choiceText((c.choices || [])[i]));
      const idx = dom.map((e, i) => [i, txt(e)]).filter(([, t]) => want.includes(t)).map(([i]) => i);
      (idx.length === want.length ? idx : c.correctIndices).forEach(i => dom[i] && dom[i].click()); return 'indices';
    }
    if (typeof c.correctIndex === 'number' && dom.length) {
      const w = choiceText((c.choices || [])[c.correctIndex]);
      const strip = e => txt(e).replace(/^\d+\s+/, '');                 // tiles read "1 ești"
      const i = dom.findIndex(e => strip(e) === w);                      // never includes(): "e" matched "ești"
      dom[i >= 0 ? i : c.correctIndex].click(); return 'index';
    }
    return null;
  };

  // ledger row for a solved language challenge (run.mjs flushes __duo.ledgerLang to lessons.jsonl)
  D.ledgerRow = function (via) {
    const c = this.chal() || {};
    const ans = (c.correctSolutions && c.correctSolutions[0]) ||
      (c.correctTokens && c.correctTokens.filter(t => /[\p{L}\p{N}]/u.test(t)).join(' ')) ||
      (typeof c.correctIndex === 'number' && choiceText((c.choices || [])[c.correctIndex])) ||
      (Array.isArray(c.correctIndices) && c.correctIndices.map(i => choiceText((c.choices || [])[i])).join(' ')) || '';
    return { at: new Date().toISOString(), course: localStorage.duoCourse || null, type: c.type, prompt: c.prompt || '', answer: ans, via, href: location.pathname };
  };

  // ---- chess: puzzles ----
  // Puzzle key ships on the fiber: chal().chessPuzzleInfo.correctMoves (UCI)
  // and chal().fen (side to move = board orientation). The board is a Rive
  // canvas — synthetic events do nothing, only real trusted clicks move a
  // piece, and select→drop needs ~0.5s between clicks or the second is
  // swallowed (run.mjs does the actual clicking; this only computes geometry).
  // Board = canvas rect inset 9.75% left / 10% top, 80% wide.
  D.chessSquares = function (white, shotW = 1568) {
    const cv = this.chessBoard(); if (!cv) return null;
    const r = cv.getBoundingClientRect(), k = shotW / innerWidth;
    const bx = r.left + r.width * 0.0975, by = r.top + r.height * 0.1, s = r.width * 0.8 / 8;
    const sq = q => { let f = q.charCodeAt(0) - 97, rk = +q[1] - 1; if (!white) { f = 7 - f; rk = 7 - rk; }
      return [Math.round((bx + s * (f + 0.5)) * k), Math.round((by + s * (7 - rk + 0.5)) * k)]; };
    // promotion picker: 4.5 squares wide, centred under the pawn but clamped inside the
    // board; the queen sits 0.8 squares in from the picker's left edge, 2.2 squares below
    const promo = b => { const left = Math.max(bx, Math.min(b[0] / k - 2.25 * s, bx + 8 * s - 4.5 * s)); return [Math.round((left + 0.8 * s) * k), Math.round(b[1] + 2.2 * s * k)]; };
    return { sq, promo };
  };

  D.chessPlan = function (shotW = 1568) {
    const c = this.chal(); if (!c || !c.chessPuzzleInfo) return null;
    const white = c.fen.split(' ')[1] === 'w';
    const g = this.chessSquares(white, shotW); if (!g) return null;
    const moves = c.chessPuzzleInfo.correctMoves.flatMap(m => String(m).split(/\s+/)).filter(Boolean);   // "f1d3 f1e2" = two alternatives in one entry
    const clicks = moves.map(m => {
      const a = g.sq(m.slice(0, 2)), b = g.sq(m.slice(2, 4)), out = [a, b];
      if (m[4]) out.push(g.promo(b));
      return out;
    });
    return { white, moves, clicks };
  };

  // chessPuzzleInfo.moveEvaluationsForPositions: { "<board> <side>": [{move, moveCorrectness}] }.
  // Look the LIVE fen up and play the 'correct' entry; correctMoves alone mixes steps and alternatives.
  D.puzzleBest = function () {
    const c = this.chal(); if (!c || !c.chessPuzzleInfo) return null;
    const fen = this.liveFen() || c.fen; if (!fen) return null;
    const key = fen.split(' ').slice(0, 2).join(' ');
    const ev = c.chessPuzzleInfo.moveEvaluationsForPositions || {};
    const list = ev[key] || ev[Object.keys(ev).find(k => k.split(' ')[0] === key.split(' ')[0])] || [];
    const best = list.find(e => e.moveCorrectness === 'correct') || list.find(e => e.moveCorrectness === 'suboptimal');
    return best ? { move: best.move, fen, known: true } : null;
  };

  // CONTINUE through the result screen and return the next puzzle's plan, or a
  // {noPuzzle} read of whatever else is on screen (choice question, /learn).
  D.chessNext = async function () {
    const n = document.querySelector('[data-test="player-next"]'); if (n) n.click();
    for (let i = 0; i < 30; i++) {
      await this.sleep(300);
      const c = this.chal(), nb = document.querySelector('[data-test="player-next"]');
      if (c && c.chessPuzzleInfo && !document.querySelector('[data-test^="blame"]')) return this.chessPlan();
      if (nb && /CONTINUE/i.test(nb.innerText) && !c) nb.click();
    }
    const r = this.read();
    return { noPuzzle: true, type: r.type, prompt: r.prompt, choices: r.choices, next: r.next, href: location.href,
      txt: (document.querySelector('[data-test^="challenge "]') || document.body).innerText.slice(0, 200) };
  };

  // ---- chess: bot matches (js-chess-engine.js must be loaded first) ----
  D.pawnAt = function (fen, sq) {
    const rows = fen.split(' ')[0].split('/'), row = rows[8 - +sq[1]]; let f = 0;
    for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { if (f === sq.charCodeAt(0) - 97) return /p/i.test(ch); f++; } }
    return false;
  };

  D.lasker = function (fen, level = 2) {   // "when you see a good move, look for a better one"
    const good = jsChessEngine.aiMove(fen, level);
    const better = level >= 4 ? good : jsChessEngine.aiMove(fen, level + 1);   // one extra ply, capped at 4 (level 5 can take >10s in-page)
    const key = m => Object.entries(m)[0].join('');
    return key(better) !== key(good) ? better : good;
  };

  D.matchStep = function (level = 2) {
    const c = this.chal(); if (!c || !c.match) return { noMatch: true, type: c && c.type };
    const m = c.match, white = m.playerColor === 'white';
    const cs = this.chessState(), hist = (cs && cs.guess && cs.guess.moveHistory) || m.moveHistory || [];
    let fen = this.liveFen();
    if (!fen) {   // fall back to replaying history from the start position
      fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      for (const mv of hist) { try { fen = jsChessEngine.getFen(jsChessEngine.move(fen, mv.slice(0, 2).toUpperCase(), mv.slice(2, 4).toUpperCase())); } catch (e) { return { err: 'replay:' + mv + ':' + e, hist }; } }
    }
    const st = cs && cs.guess && cs.guess.matchState && cs.guess.matchState.status;
    if (st && st !== 'playing') return { over: true, status: st, hist, next: (document.querySelector('[data-test="player-next"]') || {}).innerText };
    if ((fen.split(' ')[1] === 'w') !== white) return { wait: true, fen, last: m.moveHistory.slice(-1)[0] };
    const mv = this.lasker(fen, level), from = Object.keys(mv)[0], to = mv[from];
    const g = this.chessSquares(white), a = g.sq(from.toLowerCase()), b = g.sq(to.toLowerCase());
    const clicks = [a, b];
    if (/[18]/.test(to[1]) && this.pawnAt(fen, from.toLowerCase())) clicks.push(g.promo(b));   // pawn reaching last rank → queen
    return { move: from + to, clicks, fen, ply: hist.length };
  };

  D.matchTurn = async function (level = 2, maxMs = 15000) {   // wait until it is our move, then plan
    const t0 = Date.now(); let r;
    do { r = this.matchStep(level); if (!r.wait) return r; await this.sleep(400); } while (Date.now() - t0 < maxMs);
    return r;
  };

  // ---- stories ----
  // One step: answer if a key is visible, else CONTINUE.
  D.storyStep = async function () {
    const cont = document.querySelector('[data-test="stories-player-continue"], [data-test="stories-player-done"]');
    const choices = [...document.querySelectorAll('[data-test="stories-choice"]')].length
      ? [...document.querySelectorAll('[data-test="stories-choice"]')]
      : [...document.querySelectorAll('[data-test*="challenge-tap-token"]:not([data-test="challenge-tap-token-text"])')];   // POINT_TO_PHRASE
    // CONTINUE is disabled until answered, so an enabled one means "move on"
    if (cont && !cont.disabled && cont.getAttribute('aria-disabled') !== 'true') { cont.click(); await this.sleep(700); return 'cont'; }
    const e = choices.length ? this.storyEl() : null;
    if (e && typeof e.correctAnswerIndex === 'number' && choices[e.correctAnswerIndex]) {   // MULTIPLE_CHOICE / SELECT_PHRASE
      const el = choices[e.correctAnswerIndex]; if (el.getAttribute('aria-disabled') !== 'true') { el.click(); await this.sleep(700); return 'story:' + e.type; }
    }
    if (e && e.type === 'ARRANGE' && Array.isArray(e.phraseOrder)) {   // tap tiles in phraseOrder
      const t = b => ((b.querySelector('[data-test="challenge-tap-token-text"]') || b).innerText || '').trim().toLowerCase();
      for (const i of e.phraseOrder) {
        const w = String(e.selectablePhrases[i] || '').toLowerCase();
        const b = choices.find(b => t(b) === w && b.getAttribute('aria-disabled') !== 'true' && !b.disabled);
        if (!b) return null;
        b.click(); await this.sleep(350);
      }
      return 'story:ARRANGE';
    }
    if (e && e.type === 'MATCH' && Array.isArray(e.matches)) {     // pairs: click phrase then translation
      const t = b => ((b.querySelector('[data-test="challenge-tap-token-text"]') || b).innerText || '').trim().toLowerCase();
      const live = () => choices.filter(b => b.getAttribute('aria-disabled') !== 'true' && !b.disabled);
      let did = 0;
      for (const m of e.matches) {
        const want = Object.values(m).filter(v => typeof v === 'string').map(v => v.toLowerCase());
        const hit = live().filter(b => want.includes(t(b))).slice(0, 2);
        if (hit.length < 2) continue;
        for (const b of hit) { b.click(); await this.sleep(350); } did++;
      }
      return did ? 'story:MATCH' : null;
    }
    if (e && Array.isArray(e.correctAnswerIndices)) {   // POINT_TO_PHRASE: multiple tap tokens
      for (const i of e.correctAnswerIndices) { if (choices[i]) { choices[i].click(); await this.sleep(400); } }
      return 'story:' + e.type;
    }
    if (cont && !cont.disabled && cont.getAttribute('aria-disabled') !== 'true') { cont.click(); await this.sleep(700); return 'cont'; }
    return null;
  };

  // ---- course switch ----
  // Language ids are DUOLINGO_<LANG>_EN (uppercase; 'zh' -> ZH-CN, 'nl' -> NL-NL).
  D.courseId = k => ({ math: 'MATH_BT', chess: 'CHESS_CH', music: 'MUSIC_MU', zh: 'DUOLINGO_ZH-CN_EN', nl: 'DUOLINGO_NL-NL_EN' })[k] || ('DUOLINGO_' + k.toUpperCase() + '_EN');
  D.course = async function (k) {
    const uid = JSON.parse(atob(document.cookie.split('; ').find(c => c.startsWith('jwt_token=')).split('=')[1].split('.')[1])).sub;
    const r = await fetch(`/2017-06-30/users/${uid}?fields=currentCourseId`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentCourseId: this.courseId(k) }) });
    if (r.status !== 200) return { ok: false, status: r.status, id: this.courseId(k) };   // 400 = not enrolled: visit /enroll/<lang>/en first
    localStorage.duoCourse = k; localStorage.removeItem('langCursor');
    return { ok: true, id: this.courseId(k) };
  };
  // least-XP enrolled language other than the current one
  D.nextCourse = async function () {
    const uid = JSON.parse(atob(document.cookie.split('; ').find(c => c.startsWith('jwt_token=')).split('=')[1].split('.')[1])).sub;
    const u = await (await fetch(`/2017-06-30/users/${uid}?fields=courses,currentCourseId`)).json();
    const langs = u.courses.filter(c => /^DUOLINGO_/.test(c.id) && c.id !== u.currentCourseId).sort((a, b) => a.xp - b.xp);
    if (!langs.length) return null;
    const code = langs[0].id.replace(/^DUOLINGO_/, '').replace(/_EN$/, '').split('-')[0].toLowerCase();
    return this.course(code);
  };

  // ---- music / unknown shapes: log and skip, never guess ----
  D.logUnknown = function () {
    const c = this.chal();
    return { type: c && c.type, keys: c ? Object.keys(c).filter(k => /correct|solution|token|pair|choice|display/i.test(k)) : [] };
  };
})();
