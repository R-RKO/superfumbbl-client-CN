/**
 * UAT 10-14: the Eye Gouge chest marker (skin finger, pink eye, orange lines, no outline) vanished against red kits.
 * It now sits on a contrast plate whose colour is chosen against the player's kit colour. Pure helpers, no Pixi.
 */

/** Marker height multiplier over the pre-10-14 drawn size (14 units tall). */
export const EYE_GOUGE_SIZE_BOOST = 1.4;

export interface EyeGougeRing {
  /** 0xRRGGBB plate behind the art. */
  fill: number;
  /** 0xRRGGBB crisp outline of the plate (the opposite pole, so the plate edge reads on any kit). */
  edge: number;
}

const LIGHT = 0xf4f1e8;
const DARK = 0x14161a;

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a 0xRRGGBB colour. */
export function relativeLuminance(rgb: number): number {
  return 0.2126 * channel((rgb >> 16) & 0xff) + 0.7152 * channel((rgb >> 8) & 0xff) + 0.0722 * channel(rgb & 0xff);
}

/** WCAG contrast ratio (1..21) between two colours. */
export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The plate colour for a kit colour: whichever neutral pole (light bone / near-black) contrasts more. Both poles are
 *  neutral, so the plate is never in the red family (or any kit hue); the edge takes the other pole. */
export function eyeGougeRingColor(kit: number): EyeGougeRing {
  return contrastRatio(LIGHT, kit) >= contrastRatio(DARK, kit)
    ? { fill: LIGHT, edge: DARK }
    : { fill: DARK, edge: LIGHT };
}

/** Average kit colour (0xRRGGBB) of the opaque pixels in rows [yFrom, yTo] of a px x px RGBA frame, skipping the
 *  near-black outline pixels. Null when nothing qualifies. Used once per walk sheet at load (the S idle frame's torso
 *  band) so the ring can be chosen against the team's real kit. */
export function kitColorFromPixels(pixels: ArrayLike<number>, px: number, yFrom: number, yTo: number): number | null {
  let r = 0, g = 0, b = 0, n = 0;
  const y0 = Math.max(0, Math.floor(yFrom));
  const y1 = Math.min(px - 1, Math.ceil(yTo));
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < px; x++) {
      const i = (y * px + x) * 4;
      if (pixels[i + 3]! < 200) continue;
      if (Math.max(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!) < 45) continue;
      r += pixels[i]!; g += pixels[i + 1]!; b += pixels[i + 2]!; n++;
    }
  }
  if (n === 0) return null;
  return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
}

export interface EyeGougeFit {
  /** Plate size in token-local units at multiplier 1 (stroke included). */
  plateW: number;
  plateH: number;
  /** Room the plate must stay inside: full width and the half-height above / below the marker centre. */
  maxW: number;
  maxHalfH: number;
}

/** Size multiplier: the full boost, eased down for small figures (figureRatio < 1, e.g. snotlings), then clamped so the
 *  plate fits `fit` in BOTH width and height (omit for no cap). Never above the boost; the 0.05 floor only keeps it non-zero, so containment always wins. */
export function eyeGougeSizeBoost(figureRatio = 1, fit?: EyeGougeFit): number {
  const eased = Math.min(EYE_GOUGE_SIZE_BOOST, Math.max(1, EYE_GOUGE_SIZE_BOOST * Math.min(1, Math.max(0, figureRatio) * 1.25)));
  if (!fit || !(fit.plateW > 0) || !(fit.plateH > 0)) return eased;
  const byW = Number.isFinite(fit.maxW) ? fit.maxW / fit.plateW : Infinity;
  const byH = Number.isFinite(fit.maxHalfH) ? (2 * fit.maxHalfH) / fit.plateH : Infinity;
  return Math.max(0.05, Math.min(eased, byW, byH));
}
