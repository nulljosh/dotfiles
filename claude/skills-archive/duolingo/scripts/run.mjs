// One Playwright runner for every Duolingo track.
//   node run.mjs <track>      es | el | zu | ... (any language code) | math | chess | music
//
// Launches a persistent Chromium (.pw-profile), sets the jwt_token cookie
// from scripts/jwt.txt, PATCHes the account's active course, opens /lesson
// (or clicks the START node on /learn), injects the solver, and loops:
// solve one challenge, click through end screens, handle stories, skip
// DuoRadio, reopen. Rotates to the least-XP language automatically when a
// language tree is exhausted.
//
// Language / chess / music load scripts/solver.js. Math loads
// scripts/math.js (former duo.js, pruned 2026-09-09 by hit-trace — see
// CLAUDE.md) plus scripts/mathjs.min.js, and drives it through autoLesson().
//
// Logs: scripts/log.jsonl (one line per event), scripts/state.json (summary),
// scripts/lessons.jsonl (language study ledger: prompt + answer per question).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const D = path.dirname(new URL(import.meta.url).pathname);
let track = process.argv[2];
if (!track) { console.error('usage: node run.mjs <track>   (a language code, math, chess, or music)'); process.exit(1); }
let isMath = track === 'math';
let isChessTrack = track === 'chess';
let pendingTrack = null; // set by POST /switch, picked up at the top of the outer loop

// ponytail: stdlib http, no deps — lets the iOS/macOS status app poll over
// LAN instead of only reading state.json locally. /switch has no auth either:
// fine for a personal box on a trusted network, not meant to be exposed further.
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/state') {
    res.setHeader('Content-Type', 'application/json');
    res.end(fs.readFileSync(path.join(D, 'state.json'), 'utf8').toString());
  } else if (req.url === '/log') {
    const lines = fs.existsSync(path.join(D, 'log.jsonl'))
      ? fs.readFileSync(path.join(D, 'log.jsonl'), 'utf8').trim().split('\n').slice(-50) : [];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)));
  } else if (req.method === 'POST' && req.url.startsWith('/switch')) {
    const t = new URL(req.url, 'http://x').searchParams.get('track');
    if (t) { pendingTrack = t; res.end('{"ok":true}'); } else { res.writeHead(400); res.end('{"ok":false}'); }
  } else { res.writeHead(404); res.end(); }
}).listen(8737, '0.0.0.0');

const jwt = fs.readFileSync(path.join(D, 'jwt.txt'), 'utf8').trim();
const uid = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString()).sub;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = o => fs.appendFileSync(path.join(D, 'log.jsonl'), JSON.stringify({ at: new Date().toISOString(), track, ...o }) + '\n');
const S = { started: new Date().toISOString(), track, lessons: 0, puzzles: 0, matches: 0, misses: 0, xp0: null, xp: null, last: null };
const saveState = () => fs.writeFileSync(path.join(D, 'state.json'), JSON.stringify({ at: new Date().toISOString(), ...S }, null, 1));
const ledger = rows => rows.length && fs.appendFileSync(path.join(D, 'lessons.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');

// self-calibrating promotion-picker slot: {piece: slotIndex}, learned by trial when the
// guessed 'qrbn' order fails a graded puzzle, persisted so it sticks across runs.
const CALIB_PATH = path.join(D, 'promo-calib.json');
let promoCalib = {}; try { promoCalib = JSON.parse(fs.readFileSync(CALIB_PATH, 'utf8')); } catch {}
const saveCalib = () => fs.writeFileSync(CALIB_PATH, JSON.stringify(promoCalib));

const ctx = await chromium.launchPersistentContext(path.join(D, '.pw-profile'), {
  headless: true, viewport: { width: 1400, height: 900 }, args: ['--disable-background-timer-throttling'],
});
await ctx.addCookies([{ name: 'jwt_token', value: jwt, domain: '.duolingo.com', path: '/', secure: true, sameSite: 'Lax' }]);
const page = ctx.pages()[0] || await ctx.newPage();

const inject = async () => {
  // mathjs (local bundle, no network dependency) replaces the hand-rolled
  // LaTeX-expression evaluator in compile() — load it first so `math` is
  // defined before the solver's top-level script runs.
  const files = isMath ? ['mathjs.min.js', 'math.js'] : isChessTrack ? ['solver.js', 'js-chess-engine.js'] : ['solver.js'];
  for (const f of files) await page.addScriptTag({ content: fs.readFileSync(path.join(D, f), 'utf8') });
  if (isChessTrack) await page.evaluate(c => { window.__duo.promoCalib = c; }, promoCalib);
};
const xp = () => page.evaluate(async u => { try { return (await (await fetch(`/2017-06-30/users/${u}?fields=totalXp`)).json()).totalXp; } catch (e) { return null; } }, uid);
// held click: instant down/up is ignored by the Rive chess board
const click = async ([x, y]) => { await page.mouse.move(x, y); await page.mouse.down(); await sleep(90); await page.mouse.up(); await sleep(550); };
const fen = () => page.evaluate(() => { try { return __duo.liveFen(); } catch (e) { return null; } });
// a chess move: select + drop with a held click, drag as fallback, verify via live FEN change
const chessMove = async (pts) => {
  const [a, b, promo] = pts;
  const before = await fen();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt % 2 === 1) {
      await page.mouse.move(a[0], a[1]); await page.mouse.down(); await sleep(120);
      await page.mouse.move(b[0], b[1], { steps: 12 }); await sleep(120); await page.mouse.up();
    } else { await click(a); await click(b); }
    await sleep(700);
    // ponytail: the drop alone may already auto-promote to queen (no picker shown) —
    // check before firing the extra promo click, which otherwise lands as a bogus
    // third click and gets read as an illegal follow-up move on the dropped piece.
    let changed = before === null; for (let i = 0; i < 4 && !changed; i++) { await sleep(250); changed = (await fen()) !== before; }
    if (changed) return true;
    if (promo) {
      await click(promo);
      for (let i = 0; i < 4 && !changed; i++) { await sleep(300); changed = (await fen()) !== before; }
    }
    if (changed) return true;
    log({ ev: 'move-retry', attempt, from: a, to: b, promo });
  }
  return false;
};

