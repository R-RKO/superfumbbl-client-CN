// Owner 10-13: "Let's instead attach a screenshot automatically when the user selects bug report". There is no DOM
// capture library in the lock file (and the build is offline), so this is the pragmatic in-house version: clone the
// document, write each visible element's computed style onto the clone as an inline style, turn canvases and images
// into data URLs, and wrap the lot in an SVG <foreignObject> the caller rasterises onto a canvas.
//
// Two phases, because the Report dialog must not be in the picture:
//   1. snapshotDom: the CLONE and the computed-style walk, which need the live DOM as it is now. The caller opens the
//      dialog only after this resolves. Sliced (it yields between slices) so a large HUD never freezes a frame for long.
//   2. finish: inlines same-origin fonts and CSS images (url(...) in a computed style cannot load inside an SVG image)
//      and serialises the SVG markup. Works on the detached clone only, so the dialog opening meanwhile cannot leak in.
//
// What is NOT in the picture (by design or by limit):
//   - the FUMBBL.COM site (a native webview, never DOM; its placeholders are excluded too), iframes, video, audio;
//   - cross-origin images the browser cannot read back (a transparent box keeps their place); a CORS-readable
//     cross-origin image IS included, like any loaded image;
//   - CSS animations and transitions (the copy is the computed style of this instant);
//   - ::before / ::after with content other than strings and attr() (counters, quotes, images: skipped);
//   - the elements listed in `punchThrough` (the Pixi pitch canvas): the caller draws that canvas UNDER this layer, so
//     each is replaced by an empty box and its ancestors' backgrounds are cleared so the pitch shows through.
// Nothing here makes a request to another host: only same-origin assets the client already loaded are re-read.

import { FALLBACK_FONT_FACES } from './fontStacks';

/** Elements that never ride in the capture. The FUMBBL.COM pane and floating window are the owner's privacy line. */
export const DOM_SNAPSHOT_EXCLUDE = [
  'script', 'style', 'link', 'meta', 'noscript', 'template', 'iframe', 'object', 'embed', 'video', 'audio',
  '.fumbbl-float', '.fumbbl-home-blade', '[data-bug-capture-exclude]',
].join(',');

/** The properties copied onto the clone. Curated (not all ~350) to keep the walk fast on a big HUD. */
export const SNAPSHOT_PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'clear', 'box-sizing',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'overflow-x', 'overflow-y',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'justify-content', 'align-items',
  'align-self', 'align-content', 'order', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-auto-flow', 'grid-auto-columns',
  'grid-auto-rows', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end', 'justify-items',
  'justify-self', 'vertical-align', 'aspect-ratio', 'object-fit', 'object-position', 'table-layout',
  'border-collapse', 'border-spacing', 'visibility', 'opacity', 'transform', 'transform-origin', 'isolation',
  'mix-blend-mode', 'clip-path', 'filter',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'outline-width', 'outline-style', 'outline-color', 'outline-offset', 'box-shadow',
  'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
  'background-clip', 'background-origin', 'mask-image',
  'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch', 'line-height',
  'letter-spacing', 'word-spacing', 'text-align', 'text-transform', 'text-decoration-line', 'text-decoration-color',
  'text-decoration-style', 'text-shadow', 'text-indent', 'text-overflow', 'white-space', 'word-break',
  'overflow-wrap', 'direction', 'writing-mode', 'font-feature-settings', 'font-variant-numeric', 'list-style-type',
  'list-style-position', 'image-rendering', '-webkit-text-stroke-width', '-webkit-text-stroke-color',
  '-webkit-line-clamp', '-webkit-box-orient',
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap',
  'stroke-linejoin',
] as const;

const URL_PROPS = new Set(['background-image', 'mask-image']);

/** The client's own faces, registered through the FontFace API in main.ts (so no @font-face rule exists to read).
 *  Keep in step with main.ts boot(): an SVG image cannot see the document's fonts, so they are embedded. Astra 10-23:
 *  the bundled last-resort faces too, with their unicode-range (only the ones the page actually loaded are embedded,
 *  like every face here), so a bug-report snapshot of a CJK name does not show boxes. */
