/**
 * Optional 3D renderer for the DOM block-dice chooser. Three.js and the GLB are
 * deliberately kept behind this lazily imported module; the ordinary PNG dice
 * path does not pay their startup cost.
 */
import { BLOCK_DIE_SURFACE_COLOURS, type BlockDieSurface } from './blockDieSurface';

export const BLOCK_DICE_MODEL_URL = new URL('../assets/blockdice/super-fumbbl-block-die.glb', import.meta.url).href;
export const BLOCK_DICE_CLIP_DURATION_MS = 1650;

export const BLOCK_DICE_CLIPS = [
  '',
  'roll-to-attacker-down',
  'roll-to-both-down',
  'roll-to-push-back',
  'roll-to-push-back-2',
  'roll-to-defender-stumbles',
  'roll-to-defender-down',
] as const;

export type BlockDiceBasis = Readonly<{
  right: readonly [number, number, number];
  up: readonly [number, number, number];
  normal: readonly [number, number, number];
}>;

/** Model-space face bases from the delivered face-orientations.json. */
export const BLOCK_DICE_SETTLE_BASES: Readonly<Record<number, BlockDiceBasis>> = {
  1: { right: [1, 0, 0], up: [0, 1, 0], normal: [0, 0, 1] },
  2: { right: [0, 0, -1], up: [0, 1, 0], normal: [1, 0, 0] },
  3: { right: [0, 0, 1], up: [0, 1, 0], normal: [-1, 0, 0] },
  4: { right: [-1, 0, 0], up: [0, 1, 0], normal: [0, 0, -1] },
  5: { right: [1, 0, 0], up: [0, 0, -1], normal: [0, 1, 0] },
  6: { right: [1, 0, 0], up: [0, 0, 1], normal: [0, -1, 0] },
};

export function blockDiceClip(result: number): string {
  if (!Number.isInteger(result) || result < 1 || result > 6) throw new Error(`Invalid block-die result: ${result}`);
  return BLOCK_DICE_CLIPS[result]!;
}

export function blockDiceTimeScale(durationMs: number): number {
  return BLOCK_DICE_CLIP_DURATION_MS / Math.max(1, durationMs);
}

export function changedBlockDiceIndices(previous: readonly number[] | null, next: readonly number[]): number[] {
  if (!previous || previous.length !== next.length) return next.map((_value, index) => index);
  return next.flatMap((value, index) => value === previous[index] ? [] : [index]);
}

export interface BlockDiceFallbackState {
  enabled: boolean;
  spectatorClean: boolean;
  catchingUp: boolean;
  reducedMotion: boolean;
  replaySeeking: boolean;
  failed: boolean;
  webglAvailable: boolean;
}

export function blockDicePresentationPath(state: BlockDiceFallbackState): '3d' | 'png' {
  return state.enabled && !state.spectatorClean && !state.catchingUp && !state.reducedMotion
    && !state.replaySeeking && !state.failed && state.webglAvailable ? '3d' : 'png';
}

export interface BlockDiceRuntime {
  readonly canvas: HTMLCanvasElement;
  setCount(count: number): void;
  stopActions(): void;
  playDie(index: number, clipName: string, timeScale: number): void;
  settleDie(index: number, basis: BlockDiceBasis): void;
  update(deltaSeconds: number): void;
  render(): void;
  updateFaceTextures(urls: readonly string[]): Promise<void>;
  /** Owner 10-06: tint the die BODY (every glb material that is not a face material) for the block die surface. */
  setSurface?(surface: BlockDieSurface): void;
  /** Perf (JLeav 1.0.261): move the live canvas + WebGL context into a new host (the block card is re-mounted per
   *  block) instead of building a new context, programs and textures for every block. */
  attach?(host: HTMLElement, slots?: () => readonly BlockDiceSlot[]): void;
  /** Take the canvas out of the DOM and stop observing the host; the context and its GPU resources stay alive. */
  detach?(): void;
  /** Perf (owner 10-21, warm at game load): the GPU work the first draw would otherwise do, as separate steps (compile
   *  the programs, upload each cached face texture) so a caller can run them in idle slots. Draws nothing. */
  prewarmSteps?(): Array<() => void | Promise<void>>;
  dispose(): void;
}

