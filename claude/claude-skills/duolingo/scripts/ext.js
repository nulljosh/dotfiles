// Background worker: every full load of a lesson page gets duo.js + boot.js
// injected into the page's own world. Files, not eval, so page CSP is moot and
// a fresh page means a fresh __duo (no wrapper stacking).
// Edit duo.js -> click Reload on chrome://extensions, Chrome caches the files.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return;
  const url = tab.url || '';
  if (/^https:\/\/www\.duolingo\.com\/lesson\/unit\/\d+\/level\/\d+/.test(url)) {
    chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['duo.js', 'boot.js'] })
      .catch(e => console.warn('inject failed', e));
  } else if (/^https:\/\/lichess\.org\/training(\/|$)/.test(url)) {
    chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['chess.js', 'chessBoot.js'] })
      .catch(e => console.warn('inject failed', e));
  }
});
