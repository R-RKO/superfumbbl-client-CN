// Owner 10-22 ("Option A"): Esc menu > "New client window". Shown only when Settings > General > "Allow a second client
// window" is on AND the shell has the OPTIONAL `launch_second_instance` command (shell-api.json `_about`): an older
// shell rejects the probe as an unknown command and the row stays hidden (fail-open, no minimum-shell bump).
import { ref } from 'vue';

/** True once this shell answered the probe: it can start a second client. */
export const secondClientSupported = ref(false);

function inTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/** The Esc-menu row's gate. */
export function secondClientRowVisible(settingOn: boolean, supported: boolean): boolean {
  return settingOn === true && supported === true;
}

/** Asks the shell once whether it has launch_second_instance (`probe: true` never starts anything). Never throws. */
export async function detectSecondClient(): Promise<boolean> {
  if (!inTauri()) { secondClientSupported.value = false; return false; }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    secondClientSupported.value = (await invoke<boolean>('launch_second_instance', { probe: true })) === true;
  } catch {
    secondClientSupported.value = false;
  }
  return secondClientSupported.value;
}

/** Starts a second client (the shell spawns its own executable with no arguments). `flush` saves pending settings
 *  first so the new process reads the setting from disk. Returns null on success, else the reason to show. */
export async function launchSecondClient(flush: () => Promise<void>): Promise<string | null> {
  try { await flush(); } catch { /* the shell re-reads the file and refuses if the setting is not saved */ }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke<boolean>('launch_second_instance', { probe: false });
    return null;
  } catch (error) {
    const text = typeof error === 'string' ? error : (error as Error)?.message;
    return text || 'Could not start a second client window.';
  }
}
