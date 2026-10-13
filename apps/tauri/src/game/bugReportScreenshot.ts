// Owner 10-13: "Let's instead attach a screenshot automatically when the user selects bug report". A coach had
// screenshots of missing images and no way to send them; the report now carries one picture of the client window,
// taken at the moment Report is pressed, BEFORE the dialog covers anything.
//
// The picture is composed, bottom to top:
//   1. the window background (the colour behind the pitch);
//   2. the Pixi pitch, a fresh `renderer.extract` of the stage drawn at the canvas's on-screen rect (the WebGL buffer
//      is not preserved, so the live canvas cannot be read back);
//   3. the DOM HUD, an SVG <foreignObject> copy of the document (domSnapshot.ts) with the pitch canvas punched out.
// If the HUD layer throws or taints the canvas, the picture is the pitch alone with the note "HUD not captured". With
// no pitch mounted (console blades) it is the DOM alone.
//
// Size: CSS size x min(devicePixelRatio, 2), never above 3840 x 2160 device px (a bigger window is drawn scaled
// down). Time-box: 1.5 s for the lot, after which the report goes without one.
// Upload ladder: PNG; over the cap -> JPEG 0.85; still over -> half size, once; still over -> no screenshot (noted).
// The cap is the relay's: config-web `SCREENSHOT_CAP` is 5 MB of decoded bytes and a larger image fails the WHOLE
// report with 413, so the client never sends more than that (the brief's 6 MB is above it).
//
// Privacy: nothing is captured in the background; this runs only from the Report entry. Nothing is fetched from
// another host. The FUMBBL.COM site pane is excluded. The data URL is never logged. The coach decides: Send stays
// disabled until the capture settles, and the image + checkbox are frozen at the click (SpectateView submitReport).
// Astra review notes (10-13), accepted by design:
//   - whatever is on screen is in the picture: visible chat, coach names, open Settings text (password inputs are
//     serialised EMPTY); that is why the dialog shows the image and lets the coach untick it;
//   - images on other hosts are left out unless the browser can already read them back: CORS-readable cross-origin
//     images CAN be included; a tainting one becomes a transparent box;
//   - `filter`, `clip-path` and SVG url() references in computed styles are copied as they are, not sanitised.

import { SnapshotDeadline, defaultYield, snapshotDom, type DomSnapshot } from './domSnapshot';

/** The relay's per-image cap (config-web bugReports.ts SCREENSHOT_CAP = 5 MB). Never above it: 413 drops the report. */
export const BUG_REPORT_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const BUG_REPORT_CAPTURE_DPR_CAP = 2;
export const BUG_REPORT_CAPTURE_TIMEOUT_MS = 1500;
export const BUG_REPORT_JPEG_QUALITY = 0.85;

export const HUD_NOT_CAPTURED_NOTE = 'HUD not captured';
export const SCREENSHOT_TOO_LARGE_NOTE = 'The screenshot was too large to send, so it is left out.';
export const SCREENSHOT_TIMED_OUT_NOTE = 'The screenshot took too long, so it is left out.';

export type ScreenshotMimeType = 'image/png' | 'image/jpeg';

export interface ReportScreenshot {
  mimeType: ScreenshotMimeType;
  /** Raw base64 (no data: prefix): the relay's `screenshot.base64`. */
  base64: string;
  /** For the dialog thumbnail only. Never logged. */
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  hudCaptured: boolean;
  notes: string[];
}

export type ReportCaptureResult =
  | { status: 'ok'; shot: ReportScreenshot }
  | { status: 'failed'; notes: string[] };

/** The relay contract (config-web BugReportBody.screenshot). */
export interface BugReportScreenshotAttachment {
  fileName: string;
  mimeType: ScreenshotMimeType;
  base64: string;
}

export function captureScale(devicePixelRatio: number | undefined): number {
  const dpr = Number.isFinite(devicePixelRatio) && (devicePixelRatio ?? 0) > 0 ? devicePixelRatio! : 1;
  return Math.min(dpr, BUG_REPORT_CAPTURE_DPR_CAP);
}