export type BlockDiceRuntimeFactory = (
  /** null = built PARKED (warm-up at game load): no canvas in the DOM until attach. */
  host: HTMLElement | null,
  onFailure: (error: unknown) => void,
  slots?: () => readonly BlockDiceSlot[],
) => Promise<BlockDiceRuntime>;

export interface BlockDiceScheduler {
  now(): number;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(handle: number): void;
}

const browserScheduler: BlockDiceScheduler = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

/** Owner 09-08: where each die sits, in CSS px relative to the host's padding box — the centre of the
 *  matching `.bp-die` button and the cube's on-screen edge length. The row never invents its own spacing. */
export interface BlockDiceSlot { cx: number; cy: number; size: number }

/** Fraction of a die button's inner box the cube face fills (the framed art keeps a little breathing room). */
export const BLOCK_DICE_SLOT_FILL = 0.9;

/** Build slots from the host rect and its die-button rects (DOMRect-shaped inputs; pure, testable). */
export function blockDiceSlotsFromRects(
  host: { left: number; top: number },
  buttons: readonly { left: number; top: number; width: number; height: number }[],
  fill = BLOCK_DICE_SLOT_FILL,
): BlockDiceSlot[] {
  return buttons.map((r) => ({
    cx: r.left - host.left + r.width / 2,
    cy: r.top - host.top + r.height / 2,
    size: Math.max(1, Math.min(r.width, r.height) * fill),
  }));
}

export interface BlockDiceRowOptions {
  runtimeFactory?: BlockDiceRuntimeFactory;
  scheduler?: BlockDiceScheduler;
  onFailure?: (error: unknown) => void;
  onSettled?: () => void;
  /** Current die-button slots; read on every resize/count change so the cubes track the buttons' layout. */
  slots?: () => readonly BlockDiceSlot[];
}

export interface BlockDiceRow {
  readonly canvas: HTMLCanvasElement;
  play(results: readonly number[], durationMs: number, changedIndices?: readonly number[]): void;
  settle(results: readonly number[]): void;
  updateFaceTextures(urls: readonly string[]): Promise<void>;
  /** Owner 10-06: the block die surface — body tint (the face art itself comes through updateFaceTextures). */
  setSurface(surface: BlockDieSurface): void;
  /** Perf (JLeav 1.0.261): re-home the parked row in the next block card's dice host (same context, no rebuild).
   *  The next play() starts from a clean slate (no carried "previous results"). */
  attach(host: HTMLElement, slots?: () => readonly BlockDiceSlot[]): void;
  /** Park the row between blocks: animation cancelled, canvas out of the DOM, GPU resources kept for the next block. */
  detach(): void;
  /** The host the canvas currently sits in (null while parked). */
  readonly host: HTMLElement | null;
  /** Perf (owner 10-21): run the runtime's prewarm steps (program compile, face uploads) one at a time, each after
   *  `next()` resolves true; stops (resolving false) when `next()` resolves false, the row is disposed or attached
   *  (the first draw then does the rest, as before). Draws nothing. */
  prewarm(next?: () => Promise<boolean>): Promise<boolean>;
  dispose(): void;
}

class BlockDiceRowController implements BlockDiceRow {
  readonly canvas: HTMLCanvasElement;
  private previousResults: number[] | null = null;
  private currentResults: number[] = [];
  private frame = 0;
  private animationStarted = 0;
  private animationDuration = 0;
  private lastFrameAt = 0;
  private disposed = false;
  host: HTMLElement | null;

  constructor(
    private readonly runtime: BlockDiceRuntime,
    private readonly scheduler: BlockDiceScheduler,
    private readonly onSettled?: () => void,
    private readonly onFailure?: (error: unknown) => void,
    host: HTMLElement | null = null,
  ) {
    this.canvas = runtime.canvas;
    this.host = host;
  }

  attach(host: HTMLElement, slots?: () => readonly BlockDiceSlot[]): void {
    if (this.disposed) return;
    try {
      this.cancelAnimation();
      this.previousResults = null;
      this.runtime.attach?.(host, slots);
      this.host = host;
    } catch (error) {
      this.fail(error);
    }
  }

  detach(): void {
    if (this.disposed) return;
    this.cancelAnimation();
    this.previousResults = null;
    this.host = null;
    try {
      this.runtime.stopActions();
      this.runtime.detach?.();
    } catch (error) {
      this.fail(error);
    }
  }

