// Solver for lichess.org/training puzzles, same shape as duo.js: read live page
// state, work out the move, click. Injected into an already-signed-in (or even
// anonymous) lichess tab.
//
// Key fact this whole thing leans on: lichess ships the puzzle SOLUTION to the
// client up front (it has to — the client checks your moves against it locally,
// only reporting completion to the server). So there is no engine to write: find
// that JSON, replay the UCI move list against the board.
//
// ponytail: the exact script-tag id lichess uses to embed that JSON has moved
// before (page-init-data / a bare <script type="application/json"> next to
// #training). findSolution() below scans every script tag for a `solution`
// array instead of hardcoding one id, so a markup tweak doesn't break this.
// Untested against a live tab — first run may need a selector fix here or in
// squareCenter()'s DOM assumptions about cg-board/chessground.
(function (root) {
  function extractSolution(text) {
    if (!text || !text.includes('"solution"')) return null;
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    let data;
    try { data = JSON.parse(m[0]); } catch (e) { return null; }
    const p = data.puzzle || (data.game && data) || data;
    if (p && p.puzzle && Array.isArray(p.puzzle.solution)) return { fen: p.puzzle.fen || (p.game && p.game.fen), sol: p.puzzle.solution };
    if (p && Array.isArray(p.solution)) return { fen: p.fen, sol: p.solution };
    return null;
  }

  function findSolution(doc) {
    for (const s of doc.querySelectorAll('script')) {
      const found = extractSolution(s.textContent);
      if (found) return found;
    }
    return null;
  }

  function squareCenter(square, rect, white) {
    const file = square.charCodeAt(0) - 97; // a=0..h=7
    const rank = +square[1] - 1;            // 1=0..8=7
    const col = white ? file : 7 - file;
    const row = white ? 7 - rank : rank;
    const size = rect.width / 8;
    return { x: rect.left + size * (col + 0.5), y: rect.top + size * (row + 0.5) };
  }

  // Node test hook only — nothing below this line touches document/window at load time.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractSolution, squareCenter };
    return;
  }

  function board() { return document.querySelector('cg-board'); }
  // ponytail: no wrap = we can't trust which side we're playing, so fail loudly
  // instead of silently guessing white (that gap misplayed every black puzzle).
  function orientationWhite() {
    const wrap = document.querySelector('.cg-wrap');
    if (!wrap) return null;
    return wrap.classList.contains('orientation-white');
  }

  function fire(type, x, y, target) {
    (target || document).dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0,
    }));
  }

  async function playMove(uci, white) {
    const b = board();
    if (!b) return false;
    const rect = b.getBoundingClientRect();
    const from = squareCenter(uci.slice(0, 2), rect, white);
    const to = squareCenter(uci.slice(2, 4), rect, white);
    fire('mousedown', from.x, from.y, b);
    await new Promise(r => setTimeout(r, 80));
    fire('mousemove', to.x, to.y);
    await new Promise(r => setTimeout(r, 80));
    fire('mouseup', to.x, to.y);
    // promotion: uci[4] is the piece letter (q/r/b/n) when a pawn hits the last rank
    if (uci.length > 4) {
      await new Promise(r => setTimeout(r, 200));
      const role = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[uci[4]];
      const choice = document.querySelector(`square.promotion-choice piece.${role}`);
      if (choice) choice.click();
    }
    return true;
  }

  // The board only shows OUR side to move; the opponent's reply in the solution
  // list plays itself out via the site's own animation. So we only click every
  // other entry, waiting between our moves for that reply to land.
  root.__chessSolve = async function () {
    const found = findSolution(document);
    if (!found) return { ok: false, err: 'no solution JSON found on page' };
    const white = orientationWhite();
    if (white === null) return { ok: false, err: 'no .cg-wrap — cannot tell board orientation' };
    for (let i = 0; i < found.sol.length; i += 2) {
      await playMove(found.sol[i], white);
      await new Promise(r => setTimeout(r, 900)); // let the opponent reply animate
    }
    return { ok: true, moves: found.sol.length };
  };
})(typeof window !== 'undefined' ? window : this);
