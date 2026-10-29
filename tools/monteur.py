#!/usr/bin/env python3
"""Chaîne de montage SHAÏAH : rush -> vidéo 9:16 sous-titrée.

Étapes (une commande chacune) :
  prep        rushes/<fichier>  -> my-video/public/work/<nom>.mp4 (9:16, 30 i/s, son normalisé)
  transcribe  <nom>             -> output/<nom>/transcript.json|.txt|.srt (temps de chaque mot)
  autocut     <nom>             -> output/<nom>/edit.json (coupes silences / hésitations / début-fin)
  render      <nom>             -> output/<nom>/<nom>.mp4
  verify      <nom>             -> output/<nom>/verification.txt + planche.png

Le style (couleurs, sous-titres, seuils de coupe, vocabulaire) est décrit dans
style/GUIDE-STYLE.md et style/style.json.
"""

import argparse
import difflib
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUSHES = ROOT / "rushes"
ASSETS = ROOT / "assets"
OUTPUT = ROOT / "output"
REMOTION = ROOT / "my-video"
WORK = REMOTION / "public" / "work"
STYLE = json.loads((ROOT / "style" / "style.json").read_text(encoding="utf-8"))
FPS = 30
CHROMIUM = "/opt/pw-browsers/chromium"


def run(cmd, **kw):
    print("  $", " ".join(str(c) for c in cmd))
    return subprocess.run(cmd, check=True, **kw)


def out_dir(name):
    d = OUTPUT / name
    d.mkdir(parents=True, exist_ok=True)
    return d


def fmt(t):
    m, s = divmod(t, 60)
    return f"{int(m)}:{s:05.2f}"


# --------------------------------------------------------------------- prep
def cmd_prep(args):
    src = Path(args.rush)
    if not src.exists():
        src = RUSHES / args.rush
    name = args.name or src.stem
    WORK.mkdir(parents=True, exist_ok=True)
    dst = WORK / f"{name}.mp4"
    print(f"Préparation de {src.name} -> 1080x1920, 30 i/s, son -14 LUFS")
    run([
        "ffmpeg", "-v", "error", "-y", "-i", str(src),
        "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p",
        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000",
        "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-g", "15",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst),
    ])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(dst), "-ac", "1", "-ar", "16000",
         str(WORK / f"{name}.wav")])
    print(f"OK -> {dst.relative_to(ROOT)}  (nom de la vidéo : {name})")


# --------------------------------------------------------------- transcribe
def load_model():
    from faster_whisper import WhisperModel

    model = os.environ.get("WHISPER_MODEL", STYLE["transcription"]["modele"])
    return WhisperModel(model, device="cpu", compute_type="int8")


def fix_spelling(text):
    for correct, variants in STYLE["vocabulaire"].items():
        for v in variants + [correct]:
            text = re.sub(rf"(?<!\w){re.escape(v)}(?!\w)", correct, text, flags=re.I)
    return text


def transcribe_file(model, path):
    vocab = ", ".join(STYLE["vocabulaire"].keys())
    segments, _ = model.transcribe(
        str(path),
        language="fr",
        word_timestamps=True,
        vad_filter=False,
        beam_size=5,
        # Une invite « verbatim » aide Whisper à garder les euh / bah
        initial_prompt=f"Euh, bah, alors... du coup, voilà. {vocab}.",
    )
    words = []
    for seg in segments:
        for w in seg.words:
            text = fix_spelling(w.word.strip())
            if text:
                words.append({"text": text, "start": round(w.start, 3),
                              "end": round(w.end, 3), "p": round(w.probability, 2)})
    return words


def srt_time(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02}:{int(m):02}:{s:06.3f}".replace(".", ",")


