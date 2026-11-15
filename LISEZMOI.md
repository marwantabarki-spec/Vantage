# Site VANTAGE — notes de patch & roadmap

## 1. Mettre en ligne (GitHub Pages, gratuit)
1. Crée un dépôt public sur GitHub, par exemple `vantage` (exactement ce nom).
2. Envoie tout le contenu de ce dossier dans le dépôt (bouton **Add file → Upload files**).
3. Dans le dépôt : **Settings → Pages → Source : Deploy from a branch → main / (root)**.
4. Ton site sera à l'adresse `https://marwantabarki-spec.github.io/vantage/`.

## 2. Régler tes liens (`data/site.json`)
- `base_url` : l'adresse exacte du site (étape 1.4). **Obligatoire** pour que Discord affiche l'aperçu.
- `discord_invite` : ton lien d'invitation Discord.
- `roblox_url` : la page Roblox du jeu.

Puis relance la génération (voir 4) et renvoie les fichiers sur GitHub.

## 3. Discord
- **Aperçu** : colle le lien d'une note de patch (bouton « Copier le lien pour Discord ») dans un salon.
  Discord affiche une carte avec le titre, le résumé, l'image et la couleur orange.
- **Bouton vers l'annonce** : publie l'annonce dans ton salon Discord, fais clic droit sur le message →
  **Copier le lien du message**, et colle-le dans `discord_message` du patch (`data/patches.json`).
  Le bouton devient « Voir l'annonce sur Discord ». Vide = il ouvre ton serveur.

## 4. Ajouter un patch
1. Dans `data/patches.json`, copie un bloc et change `slug` (sans espaces ni accents), `version`, `title`,
   `date` (AAAA-MM-JJ), `summary`, `image`, `highlights` et les `sections`.
   Tags possibles : `new`, `update`, `fix`, `perf`, `balance`.
2. Ouvre le Terminal dans ce dossier et lance : `python3 build.py`
3. Envoie les fichiers modifiés sur GitHub.

La roadmap se modifie dans `data/roadmap.json` de la même façon.
