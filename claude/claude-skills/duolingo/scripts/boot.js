// The unattended loop. One injection lasts for days: levels change by SPA
// navigation (bounce through /learn, which remounts the lesson) so the document,
// and __duo, never reload. Stuck 3x on a level -> skip it (duoAuto.skipped).
// After every lesson, POST state to serve.py -> scripts/state.json.
// A hard reload kills the loop; the optional scripts/ extension re-injects then.
(async () => {
  if (window.__auto && __auto.running) return;
  const KEY = 'duoAuto', sleep = ms => new Promise(r => setTimeout(r, ms));
  const load = () => JSON.parse(localStorage.getItem(KEY) || 'null');
  let st = load();
  const m = location.pathname.match(/unit\/(\d+)\/level\/(\d+)/);
  if (!st) st = { running: true, unit: m ? +m[1] : 1, level: m ? +m[2] : 1, log: [], skipped: [] };
  if (!st.running) return;
  const save = () => localStorage.setItem(KEY, JSON.stringify(st));
  // ponytail: queue mode — duoAuto.queue = [[u,l],...] walks a work list (the
  // skipped levels) instead of counting up; running=false when it empties.
  const advance = () => {
    if (Array.isArray(st.queue)) { const n = st.queue.shift(); if (!n) { st.running = false; return; } st.unit = n[0]; st.level = n[1]; return; }
    if (st.level < 4) st.level++; else { st.level = 1; st.unit++; }
  };
  const post = () => fetch('http://127.0.0.1:8777/state', { method: 'POST', body: JSON.stringify({
    at: new Date().toISOString(), href: location.href, auto: st,
    ledger: __duo.ledgerDump ? JSON.parse(__duo.ledgerDump()) : {} }) }).catch(() => {});
  const nav = u => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); };
  const challenge = () => document.querySelector('[data-test^="challenge "]');
  const open = async (u, l) => {                       // remount the lesson route
    nav('/learn'); await sleep(3000);
    nav('/lesson/unit/' + u + '/level/' + l);
    for (let i = 0; i < 20 && !challenge(); i++) await sleep(1000);
    return !!challenge();
  };
  window.__auto = { running: true, out: [], started: Date.now(), call: null };
  save();
  // Heartbeat: state.json only changed per lesson, so a stalled tab looked like a
  // slow one. Once a minute (the floor Chrome throttles hidden tabs to) post what
  // the page is doing; a gap in `hb.at` = frozen or dead tab, hidden = throttled.
  const hb = () => fetch('http://127.0.0.1:8777/hb', { method: 'POST', body: JSON.stringify({
    at: new Date().toISOString(), href: location.href, visible: document.visibilityState,
    running: __auto.running, callAge: __auto.call ? Math.round((Date.now() - __auto.call) / 1000) : null,
    last: __auto.out[__auto.out.length - 1] || null, unit: st.unit, level: st.level }) }).catch(() => {});
  setInterval(hb, 60e3); hb();
  // ponytail: Chrome exempts audible tabs from background timer throttling, so a
  // near-silent tone keeps the loop at full speed when the window is covered.
  // If hb.json still shows stalls, relaunch Chrome with --disable-background-timer-throttling.
  try {
    const ac = new AudioContext(), o = ac.createOscillator(), g = ac.createGain();
    g.gain.value = 0.001; o.frequency.value = 40; o.connect(g); g.connect(ac.destination); o.start();
    const kick = () => ac.state !== 'running' && ac.resume().catch(() => {});
    kick(); setInterval(kick, 60e3); document.addEventListener('pointerdown', kick, true);
  } catch (e) {}
  // ponytail: preemptive watchdog. The old check ran between autoLesson calls, so a
  // call that never returned hung the loop forever. Now S.running is cut at 12 min.
  const guarded = () => Promise.race([
    __duo.autoLesson(),
    sleep(12 * 60e3).then(() => { __duo.S.running = false; return { ok: false, done: 0, err: 'watchdog' }; }),
  ]);
  if (!challenge() || (m && (+m[1] !== st.unit || +m[2] !== st.level))) await open(st.unit, st.level);
  while (__auto.running && st.running) {
    const t0 = Date.now(); let r = null;
    for (let k = 0; k < 40 && __auto.running; k++) {
      if (Date.now() - t0 > 12 * 60e3) { r = { ok: false, done: 0, err: 'watchdog' }; break; }
      __auto.call = Date.now();
      try { r = await guarded(); } catch (e) { r = { ok: false, done: 0, err: String(e) }; }
      __auto.call = null;
      __auto.out.push(r); if (__auto.out.length > 50) __auto.out.shift();
      if (r.ok || !r.done) break;
    }
    st = load();                                        // autoLesson advanced unit/level or bumped stuck
    if (r.ok && Array.isArray(st.queue)) advance();     // queue mode: ignore autoLesson's count-up
    if (!r.ok && (st.stuck || 0) >= 3) {                // ponytail: 3 strikes then skip, revisit by hand
      const id = 'u' + st.unit + 'l' + st.level;
      st.skipped = st.skipped || []; if (!st.skipped.includes(id)) st.skipped.push(id);
      st.log.push('skip ' + id); st.stuck = 0;
      advance();
    }
    if (st.log.length > 200) st.log = st.log.slice(-200);
    save(); post();
    if (!(await open(st.unit, st.level))) { st.log.push('open failed'); save(); await sleep(30000); }
  }
  __auto.running = false;
})();
