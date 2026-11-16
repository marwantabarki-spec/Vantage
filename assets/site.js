// VANTAGE site: menu, copy link for Discord, patch filters, scroll reveal, live server status
(function () {
  var body = document.body, ROOT = body.getAttribute('data-root') || '';
  var UNIVERSE = body.getAttribute('data-universe'), PLACE = body.getAttribute('data-place');
  var MODE = body.getAttribute('data-mode') || 'online';
  var toast = document.querySelector('.toast');
  function say(t) {
    if (!toast) return;
    toast.textContent = t; toast.classList.add('show');
    clearTimeout(say.t); say.t = setTimeout(function () { toast.classList.remove('show'); }, 2400);
  }

  // menu
  var burger = document.querySelector('.burger'), nav = document.querySelector('.top .nav');
  if (burger && nav) burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // copy link
  document.querySelectorAll('.js-copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-url');
      function done() { say('Lien copié — colle-le dans Discord pour afficher l’annonce'); }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copie ce lien :', url); });
      else window.prompt('Copie ce lien :', url);
    });
  });

  // patch filters
  var filters = document.querySelectorAll('.f');
  filters.forEach(function (f) {
    f.addEventListener('click', function () {
      filters.forEach(function (x) { x.classList.toggle('on', x === f); });
      var want = f.getAttribute('data-f');
      document.querySelectorAll('.notes li').forEach(function (li) { li.classList.toggle('hide', want !== 'all' && li.getAttribute('data-tag') !== want); });
      document.querySelectorAll('.nsec').forEach(function (s) { s.classList.toggle('empty', !s.querySelector('li:not(.hide)')); });
    });
  });

  // scroll reveal
  if ('IntersectionObserver' in window) {
    var els = document.querySelectorAll('.pcard,.ncard,.rcol,.stat,.nsec,.srv,.box');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el, i) { el.classList.add('rv'); el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });
  }

  // ---------------------------------------------------------------- live status
  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' M';
    if (n >= 1e4) return Math.round(n / 1e3) + ' k';
    return Number(n).toLocaleString('fr-FR');
  }
  function set(key, v) { document.querySelectorAll('[data-stat="' + key + '"]').forEach(function (el) { el.textContent = v; }); }
  function ago(sec) {
    if (!sec) return '—';
    var d = Math.max(0, Math.round(Date.now() / 1000 - sec));
    if (d < 60) return 'à l’instant';
    if (d < 3600) return 'il y a ' + Math.round(d / 60) + ' min';
    return 'il y a ' + Math.round(d / 3600) + ' h';
  }
  function count(el, to) {
    if (to == null) return;
    var from = parseInt((el.getAttribute('data-v') || '0'), 10) || 0, t0 = performance.now();
    el.setAttribute('data-v', to);
    (function step(t) {
      var k = Math.min(1, (t - t0) / 700), v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      el.textContent = fmt(v); if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function render(s) {
    var online = s && s.ok;
    var maint = MODE === 'maintenance', degraded = MODE === 'degraded';
    document.querySelectorAll('[data-stat="playing"]').forEach(function (el) { if (online) count(el, s.playing || 0); else el.textContent = '—'; });
    set('playing-short', online ? fmt(s.playing || 0) : '—');
    set('servers', online ? fmt((s.servers || []).length) : '—');
    set('visits', online ? fmt(s.visits) : '—');
    set('favorites', online ? fmt(s.favorites) : '—');
    var up = s && s.up_votes, down = s && s.down_votes;
    set('rating', up != null && (up + down) > 0 ? Math.round(up * 100 / (up + down)) + ' %' : '—');
    set('age', s ? ago(s.fetched_at) : '—');
    var state = maint ? 'Maintenance en cours' : degraded ? 'Perturbations en cours' : online ? 'Serveurs opérationnels' : 'Statut indisponible';
    set('state', state);
    var banner = document.querySelector('[data-banner]');
    if (banner) banner.classList.toggle('off', !online && !maint);
    document.querySelectorAll('.ldot,.sdot').forEach(function (d) { d.classList.toggle('off', !online && !maint && !degraded); });
    var box = document.querySelector('[data-servers]');
    if (box) {
      var list = (s && s.servers) || [];
      if (!list.length) { box.innerHTML = '<div class="empty">' + (online ? 'Aucun lobby public en ce moment — les joueurs sont peut-être tous en match.' : 'Statut des serveurs indisponible pour le moment.') + '</div>'; return; }
      box.innerHTML = list.map(function (v, i) {
        var pct = v.max ? Math.round(v.playing * 100 / v.max) : 0;
        return '<div class="srv"><div class="srv-h">Lobby ' + String(i + 1).padStart(2, '0') + '<span>' + v.playing + ' / ' + v.max + '</span></div>' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
          '<div class="srv-f"><span>' + (v.fps ? v.fps + ' FPS' : '— FPS') + '</span><span>' + (v.ping != null ? v.ping + ' ms' : '— ms') + '</span></div></div>';
      }).join('');
    }
  }
  function getJSON(url, ms) {
    return new Promise(function (ok, ko) {
      var c = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (c) c.abort(); ko(new Error('timeout')); }, ms || 6000);
      fetch(url, { signal: c ? c.signal : undefined, cache: 'no-store' }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); }).then(ok, ko);
    });
  }
  // 1) status.json written by GitHub Actions (every ~10 min) 2) a live refresh through a public Roblox proxy when it answers
  var current = null;
  function live() {
    if (!UNIVERSE) return Promise.reject();
    return getJSON('https://games.roproxy.com/v1/games?universeIds=' + UNIVERSE, 5000).then(function (d) {
      var g = d && d.data && d.data[0]; if (!g) throw new Error('empty');
      var s = Object.assign({}, current || {}, { ok: true, playing: g.playing, visits: g.visits, favorites: g.favoritedCount, fetched_at: Math.floor(Date.now() / 1000) });
      return getJSON('https://games.roproxy.com/v1/games/' + PLACE + '/servers/Public?limit=100', 5000).then(function (sv) {
        s.servers = (sv.data || []).map(function (x) { return { playing: x.playing || 0, max: x.maxPlayers || 0, fps: Math.round(x.fps || 0), ping: x.ping }; });
        return s;
      }, function () { return s; });
    });
  }
  function refresh() {
    getJSON(ROOT + 'status.json?t=' + Date.now(), 6000).then(function (s) { current = s; render(s); }, function () { if (!current) render(null); })
      .then(function () { return live().then(function (s) { current = s; render(s); }, function () {}); });
  }
  if (document.querySelector('[data-stat]')) { refresh(); setInterval(refresh, 60000); }
})();

