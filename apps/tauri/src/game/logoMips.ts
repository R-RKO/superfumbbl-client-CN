// Owner 10-12: the in-game "SUPER FUMBBL / FANTASY FOOTBALL" plate (quick bar, SpectateView) showed the 725 px
// wordmark at ~60-200 device px, a 4-12x minification that WebView2 samples without a usable mip level, so the
// thin "FANTASY FOOTBALL" strokes broke up. scripts/gen-logo.py renders a 4x master straight from the font and
// area-averages it into a sqrt(2) mip chain; the plate binds the smallest level at least as wide as the drawn
// image, so the browser never minifies by more than sqrt(2) (bilinear stays alias-free there).
import { onBeforeUnmount, onMounted, ref, watch, type Ref, type WatchSource } from 'vue';

export type LogoMipLevel = { width: number; url: string };

const MIP_URLS = import.meta.glob('../assets/resources/super-fumbbl-logo-mips/super-fumbbl-logo-*.png', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

/** Parse `{path: url}` into levels sorted narrowest first (the width is in the file name). */
export function logoMipLevels(urls: Record<string, string> = MIP_URLS): LogoMipLevel[] {
  const levels: LogoMipLevel[] = [];
  for (const [path, url] of Object.entries(urls)) {
    const m = /-(\d+)\.png$/.exec(path);
    if (m) levels.push({ width: Number(m[1]), url });
  }
  return levels.sort((a, b) => a.width - b.width);
}

export const SUPER_FUMBBL_LOGO_MIPS: readonly LogoMipLevel[] = logoMipLevels();
/** The 725 px level matches the original asset's width (725 x 247 box-averaged vs the 725 x 248 PNG); it is the
 *  pre-measure default. */
export const SUPER_FUMBBL_LOGO_DEFAULT_WIDTH = 725;
/** Wordmark aspect (4x master 2895 x 986) until the bound level has loaded. */
const LOGO_ASPECT = 2895 / 986;

/** Smallest level at least `neededPx` wide (the widest when none is); null for an empty chain. */
export function pickMipLevel(levels: readonly LogoMipLevel[], neededPx: number): LogoMipLevel | null {
  if (!levels.length) return null;
  const need = Number.isFinite(neededPx) && neededPx > 0 ? neededPx : 0;
  return levels.find((l) => l.width >= need) ?? levels[levels.length - 1]!;
}

export type DrawnBoxInput = {
  /** Rendered (post-transform) border-box width, from getBoundingClientRect. */
  rectWidth: number;
  /** Layout (pre-transform) border-box size, fractional CSS px (computed style, never the integer offsetWidth). */
  layoutWidth: number;
  layoutHeight: number;
  /** Padding + border on each axis, CSS px (layout space). */
  insetX: number;
  insetY: number;
  /** Image intrinsic aspect, width / height. */
  aspect: number;
  devicePixelRatio: number;
};

/** Device-pixel width of an `object-fit: contain` image inside its content box, transforms included. */
export function drawnDeviceWidth(i: DrawnBoxInput): number {
  if (!(i.layoutWidth > 0) || !(i.aspect > 0)) return 0;
  const contentW = Math.max(0, i.layoutWidth - i.insetX);
  const contentH = Math.max(0, i.layoutHeight - i.insetY);
  const drawnCss = Math.min(contentW, contentH * i.aspect);
  const transformScale = i.rectWidth / i.layoutWidth;
  return drawnCss * transformScale * (i.devicePixelRatio || 1);
}

/** Drawn device px of the image in `el`; 0 when it has no layout box (display: none, detached). */
export function measureLogoElement(el: HTMLElement, aspect: number): number {
  const cs = getComputedStyle(el);
  const px = (v: string) => parseFloat(v) || 0;
  const insetX = px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
  const insetY = px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
  // Computed width/height keep the fractions of the 110.4 x 38.4 box (offsetWidth/offsetHeight round them, ~1.2%,
  // enough to cross a level threshold). Under content-box they exclude padding + border.
  const borderBox = cs.boxSizing === 'border-box';
  const w = parseFloat(cs.width);
  const h = parseFloat(cs.height);
  if (!(w > 0) || !(h > 0)) return 0;
  return drawnDeviceWidth({
    rectWidth: el.getBoundingClientRect().width,
    layoutWidth: borderBox ? w : w + insetX,
    layoutHeight: borderBox ? h : h + insetY,
    insetX,
    insetY,
    aspect,
    devicePixelRatio: window.devicePixelRatio,
  });
}

/**
 * Bind the mip level for an `<img>` showing the Super FUMBBL wordmark. Re-measures on element resize, window
 * resize / DPR change, and whenever `retrigger` changes (panel scale lives in a CSS transform, which no
 * ResizeObserver sees).
 */
export function useSuperFumbblLogoMip(el: Ref<HTMLImageElement | null>, retrigger?: WatchSource<unknown>): Ref<string> {
  const levels = SUPER_FUMBBL_LOGO_MIPS;
  const fallback = levels.find((l) => l.width === SUPER_FUMBBL_LOGO_DEFAULT_WIDTH) ?? levels[levels.length - 1];
  const src = ref(fallback?.url ?? '');
  let raf = 0;
  const update = () => {
    raf = 0;
    const node = el.value;
    if (!node || !levels.length) return;
    const aspect = node.naturalWidth > 0 && node.naturalHeight > 0 ? node.naturalWidth / node.naturalHeight : LOGO_ASPECT;
    const need = measureLogoElement(node, aspect);
    if (!(need > 0)) return; // hidden: keep the bound level; the ResizeObserver re-measures once it has a box again
    const lvl = pickMipLevel(levels, need);
    if (lvl && lvl.url !== src.value) src.value = lvl.url;
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  let ro: ResizeObserver | null = null;
  let dprQuery: MediaQueryList | null = null;
  const onDpr = () => { schedule(); watchDpr(); };
  const watchDpr = () => {
    dprQuery?.removeEventListener('change', onDpr);
    if (typeof window.matchMedia !== 'function') return;
    // A resolution query only matches the CURRENT ratio, so it fires once per change: re-arm on every change.
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprQuery.addEventListener('change', onDpr);
  };
  onMounted(() => {
    window.addEventListener('resize', schedule);
    watchDpr();
    if (typeof ResizeObserver !== 'undefined') ro = new ResizeObserver(schedule);
    if (el.value) ro?.observe(el.value);
    schedule();
  });
  watch(el, (node, prev) => {
    if (prev) ro?.unobserve(prev);
    if (node) { ro?.observe(node); schedule(); }
  }, { flush: 'post' });
  if (retrigger) watch(retrigger, schedule, { deep: true, flush: 'post' });
  onBeforeUnmount(() => {
    window.removeEventListener('resize', schedule);
    dprQuery?.removeEventListener('change', onDpr);
    dprQuery = null;
    ro?.disconnect();
    ro = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  });
  return src;
}
