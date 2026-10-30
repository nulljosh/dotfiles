// Landing behaviour: fade-up on scroll and the copy button. Nothing here is needed to read the page.
(function () {
  document.documentElement.classList.add('js');
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (still || !('IntersectionObserver' in window)) { items.forEach(function (e) { e.classList.add('in'); }); }
    else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      items.forEach(function (e) { io.observe(e); });
    }

    document.querySelectorAll('.copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = document.getElementById(btn.dataset.target).innerText.replace(/^\$ /gm, '');
        var done = function (msg) { btn.textContent = msg; setTimeout(function () { btn.textContent = 'Copy'; }, 1600); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { done('Copied'); }, function () { done('Select to copy'); });
        else done('Select to copy');
      });
    });
  });
})();