  play(results: readonly number[], durationMs: number, changedIndices?: readonly number[]): void {
    try {
      this.assertResults(results);
      if (this.disposed) return;
      this.cancelAnimation();
      this.currentResults = [...results];
      const changed = changedIndices
        ? [...new Set(changedIndices)].filter((index) => index >= 0 && index < results.length)
        : changedBlockDiceIndices(this.previousResults, results);
      this.previousResults = [...results];
      this.runtime.setCount(results.length);
      this.runtime.stopActions();
      results.forEach((result, index) => this.runtime.settleDie(index, BLOCK_DICE_SETTLE_BASES[result]!));
      const timeScale = blockDiceTimeScale(durationMs);
      changed.forEach((index) => this.runtime.playDie(index, blockDiceClip(results[index]!), timeScale));
      this.runtime.render();
      if (changed.length === 0) {
        this.onSettled?.();
        return;
      }
      this.animationStarted = this.scheduler.now();
      this.lastFrameAt = this.animationStarted;
      this.animationDuration = Math.max(1, durationMs);
      this.frame = this.scheduler.requestFrame(this.tick);
    } catch (error) {
      this.fail(error);
    }
  }

  settle(results: readonly number[]): void {
    try {
      this.assertResults(results);
      if (this.disposed) return;
      this.cancelAnimation();
      this.currentResults = [...results];
      this.previousResults = [...results];
      this.runtime.setCount(results.length);
      this.runtime.stopActions();
      results.forEach((result, index) => this.runtime.settleDie(index, BLOCK_DICE_SETTLE_BASES[result]!));
      this.runtime.render();
    } catch (error) {
      this.fail(error);
    }
  }

  updateFaceTextures(urls: readonly string[]): Promise<void> {
    if (this.disposed) return Promise.resolve();
    return this.runtime.updateFaceTextures(urls).then(() => {
      if (!this.disposed) this.runtime.render();
    }).catch((error) => {
      this.fail(error);
    });
  }

  setSurface(surface: BlockDieSurface): void {
    if (this.disposed || !this.runtime.setSurface) return;
    try {
      this.runtime.setSurface(surface);
      this.runtime.render();
    } catch (error) {
      this.fail(error);
    }
  }

  async prewarm(next: () => Promise<boolean> = async () => true): Promise<boolean> {
    if (this.disposed || !this.runtime.prewarmSteps) return false;
    let steps: Array<() => void | Promise<void>>;
    try {
      steps = this.runtime.prewarmSteps();
    } catch (error) {
      this.fail(error);
      return false;
    }
    for (const step of steps) {
      if (!(await next()) || this.disposed || this.host) return false;
      try {
        await step();
      } catch (error) {
        this.fail(error);
        return false;
      }
    }
    return !this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelAnimation();
    this.runtime.stopActions();
    this.runtime.dispose();
  }

  private readonly tick = (now: number): void => {
    try {
      if (this.disposed) return;
      const elapsed = now - this.animationStarted;
      const delta = Math.max(0, now - this.lastFrameAt) / 1000;
      this.lastFrameAt = now;
      this.runtime.update(delta);
      this.runtime.render();
      if (elapsed < this.animationDuration) {
        this.frame = this.scheduler.requestFrame(this.tick);
        return;
      }
      this.frame = 0;
      this.runtime.stopActions();
      this.currentResults.forEach((result, index) => this.runtime.settleDie(index, BLOCK_DICE_SETTLE_BASES[result]!));
      // preserveDrawingBuffer keeps this final frame visible with no idle RAF.
      this.runtime.render();
      this.onSettled?.();
    } catch (error) {
      this.fail(error);
    }
  };

  private fail(error: unknown): void {
    this.cancelAnimation();
    this.onFailure?.(error);
  }

  private cancelAnimation(): void {
    if (this.frame) this.scheduler.cancelFrame(this.frame);
    this.frame = 0;
  }

  private assertResults(results: readonly number[]): void {
    if (results.length < 1 || results.length > 3) throw new Error(`Block dice row requires 1-3 results, got ${results.length}`);
    results.forEach(blockDiceClip);
  }
}

