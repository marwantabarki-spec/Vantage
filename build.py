#!/usr/bin/env python3
"""VANTAGE site builder.

The content lives in data/ (site.json, patches.json, roadmap.json, news.json). The admin page (/admin/) edits these
files on GitHub; GitHub Actions then runs this script and publishes the site. You can also run it by hand:
    python3 build.py
Every patch and every announcement gets its own page with the Open Graph tags Discord reads (card preview).
"""
import json, html, os, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
def load(name, default=None):
    p = os.path.join(ROOT, "data", name)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)

SITE = load("site.json")
PATCHES = sorted(load("patches.json", []), key=lambda p: (p["date"], [int(x) if x.isdigit() else 0 for x in str(p["version"]).split(".")]), reverse=True)
ROADMAP = load("roadmap.json", {"note": "", "columns": []})
NEWS = sorted(load("news.json", []), key=lambda n: (not n.get("pinned"), n["date"]), reverse=False)
NEWS = sorted(NEWS, key=lambda n: n["date"], reverse=True)
NEWS = [n for n in NEWS if n.get("pinned")] + [n for n in NEWS if not n.get("pinned")]
BASE = SITE["base_url"].rstrip("/")
E = html.escape

MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
MON = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"]
def fdate(d):
    y, m, dd = (int(x) for x in d.split("-"))
    return f"{dd} {MONTHS[m - 1]} {y}"
def sdate(d):
    y, m, dd = (int(x) for x in d.split("-"))
    return f"<b>{dd:02d}</b><span>{MON[m - 1]}</span>"

TAGS = {"new": ("NOUVEAU", "t-new"), "update": ("AMÉLIORATION", "t-up"), "fix": ("CORRECTION", "t-fix"),
        "perf": ("PERFORMANCES", "t-perf"), "balance": ("ÉQUILIBRAGE", "t-bal")}

def slugify(s):
    return s.lower().replace(" ", "-").replace("&", "et").replace("'", "")

DISCORD_SVG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9-.2 13.5.2 18a19.8 19.8 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 12 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.6-3.5-13.6ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z"/></svg>'
PLAY_SVG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>'
LINK_SVG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'

def page(path, title, desc, image, body, root, kind="website", active=""):
    url = f"{BASE}/{path}".rstrip("/") + "/"
    img = f"{BASE}/{image}"
    links = (("home", "", "Accueil"), ("news", "annonces/", "Annonces"), ("patch", "patch-notes/", "Patchs"),
             ("road", "roadmap/", "Roadmap"), ("status", "status/", "Serveurs"))
    nav = "".join(f'<a href="{root}{href}" class="{"on" if active == key else ""}">{label}</a>' for key, href, label in links)
    ticker_items = "".join(f"<span>{E(t)}</span><i>◆</i>" for t in SITE.get("ticker", []))
    st = SITE.get("status", {})
    maint = ""
    if st.get("mode") in ("maintenance", "degraded"):
        label = "MAINTENANCE EN COURS" if st["mode"] == "maintenance" else "PERTURBATIONS EN COURS"
        maint = f'<div class="alert a-{st["mode"]}"><div class="wrap"><b>{label}</b><span>{E(st.get("message") or "")}</span><a href="{root}status/">Détails →</a></div></div>'
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
<link rel="icon" href="{root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}assets/style.css">
</head>
<body data-root="{root}" data-universe="{SITE['universe_id']}" data-place="{SITE['place_id']}" data-mode="{E(st.get('mode', 'online'))}">
<div class="grain" aria-hidden="true"></div>
<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="{root}"><span class="mark"></span><span class="bname">{E(SITE['name'])}</span></a>
    <nav class="nav">{nav}</nav>
    <a class="livepill" href="{root}status/" title="État des serveurs"><span class="ldot"></span><span data-stat="playing-short">—</span><em>en jeu</em></a>
    <a class="btn btn-discord sm hide-m" href="{E(SITE['discord_invite'])}" target="_blank" rel="noopener">{DISCORD_SVG}Discord</a>
    <button class="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span></button>
  </div>
  <div class="ticker" aria-hidden="true"><div class="tk">{ticker_items}{ticker_items}</div></div>
