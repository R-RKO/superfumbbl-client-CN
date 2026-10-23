import { settings } from './settings';
import {
  assetMods,
  beginAssetAssignmentIntent,
  commitAssetAssignments,
  importAssetPack,
  isAssignableAssetPack,
  packSupports,
  type AssetAssignmentCapability,
  type AssetPackAssignments,
  type InstalledAssetPack,
} from './assetMods';
import { t } from '../i18n';

/** The assignable capability slots, in Settings → Art order. Shared by AssetPackSettings.vue and the first-launch
 *  setup wizard (owner 10-06) so a pack imported from either surface is applied the same way. */
export const ASSET_ASSIGNMENT_CAPABILITIES: ReadonlyArray<{ key: AssetAssignmentCapability; label: string }> = [
  { key: 'skillIcons', get label() { return t('assets.assetAssignmentCapabilities.skillIcons'); } },
  { key: 'playerSprites', get label() { return t('assets.assetAssignmentCapabilities.playerSprites'); } },
  { key: 'walkSheets', get label() { return t('assets.assetAssignmentCapabilities.walkSheets'); } },
  { key: 'soundEvents', get label() { return t('assets.assetAssignmentCapabilities.soundEvents'); } },
  { key: 'teamLogos', get label() { return t('assets.assetAssignmentCapabilities.teamLogos'); } }, // owner 09-07
  { key: 'blockDice', get label() { return t('assets.assetAssignmentCapabilities.blockDice'); } },
];

/** Activate then persist a set of pack assignments (the active set is what lands in settings). */
export async function publishAssetAssignments(next: AssetPackAssignments, intent = beginAssetAssignmentIntent()): Promise<boolean> {
  return commitAssetAssignments(next, (active) => {
    settings.assetPackAssignments = active;
    settings.skillIconPackInstallId = active.skillIcons;
  }, intent);
}

/** Labels of the capability slots this pack can fill. */
export function packCapabilityLabels(pack: InstalledAssetPack): string[] {
  return ASSET_ASSIGNMENT_CAPABILITIES.filter((c) => packSupports(pack, c.key)).map((c) => c.label);
}

/** "Use all included": assign the pack to every capability it supplies. False when it could not be activated. */
export async function useWholeAssetPack(pack: InstalledAssetPack, intent = beginAssetAssignmentIntent()): Promise<boolean> {
  if (!isAssignableAssetPack(pack)) return false;
  const next = { ...settings.assetPackAssignments };
  for (const capability of ASSET_ASSIGNMENT_CAPABILITIES) if (packSupports(pack, capability.key)) next[capability.key] = pack.installId;
  return publishAssetAssignments(next, intent);
}

/**
 * Import a .f40kmod through the native picker (the same importer Settings → Art uses). Returns the installed pack
 * when it can be applied (assignable + supplies at least one slot), plus a status line for the surface to show.
 * A cancelled picker returns `{ pack: null, status: '' }`.
 */
export async function importAssetPackForApply(): Promise<{ pack: InstalledAssetPack | null; status: string; error: string }> {
  try {
    const pack = await importAssetPack();
    if (!pack) return { pack: null, status: '', error: assetMods.error };
    const applicable = isAssignableAssetPack(pack) && packCapabilityLabels(pack).length > 0;
    return {
      pack: applicable ? pack : null,
      status: applicable ? t('assets.text.nameVersionInstalled', { name: pack.name, version: pack.version }) : t('assets.text.nameInstalledChooseCapabilities', { name: pack.name }),
      error: '',
    };
  } catch (error) {
    return { pack: null, status: '', error: error instanceof Error ? error.message : String(error) };
  }
}
