import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, fonts } from "../brand";
import { TextPop as TextPopSpec } from "./types";

// Texte qui apparaît (à placer dans une <Sequence>)
export const TextPop: React.FC<{ spec: TextPopSpec; durationInFrames: number }> = ({
  spec,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 180 } });
  const exit = interpolate(
    frame,
    [durationInFrames - 6, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const titre = spec.style === "titre";
  const size = spec.size ?? (titre ? 96 : 110);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: `${spec.y ?? 20}%`,
          left: 70,
          right: 70,
          display: "flex",
          justifyContent: "center",
          transform: `translateY(-50%) translateY(${interpolate(enter, [0, 1], [60, 0])}px) rotate(${titre ? 0 : -3}deg) scale(${interpolate(enter, [0, 1], [0.6, 1])})`,
          opacity: Math.min(enter, exit),
        }}
      >
        <div
          style={{
            fontFamily: fonts.titre,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1.1,
            textAlign: "center",
            padding: titre ? "0.25em 0.5em" : "0.12em 0.4em",
            borderRadius: titre ? 28 : 18,
            color: titre ? colors.blancRose : colors.chocolat,
            backgroundColor: titre ? colors.terracotta : colors.rose,
            boxShadow: `0 12px 0 ${colors.chocolat}`,
          }}
        >
          {spec.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
