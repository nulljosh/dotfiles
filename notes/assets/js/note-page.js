(function () {
  var body = document.body;
  var file = body.getAttribute('data-file');
  var title = body.getAttribute('data-title') || file;
  var titleEl = document.getElementById('note-title');
  var fileEl = document.getElementById('note-file');
  var contentEl = document.getElementById('note-content');
  document.title = title + ' - notes';

  if (titleEl) titleEl.textContent = title;
  if (fileEl) fileEl.textContent = file;

  fetch(file)
    .then(function (res) {
      if (!res.ok) {
        throw new Error('Could not load ' + file + ' (' + res.status + ')');
      }
      return res.text();
    })
    .then(function (markdown) {
      if (!window.marked) {
        contentEl.innerHTML = '<p class="error">Markdown parser failed to load.</p>';
        return;
      }
      contentEl.innerHTML = window.marked.parse(markdown);
    })
    .catch(function (err) {
      contentEl.innerHTML = '<p class="error">' + err.message + '</p>';
    });
})();
