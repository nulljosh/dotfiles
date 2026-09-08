// ponytail: smallest check that fails if the pure logic in chess.js breaks.
// `node scripts/test_chess.mjs`
import { createRequire } from 'module';
const { extractSolution, squareCenter } = createRequire(import.meta.url)('./chess.js');

function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

// squareCenter: a1 for white sits bottom-left; for black (board flipped) top-right.
const rect = { left: 0, top: 0, width: 800, height: 800 };
let c = squareCenter('a1', rect, true);
assert(c.x === 50 && c.y === 750, 'white a1 should be bottom-left, got ' + JSON.stringify(c));
c = squareCenter('a1', rect, false);
assert(c.x === 750 && c.y === 50, 'black a1 should be top-right, got ' + JSON.stringify(c));
c = squareCenter('e4', rect, true);
assert(c.x === 450 && c.y === 450, 'white e4 mismatch, got ' + JSON.stringify(c));

// extractSolution: real shape from lichess.org/api/puzzle/next
const fixture = JSON.stringify({ game: { fen: 'x' }, puzzle: { id: 'sEnHG', solution: ['e6d5', 'd2a5', 'd5c4'] } });
let found = extractSolution(fixture);
assert(found && found.sol.length === 3 && found.sol[0] === 'e6d5', 'nested puzzle.solution not parsed: ' + JSON.stringify(found));

found = extractSolution('no json here');
assert(found === null, 'non-JSON text should return null');

found = extractSolution('{"nothing":"relevant"}');
assert(found === null, 'JSON without a solution key should return null');

console.log('chess.js: all checks passed');
