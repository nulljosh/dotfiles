// Quotestreak forever-loop. Runs entirely inside the page (setInterval), so it keeps
// racking up score/high-score even after the Claude Code session that injected it ends —
// as long as the tab stays open. Paste into javascript_tool against play.html, or console.
//
// Strategy: speed round (bonus = ceil(secondsLeft)*10), answered near-instantly every
// question -> near-max bonus every time. Correct answer comes from quotes.json (public,
// same file game.js loads), matched by quote text + type, NOT from quotableGetState()
// (which withholds the answer on purpose so the UI reveal still means something to a human).
(async () => {
  const quotes = await (await fetch('/quotes.json')).json();
  const findAnswer = (q) => {
    const m = quotes.find(x => x.quote === q.quote && x.type === q.type);
    return m ? m.answer : q.options[0]; // fallback should never fire; quotes.json is the source game.js itself uses
  };
  window.__qsLog = window.__qsLog || [];
  let lastQuote = null;
  let games = 0;

  function tick() {
    const state = window.quotableGetState();
    if (!state.inProgress) {
      games++;
      window.__qsLog.push({ event: 'restart', games, highScore: window.quotableGetHighScore(), at: Date.now() });
      window.quotableSetGenre('all');
      window.quotableStartGame(true); // true = timed speed round
      lastQuote = null;
      return;
    }
    // Gate on quote-identity change so a slow tick never double-answers the same
    // question (choose() re-scoring an already-answered question would double-count
    // score/streak and desync the 1100ms auto-advance timer against the pool).
    if (state.question && state.question.quote !== lastQuote) {
      lastQuote = state.question.quote;
      window.quotableChoose(findAnswer(state.question), null);
    }
  }

  clearInterval(window.__quotestreakLoop);
  window.quotableSetGenre('all');
  window.quotableStartGame(true);
  window.__quotestreakLoop = setInterval(tick, 250);
})();
