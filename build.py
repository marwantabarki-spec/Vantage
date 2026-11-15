#!/usr/bin/env python3
"""VANTAGE site builder.

Edit the files in data/ then run:   python3 build.py
It rewrites the HTML pages (index, patch notes, roadmap). Every patch gets its own page with the
Open Graph tags Discord reads, so pasting its link in Discord shows a card with the title, summary and image.
"""
import json, html, os, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
def load(name):
    with open(os.path.join(ROOT, "data", name), encoding="utf-8") as f:
        return json.load(f)

SITE = load("site.json")
PATCHES = sorted(load("patches.json"), key=lambda p: p["date"], reverse=True)
ROADMAP = load("roadmap.json")
BASE = SITE["base_url"].rstrip("/")
E = html.escape

MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
def fdate(d):
    y, m, dd = (int(x) for x in d.split("-"))
    return f"{dd} {MONTHS[m - 1]} {y}"

TAGS = {"new": ("NOUVEAU", "t-new"), "update": ("AMÉLIORATION", "t-up"), "fix": ("CORRECTION", "t-fix"),
        "perf": ("PERFORMANCES", "t-perf"), "balance": ("ÉQUILIBRAGE", "t-bal")}

def page(path, title, desc, image, body, root, kind="website", active=""):
    url = f"{BASE}/{path}".rstrip("/") + "/"
    img = f"{BASE}/{image}"
    nav = "".join(
        f'<a href="{root}{href}" class="{"on" if active == key else ""}">{label}</a>'
        for key, href, label in (("home", "", "Accueil"), ("patch", "patch-notes/", "Notes de patch"), ("road", "roadmap/", "Roadmap")))
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<meta name="theme-color" content="{SITE['accent']}">
<meta property="og:site_name" content="{E(SITE['name'])}">
<meta property="og:type" content="{kind}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1600">
<meta property="og:image:height" content="900">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{E(title)}">
<meta name="twitter:description" content="{E(desc)}">
<meta name="twitter:image" content="{img}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}assets/style.css">
</head>
<body>
<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="{root}"><span class="mark"></span>{E(SITE['name'])}</a>
    <button class="burger" aria-label="Menu" aria-expanded="false">☰</button>
    <nav class="nav">{nav}<a class="btn btn-discord sm" href="{E(SITE['discord_invite'])}" target="_blank" rel="noopener">Discord</a></nav>
  </div>
