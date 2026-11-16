// VANTAGE admin · PAGE EDITOR
// The announcements, patch notes and roadmap are edited directly on a preview of the real site page (same layout,
// same styles): click a text to write it, click an image to change it (right click removes it), hover a line for
// its tools. Several images per page: card image (home / lists), banner, gallery (announcements), an image per
// section (patch notes) and per card (roadmap). "Publier sur Discord" sends the matching embed in one click.
(function () {
  'use strict';
  var V = window.VTG; if (!V) return;
  var $ = V.$, $$ = V.$$, esc = V.esc, say = V.say;
  var TAGS = [['new', 'NOUVEAU', 't-new'], ['update', 'AMÉLIORATION', 't-up'], ['fix', 'CORRECTION', 't-fix'], ['perf', 'PERFORMANCES', 't-perf'], ['balance', 'ÉQUILIBRAGE', 't-bal']];
  var TAG = {}; TAGS.forEach(function (t) { TAG[t[0]] = t; });
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MON = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];
  function fdate(d) { var a = String(d || '').split('-'); return a.length < 3 ? '' : (+a[2]) + ' ' + MONTHS[+a[1] - 1] + ' ' + a[0]; }
  function img(p) { return !p ? '' : /^https?:/.test(p) ? p : V.rawURL(p); }
  function slug(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }

  // ------------------------------------------------------------------ in-place editing primitives
  // <span data-e="key"> bound to obj[key]; multiline=true keeps line breaks
  function E(obj, key, cls, ph, multi, tag) {
    tag = tag || 'div';
    return '<' + tag + ' class="pe ' + (cls || '') + '" data-pe="' + key + '"' + (multi ? ' data-multi="1"' : '') + ' data-ph="' + esc(ph || '') + '" spellcheck="true">' + esc(obj[key] || '') + '</' + tag + '>';
  }
  function bindText(root, resolve, onChange) {
    $$('[data-pe]', root).forEach(function (el) {
      el.contentEditable = 'plaintext-only';
      if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
      el.addEventListener('input', function () {
        var r = resolve(el); if (!r) return;
        r.obj[r.key] = el.textContent.replace(/\n$/, '');
        if (onChange) onChange(el);
      });
      el.addEventListener('keydown', function (e) { if (e.key !== 'Enter') return; e.preventDefault(); if (el.dataset.multi) document.execCommand('insertText', false, '\n'); else el.blur(); });
      el.addEventListener('paste', function (e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text')); });
      el.addEventListener('click', function (e) { e.preventDefault(); });   // links inside the preview do not navigate
    });
  }
  // [data-pi] image slots: click = choose, right click = remove
  function bindImages(root, resolve, redraw, hint) {
    $$('[data-pi]', root).forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault(); var r = resolve(el); if (!r) return;
        V.pickImage(function (p) { r.set(p); redraw(); }, hint && hint());
      });
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); var r = resolve(el); if (r && r.del) { r.del(); redraw(); } });
    });
  }
  function slot(id, src, cls, label) {
    return '<button type="button" class="pi ' + (cls || '') + (src ? '' : ' pi-empty') + '" data-pi="' + id + '" title="Clique : changer l’image · clic droit : retirer">' +
      (src ? '<img src="' + esc(img(src)) + '" alt="">' : '') + '<span class="pi-l">' + (src ? '✎ ' : '+ ') + label + '</span></button>';
  }
  function bar(html) { return '<div class="pe-bar">' + html + '</div>'; }
  function metaField(label, val, attrs) { return '<label>' + label + '<input value="' + esc(val || '') + '" ' + (attrs || '') + '></label>'; }

  // ------------------------------------------------------------------ Discord: one click, embed in the style of the page
  function publish(kind, ref) {
    if (!V.KEY.wh) { say('Ajoute l’URL du webhook Discord dans Connexion.', true); return; }
    var site = V.siteURL(), e = { color: 0xff6a1a, timestamp: new Date().toISOString() }, extra = [];
    if (kind === 'news') {
      e.author = { name: 'VANTAGE · ' + String(ref.tag || 'Annonce').toUpperCase() };
      e.title = ref.title; e.url = site + '/annonces/' + ref.id + '/';
      e.description = String(ref.text || '').split('\n').filter(Boolean).join('\n\n').slice(0, 4000);
      var pics = [ref.image].concat(ref.gallery || []).filter(Boolean).slice(0, 4);
      if (pics[0]) e.image = { url: img(pics[0]) };
      pics.slice(1).forEach(function (p) { extra.push({ url: e.url, image: { url: img(p) } }); });
      e.footer = { text: 'VANTAGE · ' + (ref.tag || 'Annonce') };
    } else {
      var icon = { new: '🟢', update: '🔵', fix: '🟡', perf: '🟣', balance: '🔴' };
      e.author = { name: 'NOTES DE PATCH · v' + ref.version };
      e.title = ref.title; e.url = site + '/patch-notes/' + ref.slug + '/';
      var hl = (ref.highlights || []).map(function (h) { return '▸ ' + h; }).join('\n');
      e.description = (ref.summary + (hl ? '\n\n**À retenir**\n' + hl : '') + '\n\n[Lire toutes les notes de patch](' + e.url + ')').slice(0, 4000);
      e.fields = ref.sections.slice(0, 25).map(function (s) {
        var out = [], len = 0;
        for (var i = 0; i < s.items.length; i++) {
          var l = (icon[s.items[i].tag] || '•') + ' ' + s.items[i].text;
          if (len + l.length > 960) { out.push('… et ' + (s.items.length - i) + ' de plus sur le site'); break; }
          out.push(l); len += l.length + 1;
        }
        return { name: String(s.title).toUpperCase() + '  ·  ' + s.items.length, value: out.join('\n') || '—' };
      });
      if (ref.image) e.image = { url: img(ref.image) };
      e.footer = { text: 'VANTAGE · Notes de patch' };
    }
    if (!confirm('Publier « ' + e.title + ' » sur Discord ?')) return;
    var hook = V.KEY.wh.replace(/\?.*$/, '');
    fetch(hook + '?wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'VANTAGE', embeds: [e].concat(extra) }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.message || ('HTTP ' + r.status)); return j; }); })
      .then(function (msg) {
        say('Publié sur Discord !');
        return fetch(hook).then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (wh) {
          if (!wh.guild_id) return;
          ref.discord_message = 'https://discord.com/channels/' + wh.guild_id + '/' + msg.channel_id + '/' + msg.id;
          var inp = document.querySelector('[data-k="discord_message"]'); if (inp) inp.value = ref.discord_message;
          (kind === 'news' ? V.saveNews('Lien Discord : ' + ref.title) : V.savePatches('Lien Discord : v' + ref.version)).catch(function () {});
        });
      }, function (err) { say('Discord : ' + err.message, true); });
  }

  // ------------------------------------------------------------------ ANNOUNCEMENT page
  V.page = {};
  V.page.publish = publish;
  V.page.news = function (n, box, act) {
    n.gallery = n.gallery || [];
    function draw() {
      var hero = n.image || (V.D.site && V.D.site.default_image);
      var paras = '<div class="post pe-post">' + E(n, 'text', 'pe-text', 'Écris le texte de l’annonce… (ligne vide = nouveau paragraphe)', true) + '</div>';
      var gal = '<div class="gal n' + Math.max(1, n.gallery.length + (n.gallery.length < 6 ? 1 : 0)) + '">' + n.gallery.map(function (p, k) { return slot('gal:' + k, p, 'gimg', 'image ' + (k + 2)); }).join('') +
        (n.gallery.length < 6 ? slot('gal:new', '', 'gimg', 'ajouter une image à la galerie') : '') + '</div>';
      box.innerHTML =
        bar('<div class="grid3">' + metaField('Date', n.date, 'type="date" data-k="date"') + metaField('Catégorie', n.tag, 'data-k="tag" placeholder="Événement, Boutique…"') +
          '<label class="chk"><input type="checkbox" data-k="pinned"' + (n.pinned ? ' checked' : '') + '> Épingler en haut de l’accueil</label></div>' +
          '<div class="grid2">' + metaField('Bouton « En savoir plus » (lien, facultatif)', n.link, 'data-k="link" placeholder="https://…"') + metaField('Lien du message Discord', n.discord_message, 'data-k="discord_message" placeholder="rempli tout seul après « Publier sur Discord »"') + '</div>' +
          '<div class="row"><button class="btn btn-primary" id="n-save">Enregistrer et publier</button><button class="btn btn-discord" id="n-disc">Publier sur Discord</button><button class="btn btn-ghost" id="n-del">Supprimer</button></div>') +
        '<div class="pe-lab">Carte sur l’accueil et la liste des annonces</div>' +
        '<div class="pe-cards"><div class="ncard pe-card"><div class="nimg">' + slot('card', n.card_image || n.image, 'cardimg', n.card_image ? 'image de la carte' : 'image de la carte (= bandeau)') + '</div><div class="nbody"><div class="ndate"><b>' + (String(n.date).split('-')[2] || '--') + '</b><span>' + (MON[+String(n.date).split('-')[1] - 1] || '') + '</span></div><div><div class="meta">' + esc(n.tag || 'Annonce') + (n.pinned ? ' · <span class="pin">Épinglé</span>' : '') + '</div><h3>' + esc(n.title) + '</h3><p>' + esc(String(n.text || '').slice(0, 140)) + '</p></div></div></div></div>' +
        '<div class="pe-lab">Page de l’annonce — clique sur les textes et les images pour les modifier</div>' +
        '<div class="pe-page"><section class="phero"><div class="bgimg" style="background-image:url(\'' + esc(img(hero)) + '\')"></div>' + slot('hero', n.image, 'heroimg', 'image du bandeau') +
          '<div class="wrap"><span class="crumb">← Toutes les annonces</span><div class="kicker"><span class="badge">' + esc(n.tag || 'Annonce') + '</span>' + fdate(n.date) + '</div>' +
          E(n, 'title', 'pe-h1', 'Titre de l’annonce', false, 'h1') + '</div></section>' +
          '<div class="wrap narrow">' + paras + gal + (n.link ? '<div class="share"><span class="btn btn-primary">En savoir plus</span></div>' : '') + '</div></div>';
      bindText(box, function (el) { return { obj: n, key: el.dataset.pe }; }, function (el) { if (el.dataset.pe === 'title') { var h = $('.pe-card h3', box); if (h) h.textContent = n.title; } });
      bindImages(box, function (el) {
        var id = el.dataset.pi;
        if (id === 'hero') return { set: function (p) { n.image = p; }, del: function () { n.image = ''; } };
        if (id === 'card') return { set: function (p) { n.card_image = p; }, del: function () { delete n.card_image; } };
        if (id === 'gal:new') return { set: function (p) { n.gallery.push(p); } };
        var k = +id.split(':')[1];
        return { set: function (p) { n.gallery[k] = p; }, del: function () { n.gallery.splice(k, 1); } };
      }, draw, function () { return n.title + '. ' + n.text; });
      $$('[data-k]', box).forEach(function (el) { el.addEventListener('input', function () { n[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; }); el.addEventListener('change', function () { if (el.dataset.k !== 'discord_message' && el.dataset.k !== 'link') draw(); }); });
      $('#n-save').addEventListener('click', act.save);
      $('#n-disc').addEventListener('click', function () { if (!n.id) return say('Enregistre d’abord l’annonce sur le site.', true); publish('news', n); });
      $('#n-del').addEventListener('click', act.del);
    }
    draw();
  };

  // ------------------------------------------------------------------ PATCH NOTES page
  V.page.patch = function (p, box, act) {
    function counts() { var c = {}; p.sections.forEach(function (s) { s.items.forEach(function (it) { c[it.tag] = (c[it.tag] || 0) + 1; }); }); return c; }
    function draw() {
      var c = counts(), total = p.sections.reduce(function (n, s) { return n + s.items.length; }, 0);
      var hl = (p.highlights || []).map(function (h, k) { return '<li class="pe-li"><span class="pe" data-hl="' + k + '" data-ph="Point clé">' + esc(h) + '</span><button type="button" class="pe-x" data-hldel="' + k + '" title="Retirer">✕</button></li>'; }).join('');
      var secs = p.sections.map(function (s, si) {
        return '<section class="nsec pe-sec"><h2><span class="pe" data-st="' + si + '" data-ph="Titre de la section">' + esc(s.title) + '</span><em>' + s.items.length + '</em>' +
          '<span class="pe-tools"><button type="button" data-sup="' + si + '" title="Monter">▲</button><button type="button" data-sdel="' + si + '" title="Supprimer la section">✕</button></span></h2>' +
          (s.image ? slot('sec:' + si, s.image, 'secimg', 'image de la section') : '<button type="button" class="pe-add sm" data-secimg="' + si + '">+ image pour cette section</button>') +
          '<ul class="notes">' + s.items.map(function (it, ii) {
            var t = TAG[it.tag] || TAGS[0];
            return '<li class="pe-li"><button type="button" class="tag ' + t[2] + ' pe-tag" data-tag="' + si + ':' + ii + '" title="Changer le type">' + t[1] + '</button>' +
              '<span class="pe" data-it="' + si + ':' + ii + '" data-multi="1" data-ph="Décris le changement">' + esc(it.text) + '</span>' +
              '<span class="pe-tools"><button type="button" data-iup="' + si + ':' + ii + '" title="Monter">▲</button><button type="button" data-idel="' + si + ':' + ii + '" title="Supprimer">✕</button></span></li>';
          }).join('') + '</ul><button type="button" class="pe-add" data-iadd="' + si + '">+ ligne</button></section>';
      }).join('');
      box.innerHTML =
        bar('<div class="grid3">' + metaField('Version', p.version, 'data-k="version"') + metaField('Date', p.date, 'type="date" data-k="date"') + metaField('Lien du message Discord', p.discord_message, 'data-k="discord_message" placeholder="rempli tout seul après « Publier sur Discord »"') + '</div>' +
          '<div class="row"><button class="btn btn-primary" id="p-save">Enregistrer et publier</button><button class="btn btn-discord" id="p-disc">Publier sur Discord</button><button class="btn btn-ghost" id="p-del">Supprimer</button></div>') +
        '<div class="pe-lab">Carte dans la liste des patchs et sur l’accueil</div>' +
        '<div class="pe-cards"><div class="pcard pe-card"><div class="pimg">' + slot('card', p.card_image || p.image, 'cardimg', p.card_image ? 'image de la carte' : 'image de la carte (= bandeau)') + '<span class="ver">v' + esc(p.version) + '</span></div><div class="pbody"><div class="meta">Notes de patch · ' + fdate(p.date) + '</div><h3>' + esc(p.title) + '</h3><p>' + esc(p.summary) + '</p></div></div></div>' +
        '<div class="pe-lab">Page du patch — clique sur les textes et les images pour les modifier · clique sur un type (NOUVEAU…) pour le changer</div>' +
        '<div class="pe-page"><section class="phero"><div class="bgimg" style="background-image:url(\'' + esc(img(p.image || (V.D.site && V.D.site.default_image))) + '\')"></div>' + slot('hero', p.image, 'heroimg', 'image du bandeau') +
          '<div class="wrap"><span class="crumb">← Toutes les notes de patch</span><div class="kicker"><span class="badge">v' + esc(p.version) + '</span>Notes de patch · ' + fdate(p.date) + '</div>' +
          E(p, 'title', 'pe-h1', 'Titre du patch', false, 'h1') + E(p, 'summary', 'lead', 'Résumé (affiché sur les cartes et dans Discord)', true, 'p') +
          '<div class="pfacts"><div><b>' + total + '</b><span>changements</span></div><div><b>' + p.sections.length + '</b><span>sections</span></div>' + TAGS.filter(function (t) { return c[t[0]]; }).map(function (t) { return '<div><b class="' + t[2] + '">' + c[t[0]] + '</b><span>' + t[1].toLowerCase() + '</span></div>'; }).join('') + '</div></div></section>' +
          '<div class="wrap pgrid"><aside class="side"><div class="box"><div class="bt">À retenir</div><ul class="hl">' + hl + '</ul><button type="button" class="pe-add sm" id="hl-add">+ point</button></div></aside>' +
          '<article class="content">' + secs + '<button type="button" class="pe-add big" id="sec-add">+ section</button></article></div></div>';
      // texts
      bindText(box, function (el) {
        if (el.dataset.pe) return { obj: p, key: el.dataset.pe };
        if (el.dataset.st) return { obj: p.sections[+el.dataset.st], key: 'title' };
        if (el.dataset.it) { var a = el.dataset.it.split(':'); return { obj: p.sections[+a[0]].items[+a[1]], key: 'text' }; }
        if (el.dataset.hl) return { obj: p.highlights, key: +el.dataset.hl };
      }, function (el) { if (el.dataset.pe === 'title' || el.dataset.pe === 'summary') { $('.pe-card h3', box).textContent = p.title; $('.pe-card p', box).textContent = p.summary; } });
      $$('[data-st],[data-it],[data-hl]', box).forEach(function (el) { if (!el.isContentEditable) { el.contentEditable = 'plaintext-only'; if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'; } });
      bindText2(box);
      // images
      bindImages(box, function (el) {
        var id = el.dataset.pi;
        if (id === 'hero') return { set: function (x) { p.image = x; }, del: function () { p.image = ''; } };
        if (id === 'card') return { set: function (x) { p.card_image = x; }, del: function () { delete p.card_image; } };
        var si = +id.split(':')[1];
        return { set: function (x) { p.sections[si].image = x; }, del: function () { delete p.sections[si].image; } };
      }, draw, function () { return 'Patch ' + p.version + ' "' + p.title + '": ' + p.summary; });
      $$('[data-secimg]', box).forEach(function (b) { b.addEventListener('click', function () { var s = p.sections[+b.dataset.secimg]; V.pickImage(function (x) { s.image = x; draw(); }, s.title + ' — ' + p.title); }); });
      // structure tools
      function on(sel, fn) { $$(sel, box).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); fn(b); draw(); }); }); }
      on('[data-tag]', function (b) { var a = b.dataset.tag.split(':'), it = p.sections[+a[0]].items[+a[1]], k = TAGS.findIndex(function (t) { return t[0] === it.tag; }); it.tag = TAGS[(k + 1) % TAGS.length][0]; });
      on('[data-idel]', function (b) { var a = b.dataset.idel.split(':'); p.sections[+a[0]].items.splice(+a[1], 1); });
      on('[data-iup]', function (b) { var a = b.dataset.iup.split(':').map(Number), arr = p.sections[a[0]].items; if (a[1] > 0) { var t = arr[a[1]]; arr[a[1]] = arr[a[1] - 1]; arr[a[1] - 1] = t; } });
      on('[data-iadd]', function (b) { p.sections[+b.dataset.iadd].items.push({ tag: 'new', text: '' }); });
      on('[data-sdel]', function (b) { if (confirm('Supprimer cette section ?')) p.sections.splice(+b.dataset.sdel, 1); });
      on('[data-sup]', function (b) { var i = +b.dataset.sup; if (i > 0) { var t = p.sections[i]; p.sections[i] = p.sections[i - 1]; p.sections[i - 1] = t; } });
      on('#sec-add', function () { p.sections.push({ title: 'Nouvelle section', items: [{ tag: 'new', text: '' }] }); });
      on('#hl-add', function () { p.highlights = p.highlights || []; p.highlights.push(''); });
      on('[data-hldel]', function (b) { p.highlights.splice(+b.dataset.hldel, 1); });
      $$('[data-k]', box).forEach(function (el) { el.addEventListener('input', function () { p[el.dataset.k] = el.value; }); el.addEventListener('change', function () { if (el.dataset.k !== 'discord_message') draw(); }); });
      $('#p-save').addEventListener('click', act.save);
      $('#p-disc').addEventListener('click', function () { if (!p.slug) return say('Enregistre d’abord le patch sur le site.', true); publish('patch', p); });
      $('#p-del').addEventListener('click', act.del);
    }
    // the extra editable spans (section titles, lines, key points) share the same handlers
    function bindText2(root) {
      $$('[data-st],[data-it],[data-hl]', root).forEach(function (el) {
        el.addEventListener('input', function () {
          if (el.dataset.st) p.sections[+el.dataset.st].title = el.textContent.trim();
          else if (el.dataset.it) { var a = el.dataset.it.split(':'); p.sections[+a[0]].items[+a[1]].text = el.textContent.replace(/\n$/, ''); }
          else p.highlights[+el.dataset.hl] = el.textContent.trim();
        });
        el.addEventListener('keydown', function (e) { if (e.key !== 'Enter') return; e.preventDefault(); if (el.dataset.it) document.execCommand('insertText', false, '\n'); else el.blur(); });
        el.addEventListener('paste', function (e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text')); });
      });
    }
    draw();
  };

  // ------------------------------------------------------------------ ROADMAP page
  V.page.road = function (r, box, onSave) {
    function draw() {
      box.innerHTML =
        bar('<div class="row" style="margin-top:0"><button class="btn btn-primary" id="road-save2">Enregistrer et publier</button><span class="hint" style="margin:0">Clique sur les textes pour les modifier · survole une carte pour la déplacer · image facultative par carte</span></div>') +
        '<div class="pe-page"><section class="shero"><div class="wrap"><div class="kicker"><span class="num">//</span>Ce qui arrive</div><h1>Roadmap</h1>' + E(r, 'note', 'lead', 'Petit texte d’introduction', true, 'p') + '</div></section>' +
        '<div class="wrap"><div class="board">' + r.columns.map(function (c, ci) {
          return '<div class="rcol r-' + esc(c.id) + '"><div class="rhead"><span class="rn">0' + (ci + 1) + '</span><span class="dot"></span><span class="pe" data-ct="' + ci + '" data-ph="Colonne">' + esc(c.title) + '</span><span class="n">' + c.items.length + '</span></div><ul>' +
            c.items.map(function (it, ii) {
              var id = ci + ':' + ii;
              return '<li class="ritem pe-ritem">' + (it.image ? slot('ri:' + id, it.image, 'rimg', 'image') : '') +
                '<div class="rtag pe" data-rf="' + id + ':tag" data-ph="Étiquette">' + esc(it.tag || '') + '</div>' +
                '<h4 class="pe" data-rf="' + id + ':title" data-ph="Titre">' + esc(it.title || '') + '</h4>' +
                '<p class="pe" data-rf="' + id + ':text" data-multi="1" data-ph="Description">' + esc(it.text || '') + '</p>' +
                '<span class="pe-tools"><button type="button" data-mv="' + id + ':-1" title="Colonne précédente">◀</button><button type="button" data-up="' + id + '" title="Monter">▲</button><button type="button" data-dn="' + id + '" title="Descendre">▼</button><button type="button" data-mv="' + id + ':1" title="Colonne suivante">▶</button>' +
                (it.image ? '' : '<button type="button" data-rimg="' + id + '" title="Ajouter une image">🖼</button>') + '<button type="button" data-rm="' + id + '" title="Supprimer">✕</button></span></li>';
            }).join('') + '</ul><button type="button" class="pe-add" data-add="' + ci + '">+ carte</button></div>';
        }).join('') + '</div></div></div>';
      bindText(box, function (el) { return el.dataset.pe ? { obj: r, key: el.dataset.pe } : null; });
      $$('[data-ct],[data-rf]', box).forEach(function (el) {
        el.contentEditable = 'plaintext-only'; if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
        el.addEventListener('input', function () {
          if (el.dataset.ct) { r.columns[+el.dataset.ct].title = el.textContent.trim(); return; }
          var a = el.dataset.rf.split(':'); r.columns[+a[0]].items[+a[1]][a[2]] = el.textContent.replace(/\n$/, '');
        });
        el.addEventListener('keydown', function (e) { if (e.key !== 'Enter') return; e.preventDefault(); if (el.dataset.multi) document.execCommand('insertText', false, '\n'); else el.blur(); });
        el.addEventListener('paste', function (e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text')); });
      });
      bindImages(box, function (el) { var a = el.dataset.pi.split(':'), it = r.columns[+a[1]].items[+a[2]]; return { set: function (x) { it.image = x; }, del: function () { delete it.image; } }; }, draw, null);
      function on(sel, fn) { $$(sel, box).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); fn(b); }); }); }
      on('[data-add]', function (b) { r.columns[+b.dataset.add].items.push({ title: '', text: '', tag: '' }); draw(); });
      on('[data-rm]', function (b) { var a = b.dataset.rm.split(':').map(Number); r.columns[a[0]].items.splice(a[1], 1); draw(); });
      on('[data-up],[data-dn]', function (b) { var a = (b.dataset.up || b.dataset.dn).split(':').map(Number), d = b.dataset.up ? -1 : 1, arr = r.columns[a[0]].items, j = a[1] + d; if (j < 0 || j >= arr.length) return; var t = arr[a[1]]; arr[a[1]] = arr[j]; arr[j] = t; draw(); });
      on('[data-mv]', function (b) { var a = b.dataset.mv.split(':').map(Number), to = a[0] + a[2]; if (to < 0 || to >= r.columns.length) return; var it = r.columns[a[0]].items.splice(a[1], 1)[0]; r.columns[to].items.unshift(it); draw(); });
      on('[data-rimg]', function (b) { var a = b.dataset.rimg.split(':').map(Number), it = r.columns[a[0]].items[a[1]]; V.pickImage(function (x) { it.image = x; draw(); }, it.title + '. ' + it.text); });
      $('#road-save2').addEventListener('click', onSave);
    }
    draw();
  };
})();