def cmd_transcribe(args):
    d = out_dir(args.name)
    wav = WORK / f"{args.name}.wav"
    print(f"Transcription de {args.name} (modèle {STYLE['transcription']['modele']})…")
    words = transcribe_file(load_model(), wav)
    (d / "transcript.json").write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")

    # Version lisible : une ligne par phrase avec son temps
    lines, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.!?…]$", w["text"]) or len(cur) >= 14:
            lines.append(cur)
            cur = []
    if cur:
        lines.append(cur)
    txt = "\n".join(f"[{fmt(l[0]['start'])} → {fmt(l[-1]['end'])}] " + " ".join(w["text"] for w in l) for l in lines)
    (d / "transcript.txt").write_text(txt + "\n", encoding="utf-8")
    srt = "\n".join(
        f"{i}\n{srt_time(l[0]['start'])} --> {srt_time(l[-1]['end'])}\n" + " ".join(w["text"] for w in l) + "\n"
        for i, l in enumerate(lines, 1))
    (d / "sous-titres.srt").write_text(srt, encoding="utf-8")
    low = [w for w in words if w["p"] < 0.5]
    print(txt)
    if low:
        print("\nMots incertains (à vérifier) : " + ", ".join(f"{w['text']}@{fmt(w['start'])}" for w in low))
    print(f"\nOK -> {(d / 'transcript.txt').relative_to(ROOT)}")


# ------------------------------------------------------------------ autocut
def norm(t):
    return re.sub(r"[^\w']", "", t.lower())


def parse_ranges(s):
    out = []
    for part in filter(None, (s or "").split(",")):
        a, b = part.split("-")
        out.append((float(a), float(b)))
    return out


def cmd_autocut(args):
    d = out_dir(args.name)
    cut = STYLE["coupes"]
    words = json.loads((d / "transcript.json").read_text(encoding="utf-8"))
    fillers = re.compile(cut["hesitations_regex"], re.I)
    excluded = parse_ranges(args.exclude)

    def is_excluded(w):
        return any(a <= w["start"] < b for a, b in excluded)

    keep = []
    for w in words:
        drop = fillers.fullmatch(norm(w["text"])) or is_excluded(w)
        keep.append(not drop)

    # Segments (indices de mots) : on coupe aux silences > seuil et autour des mots supprimés
    groups, start = [], None
    for i, (w, k) in enumerate(zip(words, keep)):
        if not k:
            if start is not None:
                groups.append((start, i - 1))
                start = None
            continue
        if start is None:
            start = i
        elif w["start"] - words[i - 1]["end"] > cut["silence_max"]:
            groups.append((start, i - 1))
            start = i
    if start is not None:
        groups.append((start, len(words) - 1))

    # Marges autour de la voix, sans jamais mordre sur le mot voisin
    merged = []
    for a, b in groups:
        frm = words[a]["start"] - cut["marge_avant"]
        if a > 0:
            frm = max(frm, words[a - 1]["end"])
        to = words[b]["end"] + cut["marge_apres"]
        if b + 1 < len(words):
            to = min(to, words[b + 1]["start"])
        frm = max(0.0, frm)
        if merged and frm - merged[-1]["to"] < 0.04:
            merged[-1]["to"] = round(to, 3)
        else:
            merged.append({"from": round(frm, 3), "to": round(to, 3)})

    # Reprises probables : même début de phrase répété à moins de 20 mots
    toks = [norm(w["text"]) for w in words]
    retakes = []
    for i in range(len(toks) - 3):
        tri = toks[i:i + 3]
        for j in range(i + 3, min(i + 20, len(toks) - 3)):
            if toks[j:j + 3] == tri:
                retakes.append((words[i]["start"], words[j]["start"], " ".join(w["text"] for w in words[i:i + 3])))
                break

    music = None
    music_files = sorted(p for p in (ASSETS / "music").glob("*") if p.suffix.lower() in {".mp3", ".wav", ".m4a", ".aac"})
    if music_files:
        WORK.mkdir(parents=True, exist_ok=True)
        dst = WORK / f"music{music_files[0].suffix.lower()}"
        shutil.copy(music_files[0], dst)
        music = {"src": f"work/{dst.name}", "volume": STYLE["musique"]["volume"]}

    edit_path = d / "edit.json"
    old = json.loads(edit_path.read_text(encoding="utf-8")) if edit_path.exists() else {}
    edit = {
        "video": f"work/{args.name}.mp4",
        "segments": merged,
        "words": words,
        "zooms": old.get("zooms", []),
        "texts": old.get("texts", []),
        "transitions": old.get("transitions", []),
        "music": music,
        "captions": STYLE["sous_titres"],
        "jumpCutScale": STYLE["montage"]["jump_cut_scale"],
    }
    edit_path.write_text(json.dumps(edit, ensure_ascii=False, indent=1), encoding="utf-8")

    src_dur = words[-1]["end"] if words else 0
    out_dur = sum(s["to"] - s["from"] for s in merged)
    print(f"{len(merged)} plans conservés — durée {fmt(src_dur)} -> {fmt(out_dur)}")
    for i, s in enumerate(merged):
        txt = " ".join(w["text"] for w in words if s["from"] <= w["start"] < s["to"])
        print(f"  plan {i + 1:>2} [{fmt(s['from'])} → {fmt(s['to'])}] {txt}")
    removed = [w for w, k in zip(words, keep) if not k]
    if removed:
        print("Mots coupés : " + ", ".join(f"{w['text']}@{fmt(w['start'])}" for w in removed))
    for a, b, t in retakes:
        print(f"Reprise possible : « {t} » à {fmt(a)} puis {fmt(b)}")
    print(f"OK -> {edit_path.relative_to(ROOT)}")


