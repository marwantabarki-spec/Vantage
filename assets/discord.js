// VANTAGE admin · DISCORD COMPOSER
// Builds a webhook message (identity, text, up to 10 embeds, image galleries, fields) with a live Discord-style
// preview that is edited in place: click a text to edit it, click an image to change it, click the colour bar.
// Several webhooks can be saved (one per channel). After sending, the message can be updated in place, and its
// link is written back into the announcement / patch so the site's "View on Discord" button opens it.
(function () {
  'use strict';
  var V = window.VTG; if (!V) return;
  var $ = V.$, $$ = V.$$, esc = V.esc, say = V.say;
  var LS = { get: function (k, d) { try { var v = localStorage.getItem('vtg_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
             set: function (k, v) { try { localStorage.setItem('vtg_' + k, JSON.stringify(v)); } catch (e) {} } };
  var ORANGE = 0xff6a1a;
  var TAGI = { new: '🟢', update: '🔵', fix: '🟡', perf: '🟣', balance: '🔴' };
  var LIMIT = { content: 2000, title: 256, desc: 4096, fname: 256, fval: 1024, footer: 2048, author: 256, total: 6000 };

  // ------------------------------------------------------------------ state
  var hooks = LS.get('webhooks', null);
  if (!hooks) { hooks = []; if (V.KEY.wh) hooks.push({ name: 'Annonces', url: V.KEY.wh }); LS.set('webhooks', hooks); }
  var hookIdx = 0;
  var M = blank();             // the message being written
  var origin = null;           // { kind, ref } when opened from an announcement / patch
  var last = LS.get('lastSent', null);   // { hook, id, link }

  function blank() { return { username: 'VANTAGE', avatar: '', content: '', embeds: [emb()] }; }
  function emb(o) { return Object.assign({ color: ORANGE, author: '', authorIcon: '', title: '', url: '', description: '', thumb: '', images: [], fields: [], footer: 'VANTAGE', footerIcon: '', timestamp: true }, o || {}); }
  function img(p) { if (!p) return ''; return /^https?:/.test(p) ? p : V.rawURL(p); }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // ------------------------------------------------------------------ templates ("like the site page")
  function fromNews(n) {
    var url = V.siteURL() + '/annonces/' + n.id + '/';
    return { username: 'VANTAGE', avatar: '', content: '', embeds: [emb({
      author: 'VANTAGE · ' + (n.tag || 'Annonce').toUpperCase(), title: n.title, url: url,
      description: clip(n.text.split('\n').filter(Boolean).join('\n\n'), LIMIT.desc), images: n.image ? [n.image] : [],
      footer: 'VANTAGE · ' + (n.tag || 'Annonce'), timestamp: true })] };
  }
  function fromPatch(p) {
    var url = V.siteURL() + '/patch-notes/' + p.slug + '/';
    var hl = (p.highlights || []).map(function (h) { return '▸ ' + h; }).join('\n');
    var fields = p.sections.map(function (s) {
      var lines = [], len = 0;
      for (var i = 0; i < s.items.length; i++) {
        var l = (TAGI[s.items[i].tag] || '•') + ' ' + s.items[i].text;
        if (len + l.length + 40 > LIMIT.fval) { lines.push('… et ' + (s.items.length - i) + ' de plus sur le site'); break; }
        lines.push(l); len += l.length + 1;
      }
      return { name: s.title.toUpperCase() + '  ·  ' + s.items.length, value: lines.join('\n'), inline: false };
    }).slice(0, 25);
    return { username: 'VANTAGE', avatar: '', content: '', embeds: [emb({
      author: 'NOTES DE PATCH · v' + p.version, title: p.title, url: url,
      description: clip(p.summary + (hl ? '\n\n**À retenir**\n' + hl : '') + '\n\n[Lire toutes les notes de patch](' + url + ')', LIMIT.desc),
      images: p.image ? [p.image] : [], fields: fields, footer: 'VANTAGE · Notes de patch', timestamp: true })] };
  }
  function fromRoadmap() {
    var r = V.D.roadmap; if (!r) return blank();
    var dot = { done: '🟢', progress: '🟠', planned: '🔵', ideas: '⚪' };
    return { username: 'VANTAGE', avatar: '', content: '', embeds: [emb({
      author: 'VANTAGE · ROADMAP', title: 'Ce qui arrive', url: V.siteURL() + '/roadmap/', description: r.note || '',
      fields: r.columns.map(function (c) { return { name: (dot[c.id] || '•') + ' ' + c.title, value: clip(c.items.map(function (i) { return '**' + i.title + '**' + (i.tag ? ' · ' + i.tag : ''); }).join('\n') || '—', LIMIT.fval), inline: true }; }),
      images: [V.D.site && V.D.site.default_image].filter(Boolean), footer: 'VANTAGE · Roadmap', timestamp: true })] };
  }

  // ------------------------------------------------------------------ markdown (subset Discord renders)
  function md(s) {
    s = esc(s || '');
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<u>$1</u>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
         .replace(/~~([^~]+)~~/g, '<s>$1</s>').replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/(^|\n)&gt; ([^\n]*)/g, '$1<span class="dq">$2</span>');
    s = s.replace(/(^|\n)### ([^\n]*)/g, '$1<span class="h3">$2</span>').replace(/(^|\n)## ([^\n]*)/g, '$1<span class="h2">$2</span>').replace(/(^|\n)# ([^\n]*)/g, '$1<span class="h1">$2</span>');
    s = s.replace(/@(everyone|here)/g, '<span class="ment">@$1</span>');
    return s.replace(/\n/g, '<br>');
  }
  function hex(n) { return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6); }

  // ------------------------------------------------------------------ preview (edited in place)
  // every editable text is [data-ed="path"]: shows rendered markdown, becomes raw text while focused
  function get(path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, M); }
  function put(path, v) { var ks = path.split('.'), o = M; for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = v; }
  function ed(path, cls, ph, rich) { return '<div class="' + cls + ' ed" data-ed="' + path + '" data-ph="' + esc(ph) + '"' + (rich ? ' data-md="1"' : '') + ' spellcheck="false">' + (rich ? md(get(path)) : esc(get(path) || '')) + '</div>'; }
  function imgBox(path, cls, label) {
    var v = get(path);
    return '<button type="button" class="' + cls + (v ? '' : ' empty-img') + '" data-img="' + path + '" title="Changer l’image">' + (v ? '<img src="' + esc(img(v)) + '" alt="">' : '<span>+ ' + label + '</span>') + '</button>';
  }
  function render() {
    var box = $('#dc-preview');
    var now = new Date(), hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var h = '<div class="dmsg"><button type="button" class="dav" data-img="avatar" title="Changer l’avatar">' + (M.avatar ? '<img src="' + esc(img(M.avatar)) + '" alt="">' : '<span>V</span>') + '</button><div class="dbody">' +
      '<div class="dhead">' + ed('username', 'dname', 'Nom') + '<span class="dapp">APP</span><span class="dtime">Aujourd’hui à ' + hh + '</span></div>' +
      ed('content', 'dcontent', 'Message au-dessus des cartes (facultatif) — @everyone, @here…', true);
    M.embeds.forEach(function (e, i) {
      var p = 'embeds.' + i;
      h += '<div class="demb" style="--bar:' + hex(e.color) + '"><label class="dbar" title="Couleur de la barre"><input type="color" data-color="' + i + '" value="' + hex(e.color) + '"></label><div class="dgrid' + (e.thumb ? ' has-thumb' : '') + '"><div class="dmain">' +
        '<div class="dauthor">' + (e.authorIcon ? '<img src="' + esc(img(e.authorIcon)) + '" alt="">' : '') + ed(p + '.author', 'dauthn', 'Auteur (petite ligne du haut)') + '</div>' +
        ed(p + '.title', 'dtitle' + (e.url ? ' linked' : ''), 'Titre') +
        ed(p + '.description', 'ddesc', 'Description — **gras**, *italique*, [lien](https://…)', true) +
        '<div class="dfields">' + e.fields.map(function (f, fi) {
          return '<div class="dfield' + (f.inline ? ' inl' : '') + '">' + ed(p + '.fields.' + fi + '.name', 'dfn', 'Nom du champ') + ed(p + '.fields.' + fi + '.value', 'dfv', 'Valeur', true) +
            '<span class="dftools"><button type="button" data-finl="' + i + ':' + fi + '" title="Côte à côte">' + (f.inline ? '▤' : '▥') + '</button><button type="button" data-fup="' + i + ':' + fi + '" title="Monter">▲</button><button type="button" data-fdel="' + i + ':' + fi + '" title="Supprimer">✕</button></span></div>';
        }).join('') + '</div>' +
        '<button type="button" class="dadd" data-fadd="' + i + '">+ champ</button>' +
        '</div>' + imgBox(p + '.thumb', 'dthumb', 'vignette') + '</div>' +
        '<div class="dimgs n' + Math.max(1, e.images.length) + '">' + e.images.map(function (_, k) { return imgBox(p + '.images.' + k, 'dimg', 'image'); }).join('') +
        (e.images.length < 4 ? '<button type="button" class="dimg empty-img add" data-iadd="' + i + '"><span>+ image' + (e.images.length ? ' (galerie)' : '') + '</span></button>' : '') + '</div>' +
        '<div class="dfoot">' + (e.footerIcon ? '<img src="' + esc(img(e.footerIcon)) + '" alt="">' : '') + ed(p + '.footer', 'dfoottxt', 'Pied de carte') + (e.timestamp ? '<span class="dts"> • Aujourd’hui à ' + hh + '</span>' : '') + '</div>' +
        '</div>';
    });
    h += '</div></div>';
    box.innerHTML = h;
    bindPreview();
    renderSide();
  }
  function bindPreview() {
    var box = $('#dc-preview');
    $$('[data-ed]', box).forEach(function (el) {
      el.contentEditable = 'plaintext-only';
      if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
      el.addEventListener('focus', function () { el.textContent = get(el.dataset.ed) || ''; el.classList.add('editing'); });
      el.addEventListener('input', function () { put(el.dataset.ed, el.innerText.replace(/\n$/, '')); counters(); });
      el.addEventListener('blur', function () { el.classList.remove('editing'); el.innerHTML = el.dataset.md ? md(get(el.dataset.ed)) : esc(get(el.dataset.ed) || ''); save(); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !el.dataset.md && !/description|value|content/.test(el.dataset.ed)) { e.preventDefault(); el.blur(); } });
      el.addEventListener('paste', function (e) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text')); });
    });
    $$('[data-img]', box).forEach(function (b) { b.addEventListener('click', function () {
      var path = b.dataset.img;
      V.pickImage(function (p) { put(path, p); render(); save(); });
    }); b.addEventListener('contextmenu', function (e) {   // right click: remove the image
      e.preventDefault(); var path = b.dataset.img, m = path.match(/^embeds\.(\d+)\.images\.(\d+)$/);
      if (m) M.embeds[+m[1]].images.splice(+m[2], 1); else put(path, '');
      render(); save();
    }); });
    $$('[data-iadd]', box).forEach(function (b) { b.addEventListener('click', function () {
      var e = M.embeds[+b.dataset.iadd];
      V.pickImage(function (p) { e.images.push(p); render(); save(); });
    }); });
    $$('[data-color]', box).forEach(function (c) { c.addEventListener('input', function () { M.embeds[+c.dataset.color].color = parseInt(c.value.slice(1), 16); c.closest('.demb').style.setProperty('--bar', c.value); save(); }); });
    $$('[data-fadd]', box).forEach(function (b) { b.addEventListener('click', function () { var e = M.embeds[+b.dataset.fadd]; if (e.fields.length >= 25) return say('25 champs maximum.', true); e.fields.push({ name: 'Nouveau champ', value: 'Texte', inline: false }); render(); save(); }); });
    $$('[data-fdel]', box).forEach(function (b) { b.addEventListener('click', function () { var a = b.dataset.fdel.split(':'); M.embeds[a[0]].fields.splice(a[1], 1); render(); save(); }); });
    $$('[data-finl]', box).forEach(function (b) { b.addEventListener('click', function () { var a = b.dataset.finl.split(':'), f = M.embeds[a[0]].fields[a[1]]; f.inline = !f.inline; render(); save(); }); });
    $$('[data-fup]', box).forEach(function (b) { b.addEventListener('click', function () { var a = b.dataset.fup.split(':').map(Number), arr = M.embeds[a[0]].fields; if (a[1] > 0) { var t = arr[a[1]]; arr[a[1]] = arr[a[1] - 1]; arr[a[1] - 1] = t; render(); save(); } }); });
  }

  // ------------------------------------------------------------------ side panel
  function renderSide() {
    var s = $('#dc-hooks');
    s.innerHTML = hooks.map(function (h, i) { return '<option value="' + i + '"' + (i === hookIdx ? ' selected' : '') + '>' + esc(h.name) + '</option>'; }).join('') || '<option value="-1">Aucun webhook — ajoute-en un</option>';
    var list = $('#dc-embeds');
    list.innerHTML = M.embeds.map(function (e, i) {
      return '<div class="dc-emb"><b>Carte ' + (i + 1) + '</b><span class="dc-sw" style="background:' + hex(e.color) + '"></span>' +
        '<input placeholder="Lien du titre (https://…)" value="' + esc(e.url) + '" data-url="' + i + '">' +
        '<div class="row tight"><label class="chk"><input type="checkbox" data-ts="' + i + '"' + (e.timestamp ? ' checked' : '') + '> Heure</label>' +
        '<button class="mini" data-ai="' + i + '" title="Icône de l’auteur">Icône auteur</button><button class="mini" data-fi="' + i + '" title="Icône du pied">Icône pied</button>' +
        '<button class="mini" data-up="' + i + '">▲</button><button class="mini bad" data-del="' + i + '">✕</button></div></div>';
    }).join('');
    $$('[data-url]', list).forEach(function (el) { el.addEventListener('input', function () { M.embeds[+el.dataset.url].url = el.value.trim(); save(); }); el.addEventListener('change', render); });
    $$('[data-ts]', list).forEach(function (el) { el.addEventListener('change', function () { M.embeds[+el.dataset.ts].timestamp = el.checked; render(); save(); }); });
    $$('[data-ai]', list).forEach(function (b) { b.addEventListener('click', function () { var e = M.embeds[+b.dataset.ai]; V.pickImage(function (p) { e.authorIcon = p; render(); save(); }); }); });
    $$('[data-fi]', list).forEach(function (b) { b.addEventListener('click', function () { var e = M.embeds[+b.dataset.fi]; V.pickImage(function (p) { e.footerIcon = p; render(); save(); }); }); });
    $$('[data-up]', list).forEach(function (b) { b.addEventListener('click', function () { var i = +b.dataset.up; if (i > 0) { var t = M.embeds[i]; M.embeds[i] = M.embeds[i - 1]; M.embeds[i - 1] = t; render(); save(); } }); });
    $$('[data-del]', list).forEach(function (b) { b.addEventListener('click', function () { M.embeds.splice(+b.dataset.del, 1); render(); save(); }); });
    var lt = $('#dc-last');
    lt.innerHTML = last ? 'Dernier envoi : ' + (last.link ? '<a href="' + esc(last.link) + '" target="_blank" rel="noopener">voir le message</a>' : 'message ' + esc(last.id)) : 'Aucun message envoyé depuis ce navigateur.';
    $('#dc-update').disabled = !last;
    counters();
  }
  function counters() {
    var total = M.embeds.reduce(function (n, e) { return n + (e.title || '').length + (e.description || '').length + (e.author || '').length + (e.footer || '').length + e.fields.reduce(function (k, f) { return k + f.name.length + f.value.length; }, 0); }, 0);
    var bad = [];
    if ((M.content || '').length > LIMIT.content) bad.push('message > 2000');
    M.embeds.forEach(function (e, i) {
      if ((e.description || '').length > LIMIT.desc) bad.push('description ' + (i + 1) + ' > 4096');
      if ((e.title || '').length > LIMIT.title) bad.push('titre ' + (i + 1) + ' > 256');
      e.fields.forEach(function (f) { if (f.value.length > LIMIT.fval) bad.push('champ « ' + clip(f.name, 20) + ' » > 1024'); });
    });
    if (total > LIMIT.total) bad.push('total des cartes > 6000');
    var c = $('#dc-count'); c.textContent = total + ' / 6000 caractères' + (bad.length ? ' · ⚠ ' + bad.join(', ') : '');
    c.classList.toggle('bad', bad.length > 0);
    $('#dc-send').disabled = bad.length > 0 || !hooks.length;
    return bad.length === 0;
  }
  function save() { LS.set('draft', { M: M, origin: origin && { kind: origin.kind, id: origin.ref.id || origin.ref.slug } }); }

  // ------------------------------------------------------------------ payload + send
  function payload() {
    var embeds = [];
    M.embeds.forEach(function (e) {
      var base = V.siteURL() + '/';
      var url = e.url || (e.images.length > 1 ? base : '');
      var o = { color: e.color };
      if (e.author) o.author = { name: clip(e.author, LIMIT.author), icon_url: e.authorIcon ? img(e.authorIcon) : undefined };
      if (e.title) o.title = clip(e.title, LIMIT.title);
      if (url) o.url = url;
      if (e.description) o.description = e.description;
      if (e.fields.length) o.fields = e.fields.filter(function (f) { return f.name.trim() && f.value.trim(); }).map(function (f) { return { name: f.name, value: f.value, inline: !!f.inline }; });
      if (e.thumb) o.thumbnail = { url: img(e.thumb) };
      if (e.images[0]) o.image = { url: img(e.images[0]) };
      if (e.footer) o.footer = { text: clip(e.footer, LIMIT.footer), icon_url: e.footerIcon ? img(e.footerIcon) : undefined };
      if (e.timestamp) o.timestamp = new Date().toISOString();
      embeds.push(o);
      // gallery: extra embeds with the same url and only an image are shown by Discord as a grid on the first card
      e.images.slice(1).forEach(function (p) { embeds.push({ url: url, image: { url: img(p) } }); });
    });
    return { username: M.username || undefined, avatar_url: M.avatar ? img(M.avatar) : undefined, content: M.content || '', embeds: embeds.slice(0, 10),
      allowed_mentions: { parse: /@(everyone|here)/.test(M.content) ? ['everyone'] : [] } };
  }
  function hookURL() { var h = hooks[hookIdx]; return h ? h.url.replace(/\?.*$/, '') : ''; }
  function call(method, url, body) {
    return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var m = j.message || ('HTTP ' + r.status); if (j.errors) m += ' · ' + JSON.stringify(j.errors).slice(0, 160); throw new Error(m); } return j; }); });
  }
  function send() {
    if (!counters()) return;
    var url = hookURL(); if (!url) return say('Ajoute un webhook.', true);
    var p = payload(); if (!p.content && !p.embeds.length) return say('Le message est vide.', true);
    var btn = $('#dc-send'); btn.disabled = true;
    call('POST', url + '?wait=true', p).then(function (msg) {
      return call('GET', url).catch(function () { return {}; }).then(function (wh) {
        var link = wh.guild_id ? 'https://discord.com/channels/' + wh.guild_id + '/' + msg.channel_id + '/' + msg.id : '';
        last = { hook: url, id: msg.id, link: link }; LS.set('lastSent', last);
        say('Envoyé sur Discord !');
        renderSide();
        // the site's "View on Discord" button now opens this message
        if (origin && link) {
          origin.ref.discord_message = link;
          (origin.kind === 'news' ? V.saveNews('Lien Discord : ' + (origin.ref.title || '')) : V.savePatches('Lien Discord : v' + origin.ref.version)).catch(function () {});
        }
      });
    }, function (e) { say('Discord : ' + e.message, true); }).then(function () { btn.disabled = false; counters(); });
  }
  function update() {
    if (!last) return;
    if (!counters()) return;
    if (!confirm('Remplacer le contenu du dernier message envoyé par cet aperçu ?')) return;
    call('PATCH', last.hook + '/messages/' + last.id, payload()).then(function () { say('Message mis à jour sur Discord.'); }, function (e) { say('Discord : ' + e.message, true); });
  }

  // ------------------------------------------------------------------ open / wiring
  V.compose = function (o) {
    origin = o && o.ref ? o : null;
    M = o && o.kind === 'news' ? fromNews(o.ref) : o && o.kind === 'patch' ? fromPatch(o.ref) : o && o.kind === 'roadmap' ? fromRoadmap() : blank();
    V.openTab('discord'); render(); save();
    var t = $('#dc-origin'); t.textContent = origin ? (origin.kind === 'news' ? 'Annonce : ' + origin.ref.title : 'Patch v' + origin.ref.version + ' : ' + origin.ref.title) : 'Message libre';
  };
  function wire() {
    $('#dc-hooks').addEventListener('change', function (e) { hookIdx = +e.target.value; });
    $('#dc-addhook').addEventListener('click', function () {
      var name = prompt('Nom du salon (ex. Annonces, Patch notes) :'); if (!name) return;
      var url = prompt('URL du webhook Discord :'); if (!url || !/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(url.trim())) return say('URL de webhook invalide.', true);
      hooks.push({ name: name.trim(), url: url.trim() }); LS.set('webhooks', hooks); hookIdx = hooks.length - 1; renderSide();
    });
    $('#dc-delhook').addEventListener('click', function () { if (!hooks[hookIdx] || !confirm('Retirer le webhook « ' + hooks[hookIdx].name + ' » de ce navigateur ?')) return; hooks.splice(hookIdx, 1); hookIdx = 0; LS.set('webhooks', hooks); renderSide(); });
    $('#dc-t-news').addEventListener('click', function () { var n = (V.D.news || [])[0]; if (!n) return say('Aucune annonce.', true); V.compose({ kind: 'news', ref: n }); });
    $('#dc-t-patch').addEventListener('click', function () { var p = (V.D.patches || [])[0]; if (!p) return say('Aucun patch.', true); V.compose({ kind: 'patch', ref: p }); });
    $('#dc-t-road').addEventListener('click', function () { V.compose({ kind: 'roadmap' }); });
    $('#dc-t-blank').addEventListener('click', function () { V.compose(null); });
    $('#dc-addemb').addEventListener('click', function () { if (M.embeds.length >= 10) return say('10 cartes maximum.', true); M.embeds.push(emb()); render(); save(); });
    $('#dc-ping-e').addEventListener('click', function () { M.content = ('@everyone ' + (M.content || '').replace(/@(everyone|here)\s*/g, '')).trim(); render(); save(); });
    $('#dc-ping-h').addEventListener('click', function () { M.content = ('@here ' + (M.content || '').replace(/@(everyone|here)\s*/g, '')).trim(); render(); save(); });
    $('#dc-send').addEventListener('click', send);
    $('#dc-update').addEventListener('click', update);
    $('#dc-json').addEventListener('click', function () {
      var t = JSON.stringify(payload(), null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { say('JSON copié.'); }); else window.prompt('JSON :', t);
    });
    var d = LS.get('draft', null);
    if (d && d.M) {
      M = d.M; M.embeds.forEach(function (e, i) { M.embeds[i] = emb(e); });
      if (d.origin) {
        var list = d.origin.kind === 'news' ? (V.D.news || []) : (V.D.patches || []);
        var ref = list.filter(function (x) { return (x.id || x.slug) === d.origin.id; })[0];
        if (ref) origin = { kind: d.origin.kind, ref: ref };
      }
    }
    $('#dc-origin').textContent = origin ? (origin.kind === 'news' ? 'Annonce : ' + origin.ref.title : 'Patch v' + origin.ref.version + ' : ' + origin.ref.title) : 'Message libre';
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
