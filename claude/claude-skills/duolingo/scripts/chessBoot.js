// Unattended loop for scripts/chess.js. Same shape as boot.js: run in an
// already-open lichess.org/training tab, solve, move to the next puzzle, repeat.
// Posts to the same serve.py used by duo.js (generic file dump, no chess-specific
// server code needed) so failures are visible from outside the tab.
// Untested against a live tab — see chess.js header.
(async () => {
  if (window.__chessAuto && __chessAuto.running) return;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.__chessAuto = { running: true, count: 0, errors: 0, log: [] };
  const post = (path, body) => fetch('http://127.0.0.1:8777' + path, { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
  const hb = () => post('/chess-hb', { at: new Date().toISOString(), href: location.href, visible: document.visibilityState, ...__chessAuto });
  setInterval(hb, 60e3); hb();

  let r;
  try { r = await __chessSolve(); } catch (e) { r = { ok: false, err: String(e) }; }
  __chessAuto.log.push(r); if (__chessAuto.log.length > 50) __chessAuto.log.shift();
  if (r.ok) __chessAuto.count++; else __chessAuto.errors++;
  post('/chess-state', { at: new Date().toISOString(), href: location.href, ...__chessAuto });
  __chessAuto.running = false;
  await sleep(1500);
  location.href = '/training'; // loads the next puzzle; the extension re-injects on load
})();
