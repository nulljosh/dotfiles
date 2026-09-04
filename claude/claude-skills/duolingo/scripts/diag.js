// Diagnostic: record per-question what the solver saw, picked, and got.
(function () {
  const D = window.__duo; D.DIAG = [];
  const snap = () => {
    let r = {}; try { r = D.read(); } catch (e) {}
    const ch = [...document.querySelectorAll('[data-test="challenge-choice"]')].map(e => { const a = e.querySelector('annotation'); return a ? a.textContent : D.norm(e.innerText); });
    let ans = null; try { ans = D.answer(); } catch (e) { ans = 'ERR ' + e; }
    let ins = null; try { ins = D.curInstruction(); } catch (e) {}
    let pl = null; try { pl = D.plan(); } catch (e) { pl = 'ERR ' + e; }
    const f = D.frame && D.frame(); const cls = f && f.contentDocument ? [...new Set([...f.contentDocument.querySelectorAll('[class]')].flatMap(e => String(e.className).split(/\s+/)))].filter(c => /token|slider|number-line|grid|table|drop|drag|plot|shape|spinner|piece/i.test(c)).slice(0, 12) : null;
    return { type: r.type, input: !!r.input, ins, latex: (r.latex || []).slice(-3), choices: ch, grader: ans, plan: pl ? (pl.kind || JSON.stringify(pl).slice(0, 120)) : null, frameCls: cls };
  };
  const sc = D.solveChoices;
  D.solveChoices = function () { const s = snap(); let r = null, err = null; try { r = sc.call(this); } catch (e) { err = String(e); } s.pick = r ? { via: r.via, want: r.want, idx: r.idx, ok: r.ok } : null; s.err = err; D.DIAG.push(s); return r; };
  const ta = D.typeAnswer;
  D.typeAnswer = function () { const s = snap(); let r = null, err = null; try { r = ta.call(this); } catch (e) { err = String(e); } s.typed = r; s.err = err; D.DIAG.push(s); return r; };
  const bl = D.blame;
  D.blame = async function () { const b = await bl.call(this); const last = D.DIAG[D.DIAG.length - 1]; if (last && !last.blame) last.blame = b; return b; };
  const r2 = D.run2;
  D.run2 = async function (n) { const r = await r2.call(this, n); const last = D.DIAG[D.DIAG.length - 1]; if (last) last.after = this.S.log.slice(-2); return r; };
})();
// screens with no choices and no input: snapshot the buttons once per instruction
(function () {
  const D = window.__duo, rd = D.read; let lastIns = null;
  D.read = function () {
    const r = rd.call(this);
    if (r.type && !r.choices.length && !r.input) {
      let ins = ''; try { ins = D.curInstruction(); } catch (e) {}
      if (ins !== lastIns) {
        lastIns = ins;
        const bs = [...document.querySelectorAll('button')].map(b => ({ dt: b.getAttribute('data-test'), aria: b.getAttribute('aria-label'), txt: b.innerText.replace(/\s+/g, ' ').slice(0, 30), ann: b.querySelector('annotation') && b.querySelector('annotation').textContent, ifr: !!b.querySelector('iframe') })).filter(b => b.dt || b.ann || b.ifr);
        const b = D.blob();
        D.DIAG.push({ nochoice: true, ins, latex: r.latex.slice(0, 6), bs, layout: b && b.layout, blobKeys: b && Object.keys(b) });
      }
    }
    return r;
  };
})();
