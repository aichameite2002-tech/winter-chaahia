# Guide de style vidéo SHAÏAH

Ce guide sert de référence pour monter chaque Reel ou TikTok SHAÏAH dans le même style.
Les réglages techniques correspondants se trouvent dans `style/style.json`, que `tools/monteur.py` lit à chaque étape.
Quand un retour est validé, il faut mettre à jour **les deux** fichiers.

## 1. Format

| | |
|---|---|
| Ratio | **9:16 vertical**, 1080×1920 |
| Cadence | 30 images/s |
| Durée cible | **15 à 30 s** |
| Export | MP4 H.264, CRF 18, son AAC 192 kb/s, normalisé à **-14 LUFS** |

## 2. Univers de marque

| Rôle | Couleur | Code |
|---|---|---|
| Fond sombre, contours | Chocolat noir | `#2C0F0A` |
| **Couleur signature** : pastille du mot prononcé, titres | Terracotta bordeaux | `#8B3020` |
| Mots-clés, accents | Rose poudré | `#DDB8A8` |
| Texte des sous-titres | Blanc rosé | `#F5E8E0` |
| Fonds clairs | Sable | `#E8DCC8` |

- **Titres et textes animés :** Playfair Display 700 *italique* (élégante).
- **Sous-titres :** Montserrat 800, en MAJUSCULES.
- **Logo :** aucun, la marque s'écrit en texte.
- **Ton :** énergique et fun. Cuts serrés, zooms fréquents, textes qui « poppent », emojis bienvenus avec modération.

## 3. Sous-titres animés (mot par mot)

- **Position :** centre-bas, à **65 %** de la hauteur. Ils passent sous le visage et au-dessus de l'interface TikTok et Reels.
- **Taille :** **90 px**, **1 à 3 mots** affichés à la fois (14 caractères au maximum par groupe).
- **Mots inactifs :** Blanc rosé avec un contour et une ombre Chocolat.
- **Mot prononcé :** Blanc rosé sur **pastille Terracotta** avec une ombre Chocolat et un léger « pop » (zoom de 1,06). Le surlignage reste sur le mot jusqu'au début du mot suivant.
- **Ponctuation :** les virgules et les points sont masqués, les « ! » et « ? » sont gardés.
- **Orthographe :** voir § 7.

## 4. Coupes

| À couper | Réglage |
|---|---|
| Silences | supérieurs à **0,3 s** |
| Hésitations | euh, heu, hum, mmh, bah, ben, bref (isolés) |
| Ratés et reprises | seule la dernière prise est gardée (repérage automatique, puis validation dans le plan) |
| Début et fin | coupés au premier et au dernier mot |
| Marges autour de la voix | 0,08 s avant et 0,15 s après, sans jamais déborder sur un mot coupé |

Un **micro-fondu du son** (1 image) est appliqué à chaque cut pour éviter les clics.

## 5. Effets

- **Jump cut :** un plan sur deux est légèrement recadré (×1,08), ce qui donne de l'énergie sans transition.
- **Zooms « punch-in » :** de ×1,15 à ×1,25 sur les mots forts, avec une rampe de 0,2 s. Compter environ 1 zoom toutes les 4 à 6 s.
- **Textes animés :**
  - `titre` : Playfair italique Blanc rosé sur bloc Terracotta, en haut (20 %). Pour l'accroche des 2 premières secondes.
  - `motCle` : Playfair italique Chocolat sur bloc Rose poudré, incliné de -3°. Pour les mots-clés et les chiffres.
- **Transitions sur les cuts** (sans chevauchement, le son reste intact) :
  - `flash` : éclair Blanc rosé, pour un changement d'idée ;
  - `zoom` : le plan entre zoomé et se pose ;
  - `whip` : glissé flou, pour une énumération ou une liste.
  - Compter 2 à 4 transitions par vidéo, pas plus.
- **Accroche :** un texte `titre` est toujours présent dans les 2 premières secondes.

## 6. Musique

- Si un fichier est présent dans `assets/music/`, il est mixé sous la voix au volume 0,25, et baissé à 35 % de ce volume pendant que la voix parle (ducking).
- Sinon, l'export se fait sans musique et le son tendance s'ajoute dans l'application.

## 7. Vocabulaire (orthographe imposée)

| Correct | Variantes corrigées automatiquement |
|---|---|
| **SHAÏAH** | shaïah, shaiah, shaïa, shaia, shaya, chaïa, chaya, chaïah, chaiah |

Pour ajouter un mot, compléter `vocabulaire` dans `style/style.json`.

## 8. Méthode pour chaque vidéo

```bash
python3 tools/monteur.py prep rushes/ma-video.mov     # 9:16, 30 i/s, son normalisé
python3 tools/monteur.py transcribe ma-video          # temps de chaque mot -> output/ma-video/
python3 tools/monteur.py autocut ma-video             # coupes auto + reprises repérées
#   -> plan de montage écrit (output/ma-video/plan-de-montage.md), À VALIDER
#   -> zooms, textes et transitions ajoutés dans output/ma-video/edit.json
#   -> reprises retirées avec : autocut ma-video --exclude 12.3-14.8
python3 tools/monteur.py render ma-video              # MP4 final
python3 tools/monteur.py verify ma-video              # durée, lecture complète, volume, synchro, planche
```

`verify` retranscrit la vidéo finie et compare le placement de chaque sous-titre à ce qu'on entend vraiment.
Il faut un décalage médian de 100 ms au plus et au moins 90 % des mots à ±200 ms.
Il produit aussi `planche.png`, des captures à intervalles réguliers pour le contrôle visuel.

## 9. Historique des retours

Chaque retour validé (ex. « à 0:05 le texte est trop petit ») est noté ici avec la règle qui en découle.

| Date | Vidéo | Retour | Règle retenue |
|---|---|---|---|
| — | — | — | — |
