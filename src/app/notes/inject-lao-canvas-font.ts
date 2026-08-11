// Excalidraw renders text on <canvas> using its OWN font families (Excalifont,
// Nunito, …) — page CSS doesn't reach it. Those fonts lack Lao glyphs, so Lao
// text falls back to whatever the OS provides. We graft Noto Sans Lao onto each
// Excalidraw family via a Lao-only unicode-range: the browser then uses Noto
// Sans Lao for Lao codepoints while Latin keeps the Excalidraw font.
const FAMILIES = [
  "Excalifont", "Nunito", "Assistant", "Comic Shanns Mono", "Cascadia",
  "Xiaolai", "Lilita One", "Virgil", "Helvetica",
];
const LAO_RANGE = "U+0E80-0EFF, U+200B, U+25CC";

export function injectLaoCanvasFont() {
  if (typeof document === "undefined" || document.getElementById("xld-lao-font")) return;
  const css = FAMILIES.map(f => `
@font-face{font-family:"${f}";src:url("/fonts/NotoSansLao-Regular.ttf") format("truetype");unicode-range:${LAO_RANGE};font-weight:400;font-display:swap;}
@font-face{font-family:"${f}";src:url("/fonts/NotoSansLao-Bold.ttf") format("truetype");unicode-range:${LAO_RANGE};font-weight:700;font-display:swap;}`).join("");
  const s = document.createElement("style");
  s.id = "xld-lao-font";
  s.textContent = css;
  document.head.appendChild(s);
  // Force-load so Excalidraw's font-load listener re-renders existing Lao text.
  if (document.fonts?.load) FAMILIES.forEach(f => { document.fonts.load(`16px "${f}"`, "ກ").catch(() => {}); });
}