/** True while the capture has not settled (no ok / failed / timed-out result yet): Send stays disabled, so the coach
 *  always sees the picture (or its absence) and the checkbox before anything is sent (Astra 10-13, consent). */
export function reportCaptureUnsettled(result: ReportCaptureResult | null | undefined): boolean {
  return !result;
}

/** What rides in the POST body: the attachment when there is a picture AND the box is ticked, else null. */
export function screenshotAttachment(
  result: ReportCaptureResult | null | undefined,
  include: boolean,
): BugReportScreenshotAttachment | null {
  if (!include || !result || result.status !== 'ok') return null;
  const { mimeType, base64 } = result.shot;
  return { fileName: mimeType === 'image/png' ? 'screenshot.png' : 'screenshot.jpg', mimeType, base64 };
}

/** The minimal canvas surface the composer and the ladder use (a real canvas in the app, a fake in tests). */
export interface CaptureCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): CaptureContext | null;
}
export interface CaptureContext {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: unknown, dx: number, dy: number, dw: number, dh: number): void;
  getImageData(x: number, y: number, w: number, h: number): unknown;
  imageSmoothingQuality?: ImageSmoothingQuality;
}

export interface PitchFrame {
  canvas: unknown;
  rect: { left: number; top: number; width: number; height: number };
}

export interface ComposeInput {
  width: number;
  height: number;
  scale: number;
  baseColor: string | null;
  pitch: PitchFrame | null;
  hud: unknown | null;
}

/**
 * Draw the layers in order onto `canvas` (already sized width*scale x height*scale). Returns whether the HUD layer
 * made it: false when it was absent, threw, or tainted the canvas (then the caller recomposes without it on a fresh
 * canvas, because a taint cannot be undone).
 */
export function composeCapture(canvas: CaptureCanvas, input: ComposeInput): { hudCaptured: boolean; tainted: boolean } {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.setTransform(input.scale, 0, 0, input.scale, 0, 0);
  ctx.fillStyle = input.baseColor ?? '#14161a';
  ctx.fillRect(0, 0, input.width, input.height);
  if (input.pitch) {
    const r = input.pitch.rect;
    ctx.drawImage(input.pitch.canvas, r.left, r.top, r.width, r.height);
  }
  if (!input.hud) return { hudCaptured: false, tainted: false };
  try {
    ctx.drawImage(input.hud, 0, 0, input.width, input.height);
  } catch {
    return { hudCaptured: false, tainted: false };
  }
  try {
    ctx.getImageData(0, 0, 1, 1); // throws SecurityError when the SVG layer tainted the canvas
  } catch {
    return { hudCaptured: false, tainted: true };
  }
  return { hudCaptured: true, tainted: false };
}

export type EncodeFn = (canvas: CaptureCanvas, type: ScreenshotMimeType, quality?: number) => Promise<Blob | null>;
export type CreateCanvasFn = (width: number, height: number) => CaptureCanvas;

export interface EncodedShot {
  blob: Blob;
  mimeType: ScreenshotMimeType;
  width: number;
  height: number;
}

/** A capture stopped by its time-box or by the dialog closing: every later step is skipped. */
export class CaptureAborted extends Error {
  constructor() { super('capture aborted'); }
}

/** Free a canvas's backing store once its pixels are no longer needed (a 4K RGBA surface is ~33 MB). */
export function releaseCanvas(canvas: unknown): void {
  if (!canvas || typeof canvas !== 'object' || !('width' in canvas)) return;
  try {
    (canvas as { width: number; height: number }).width = 0;
    (canvas as { width: number; height: number }).height = 0;
  } catch { /* not ours to resize */ }
}