</header>
{maint}
<main>
{body}
</main>
<footer class="foot">
  <div class="wrap">
    <div class="foot-cta">
      <div><div class="kicker">Prêt au largage ?</div><h2>Rejoins la zone.</h2></div>
      <div class="share"><a class="btn btn-primary" href="{E(SITE['roblox_url'])}" target="_blank" rel="noopener">{PLAY_SVG}Jouer sur Roblox</a>
      <a class="btn btn-discord" href="{E(SITE['discord_invite'])}" target="_blank" rel="noopener">{DISCORD_SVG}Rejoindre le Discord</a></div>
    </div>
    <div class="foot-in">
      <a class="brand" href="{root}"><span class="mark"></span><span class="bname">{E(SITE['name'])}</span></a>
      <nav>{nav}</nav>
      <span class="legal">© {datetime.date.today().year} {E(SITE['name'])} · Jeu indépendant, non affilié à Roblox Corporation.</span>
    </div>
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

def share_bar(url, discord_message, label_msg="Voir l'annonce sur Discord"):
    disc = discord_message or SITE["discord_invite"]
    label = label_msg if discord_message else "Discuter sur Discord"
    return f"""<div class="share">
      <a class="btn btn-discord" href="{E(disc)}" target="_blank" rel="noopener">{DISCORD_SVG}{label}</a>
      <button class="btn btn-ghost js-copy" data-url="{E(url)}">{LINK_SVG}Copier le lien pour Discord</button>
    </div>"""

def pcard(p, root):
    c = counts(p)
    chips = "".join(f'<span class="chip {TAGS[t][1]}">{n} {TAGS[t][0].lower()}</span>' for t, n in c.items() if t in TAGS)
    return f"""<a class="pcard" href="{root}patch-notes/{p['slug']}/">
      <div class="pimg"><img src="{root}{p['image']}" alt="" loading="lazy"><span class="ver">v{E(p['version'])}</span></div>
      <div class="pbody">
        <div class="meta">Notes de patch · {fdate(p['date'])}</div>
        <h3>{E(p['title'])}</h3>
        <p>{E(p['summary'])}</p>
        <div class="chips">{chips}</div>
      </div>
      <span class="corner" aria-hidden="true"></span>
    </a>"""

def ncard(n, root, feat=False):
    return f"""<a class="ncard{' feat' if feat else ''}" href="{root}annonces/{n['id']}/">
      <div class="nimg"><img src="{root}{n.get('image') or SITE['default_image']}" alt="" loading="lazy"></div>
      <div class="nbody">
        <div class="ndate">{sdate(n['date'])}</div>
        <div><div class="meta">{E(n.get('tag') or 'Annonce')}{' · <span class="pin">Épinglé</span>' if n.get('pinned') else ''}</div>
        <h3>{E(n['title'])}</h3><p>{E(n['text'])}</p></div>
      </div>
    </a>"""

def roadmap_board(limit=None):
    cols = []
    for idx, col in enumerate(ROADMAP["columns"]):
        items = col["items"][:limit] if limit else col["items"]
        lis = "".join(f'<li class="ritem"><div class="rtag">{E(i.get("tag", ""))}</div><h4>{E(i["title"])}</h4><p>{E(i.get("text", ""))}</p></li>' for i in items)
        cols.append(f'<div class="rcol r-{E(col["id"])}"><div class="rhead"><span class="rn">0{idx + 1}</span><span class="dot"></span>{E(col["title"])}<span class="n">{len(col["items"])}</span></div><ul>{lis}</ul></div>')
    return f'<div class="board">{"".join(cols)}</div>'

