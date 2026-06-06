/**
 * Slide brand palette (applies to the slide preview + PPTX/PDF export only,
 * not the app chrome). Provided by the user.
 */
export const SLIDE_THEME = {
  blue: "#264bf1", // Vivid Blue — primary accent
  blueDark: "#0a1e8f", // darker shade for cover/title backgrounds
  red: "#ff3131", // complementary accent (use sparingly)
  text: "#00032a", // base text
  textMuted: "#5b6072",
  bg: "#ffffff",
  bgSoft: "#f3f5ff", // very light blue tint for panels/cards
  border: "#dfe3f5",
} as const;

/** PPT/PDF hex without the leading # (pptxgenjs wants bare hex). */
export const bare = (hex: string) => hex.replace("#", "");

/** 16:9 geometry used consistently across HTML / PPTX / PDF. */
export const SLIDE = {
  // PDF points (and HTML uses the same aspect ratio)
  widthPt: 960,
  heightPt: 540,
  // PPTX inches (10 x 5.625 = 16:9)
  widthIn: 10,
  heightIn: 5.625,
} as const;
