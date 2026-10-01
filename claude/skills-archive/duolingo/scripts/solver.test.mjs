// Unit tests for the pure helpers in solver.js, using a minimal fake DOM —
// no browser. `node --test scripts/solver.test.mjs`
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- tile text normalisation (mirrors the txt()/tokText()/strip() helpers in solveLang) ---
const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
const strip = e => txt(e).replace(/^\d+\s+/, '');

test('txt collapses whitespace and lowercases', () => {
  assert.equal(txt({ innerText: '  Hola\n  Mundo ' }), 'hola mundo');
});

test('strip drops a leading shortcut number, never includes()', () => {
  assert.equal(strip({ innerText: '1 ești' }), 'ești');
  assert.equal(strip({ innerText: 'e' }), 'e');
  // "e" must not fuzzy-match "ești" — exact-match only, no substring test here
  assert.notEqual(strip({ innerText: '3 ești' }), 'e');
});

// --- puzzleBest: FEN-keyed lookup against a fake chal() ---
function puzzleBest(chal, liveFen) {
  const c = chal; if (!c || !c.chessPuzzleInfo) return null;
  const fen = liveFen || c.fen; if (!fen) return null;
  const key = fen.split(' ').slice(0, 2).join(' ');
  const ev = c.chessPuzzleInfo.moveEvaluationsForPositions || {};
  const list = ev[key] || ev[Object.keys(ev).find(k => k.split(' ')[0] === key.split(' ')[0])] || [];
  const best = list.find(e => e.moveCorrectness === 'correct') || list.find(e => e.moveCorrectness === 'suboptimal');
  return best ? { move: best.move, fen, known: true } : null;
}

test('puzzleBest finds the correct move for the live FEN', () => {
  const chal = {
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    chessPuzzleInfo: {
      moveEvaluationsForPositions: {
        'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w': [
          { move: 'f3g5', moveCorrectness: 'suboptimal' },
          { move: 'b1c3', moveCorrectness: 'correct' },
        ],
      },
    },
  };
  const r = puzzleBest(chal, chal.fen);
  assert.equal(r.move, 'b1c3');
});

test('puzzleBest falls back to a board-only key match (side omitted)', () => {
  const chal = { fen: 'x', chessPuzzleInfo: { moveEvaluationsForPositions: { 'boardonly w': [{ move: 'e2e4', moveCorrectness: 'correct' }] } } };
  const r = puzzleBest(chal, 'boardonly w 0 1');
  assert.equal(r.move, 'e2e4');
});

test('puzzleBest returns null with no chessPuzzleInfo', () => {
  assert.equal(puzzleBest({ fen: 'x' }, 'x'), null);
});

// --- chess board/promotion geometry (mirrors chessSquares in solver.js) ---
function chessSquares(rect, white, shotW = 1568, innerWidth = 1400) {
  const k = shotW / innerWidth;
  const bx = rect.left + rect.width * 0.0975, by = rect.top + rect.height * 0.1, s = rect.width * 0.8 / 8;
  const sq = q => { let f = q.charCodeAt(0) - 97, rk = +q[1] - 1; if (!white) { f = 7 - f; rk = 7 - rk; }
    return [Math.round((bx + s * (f + 0.5)) * k), Math.round((by + s * (7 - rk + 0.5)) * k)]; };
  const promo = b => { const left = Math.max(bx, Math.min(b[0] / k - 2.25 * s, bx + 8 * s - 4.5 * s)); return [Math.round((left + 0.8 * s) * k), Math.round(b[1] + 2.2 * s * k)]; };
  return { sq, promo };
}

test('chessSquares: a1 for white sits in the bottom-left of the board region', () => {
  const rect = { left: 0, top: 0, width: 800, height: 800 };
  const { sq } = chessSquares(rect, true, 800, 800);   // 1:1 scale for a readable assertion
  const a1 = sq('a1');
  const h8 = sq('h8');
  assert.ok(a1[0] < h8[0] && a1[1] > h8[1], 'a1 should be left-and-below h8 for white, got ' + JSON.stringify({ a1, h8 }));
});

test('chessSquares: board flips for black', () => {
  const rect = { left: 0, top: 0, width: 800, height: 800 };
  const white = chessSquares(rect, true, 800, 800).sq('a1');
  const black = chessSquares(rect, false, 800, 800).sq('a1');
  assert.notDeepEqual(white, black, 'a1 must land at a different pixel when the board is flipped for black');
});

test('promotion picker clamps to the board left edge and offsets down-right of the target square', () => {
  const rect = { left: 0, top: 0, width: 800, height: 800 };
  const { sq, promo } = chessSquares(rect, true, 800, 800);
  const nearRightEdge = sq('h8');   // rightmost file — picker must clamp, not run off the board
  const p = promo(nearRightEdge);
  const s = rect.width * 0.8 / 8;
  const bx = rect.left + rect.width * 0.0975;
  assert.ok(p[0] <= bx + 8 * s - 4.5 * s + 0.8 * s + 1, 'promo x should clamp inside the board, got ' + p[0]);
  assert.ok(p[1] > nearRightEdge[1], 'promo picker should sit below the target square');
});

// --- shotW scaling: computer-tool clicks are in screenshot px, not CSS px ---
test('chessSquares scales by shotW/innerWidth', () => {
  // exact 2x: an even-pixel rect so Math.round on each side lands on the same integer doubled
  const rect = { left: 0, top: 0, width: 800, height: 800 };
  const at1x = chessSquares(rect, true, 800, 800).sq('e4');
  const at2x = chessSquares(rect, true, 1600, 800).sq('e4');
  assert.equal(at2x[0], at1x[0] * 2);
  assert.equal(at2x[1], at1x[1] * 2);
});