export async function createBlockDiceRow(host: HTMLElement | null, options: BlockDiceRowOptions = {}): Promise<BlockDiceRow> {
  const onFailure = options.onFailure ?? (() => undefined);
  try {
    const runtime = await (options.runtimeFactory ?? createThreeBlockDiceRuntime)(host, onFailure, options.slots);
    return new BlockDiceRowController(runtime, options.scheduler ?? browserScheduler, options.onSettled, onFailure, host);
  } catch (error) {
    onFailure(error);
    throw error;
  }
}

export type LoadedModel = { THREE: typeof import('three'); gltf: Awaited<ReturnType<InstanceType<typeof import('three/examples/jsm/loaders/GLTFLoader.js')['GLTFLoader']>['loadAsync']>> };
let sharedModelPromise: Promise<LoadedModel> | null = null;

/** Shared by the chooser row and the on-pitch action dice (owner 09-14): one Three.js + GLB load per session. */
export function loadSharedBlockDiceModel(): Promise<LoadedModel> {
  if (!sharedModelPromise) {
    sharedModelPromise = Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
    ]).then(async ([THREE, { GLTFLoader }]) => ({ THREE, gltf: await new GLTFLoader().loadAsync(BLOCK_DICE_MODEL_URL) }))
      .catch((error) => {
        sharedModelPromise = null;
        throw error;
      });
  }
  return sharedModelPromise;
}

let loggedBlockDieMaterials = false;
/** Owner 10-06: the white surface's body look, by glb material name (super-fumbbl-block-die.glb). The red corner
 *  ticks keep their colour on both surfaces — the 2D white plate keeps its red ticks too. */
export const WHITE_BODY_TINTS: Readonly<Record<string, { color: string; metalness: number; roughness: number } | null>> = {
  'Dark gunmetal shell': { color: '#d8d3c7', metalness: 0.2, roughness: 0.45 },
  'Graphite frame': { color: '#bdb7ab', metalness: 0.3, roughness: 0.4 },
  'Steel chamfer': { color: '#e6e2da', metalness: 0.55, roughness: 0.3 },
  'Black inset face': { color: BLOCK_DIE_SURFACE_COLOURS.white.fill, metalness: 0.05, roughness: 0.5 },
  'Red corner ticks': null,
};
const WHITE_BODY_FALLBACK = { color: BLOCK_DIE_SURFACE_COLOURS.white.fill, metalness: 0.1, roughness: 0.5 };

/** Perf (JLeav 1.0.261): the delivered face art is 1254 px square; the cube face never draws above ~110 device px, so
 *  the GPU copy is capped here (mipmapped, so the sampled level is the same). 11 full-size uploads per block were
 *  ~68 MB of texture traffic on every block roll. */
export const BLOCK_DICE_FACE_MAX_PX = 512;
/** Face textures kept per row (3 face sets: plain, home, away). Older unused sets are released. */
export const BLOCK_DICE_FACE_CACHE_MAX = 15;
/** Warm-up compile poll: 10 ms apart, at most this many (~3 s) before the warm-up gives up (Astra r3: a failure). */
export const BLOCK_DICE_COMPILE_MAX_POLLS = 300;

export interface BlockFaceTextureCache<T> {
  /** The texture for `url`: the cached one (no load), else a single shared load. */
  get(url: string): Promise<T | null>;
  /** The textures now on the dice (never evicted), then trims the cache to its limit. */
  setApplied(applied: ReadonlySet<T>): void;
  /** Astra r2: the newest REQUESTED face set: never evicted or released while it is wanted, even before it is applied. */
  want(urls: readonly string[]): void;
  /** Astra r1: drop `urls` (a superseded face set) except those in `keep` or on the dice. A settled texture is released
   *  now; a load still in flight is released when it completes. */
  drop(urls: readonly string[], keep: ReadonlySet<string>): void;
  /** How many urls are cached (settled or loading). */
  readonly size: number;
  /** The urls whose textures are settled in the cache now (the warm-up queues their uploads). */
  urls(): string[];
  /** The texture the cache still OWNS for `url` (settled, not released), else null - read at upload time, so a queued
   *  warm-up step never touches a texture evicted / released since it was queued (Astra r1 on 7e3febf9b). */
  peek(url: string): T | null;
  dispose(): void;
}

/** Perf (JLeav 1.0.261): url -> texture cache for the block-dice faces, least recently used first. A url is loaded
 *  once per row lifetime; textures in use are never released; a load still in flight is never evicted. */