STATS = """<div class="stats">
  <div class="stat big"><span class="sl"><i class="ldot"></i>Joueurs en jeu</span><b data-stat="playing">—</b></div>
  <div class="stat"><span class="sl">Serveurs publics</span><b data-stat="servers">—</b></div>
  <div class="stat"><span class="sl">Visites</span><b data-stat="visits">—</b></div>
  <div class="stat"><span class="sl">Favoris</span><b data-stat="favorites">—</b></div>
  <div class="stat"><span class="sl">Avis positifs</span><b data-stat="rating">—</b></div>
</div>"""

def sect(num, kicker, title, link=None, root=""):
    a = f'<a class="more" href="{root}{link[0]}">{link[1]} →</a>' if link else ""
    return f'<div class="sect-head"><div><div class="kicker"><span class="num">{num}</span>{kicker}</div><h2>{title}</h2></div>{a}</div>'

# ---------------------------------------------------------------- patch pages
for i, p in enumerate(PATCHES):
    root = "../../"
    secs = []
    for s in p["sections"]:
        lis = "".join(f'<li data-tag="{it["tag"]}"><span class="tag {TAGS.get(it["tag"], ("", ""))[1]}">{TAGS.get(it["tag"], (it["tag"].upper(), ""))[0]}</span><span>{E(it["text"])}</span></li>' for it in s["items"])
        secs.append(f'<section class="nsec" id="{E(slugify(s["title"]))}"><h2><span>{E(s["title"])}</span><em>{len(s["items"])}</em></h2><ul class="notes">{lis}</ul></section>')
    toc = "".join(f'<a href="#{E(slugify(s["title"]))}">{E(s["title"])}<em>{len(s["items"])}</em></a>' for s in p["sections"])
    filt = '<button class="f on" data-f="all">Tout</button>' + "".join(f'<button class="f" data-f="{t}"><i class="{TAGS[t][1]}"></i>{TAGS[t][0].capitalize()}</button>' for t in counts(p) if t in TAGS)
    hl = "".join(f"<li>{E(h)}</li>" for h in p.get("highlights", []))
    prev_p = PATCHES[i + 1] if i + 1 < len(PATCHES) else None
    next_p = PATCHES[i - 1] if i > 0 else None
    pager = '<div class="pager">' + (f'<a href="{root}patch-notes/{prev_p["slug"]}/"><small>Patch précédent</small>v{E(prev_p["version"])} · {E(prev_p["title"])}</a>' if prev_p else "<span></span>") + \
            (f'<a class="r" href="{root}patch-notes/{next_p["slug"]}/"><small>Patch suivant</small>v{E(next_p["version"])} · {E(next_p["title"])}</a>' if next_p else "<span></span>") + "</div>"
    url = f"{BASE}/patch-notes/{p['slug']}/"
    total = sum(len(s["items"]) for s in p["sections"])
    body = f"""
<section class="phero"><div class="bgimg" style="background-image:url('{root}{p['image']}')"></div>
  <div class="wrap">
    <a class="crumb" href="{root}patch-notes/">← Toutes les notes de patch</a>
    <div class="kicker"><span class="badge">v{E(p['version'])}</span>Notes de patch · {fdate(p['date'])}</div>
    <h1>{E(p['title'])}</h1>
    <p class="lead">{E(p['summary'])}</p>
    <div class="pfacts"><div><b>{total}</b><span>changements</span></div><div><b>{len(p['sections'])}</b><span>sections</span></div>{''.join(f'<div><b class="{TAGS[t][1]}">{n}</b><span>{TAGS[t][0].lower()}</span></div>' for t, n in counts(p).items() if t in TAGS)}</div>
    {share_bar(url, p.get('discord_message'))}
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
    <div class="endshare"><div><div class="kicker">Partager</div><p>Colle le lien dans Discord : la carte de l'annonce s'affiche toute seule.</p></div>{share_bar(url, p.get('discord_message'))}</div>
    {pager}
  </article>
</div>"""
    write(f"patch-notes/{p['slug']}/index.html",
          page(f"patch-notes/{p['slug']}", f"{SITE['name']} · v{p['version']} — {p['title']}", p["summary"], p["image"], body, root, "article", "patch"))

