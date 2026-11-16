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
      setSync('Publié · en ligne dans ~1 min', 'ok'); say('Enregistré. Le site se met à jour dans environ une minute.');
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
        setSync('Connecté', 'ok'); renderNewsList(); renderPatchList(); renderRoad(); renderSite();
        if ($('.tab.on').id === 'tab-keys') openTab('news');
      }, function (e) { setSync('Erreur', 'err'); say(e.status === 401 ? 'Jeton GitHub refusé : vérifie-le dans Connexion.' : e.status === 404 ? 'Dépôt introuvable ou jeton sans accès à ce dépôt.' : 'Erreur : ' + e.message, true); openTab('keys'); });
  }
  function siteURL() { return (D.site && D.site.base_url ? D.site.base_url.replace(/\/$/, '') : ''); }
  function rawURL(path) { return 'https://raw.githubusercontent.com/' + KEY.repo + '/' + BRANCH + '/' + path; }

  // ------------------------------------------------------------------ tabs
  function openTab(t) { $$('.adm-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); }); $$('.tab').forEach(function (s) { s.classList.toggle('on', s.id === 'tab-' + t); }); }
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
    l.innerHTML = D.news.map(function (n, i) { return '<button class="li' + (i === curNews ? ' on' : '') + '" data-i="' + i + '">' + (n.pinned ? '📌 ' : '') + esc(n.title) + '<small>' + esc(n.date) + ' · ' + esc(n.tag || '') + '</small></button>'; }).join('') || '<div class="empty">Aucune annonce.</div>';
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
    box.innerHTML = '<div class="kicker"><span class="num">//</span>Annonce</div><h2>' + esc(n.title) + '</h2>' +
      field('Titre', n.title, 'data-k="title"') +
      '<div class="grid3">' + field('Date', n.date, 'type="date" data-k="date"') + field('Catégorie', n.tag, 'data-k="tag" placeholder="Événement, Boutique…"') +
      '<label class="chk"><input type="checkbox" data-k="pinned"' + (n.pinned ? ' checked' : '') + '> Épingler en haut</label></div>' +
      '<label>Texte (une ligne vide = nouveau paragraphe)<textarea rows="6" data-k="text">' + esc(n.text) + '</textarea></label>' +
      '<label>Image</label><div id="news-img"></div>' +
      '<div class="grid2">' + field('Lien externe (facultatif)', n.link, 'data-k="link" placeholder="https://…"') + field('Lien du message Discord (facultatif)', n.discord_message, 'data-k="discord_message" placeholder="https://discord.com/channels/…"') + '</div>' +
      '<div class="row"><button class="btn btn-primary" id="n-save">Enregistrer et publier</button><button class="btn btn-discord" id="n-disc">Publier sur Discord</button><button class="btn btn-ghost" id="n-del">Supprimer</button></div>' +
      '<p class="hint">Publie d’abord sur le site, puis sur Discord : l’embed renvoie vers la page de l’annonce.</p>';
    $$('[data-k]', box).forEach(function (el) { el.addEventListener('input', function () { n[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.k === 'title') $('h2', box).textContent = el.value; }); });
    autosize(box);
    $('#news-img').appendChild(imageField(function () { return n.image; }, function (p) { n.image = p; }, function () { return n.title + '. ' + n.text; }));
    $('#n-save').addEventListener('click', function () {
      if (!n.id) n.id = slug(n.title);
      if (D.news.some(function (x, j) { return j !== i && x.id === n.id; })) n.id += '-' + Date.now().toString(36);
      writeJSON('data/news.json', D.news, 'Annonce : ' + n.title).then(renderNewsList, function () {});
    });
    $('#n-disc').addEventListener('click', function () {
      if (!n.id) return say('Enregistre d’abord l’annonce sur le site.', true);
      postDiscord({ title: n.title, text: n.text.slice(0, 1800), url: siteURL() + '/annonces/' + n.id + '/', image: n.image, footer: n.tag || 'Annonce' }).catch(function () {});
    });
    $('#n-del').addEventListener('click', function () {
      if (!confirm('Supprimer « ' + n.title + ' » du site ?')) return;
      D.news.splice(i, 1); curNews = -1; box.innerHTML = '<div class="empty">Annonce supprimée.</div>';
      writeJSON('data/news.json', D.news, 'Suppression annonce : ' + n.title).then(renderNewsList, function () {});
    });
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
    l.innerHTML = D.patches.map(function (p, i) { return '<button class="li' + (i === curPatch ? ' on' : '') + '" data-i="' + i + '">v' + esc(p.version) + ' · ' + esc(p.title) + '<small>' + esc(p.date) + '</small></button>'; }).join('');
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
    function secsHTML() {
      return p.sections.map(function (s, si) {
        return '<div class="secb" data-si="' + si + '"><div class="adm-lh"><input value="' + esc(s.title) + '" data-sec="' + si + '" placeholder="Titre de la section"><button class="x" data-delsec="' + si + '" title="Supprimer la section">✕</button></div>' +
          s.items.map(function (it, ii) {
            return '<div class="itemrow"><select data-tag="' + si + ':' + ii + '">' + TAGS.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === it.tag ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
              '<textarea data-it="' + si + ':' + ii + '" rows="1" placeholder="Décris le changement">' + esc(it.text) + '</textarea><button class="x" data-delit="' + si + ':' + ii + '" title="Supprimer">✕</button></div>';
          }).join('') + '<button class="btn btn-ghost sm" data-addit="' + si + '">+ Ligne</button></div>';
      }).join('') + '<button class="btn btn-ghost sm" id="addsec">+ Section</button>';
    }
    box.innerHTML = '<div class="kicker"><span class="num">//</span>Note de patch</div><h2>v' + esc(p.version) + ' · ' + esc(p.title) + '</h2>' +
      '<div class="grid3">' + field('Version', p.version, 'data-k="version"') + field('Date', p.date, 'type="date" data-k="date"') + field('Titre', p.title, 'data-k="title"') + '</div>' +
      '<label>Résumé (affiché sur les cartes et dans Discord)<textarea rows="3" data-k="summary">' + esc(p.summary) + '</textarea></label>' +
      '<label>À retenir (une ligne par point)<textarea rows="3" data-k="highlights">' + esc((p.highlights || []).join('\n')) + '</textarea></label>' +
      '<label>Image</label><div id="patch-img"></div>' +
      field('Lien du message Discord (facultatif)', p.discord_message, 'data-k="discord_message" placeholder="https://discord.com/channels/…"') +
      '<h3 class="kicker" style="margin-top:22px">Changements</h3><div id="secs">' + secsHTML() + '</div>' +
      '<div class="row"><button class="btn btn-primary" id="p-save">Enregistrer et publier</button><button class="btn btn-discord" id="p-disc">Publier sur Discord</button><button class="btn btn-ghost" id="p-del">Supprimer</button></div>';
    $$('[data-k]', box).forEach(function (el) { el.addEventListener('input', function () {
      var k = el.dataset.k; p[k] = k === 'highlights' ? el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : el.value;
      $('h2', box).textContent = 'v' + p.version + ' · ' + p.title;
    }); });
    $('#patch-img').appendChild(imageField(function () { return p.image; }, function (np) { p.image = np; }, function () { return 'Patch ' + p.version + ' "' + p.title + '": ' + p.summary; }));
    function bindSecs() {
      var sb = $('#secs');
      $$('[data-sec]', sb).forEach(function (el) { el.addEventListener('input', function () { p.sections[+el.dataset.sec].title = el.value; }); });
      $$('[data-tag]', sb).forEach(function (el) { el.addEventListener('change', function () { var a = el.dataset.tag.split(':'); p.sections[a[0]].items[a[1]].tag = el.value; }); });
      $$('[data-it]', sb).forEach(function (el) { el.addEventListener('input', function () { var a = el.dataset.it.split(':'); p.sections[a[0]].items[a[1]].text = el.value; }); });
      $$('[data-delit]', sb).forEach(function (el) { el.addEventListener('click', function () { var a = el.dataset.delit.split(':'); p.sections[a[0]].items.splice(a[1], 1); redraw(); }); });
      $$('[data-addit]', sb).forEach(function (el) { el.addEventListener('click', function () { p.sections[+el.dataset.addit].items.push({ tag: 'new', text: '' }); redraw(); }); });
      $$('[data-delsec]', sb).forEach(function (el) { el.addEventListener('click', function () { if (confirm('Supprimer cette section ?')) { p.sections.splice(+el.dataset.delsec, 1); redraw(); } }); });
      $('#addsec').addEventListener('click', function () { p.sections.push({ title: 'Nouvelle section', items: [{ tag: 'new', text: '' }] }); redraw(); });
    }
    function redraw() { $('#secs').innerHTML = secsHTML(); bindSecs(); autosize($('#secs')); }
    bindSecs(); autosize(box);
    $('#p-save').addEventListener('click', function () {
      p.sections = p.sections.map(function (s) { return { title: s.title, items: s.items.filter(function (it) { return it.text.trim(); }) }; }).filter(function (s) { return s.items.length; });
      if (!p.sections.length) return say('Ajoute au moins un changement.', true);
      if (!p.slug) p.slug = slug(p.version + '-' + p.title);
      D.patches.sort(cmpPatch);
      writeJSON('data/patches.json', D.patches, 'Patch v' + p.version + ' : ' + p.title).then(function () { D.patches.sort(cmpPatch); editPatch(D.patches.indexOf(p)); }, function () {});
    });
    $('#p-disc').addEventListener('click', function () {
      if (!p.slug) return say('Enregistre d’abord le patch sur le site.', true);
      var lines = []; p.sections.forEach(function (s) { lines.push('**' + s.title + '**'); s.items.slice(0, 4).forEach(function (it) { lines.push('• ' + it.text); }); if (s.items.length > 4) lines.push('• … +' + (s.items.length - 4)); });
      postDiscord({ title: 'Notes de patch v' + p.version + ' — ' + p.title, text: (p.summary + '\n\n' + lines.join('\n')).slice(0, 3900), url: siteURL() + '/patch-notes/' + p.slug + '/', image: p.image, footer: 'Notes de patch' }).catch(function () {});
    });
    $('#p-del').addEventListener('click', function () {
      if (!confirm('Supprimer le patch v' + p.version + ' du site ?')) return;
      D.patches.splice(i, 1); curPatch = -1; box.innerHTML = '<div class="empty">Patch supprimé.</div>';
      writeJSON('data/patches.json', D.patches, 'Suppression patch v' + p.version).then(renderPatchList, function () {});
    });
  }

  // ------------------------------------------------------------------ ROADMAP
  function renderRoad() {
    var r = D.roadmap; $('#road-note').value = r.note || '';
    var b = $('#road-board');
    b.innerHTML = r.columns.map(function (c, ci) {
      return '<div class="ab-col"><h3>' + esc(c.title) + '<span>' + c.items.length + '</span></h3>' +
        c.items.map(function (it, ii) {
          return '<div class="ab-it"><input value="' + esc(it.title) + '" data-f="title" data-c="' + ci + '" data-i="' + ii + '" placeholder="Titre">' +
            '<textarea rows="2" data-f="text" data-c="' + ci + '" data-i="' + ii + '" placeholder="Description">' + esc(it.text) + '</textarea>' +
            '<input value="' + esc(it.tag) + '" data-f="tag" data-c="' + ci + '" data-i="' + ii + '" placeholder="Étiquette (Saison 2, 1.6.0…)">' +
            '<div class="ab-tools"><button data-mv="' + ci + ':' + ii + ':-1" title="Colonne précédente">◀</button><button data-up="' + ci + ':' + ii + '" title="Monter">▲</button><button data-dn="' + ci + ':' + ii + '" title="Descendre">▼</button><button data-mv="' + ci + ':' + ii + ':1" title="Colonne suivante">▶</button><button data-rm="' + ci + ':' + ii + '" title="Supprimer">✕</button></div></div>';
        }).join('') + '<button class="btn btn-ghost sm" data-add="' + ci + '">+ Ajouter</button></div>';
    }).join('');
    autosize(b);
    $$('[data-f]', b).forEach(function (el) { el.addEventListener('input', function () { r.columns[el.dataset.c].items[el.dataset.i][el.dataset.f] = el.value; }); });
    $$('[data-add]', b).forEach(function (el) { el.addEventListener('click', function () { r.columns[+el.dataset.add].items.push({ title: '', text: '', tag: '' }); renderRoad(); }); });
    $$('[data-rm]', b).forEach(function (el) { el.addEventListener('click', function () { var a = el.dataset.rm.split(':').map(Number); r.columns[a[0]].items.splice(a[1], 1); renderRoad(); }); });
    $$('[data-up],[data-dn]', b).forEach(function (el) { el.addEventListener('click', function () {
      var a = (el.dataset.up || el.dataset.dn).split(':').map(Number), d = el.dataset.up ? -1 : 1, arr = r.columns[a[0]].items, j = a[1] + d;
      if (j < 0 || j >= arr.length) return; var t = arr[a[1]]; arr[a[1]] = arr[j]; arr[j] = t; renderRoad();
    }); });
    $$('[data-mv]', b).forEach(function (el) { el.addEventListener('click', function () {
      var a = el.dataset.mv.split(':').map(Number), to = a[0] + a[2]; if (to < 0 || to >= r.columns.length) return;
      var it = r.columns[a[0]].items.splice(a[1], 1)[0]; r.columns[to].items.unshift(it); renderRoad();
    }); });
  }
  $('#road-note').addEventListener('input', function (e) { if (D.roadmap) D.roadmap.note = e.target.value; });
  $('#road-save').addEventListener('click', function () {
    if (!D.roadmap) return say('Connecte-toi d’abord.', true);
    D.roadmap.columns.forEach(function (c) { c.items = c.items.filter(function (it) { return it.title.trim(); }); });
    writeJSON('data/roadmap.json', D.roadmap, 'Roadmap').then(renderRoad, function () {});
  });

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

  loadAll();
})();