export function createBlockFaceTextureCache<T>(options: {
  load(url: string): Promise<T | null>;
  release(texture: T): void;
  max?: number;
}): BlockFaceTextureCache<T> {
  const max = options.max ?? BLOCK_DICE_FACE_CACHE_MAX;
  const pending = new Map<string, Promise<T | null>>();
  const settled = new Map<string, T | null>();
  let applied: ReadonlySet<T> = new Set<T>();
  let wanted: ReadonlySet<string> = new Set<string>();
  let disposed = false;
  const evict = () => {
    for (const url of [...pending.keys()]) {
      if (pending.size <= max) break;
      if (!settled.has(url) || wanted.has(url)) continue;
      const texture = settled.get(url) ?? null;
      if (texture && applied.has(texture)) continue;
      pending.delete(url);
      settled.delete(url);
      if (texture) options.release(texture);
    }
  };
  return {
    get(url) {
      const cached = pending.get(url);
      if (cached) {
        pending.delete(url);
        pending.set(url, cached);
        return cached;
      }
      const load = options.load(url);
      pending.set(url, load);
      load.then((texture) => {
        if (disposed || pending.get(url) !== load) { if (texture) options.release(texture); return; }
        settled.set(url, texture);
        evict(); // Astra r1: a late settle never leaves the cache above its limit
      }, () => { if (pending.get(url) === load) pending.delete(url); });
      return load;
    },
    want(urls) {
      wanted = new Set(urls);
    },
    drop(urls, keep) {
      for (const url of urls) {
        if (keep.has(url) || wanted.has(url) || !pending.has(url)) continue;
        const texture = settled.get(url);
        if (texture && applied.has(texture)) continue;
        pending.delete(url); // an in-flight load now finds itself superseded and releases its texture on completion
        if (settled.has(url)) {
          settled.delete(url);
          if (texture) options.release(texture);
        }
      }
    },
    setApplied(next) {
      applied = next;
      evict();
    },
    get size() { return pending.size; },
    urls() {
      return [...settled.entries()].filter(([, texture]) => texture != null).map(([url]) => url);
    },
    peek(url) {
      return disposed ? null : settled.get(url) ?? null;
    },
    dispose() {
      disposed = true;
      for (const texture of settled.values()) if (texture) options.release(texture);
      settled.clear();
      pending.clear();
      applied = new Set<T>();
    },
  };
}

/** Decode a face image off the main thread (ImageBitmap) at most BLOCK_DICE_FACE_MAX_PX on its longest side; null
 *  when the platform has no fetch/createImageBitmap or the decode fails (the caller then uses the plain loader). */
async function decodeFaceBitmap(url: string, maxPx = BLOCK_DICE_FACE_MAX_PX): Promise<ImageBitmap | null> {
  if (typeof fetch !== 'function' || typeof createImageBitmap !== 'function') return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const full = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'default' });
    const longest = Math.max(full.width, full.height);
    if (longest <= maxPx) return full;
    const scale = maxPx / longest;
    try {
      return await createImageBitmap(full, {
        resizeWidth: Math.max(1, Math.round(full.width * scale)),
        resizeHeight: Math.max(1, Math.round(full.height * scale)),
        resizeQuality: 'high',
        premultiplyAlpha: 'none',
      });
    } finally {
      full.close();
    }
  } catch {
    return null;
  }
}

