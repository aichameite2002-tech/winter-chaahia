import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors } from "../brand";
import { Captions } from "./Captions";
import { TextPop } from "./TextPop";
import {
  chunkWords,
  PlacedSegment,
  placeSegments,
  placeWords,
  sourceToFrame,
} from "./timeline";
import { CutTransition, EditSpec, Zoom } from "./types";

const zoomAt = (t: number, zooms: Zoom[]) => {
  let scale = 1;
  for (const z of zooms) {
    const ramp = Math.min(0.2, z.duration / 3);
    const s = interpolate(
      t,
      [z.at, z.at + ramp, z.at + z.duration - ramp, z.at + z.duration],
      [1, z.scale, z.scale, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    scale = Math.max(scale, s);
  }
  return scale;
};

const SegmentClip: React.FC<{
  seg: PlacedSegment;
  spec: EditSpec;
  cut: CutTransition;
}> = ({ seg, spec, cut }) => {
  const frame = useCurrentFrame(); // relatif au segment
  const { fps } = useVideoConfig();
  const t = seg.from + frame / fps;

  const base = seg.index % 2 === 1 ? spec.jumpCutScale : 1;
  const enter = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 200 },
    durationInFrames: 8,
  });
  const transitionScale =
    cut === "zoom" ? interpolate(enter, [0, 1], [1.3, 1]) : 1;
  const whipX =
    cut === "whip"
      ? interpolate(frame, [0, 6], [12, 0], { extrapolateRight: "clamp" })
      : 0;
  const whipBlur =
    cut === "whip"
      ? interpolate(frame, [0, 6], [24, 0], { extrapolateRight: "clamp" })
      : 0;

  // Le zoom compense le glissement du whip (pas de bord visible)
  const whipScale = 1 + (whipX * 2.5) / 100;
  const scale = base * zoomAt(t, spec.zooms) * transitionScale * whipScale;
  const dur = seg.durationInFrames;

  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${whipX}%) scale(${scale})`,
        filter: whipBlur > 0 ? `blur(${whipBlur}px)` : undefined,
      }}
    >
      {spec.video ? (
        <OffthreadVideo
          src={staticFile(spec.video)}
          trimBefore={Math.round(seg.from * fps)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          // Micro-fondu du son sur chaque cut pour éviter les clics
          volume={(f) =>
            interpolate(f, [0, 1, dur - 1, dur], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : (
        <PreviewBackground />
      )}
    </AbsoluteFill>
  );
};

// Fond utilisé quand aucune vidéo n'est fournie (aperçu de style)
const PreviewBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const angle = 160 + Math.sin(frame / 40) * 15;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${colors.sable} 0%, ${colors.rose} 55%, ${colors.terracotta} 100%)`,
      }}
    />
  );
};

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 5], [0.85, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: colors.blancRose, opacity }} />
  );
};

export const SocialVideo: React.FC<EditSpec> = (spec) => {
  const { fps } = useVideoConfig();
  const { placed } = useMemo(
    () => placeSegments(spec.segments, fps),
    [spec.segments, fps],
  );
  const words = useMemo(
    () => placeWords(spec.words, placed, fps),
    [spec.words, placed, fps],
  );
  const chunks = useMemo(
    () => chunkWords(words, spec.captions.maxWords, fps),
    [words, spec.captions.maxWords, fps],
  );
  const transitionOf = (i: number): CutTransition =>
    spec.transitions.find((t) => t.segment === i)?.type ?? "none";

  // Musique : baisse automatiquement quand la voix parle
  const musicVolume = (f: number) => {
    if (!spec.music) return 0;
    const near = words.some(
      (w) => f >= w.startFrame - 6 && f <= w.endFrame + 6,
    );
    return spec.music.volume * (near ? 0.35 : 1);
  };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.chocolat }}>
      {placed.map((seg) => (
        <Sequence
          key={seg.index}
          from={seg.startFrame}
          durationInFrames={seg.durationInFrames}
          name={`Plan ${seg.index + 1}`}
        >
          <SegmentClip
            seg={seg}
            spec={spec}
            cut={transitionOf(seg.index)}
          />
          {transitionOf(seg.index) === "flash" ? <Flash /> : null}
        </Sequence>
      ))}

      {spec.texts.map((tx, i) => {
        const from = sourceToFrame(tx.at, placed, fps);
        if (from === null) return null;
        const d = Math.round(tx.duration * fps);
        return (
          <Sequence key={i} from={from} durationInFrames={d} name={`Texte ${tx.text}`}>
            <TextPop spec={tx} durationInFrames={d} />
          </Sequence>
        );
      })}

      <Captions chunks={chunks} style={spec.captions} />

      {spec.music ? (
        <Audio src={staticFile(spec.music.src)} loop volume={musicVolume} />
      ) : null}
    </AbsoluteFill>
  );
};
