import { continueRender, delayRender } from "remotion";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/700-italic.css";

// Charte SHAÏAH — voir style/GUIDE-STYLE.md
export const colors = {
  chocolat: "#2C0F0A",
  terracotta: "#8B3020", // couleur signature
  rose: "#DDB8A8",
  blancRose: "#F5E8E0",
  sable: "#E8DCC8",
};

export const fonts = {
  titre: "'Playfair Display', serif",
  sousTitre: "'Montserrat', sans-serif",
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

// Bloque le rendu tant que les polices ne sont pas chargées
const handle = delayRender("Chargement des polices");
Promise.all([
  document.fonts.load(`800 90px Montserrat`),
  document.fonts.load(`700 90px Montserrat`),
  document.fonts.load(`700 90px 'Playfair Display'`),
  document.fonts.load(`italic 700 90px 'Playfair Display'`),
])
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
