import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, fonts } from "../brand";
import { Chunk } from "./timeline";
import { CaptionStyle } from "./types";

export const Captions: React.FC<{ chunks: Chunk[]; style: CaptionStyle }> = ({
  chunks,
  style,
}) => {
  const frame = useCurrentFrame();
  const chunk = chunks.find(
    (c) => frame >= c.startFrame && frame < c.endFrame,
  );
  if (!chunk) return null;
  return <CaptionChunk chunk={chunk} style={style} />;
};

const CaptionChunk: React.FC<{ chunk: Chunk; style: CaptionStyle }> = ({
  chunk,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrée du groupe : petit rebond
  const enter = spring({
    frame: frame - chunk.startFrame,
    fps,
    config: { damping: 14, stiffness: 220 },
    durationInFrames: 8,
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: `${style.y}%`,
          left: 60,
          right: 60,
          transform: `translateY(-50%) scale(${interpolate(enter, [0, 1], [0.85, 1])})`,
          opacity: interpolate(enter, [0, 1], [0.6, 1]),
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.1em 0.18em",
          fontFamily: fonts.sousTitre,
          fontWeight: 800,
          fontSize: style.fontSize,
          lineHeight: 1.15,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {chunk.words.map((w, i) => {
          // Le mot reste surligné jusqu'au début du mot suivant
          const next = chunk.words[i + 1];
          const on =
            frame >= w.startFrame && (!next || frame < next.startFrame);
          const pop = spring({
            frame: frame - w.startFrame,
            fps,
            config: { damping: 12, stiffness: 300 },
            durationInFrames: 6,
          });
          return (
            <span
              key={`${w.start}-${i}`}
              style={{
                position: "relative",
                padding: "0.04em 0.16em",
                borderRadius: "0.18em",
                backgroundColor: on ? colors.terracotta : "transparent",
                color: colors.blancRose,
                transform: on
                  ? `scale(${interpolate(pop, [0, 1], [0.92, 1.06])})`
                  : "scale(1)",
                WebkitTextStroke: on ? "0px" : `10px ${colors.chocolat}`,
                paintOrder: "stroke fill",
                boxShadow: on ? `0 8px 0 ${colors.chocolat}` : "none",
                textShadow: on ? "none" : `0 6px 0 ${colors.chocolat}`,
              }}
            >
              {w.text.replace(/[.,;:…]+$/, "")}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
