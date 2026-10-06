// Excalidraw renders text on <canvas> using its OWN font families (Excalifont,
// Nunito, …) — page CSS doesn't reach it. Those fonts lack Lao glyphs, so Lao
// text falls back to whatever the OS provides (often nothing on Windows/Android).
//
// Every Excalidraw font stack ends in "Segoe UI Emoji" (e.g. `Nunito, Segoe UI Emoji`),
// so we attach Noto Sans Lao to THAT fallback family with a Lao-only unicode-range.
// We must not redefine the primary families: an @font-face named "Helvetica" or
// "Nunito" shadows the real font, and Latin text then renders in the default serif.
//
// Faces in one family are tried last-declared first, filtered by unicode-range:
// Lao codepoints hit Noto Sans Lao; emoji fall through to the system emoji font.
const FALLBACK_FAMILY = "Segoe UI Emoji";
const LAO_RANGE = "U+0E80-0EFF, U+200B, U+25CC";
// Noto Sans Lao sits optically small next to Excalidraw's Latin fonts; nudge it up
const LAO_SIZE_ADJUST = "112%";

export function injectLaoCanvasFont() {
  if (typeof document === "undefined" || document.getElementById("xld-lao-font")) return;
  const lao = (file: string, weight: number) =>
    `@font-face{font-family:"${FALLBACK_FAMILY}";src:url("/fonts/${file}") format("truetype");unicode-range:${LAO_RANGE};font-weight:${weight};size-adjust:${LAO_SIZE_ADJUST};font-display:swap;}`;
  const css = [
    `@font-face{font-family:"${FALLBACK_FAMILY}";src:local("Segoe UI Emoji"),local("Apple Color Emoji"),local("Noto Color Emoji");}`,
    lao("NotoSansLao-Regular.ttf", 400),
    lao("NotoSansLao-Bold.ttf", 700),
  ].join("\n");
  const s = document.createElement("style");
  s.id = "xld-lao-font";
  s.textContent = css;
  document.head.appendChild(s);
  // Force-load so Excalidraw's font-load listener re-renders existing Lao text.
  document.fonts?.load?.(`16px "${FALLBACK_FAMILY}"`, "ກ").catch(() => {});
}
