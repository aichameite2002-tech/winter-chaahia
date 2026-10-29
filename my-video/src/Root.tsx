import { CalculateMetadataFunction, Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "./brand";
import { SocialVideo } from "./SocialVideo/SocialVideo";
import { placeSegments } from "./SocialVideo/timeline";
import { defaultCaptions, EditSpec, Word } from "./SocialVideo/types";

const calculateMetadata: CalculateMetadataFunction<EditSpec> = ({ props }) => ({
  durationInFrames: placeSegments(props.segments, FPS).totalFrames,
});

// Aperçu de style sans rush : mots à rythme fixe (pas une vraie transcription)
const demoText =
  "Bienvenue chez SHAÏAH ! Voici le style de tes vidéos : sous-titres mot par mot, zooms, textes animés et cuts rythmés.";
const demoWords: Word[] = demoText.split(" ").map((text, i) => ({
  text,
  start: 0.3 + i * 0.32,
  end: 0.3 + i * 0.32 + 0.28,
}));
const demoEnd = demoWords[demoWords.length - 1].end + 0.6;

const demo: EditSpec = {
  video: null,
  segments: [
    { from: 0, to: 1.6 },
    { from: 1.6, to: 3.2 },
    { from: 3.2, to: 4.8 },
    { from: 4.8, to: demoEnd },
  ],
  words: demoWords,
  zooms: [{ at: 0.3, duration: 1.0, scale: 1.15 }],
  texts: [
    { at: 0.4, duration: 1.4, text: "SHAÏAH", style: "titre" },
    { at: 3.4, duration: 1.3, text: "mot par mot ✨", style: "motCle", y: 24 },
  ],
  transitions: [
    { segment: 1, type: "flash" },
    { segment: 2, type: "zoom" },
    { segment: 3, type: "whip" },
  ],
  music: null,
  captions: defaultCaptions,
  jumpCutScale: 1.08,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SocialVideo"
        component={SocialVideo}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={demo}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="ApercuStyle"
        component={SocialVideo}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={demo}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
