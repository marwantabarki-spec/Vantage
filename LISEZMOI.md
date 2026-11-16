# Site VANTAGE — annonces, notes de patch, roadmap, serveurs en direct, admin

## Mise en place (une seule fois)
1. Envoie tout le contenu de ce dossier dans le dépôt GitHub **Vantage** (Add file → Upload files),
   y compris le dossier caché `.github` (sur Mac : Cmd + Maj + . pour afficher les fichiers cachés).
2. Dépôt → **Settings → Pages → Source : GitHub Actions** (au lieu de « Deploy from a branch »).
3. Onglet **Actions** : le workflow « Site VANTAGE » se lance. Coche verte = site en ligne :
   https://marwantabarki-spec.github.io/Vantage/

Ensuite, le site se met à jour tout seul :
- à chaque modification faite depuis l'admin (~1 min) ;
- toutes les ~10 min pour le nombre de joueurs et les serveurs (GitHub peut parfois prendre un peu plus).

## Admin : https://marwantabarki-spec.github.io/Vantage/admin/
Onglet **Connexion** :
- **Jeton GitHub** (obligatoire) : GitHub → Settings → Developer settings → Personal access tokens →
  Fine-grained tokens → Generate new token → Only select repositories : Vantage →
  Repository permissions → Contents : Read and write.
- **Webhook Discord** (facultatif) : paramètres du salon d'annonces → Intégrations → Webhooks → Nouveau → Copier l'URL.
  Bouton « Publier sur Discord » sur chaque annonce / patch.
- **Clé OpenAI** (facultatif) : platform.openai.com → API keys. L'abonnement ChatGPT ne suffit pas :
  il faut du crédit API (Billing). Sert au bouton « Générer avec l'IA » des images.

Les clés restent dans ton navigateur uniquement. Ne les partage jamais et ne les mets pas dans les fichiers du site.

## Ce que tu peux faire dans l'admin
- **Annonces** : créer, modifier, épingler, supprimer, choisir une image, publier sur Discord.
- **Patchs** : créer une note de patch (sections + lignes Nouveau / Amélioration / Correction…), publier sur Discord.
- **Roadmap** : ajouter, modifier, déplacer entre colonnes, réordonner.
- **Statut & site** : mode Maintenance / Perturbations avec message (bandeau en haut du site), textes du bandeau défilant, liens.
- **Images** : bibliothèque, import de tes propres images, ou génération par IA.