// ---------------------------------------------------------------- patch notes index : filter, search, load more
(function () {
  var grid = document.querySelector('[data-pgrid]'); if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.pc2'));
  var feat = document.querySelector('.pfeat'), more = document.querySelector('[data-pmore]'), empty = document.querySelector('.pempty');
  var input = document.querySelector('.psearch input'), cat = '', q = '', shown = 6;
  function match(el) { return (!cat || (el.dataset.cats || '').split('|').indexOf(cat) >= 0) && (!q || (el.dataset.q || '').indexOf(q) >= 0); }
  function apply() {
    var n = 0, total = 0;
    cards.forEach(function (c) { var ok = match(c); if (ok) total++; c.hidden = !ok || ++n > shown; if (!ok) n = n; });
    var fok = feat ? match(feat) : false; if (feat) feat.hidden = !fok;
    if (more) more.hidden = total <= shown;
    if (empty) empty.hidden = total > 0 || fok;
  }
  document.querySelectorAll('.pchip').forEach(function (b) { b.addEventListener('click', function () {
    document.querySelectorAll('.pchip').forEach(function (x) { x.classList.toggle('on', x === b); }); cat = b.dataset.cat; shown = 6; apply(); }); });
  if (input) input.addEventListener('input', function () { q = input.value.trim().toLowerCase(); shown = 6; apply(); });
  if (more) more.addEventListener('click', function () { shown += 6; apply(); });
  apply();
})();
