// VANTAGE site: mobile menu, "copy link for Discord", patch note filters
(function () {
  var toast = document.querySelector('.toast');
  function say(t) {
    if (!toast) return;
    toast.textContent = t; toast.classList.add('show');
    clearTimeout(say.t); say.t = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  var burger = document.querySelector('.burger'), nav = document.querySelector('.nav');
  if (burger && nav) burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.querySelectorAll('.js-copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-url');
      function done() { say('Lien copié — colle-le dans Discord pour afficher l’annonce'); }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copie ce lien :', url); });
      } else { window.prompt('Copie ce lien :', url); }
    });
  });

  var filters = document.querySelectorAll('.f');
  filters.forEach(function (f) {
    f.addEventListener('click', function () {
      filters.forEach(function (x) { x.classList.toggle('on', x === f); });
      var want = f.getAttribute('data-f');
      document.querySelectorAll('.notes li').forEach(function (li) {
        li.classList.toggle('hide', want !== 'all' && li.getAttribute('data-tag') !== want);
      });
      document.querySelectorAll('.nsec').forEach(function (s) {
        s.classList.toggle('empty', !s.querySelector('li:not(.hide)'));
      });
    });
  });
})();
