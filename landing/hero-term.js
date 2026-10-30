// Hero terminal: types the real setup behind the headline (clone, brew install, install.sh, exec fish), so the
// plain zsh prompt turns into the Starship powerline, then loops. The newest line sits at the bottom and older lines
// scroll up under the fade. Reduced motion, or ?static in the URL, shows the finished screen instead.
// Pauses while the hero is off screen or the tab is hidden.
(function () {
  var box = document.querySelector('.tty-lines'), hero = document.querySelector('.hero');
  if (!box) return;
  var still = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || /[?&]static\b/.test(location.search);

  function zsh(dir) { return function () { return 'joshua@Mac ' + dir + ' % '; }; }
  function fish() {
    var d = new Date(), t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return '<span class="ps"><b class="u">joshua</b><b class="t">' + t + '</b><b class="d">~/D/Code/dotfiles</b><b class="g">main</b></span><span class="chev">❯</span> ';
  }
  var BREW = '<b class="bl">==&gt;</b> ';
  var SCRIPT = [
    { p: zsh('~'), cmd: 'git clone https://github.com/nulljosh/dotfiles.git ~/Documents/Code/dotfiles',
      out: ['<span class="dim">Cloning into \'/Users/joshua/Documents/Code/dotfiles\'...</span>',
            '<span class="dim">Receiving objects: 100%, done.</span>'] },
    { p: zsh('~'), cmd: 'cd ~/Documents/Code/dotfiles', out: [] },
    { p: zsh('dotfiles'), cmd: 'brew install fish starship eza bat fd fzf zoxide atuin', slow: true,
      out: [BREW + '<b>Fetching</b> fish, starship, eza, bat, fd, fzf, zoxide, atuin',
            BREW + '<b>Pouring</b> fish', BREW + '<b>Pouring</b> starship',
            BREW + '<b>Pouring</b> eza, bat, fd, fzf, zoxide, atuin'] },
    { p: zsh('dotfiles'), cmd: './install.sh',
      out: ['<span class="ok">linked:</span> ~/.config/fish/config.fish',
            '<span class="warn">backup:</span> ~/.zshrc <span class="dim">-&gt;</span> ~/.zshrc.bak',
            '<span class="ok">linked:</span> ~/.zshrc',
            '<span class="ok">linked:</span> ~/.config/ghostty/config',
            '<span class="ok">linked:</span> ~/.config/starship.toml',
            '<span class="ok">linked:</span> ~/.config/starship-terminal.toml',
            '<span class="dim">done. secrets files are NOT managed by this repo.</span>'] },
    { p: zsh('dotfiles'), cmd: 'exec fish', out: [] },
    { p: fish, cmd: 'll',
      out: ['<span class="dim">drwxr-xr-x</span>  <span class="dir">fish</span>',
            '<span class="dim">drwxr-xr-x</span>  <span class="dir">ghostty</span>',
            '<span class="dim">drwxr-xr-x</span>  <span class="dir">starship</span>',
            '<span class="dim">drwxr-xr-x</span>  <span class="dir">zsh</span>',
            '<span class="dim">.rwxr-xr-x</span>  install.sh'] },
    { p: fish, cmd: null }   // the new prompt, waiting
  ];
  var CURSOR = '<span class="cur"></span>';

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function line(html) {
    var d = document.createElement('div');
    d.className = 'ln';
    d.innerHTML = html || ' ';
    box.appendChild(d);
    while (box.children.length > 40) box.removeChild(box.firstChild);
    return d;
  }

  if (still) {
    SCRIPT.forEach(function (s) {
      if (!s.cmd) return line(s.p());
      line(s.p() + esc(s.cmd));
      s.out.forEach(function (o) { line(o); });
    });
    return;
  }

  // wait() holds while paused, so the loop simply stops where it is and carries on when the hero comes back.
  var paused = false, resume = null;
  function wait(ms) {
    return new Promise(function (done) {
      function go() { if (paused) { resume = go; return; } setTimeout(done, ms); }
      go();
    });
  }
  function setPaused(p) {
    paused = p;
    if (!p && resume) { var r = resume; resume = null; r(); }
  }
  document.addEventListener('visibilitychange', function () { setPaused(document.hidden); });
  if ('IntersectionObserver' in window && hero) {
    new IntersectionObserver(function (entries) { setPaused(!entries[0].isIntersecting || document.hidden); }).observe(hero);
  }

  async function play() {
    for (;;) {
      box.innerHTML = '';
      box.classList.remove('fade');
      for (var i = 0; i < SCRIPT.length; i++) {
        var s = SCRIPT[i], prompt = s.p(), ln = line(prompt + CURSOR);
        await wait(i ? 450 : 900);
        if (!s.cmd) { await wait(4200); break; }
        for (var k = 1; k <= s.cmd.length; k++) {
          ln.innerHTML = prompt + esc(s.cmd.slice(0, k)) + CURSOR;
          await wait(24 + Math.random() * 48);
        }
        await wait(360);
        ln.innerHTML = prompt + esc(s.cmd);
        for (var j = 0; j < s.out.length; j++) {
          line(s.out[j]);
          await wait(s.slow ? 480 + Math.random() * 420 : 80 + Math.random() * 90);
        }
      }
      box.classList.add('fade');
      await wait(600);
    }
  }
  play();
})();
