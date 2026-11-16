#!/usr/bin/env python3
"""Fetches the live state of the game from the public Roblox APIs and writes status.json.
Runs inside GitHub Actions (every ~10 minutes); the site reads status.json, and also tries a live refresh
from the browser. Never fails the build: on any error it writes what it has, with ok=false."""
import json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
site = json.load(open(os.path.join(ROOT, "data", "site.json"), encoding="utf-8"))
PLACE, UNIVERSE = site["place_id"], site["universe_id"]

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "VantageStatus/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))

out = {"ok": False, "fetched_at": int(time.time()), "playing": None, "visits": None, "favorites": None,
       "max_players": None, "updated": None, "up_votes": None, "down_votes": None, "servers": []}
try:
    g = get(f"https://games.roblox.com/v1/games?universeIds={UNIVERSE}")["data"][0]
    out.update(playing=g.get("playing"), visits=g.get("visits"), favorites=g.get("favoritedCount"),
               max_players=g.get("maxPlayers"), updated=g.get("updated"), name=g.get("name"))
    out["ok"] = True
except Exception as e:
    print("games:", e, file=sys.stderr)
try:
    v = get(f"https://games.roblox.com/v1/games/votes?universeIds={UNIVERSE}")["data"][0]
    out.update(up_votes=v.get("upVotes"), down_votes=v.get("downVotes"))
except Exception as e:
    print("votes:", e, file=sys.stderr)
try:
    cursor, servers = "", []
    for _ in range(5):
        d = get(f"https://games.roblox.com/v1/games/{PLACE}/servers/Public?limit=100&sortOrder=Desc" + (f"&cursor={cursor}" if cursor else ""))
        for s in d.get("data", []):
            servers.append({"playing": s.get("playing", 0), "max": s.get("maxPlayers", 0),
                            "fps": round(s.get("fps") or 0), "ping": s.get("ping")})
        cursor = d.get("nextPageCursor")
        if not cursor:
            break
    out["servers"] = servers
except Exception as e:
    print("servers:", e, file=sys.stderr)

with open(os.path.join(ROOT, "status.json"), "w", encoding="utf-8") as f:
    json.dump(out, f)
print("status:", "ok" if out["ok"] else "partial", out.get("playing"), "players,", len(out["servers"]), "servers")
