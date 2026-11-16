// VANTAGE admin. Edits data/*.json in the GitHub repository through the GitHub API (a commit per save); GitHub
// Actions then rebuilds and publishes the site. Keys are kept in this browser only (localStorage).
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = { get: function (k) { try { return localStorage.getItem('vtg_' + k) || ''; } catch (e) { return ''; } },
             set: function (k, v) { try { localStorage.setItem('vtg_' + k, v); } catch (e) {} },
             del: function (k) { try { localStorage.removeItem('vtg_' + k); } catch (e) {} } };
  var toastEl = $('.toast');
  function say(t, bad) { toastEl.textContent = t; toastEl.style.background = bad ? '#ff4d4d' : ''; toastEl.classList.add('show'); clearTimeout(say.t); say.t = setTimeout(function () { toastEl.classList.remove('show'); }, 3200); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function slug(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || ('item-' + Date.now()); }
  var sync = $('#sync');
  function setSync(t, cls) { sync.textContent = t; sync.className = 'adm-sync ' + (cls || ''); }

  // ------------------------------------------------------------------ GitHub
  var KEY = { repo: LS.get('repo') || 'marwantabarki-spec/Vantage', gh: LS.get('gh'), wh: LS.get('wh'), ai: LS.get('ai') };
  var BRANCH = 'main';
  var SHA = {};
  function b64enc(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64dec(b) { return decodeURIComponent(escape(atob(b.replace(/\n/g, '')))); }
  function gh(path, opts) {
    opts = opts || {};
    var h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (KEY.gh) h.Authorization = 'Bearer ' + KEY.gh;
    if (opts.body) h['Content-Type'] = 'application/json';
    return fetch('https://api.github.com/repos/' + KEY.repo + path, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error((j && j.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; } return j; }); });
  }
  function readJSON(file) {
    return gh('/contents/' + file + '?ref=' + BRANCH + '&t=' + Date.now()).then(function (j) { SHA[file] = j.sha; return JSON.parse(b64dec(j.content)); });
  }
  function putFile(file, b64, message) {
    var body = { message: message, content: b64, branch: BRANCH };
    if (SHA[file]) body.sha = SHA[file];
    return gh('/contents/' + file, { method: 'PUT', body: body }).then(function (j) { SHA[file] = j.content && j.content.sha; return j; });
  }
  function writeJSON(file, data, message) {
    setSync('Publication…', 'busy');
    return putFile(file, b64enc(JSON.stringify(data, null, 2) + '\n'), message).then(function () {
      setSync('Publié · en ligne dans ~1 min', 'ok'); say('Enregistré. Le site se met à jour dans environ une minute.'); renderDash();
    }, function (e) {
      if (e.status === 409 || e.status === 422) { say('Le fichier a changé ailleurs : recharge la page puis recommence.', true); }
      else say('Erreur GitHub : ' + e.message, true);
      setSync('Erreur', 'err'); throw e;
    });
  }

  var D = { site: null, news: [], patches: [], roadmap: null };
  function loadAll() {
    if (!KEY.gh) { setSync('Non connecté'); openTab('keys'); return; }
    setSync('Chargement…', 'busy');
    return Promise.all([readJSON('data/site.json'), readJSON('data/news.json').catch(function () { return []; }), readJSON('data/patches.json'), readJSON('data/roadmap.json')])
      .then(function (r) {
        D.site = r[0]; D.news = r[1]; D.patches = r[2]; D.roadmap = r[3];
        setSync('Connecté', 'ok'); renderNewsList(); renderPatchList(); renderRoad(); renderSite(); renderDash(); loadLog();
        if ($('.tab.on').id === 'tab-keys') openTab('dash');
      }, function (e) { setSync('Erreur', 'err'); say(e.status === 401 ? 'Jeton GitHub refusé : vérifie-le dans Connexion.' : e.status === 404 ? 'Dépôt introuvable ou jeton sans accès à ce dépôt.' : 'Erreur : ' + e.message, true); openTab('keys'); });
  }
  function siteURL() { return (D.site && D.site.base_url ? D.site.base_url.replace(/\/$/, '') : ''); }
  function rawURL(path) { return 'https://raw.githubusercontent.com/' + KEY.repo + '/' + BRANCH + '/' + path; }

  // ------------------------------------------------------------------ tabs
  function openTab(t) { if (t === 'dash') renderDash(); $$('.adm-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); }); $$('.tab').forEach(function (s) { s.classList.toggle('on', s.id === 'tab-' + t); }); }
  $$('.adm-tabs button').forEach(function (b) { b.addEventListener('click', function () { openTab(b.dataset.tab); }); });

  // ------------------------------------------------------------------ keys
  $('#k-repo').value = KEY.repo; $('#k-gh').value = KEY.gh; $('#k-wh').value = KEY.wh; $('#k-ai').value = KEY.ai;
  $('#k-save').addEventListener('click', function () {
    KEY.repo = $('#k-repo').value.trim() || 'marwantabarki-spec/Vantage'; KEY.gh = $('#k-gh').value.trim(); KEY.wh = $('#k-wh').value.trim(); KEY.ai = $('#k-ai').value.trim();
    LS.set('repo', KEY.repo); LS.set('gh', KEY.gh); LS.set('wh', KEY.wh); LS.set('ai', KEY.ai);
    loadAll();
  });
  $('#k-clear').addEventListener('click', function () { ['repo', 'gh', 'wh', 'ai'].forEach(LS.del); location.reload(); });

  // ------------------------------------------------------------------ images
  var imgCallback = null, dlg = $('#imgdlg');
  function pickImage(cb, aiHint) {
    imgCallback = cb;
    if (aiHint) $('#ai-prompt').value = aiHint;
    $('#ai-out').innerHTML = ''; $('#ai-state').textContent = '';
    dlg.showModal(); loadLibrary();
  }
  $$('.dlg-tabs button').forEach(function (b) { b.addEventListener('click', function () {
    $$('.dlg-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
    $$('.dlg-p').forEach(function (p) { p.classList.toggle('on', p.dataset.ip === b.dataset.it); });
  }); });
  function choose(path) { dlg.close(); if (imgCallback) imgCallback(path); }
  function loadLibrary() {
    var box = $('#img-lib'); box.innerHTML = '<div class="empty">Chargement…</div>';
    Promise.all([gh('/contents/assets/img?ref=' + BRANCH).catch(function () { return []; }), gh('/contents/assets/img/uploads?ref=' + BRANCH).catch(function () { return []; })]).then(function (r) {
      var files = r[1].concat(r[0]).filter(function (f) { return f.type === 'file' && /\.(jpe?g|png|webp)$/i.test(f.name); });
      if (!files.length) { box.innerHTML = '<div class="empty">Aucune image pour l’instant.</div>'; return; }
      box.innerHTML = files.map(function (f) { return '<button type="button" data-p="' + esc(f.path) + '" title="' + esc(f.name) + '"><img src="' + esc(rawURL(f.path)) + '" alt="" loading="lazy"></button>'; }).join('');
      $$('button', box).forEach(function (b) { b.addEventListener('click', function () { choose(b.dataset.p); }); });
    });
  }
  // every image goes through a canvas: max 1600 px wide, JPEG 86 % (small files, quick pages)
  function toJpegB64(src) {
    return new Promise(function (ok, ko) {
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () {
        var w = Math.min(1600, im.naturalWidth), h = Math.round(im.naturalHeight * w / im.naturalWidth);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        ok(c.toDataURL('image/jpeg', 0.86).split(',')[1]);
      };
      im.onerror = ko; im.src = src;
    });
  }
  function uploadB64(b64, base) {
    var path = 'assets/img/uploads/' + slug(base || 'image') + '-' + Date.now().toString(36) + '.jpg';
    setSync('Envoi de l’image…', 'busy');
    return putFile(path, b64, 'Image : ' + path).then(function () { setSync('Image ajoutée', 'ok'); return path; }, function (e) { setSync('Erreur', 'err'); say('Envoi impossible : ' + e.message, true); throw e; });
  }
  function handleFile(f) {
    if (!f || !/^image\//.test(f.type)) return say('Choisis un fichier image.', true);
    var rd = new FileReader();
    rd.onload = function () { toJpegB64(rd.result).then(function (b) { return uploadB64(b, f.name.replace(/\.[^.]+$/, '')); }).then(choose, function () {}); };
    rd.readAsDataURL(f);
  }
  var drop = $('#drop');
  $('#img-file').addEventListener('change', function (e) { handleFile(e.target.files[0]); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleFile(e.dataTransfer.files[0]); });

  var STYLES = {
    patch: 'Key art for a video game patch notes announcement. Stylised low-poly blocky 3D render, dark near-black background, dramatic orange (#ff6a1a) rim lighting, cinematic depth of field, sharp details, empty space on the left side for a title, no text, no letters, no logos, no watermark. Subject: ',
    roadmap: 'Key art for a video game season roadmap. Stylised low-poly blocky 3D render, a tactical battle royale island seen from above at dusk, glowing orange route markers linking several points of interest, dark moody atmosphere, orange (#ff6a1a) accents, no text, no letters, no logos. Theme: ',
    event: 'Promotional key art for a limited-time event in a tactical battle royale video game. Stylised low-poly blocky 3D render, dark background, intense orange and amber lighting, cinematic, no text, no letters, no logos. Event: ',
    free: ''
  };
  $('#ai-go').addEventListener('click', function () {
    if (!KEY.ai) { say('Ajoute ta clé OpenAI dans Connexion.', true); return; }
    var desc = $('#ai-prompt').value.trim(); if (!desc) { say('Écris une description.', true); return; }
    var prompt = STYLES[$('#ai-style').value] + desc;
    var st = $('#ai-state'), btn = $('#ai-go'), t0 = Date.now();
    btn.disabled = true; st.textContent = 'Génération en cours… (20 à 60 s)';
    var tick = setInterval(function () { st.textContent = 'Génération en cours… ' + Math.round((Date.now() - t0) / 1000) + ' s'; }, 1000);
    fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY.ai },
      body: JSON.stringify({ model: 'gpt-image-1', prompt: prompt, size: '1536x1024', quality: $('#ai-q').value, n: 1 })
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); return j; }); })
      .then(function (j) {
        var b = j.data && j.data[0] && j.data[0].b64_json; if (!b) throw new Error('Réponse vide');
        var src = 'data:image/png;base64,' + b;
        $('#ai-out').innerHTML = '<img src="' + src + '" alt=""><div class="row"><button type="button" class="btn btn-primary" id="ai-use">Utiliser cette image</button><button type="button" class="btn btn-ghost" id="ai-again">Regénérer</button></div>';
        st.textContent = 'Terminé.';
        $('#ai-use').addEventListener('click', function () { toJpegB64(src).then(function (jb) { return uploadB64(jb, 'ia-' + desc.slice(0, 30)); }).then(choose, function () {}); });
        $('#ai-again').addEventListener('click', function () { $('#ai-go').click(); });
      }, function (e) {
        st.textContent = '';
        say('OpenAI : ' + e.message + (/billing|quota|verify|organization/i.test(e.message) ? ' — vérifie le crédit / la vérification de ton compte sur platform.openai.com' : ''), true);
      }).then(function () { clearInterval(tick); btn.disabled = false; });
  });

  function imageField(get, set, aiHint) {
    var wrap = document.createElement('div'); wrap.className = 'imgpick';
    function draw() {
      var p = get();
      wrap.innerHTML = '<img src="' + esc(p ? rawURL(p) : '') + '" alt=""><div><div class="hint">' + esc(p || 'Aucune image') + '</div><div class="row" style="margin-top:6px"><button type="button" class="btn btn-ghost sm">Changer l’image</button></div></div>';
      $('button', wrap).addEventListener('click', function () { pickImage(function (np) { set(np); draw(); }, aiHint()); });
    }
    draw(); return wrap;
  }

  // ------------------------------------------------------------------ Discord webhook
  function postDiscord(o) {
    if (!KEY.wh) { say('Ajoute l’URL du webhook Discord dans Connexion.', true); return Promise.reject(); }
    var payload = { username: 'VANTAGE', content: o.content || '', embeds: [{ title: o.title, description: o.text, url: o.url, color: 0xff6a1a,
      image: o.image ? { url: rawURL(o.image) } : undefined, footer: { text: 'VANTAGE · ' + (o.footer || 'Annonce') }, timestamp: new Date().toISOString() }] };
    return fetch(KEY.wh.replace(/\?.*$/, '') + '?wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.message || ('HTTP ' + r.status)); return j; }); })
      .then(function (msg) {
        say('Publié sur Discord !');
        // link of the message: guild id is not in the webhook answer, so the "View on Discord" button keeps the invite unless pasted by hand
        return msg;
      }, function (e) { say('Discord : ' + e.message, true); throw e; });
  }

  // ------------------------------------------------------------------ NEWS
  var curNews = -1;
  function renderNewsList() {
    var l = $('#news-list');
    l.innerHTML = D.news.map(function (n, i) { return '<button class="li' + (i === curNews ? ' on' : '') + '" data-i="' + i + '">' + (n.draft ? '<span class="drb">Brouillon</span> ' : '') + (n.pinned ? '📌 ' : '') + esc(n.title) + '<small>' + esc(n.date) + ' · ' + esc(n.tag || '') + '</small></button>'; }).join('') || '<div class="empty">Aucune annonce.</div>';
    $$('.li', l).forEach(function (b) { b.addEventListener('click', function () { editNews(+b.dataset.i); }); });
  }
  $('#news-new').addEventListener('click', function () {
    if (!D.site) return say('Connecte-toi d’abord.', true);
    D.news.unshift({ id: '', title: 'Nouvelle annonce', date: today(), tag: 'Annonce', pinned: false, text: '', image: D.site.default_image, link: '', discord_message: '' });
    curNews = 0; renderNewsList(); editNews(0);
  });
  function field(label, val, attrs) { return '<label>' + label + '<input value="' + esc(val) + '" ' + (attrs || '') + '></label>'; }
  function editNews(i) {
    curNews = i; renderNewsList();
    var n = D.news[i], box = $('#news-edit');
    window.VTG.page.news(n, box, {
      save: function () {
        if (!n.id) n.id = slug(n.title);
        if (D.news.some(function (x, j) { return j !== i && x.id === n.id; })) n.id += '-' + Date.now().toString(36);
        if (n.gallery && !n.gallery.length) delete n.gallery;
        writeJSON('data/news.json', D.news, (n.draft ? 'Brouillon annonce : ' : 'Annonce : ') + n.title).then(renderNewsList, function () {});
      },
      del: function () {
        if (!confirm('Supprimer « ' + n.title + ' » du site ?')) return;
        D.news.splice(i, 1); curNews = -1; box.innerHTML = '<div class="empty">Annonce supprimée.</div>';
        writeJSON('data/news.json', D.news, 'Suppression annonce : ' + n.title).then(renderNewsList, function () {});
      }
    });
    draftToggle(n, box);
  }


  // ------------------------------------------------------------------ PATCHES
  var curPatch = -1;
  function vnum(v) { return String(v).split('.').map(function (x) { return ('000' + (parseInt(x, 10) || 0)).slice(-4); }).join('.'); }
  function cmpPatch(a, b) { if (a.date !== b.date) return a.date < b.date ? 1 : -1; return vnum(a.version) < vnum(b.version) ? 1 : vnum(a.version) > vnum(b.version) ? -1 : 0; }
  function autosize(root) { $$('textarea', root).forEach(function (t) { var f = function () { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }; f(); t.addEventListener('input', f); }); }
  var TAGS = [['new', 'Nouveau'], ['update', 'Amélioration'], ['fix', 'Correction'], ['perf', 'Performances'], ['balance', 'Équilibrage']];
  function renderPatchList() {
    var l = $('#patch-list');
    D.patches.sort(cmpPatch);
    l.innerHTML = D.patches.map(function (p, i) { return '<button class="li' + (i === curPatch ? ' on' : '') + '" data-i="' + i + '">' + (p.draft ? '<span class="drb">Brouillon</span> ' : '') + 'v' + esc(p.version) + ' · ' + esc(p.title) + '<small>' + esc(p.date) + '</small></button>'; }).join('');
    $$('.li', l).forEach(function (b) { b.addEventListener('click', function () { editPatch(+b.dataset.i); }); });
  }
  $('#patch-new').addEventListener('click', function () {
    if (!D.site) return say('Connecte-toi d’abord.', true);
    var last = D.patches[0], v = last ? last.version.split('.').map(Number) : [1, 0, 0];
    if (last) v[2] += 1;
    D.patches.unshift({ slug: '', version: v.join('.'), title: 'Nouveau patch', date: today(), image: D.site.default_image, summary: '', discord_message: '', highlights: [], sections: [{ title: 'Nouveautés', items: [{ tag: 'new', text: '' }] }] });
    curPatch = 0; renderPatchList(); editPatch(0);
  });
  function editPatch(i) {
    curPatch = i; renderPatchList();
    var p = D.patches[i], box = $('#patch-edit');
    window.VTG.page.patch(p, box, {
      save: function () {
        p.highlights = (p.highlights || []).map(function (h) { return String(h).trim(); }).filter(Boolean);
        p.sections = p.sections.map(function (s) { var o = { title: s.title, items: s.items.filter(function (it) { return String(it.text).trim(); }) }; if (s.image) o.image = s.image; return o; }).filter(function (s) { return s.items.length; });
        if (!p.sections.length) return say('Ajoute au moins un changement.', true);
        if (!p.slug) p.slug = slug(p.version + '-' + p.title);
        D.patches.sort(cmpPatch);
        writeJSON('data/patches.json', D.patches, (p.draft ? 'Brouillon patch v' : 'Patch v') + p.version + ' : ' + p.title).then(function () { D.patches.sort(cmpPatch); editPatch(D.patches.indexOf(p)); }, function () {});
      },
      del: function () {
        if (!confirm('Supprimer le patch v' + p.version + ' du site ?')) return;
        D.patches.splice(i, 1); curPatch = -1; box.innerHTML = '<div class="empty">Patch supprimé.</div>';
        writeJSON('data/patches.json', D.patches, 'Suppression patch v' + p.version).then(renderPatchList, function () {});
      }
    });
    draftToggle(p, box);
  }


  // ------------------------------------------------------------------ ROADMAP
  function renderRoad() {
    window.VTG.page.road(D.roadmap, $('#road-board'), saveRoad);
  }
  function saveRoad() {
    if (!D.roadmap) return say('Connecte-toi d’abord.', true);
    D.roadmap.columns.forEach(function (c) { c.items = c.items.filter(function (it) { return String(it.title || '').trim(); }); });
    writeJSON('data/roadmap.json', D.roadmap, 'Roadmap').then(renderRoad, function () {});
  }


  // ------------------------------------------------------------------ SITE
  function renderSite() {
    var s = D.site; s.status = s.status || { mode: 'online', message: '' };
    $('#s-mode').value = s.status.mode || 'online'; $('#s-msg').value = s.status.message || '';
    $('#s-ticker').value = (s.ticker || []).join('\n'); $('#s-discord').value = s.discord_invite || ''; $('#s-roblox').value = s.roblox_url || '';
  }
  $('#site-save').addEventListener('click', function () {
    if (!D.site) return say('Connecte-toi d’abord.', true);
    var s = D.site;
    s.status = { mode: $('#s-mode').value, message: $('#s-msg').value.trim() };
    s.ticker = $('#s-ticker').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    s.discord_invite = $('#s-discord').value.trim(); s.roblox_url = $('#s-roblox').value.trim();
    writeJSON('data/site.json', s, 'Réglages du site (' + s.status.mode + ')').catch(function () {});
  });


  // ------------------------------------------------------------------ drafts
  // draft:true keeps an item in data/*.json but build.py leaves it off the public site
  function draftToggle(o, box) {
    var b = $('.pe-bar', box); if (!b) return;
    var l = document.createElement('label'); l.className = 'chk drafttg';
    l.innerHTML = '<input type="checkbox"' + (o.draft ? ' checked' : '') + '><span><b>Brouillon</b> — enregistré sur GitHub mais caché du site public. Décoche puis « Enregistrer et publier » pour le mettre en ligne.</span>';
    $('input', l).addEventListener('change', function (e) { if (e.target.checked) o.draft = true; else delete o.draft; renderNewsList(); renderPatchList(); });
    b.insertBefore(l, b.firstChild);
  }

  // ------------------------------------------------------------------ DASHBOARD
  var DF = 'all';
  function fmtN(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR'); }
  function shortD(d) { var a = String(d || '').split('-'); return a.length === 3 ? a[2] + '.' + a[1] : esc(d); }
  function renderDash() {
    var dd = $('#dash-date'); if (!dd) return;
    dd.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('#repo-name').textContent = KEY.repo;
    var rows = [];
    D.news.forEach(function (n, i) { rows.push({ k: 'news', i: i, type: 'Annonce', title: n.title, draft: !!n.draft, disc: !!n.discord_message, date: n.date }); });
    D.patches.forEach(function (p, i) { rows.push({ k: 'patch', i: i, type: 'Patch', title: 'v' + p.version + ' · ' + p.title, draft: !!p.draft, disc: !!p.discord_message, date: p.date }); });
    rows.sort(function (a, b) { return a.draft !== b.draft ? (a.draft ? -1 : 1) : (a.date < b.date ? 1 : a.date > b.date ? -1 : 0); });
    $('#df-n').textContent = rows.filter(function (r) { return r.draft; }).length;
    var q = ($('#d-search').value || '').toLowerCase();
    var list = rows.filter(function (r) { return (DF === 'all' || (DF === 'draft') === r.draft) && (!q || r.title.toLowerCase().indexOf(q) >= 0); });
    $('#d-rows').innerHTML = list.map(function (r) {
      return '<button class="drow' + (r.draft ? ' isdraft' : '') + '" data-k="' + r.k + '" data-i="' + r.i + '"><span class="pill">' + r.type + '</span><span class="dt">' + esc(r.title) + '</span>' +
        '<span class="pill ' + (r.draft ? 'p-draft' : 'p-live') + '">' + (r.draft ? 'Brouillon' : 'Publié') + '</span>' +
        '<span class="dd ' + (r.disc ? 'd-ok' : '') + '">' + (r.disc ? '✓ envoyé' : '—') + '</span><span class="dd">' + shortD(r.date) + '</span></button>';
    }).join('') || '<div class="empty">' + (D.site ? 'Rien ici.' : 'Connecte-toi pour voir tes contenus.') + '</div>';
    $$('.drow[data-k]', $('#d-rows')).forEach(function (b) { b.addEventListener('click', function () {
      if (b.dataset.k === 'news') { openTab('news'); editNews(+b.dataset.i); } else { openTab('patches'); editPatch(+b.dataset.i); }
    }); });
    var st = (D.site && D.site.status) || { mode: 'online' };
    var lab = { online: 'En ligne', degraded: 'Perturbations', maintenance: 'Maintenance' };
    $('#kp-mode').textContent = D.site ? (lab[st.mode] || st.mode) : '—';
    $('#kp-mode').className = 'm-' + st.mode;
    $('#kp-toggle').textContent = st.mode === 'maintenance' ? 'Repasser en ligne' : 'Activer la maintenance';
  }
  $$('.dfilt button').forEach(function (b) { b.addEventListener('click', function () { DF = b.dataset.df; $$('.dfilt button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderDash(); }); });
  $('#d-search').addEventListener('input', renderDash);
  $('#kp-toggle').addEventListener('click', function () {
    if (!D.site) return say('Connecte-toi d’abord.', true);
    if ((D.site.status || {}).mode === 'maintenance') runCmd('/enligne'); else runCmd('/maintenance');
  });
  function loadStats() {
    fetch('../status.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (s) {
      if (!s || !s.ok) { $('#kp-age').textContent = 'pas encore relevé'; return; }
      $('#kp-playing').textContent = fmtN(s.playing); $('#kp-servers').textContent = fmtN((s.servers || []).length); $('#kp-visits').textContent = fmtN(s.visits);
      $('#kp-fav').textContent = fmtN(s.favorites) + ' favoris';
      if (s.fetched_at) $('#kp-age').textContent = 'relevé il y a ' + Math.max(0, Math.round((Date.now() / 1000 - s.fetched_at) / 60)) + ' min';
    }).catch(function () { $('#kp-age').textContent = 'indisponible'; });
  }
  function loadLog() {
    if (!KEY.gh) return;
    gh('/commits?per_page=8&sha=' + BRANCH).then(function (list) {
      $('#d-log').innerHTML = list.map(function (c) {
        var d = new Date(c.commit.author.date), diff = (Date.now() - d) / 60000;
        var when = diff < 60 ? Math.round(diff) + ' min' : diff < 1440 ? Math.round(diff / 60) + ' h' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        return '<div class="lrow"><span>' + when + '</span><span>' + esc(c.commit.message.split('\n')[0]) + '</span></div>';
      }).join('') || '<div class="empty">Aucun commit.</div>';
    }).catch(function () { $('#d-log').innerHTML = '<div class="empty">Historique indisponible.</div>'; });
  }

  // ------------------------------------------------------------------ COMMAND BAR
  // One line  : /annonce Titre #Tag            -> draft + editor
  // Full block (Shift+Entrée for new lines)    -> everything filled in one go, see TPL below
  var TPL = {
    annonce: '/annonce Double XP ce week-end #Événement !épingler\nimage: crimson\ngalerie: spectre, loadout\nlien: \n---\nTout le week-end, l’XP est doublée sur tous les modes.\nRendez-vous vendredi 18 h !\n!publier !discord',
    patch: '/patch 1.8.0 Nouvelle carte\nimage: spectre\nrésumé: Une nouvelle carte, des armes rééquilibrées et des corrections.\n* Nouvelle carte : Nordhaven\n* Recul du VX-9 réduit\n## Nouveautés\n+ Nouvelle carte Nordhaven avec 6 zones\n## Équilibrage\n= VX-9 : recul vertical réduit de 10 %\n## Corrections\n! Correction du crash au largage\n~ Chargement des textures plus rapide\n!publier !discord',
    roadmap: '/roadmap prévu Mode classé\ntexte: Rangs, saisons classées et récompenses de fin de saison.\ntag: Saison 2\nimage: \n!publier'
  };
  var CMDS = [
    { c: '/annonce', a: 'Titre #Tag', d: 'Brouillon d’annonce (une ligne) ou annonce complète (bloc)' },
    { c: '/patch', a: '1.8.0 Titre', d: 'Brouillon de patch ou patch complet avec sections' },
    { c: '/roadmap', a: 'prévu Titre', d: 'Carte : sorti, encours, prévu ou idée' },
    { c: '/modele', a: 'annonce | patch | roadmap', d: 'Insère un bloc complet à remplir' },
    { c: '/maintenance', a: 'Message', d: 'Bandeau maintenance sur le site' },
    { c: '/enligne', a: '', d: 'Retire le bandeau' },
    { c: '/aide', a: '', d: 'Syntaxe complète' }
  ];
  var cin = $('#cmd-in'), pop = $('#cmd-pop'), sel = 0, shownCmds = [];
  function grow() { cin.style.height = 'auto'; cin.style.height = Math.min(cin.scrollHeight, 420) + 'px'; $('#cmd').classList.toggle('multi', cin.value.indexOf('\n') >= 0); }
  function drawPop() {
    var v = cin.value.trim(), head = v.split(/\s+/)[0].toLowerCase();
    shownCmds = v.indexOf('\n') >= 0 ? [] : CMDS.filter(function (x) { return !v || x.c.indexOf(head) === 0 || head.indexOf(x.c) === 0; });
    if (!shownCmds.length || document.activeElement !== cin) { pop.hidden = true; return; }
    sel = Math.min(sel, shownCmds.length - 1);
    pop.innerHTML = shownCmds.map(function (x, i) { return '<button type="button" role="option" class="' + (i === sel ? 'on' : '') + '" data-c="' + x.c + '"><b>' + x.c + '</b><em>' + esc(x.a) + '</em><span>' + esc(x.d) + '</span></button>'; }).join('') +
      '<div class="cmd-tpl">Modèle complet : <button type="button" data-t="annonce">Annonce</button><button type="button" data-t="patch">Patch</button><button type="button" data-t="roadmap">Roadmap</button><small>Shift+Entrée = nouvelle ligne · Entrée = créer</small></div>';
    pop.hidden = false;
    $$('button[data-c]', pop).forEach(function (b) { b.addEventListener('mousedown', function (e) { e.preventDefault(); cin.value = b.dataset.c + ' '; sel = 0; grow(); drawPop(); cin.focus(); }); });
    $$('button[data-t]', pop).forEach(function (b) { b.addEventListener('mousedown', function (e) { e.preventDefault(); useTpl(b.dataset.t); }); });
  }
  function useTpl(t) { cin.value = TPL[t]; grow(); pop.hidden = true; cin.focus(); cin.setSelectionRange(cin.value.indexOf(' ') + 1, cin.value.indexOf('\n')); }
  cin.addEventListener('input', function () { sel = 0; grow(); drawPop(); });
  cin.addEventListener('focus', drawPop);
  cin.addEventListener('blur', function () { setTimeout(function () { pop.hidden = true; }, 120); });
  cin.addEventListener('keydown', function (e) {
    var multi = cin.value.indexOf('\n') >= 0;
    if (!multi && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && shownCmds.length) { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shownCmds.length) % shownCmds.length; drawPop(); }
    else if (!multi && e.key === 'Tab' && shownCmds[sel]) { e.preventDefault(); var parts = cin.value.trim().split(/\s+/); if (!parts[0] || shownCmds[sel].c.indexOf(parts[0].toLowerCase()) === 0) { cin.value = shownCmds[sel].c + ' ' + parts.slice(1).join(' '); grow(); drawPop(); } }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); var v = cin.value.trim(); if (!v) return;
      if (v.charAt(0) !== '/') v = '/annonce ' + v;
      var head = v.split(/\s+/)[0].toLowerCase();
      if (!multi && !CMDS.some(function (x) { return x.c === head; }) && shownCmds[sel]) v = shownCmds[sel].c + v.slice(head.length);
      Promise.resolve(runCmd(v)).then(function (r) { if (r !== false) { cin.value = ''; grow(); pop.hidden = true; cin.blur(); } }); }
    else if (e.key === 'Escape') { if (!multi) cin.value = ''; grow(); cin.blur(); }
  });
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cin.focus(); cin.select(); } });
  $$('[data-cmd]').forEach(function (b) { b.addEventListener('click', function () { var t = b.dataset.cmd.replace(/^\/|\s+$/g, ''); if (TPL[t]) useTpl(t); else { cin.value = b.dataset.cmd; cin.focus(); drawPop(); } }); });

  var COLS = { done: ['sorti', 'sortie', 'done', 'fait'], progress: ['encours', 'en-cours', 'cours', 'dev', 'developpement', 'progress'], planned: ['prevu', 'planned', 'bientot', 'prochain'], ideas: ['idee', 'idees', 'etude', 'ideas'] };
  var KEYS = ['tag', 'categorie', 'image', 'header', 'banniere', 'carte', 'card', 'galerie', 'gallery', 'lien', 'date', 'texte', 'resume', 'summary', 'version', 'titre', 'colonne'];
  var ITEM = { '+': 'new', '^': 'update', '=': 'balance', '!': 'fix', '~': 'perf', '-': 'new' };
  function plain(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // parse a full block: header line, "clé: valeur" lines, flags (!publier !discord !épingler), ## sections, item lines, * highlights, free text
  function parseBlock(v) {
    var lines = v.replace(/\r/g, '').split('\n'), first = lines.shift(), o = { kv: {}, text: [], secs: [], hl: [], flags: {} };
    function flags(str) { return str.replace(/(^|\s)!(publier|discord|[eé]pingl[eé]r?)(?=\s|$)/gi, function (_, sp, f) { var pf = plain(f); o.flags[pf === 'publier' ? 'publier' : pf === 'discord' ? 'discord' : 'pin'] = true; return sp; }); }
    first = flags(first);
    var m = first.match(/^\/(\S+)\s*(.*)$/); o.cmd = m ? plain(m[1]) : ''; o.head = m ? m[2].trim() : first;
    var inBody = false, cur = null;
    lines.forEach(function (raw) {
      var l = flags(raw).replace(/\s+$/, ''); if (!l.trim()) { if (inBody) o.text.push(''); return; }
      if (/^-{3,}$/.test(l.trim())) { inBody = true; return; }
      var sm = l.match(/^#{2,3}\s*(.+)$/); if (sm) { cur = { title: sm[1].trim(), items: [] }; o.secs.push(cur); return; }
      var im = l.match(/^\s*([+^=!~-])\s+(.+)$/); if (im && (o.cmd === 'patch' || cur)) { if (!cur) { cur = { title: 'Nouveautés', items: [] }; o.secs.push(cur); } cur.items.push({ tag: ITEM[im[1]], text: im[2].trim() }); return; }
      var hm = l.match(/^\s*\*\s+(.+)$/); if (hm) { o.hl.push(hm[1].trim()); return; }
      var km = !inBody && l.match(/^\s*([a-zA-Zéèêàçû_-]{2,20})\s*:\s*(.*)$/); if (km && KEYS.indexOf(plain(km[1])) >= 0) { o.kv[plain(km[1]).replace(/\s+/g, '')] = km[2].trim(); return; }
      o.text.push(l.trim());
    });
    o.body = o.text.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return o;
  }
  // image terms: "assets/…" path, a word found in the library file names, or "ia <description>"
  var LIB = null;
  function library() { if (LIB) return Promise.resolve(LIB); return Promise.all([gh('/contents/assets/img?ref=' + BRANCH).catch(function () { return []; }), gh('/contents/assets/img/uploads?ref=' + BRANCH).catch(function () { return []; })]).then(function (r) { LIB = r[1].concat(r[0]).filter(function (f) { return f.type === 'file' && /\.(jpe?g|png|webp)$/i.test(f.name); }).map(function (f) { return f.path; }); return LIB; }); }
  function genAI(desc, style) {
    if (!KEY.ai) return Promise.reject(new Error('clé OpenAI absente (onglet Connexion)'));
    say('Génération de l’image IA… (20 à 60 s)');
    return fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY.ai },
      body: JSON.stringify({ model: 'gpt-image-1', prompt: (STYLES[style] || '') + desc, size: '1536x1024', quality: 'medium', n: 1 }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); return j; }); })
      .then(function (j) { return toJpegB64('data:image/png;base64,' + j.data[0].b64_json); }).then(function (b) { return uploadB64(b, 'ia-' + desc.slice(0, 30)); });
  }
  function resolveImg(term, style, miss) {
    term = String(term || '').trim(); if (!term) return Promise.resolve('');
    if (/^assets\//.test(term)) return Promise.resolve(term);
    var ai = term.match(/^ia\s*[:\-]?\s+(.+)$/i); if (ai) return genAI(ai[1], style).catch(function (e) { miss.push('IA : ' + e.message); return ''; });
    return library().then(function (lib) { var k = slug(term), hit = lib.filter(function (p) { return slug(p.split('/').pop()).indexOf(k) >= 0; })[0]; if (!hit) miss.push('« ' + term + ' » introuvable dans la médiathèque'); return hit || ''; });
  }
  function finish(miss, what) { say(what + (miss.length ? ' — ' + miss.join(' · ') : ''), !!miss.length); }

  function runCmd(v) {
    var o = parseBlock(v), cmd = o.cmd, rest = o.head, kv = o.kv, miss = [];
    if (cmd === 'aide' || cmd === 'help') { cin.value = ''; cin.focus(); sel = 0; drawPop(); return false; }
    if (cmd === 'modele' || cmd === 'template') { var t = plain(rest).split(/\s+/)[0]; t = t === 'news' ? 'annonce' : t === 'road' ? 'roadmap' : t; if (!TPL[t]) { say('Modèle : annonce, patch ou roadmap.', true); return false; } useTpl(t); return false; }
    if (!D.site) { say('Connecte-toi d’abord (onglet Connexion).', true); return false; }
    var full = v.indexOf('\n') >= 0 || Object.keys(o.flags).length > 0;

    if (cmd === 'annonce' || cmd === 'news') {
      var tag = kv.tag || kv.categorie || 'Annonce';
      rest = rest.replace(/#(\S+)/, function (_, t2) { tag = t2.replace(/[-_]/g, ' '); return ''; }).trim();
      tag = tag.charAt(0).toUpperCase() + tag.slice(1);
      var n = { id: '', title: rest || 'Nouvelle annonce', date: kv.date || today(), tag: tag, pinned: !!o.flags.pin, text: kv.texte || o.body || '', image: D.site.default_image, link: kv.lien || '', discord_message: '', draft: true };
      if (!full) { D.news.unshift(n); openTab('news'); editNews(0); say('Brouillon d’annonce créé : remplis-le puis enregistre.'); return; }
      setSync('Préparation…', 'busy');
      var gal = (kv.galerie || kv.gallery || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 6);
      return Promise.all([resolveImg(kv.image || kv.header || kv.banniere, 'event', miss), resolveImg(kv.carte || kv.card, 'event', miss)].concat(gal.map(function (g) { return resolveImg(g, 'event', miss); }))).then(function (r) {
        if (r[0]) n.image = r[0]; if (r[1]) n.card_image = r[1];
        var g2 = r.slice(2).filter(Boolean); if (g2.length) n.gallery = g2;
        n.id = slug(n.title); if (D.news.some(function (x) { return x.id === n.id; })) n.id += '-' + Date.now().toString(36);
        if (n.pinned) D.news.forEach(function (x) { x.pinned = false; });
        if (o.flags.publier) delete n.draft;
        D.news.unshift(n); openTab('news'); editNews(0);
        if (!o.flags.publier) { setSync('Connecté', 'ok'); finish(miss, 'Annonce prête en brouillon : relis-la puis « Enregistrer et publier ».'); return; }
        return writeJSON('data/news.json', D.news, 'Annonce : ' + n.title).then(function () {
          renderNewsList(); finish(miss, 'Annonce publiée sur le site.');
          if (o.flags.discord) window.VTG.page.publish('news', n);
        });
      }).catch(function () { return false; });
    }

    if (cmd === 'patch') {
      var parts = rest.split(/\s+/).filter(Boolean), ver = kv.version || '';
      if (/^v?\d+(\.\d+){0,3}$/i.test(parts[0] || '')) ver = parts.shift();
      ver = ver.replace(/^v/i, '');
      if (!ver) { var last = D.patches.filter(function (x) { return !x.draft; })[0] || D.patches[0]; var vv = last ? String(last.version).split('.').map(Number) : [1, 0, -1]; while (vv.length < 3) vv.push(0); vv[2] += 1; ver = vv.join('.'); }
      if (D.patches.some(function (x) { return x.version === ver; })) { say('La version ' + ver + ' existe déjà.', true); return false; }
      var np = { slug: '', version: ver, title: parts.join(' ') || kv.titre || 'Nouveau patch', date: kv.date || today(), image: D.site.default_image, summary: kv.resume || kv.summary || o.body || '', discord_message: '', draft: true, highlights: o.hl,
        sections: o.secs.length ? o.secs.filter(function (x) { return x.items.length; }) : [{ title: 'Nouveautés', items: [{ tag: 'new', text: '' }] }, { title: 'Équilibrage', items: [{ tag: 'balance', text: '' }] }, { title: 'Corrections', items: [{ tag: 'fix', text: '' }] }] };
      if (!full) { D.patches.push(np); D.patches.sort(cmpPatch); openTab('patches'); editPatch(D.patches.indexOf(np)); say('Brouillon de patch v' + ver + ' créé.'); return; }
      if (!np.sections.length) { say('Ajoute au moins une ligne de changement (+ nouveauté, ! correction…).', true); return false; }
      setSync('Préparation…', 'busy');
      return Promise.all([resolveImg(kv.image || kv.header || kv.banniere, 'patch', miss), resolveImg(kv.carte || kv.card, 'patch', miss)]).then(function (r) {
        if (r[0]) np.image = r[0]; if (r[1]) np.card_image = r[1];
        np.slug = slug(np.version + '-' + np.title);
        if (o.flags.publier) delete np.draft;
        D.patches.push(np); D.patches.sort(cmpPatch); openTab('patches'); editPatch(D.patches.indexOf(np));
        if (!o.flags.publier) { setSync('Connecté', 'ok'); finish(miss, 'Patch v' + ver + ' prêt en brouillon : relis-le puis « Enregistrer et publier ».'); return; }
        return writeJSON('data/patches.json', D.patches, 'Patch v' + np.version + ' : ' + np.title).then(function () {
          renderPatchList(); finish(miss, 'Patch v' + ver + ' publié sur le site.');
          if (o.flags.discord) window.VTG.page.publish('patch', np);
        });
      }).catch(function () { return false; });
    }

    if (cmd === 'roadmap' || cmd === 'road') {
      var w = rest.split(/\s+/).filter(Boolean), col = 'planned', key = plain(kv.colonne || w[0] || '');
      Object.keys(COLS).forEach(function (k) { if (COLS[k].indexOf(key) >= 0) { col = k; if (!kv.colonne) w.shift(); } });
      var c = D.roadmap.columns.filter(function (x) { return x.id === col; })[0] || D.roadmap.columns[0];
      var it = { title: w.join(' ') || 'Nouvel objectif', text: kv.texte || o.body || '', tag: kv.tag || '' };
      return resolveImg(kv.image, 'roadmap', miss).then(function (img) {
        if (img) it.image = img;
        c.items.unshift(it); openTab('roadmap'); renderRoad();
        if (o.flags.publier) return writeJSON('data/roadmap.json', D.roadmap, 'Roadmap : ' + it.title).then(function () { renderRoad(); finish(miss, 'Carte « ' + it.title + ' » publiée dans « ' + c.title + ' ».'); });
        finish(miss, 'Carte ajoutée dans « ' + c.title + ' ». Clique Enregistrer et publier pour la mettre en ligne.');
      }).catch(function () { return false; });
    }

    if (cmd === 'maintenance' || cmd === 'enligne' || cmd === 'online') {
      var on = cmd === 'maintenance';
      D.site.status = { mode: on ? 'maintenance' : 'online', message: on ? (rest || 'Maintenance en cours, retour très vite.') : '' };
      renderSite(); renderDash();
      writeJSON('data/site.json', D.site, on ? 'Maintenance : ' + D.site.status.message : 'Statut : en ligne').catch(function () {});
      return;
    }
    say('Commande inconnue. Tape /aide.', true); return false;
  }
  loadStats();

  // shared with the page editor (assets/pageedit.js)
  window.VTG = { $: $, $$: $$, esc: esc, say: say, KEY: KEY, D: D, pickImage: pickImage, rawURL: rawURL, siteURL: siteURL, openTab: openTab,
    saveNews: function (msg) { return writeJSON('data/news.json', D.news, msg); }, savePatches: function (msg) { return writeJSON('data/patches.json', D.patches, msg); } };
  loadAll();
})();