</header>
<main>
{body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <span>© {datetime.date.today().year} {E(SITE['name'])} · Jeu non affilié à Roblox Corporation.</span>
    <span><a href="{E(SITE['roblox_url'])}" target="_blank" rel="noopener">Jouer sur Roblox</a> · <a href="{E(SITE['discord_invite'])}" target="_blank" rel="noopener">Rejoindre le Discord</a></span>
  </div>
</footer>
<div class="toast" role="status" aria-live="polite"></div>
<script src="{root}assets/site.js"></script>
</body>
</html>
"""

def write(rel, content):
    full = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)

def counts(p):
    c = {}
    for s in p["sections"]:
        for it in s["items"]:
            c[it["tag"]] = c.get(it["tag"], 0) + 1
    return c

def share_bar(p, root):
    url = f"{BASE}/patch-notes/{p['slug']}/"
    disc = p.get("discord_message") or SITE["discord_invite"]
    label = "Voir l'annonce sur Discord" if p.get("discord_message") else "Discuter sur Discord"
    return f"""<div class="share">
      <a class="btn btn-discord" href="{E(disc)}" target="_blank" rel="noopener">{icon_discord()}{label}</a>
      <button class="btn btn-ghost js-copy" data-url="{E(url)}">Copier le lien pour Discord</button>
    </div>"""

def icon_discord():
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 -.2 13.5.2 18a19.8 19.8 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.6-3.5-13.6ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z"/></svg>'

def card(p, root, big=False):
    c = counts(p)
    chips = "".join(f'<span class="chip {TAGS[t][1]}">{n} {TAGS[t][0].lower()}</span>' for t, n in c.items() if t in TAGS)
    return f"""<a class="pcard{' big' if big else ''}" href="{root}patch-notes/{p['slug']}/">
      <div class="pimg" style="background-image:url('{root}{p['image']}')"><span class="ver">v{E(p['version'])}</span></div>
      <div class="pbody">
        <div class="meta">{fdate(p['date'])}</div>
        <h3>{E(p['title'])}</h3>
        <p>{E(p['summary'])}</p>
        <div class="chips">{chips}</div>
      </div>
    </a>"""

def roadmap_board(root, limit=None):
    cols = []
    for col in ROADMAP["columns"]:
        items = col["items"][:limit] if limit else col["items"]
        lis = "".join(f'<li class="ritem"><div class="rtag">{E(i["tag"])}</div><h4>{E(i["title"])}</h4><p>{E(i["text"])}</p></li>' for i in items)
        cols.append(f'<div class="rcol r-{col["id"]}"><div class="rhead"><span class="dot"></span>{E(col["title"])}<span class="n">{len(col["items"])}</span></div><ul>{lis}</ul></div>')
    return f'<div class="board">{"".join(cols)}</div>'

# ---------------------------------------------------------------- patch pages
for i, p in enumerate(PATCHES):
    root = "../../"
    secs = []
    for s in p["sections"]:
        lis = "".join(f'<li data-tag="{it["tag"]}"><span class="tag {TAGS.get(it["tag"], ("", ""))[1]}">{TAGS.get(it["tag"], (it["tag"].upper(), ""))[0]}</span><span>{E(it["text"])}</span></li>' for it in s["items"])
        sid = s["title"].lower().replace(" ", "-").replace("&", "et")
        secs.append(f'<section class="nsec" id="{E(sid)}"><h2>{E(s["title"])}</h2><ul class="notes">{lis}</ul></section>')
    toc = "".join(f'<a href="#{E(s["title"].lower().replace(" ", "-").replace("&", "et"))}">{E(s["title"])}</a>' for s in p["sections"])
    filt = '<button class="f on" data-f="all">Tout</button>' + "".join(f'<button class="f" data-f="{t}">{TAGS[t][0].capitalize()}</button>' for t in counts(p) if t in TAGS)
    hl = "".join(f"<li>{E(h)}</li>" for h in p.get("highlights", []))
    prev_p = PATCHES[i + 1] if i + 1 < len(PATCHES) else None
    next_p = PATCHES[i - 1] if i > 0 else None
    pager = '<div class="pager">' + (f'<a href="{root}patch-notes/{prev_p["slug"]}/">← v{E(prev_p["version"])} · {E(prev_p["title"])}</a>' if prev_p else "<span></span>") + \
            (f'<a href="{root}patch-notes/{next_p["slug"]}/">v{E(next_p["version"])} · {E(next_p["title"])} →</a>' if next_p else "<span></span>") + "</div>"
    body = f"""
<section class="phero"><div class="bgimg" style="background-image:url('{root}{p['image']}')"></div>
  <div class="wrap">
    <a class="crumb" href="{root}patch-notes/">← Toutes les notes de patch</a>
    <div class="kicker">Notes de patch · v{E(p['version'])} · {fdate(p['date'])}</div>
    <h1>{E(p['title'])}</h1>
    <p class="lead">{E(p['summary'])}</p>
    {share_bar(p, root)}
  </div>
</section>
<div class="wrap pgrid">
  <aside class="side">
    <div class="box"><div class="bt">À retenir</div><ul class="hl">{hl}</ul></div>
    <div class="box"><div class="bt">Sommaire</div><nav class="toc">{toc}</nav></div>
  </aside>
  <article class="content">
    <div class="filters" role="toolbar" aria-label="Filtrer">{filt}</div>
    {''.join(secs)}
    {share_bar(p, root)}
    {pager}
  </article>
</div>"""
    write(f"patch-notes/{p['slug']}/index.html",
          page(f"patch-notes/{p['slug']}", f"{SITE['name']} · v{p['version']} — {p['title']}", p["summary"], p["image"], body, root, "article", "patch"))

# ---------------------------------------------------------------- patch list
root = "../"
lst = "".join(card(p, root) for p in PATCHES)
body = f"""
<section class="shero"><div class="wrap"><div class="kicker">Journal des mises à jour</div><h1>Notes de patch</h1>
<p class="lead">Tout ce qui change dans {E(SITE['name'])}, mise à jour par mise à jour.</p></div></section>
<div class="wrap"><div class="grid">{lst}</div></div>"""
write("patch-notes/index.html", page("patch-notes", f"{SITE['name']} · Notes de patch", f"Toutes les mises à jour de {SITE['name']}.", SITE["default_image"], body, root, active="patch"))

# ---------------------------------------------------------------- roadmap
body = f"""
<section class="shero"><div class="wrap"><div class="kicker">Ce qui arrive</div><h1>Roadmap</h1>
<p class="lead">{E(ROADMAP['note'])}</p>
<div class="share"><a class="btn btn-discord" href="{E(SITE['discord_invite'])}" target="_blank" rel="noopener">{icon_discord()}Proposer une idée sur Discord</a>
<button class="btn btn-ghost js-copy" data-url="{BASE}/roadmap/">Copier le lien pour Discord</button></div></div></section>
<div class="wrap">{roadmap_board(root)}</div>"""
write("roadmap/index.html", page("roadmap", f"{SITE['name']} · Roadmap", ROADMAP["note"], SITE["default_image"], body, root, active="road"))

# ---------------------------------------------------------------- home
root = ""
latest = PATCHES[0]
others = "".join(card(p, root) for p in PATCHES[1:4])
body = f"""
<section class="hero"><div class="bgimg" style="background-image:url('{latest['image']}')"></div>
  <div class="wrap">
    <div class="kicker"><span class="live"></span>Dernière mise à jour · v{E(latest['version'])}</div>
    <h1>{E(latest['title'])}</h1>
    <p class="lead">{E(latest['summary'])}</p>
    <div class="share">
      <a class="btn btn-primary" href="patch-notes/{latest['slug']}/">Lire les notes de patch</a>
      <a class="btn btn-discord" href="{E(latest.get('discord_message') or SITE['discord_invite'])}" target="_blank" rel="noopener">{icon_discord()}Annonce Discord</a>
      <a class="btn btn-ghost" href="{E(SITE['roblox_url'])}" target="_blank" rel="noopener">Jouer</a>
    </div>
  </div>
</section>
<div class="wrap">
  <div class="sect-head"><h2>Mises à jour précédentes</h2><a href="patch-notes/">Tout voir →</a></div>
  <div class="grid">{others}</div>
  <div class="sect-head"><h2>Roadmap</h2><a href="roadmap/">Voir la roadmap →</a></div>
  {roadmap_board(root, limit=2)}
  <section class="cta">
    <div><h2>Rejoins la communauté</h2><p>Annonces des patchs, retours, recherche d'escouade : tout se passe sur le Discord.</p></div>
    <a class="btn btn-discord" href="{E(SITE['discord_invite'])}" target="_blank" rel="noopener">{icon_discord()}Rejoindre le Discord</a>
  </section>
</div>"""
write("index.html", page("", f"{SITE['name']} · {SITE['tagline']}", latest["summary"], latest["image"], body, root, active="home"))

# GitHub Pages: serve the folders as they are
write(".nojekyll", "")
print(f"OK · {len(PATCHES)} notes de patch · base {BASE}")