/** The size ladder: PNG -> JPEG 0.85 -> half-size JPEG 0.85 (once) -> null. `shouldStop` is checked between attempts. */
export async function encodeForReport(
  canvas: CaptureCanvas,
  encode: EncodeFn,
  createCanvas: CreateCanvasFn,
  maxBytes = BUG_REPORT_SCREENSHOT_MAX_BYTES,
  shouldStop: () => boolean = () => false,
): Promise<EncodedShot | null> {
  const stop = () => { if (shouldStop()) throw new CaptureAborted(); };
  const fits = (b: Blob | null): b is Blob => !!b && b.size > 0 && b.size <= maxBytes;
  stop();
  const png = await encode(canvas, 'image/png');
  if (fits(png)) return { blob: png, mimeType: 'image/png', width: canvas.width, height: canvas.height };
  stop();
  const jpeg = await encode(canvas, 'image/jpeg', BUG_REPORT_JPEG_QUALITY);
  if (fits(jpeg)) return { blob: jpeg, mimeType: 'image/jpeg', width: canvas.width, height: canvas.height };
  stop();
  const w = Math.max(1, Math.round(canvas.width / 2));
  const h = Math.max(1, Math.round(canvas.height / 2));
  const half = createCanvas(w, h);
  try {
    const ctx = half.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, w, h);
    stop();
    const small = await encode(half, 'image/jpeg', BUG_REPORT_JPEG_QUALITY);
    if (fits(small)) return { blob: small, mimeType: 'image/jpeg', width: w, height: h };
    return null;
  } finally {
    releaseCanvas(half);
  }
}

export async function blobToBase64(blob: Blob, signal?: AbortSignal): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    if (signal?.aborted) throw new CaptureAborted();
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** The largest surface composed, in device px. A bigger window x DPR is drawn scaled down to fit. */
export const BUG_REPORT_CAPTURE_MAX_WIDTH = 3840;
export const BUG_REPORT_CAPTURE_MAX_HEIGHT = 2160;

/** Device px per CSS px for this capture: min(DPR, 2), lowered further so the surface fits 3840 x 2160. */
export function captureSurfaceScale(width: number, height: number, devicePixelRatio: number | undefined): number {
  return Math.min(
    captureScale(devicePixelRatio),
    BUG_REPORT_CAPTURE_MAX_WIDTH / Math.max(1, width),
    BUG_REPORT_CAPTURE_MAX_HEIGHT / Math.max(1, height),
  );
}

export interface SnapshotInput {
  width: number;
  height: number;
  scale: number;
  punchThrough: Element[];
  deadline: number;
  signal: AbortSignal;
}

export interface CaptureDeps {
  /** CSS viewport size. */
  width: number;
  height: number;
  devicePixelRatio: number;
  /** The mounted pitch, or null (console blades). Called first and synchronously: the pitch as it is NOW. */
  capturePitch: (() => PitchFrame | null) | null;
  /** The live pitch canvas element to punch out of the DOM layer. */
  pitchElement?: Element | null;
  /** Phase 1 of the DOM layer (see domSnapshot.ts). Null = no DOM layer. */
  snapshotDom: ((input: SnapshotInput) => Promise<DomSnapshot>) | null;
  /** SVG markup -> a drawable image (rejects when the browser will not decode it, or on abort). */
  loadSvg: (svg: string, signal: AbortSignal) => Promise<unknown>;
  createCanvas: CreateCanvasFn;
  encode: EncodeFn;
  toBase64?: (blob: Blob, signal: AbortSignal) => Promise<string>;
  now?: () => number;
  yieldFn?: () => Promise<void>;
  timeoutMs?: number;
  /** The caller's cancel (the dialog closed): stops the capture at its next step. */
  signal?: AbortSignal;
  /** Fires once the live DOM has been read (or skipped): the caller may open the dialog from here on. */
  onSnapshotTaken?: () => void;
}

/**
 * Capture the client window for a bug report. Never throws: every failure is a `failed` result with notes, and the
 * report goes without a picture. `onSnapshotTaken` fires exactly once, as early as the live state is no longer needed.
 *
 * Astra review (10-13): the time-box is not just a race. One AbortController carries the time-box and the caller's
 * cancel; it is checked between EVERY step (snapshot slices, resource reads, SVG decode, compose, each ladder
 * attempt, base64), fetches and readers take its signal, and every intermediate canvas is released once the final
 * blob exists (or the capture stops), so an abandoned capture stops costing memory and time.
 */