async function createThreeBlockDiceRuntime(
  initialHost: HTMLElement | null,
  onFailure: (error: unknown) => void,
  initialSlots?: () => readonly BlockDiceSlot[],
): Promise<BlockDiceRuntime> {
  let host: HTMLElement | null = initialHost;
  let slots = initialSlots;
  const { THREE, gltf } = await loadSharedBlockDiceModel();
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'bp-dice-3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  initialHost?.prepend(canvas);

  const scene = new THREE.Scene();
  // Owner 09-08: the scene is laid out in CSS PIXELS of the host (x right, y down via negative world y) so each
  // cube can be parked exactly on its `.bp-die` button; the orthographic camera maps 1 world unit = 1 px.
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 1, 4000);
  camera.position.set(0, 0, 2000);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x657589, 2));
  const key = new THREE.DirectionalLight(0xfff8ec, 3);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xaddcff, 1);
  rim.position.set(3, 1, -2);
  scene.add(rim);

  // Clone resources once for this controller. Its 1-3 scene clones then share
  // geometry/materials, while disposal cannot invalidate the lifetime GLTF cache.
  const template = gltf.scene.clone(true);
  const ownedGeometries = new Set<import('three').BufferGeometry>();
  const ownedMaterials = new Set<import('three').Material>();
  const embeddedTextures = new Map<string, import('three').Texture>();
  template.traverse((object) => {
    const mesh = object as import('three').Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    ownedGeometries.add(mesh.geometry);
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => {
      const copy = material.clone();
      const mapped = copy as import('three').MeshStandardMaterial;
      if (mapped.map) {
        mapped.map = mapped.map.clone();
        mapped.map.needsUpdate = true;
        embeddedTextures.set(mapped.name, mapped.map);
      }
      ownedMaterials.add(copy);
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0]!;
  });

  const clips = new Map(gltf.animations.map((clip) => [clip.name, clip]));
  const edgeBox = new THREE.Box3().setFromObject(template);
  const cubeEdge = Math.max(1e-6, Math.max(edgeBox.max.x - edgeBox.min.x, edgeBox.max.y - edgeBox.min.y, edgeBox.max.z - edgeBox.min.z));
  const dice = Array.from({ length: 3 }, (_unused, index) => {
    const object = index === 0 ? template : template.clone(true);
    const holder = new THREE.Group();
    holder.add(object);
    scene.add(holder);
    return { holder, object, mixer: new THREE.AnimationMixer(object) };
  });
  // Face textures by url: a parked row keeps them on the GPU, so the next block (or the other side's set) re-faces the
  // dice without a decode or an upload.
  const releaseFace = (texture: import('three').Texture) => {
    const image = texture.image as { close?: () => void } | null;
    texture.dispose();
    image?.close?.();
  };
  const faces = createBlockFaceTextureCache<import('three').Texture>({
    load: async (url) => {
      const bitmap = await decodeFaceBitmap(url);
      const texture = bitmap
        ? new THREE.Texture(bitmap as unknown as HTMLImageElement)
        : await new THREE.TextureLoader().loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.needsUpdate = true;
      return texture;
    },
    release: releaseFace,
  });
  let count = 1;
  let disposed = false;
  let textureGeneration = 0;
  let appliedTextureGeneration = 0;
  let latestFaceUrls: ReadonlySet<string> = new Set();
  // Astra r1 (draw gate): the canvas draws only while it sits in a host, holds the CURRENT block's results (set by a
  // play/settle since the last attach) and no face update is pending. Parked, freshly re-homed, or waiting on a face
  // set, it stays blank, so neither the previous block's dice nor its faces can show through the PNG buttons. The
  // first draw also uploads the face art the row shows, never the GLB's embedded faces first.
  let hasResults = false;
  const canDraw = () => !disposed && host != null && hasResults && appliedTextureGeneration === textureGeneration;
  const draw = () => { if (canDraw()) renderer.render(scene, camera); };

  /** Fallback slots when the host supplies none: 60 px dice on a 7 px gap, left-packed like the button row. */
  const fallbackSlots = (): BlockDiceSlot[] => {
    const size = 60 * BLOCK_DICE_SLOT_FILL;
    return Array.from({ length: count }, (_u, i) => ({ cx: 30 + i * 67, cy: Math.max(1, host?.clientHeight ?? 0) / 2, size }));
  };
  const layout = () => {
    const current = (slots?.() ?? []).slice(0, count);
    const placed = current.length >= count ? current : fallbackSlots();
    dice.forEach((die, index) => {
      const slot = placed[index];
      if (!slot || index >= count) return;
      die.holder.position.set(slot.cx, -slot.cy, 0);
      die.holder.scale.setScalar(slot.size / cubeEdge);
    });
  };
  const resize = () => {
    if (disposed || !host) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.left = 0;
    camera.right = width;
    camera.top = 0;
    camera.bottom = -height;
    camera.updateProjectionMatrix();
    layout();
    draw();
  };
  const observer = new ResizeObserver(resize);
  if (initialHost) observer.observe(initialHost);

  const fail = (event: Event) => {
    event.preventDefault();
    onFailure(new Error(event.type === 'webglcontextlost' ? '3D block-dice WebGL context lost' : '3D block-dice WebGL context restored'));
  };
  canvas.addEventListener('webglcontextlost', fail);
  canvas.addEventListener('webglcontextrestored', fail);

  const materialForName = (name: string): import('three').MeshStandardMaterial | null => {
    for (const material of ownedMaterials) if (material.name === name) return material as import('three').MeshStandardMaterial;
    return null;
  };
  const faceMaterials = [
    ['Super FUMBBL client attacker-down'],
    ['Super FUMBBL client both-down'],
    ['Super FUMBBL client push-back', 'Super FUMBBL client push-back-2'],
    ['Super FUMBBL client defender-stumbles'],
    ['Super FUMBBL client defender-down'],
  ];
  // Owner 10-06: the body materials (everything that is not a face) remember their glb look so the black surface
  // restores it exactly; their names are logged once per session.
  const faceMaterialNames = new Set(faceMaterials.flat());
  const bodyOriginals = new Map<import('three').Material, { color: import('three').Color; metalness: number; roughness: number }>();
  for (const material of ownedMaterials) {
    if (faceMaterialNames.has(material.name)) continue;
    const standard = material as import('three').MeshStandardMaterial;
    if (standard.color) bodyOriginals.set(material, { color: standard.color.clone(), metalness: standard.metalness, roughness: standard.roughness });
  }
  if (!loggedBlockDieMaterials) {
    loggedBlockDieMaterials = true;
    console.info(`[block-dice-3d] glb materials — body: ${[...bodyOriginals.keys()].map((m) => m.name).join(', ')}; faces: ${[...faceMaterialNames].join(', ')}`);
  }

  const runtime: BlockDiceRuntime = {
    canvas,
    setCount(nextCount) {
      hasResults = true; // only play()/settle() set the count: the dice now carry the current block's results
      count = Math.max(1, Math.min(3, nextCount));
      dice.forEach((die, index) => { die.holder.visible = index < count; });
      resize(); // re-reads the button slots — the buttons are re-rendered for the new count by the host

    },
    stopActions() {
      dice.forEach((die) => die.mixer.stopAllAction());
    },
    playDie(index, clipName, timeScale) {
      const die = dice[index];
      const clip = clips.get(clipName);
      if (!die || !clip) throw new Error(`Missing block-die clip: ${clipName}`);
      die.object.position.set(0, 0, 0);
      die.object.quaternion.identity();
      die.mixer.stopAllAction();
      const action = die.mixer.clipAction(clip);
      action.reset().setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.timeScale = timeScale;
      action.play();
    },
    settleDie(index, basis) {
      const die = dice[index];
      if (!die) return;
      die.mixer.stopAllAction();
      die.object.position.set(0, 0, 0);
      const matrix = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...basis.right),
        new THREE.Vector3(...basis.up),
        new THREE.Vector3(...basis.normal),
      );
      die.object.quaternion.setFromRotationMatrix(matrix.transpose());
    },
    update(deltaSeconds) {
      dice.slice(0, count).forEach((die) => die.mixer.update(deltaSeconds));
    },
    render() {
      draw();
    },
    attach(nextHost, nextSlots) {
      if (disposed) return;
      if (host !== nextHost) {
        observer.disconnect();
        host = nextHost;
        observer.observe(nextHost);
      }
      slots = nextSlots ?? slots;
      // the previous block's results are void: blank until this card's play/settle (and its faces) arrive
      hasResults = false;
      dice.forEach((die) => die.mixer.stopAllAction());
      renderer.clear();
      if (canvas.parentElement !== nextHost) nextHost.prepend(canvas);
      resize();
    },
    detach() {
      if (disposed) return;
      dice.forEach((die) => die.mixer.stopAllAction());
      observer.disconnect();
      host = null;
      // Blank the preserved buffer; nothing draws while parked (canDraw needs a host and fresh results).
      hasResults = false;
      renderer.clear();
      canvas.remove();
    },
    setSurface(surface) {
      for (const material of ownedMaterials) {
        if (faceMaterialNames.has(material.name)) continue;
        const standard = material as import('three').MeshStandardMaterial;
        const original = bodyOriginals.get(material);
        if (!original || !standard.color) continue;
        const tint = surface !== 'white' ? null : material.name in WHITE_BODY_TINTS ? WHITE_BODY_TINTS[material.name]! : WHITE_BODY_FALLBACK;
        if (!tint) {
          standard.color.copy(original.color);
          standard.metalness = original.metalness;
          standard.roughness = original.roughness;
        } else {
          standard.color.set(tint.color);
          standard.metalness = tint.metalness;
          standard.roughness = tint.roughness;
        }
        standard.needsUpdate = true;
      }
    },
    prewarmSteps() {
      if (disposed) return [];
      // Like three's compileAsync (KHR_parallel_shader_compile: the link check never blocks the main thread), but safe to
      // retire (Astra r2): three's own poll reads the material properties out of band and throws once the row is
      // disposed, never settling. This poll checks `disposed` first, catches, and is bounded - it always settles.
      // Astra r3: only a READY link is success - a timeout or a poll error (row not disposed) REJECTS, so the warm-up
      // fails (quiet dispose) and the first block builds lazily behind the PNG dice; never an unready program drawn.
      const compile = () => new Promise<void>((resolve, reject) => {
        if (disposed) { resolve(); return; }
        const compiled = renderer.compile(scene, camera) as unknown;
        const pending = new Set<unknown>(compiled instanceof Set ? compiled : []);
        let parallel = false;
        try { parallel = renderer.extensions?.get?.('KHR_parallel_shader_compile') != null; } catch { parallel = false; }
        let polls = 0;
        const poll = () => {
          if (disposed) { resolve(); return; }
          try {
            for (const material of [...pending]) {
              const program = (renderer.properties.get(material as object) as { currentProgram?: { isReady?: () => boolean } } | undefined)?.currentProgram;
              if (!program || typeof program.isReady !== 'function' || program.isReady()) pending.delete(material);
            }
          } catch (error) {
            if (disposed) resolve(); // retired mid-compile: prewarm sees the disposed row and stops
            else reject(error);
            return;
          }
          if (pending.size === 0) { resolve(); return; }
          if (++polls > BLOCK_DICE_COMPILE_MAX_POLLS) { reject(new Error('3D block-dice shader compile timed out')); return; }
          setTimeout(poll, 10);
        };
        if (parallel) poll();
        else setTimeout(poll, 10);
      });
      // Astra r1: each step re-reads the cache by url, so a texture evicted / released between idle slots (an art
      // change with the cache full) is skipped, never uploaded.
      const uploads = faces.urls().map((url) => () => {
        if (disposed) return;
        const texture = faces.peek(url);
        if (texture) renderer.initTexture(texture);
      });
      return [compile, ...uploads];
    },
    async updateFaceTextures(urls) {
      if (urls.length !== 5) throw new Error(`Expected five block-face URLs, got ${urls.length}`);
      const generation = ++textureGeneration;
      latestFaceUrls = new Set(urls);
      faces.want(urls); // Astra r2: the newest set survives every trim until it is applied
      const loaded = await Promise.allSettled(urls.map((url) => faces.get(url)));
      if (disposed) return;
      if (generation !== textureGeneration) {
        // Astra r1: a superseded set is dropped (what the newest set or the dice still use stays cached)
        faces.drop(urls, latestFaceUrls);
        return;
      }
      const applied = new Set<import('three').Texture>();
      loaded.forEach((result, faceIndex) => {
        const texture = result.status === 'fulfilled' ? result.value : null;
        if (texture) applied.add(texture);
        for (const name of faceMaterials[faceIndex]!) {
          const material = materialForName(name);
          if (!material) continue;
          const next = texture ?? embeddedTextures.get(name) ?? null;
          // Only a change of map PRESENCE / colour space changes the shader; a plain swap reuses the program.
          const reprogram = (material.map == null) !== (next == null) || material.map?.colorSpace !== next?.colorSpace;
          material.map = next;
          material.emissiveMap = next; // the GLB's emissive slot carries the symbol too — a swapped face must not ghost the old art
          if (reprogram) material.needsUpdate = true;
        }
      });
      faces.setApplied(applied);
      appliedTextureGeneration = generation;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', fail);
      canvas.removeEventListener('webglcontextrestored', fail);
      dice.forEach((die) => {
        die.mixer.stopAllAction();
        die.mixer.uncacheRoot(die.object);
      });
      faces.dispose();
      embeddedTextures.forEach((texture) => texture.dispose());
      ownedMaterials.forEach((material) => material.dispose());
      ownedGeometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
  // construction-time layout only (not a block's results, so nothing draws)
  dice.forEach((die, index) => { die.holder.visible = index < count; });
  resize();
  return runtime;
}
