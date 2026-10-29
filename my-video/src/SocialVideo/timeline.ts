import { Segment, Word } from "./types";

export type PlacedSegment = Segment & {
  index: number;
  startFrame: number; // dans la vidéo finale
  durationInFrames: number;
};

export const placeSegments = (segments: Segment[], fps: number) => {
  const placed: PlacedSegment[] = [];
  let cursor = 0;
  segments.forEach((s, index) => {
    const durationInFrames = Math.max(1, Math.round((s.to - s.from) * fps));
    placed.push({ ...s, index, startFrame: cursor, durationInFrames });
    cursor += durationInFrames;
  });
  return { placed, totalFrames: Math.max(1, cursor) };
};

// Temps du rush (s) -> frame de la vidéo finale, ou null si la zone est coupée
export const sourceToFrame = (
  t: number,
  placed: PlacedSegment[],
  fps: number,
): number | null => {
  for (const s of placed) {
    if (t >= s.from && t <= s.to) {
      return s.startFrame + Math.round((t - s.from) * fps);
    }
  }
  return null;
};

export type PlacedWord = Word & { startFrame: number; endFrame: number };

// Garde les mots dont le début est dans une zone conservée
export const placeWords = (
  words: Word[],
  placed: PlacedSegment[],
  fps: number,
): PlacedWord[] => {
  const out: PlacedWord[] = [];
  for (const w of words) {
    // Ponctuation isolée (« ! », « : ») : rattachée au mot précédent
    if (/^[^\p{L}\p{N}]+$/u.test(w.text.trim())) {
      if (out.length) out[out.length - 1].text += w.text.trim();
      continue;
    }
    const startFrame = sourceToFrame(w.start, placed, fps);
    if (startFrame === null) continue;
    const seg = placed.find((s) => w.start >= s.from && w.start <= s.to)!;
    const end = Math.min(w.end, seg.to);
    const endFrame = Math.max(
      startFrame + 1,
      seg.startFrame + Math.round((end - seg.from) * fps),
    );
    out.push({ ...w, startFrame, endFrame });
  }
  return out;
};

export type Chunk = { words: PlacedWord[]; startFrame: number; endFrame: number };

// Regroupe les mots par 1 à maxWords (coupure sur ponctuation, pause ou longueur)
export const chunkWords = (
  words: PlacedWord[],
  maxWords: number,
  fps: number,
): Chunk[] => {
  const chunks: PlacedWord[][] = [];
  let current: PlacedWord[] = [];
  const maxChars = 14;
  words.forEach((w, i) => {
    current.push(w);
    const next = words[i + 1];
    const chars = current.map((c) => c.text).join(" ").length;
    const punct = /[.,!?;:…]$/.test(w.text);
    const gap = next ? next.startFrame - w.endFrame > 0.25 * fps : true;
    const nextTooLong = next ? chars + 1 + next.text.length > maxChars : true;
    if (current.length >= maxWords || punct || gap || nextTooLong) {
      chunks.push(current);
      current = [];
    }
  });
  if (current.length) chunks.push(current);

  return chunks.map((c, i) => {
    const next = chunks[i + 1];
    const last = c[c.length - 1];
    // Reste affiché jusqu'au groupe suivant, sans dépasser 0,4 s de blanc
    const hold = last.endFrame + Math.round(0.4 * fps);
    const endFrame = next ? Math.min(next[0].startFrame, hold) : hold;
    return { words: c, startFrame: c[0].startFrame, endFrame };
  });
};