# ------------------------------------------------------------------- render
def cmd_render(args):
    d = out_dir(args.name)
    out = d / f"{args.name}.mp4"
    cmd = ["npx", "remotion", "render", "SocialVideo", str(out),
           f"--props={d / 'edit.json'}", "--crf=18", "--audio-bitrate=192k"]
    if Path(CHROMIUM).exists():
        cmd.append(f"--browser-executable={CHROMIUM}")
    run(cmd, cwd=REMOTION)
    print(f"OK -> {out.relative_to(ROOT)}")


# ------------------------------------------------------------------- verify
def expected_words(edit):
    """Reproduit timeline.ts : temps des mots dans la vidéo finale."""
    placed, cursor = [], 0
    for s in edit["segments"]:
        n = max(1, round((s["to"] - s["from"]) * FPS))
        placed.append((s["from"], s["to"], cursor))
        cursor += n
    out = []
    for w in edit["words"]:
        for a, b, f0 in placed:
            if a <= w["start"] <= b:
                out.append({"text": w["text"], "t": (f0 + round((w["start"] - a) * FPS)) / FPS})
                break
    return out, cursor / FPS


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate",
                        "-of", "json", str(path)], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def cmd_verify(args):
    d = out_dir(args.name)
    video = d / f"{args.name}.mp4"
    edit = json.loads((d / "edit.json").read_text(encoding="utf-8"))
    report, ok = [], True

    def check(cond, label):
        nonlocal ok
        ok &= bool(cond)
        report.append(f"{'✅' if cond else '❌'} {label}")

    info = probe(video)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    dur = float(info["format"]["duration"])
    exp_words, exp_dur = expected_words(edit)
    check(v["codec_name"] == "h264" and (v["width"], v["height"]) == (1080, 1920) and v["r_frame_rate"] == "30/1",
          f"Vidéo H.264 1080x1920 30 i/s ({v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']})")
    check(a is not None and a["codec_name"] == "aac", "Piste audio AAC présente")
    check(abs(dur - exp_dur) < 0.1, f"Durée {dur:.2f} s (attendue {exp_dur:.2f} s)")
    lo, hi = STYLE["format"]["duree_cible"]
    report.append(f"{'✅' if lo <= dur <= hi else '⚠️'} Durée cible {lo}–{hi} s")

    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-f", "null", "-"],
                       capture_output=True, text=True)
    check(r.returncode == 0 and not r.stderr.strip(), "Lecture complète sans erreur de décodage"
          + (f" : {r.stderr.strip()[:200]}" if r.stderr.strip() else ""))

    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(video), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    if m:
        lufs = float(m[-1])
        report.append(f"{'✅' if -17 <= lufs <= -11 else '⚠️'} Volume {lufs:.1f} LUFS (cible -14)")

    # Synchro : on retranscrit la vidéo finie et on compare au placement des sous-titres
    if not args.skip_sync:
        wav = WORK / f"{args.name}-verif.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-ac", "1", "-ar", "16000", str(wav)], check=True)
        heard = transcribe_file(load_model(), wav)
        A = [norm(w["text"]) for w in exp_words]
        B = [norm(w["text"]) for w in heard]
        offsets = []
        for blk in difflib.SequenceMatcher(None, A, B, autojunk=False).get_matching_blocks():
            for k in range(blk.size):
                offsets.append(heard[blk.b + k]["start"] - exp_words[blk.a + k]["t"])
        if offsets:
            med = statistics.median(offsets)
            within = sum(abs(o) <= 0.2 for o in offsets) / len(offsets)
            check(abs(med) <= 0.1 and within >= 0.9,
                  f"Synchro sous-titres/audio : décalage médian {med * 1000:+.0f} ms, "
                  f"{within:.0%} des mots à ±200 ms ({len(offsets)} mots comparés)")
            worst = sorted(zip(offsets, range(len(offsets))), key=lambda x: -abs(x[0]))[:3]
            report.append("   pires écarts : " + ", ".join(f"{o * 1000:+.0f} ms" for o, _ in worst))
        else:
            check(False, "Synchro : aucun mot reconnu dans la vidéo finie")
        missing = len(A) - sum(b.size for b in difflib.SequenceMatcher(None, A, B, autojunk=False).get_matching_blocks())
        report.append(f"   mots des sous-titres non retrouvés à l'écoute : {missing}/{len(A)}")
        wav.unlink(missing_ok=True)

    # Planche : une image par seconde (max 12) pour contrôle visuel
    n = 6 if dur <= 12 else 12
    WORK.mkdir(parents=True, exist_ok=True)
    tiles = []
    for i in range(n):
        t = (i + 0.5) * dur / n
        p = WORK / f"_planche_{i}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
                        "-vf", f"scale=270:-1,drawtext=text='{fmt(t).replace(":", chr(92) + ":")}':x=10:y=10:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6",
                        str(p)], check=True)
        tiles.append(p)
    cols = 6
    inputs = sum((["-i", str(p)] for p in tiles), [])
    layout = "|".join(f"{(i % cols) * 270}_{(i // cols) * 480}" for i in range(len(tiles)))
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex",
                    f"xstack=inputs={len(tiles)}:layout={layout}", str(d / "planche.png")], check=True)
    for p in tiles:
        p.unlink(missing_ok=True)

    report.append(f"{'✅ PRÊT' if ok else '❌ À CORRIGER'} — {video.relative_to(ROOT)}")
    text = "\n".join(report)
    (d / "verification.txt").write_text(text + "\n", encoding="utf-8")
    print(text)
    sys.exit(0 if ok else 1)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("prep"); s.add_argument("rush"); s.add_argument("--name")
    s.set_defaults(fn=cmd_prep)
    s = sub.add_parser("transcribe"); s.add_argument("name"); s.set_defaults(fn=cmd_transcribe)
    s = sub.add_parser("autocut"); s.add_argument("name")
    s.add_argument("--exclude", help="plages du rush à retirer, ex. 12.3-14.8,20-21.5")
    s.set_defaults(fn=cmd_autocut)
    s = sub.add_parser("render"); s.add_argument("name"); s.set_defaults(fn=cmd_render)
    s = sub.add_parser("verify"); s.add_argument("name")
    s.add_argument("--skip-sync", action="store_true", help="sans retranscription de contrôle")
    s.set_defaults(fn=cmd_verify)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