export const CLIENT_FONT_FACES: readonly { family: string; url: string; style?: string; unicodeRange?: string }[] = [
  { family: 'Nuffle', url: '/fonts/Nuffle.otf' },
  { family: 'Graduate', url: '/fonts/Graduate-Regular.ttf' },
  { family: 'SNES', url: '/fonts/SNES-Italic.ttf', style: 'italic' },
  ...FALLBACK_FONT_FACES.map((face) => ({ family: face.family, url: face.url, unicodeRange: face.unicodeRange })),
];
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const FONT_BYTES_CAP = 4 * 1024 * 1024;
/** Total bytes of CSS images (background-image, mask-image) inlined into one capture. */
export const CSS_IMAGE_BYTES_CAP = 2 * 1024 * 1024;

export class SnapshotDeadline extends Error {
  constructor() { super('snapshot deadline'); }
}

export interface DomSnapshotOptions {
  doc: Document;
  /** CSS viewport size the SVG is laid out at. */
  width: number;
  height: number;
  /** Device pixels per CSS pixel the SVG is rasterised at (the SVG's own width/height; the viewBox stays CSS). */
  scale: number;
  /** Drawn by the caller under this layer (the Pixi pitch canvas). */
  punchThrough?: readonly Element[];
  /** `performance.now()`-style ms; the walk throws SnapshotDeadline once past it. */
  deadline: number;
  now?: () => number;
  /** Yields to the event loop between slices. */
  yieldFn?: () => Promise<void>;
  /** Work per slice before yielding, ms. */
  sliceMs?: number;
  exclude?: string;
  /** The capture's cancel (time-box or dialog closed): the walk stops at its next slice. */
  signal?: AbortSignal;
}

export interface DomSnapshot {
  /** Background colour of the nearest cleared pitch ancestor: what the window shows where nothing else paints. */
  baseColor: string | null;
  /** Inline the resources and serialise. Null when the deadline passes or the signal aborts first. */
  finish(deadline: number, signal?: AbortSignal): Promise<string | null>;
}

export function defaultYield(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback;
    if (typeof ric === 'function') ric(() => resolve(), { timeout: 50 });
    else setTimeout(resolve, 0);
  });
}

function isTransparent(color: string): boolean {
  return !color || color === 'transparent' || /^rgba\(.*,\s*0\)$/.test(color);
}

/** A sandbox iframe whose elements carry only UA defaults: the baseline a property must differ from to be written. */
class DefaultStyles {
  private frame: HTMLIFrameElement | null = null;
  private cache = new Map<string, string[]>();
  constructor(private readonly doc: Document) {}

