import { Assets, Texture } from 'pixi.js';
import { textureParserFor } from './artPack';

/** Load an INSTALLED (mod pack / user files) image as a texture. Shared by every pitch surface that draws pack art
 *  by url: skill icons and player sprites (skillIcons.ts), the block die faces and the on-pitch block result
 *  (renderer.ts).
 *
 *  Native asset URLs deliberately end in an opaque integrity token rather than a filename
 *  (`http://f40kmod.localhost/asset/{install}/{token}`). Pixi selects its default image loader by URL extension, so
 *  a bare `Assets.load(url)` warns and RESOLVES null without ever fetching these validated PNGs - it does not
 *  reject. The parser is pinned here, and a null / undecoded result is turned into a rejection. */
export async function loadInstalledTexture(url: string): Promise<Texture> {
  const texture = await Assets.load<Texture>({ src: url, parser: textureParserFor(url) });
  if (!(texture instanceof Texture) || !texture.source) {
    throw new Error('Installed presentation texture could not be decoded');
  }
  return texture;
}

/** Astra round 2: installed textures are shared by url (one pack file bound to a skill AND a block-die face is one
 *  url, one Pixi texture). A consumer that retires a url (`Assets.unload`, which destroys the texture) must not do so
 *  while another consumer still draws it. Each consumer publishes the urls it currently holds under its own name;
 *  `installedUrlHeldBy` answers for everyone else. */
const heldInstalledUrls = new Map<string, ReadonlySet<string>>();

/** Replace the set of installed urls `consumer` currently holds (an empty list releases them all). */
export function holdInstalledUrls(consumer: string, urls: Iterable<string>): void {
  const next = new Set([...urls].filter(Boolean));
  if (next.size) heldInstalledUrls.set(consumer, next);
  else heldInstalledUrls.delete(consumer);
}

/** Whether any consumer other than `except` holds `url`. */
export function installedUrlHeldBy(url: string, except?: string): boolean {
  for (const [consumer, urls] of heldInstalledUrls) if (consumer !== except && urls.has(url)) return true;
  return false;
}

/** The size that fits a texture inside a `box` x `box` square with its aspect ratio kept (a pack face may be any
 *  size). A square texture fills the box exactly. */
export function fitInSquare(texture: { width: number; height: number }, box: number): { width: number; height: number } {
  const long = Math.max(texture.width, texture.height);
  if (!(long > 0)) return { width: box, height: box };
  return { width: (texture.width / long) * box, height: (texture.height / long) * box };
}
