# winter-chaahia

Atelier de montage vidéo SHAÏAH pour Reels et TikTok : vidéos 9:16, sous-titres animés mot par mot, zooms, textes et transitions.

| Dossier | Contenu |
|---|---|
| `rushes/` | Vidéos brutes à monter |
| `assets/fonts`, `assets/music` | Polices et musiques fournies |
| `output/<nom>/` | Vidéo finie, transcription (`transcript.txt`, `.json`, `.srt`), plan de montage, vérification |
| `style/` | **Guide de style** (`GUIDE-STYLE.md`) et réglages (`style.json`) |
| `tools/monteur.py` | Chaîne de montage : prep → transcribe → autocut → render → verify |
| `my-video/` | Projet Remotion (animations et rendu) |

Outils : ffmpeg, faster-whisper (modèle `small`), Remotion 4. Voir `style/GUIDE-STYLE.md` § 8 pour la méthode.

Un fichier de plus de 100 Mo ne peut pas être poussé sur GitHub. Pour les longs rushes, il faut les compresser ou les découper avant de les ajouter.