  get(el: Element): string[] | null {
    const key = `${el.namespaceURI}|${el.localName}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    try {
      if (!this.frame) {
        this.frame = this.doc.createElement('iframe');
        this.frame.setAttribute('aria-hidden', 'true');
        this.frame.setAttribute('data-bug-capture-exclude', '');
        this.frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:10px;height:10px;visibility:hidden;border:0';
        this.doc.body.appendChild(this.frame);
      }
      const fdoc = this.frame.contentDocument;
      const fwin = this.frame.contentWindow;
      if (!fdoc || !fwin || !fdoc.body) return null;
      const probe = fdoc.createElementNS(el.namespaceURI ?? 'http://www.w3.org/1999/xhtml', el.localName);
      let host: Element = fdoc.body;
      if (el.namespaceURI === 'http://www.w3.org/2000/svg' && el.localName !== 'svg') {
        host = fdoc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        fdoc.body.appendChild(host);
      }
      host.appendChild(probe);
      const cs = fwin.getComputedStyle(probe);
      const values = SNAPSHOT_PROPS.map((p) => cs.getPropertyValue(p));
      (host === fdoc.body ? probe : host).remove();
      this.cache.set(key, values);
      return values;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.frame?.remove();
    this.frame = null;
  }
}

function sameOrigin(url: string, doc: Document): boolean {
  try {
    const u = new URL(url, doc.baseURI);
    if (u.protocol === 'data:' || u.protocol === 'blob:') return true;
    return u.origin === new URL(doc.baseURI).origin;
  } catch {
    return false;
  }
}

/** Total characters of <img> data URLs embedded in one capture, every occurrence counted (a data: URL is ASCII, so
 *  characters = bytes). Past it, further images keep their box as a transparent pixel. */
export const IMG_BYTES_CAP = 16 * 1024 * 1024;

/**
 * drunkenmonkey 10-15 (1.0.214): a report from the end-of-game screen came without a screenshot. Each <img> used to be
 * inlined at its NATURAL size, once per element: a log die face is a large PNG drawn at about 16 px, so a full game
 * log (the 400-line match ring, two faces per roll) made the SVG hundreds of MB (measured in Chromium: 7.8 MB with the
 * demo log, 106 MB at 150 lines, 282 MB at 400), and decoding it alone overran the 1.5 s time-box. The picture never
 * needs more pixels than the box shows at the capture scale, so the image is redrawn at that size: one uniform factor
 * (the aspect ratio is kept, so object-fit lays it out as before), large enough to cover the box in both directions,
 * never above the natural size. Null when the box paints nothing.
 */
export function inlineImageSize(naturalWidth: number, naturalHeight: number, boxWidth: number, boxHeight: number,
  scale: number): { width: number; height: number } | null {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return null;
  if (!(boxWidth > 0) || !(boxHeight > 0)) return null;
  const s = scale > 0 && Number.isFinite(scale) ? scale : 1;
  const factor = Math.min(1, Math.max((boxWidth * s) / naturalWidth, (boxHeight * s) / naturalHeight));
  return {
    width: Math.max(1, Math.min(naturalWidth, Math.ceil(naturalWidth * factor))),
    height: Math.max(1, Math.min(naturalHeight, Math.ceil(naturalHeight * factor))),
  };
}

/** One loaded <img> as a data URL via a 2D canvas, at `size` px; null when it is not loaded or cannot be read back
 *  (taint). `pixelated` = the page draws it with image-rendering pixelated / crisp-edges (sprite portraits): the
 *  redraw then samples nearest too, so the sprite is not blended before the copied CSS renders it (Astra 10-15). A data: source already at that size is used as it is (the end-of-game portraits are data: URLs extracted
 *  at 3x, so they are redrawn smaller like any other image). */
function imageToDataUrl(img: HTMLImageElement, doc: Document, size: { width: number; height: number },
  pixelated: boolean): string | null {
  if (!img.complete || !img.naturalWidth || !img.naturalHeight) return null;
  const src = img.currentSrc || img.src;
  if (src.startsWith('data:') && size.width === img.naturalWidth && size.height === img.naturalHeight) return src;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = !pixelated;
    if (!pixelated) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, size.width, size.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function blobToDataUrl(blob: Blob, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new SnapshotDeadline();
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const onAbort = () => { try { reader.abort(); } catch { /* idle */ } reject(new SnapshotDeadline()); };
      signal?.addEventListener('abort', onAbort, { once: true });
      reader.onload = () => { signal?.removeEventListener('abort', onAbort); resolve(String(reader.result)); };
      reader.onerror = () => { signal?.removeEventListener('abort', onAbort); reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

/** Re-read one same-origin asset the client already loaded (the HTTP cache answers). Null on anything else. */
async function fetchSameOrigin(url: string, doc: Document, signal?: AbortSignal): Promise<Blob | null> {
  if (!sameOrigin(url, doc) || url.startsWith('data:') || signal?.aborted) return null;
  try {
    const response = await fetch(new URL(url, doc.baseURI).href, { cache: 'force-cache', signal });
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  }
}

const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/** The @font-face rules of every readable sheet whose family is loaded in the document, with url() resolved. */
function collectFontFaces(doc: Document): { css: string; urls: string[] }[] {
  const loaded = new Set<string>();
  try {
    doc.fonts?.forEach((face) => { if (face.status === 'loaded') loaded.add(face.family.replace(/["']/g, '').trim()); });
  } catch { /* no FontFaceSet */ }
  const out: { css: string; urls: string[] }[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet
    const base = sheet.href || doc.baseURI;
    for (const rule of Array.from(rules)) {
      if (rule.constructor?.name !== 'CSSFontFaceRule' && !(rule.cssText ?? '').startsWith('@font-face')) continue;
      const style = (rule as CSSFontFaceRule).style;
      const family = style?.getPropertyValue('font-family').replace(/["']/g, '').trim();
      if (!family || !loaded.has(family)) continue;
      const urls: string[] = [];
      const css = rule.cssText.replace(CSS_URL, (_m, _q, raw: string) => {
        let abs = raw;
        try { abs = new URL(raw, base).href; } catch { /* keep */ }
        urls.push(abs);
        return `url("${abs}")`;
      });
      out.push({ css, urls });
    }
  }
  const declared = new Set(out.map((f) => f.css));
  for (const face of CLIENT_FONT_FACES) {
    if (!loaded.has(face.family)) continue;
    let abs = face.url;
    try { abs = new URL(face.url, doc.baseURI).href; } catch { /* keep */ }
    const css = `@font-face { font-family: "${face.family}"; src: url("${abs}");${face.style ? ` font-style: ${face.style};` : ''}${face.unicodeRange ? ` unicode-range: ${face.unicodeRange};` : ''} }`;
    if (!declared.has(css)) out.push({ css, urls: [abs] });
  }
  return out;
}

/** The text a pseudo-element's computed `content` produces: strings and attr() only; null for anything else. */
export function pseudoContentText(content: string, el: Element): string | null {
  if (!content || content === 'none' || content === 'normal') return null;
  let out = '';
  let rest = content.trim();
  while (rest) {
    const str = /^"((?:[^"\\]|\\.)*)"\s*/.exec(rest) ?? /^'((?:[^'\\]|\\.)*)'\s*/.exec(rest);
    if (str) {
      out += str[1]!.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/\\(.)/g, '$1');
      rest = rest.slice(str[0].length);
      continue;
    }
    const attr = /^attr\(\s*([\w-]+)\s*\)\s*/.exec(rest);
    if (attr) {
      out += el.getAttribute(attr[1]!) ?? '';
      rest = rest.slice(attr[0].length);
      continue;
    }
    return null;
  }
  return out;
}

function escapeAttrUrl(url: string): string {
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Phase 1: clone the document and write the visible elements' computed styles onto the clone. Throws
 * SnapshotDeadline when the deadline passes mid-walk.
 */
export async function snapshotDom(options: DomSnapshotOptions): Promise<DomSnapshot> {
  const { doc, width, height, scale, deadline } = options;
  const now = options.now ?? (() => performance.now());
  const yieldFn = options.yieldFn ?? defaultYield;
  const sliceMs = options.sliceMs ?? 12;
  const exclude = options.exclude ?? DOM_SNAPSHOT_EXCLUDE;
  const win = doc.defaultView;
  if (!win || !doc.body) throw new Error('no document');
  if (now() > deadline || options.signal?.aborted) throw new SnapshotDeadline();

  // Punch-through: the canvases drawn underneath, and every ancestor whose background would cover them.
  const punch = new Set<Element>(options.punchThrough ?? []);
  const cleared = new Set<Element>();
  let baseColor: string | null = null;
  for (const el of punch) {
    for (let a = el.parentElement; a; a = a.parentElement) {
      cleared.add(a);
      if (baseColor === null) {
        const bg = win.getComputedStyle(a).backgroundColor;
        if (!isTransparent(bg)) baseColor = bg;
      }
    }
  }

  // The structural snapshot is ONE synchronous step, so live and clone pair up by document order. It is the most
  // expensive synchronous step, so a capture already cancelled or out of time never starts it (Astra 10-13).
  if (now() > deadline || options.signal?.aborted) throw new SnapshotDeadline();
  const live = [doc.body, ...Array.from(doc.body.getElementsByTagName('*'))];
  const bodyClone = doc.body.cloneNode(true) as HTMLElement;
  const copies = [bodyClone, ...Array.from(bodyClone.getElementsByTagName('*'))];
  if (copies.length !== live.length) throw new Error('clone mismatch');

  const defaults = new DefaultStyles(doc);
  const values = new Map<Element, string[]>(); // clone -> the computed values written (parents for inheritance)
  const shifts = new Map<Element, [number, number]>(); // clone child -> scroll offset of its scrolled parent
  const cssUrls = new Set<string>();
  const imageCache = new Map<string, string | null>(); // `${src}|${w}x${h}|${smoothing}` -> data URL
  let imgElementBytes = 0;
  const htmlValues = SNAPSHOT_PROPS.map((p) => win.getComputedStyle(doc.documentElement).getPropertyValue(p));

  const styleFor = (src: Element, dst: Element, cs: CSSStyleDeclaration, parent: string[] | null, full: boolean,
    defOverride?: string[] | null): string[] => {
    const def = full ? null : defOverride !== undefined ? defOverride : defaults.get(src);
    const own: string[] = new Array(SNAPSHOT_PROPS.length);
    const parts: string[] = [];
    for (let i = 0; i < SNAPSHOT_PROPS.length; i++) {
      const prop = SNAPSHOT_PROPS[i]!;
      let v = cs.getPropertyValue(prop);
      own[i] = v;
      if ((prop === 'overflow-x' || prop === 'overflow-y') && (v === 'auto' || v === 'scroll')) v = 'hidden';
      if (cleared.has(src) && prop === 'background-color') v = 'transparent';
      if (cleared.has(src) && prop === 'background-image') v = 'none';
      if (prop === 'transform') {
        const shift = shifts.get(dst);
        if (shift) v = `translate(${-shift[0]}px, ${-shift[1]}px)${v && v !== 'none' ? ` ${v}` : ''}`;
      }
      // Omit only when the value is BOTH the UA default and the parent's value: then neither inheritance nor the
      // default can change it inside the image.
      if (!full && def && v === def[i] && parent && v === parent[i]) continue;
      if (!v) continue;
      if (URL_PROPS.has(prop) && v.includes('url(')) {
        v = v.replace(CSS_URL, (_m, _q, raw: string) => {
          let abs = raw;
          try { abs = new URL(raw, doc.baseURI).href; } catch { /* keep */ }
          cssUrls.add(abs);
          return `url("${abs}")`;
        });
      }
      parts.push(`${prop}:${v}`);
    }
    dst.setAttribute('style', parts.join(';'));
    return own;
  };

  const removed = new Set<Element>();
  let spanDefaults: string[] | null = null;
  let sliceStart = now();
  try {
    for (let i = 0; i < live.length; i++) {
      if (now() - sliceStart > sliceMs) {
        if (now() > deadline || options.signal?.aborted) throw new SnapshotDeadline();
        await yieldFn();
        if (now() > deadline || options.signal?.aborted) throw new SnapshotDeadline();
        sliceStart = now();
      }
      const src = live[i]!;
      const dst = copies[i]!;
      const isBody = i === 0;
      const parentClone = dst.parentElement;
      if (!isBody && (!parentClone || removed.has(parentClone) || !values.has(parentClone))) {
        removed.add(dst);
        continue;
      }
      if (!isBody && src.matches(exclude)) { dst.remove(); removed.add(dst); continue; }
      const cs = win.getComputedStyle(src);
      if (!isBody && cs.display === 'none') { dst.remove(); removed.add(dst); continue; }
      const parentValues = isBody ? htmlValues : values.get(parentClone!) ?? null;
      const own = styleFor(src, dst, cs, parentValues, isBody);
      values.set(dst, own);

      // ::before / ::after become real spans (the Graduate lettering draws its letters with content: attr(data-t)).
      for (const which of ['::before', '::after'] as const) {
        const pcs = win.getComputedStyle(src, which);
        const text = pseudoContentText(pcs.getPropertyValue('content'), src);
        if (text === null || pcs.display === 'none') continue;
        const span = doc.createElement('span');
        if (!spanDefaults) spanDefaults = defaults.get(span) ?? null;
        styleFor(src, span, pcs, own, false, spanDefaults);
        span.textContent = text;
        if (which === '::before') dst.insertBefore(span, dst.firstChild);
        else dst.appendChild(span);
      }

      // A scrolled box (the log, chat) shows its scrolled-to part. Flex and grid items take a transform themselves;
      // anything else (text, inline runs in a <pre>) moves inside one translated block wrapper.
      if (src.scrollTop || src.scrollLeft) {
        if (/^(inline-)?(flex|grid)$/.test(cs.display)) {
          for (const child of Array.from(dst.children)) shifts.set(child, [src.scrollLeft, src.scrollTop]);
        } else {
          const wrap = doc.createElement('div');
          wrap.setAttribute('style', `display:block;transform:translate(${-src.scrollLeft}px, ${-src.scrollTop}px)`);
          while (dst.firstChild) wrap.appendChild(dst.firstChild);
          dst.appendChild(wrap);
          values.set(wrap, own); // its children compare against the scroller's values (a wrapper inherits them all)
        }
      }
      const tag = src.localName;
      if (punch.has(src)) {
        const box = doc.createElement('div');
        box.setAttribute('style', `${dst.getAttribute('style') ?? ''};background:transparent`);
        dst.replaceWith(box);
        values.set(box, own);
        removed.add(dst);
      } else if (tag === 'canvas' && src instanceof win.HTMLCanvasElement) {
        let url: string | null = null;
        try { if (src.width && src.height) url = src.toDataURL('image/png'); } catch { url = null; }
        const img = doc.createElement('img');
        img.setAttribute('style', dst.getAttribute('style') ?? '');
        img.setAttribute('src', url ?? TRANSPARENT_PIXEL);
        dst.replaceWith(img);
        values.set(img, own);
        removed.add(dst);
      } else if (tag === 'img' && src instanceof win.HTMLImageElement) {
        let url: string | null = null;
        const natW = src.naturalWidth;
        const natH = src.naturalHeight;
        const box = src.getBoundingClientRect();
        // object-fit: none (and scale-down past the box) paint at the natural size, so those keep every pixel.
        const fit = cs.getPropertyValue('object-fit');
        const size = fit === 'none' || fit === 'scale-down'
          ? (natW > 0 && natH > 0 && box.width > 0 && box.height > 0 ? { width: natW, height: natH } : null)
          : inlineImageSize(natW, natH, box.width, box.height, scale);
        if (size) {
          const rendering = cs.getPropertyValue('image-rendering');
          const pixelated = rendering === 'pixelated' || rendering === 'crisp-edges';
          const key = `${src.currentSrc || src.src}|${size.width}x${size.height}|${pixelated ? 'p' : 's'}`;
          if (!imageCache.has(key)) imageCache.set(key, imageToDataUrl(src, doc, size, pixelated));
          url = imageCache.get(key) ?? null;
          if (url && imgElementBytes + url.length > IMG_BYTES_CAP) url = null;
          if (url) imgElementBytes += url.length;
        }
        dst.setAttribute('src', url ?? TRANSPARENT_PIXEL);
        // The layout size stays the natural one wherever CSS leaves it to the image (the redraw is smaller).
        if (natW > 0 && natH > 0 && !src.hasAttribute('width') && !src.hasAttribute('height')) {
          dst.setAttribute('width', String(natW));
          dst.setAttribute('height', String(natH));
        }
        dst.removeAttribute('srcset');
        dst.removeAttribute('loading');
      } else if (tag === 'input' && src instanceof win.HTMLInputElement) {
        if (src.type === 'checkbox' || src.type === 'radio') {
          if (src.checked) dst.setAttribute('checked', ''); else dst.removeAttribute('checked');
        } else if (src.type !== 'password') {
          dst.setAttribute('value', src.value);
        } else {
          dst.setAttribute('value', '');
        }
      } else if (tag === 'textarea' && src instanceof win.HTMLTextAreaElement) {
        dst.textContent = src.value;
      } else if (tag === 'select' && src instanceof win.HTMLSelectElement) {
        Array.from((dst as HTMLSelectElement).options ?? []).forEach((opt, idx) => {
          if (idx === src.selectedIndex) opt.setAttribute('selected', ''); else opt.removeAttribute('selected');
        });
      }
    }
  } finally {
    defaults.dispose();
  }

  // The <html> layer: its own styles, sized to the window, and a containing block for position:fixed children.
  const root = doc.createElement('div');
  const rootParts = SNAPSHOT_PROPS.map((p, i) => [p, htmlValues[i]] as const)
    .filter(([p, v]) => v && !['width', 'height', 'overflow-x', 'overflow-y', 'position', 'transform'].includes(p))
    .map(([p, v]) => (cleared.has(doc.documentElement) && (p === 'background-color' || p === 'background-image')
      ? `${p}:${p === 'background-color' ? 'transparent' : 'none'}` : `${p}:${v}`));
  rootParts.push(`width:${width}px`, `height:${height}px`, 'overflow:hidden', 'position:relative', 'transform:translate(0px, 0px)', 'margin:0');
  root.setAttribute('style', rootParts.join(';'));
  // body -> div (the inline style already carries everything the body element contributed)
  const bodyDiv = doc.createElement('div');
  bodyDiv.setAttribute('style', bodyClone.getAttribute('style') ?? '');
  while (bodyClone.firstChild) bodyDiv.appendChild(bodyClone.firstChild);
  root.appendChild(bodyDiv);

  return {
    baseColor,
    async finish(finishDeadline: number, signal?: AbortSignal): Promise<string | null> {
      if (signal?.aborted) return null;
      // Fonts and CSS images: same-origin only, in parallel, each bounded by the deadline and the signal.
      const remaining = () => Math.min(60_000, Math.max(0, finishDeadline - now()));
      const withinDeadline = <T>(p: Promise<T>, fallback: T): Promise<T> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const late = new Promise<T>((r) => { timer = setTimeout(() => r(fallback), remaining()); });
        return Promise.race([p, late]).finally(() => clearTimeout(timer));
      };

      const fonts = collectFontFaces(doc);
      const fontUrls = [...new Set(fonts.flatMap((f) => f.urls))];
      const urlMap = new Map<string, string>();
      let fontBytes = 0;
      let imageBytes = 0;
      await withinDeadline(Promise.all([
        ...fontUrls.map(async (url) => {
          const blob = await fetchSameOrigin(url, doc, signal);
          if (!blob || fontBytes + blob.size > FONT_BYTES_CAP) return;
          fontBytes += blob.size;
          urlMap.set(url, await blobToDataUrl(blob, signal));
        }),
        ...[...cssUrls].map(async (url) => {
          if (url.startsWith('data:')) return;
          const blob = await fetchSameOrigin(url, doc, signal);
          // Astra: a capped total, so one huge background cannot balloon the SVG (over the cap -> `none`).
          if (!blob || imageBytes + blob.size > CSS_IMAGE_BYTES_CAP) return;
          imageBytes += blob.size;
          urlMap.set(url, await blobToDataUrl(blob, signal));
        }),
      ]).catch(() => undefined), undefined);
      if (now() > finishDeadline || signal?.aborted) return null;

      const fontCss = fonts
        .filter((f) => f.urls.length && f.urls.every((u) => urlMap.has(u) || u.startsWith('data:')))
        .map((f) => f.css.replace(CSS_URL, (_m, _q, raw: string) => `url("${urlMap.get(raw) ?? raw}")`))
        .join('\n');
      if (fontCss) {
        const style = doc.createElement('style');
        style.textContent = fontCss;
        root.insertBefore(style, root.firstChild);
      }
      let markup = new XMLSerializer().serializeToString(root);
      // CSS images: inline what was read; anything else (cross-origin, failed) becomes `none` - an SVG image cannot
      // fetch, and a dangling url() can make the whole draw fail.
      // Astra (10-13): the 2 MB cap counts what is EMBEDDED: every occurrence of every CSS image, inline data: images
      // included. An image whose embeddings would cross the cap is dropped (`none`) everywhere.
      let embeddedBytes = 0;
      for (const url of cssUrls) {
        const ref = `url(&quot;${escapeAttrUrl(url)}&quot;)`;
        const parts = markup.split(ref);
        const occurrences = parts.length - 1;
        if (occurrences === 0) continue;
        const inline = url.startsWith('data:') ? url : urlMap.get(url);
        const cost = inline ? inline.length * occurrences : 0; // a data: URL is ASCII: chars = bytes
        if (inline && embeddedBytes + cost <= CSS_IMAGE_BYTES_CAP) {
          embeddedBytes += cost;
          if (inline !== url) markup = parts.join(`url(&quot;${escapeAttrUrl(inline)}&quot;)`);
        } else {
          markup = parts.join('none');
        }
      }
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${width} ${height}">`
        + `<foreignObject x="0" y="0" width="${width}" height="${height}">${markup}</foreignObject></svg>`;
    },
  };
}