# ---------------------------------------------------------------- patch list
root = "../"
lst = "".join(pcard(p, root) for p in PATCHES)
body = f"""
<section class="shero"><div class="wrap"><div class="kicker"><span class="num">//</span>Journal des mises à jour</div><h1>Notes de patch</h1>
<p class="lead">Tout ce qui change dans {E(SITE['name'])}, mise à jour par mise à jour.</p></div></section>
<div class="wrap"><div class="grid">{lst}</div></div>"""
write("patch-notes/index.html", page("patch-notes", f"{SITE['name']} · Notes de patch", f"Toutes les mises à jour de {SITE['name']}.", SITE["default_image"], body, root, active="patch"))

# ---------------------------------------------------------------- announcements
for n in NEWS:
    root = "../../"
    url = f"{BASE}/annonces/{n['id']}/"
    extra = f'<a class="btn btn-primary" href="{E(n["link"])}" target="_blank" rel="noopener">En savoir plus</a>' if n.get("link") else ""
    paras = "".join(f"<p>{E(t)}</p>" for t in n["text"].split("\n") if t.strip())
    body = f"""
<section class="phero"><div class="bgimg" style="background-image:url('{root}{n.get('image') or SITE['default_image']}')"></div>
  <div class="wrap">
    <a class="crumb" href="{root}annonces/">← Toutes les annonces</a>
    <div class="kicker"><span class="badge">{E(n.get('tag') or 'Annonce')}</span>{fdate(n['date'])}</div>
    <h1>{E(n['title'])}</h1>
  </div>
</section>
<div class="wrap narrow"><article class="post">{paras}{('<div class="share">' + extra + '</div>') if extra else ''}
<div class="endshare"><div><div class="kicker">Partager</div><p>Colle le lien dans Discord : la carte de l'annonce s'affiche toute seule.</p></div>{share_bar(url, n.get('discord_message'))}</div></article></div>"""
    write(f"annonces/{n['id']}/index.html", page(f"annonces/{n['id']}", f"{SITE['name']} · {n['title']}", n["text"][:190], n.get("image") or SITE["default_image"], body, root, "article", "news"))
root = "../"
feat = NEWS[0] if NEWS else None
body = f"""
<section class="shero"><div class="wrap"><div class="kicker"><span class="num">//</span>Quoi de neuf</div><h1>Annonces</h1>
<p class="lead">Les nouvelles de {E(SITE['name'])} : événements, boutique, communauté.</p></div></section>
<div class="wrap"><div class="news">{''.join(ncard(n, root, i == 0) for i, n in enumerate(NEWS))}</div></div>"""
write("annonces/index.html", page("annonces", f"{SITE['name']} · Annonces", f"Les annonces de {SITE['name']}.", SITE["default_image"], body, root, active="news"))

# ---------------------------------------------------------------- roadmap
root = "../"
body = f"""
<section class="shero"><div class="wrap"><div class="kicker"><span class="num">//</span>Ce qui arrive</div><h1>Roadmap</h1>
<p class="lead">{E(ROADMAP['note'])}</p>
<div class="share"><a class="btn btn-discord" href="{E(SITE['discord_invite'])}" target="_blank" rel="noopener">{DISCORD_SVG}Proposer une idée sur Discord</a>
<button class="btn btn-ghost js-copy" data-url="{BASE}/roadmap/">{LINK_SVG}Copier le lien pour Discord</button></div></div></section>
<div class="wrap">{roadmap_board()}</div>"""
write("roadmap/index.html", page("roadmap", f"{SITE['name']} · Roadmap", ROADMAP["note"], SITE["default_image"], body, root, active="road"))