export async function captureClientWindow(deps: CaptureDeps): Promise<ReportCaptureResult> {
  const now = deps.now ?? (() => performance.now());
  const yieldFn = deps.yieldFn ?? defaultYield;
  const timeoutMs = deps.timeoutMs ?? BUG_REPORT_CAPTURE_TIMEOUT_MS;
  const deadline = now() + timeoutMs;
  const controller = new AbortController();
  const signal = controller.signal;
  let timedOut = false;
  let finished = false;
  const onExternalAbort = () => controller.abort();
  if (deps.signal?.aborted) controller.abort();
  deps.signal?.addEventListener('abort', onExternalAbort, { once: true });

  let snapshotSignalled = false;
  const signalSnapshot = () => {
    if (snapshotSignalled) return;
    snapshotSignalled = true;
    try { deps.onSnapshotTaken?.(); } catch { /* the caller's problem, never the capture's */ }
  };
  const check = () => {
    if (!signal.aborted && now() > deadline) { timedOut = true; controller.abort(); }
    if (signal.aborted) throw new CaptureAborted();
  };
  const stopped = (): ReportCaptureResult => {
    signalSnapshot();
    return { status: 'failed', notes: timedOut ? [SCREENSHOT_TIMED_OUT_NOTE] : [] };
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<ReportCaptureResult>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve(stopped());
    }, timeoutMs);
  });
  const cancelled = new Promise<ReportCaptureResult>((resolve) => {
    signal.addEventListener('abort', () => { if (!finished) resolve(stopped()); }, { once: true });
  });

  // Everything that holds pixels, released whatever the outcome.
  const surfaces: unknown[] = [];

  const work = (async (): Promise<ReportCaptureResult> => {
    check();
    const notes: string[] = [];
    const width = Math.max(1, Math.round(deps.width));
    const height = Math.max(1, Math.round(deps.height));
    const scale = captureSurfaceScale(width, height, deps.devicePixelRatio);
    const pixelW = Math.max(1, Math.round(width * scale));
    const pixelH = Math.max(1, Math.round(height * scale));

    let pitch: PitchFrame | null = null;
    try { pitch = deps.capturePitch?.() ?? null; } catch { pitch = null; }
    if (pitch) surfaces.push(pitch.canvas);

    let snapshot: DomSnapshot | null = null;
    check(); // the clone is the costliest synchronous step: never start it cancelled or late (Astra 10-13)
    if (deps.snapshotDom) {
      try {
        snapshot = await deps.snapshotDom({
          width, height, scale,
          punchThrough: pitch && deps.pitchElement ? [deps.pitchElement] : [],
          deadline,
          signal,
        });
      } catch (error) {
        if (error instanceof SnapshotDeadline) {
          if (!signal.aborted) { timedOut = true; controller.abort(); }
          throw new CaptureAborted();
        }
        snapshot = null;
      }
    }
    signalSnapshot();
    check();

    let hud: unknown = null;
    if (snapshot) {
      try {
        let svg: string | null = await snapshot.finish(deadline, signal);
        check();
        if (svg) hud = await deps.loadSvg(svg, signal);
        svg = null; // the markup can be megabytes; drop it as soon as it is decoded
      } catch (error) {
        if (error instanceof CaptureAborted || signal.aborted) throw new CaptureAborted();
        hud = null;
      }
    }
    check();
    if (!pitch && !hud) return { status: 'failed', notes };

    await yieldFn();
    check();
    const baseColor = snapshot?.baseColor ?? null;
    snapshot = null;
    let canvas = deps.createCanvas(pixelW, pixelH);
    surfaces.push(canvas);
    let composed = composeCapture(canvas, { width, height, scale, baseColor, pitch, hud });
    if (composed.tainted) {
      canvas = deps.createCanvas(pixelW, pixelH);
      surfaces.push(canvas);
      composed = composeCapture(canvas, { width, height, scale, baseColor, pitch, hud: null });
    }
    hud = null;
    if (!composed.hudCaptured && deps.snapshotDom) notes.push(HUD_NOT_CAPTURED_NOTE);
    if (!pitch && !composed.hudCaptured) return { status: 'failed', notes };

    await yieldFn();
    check();
    const encoded = await encodeForReport(canvas, deps.encode, deps.createCanvas, BUG_REPORT_SCREENSHOT_MAX_BYTES, () => {
      try { check(); return false; } catch { return true; }
    });
    check();
    if (!encoded) return { status: 'failed', notes: [...notes, SCREENSHOT_TOO_LARGE_NOTE] };
    for (const surface of surfaces.splice(0)) releaseCanvas(surface); // the blob exists: free the pixels now
    const base64 = await (deps.toBase64 ?? blobToBase64)(encoded.blob, signal);
    check();
    return {
      status: 'ok',
      shot: {
        mimeType: encoded.mimeType,
        base64,
        dataUrl: `data:${encoded.mimeType};base64,${base64}`,
        width: encoded.width,
        height: encoded.height,
        bytes: encoded.blob.size,
        hudCaptured: composed.hudCaptured,
        notes,
      },
    };
  })().catch((): ReportCaptureResult => stopped())
    .finally(() => { for (const surface of surfaces.splice(0)) releaseCanvas(surface); });

  try {
    return await Promise.race([work, timeout, cancelled]);
  } finally {
    finished = true;
    if (timer) clearTimeout(timer);
    deps.signal?.removeEventListener('abort', onExternalAbort);
    controller.abort(); // a capture that lost the race stops at its next step
  }
}

