// Fichier de montage (output/<nom>/edit.json). Tous les temps sont en
// secondes du RUSH d'origine : si on change une coupe, les effets restent
// accrochés aux bons mots.

export type Word = { text: string; start: number; end: number };

export type Segment = { from: number; to: number };

// Effet au début d'un segment (sur le cut)
export type CutTransition = "none" | "flash" | "zoom" | "whip";

export type Zoom = {
  at: number; // début (s, rush)
  duration: number; // s
  scale: number; // ex. 1.25
};

export type TextPop = {
  at: number;
  duration: number;
  text: string;
  style: "titre" | "motCle";
  y?: number; // position verticale en % de la hauteur (défaut 20)
  size?: number; // px (défaut 96 titre / 110 motCle)
};

export type CaptionStyle = {
  y: number; // % de la hauteur (centre du bloc)
  fontSize: number;
  maxWords: number;
};

export type EditSpec = {
  video: string | null; // chemin dans public/, ex. "work/test.mp4"
  segments: Segment[];
  words: Word[];
  zooms: Zoom[];
  texts: TextPop[];
  transitions: { segment: number; type: CutTransition }[];
  music: { src: string; volume: number } | null;
  captions: CaptionStyle;
  // Alterne un léger recadrage à chaque cut (effet « jump cut »)
  jumpCutScale: number;
};

export const defaultCaptions: CaptionStyle = {
  y: 65,
  fontSize: 90,
  maxWords: 3,
};