const courseIdFor = t => ({ math: 'MATH_BT', chess: 'CHESS_CH', music: 'MUSIC_MU', zh: 'DUOLINGO_ZH-CN_EN', nl: 'DUOLINGO_NL-NL_EN' }[t] || ('DUOLINGO_' + t.toUpperCase() + '_EN'));
const setCourse = t => page.evaluate(async ({ u, id }) => fetch(`/2017-06-30/users/${u}?fields=currentCourseId`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentCourseId: id }) }), { u: uid, id: courseIdFor(t) });

await page.goto('https://www.duolingo.com/learn', { waitUntil: 'domcontentloaded' });
await sleep(4000);
await setCourse(track);
S.xp0 = S.xp = await xp(); saveState();

const hasChallenge = () => page.evaluate(() => !!document.querySelector('[data-test^="challenge "], [data-test="stories-element"]'));
// walk the tree and pick the next non-radio level by URL (0-based tree, 1-based URL),
// advancing localStorage.treeCursor each call so repeated calls rotate through levels
const pickTreeTarget = () => page.evaluate(() => {
  const units = [...document.querySelectorAll('[data-test^="skill-path-unit-"]')]; if (!units.length) return null;
  const uo = units.some(u => u.dataset.test.endsWith('-0')) ? 1 : 0;
  const cur = JSON.parse(localStorage.treeCursor || '0');
  const list = [];
  for (const u of units) for (const l of u.querySelectorAll('[data-test^="skill-path-level-"]')) {
    const m = l.dataset.test.match(/skill-path-level-(\d+) skill-path-level-(\w+)/);
    if (m && m[2] !== 'duo_radio') list.push([+u.dataset.test.replace('skill-path-unit-', '') + uo, +m[1] + 1]);
  }
  if (!list.length) return null;
  const i = cur % list.length; localStorage.treeCursor = String(cur + 1);
  return list[i];
});
const gotoTreeTarget = async (tgt) => {
  await page.goto(`https://www.duolingo.com/lesson/unit/${tgt[0]}/level/${tgt[1]}`, { waitUntil: 'domcontentloaded' });
  await sleep(6000); await inject();
  return hasChallenge();
};
// Open /lesson, falling back to clicking the START node by text on /learn.
const openLesson = async () => {
  await page.goto('https://www.duolingo.com/lesson', { waitUntil: 'domcontentloaded' });
  await sleep(5000); await inject();
  if (await hasChallenge()) return true;
  const node = await page.evaluate(() => {
    const tip = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^(START|JUMP HERE\?|OPEN)$/i.test(e.textContent.trim()));
    const btn = tip && (tip.closest('[data-test^="skill-path-level"]') || tip.parentElement.querySelector('button') || tip.closest('button'));
    if (!btn) return null; const r = btn.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
  });
  if (node) {
    await page.mouse.click(node[0], node[1]); await sleep(1500);
    const start = await page.evaluate(() => { const b = [...document.querySelectorAll('button, a')].find(e => /START/i.test(e.innerText.trim()) && e.getBoundingClientRect().width > 80); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    if (start) { await page.mouse.click(start[0], start[1]); await sleep(6000); await inject(); }
  }
  if (await hasChallenge()) return true;
  // last resort: walk the tree by URL instead of the (still-stuck) served lesson
  const tgt = await pickTreeTarget();
  if (tgt && await gotoTreeTarget(tgt)) return true;
  await page.screenshot({ path: path.join(D, 'open-fail.png') }).catch(() => {});
  return false;
};

// buttons with no data-test: end-of-lesson upsells (Legendary, streak, quests)
const clickByText = () => page.evaluate(() => {
  const n = document.querySelector('[data-test="player-next"]') ||
    [...document.querySelectorAll('button')].find(b => !b.disabled && /^START \+\d+ XP$/i.test(b.innerText.trim())) ||
    [...document.querySelectorAll('button')].find(b => !b.disabled && /^(CONTINUE|NO THANKS|GOT IT|CLAIM|KEEP LEARNING)$/i.test(b.innerText.trim()));
  if (n) { n.click(); return n.innerText.trim(); }
  return null;
});

let idleOpens = 0;
while (true) {
  if (pendingTrack && pendingTrack !== track) {
    track = pendingTrack; pendingTrack = null;
    isMath = track === 'math'; isChessTrack = track === 'chess';
    S.track = track; S.xp0 = S.xp = null; idleOpens = 0;
    await setCourse(track);
    log({ ev: 'switch', track });
    await sleep(2000);
  }
  saveState();   // heartbeat before a potentially-hanging navigation, so a stuck run still shows a moving `at`
  if (!(await openLesson())) {
    log({ ev: 'open-fail', url: page.url() });
    idleOpens++;
    // Language tree exhausted (or stuck): rotate to the least-XP course and retry.
    if (!isMath && !isChessTrack && idleOpens > 2) {
      const rotated = await page.evaluate(() => __duo.nextCourse()).catch(() => null);
      log({ ev: 'rotate', rotated }); idleOpens = 0; await sleep(2000);
    } else if (idleOpens > 6) { await sleep(60e3); idleOpens = 0; }
    continue;
  }
  idleOpens = 0;
  const t0 = Date.now();
  let lastKey = null, repeats = 0, lastCountedKey = null;

  while (Date.now() - t0 < 20 * 60e3) {                     // one lesson, 20 min ceiling
    saveState();   // heartbeat: an `at` that stops advancing means the loop is stuck, not just between puzzles
    if (isMath) {
      // autoLesson() is the real driver (run(15) only hits the generic
      // fallback loop and halts 'manual' on the first widget it can't
      // click). Mirror boot.js's 12-min watchdog race.
      const runAutoLesson = () => page.evaluate(async () => {
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        // autoLesson() reads/writes localStorage.duoAuto for unit/level
        // bookkeeping (boot.js used to seed this before its first call).
        // run.mjs drives navigation itself, so this is just enough state
        // for autoLesson not to crash on a missing/null value.
        if (!localStorage.getItem('duoAuto')) {
          const m = location.pathname.match(/unit\/(\d+)\/level\/(\d+)/);
          localStorage.setItem('duoAuto', JSON.stringify({ running: true, unit: m ? +m[1] : 1, level: m ? +m[2] : 1, log: [], skipped: [] }));
        }
        try {
          const res = await Promise.race([
            __duo.autoLesson(),
            sleep(12 * 60e3).then(() => ({ ok: false, done: 0, err: 'watchdog' })),
          ]);
          return { ok: true, res };
        } catch (e) { return { ok: false, err: String(e) }; }
      }).catch(e => ({ ok: false, err: String(e) }));

      let r = await runAutoLesson();
      // dragSynth() (synthetic pointer events) never works on these widgets —
      // that's why run2 bails to 'needdrag' instead of trying. run.mjs has a
      // real Playwright mouse, so do the drag here and let autoLesson retry.
      let drags = 0;
      while (r.ok && r.res && String(r.res.tail || '').includes('needdrag') && drags < 3) {
        const plan = await page.evaluate(() => (window.__duo.pendingDrag ? __duo.pendingDrag() : null)).catch(() => null);
        // 'tokenslots' is a sentinel (from/to both [0,0]) for a *multi*-token
        // drag sequence autoDrag drives internally via dragXY() — a single
        // external drag can't answer it, and dragXY is itself the same
        // synthetic-event path that never works on this widget (documented
        // dead end). Nothing to click here; go straight to skip/advance.
        if (!plan || (plan.from[0] === 0 && plan.from[1] === 0 && plan.to[0] === 0 && plan.to[1] === 0)) break;
        drags++;
        await page.mouse.move(plan.from[0], plan.from[1]); await page.mouse.down(); await sleep(120);
        await page.mouse.move(plan.to[0], plan.to[1], { steps: 15 }); await sleep(120); await page.mouse.up();
        await sleep(800);
        log({ ev: 'math-drag', plan, attempt: drags });
        r = await runAutoLesson();
      }
      if (!r.ok) { log({ ev: 'math-err', err: r.err }); break; }
      log({ ev: 'math', res: r.res, drags });
      if (r.res && r.res.ok) { S.lessons++; saveState(); }   // only a real 'lessondone' counts
      if (r.res && r.res.err === 'no hearts') { log({ ev: 'no-hearts' }); process.exit(0); }
      // Still stuck after 3 drags (or no drag plan at all, or 3 strikes on a
      // non-drag widget): skip the question, and if the level is still stuck,
      // quit so /lesson's tree-walker fallback advances treeCursor to a new level.
      if (r.res && !r.res.ok && (drags >= 3 || r.res.stuck >= 3)) {
        log({ ev: 'math-skip', next: r.res.next, drags, stuck: r.res.stuck });
        await page.evaluate(() => { const s = document.querySelector('[data-test="player-skip"]'); s && s.click(); }).catch(() => {});
        await sleep(1000);
        if (r.res.stuck >= 3) {
          await page.evaluate(() => { const q = document.querySelector('[data-test="quit-button"]'); q && q.click(); }).catch(() => {});
          await sleep(1000);
          await page.evaluate(() => { const y = document.querySelector('[data-test="notification-drawer-no-thanks-button"]') || [...document.querySelectorAll('button')].find(b => /END SESSION|QUIT/i.test(b.innerText)); y && y.click(); }).catch(() => {});
          await sleep(1500);
          // /lesson would just re-serve the same stuck level — jump by URL instead,
          // and reset duoAuto's unit/level so autoLesson's own bookkeeping matches.
          await page.goto('https://www.duolingo.com/learn', { waitUntil: 'domcontentloaded' }); await sleep(3000);
          const tgt = await pickTreeTarget();
          if (tgt) {
            await gotoTreeTarget(tgt);
            await page.evaluate((t) => {
              const st = JSON.parse(localStorage.getItem('duoAuto') || 'null') || { running: true, log: [], skipped: [] };
              st.unit = t[0]; st.level = t[1]; st.stuck = 0;
              localStorage.setItem('duoAuto', JSON.stringify(st));
            }, tgt).catch(() => {});
            log({ ev: 'math-advance', tgt });
          }
        }
      }
      break;   // one autoLesson() call is roughly one lesson; reopen and re-inject after every one
    }

    const st = await page.evaluate(async () => {
      const D = window.__duo, c = D.chal();
      if (c && c.chessPuzzleInfo && !document.querySelector('[data-test^="blame"]')) return { kind: 'puzzle', plan: D.chessPlan(innerWidth) };
      if (c && c.match) { const r = await D.matchTurn(3); return { kind: 'match', r: { ...r, clicks: r.clicks && r.clicks.map(([x, y]) => [x * innerWidth / 1568, y * innerWidth / 1568]) } }; }
      if (document.querySelector('[data-test="stories-player-continue"], [data-test="stories-player-done"], [data-test="stories-element"]')) return { kind: 'story' };
      if (!c && !document.querySelector('[data-test^="challenge "]') && document.querySelector('[data-test="quit-button"]')) return { kind: 'radio-maybe' };
      const n = document.querySelector('[data-test="player-next"]') || [...document.querySelectorAll('button')].find(b => !b.disabled && /^(CONTINUE|NO THANKS|GOT IT|START \+\d+ XP|CLAIM|KEEP LEARNING)$/i.test(b.innerText.trim()));
      if (n && !n.disabled) { n.click(); return { kind: 'next', txt: n.innerText.trim() }; }
      if (c) {
        const via = await D.solveLang().catch(() => null);
        const row = via ? D.ledgerRow(via) : null;
        return { kind: 'challenge', type: c.type, via, row, unknown: via ? null : D.logUnknown() };
      }
      return { kind: 'idle', href: location.href, txt: document.body.innerText.slice(0, 80) };
    }).catch(e => ({ kind: 'err', e: String(e) }));

    if (st.kind === 'puzzle' && st.plan) {
      const key = st.plan.moves.join(',');
      if (key === lastKey && ++repeats >= 2) {
        // player-skip doesn't exist mid chess-puzzle (Duolingo just re-serves the
        // same puzzle) — quit the lesson outright so openLesson() lands somewhere new.
        log({ ev: 'stuck', moves: st.plan.moves });
        await page.evaluate(() => { const q = document.querySelector('[data-test="quit-button"]'); q && q.click(); });
        await sleep(1000);
        await page.evaluate(() => { const y = document.querySelector('[data-test="notification-drawer-no-thanks-button"]') || [...document.querySelectorAll('button')].find(b => /END SESSION|QUIT/i.test(b.innerText)); y && y.click(); });
        repeats = 0; lastKey = null; await sleep(1500); break;
      }
      if (key !== lastKey) { lastKey = key; repeats = 0; }
      const graded = () => page.waitForFunction(() => {
        const cs = __duo.chessState(); const g = cs && cs.guess && cs.guess.gradingState;
        return (g && g.type && g.type !== 'ungraded') || /CONTINUE/i.test((document.querySelector('[data-test="player-next"]') || {}).innerText || '');
      }, null, { timeout: 4000 }).then(() => true).catch(() => false);
      let done = false; const played = new Set();
      for (let step = 0; step < 6 && !done; step++) {
        const pick = await page.evaluate((moves) => {
          const b = __duo.puzzleBest(); if (b) return { mv: b.move, via: 'key' };
          const fen = __duo.liveFen(); if (!fen) return { mv: moves[0], via: 'nofen' };
          let legal; try { legal = jsChessEngine.moves(fen); } catch (e) { return { mv: null, err: String(e) }; }
          return { mv: moves.find(m => (legal[m.slice(0, 2).toUpperCase()] || []).includes(m.slice(2, 4).toUpperCase())) || null, via: 'legal' };
        }, st.plan.moves.filter(m => !played.has(m)));
        if (!pick.mv) { log({ ev: 'no-move', moves: st.plan.moves, err: pick.err }); await sleep(1500); if (step > 1) break; continue; }
        const mv = pick.mv; played.add(mv);
        let ci = st.plan.moves.indexOf(mv), pts;
        if (ci >= 0) pts = st.plan.clicks[ci];
        else pts = await page.evaluate((m) => { const c = __duo.chal(); const g = __duo.chessSquares(c.fen.split(' ')[1] === 'w', innerWidth); const a = g.sq(m.slice(0, 2)), b = g.sq(m.slice(2, 4)); const o = [a, b]; if (m[4]) o.push(g.promo(b, m[4])); return o; }, mv);
        const moved = await chessMove(pts); done = await graded(); log({ ev: 'pick', mv, via: pick.via, moved, done });
        if (!done) await sleep(2200);
      }
      await sleep(400);
      const graded_ = await page.evaluate(() => { const cs = __duo.chessState(); const g = cs && cs.guess && cs.guess.gradingState; return g && g.type && g.type !== 'ungraded' ? g.type : null; });
      // ponytail: an unresolved puzzle (stuck move, never graded) must not count as one —
      // it's the SAME puzzle Duolingo will re-serve, not a new one. Only count real grades,
      // and only once per distinct move-set key — a transient "correct" gradingState that
      // reverts (the click-retry bug) must not re-count the same stuck puzzle every retry.
      if ((graded_ || done) && key !== lastCountedKey) {
        lastCountedKey = key;
        const ok = !/incorrect|wrong/i.test(graded_ || '');
        S.puzzles++; if (!ok) S.misses++; S.last = 'puzzle'; log({ ev: 'puzzle', moves: st.plan.moves, ok }); saveState();
        // self-calibration: a promotion move that graded wrong means the guessed picker
        // slot ('qrbn' order) is off for this piece — cycle to the next slot (0-3) and
        // persist it, so the next puzzle needing that piece (and a retry of this one,
        // since it gets re-served until it's answered correctly) uses the learned slot.
        const promoPiece = st.plan.moves.find(m => m[4] && m.length === 5)?.[4];
        if (promoPiece) {
          if (ok) { promoCalib[promoPiece] = 'qrbn'.indexOf(promoPiece); saveCalib(); }
          else { promoCalib[promoPiece] = ((promoCalib[promoPiece] ?? 'qrbn'.indexOf(promoPiece)) + 1) % 4; saveCalib();
            await page.evaluate(c => { window.__duo.promoCalib = c; }, promoCalib); }
        }
        await page.evaluate(() => __duo.chessNext()).catch(() => {});
      } else {
        log({ ev: 'puzzle-unresolved', moves: st.plan.moves });
      }
    } else if (st.kind === 'match') {
      const r = st.r;
      if (r.over) { S.matches++; log({ ev: 'match-over', status: r.status, ply: r.hist && r.hist.length }); saveState();
        await page.evaluate(() => { const n = document.querySelector('[data-test="player-next"]'); n && n.click(); }); await sleep(2000); }
      else if (r.clicks) { await chessMove(r.clicks); log({ ev: 'move', move: r.move, ply: r.ply }); }
      else if (r.err) { log({ ev: 'match-err', err: r.err }); await sleep(3000); }
      else await sleep(1500);
    } else if (st.kind === 'story') {
      let idle = 0, tStory = Date.now();
      while (Date.now() - tStory < 10 * 60e3) {
        const s = await page.evaluate(() => __duo.storyStep()).catch(e => 'ERR:' + e);
        if (!s) { if (++idle > 120) { await page.evaluate(() => { const q = document.querySelector('[data-test="close-button-stories"], [data-test="quit-button"]'); q && q.click(); }); await sleep(1000); await clickByText(); log({ ev: 'story-abort' }); break; } await sleep(500); continue; }
        idle = 0;
        const stillStory = await page.evaluate(() => !!document.querySelector('[data-test="stories-player-continue"], [data-test="stories-player-done"], [data-test="stories-element"]'));
        if (!stillStory) break;
      }
      for (let i = 0; i < 8; i++) { const t = await clickByText(); if (!t) break; await sleep(1200); }
      log({ ev: 'story-end' }); break;   // story node ends the "lesson"
    } else if (st.kind === 'radio-maybe') {
      if (Date.now() - t0 > 20e3) {
        await page.evaluate(() => { document.querySelector('[data-test="quit-button"]').click(); });
        await sleep(1200);
        await page.evaluate(() => { const y = document.querySelector('[data-test="notification-drawer-no-thanks-button"]') || [...document.querySelectorAll('button')].find(b => /END SESSION|QUIT/i.test(b.innerText)); y && y.click(); });
        log({ ev: 'radio-skip' }); await sleep(2000); break;
      }
      await sleep(1000);
    } else if (st.kind === 'challenge') {
      if (st.row) ledger([st.row]);
      if (!st.via) log({ ev: 'unknown-challenge', type: st.type, keys: st.unknown && st.unknown.keys });
      const ok = await page.evaluate(async () => { const n = document.querySelector('[data-test="player-next"]'); if (n && !n.disabled && n.getAttribute('aria-disabled') !== 'true') { n.click(); return true; } return false; });
      if (!ok) {
        const skipped = await page.evaluate(() => { const s = document.querySelector('[data-test="player-skip"]'); if (s) { s.click(); return true; } return false; });
        if (!skipped) await sleep(1000);
      }
      await sleep(1400);
    } else if (st.kind === 'next') {
      await sleep(1200);
      const stillLesson = await page.evaluate(() => location.pathname.startsWith('/lesson'));
      if (!stillLesson) break;
    } else if (st.kind === 'err') { log({ ev: 'err', e: st.e }); break; }
    else { await sleep(1500); const stillLesson = await page.evaluate(() => location.pathname.startsWith('/lesson')).catch(() => false); if (!stillLesson) break; }
  }

  S.lessons++; S.xp = await xp(); S.last = track; saveState();
  log({ ev: 'lesson-end', xp: S.xp });
}