// ---- Browser wiring (the app's real deps) ----

function browserEncode(canvas: CaptureCanvas, type: ScreenshotMimeType, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      (canvas as unknown as HTMLCanvasElement).toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null); // a tainted canvas throws here
    }
  });
}

function browserLoadSvg(svg: string, signal: AbortSignal): Promise<HTMLImageElement> {
  // A data: URL, not a blob: URL. Measured in Chromium (headless 1223): an SVG <foreignObject> image loaded from a
  // blob: URL taints the canvas, the same markup from a data: URL does not.
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (signal.aborted) { reject(new CaptureAborted()); return; }
    const img = new Image();
    const onAbort = () => { img.onload = null; img.onerror = null; img.src = ''; reject(new CaptureAborted()); };
    signal.addEventListener('abort', onAbort, { once: true });
    img.decoding = 'async';
    img.onload = () => { signal.removeEventListener('abort', onAbort); resolve(img); };
    img.onerror = () => { signal.removeEventListener('abort', onAbort); reject(new Error('svg decode failed')); };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export interface BrowserCaptureOptions {
  /** The mounted pitch renderer's capture (PitchRenderer.captureFrame), or null when none is mounted. */
  capturePitch?: (() => PitchFrame | null) | null;
  /** The pitch's live canvas element, punched out of the DOM layer. */
  pitchElement?: Element | null;
  onSnapshotTaken?: () => void;
  timeoutMs?: number;
  /** Aborted when the Report dialog closes. */
  signal?: AbortSignal;
}

/** The app entry point: capture this window with the real DOM, canvas and encoder. */
export function captureClientWindowInBrowser(options: BrowserCaptureOptions = {}): Promise<ReportCaptureResult> {
  const doc = document;
  return captureClientWindow({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    capturePitch: options.capturePitch ?? null,
    pitchElement: options.pitchElement ?? null,
    snapshotDom: (input) => snapshotDom({ doc, ...input }),
    loadSvg: browserLoadSvg,
    createCanvas: (w, h) => {
      const canvas = doc.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      return canvas as unknown as CaptureCanvas;
    },
    encode: browserEncode,
    onSnapshotTaken: options.onSnapshotTaken,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
  });
}