# ---------------------------------------------------------------- status
st = SITE.get("status", {})
body = f"""
<section class="shero"><div class="wrap"><div class="kicker"><span class="num">//</span>En direct</div><h1>État des serveurs</h1>
<p class="lead">Joueurs connectés et serveurs publics de {E(SITE['name'])}, mis à jour automatiquement.</p></div></section>
<div class="wrap">
  <div class="sbanner" data-banner><span class="sdot"></span><div><b data-stat="state">Vérification…</b><span data-stat="state-msg">{E(st.get('message') or '')}</span></div><span class="upd">Mis à jour <b data-stat="age">—</b></span></div>
  {STATS}
  <div class="sect-head"><div><div class="kicker"><span class="num">01</span>Serveurs publics</div><h2>Lobbies en ligne</h2></div></div>
  <div class="servers" data-servers><div class="empty">Chargement…</div></div>
  <p class="fine">Les parties classées et les matchs se jouent sur des serveurs privés créés par le matchmaking : ils comptent dans les joueurs en jeu mais n'apparaissent pas dans la liste des lobbies.</p>
</div>"""
write("status/index.html", page("status", f"{SITE['name']} · État des serveurs", f"Joueurs et serveurs de {SITE['name']} en direct.", SITE["default_image"], body, root, active="status"))

# ---------------------------------------------------------------- home
root = ""
latest = PATCHES[0] if PATCHES else None
hero_img = latest["image"] if latest else SITE["default_image"]
news_html = "".join(ncard(n, root, i == 0) for i, n in enumerate(NEWS[:3]))
body = f"""
<section class="hero"><div class="bgimg kb" style="background-image:url('{hero_img}')"></div><div class="scan" aria-hidden="true"></div>
  <div class="wrap hero-in">
    <div class="hero-txt">
      <div class="kicker"><span class="live"></span>Dernière mise à jour · v{E(latest['version'])}</div>
      <h1 class="glitch" data-text="{E(latest['title'])}">{E(latest['title'])}</h1>
      <p class="lead">{E(latest['summary'])}</p>
      <div class="share">
        <a class="btn btn-primary" href="patch-notes/{latest['slug']}/">Lire les notes de patch</a>
        <a class="btn btn-discord" href="{E(latest.get('discord_message') or SITE['discord_invite'])}" target="_blank" rel="noopener">{DISCORD_SVG}Annonce Discord</a>
        <a class="btn btn-ghost" href="{E(SITE['roblox_url'])}" target="_blank" rel="noopener">{PLAY_SVG}Jouer</a>
      </div>
    </div>
    <a class="hero-status" href="status/">
      <div class="hs-top"><span class="sdot"></span><span data-stat="state">Vérification…</span></div>
      <b data-stat="playing">—</b><span class="hs-l">joueurs en jeu maintenant</span>
      <div class="hs-row"><span><b data-stat="servers">—</b> lobbies</span><span><b data-stat="visits">—</b> visites</span></div>
      <span class="hs-go">État des serveurs →</span>
    </a>
  </div>
</section>
<div class="wrap">
  {STATS}
  {sect('01', 'Quoi de neuf', 'Annonces', ('annonces/', 'Toutes les annonces'), root)}
  <div class="news">{news_html}</div>
  {sect('02', 'Journal', 'Notes de patch', ('patch-notes/', 'Tous les patchs'), root)}
  <div class="grid">{''.join(pcard(p, root) for p in PATCHES[:3])}</div>
  {sect('03', 'Ce qui arrive', 'Roadmap', ('roadmap/', 'Roadmap complète'), root)}
  {roadmap_board(limit=2)}
</div>"""
write("index.html", page("", f"{SITE['name']} · {SITE['tagline']}", latest["summary"], hero_img, body, root, active="home"))

write(".nojekyll", "")
print(f"OK · {len(PATCHES)} patchs · {len(NEWS)} annonces · base {BASE}")
