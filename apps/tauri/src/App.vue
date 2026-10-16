<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch, watchEffect, defineAsyncComponent, type Component, type ShallowRef } from 'vue';
import { createIntroWatchdog } from './introWatchdog';
import SpectateView from './views/SpectateView.vue';
import WaitingBoardView from './views/WaitingBoardView.vue';
// Owner 09-12: FUMBBL Classic is a fork-edition feature. The public export omits ClassicView.vue entirely (see
// public-export.exclude); the glob tolerates the missing file, so the public build carries no Classic code.
const classicModules = import.meta.glob('./views/ClassicView.vue');
const ClassicView = FORK_EDITION && classicModules['./views/ClassicView.vue']
  ? defineAsyncComponent(classicModules['./views/ClassicView.vue'] as () => Promise<{ default: Component }>)
  : null;
// The FUMBBL.COM blade (FUMBBL website, docked; owner 10-05) - in every edition since 10-06. Lazy: the pane's code loads
// only when the blade is opened.
const fumbblHomeModules = import.meta.glob('./views/FumbblHomePane.vue');
const FumbblHomePane = fumbblHomeModules['./views/FumbblHomePane.vue']
  ? defineAsyncComponent(fumbblHomeModules['./views/FumbblHomePane.vue'] as () => Promise<{ default: Component }>)
  : null;
// Owner 10-08: the floating FUMBBL window (the same site, small, over other blades / a game / a replay). Gated exactly
// like the blade: it exists only where its module is in the bundle, and only the blade's own button can turn it on.
// NOT an async component: it is loaded when the blade is opened and then mounts synchronously, so the pane's unmount
// and this window's mount share one tick and the site is handed over without a hide (game/fumbblHome.ts homeSurface).
const fumbblFloatModules = import.meta.glob('./components/FumbblFloat.vue');
const FumbblFloat: ShallowRef<Component | null> = shallowRef(null);
function loadFumbblFloat(): void {
  const load = fumbblFloatModules['./components/FumbblFloat.vue'] as (() => Promise<{ default: Component }>) | undefined;
  if (!load || FumbblFloat.value) return;
  void load().then((module) => { FumbblFloat.value = module.default; }).catch(() => undefined);
}
import ProtocolConsole from './views/ProtocolConsole.vue';
import DevPanel from './views/DevPanel.vue';
import PlayView from './views/console/PlayView.vue';
import TeamBuilderView from './views/console/TeamBuilderView.vue';
import TournamentsView from './views/console/TournamentsView.vue';
import StatisticsView from './views/console/StatisticsView.vue';
import SpectateBrowserView from './views/console/SpectateBrowserView.vue';
import RejoinProgressModal from './views/console/play/RejoinProgressModal.vue';
import ReplayLauncherView from './views/ReplayLauncherView.vue';
import AssetPackSettings from './components/AssetPackSettings.vue';
import AccountSettings from './components/AccountSettings.vue';
import { FORK_EDITION } from './game/edition';
import FirstOpenLegalNotice from './components/FirstOpenLegalNotice.vue';
import FirstOpenContributions from './components/FirstOpenContributions.vue';
import ClientTour from './components/ClientTour.vue';
import { COLORBLIND_FILTER_MODES, COLORBLIND_MATRICES, colorblindCssFilter } from './game/colorblindFilters';
import { CLIENT_TOUR_VERSION, shouldStartClientTour } from './game/clientTour';
import type { ClientTourHost } from './game/clientTourController';
import FirstLaunchSetup from './components/FirstLaunchSetup.vue';
import { completeSetupWizard, setupWizardNeeded } from './game/setupWizard';
import { openExternal } from './game/openExternal';
import { UI_FONTS } from './game/uiFonts';
import { matchDisplayLabel, measuredRefreshHz, refreshDisplayRate, setDisplayRatePolling, trackDisplayRate } from './game/displayRefreshRate';
import DisplayCaps from './components/DisplayCaps.vue';
import BetaLaunchSplash from './components/BetaLaunchSplash.vue';
import SettingsCategoryNav from './components/SettingsCategoryNav.vue';
import FieldManual from './components/FieldManual.vue';
import BugReportModal from './components/BugReportModal.vue';
import { bladeLabel, createShellReportHost, rememberWireLogFile } from './game/bugReportHost';
import { onReportOwnedKey } from './game/reportModalKeys';
import { detectDevMode } from './game/devMode';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { fetchLatestRelease, inAppUpdaterEnabled, MENU_RETURN_UPDATE_CHECK_DELAY_MS, PUBLIC_RELEASES_REPO, shouldCheckForUpdateOnMenuReturn, updateAvailable } from './game/updateCheck';
import { updateNotesText } from './game/updateNotes';
import { artPack, formatMb, syncArtPack, tauriArtPackHost, webArtPackHost } from './game/artPack';
import { decideAppPatch, installAppPatch, restartIntoPatch, shellUpdateAvailable, tauriAppPatchHost, useBuiltInVersion, versionLine, type AppPatchHost, type AppPatchOffer, type AppPatchStatus } from './game/appPatch';
import { parseSpectateSecret, presenceFor } from './game/discordPresence';
import { CONFIRMATION_SETTING_ROWS } from './game/confirmationSettings';
import { CONTROL_ACTIONS, activeInput, isPadOnlyAction, connectedPads, padShortName, bodyCursorHider, createInputSwitcher, legacyCollisionNote, mouseButtonInput, actionsForInput, controlAction, controllerInputLabel, createControllerRouter, dispatchControlAction, findBindingConflicts, getBinding, isBindingEditable, nextInCycle, registerActionHandler, resetControlBindings, setBinding, type BindingMethod, type BindingSlot, type ControlActionId } from './game/controls';
import { CROSSHAIR_SPEED_MAX, CROSSHAIR_SPEED_MIN } from './game/crosshair';
import { CONTROLLER_SUPPORT_NOTICE, CONTROLLER_SUPPORT_NOTICE_BUTTON, CONTROLLER_SUPPORT_NOTICE_TITLE, createControllerOptIn, createControllerRuntime, effectiveInputMethod } from './game/controllerRuntime';
import { cornerNotice, hideControllerNotices, hideCornerNotice, showCornerNotice } from './game/cornerNotice';
import PadOverlay from './components/PadOverlay.vue';
import { browserHapticPads, hapticForSound } from './game/haptics';
import { STICK_DEADZONE_MAX, STICK_DEADZONE_MIN, type PadEvent } from './game/gamepad';
import { botConfigBaseUrl, controlBindingConflict, flushSettingsFile, forkRegisterUrl, hotkeyConflict, keyLabel, settings, type RebindableKey, resolveJoinCreds, prepareSelectedSpectateConnection, turfCatalog, TURF_LABELS, BACKDROP_OPTIONS, GALAXY_BACKDROP_CREDIT, GALAXY_BACKDROP_URL, iconBehaviourDefault, MARKER_BEHAVIOUR_DEFAULT, type SkillBehaviour, type SkillRenderPosition } from './game/settings';
import { playerSkillCategory } from './game/skillCategory';
import { INJURY_CONFIG_KEYS } from './game/skillDisplay';
import { SKILL_CONFIG_AS_SKILL, SKILL_CONFIG_NAMES, iconWriteKey, isStarPlayerTrait, skillConfigEntryFor } from './game/skillConfigRows';
import { coachPassword, coachPasswordModel, credentialStore, flushCoachPassword, setCoachPassword } from './game/credentials';
import { clearConfigWebToken } from './game/configWebAuth';
import {
  IDLE as CHALLENGE_IDLE,
  fumbblCheckingMessage,
  forkCheckingMessage,
  isChecking,
  runForkChallenge,
  runFumbblChallenge,
  type ChallengeState,
} from './game/authChallenge';
import { ui } from './game/ui';
import { floatAfterLaunch, floatOnOwnMatch } from './game/fumbblFloatLayout';
import { gameStore } from './game/store';
import { gameStatRows, teamLogo } from './game/gameStatRows';
import {
  ambiguousJnlpEntry,
  cancelAmbiguousJnlpEntry,
  jnlpEntryError,
  readJnlpFile,
  resolveAmbiguousJnlpEntry,
  routeJnlpRequest,
  useNativeJnlpIntake,
  type JnlpRouteResult,
} from './game/jnlpRouting';
import {
  classifyReplayFileContent,
  sharedReplayFileImporter,
  type ReplayFileImportTicket,
} from './game/replay/replayFileImport';
import { applyTheme, deriveTheme, resolveThemeColors, THEME_PRESETS, type ThemeId } from './game/theme';
import { dialogDescriptor } from './game/dialogRegistry';
import { endGameExitPlan, type EndGameExit } from './game/spectatorEndGame';
import { assetMods, beginAssetAssignmentIntent, commitAssetAssignments, packSupports, type InstalledAssetPack } from './game/assetMods';
import { CHRISTER_MIT_LICENSE, CLIENT_MIT_LICENSE, LEGAL_ACCEPTANCE_VERSION, needsLegalAcknowledgement } from './game/legalNotice';
import type { JnlpJoinRequest } from './game/jnlpCompat';
import { installNativeContextMenuSuppression } from './game/nativeContextMenu';
import { readFullscreenSurface, toggleFullscreenSurface, type NativeFullscreenHost } from './game/fullscreen';
import { fullscreenKeyDecision } from './game/fullscreenKeys';

let removeNativeContextMenuSuppression: (() => void) | null = null;
onMounted(() => { removeNativeContextMenuSuppression = installNativeContextMenuSuppression(); });
onBeforeUnmount(() => {
  removeNativeContextMenuSuppression?.();
  removeNativeContextMenuSuppression = null;
});
import { authenticateAccount, rehydrateAccountSession } from './game/accountApi';
import {
  dismissTournamentNotification,
  startTournamentNotificationPolling,
  tournamentNotificationState,
} from './game/tournamentNotificationClient';

// Owner 2026-07-07: the app version (injected by Vite from package.json) shown in the header tag.
// Owner 2026-07-10 (dev-version nomenclature): appVersion carries the dev LETTER (0.2.8d) for dev cuts,
// bare (0.2.8) for the published release; gitSha is the exact source commit. Both are shown in the
// header tag + the OS window title so any build self-identifies. See dev-version-nomenclature.md.
declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;
const appVersion = __APP_VERSION__;
const gitSha = typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'nogit';
// Owner 09-25: declared BEFORE the immediate watchers below — the Discord presence watcher ran at setup, hit the
// const in its temporal dead zone (ReferenceError) and presence never pushed (live 09-25 on the dev rig).
const inTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
// ORDER 66 (A.2): a port-branch build (0.2.8-o66a…) — surfaces the order66 toggle without needing -dev.
const isO66Build = appVersion.includes('o66');
// Owner 09-23: version check — at startup ask GitHub for the latest public release; when it is newer than this
// build, prompt with a button that opens the release page in the system browser. Dev cuts never prompt.
const updatePrompt = ref<{ version: string; url: string; inApp: boolean; notes?: string } | null>(null);
// Owner 09-25: IN-APP updater — the packaged public edition asks tauri-plugin-updater (latest.json on the public
// release, minisign-verified against the pubkey in tauri.conf.json), downloads with progress, installs and
// relaunches. Other builds keep the release-page prompt. `pendingUpdate` holds the plugin's Update handle.
type UpdaterUpdate = { version: string; body?: string | null; downloadAndInstall: (onEvent?: (e: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => Promise<void> };
let pendingUpdate: UpdaterUpdate | null = null;
const updateProgress = ref<{ downloaded: number; total: number | null; phase: 'downloading' | 'installing' } | null>(null);
const updateError = ref('');
// Owner 09-30 (S51): the APP PATCH channel rides the same prompt — the shell pulls the signed web app parts, "Restart"
// reloads the page. `appPatchStatus` = shell/embedded/active versions (About panel, D2); null outside the packaged
// public edition (fork, dev cuts, web: no patch check, like the installer updater).
const patchEnabled = inAppUpdaterEnabled({ appVersion, inTauri, forkEdition: FORK_EDITION });
const appPatchStatus = ref<AppPatchStatus | null>(null);
let appPatchHost: AppPatchHost | null = null;
// The offered patch while the prompt is up (reactive: while it is held the prompt never shows the installer's
// "Download now"). Round 3: an offer whose parts are all installed (toFetch empty - staged earlier in this session
// or before a process restart) is Restart-ready at once; "Update now" only stages.
const pendingPatch = ref<AppPatchOffer | null>(null);
const patchReady = ref(false);
async function loadAppPatchStatus(): Promise<AppPatchStatus | null> {
  if (!patchEnabled) return null;
  try {
    appPatchHost ??= await tauriAppPatchHost();
    appPatchStatus.value = await appPatchHost.status();
  } catch (error) { console.warn('[app-patch] status unavailable', error); }
  return appPatchStatus.value;
}
// Owner 09-25: the prompt NAGS — every launch and every hourly poll re-offers an available update, "Later" or not.
let updateCheckInFlight = false;
async function checkForUpdate(): Promise<void> {
  if (updatePrompt.value || updateProgress.value || updateCheckInFlight) return;
  updateCheckInFlight = true;
  try { await runUpdateCheck(); } finally { updateCheckInFlight = false; }
}
async function runUpdateCheck(): Promise<void> {
  if (inAppUpdaterEnabled({ appVersion, inTauri, forkEdition: FORK_EDITION })) {
    // D2: installer updates compare with the SHELL version (a patched page is ahead of its shell).
    const shellVersion = (await loadAppPatchStatus())?.shellVersion ?? appVersion;
    if (appPatchHost) {
      try {
        const decision = decideAppPatch(await appPatchHost.check());
        if (decision.kind === 'offer') {
          if (gameStore.game.value) return; // never surface the prompt mid-game (the check was awaited)
          pendingPatch.value = decision.offer;
          patchReady.value = decision.offer.toFetch.length === 0;
          updatePrompt.value = { version: decision.offer.version, url: `https://github.com/${PUBLIC_RELEASES_REPO}/releases`, inApp: true, notes: decision.offer.notes };
          return;
        }
        // 'shell': the patch needs a newer shell - the installer updater below offers it; the patch follows after.
      } catch (error) {
        console.warn('[app-patch] check failed', error);
      }
    }
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check({ timeout: 15_000 });
      if (update && shellUpdateAvailable(shellVersion, update.version)) {
        if (gameStore.game.value) return;
        pendingUpdate = update as unknown as UpdaterUpdate;
        updatePrompt.value = { version: update.version, url: `https://github.com/${PUBLIC_RELEASES_REPO}/releases/tag/v${update.version}`, inApp: true, notes: update.body ?? undefined };
      }
      return;
    } catch (error) {
      console.warn('[update] in-app check failed, falling back to the release page', error);
    }
  }
  const latest = await fetchLatestRelease((url, init) => (inTauri ? tauriFetch(url, init) : fetch(url, init)));
  if (gameStore.game.value) return;
  if (latest && updateAvailable(appPatchStatus.value?.shellVersion ?? appVersion, latest.version)) updatePrompt.value = { ...latest, inApp: false };
}
async function installAppPatchNow(offer: AppPatchOffer, host: AppPatchHost): Promise<void> {
  updateError.value = '';
  updateProgress.value = { downloaded: 0, total: null, phase: 'downloading' };
  try {
    await installAppPatch(host, offer, (p) => { if (updateProgress.value) { updateProgress.value.downloaded = p.downloaded; updateProgress.value.total = p.total || null; } });
    updateProgress.value = null;
    patchReady.value = true; // staged, not active: Restart activates
  } catch (error) {
    updateProgress.value = null;
    updateError.value = `The update could not be installed: ${error instanceof Error ? error.message : String(error)}`;
  }
}
async function restartAfterPatch(): Promise<void> {
  if (!appPatchHost || !pendingPatch.value) return;
  updateError.value = '';
  try { await restartIntoPatch(appPatchHost, pendingPatch.value); } catch (error) {
    // Round 3: keep Restart (retry) / Later visible with the error.
    updateError.value = `The update could not be activated: ${error instanceof Error ? error.message : String(error)}`;
  }
}
async function useBuiltInAppVersion(): Promise<void> {
  if (!appPatchHost) return;
  try { await useBuiltInVersion(appPatchHost); } catch (error) { console.warn('[app-patch] rollback failed', error); }
}
async function installUpdateNow(): Promise<void> {
  if (pendingPatch.value && appPatchHost) { await installAppPatchNow(pendingPatch.value, appPatchHost); return; }
  const update = pendingUpdate;
  if (!update) { openUpdateRelease(); return; }
  updateError.value = '';
  updateProgress.value = { downloaded: 0, total: null, phase: 'downloading' };
  try {
    await update.downloadAndInstall((e) => {
      const p = updateProgress.value; if (!p) return;
      if (e.event === 'Started') p.total = e.data?.contentLength ?? null;
      else if (e.event === 'Progress') p.downloaded += e.data?.chunkLength ?? 0;
      else if (e.event === 'Finished') p.phase = 'installing';
    });
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (error) {
    updateProgress.value = null;
    updateError.value = `The update could not be installed: ${error instanceof Error ? error.message : String(error)}`;
  }
}
function dismissUpdate(): void { updatePrompt.value = null; updateProgress.value = null; updateError.value = ''; pendingPatch.value = null; patchReady.value = false; }
function updatePercent(): number | null { const p = updateProgress.value; return p && p.total ? Math.min(100, Math.round((p.downloaded / p.total) * 100)) : null; }
// Owner 09-25: an invisible marker for the first in-app update test (1.0.23 → 1.0.24) — the console shows the build.
// Owner 09-30 (S51): the packaged public edition logs `app X (shell Y)` once the shell answers.
if (patchEnabled) void loadAppPatchStatus().then((s) => console.info(`[super-fumbbl] build ${versionLine(appVersion, s)} (${gitSha})`));
else console.info(`[super-fumbbl] build ${appVersion} (${gitSha})`);
// Owner 09-25: besides the launch check, poll every 60 minutes — held back while a game is on screen so the
// prompt never lands mid-turn; it fires on the next tick after the board is left, and re-offers after "Later".
const UPDATE_POLL_MS = 60 * 60 * 1000;
let updatePollTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  setTimeout(() => { void checkForUpdate(); }, 1500);
  updatePollTimer = setInterval(() => { if (gameStore.game.value) return; void checkForUpdate(); }, UPDATE_POLL_MS);
});
onBeforeUnmount(() => { if (updatePollTimer) clearInterval(updatePollTimer); updatePollTimer = null; });
// Owner 10-03: "check for updates each time it returns to the menu" - when a game / replay closes and the console
// is back on screen, check right away instead of waiting for the hourly poll. Never while a game is up.
watch(() => !!gameStore.game.value, (inGame, wasInGame) => {
  if (shouldCheckForUpdateOnMenuReturn(wasInGame, inGame)) setTimeout(() => { if (!gameStore.game.value) void checkForUpdate(); }, MENU_RETURN_UPDATE_CHECK_DELAY_MS);
});
// Owner 09-23: ART PACK — a split (public) build downloads its art into app-data on first run and only the
// changed parts after an update; the pitch views wait for it (menus stay usable). Bundled builds are ready at once.
async function startArtPackSync(): Promise<void> {
  if (inTauri) { await syncArtPack(await tauriArtPackHost()); return; }
  // Web/rig: `?artpack=<base url>` serves an unzipped pack as static files (verification of the alias path).
  const staticPack = new URLSearchParams(window.location.search).get('artpack');
  if (staticPack) { await syncArtPack(webArtPackHost(staticPack)); return; }
  artPack.ready = true;
}
onMounted(() => { void startArtPackSync(); });
// Owner 09-24: Discord Rich Presence — the local Discord shows "vs <Coach>'s <Race> · score · turn" / "Watching …" /
// "Waiting for a game". Text is shaped in game/discordPresence.ts; the Rust worker owns the socket + rate limit.
let presenceGameId = 0, presenceStartedAt = 0, presenceLast = '';
const presenceSpec = computed(() => {
  const g = gameStore.game.value;
  const gid = Number((g as { gameId?: unknown } | null)?.gameId ?? 0);
  if (gid !== presenceGameId) { presenceGameId = gid; presenceStartedAt = Math.floor(Date.now() / 1000); }
  return presenceFor({
    game: g, playing: gameStore.isPlaying.value, replay: gameStore.isReplay.value,
    myCoach: settings.activeServerTarget === 'fork' ? settings.coach40k : settings.coach,
    server: settings.activeServerTarget === 'fork' ? 'fork' : 'fumbbl',
    spectateInvites: settings.discordSpectateInvites, startedAt: g ? presenceStartedAt : undefined,
  });
});
async function pushPresence(): Promise<void> {
  if (!inTauri) return;
  const { invoke } = await import('@tauri-apps/api/core');
  if (!settings.discordPresence) { if (presenceLast) { presenceLast = ''; await invoke('discord_presence_clear').catch(() => {}); } return; }
  const spec = presenceSpec.value; const key = JSON.stringify(spec);
  if (key === presenceLast) return;
  presenceLast = key;
  await invoke('discord_presence_set', { spec }).catch(() => {});
}
watch([presenceSpec, () => settings.discordPresence], () => { void pushPresence(); }, { immediate: true, deep: true });
onMounted(async () => {
  if (!inTauri) return;
  const { listen } = await import('@tauri-apps/api/event');
  // A friend pressed Spectate on Discord: Discord hands THIS client the secret → open that game as a spectator.
  await listen<string>('discord-spectate', (event) => {
    const target = parseSpectateSecret(event.payload);
    if (!target) return;
    if (target.server === 'fork' && !FORK_EDITION) return; // the public edition has no fork target
    settings.activeServerTarget = target.server;
    openSpectateGame(target.gameId);
  });
});
function openUpdateRelease(): void { const p = updatePrompt.value; if (!p) return; void openExternal(p.url); updatePrompt.value = null; }

// Beta launch splash (owner 10-05): FIRST on EVERY launch, both editions, ahead of the intro / legal /
// contributions cards. Plain in-memory ref — never persisted, so it re-shows on each app start. It is part
// of the first-open gate, so the shell stays unmounted and JNLPs stay held until it is dismissed.
const betaSplashOpen = ref(true);

// Legal acceptance is a revisioned launch gate rather than a dismissible preference. Missing or
// malformed persistence fails closed, including for existing installs that predate this field.
// The normal shell is not mounted and native JNLP requests are held in memory until the explicit
// acknowledgement has reached the durable settings lane.
const legalNoticeBusy = ref(false);
const legalNoticeOpen = computed(() => legalNoticeBusy.value || needsLegalAcknowledgement(settings.legalAcceptanceVersion));
// First-open contributions screen (owner 08-27): shown once, AFTER the legal notice clears —
// Christer + the FUMBBL contributors first, then Super FUMBBL. Informational, not consent:
// a failed persist closes it anyway (it simply reappears next launch).
const CONTRIBUTIONS_VERSION = 1;
const contributionsOpen = computed(() => !legalNoticeOpen.value && settings.contributionsSeenVersion < CONTRIBUTIONS_VERSION);
// First-launch setup wizard (owner 10-06): once per SETUP_WIZARD_VERSION, for EVERY install, AFTER the contributions
// screen — it replaces the old account-setup splash. Part of the gate (shell unmounted, JNLPs held) on first launch; a
// re-run from Settings → General draws the same component over the live shell instead (ui.setupWizardRerunOpen —
// in `ui` so SpectateView's gameplay keyboard guard stands down while it is up).
const skipSplash =
  import.meta.env.VITE_SKIP_SPLASH === 'true' ||
  (typeof location !== 'undefined' && new URLSearchParams(location.search).has('skipSplash'));
const setupWizardOpen = computed(() => !skipSplash && !legalNoticeOpen.value && !contributionsOpen.value && setupWizardNeeded(settings.setupWizardSeenVersion));
const firstOpenGateOpen = computed(() => betaSplashOpen.value || legalNoticeOpen.value || contributionsOpen.value || setupWizardOpen.value);
async function finishSetupWizard(): Promise<void> {
  const firstLaunch = setupWizardOpen.value;
  completeSetupWizard(settings);
  const wasRerun = ui.setupWizardRerunOpen;
  ui.setupWizardRerunOpen = false;
  if (wasRerun) void nextTick(() => { restoreDialogFocus(null, appMenuFocusFallback()); });
  try {
    await nextTick();
    await flushSettingsFile();
  } catch {
    // Same as contributions: a persist failure closes it anyway; it simply reappears next launch.
  }
  if (firstLaunch && !settings.hideTutorialSplash) guideOpen.value = true; // the existing post-first-run path
}
function rerunSetupWizard(): void {
  ui.settingsOpen = false;
  ui.setupWizardRerunOpen = true;
}
async function continueContributions(): Promise<void> {
  settings.contributionsSeenVersion = CONTRIBUTIONS_VERSION;
  try {
    await nextTick();
    await flushSettingsFile();
  } catch {
    // Informational screen: never block the shell on a persistence hiccup.
  }
}

// First-open retro intro (owner 08-27): rides the same first-open condition as the legal notice and
// plays BEFORE it. Sound at 30% (owner). Skippable (button / Esc / Enter / Space); a load error or
// unsupported codec fails OPEN to the legal notice — the intro must never block the acknowledgement gate.
const INTRO_VOLUME = 0.3;
const INTRO_VIDEO_URL = '/intro.mp4';
const introVideo = ref<HTMLVideoElement | null>(null);
const introDone = ref(false);
const introNeedsGesture = ref(false);
// Launch flags (owner 10-14): `--skip-intro` / `--skipintro` or SUPER_FUMBBL_SKIP_INTRO=1 (read by the Tauri shell,
// `launch_flags` command); the web/dev build reads `?skipIntro`. Read ONCE at startup; the intro waits for the read
// so it can never flash open first. Skips the VIDEO only: the legal acknowledgement stays unskippable.
const introFlagsReady = ref(false);
const LAUNCH_FLAGS_TIMEOUT_MS = 1500;
function readLaunchFlags(): void {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('skipIntro')) {
    introDone.value = true;
    introFlagsReady.value = true;
    return;
  }
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) { introFlagsReady.value = true; return; }
  // Bounded at 1500 ms (timeout = no flag; a late answer is ignored) so the intro/legal ordering is deterministic.
  let settled = false;
  const settle = (skip: boolean): void => {
    if (settled) return;
    settled = true;
    if (skip) introDone.value = true;
    introFlagsReady.value = true;
  };
  setTimeout(() => settle(false), LAUNCH_FLAGS_TIMEOUT_MS);
  void import('@tauri-apps/api/core')
    .then(({ invoke }) => invoke<{ skipIntro?: boolean; skip_intro?: boolean }>('launch_flags'))
    .then((flags) => settle(!!(flags?.skipIntro || flags?.skip_intro)))
    .catch(() => settle(false));
}
readLaunchFlags();
// Held behind the beta splash: no autoplay, and no window Esc/Enter/Space listener that could skip it.
const introOpen = computed(() => !betaSplashOpen.value && legalNoticeOpen.value && !introDone.value && introFlagsReady.value);
// Playback watchdog (owner 10-14, src/introWatchdog.ts): fails OPEN to the legal notice on 4 s of true inactivity
// (no load/decode activity before playback, no currentTime advance during it; 15 s total cap on a dead load).
// Suspended while the gesture (play) button shows; the Play click re-arms it.
const introWatchdog = createIntroWatchdog(() => { if (introOpen.value) finishIntro(); });
function clearIntroTimers(): void { introWatchdog.stop(); }
function onIntroActivity(): void { introWatchdog.activity(); }
function onIntroProgress(): void { introWatchdog.sample(introVideo.value?.currentTime ?? 0); }
function finishIntro(): void {
  clearIntroTimers();
  introDone.value = true;
  introNeedsGesture.value = false;
}
function startIntroPlayback(): void {
  const video = introVideo.value;
  if (!video) return;
  video.volume = INTRO_VOLUME;
  // Autoplay with sound is allowed in the shipped WebView (autoplay policy relaxed in tauri.conf);
  // a browser preview that blocks it gets an explicit play control instead of a silent hang.
  // Optimistic: a Play click hides the button and re-arms the watchdog; a second NotAllowedError re-shows it.
  if (introNeedsGesture.value) { introNeedsGesture.value = false; introWatchdog.setGesture(false); }
  video.play().then(() => { introNeedsGesture.value = false; }).catch((err: unknown) => {
    if ((err as { name?: string } | null)?.name === 'NotAllowedError') {
      introNeedsGesture.value = true;
      introWatchdog.setGesture(true);
    } else {
      finishIntro();
    }
  });
}
function onIntroKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    finishIntro();
  }
}
watch(introOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', onIntroKeydown);
    introWatchdog.start();
    void nextTick(() => startIntroPlayback());
  } else {
    window.removeEventListener('keydown', onIntroKeydown);
    clearIntroTimers();
    introVideo.value?.pause();
  }
}, { immediate: true });
const legalNoticeError = ref('');
const legalHeldJnlps: JnlpJoinRequest[] = [];

async function acknowledgeLegalNotice(): Promise<void> {
  if (legalNoticeBusy.value || !legalNoticeOpen.value) return;
  legalNoticeBusy.value = true;
  legalNoticeError.value = '';
  const previous = settings.legalAcceptanceVersion;
  settings.legalAcceptanceVersion = LEGAL_ACCEPTANCE_VERSION;
  try {
    // Let the deep settings watcher observe this same-tick mutation before forcing its
    // crash-safe file flush. In browser preview, nextTick likewise completes localStorage.
    await nextTick();
    await flushSettingsFile();
  } catch (error) {
    settings.legalAcceptanceVersion = previous;
    legalNoticeError.value = `The acknowledgement could not be saved: ${error instanceof Error ? error.message : String(error)}`;
    legalNoticeBusy.value = false;
    return;
  }
  legalNoticeBusy.value = false;
}
// A JNLP opened before acceptance remains usable, but no route (and therefore no socket
// connection or game command) is allowed until the WHOLE first-open gate (legal +
// contributions) has closed.
watch(firstOpenGateOpen, (open) => {
  if (open) return;
  for (const request of legalHeldJnlps.splice(0)) routeNativeJnlp(request);
});

// Settings > General "Associate .jnlp files with this app" (Windows only, per-user HKCU;
// see src-tauri/src/lib.rs jnlp_assoc). Hidden entirely when the native command reports
// unsupported (non-Windows or browser preview) rather than shown disabled.
const jnlpAssocSupported = ref(false);
const jnlpAssocOn = ref(false);
const jnlpAssocBusy = ref(false);
const jnlpAssocError = ref('');
async function refreshJnlpAssocStatus() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    jnlpAssocSupported.value = await invoke<boolean>('jnlp_association_supported');
    if (jnlpAssocSupported.value) jnlpAssocOn.value = await invoke<boolean>('jnlp_association_status');
  } catch {
    jnlpAssocSupported.value = false; // browser build / API unavailable
  }
}
async function toggleJnlpAssociation() {
  if (jnlpAssocBusy.value) return;
  jnlpAssocBusy.value = true;
  jnlpAssocError.value = '';
  const next = !jnlpAssocOn.value;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_jnlp_association', { enable: next });
    jnlpAssocOn.value = next;
  } catch {
    jnlpAssocError.value = next
      ? 'Could not associate .jnlp files — try again, or check Windows permissions.'
      : 'Could not remove the .jnlp association — try again.';
  } finally {
    jnlpAssocBusy.value = false;
  }
}
onMounted(() => { void refreshJnlpAssocStatus(); });
// Stamp the OS window title with the full build id (guarded: no-op in the plain browser build).
onMounted(async () => {
  const title = `Super FUMBBL ${appVersion} (${gitSha})`;
  document.title = title;
  try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().setTitle(title); } catch { /* browser build / API unavailable */ }
  detectDevMode(); // owner 2026-07-10: unlock the Developer panel when launched with -dev (or ?dev)
});
let stopTournamentNotificationPolling: (() => void) | undefined;
onMounted(async () => {
  if (!FORK_EDITION) return; // owner 09-10: no fork account / config-web session in the public edition
  try {
    const restored = await rehydrateAccountSession();
    if (!restored) {
      if (!settings.coach40k.trim() || !coachPassword()) return;
      await authenticateAccount(settings.coach40k, coachPassword());
    }
    if (FORK_EDITION) stopTournamentNotificationPolling = startTournamentNotificationPolling(); // owner 09-10: fork edition only
  } catch {
    // Account pane surfaces actionable auth errors; ordinary game startup remains available.
  }
});
onBeforeUnmount(() => stopTournamentNotificationPolling?.());

function openTournamentNotification() {
  const notification = tournamentNotificationState.active;
  if (!notification) return;
  window.dispatchEvent(new CustomEvent('fumbbl40k:scheduled-match-open', {
    detail: { matchId: notification.scheduledMatchId, gameId: notification.gameId },
  }));
  dismissTournamentNotification(notification.id);
}
import { SOUND_CATALOG, previewSound, invalidateSoundCache } from './game/sounds';
import { commitMarkingStores, currentMarkingStores, invalidateMarkingsImports, normalizeMarkingStores, setTableMarker } from './game/markingRules';
import SkillMarkingsSettings from './components/SkillMarkingsSettings.vue';
import { restoreSettingsSnapshotTransaction } from './game/assetModUi';
import {
  SETTINGS_SECTIONS,
  appShellModalOwnsKeyboard,
  acceptSettingsPreview,
  cancelSettingsPreview,
  focusFirstInDialog,
  focusInitialSettingsControl,
  restoreDialogFocus,
  resolveSettingsTab,
  runConfirmedImmediateOperation,
  settingsTransactionIsBusy,
  settingsEscapeAction,
  settingsTransactionSnapshot,
  trapDialogFocus,
  type SettingsTab,
} from './game/settingsDialog';
import helmetIconUrl from './assets/resources/football-helmet.png';
import tabblLogoUrl from './assets/resources/tabbl-logo.png';
// Owner 2026-07-11: rebrand to the working name "Super FUMBBL" (display only — server/identifier/
// installer names stay Super FUMBBL). The processed logo (green plate keyed to transparency).
import superFumbblLogoUrl from './assets/resources/super-fumbbl-logo.png';
import { useSuperFumbblLogoMip } from './game/logoMips';
// Owner 10-12: the ribbon's logo plate (the header strip is gone) binds a mip level, like the in-game quick bar.
const ribbonLogo = ref<HTMLImageElement | null>(null);
const ribbonLogoSrc = useSuperFumbblLogoMip(ribbonLogo);

// Launch flow: optional intro, FUMBBL login, then tutorial. Twitch parent must match the host.
onMounted(() => {
  window.addEventListener('pointerdown', (e: PointerEvent) => {
    if (!settings.clickEcho || e.button === 2) return;
    const el = document.createElement('div');
    el.className = 'click-echo';
    el.style.left = `${e.clientX}px`;
    el.style.top = `${e.clientY}px`;
    el.style.setProperty('--click-echo-color', settings.clickEchoColor || '#f5c518');
    el.style.setProperty('--echo-scale', String(settings.echoSize || 1));
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    // safety net if the animation event is missed
    setTimeout(() => el.remove(), 600);
  });
});

// Owner 10-06: the first-run account-setup splash is gone — the first-launch setup wizard
// (components/FirstLaunchSetup.vue) asks for the logins now. The getting-started TUTORIAL still does not auto-open
// except after that wizard's Finish when hideTutorialSplash is off (see finishSetupWizard).
// Owner 2026-07-04: the tabbed credentials menu (FUMBBL | Super FUMBBL), opened by a
// button from the launch splash or Settings → Connection.
const credsMenuOpen = ref(false);
const credsMenuTab = ref<'fumbbl' | 'fumbbl40k'>('fumbbl');
const credsMenuDialog = ref<HTMLElement | null>(null);
let credsMenuOpener: HTMLElement | null = null;
function openCredsMenu(tab: 'fumbbl' | 'fumbbl40k' = 'fumbbl') {
  credsMenuOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  credsMenuTab.value = tab;
  credsMenuOpen.value = true;
}

// Owner 2026-08-18: an auth-challenge button per tab, so a coach can confirm their details work
// from the dialog instead of finding out at connect time. Per-tab state — switching tabs must not
// show the other tab's verdict — and see game/authChallenge.ts for why the two tabs prove DIFFERENT
// things (the fork check is a real credential challenge; the FUMBBL one is a name lookup only).
const forkChallenge = ref<ChallengeState>(CHALLENGE_IDLE);
const fumbblChallenge = ref<ChallengeState>(CHALLENGE_IDLE);
// A stale result outlives the values it described, so a verdict is dropped the moment either field
// is edited. Never the values themselves — a failed check must not cost the user their typing.
watch(() => [settings.coach40k, coachPasswordModel.value], () => { forkChallenge.value = CHALLENGE_IDLE; });
watch(() => [settings.coach, settings.password], () => { fumbblChallenge.value = CHALLENGE_IDLE; });

async function verifyForkCredentials() {
  if (isChecking(forkChallenge.value)) return;
  forkChallenge.value = { kind: 'checking', message: forkCheckingMessage(settings.coach40k) };
  // The Tauri HTTP client where we have one: the browser fetch is same-origin-restricted and the
  // config-web host is not our origin.
  const transport = inTauri ? tauriFetch : fetch;
  forkChallenge.value = await runForkChallenge(
    settings.coach40k,
    coachPasswordModel.value,
    transport as typeof fetch,
    botConfigBaseUrl(),
  );
}

async function checkFumbblCoach() {
  if (isChecking(fumbblChallenge.value)) return;
  fumbblChallenge.value = { kind: 'checking', message: fumbblCheckingMessage(settings.coach) };
  fumbblChallenge.value = await runFumbblChallenge(settings.coach, inTauri ? (tauriFetch as typeof fetch) : fetch);
}

// The fork password field debounces its keychain write by 400ms (game/credentials.ts). Dismissing
// the panel that holds it is faster than that, so EVERY close path flushes first — otherwise the
// last thing typed is dropped with no error to show for it, which reads to the user as "the app
// doesn't save my credentials". Covers Done, ✕ and backdrop.
function closeCredsMenu() { void flushCoachPassword(); credsMenuOpen.value = false; }

// Fork registration uses a distinct password and config-web's idempotent registration endpoint.
const registerModalOpen = ref(false);
const registerDialog = ref<HTMLElement | null>(null);
let registerModalOpener: HTMLElement | null = null;
const registerCoach = ref('');
const registerPassword = ref('');
const registerStatus = ref('');
const registering = ref(false);
function openRegisterModal() {
  registerModalOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  registerCoach.value = settings.coach40k.trim();
  registerPassword.value = '';
  registerStatus.value = '';
  registerModalOpen.value = true;
}
function closeRegisterModal() { registerModalOpen.value = false; }
async function registerForkAccount() {
  const coach = registerCoach.value.trim();
  const password = registerPassword.value;
  if (!coach) { registerStatus.value = 'Enter a coach name.'; return; }
  if (password.length < 4) { registerStatus.value = 'Choose a password (at least 4 characters).'; return; }
  registering.value = true;
  registerStatus.value = `Registering “${coach}” on the fork…`;
  try {
    // Owner ruling 08-17: the chosen password is hashed before it leaves — forkRegisterUrl sends
    // passwordMd5, which is exactly what ffb_coaches stores, so the clear text never enters a
    // query string (and so never enters an access or proxy log). See game/settings.ts.
    const url = forkRegisterUrl({ coach, password });
    const res = inTauri ? await tauriFetch(url) : await fetch(url);
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    settings.coach40k = coach;
    await setCoachPassword(password); // OS credential store, not localStorage
    // Owner ruling 08-17: the coach identity just changed, so any held config-web session token
    // belongs to the previous one. Drop it; the next guarded call exchanges these creds for a fresh
    // token (see game/configWebAuth.ts). Registration still transmits a credential — it SETS it —
    // but only the digest, never the clear text.
    clearConfigWebToken();
    registerStatus.value = `✓ Registered “${coach}”. You can play on the fork now.`;
    setTimeout(closeRegisterModal, 1200);
  } catch (e) {
    registerStatus.value = `Couldn't register (${(e as Error).message}). Is the Tournament Bot reachable?`;
  } finally {
    registering.value = false;
  }
}
const splashOpen = ref(false); // welcome splash deprecated — shown only via replayIntro()
// Owner 2026-07-14: the getting-started tutorial is OFF at launch for now (a nuisance, needs revising) —
// hardcoded off so it's suppressed even for existing installs whose hideTutorialSplash is persisted false.
// Still reachable on demand via Settings → Connection ("Replay the intro screens") / Play Tutorial.
const guideOpen = ref(false);
function nextSplash() {
  splashOpen.value = false;
  if (!settings.hideTutorialSplash) guideOpen.value = true;
}
// "Play Tutorial": clear the splashes, ensure the spectate HUD is up, and kick off
// the guided tour (SpectateView watches ui.tutorialTick). Cold start has no game, so
// SpectateView isn't mounted — load the demo first, let it mount, THEN tick the tour.
async function playTutorial() {
  splashOpen.value = false;
  guideOpen.value = false;
  view.value = 'spectate';
  if (!gameStore.game.value) await gameStore.loadDemo();
  await nextTick(); // SpectateView mounts off game.value; its tutorialTick watcher must exist first
  ui.tutorialTick += 1;
}
/** Re-show the welcome + tutorial splashes on demand (Settings → Connection). */
async function replayIntro(): Promise<void> {
  // Through the Settings transaction (Astra 10-06): closing the dialog directly would keep unsaved edits as the new
  // baseline. Cancel reverts them; if it cannot close (busy / restore failed) nothing else happens.
  if (ui.settingsOpen && !(await cancelSettingsChanges())) return;
  guideOpen.value = false;
  splashOpen.value = true;
}
const twitchEmbedUrl = computed(() => {
  const host = window.location.hostname || 'localhost';
  const parents = [...new Set([host, 'localhost', 'tauri.localhost'])].map((p) => `parent=${p}`).join('&');
  return `https://player.twitch.tv/?channel=flutethecat&${parents}&muted=true&autoplay=false`;
});
const twitchChannelUrl = 'https://twitch.tv/flutethecat';
// Owner 2026-07-03: in the packaged build the webview origin is `tauri.localhost`,
// which Twitch REJECTS as an embed `parent` — so the player iframe is broken there.
// Show the live embed only on the web/dev origin; the desktop build gets a clickable
// "Watch on Twitch" card that opens the channel in the system browser instead. (inTauri itself is declared
// at the top of the script — owner 09-25: the presence watcher reads it during setup.)
// openExternal (system browser; window.open fallback) lives in game/openExternal.ts — shared with the setup wizard.

// Owner ruling (console shell restructure): Hub is deprecated — Play is the console shell's landing/home blade.
type AppView = 'home' | 'spectate' | 'play' | 'replay' | 'console' | 'team' | 'tournaments' | 'statistics' | 'league' | 'players' | 'store';
const view = ref<AppView>('play');
/** The FUMBBL.COM blade exists wherever its pane module is in the bundle (every edition since 10-06). */
const homeBladeEnabled = !!FumbblHomePane;
if (!homeBladeEnabled) watch(view, (v) => { if (v === 'home') view.value = 'play'; }, { flush: 'sync' });
// ---- Owner 10-08: the floating FUMBBL window (components/FumbblFloat.vue) ----
/** The FUMBBL.COM pane itself is what the shell shows right now (mirrors the template's branch order below). */
const homePaneCurrent = computed(() => view.value === 'home'
  && !(!!gameStore.game.value && artPack.ready) && !gameStore.state.waitingForMatch);
/** The coach is being taken into their OWN match (the waiting board / join progress is up): not in the game yet. */
const ownMatchJoining = computed(() => !!gameStore.state.waitingForMatch);
/** The coach is IN their own match, as a player. Never a game they watch, never a replay. */
const ownMatchPlaying = computed(() => !!gameStore.game.value && gameStore.isPlaying.value && !gameStore.isReplay.value);
/** Floating is on and the pane is not on screen: another blade, a game or a replay. Opening the FUMBBL.COM blade
 *  docks the page (owner 10-09: there is no "Return" button; floating stays on, so the window is back when the coach
 *  leaves the blade again). Never over the waiting board: the window steps aside while a join is in progress. */
const fumbblFloatVisible = computed(() => homeBladeEnabled && ui.fumbblFloating && !homePaneCurrent.value && !ownMatchJoining.value);
if (homeBladeEnabled) {
  watch(() => view.value === 'home' || ui.fumbblFloating, (wanted) => { if (wanted) loadFumbblFloat(); }, { immediate: true });
  // Owner 10-09: "When the queue pops and a game is joined, the queue view should be dismissed." Once the coach is IN
  // their own match - found from the queue, or joined any other way - the floating window is closed, floating is
  // turned off (it does not come back after the game) and the page is PARKED, exactly as Close does: a queue page
  // left running behind the match could still beep. Only our own frame goes; nothing on the FUMBBL page is touched.
  // Watching a game or a replay never ends it - that is what it is for. And a join that has not got there yet
  // dismisses nothing: the window only steps aside for the waiting board (fumbblFloatVisible).
  // Astra 10-09 (R3): NOTHING else touches the float state on the way into a match - not a launch that only stages the
  // game, not the lobby, not the waiting board - so a staged game that is cancelled, cleared, or never connects leaves
  // floating exactly as it was.
  // Known to everything that could turn floating on, at once (sync): nothing does while the coach is in their match.
  watch(ownMatchPlaying, (playing) => { ui.fumbblOwnMatchPlaying = playing; }, { immediate: true, flush: 'sync' });
  watch(ownMatchPlaying, (playing) => {
    if (floatOnOwnMatch({ playing, floating: ui.fumbblFloating, held: ui.fumbblFloatHeldAt > 0 }) !== 'dismiss') return;
    parkFumbblSite();
    ui.fumbblFloating = false;
    ui.fumbblFloatHeldAt = 0;
  });
}
/** The site's driver lives with the blade (a lazy chunk); it is loaded whenever a site exists to park. */
function parkFumbblSite(): void {
  void import('./game/fumbblHome').then(({ dismissHomeSite }) => dismissHomeSite('own-match')).catch(() => undefined);
}
/** The held launch is waiting on the "Replay or live?" question: the answer (or Cancel) settles it however long the
 *  coach takes, so the hold window is restarted when it comes. */
let fumbblFloatHeldForQuestion = false;
/** A launch taken from the site ended the floating window (game/fumbblHome.ts); the launch has now been routed. A game
 *  to watch or a replay brings the window back over it - and so does the coach's own match: the prior float state is
 *  restored as it was, and the page is dismissed only once they are IN the game (the ownMatchPlaying watch above), not
 *  here, where the game may only be staged and can still be cancelled or fail (Astra 10-09, R3). A hold that ran out
 *  settles nothing either way (Astra 10-09, F5).
 *  Astra 10-08 (P2): EVERY end of a launch comes through here - routed, answered, cancelled ('cancelled') or never
 *  usable ('intake-failed') - so the hold never outlives its launch: an unsettled marker left the window off and let
 *  the next, unrelated launch bring it back. */
function settleFumbblFloatAfterLaunch(result: string): void {
  if (!ui.fumbblFloatHeldAt) {
    fumbblFloatHeldForQuestion = false;
    return;
  }
  if (fumbblFloatHeldForQuestion && result !== 'ambiguous') ui.fumbblFloatHeldAt = Date.now();
  const outcome = floatAfterLaunch(ui.fumbblFloatHeldAt, Date.now(), result);
  if (outcome === 'keep-holding') {
    fumbblFloatHeldForQuestion = true;
    return;
  }
  fumbblFloatHeldForQuestion = false;
  ui.fumbblFloatHeldAt = 0;
  if (!homeBladeEnabled) return;
  // Their own match and already in it (a rejoin): dismissed now. Every other end of a launch puts floating back.
  if (outcome === 'own-match' && ownMatchPlaying.value) parkFumbblSite();
  else if (outcome === 'restore' || outcome === 'own-match') ui.fumbblFloating = true;
}
/** Owner 10-06 (final): a fresh launch always lands on PLAY; FUMBBL.COM is one click away (the launch window size still
 *  remembers the last window, else fits the site - window_state.rs). */
/** Owner 10-06: Settings > General re-runs the Home pane walkthrough - it starts as soon as the
 *  Home pane shows the site again (FumbblHomePane watches homeTourSeenVersion). */
async function rerunHomeTour(): Promise<void> {
  // Through the Settings transaction, like replayIntro (unsaved edits are cancelled, never kept as the baseline).
  // homeTourSeenVersion is outside the transaction snapshot (settingsDialog.ts), so the reset below survives it.
  if (ui.settingsOpen && !(await cancelSettingsChanges())) return;
  settings.homeTourSeenVersion = 0;
  view.value = 'home';
}
// ---- Owner 10-06: the client walkthrough (components/ClientTour.vue, game/clientTour.ts) ----
type PlayTourApi = { tourOpenDetails(): Promise<'real' | 'example'>; tourOpenDice(): boolean; tourCloseDetails(): void };
const playViewRef = ref<PlayTourApi | null>(null);
async function playViewForTour(): Promise<PlayTourApi | null> {
  // The tour selected Play a moment ago: give the blade a few frames to mount.
  for (let i = 0; i < 40 && !playViewRef.value; i += 1) await new Promise((resolve) => setTimeout(resolve, 25));
  return playViewRef.value;
}
type SpectateTourApi = {
  tourShowLog(): void; tourOpenLogSettings(): void; tourCloseLogSettings(): void;
  tourOpenRoster(): void; tourCloseRoster(): void; tourOpenPlayerCard(): boolean; tourClosePlayerCard(): void;
};
const spectateViewRef = ref<SpectateTourApi | null>(null);
async function spectateViewForTour(): Promise<SpectateTourApi | null> {
  // The match view mounts once the demo game (and the art pack) is in: give it a moment.
  for (let i = 0; i < 80 && !spectateViewRef.value; i += 1) await new Promise((resolve) => setTimeout(resolve, 25));
  return spectateViewRef.value;
}
const clientTourHost: ClientTourHost = {
  hasPane: homeBladeEnabled,
  selectBlade: (blade) => selectBlade(blade),
  openSettings: (tab) => openSettings(tab),
  selectSettingsTab: (tab) => { settingsTab.value = tab; },
  // Astra 10-06 (F4): false while the Settings transaction is busy - the tour then stays put.
  closeSettings: async () => (ui.settingsOpen ? cancelSettingsChanges() : true),
  openDetails: async () => {
    const play = await playViewForTour();
    return play ? play.tourOpenDetails() : 'none';
  },
  openDice: () => playViewRef.value?.tourOpenDice() ?? false,
  closeDetails: () => { playViewRef.value?.tourCloseDetails(); },
  // The HUD steps (spec-client-walkthrough-hud.md): the bundled demo, the same path as "Play Tutorial".
  loadDemo: async () => {
    if (gameStore.game.value && !gameStore.state.demoMode) return false; // a real match: never replaced
    view.value = 'spectate';
    if (!gameStore.game.value) await gameStore.loadDemo();
    return !!(await spectateViewForTour());
  },
  leaveDemo: () => {
    if (!gameStore.state.demoMode) return; // only the tour's own demo is ever left, never a real match
    ui.gameMenuOpen = false;
    statsOpen.value = false;
    leaveGamePrompt.value = false; // Astra N1: no Return-to-Menu prompt may outlive the demo
    leaveGamePromptFor = null;
    gameStore.leaveGame();
  },
  showLog: () => { spectateViewRef.value?.tourShowLog(); },
  openLogSettings: () => { spectateViewRef.value?.tourOpenLogSettings(); },
  closeLogSettings: () => { spectateViewRef.value?.tourCloseLogSettings(); },
  openRoster: () => { spectateViewRef.value?.tourOpenRoster(); },
  closeRoster: () => { spectateViewRef.value?.tourCloseRoster(); },
  openPlayerCard: () => spectateViewRef.value?.tourOpenPlayerCard() ?? false,
  closePlayerCard: () => { spectateViewRef.value?.tourClosePlayerCard(); },
  // Skip and "Let's play" mark only the CLIENT walkthrough seen (Astra 10-06): the FUMBBL.COM walkthrough has its own
  // setting and still runs the first time the coach opens that blade.
  markSeen: async () => {
    settings.clientTourSeenVersion = CLIENT_TOUR_VERSION;
    await nextTick();
    try { await flushSettingsFile(); } catch { /* a persist hiccup: it simply shows again next launch */ }
  },
};
// Owner 10-06 (final): the launch lands on Play, so the client walkthrough runs straight after the setup wizard; the
// FUMBBL.COM site walkthrough runs whenever the coach first opens that blade.
const clientTourShouldStart = computed(() => shouldStartClientTour({
  clientTourSeenVersion: settings.clientTourSeenVersion,
  setupWizardDone: !setupWizardNeeded(settings.setupWizardSeenVersion),
}));
const clientTourSuspended = computed(() => !!gameStore.state.waitingForMatch || ui.setupWizardRerunOpen || view.value === 'console');
/** Settings > General: run the client walkthrough again (through the Settings transaction, like the other re-runs). */
async function rerunClientTour(): Promise<void> {
  if (ui.settingsOpen && !(await cancelSettingsChanges())) return;
  settings.clientTourSeenVersion = 0;
}
function handleScheduledMatchOpen(): void {
  // Notification navigation is intentionally presentation-only. The tournament blade
  // still requires the coach to select Launch, so a popup can never auto-join a match.
  view.value = 'tournaments';
}

onMounted(() => window.addEventListener('fumbbl40k:scheduled-match-open', handleScheduledMatchOpen));
onBeforeUnmount(() => window.removeEventListener('fumbbl40k:scheduled-match-open', handleScheduledMatchOpen));

const tournamentBuilderPackage = ref('');
const tournamentBuilderLaunchRevision = ref(0);
function openTournamentTeamBuilder(rulesetPackName: string): void {
  tournamentBuilderPackage.value = rulesetPackName;
  tournamentBuilderLaunchRevision.value += 1;
  view.value = 'team';
}
/** Owner 10-06 (replay pane revamp): the Replay blade is back in BOTH editions (search any coach / game id) — a
 *  replay route lands on it; the loaded game takes over. (Owner 09-25 had pulled it from the public edition.) */
const replayHomeView: AppView = 'replay';
function applyJnlpResultView(result: JnlpRouteResult): void {
  settleFumbblFloatAfterLaunch(result);
  if (result === 'replay') view.value = replayHomeView;
  else if (result === 'spectate') view.value = 'spectate';
  else if (result === 'fork-player' || result === 'fumbbl-player' || result === 'fumbbl-staged') view.value = 'play';
}
function routeNativeJnlp(request: JnlpJoinRequest): void {
  cancelLeaveGame(); // a JNLP intake never inherits a Return-to-Menu prompt opened for the previous game
  const result = routeJnlpRequest(request, {
    deferFumbblPlayer: view.value === 'play' && settings.activeServerTarget === 'fumbbl',
    sourceName: 'Opened .jnlp file',
  });
  applyJnlpResultView(result);
}
// One app-lifetime native JNLP consumer prevents drain_launch_jnlps queue races.
// Only the official-server Play blade defers a player request for its preview.
useNativeJnlpIntake((request) => {
  if (firstOpenGateOpen.value) {
    legalHeldJnlps.push(request);
    return;
  }
  routeNativeJnlp(request);
}, () => settleFumbblFloatAfterLaunch('intake-failed')); // a launch that could not be read or parsed is over too
function chooseAmbiguousJnlp(choice: 'replay' | 'live'): void {
  applyJnlpResultView(resolveAmbiguousJnlpEntry(choice));
}
/** Cancel on "Replay or live?": the launch came to nothing. The view stays where it is; a floating window the launch
 *  ended comes back (it was a non-player outcome) and the hold is cleared. */
function cancelAmbiguousJnlp(): void {
  cancelAmbiguousJnlpEntry();
  settleFumbblFloatAfterLaunch('cancelled');
}
// Connect bar removed (owner 2026-07-03 r6f Option A): the header hosts the primary
// Owner 08-18: the header session chip + Disconnect (Option-A connect-bar leftovers)
// are RETIRED — leave/disconnect lives in the Game Menu + the connection-closed modal.
const liveGameMode = computed<'spectate' | 'play' | 'replay'>(() =>
  gameStore.isReplay.value ? 'replay' : gameStore.isPlaying.value ? 'play' : 'spectate',
);
const gameSessionActive = computed(() => !!gameStore.game.value || gameStore.state.sessionState === 'joined');
watchEffect(() => {
  if (gameSessionActive.value && ui.browserOpen) ui.browserOpen = false;
});

// owner 2026-07-07: Debug pane — copy the current verbose wire-log file path to the clipboard.
const wireLogCopied = ref(false);
async function copyWireLogPath() {
  const path = gameStore.state.wireLogFile;
  if (!path) return;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(path);
    else throw new Error('no clipboard api');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = path;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    document.body.removeChild(ta);
  }
  wireLogCopied.value = true;
  setTimeout(() => { wireLogCopied.value = false; }, 1500);
}
// Protocol console (owner 09-10): fork-edition dev tool, reached from the Esc menu (the hamburger is retired).
function openConsole() {
  view.value = 'console';
  ui.gameMenuOpen = false;
}

// Owner 09-10: the hamburger menu is retired. Outside a game, Esc opens the same Game Menu the pitch uses (Settings,
// Help / Field Manual) so the console keeps a keyboard route to them; in-game SpectateView owns the Esc binding.
function escConsoleMenu(e: KeyboardEvent): void {
  if (e.code !== 'Escape' || gameStore.game.value || ui.settingsOpen || ui.setupWizardRerunOpen || guideOpen.value || credsMenuOpen.value) return;
  if (shellReportOpen.value) return; // owner 10-13: the open Report dialog owns Escape (it closes itself)
  if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]')) return;
  ui.gameMenuOpen = !ui.gameMenuOpen;
}
onMounted(() => window.addEventListener('keydown', escConsoleMenu));
onBeforeUnmount(() => window.removeEventListener('keydown', escConsoleMenu));
const replayFileInput = ref<HTMLInputElement | null>(null);
const replayFileBusy = ref(false);
const replayFileError = ref('');
interface ReplayFileSessionSnapshot {
  game: typeof gameStore.game.value;
  sessionKey: string;
  loading: boolean;
  source: typeof gameStore.replay.source;
  sessionState: typeof gameStore.state.sessionState;
  replayActive: boolean;
}
const stopReplayFileBusy = sharedReplayFileImporter.subscribeBusy((busy) => { replayFileBusy.value = busy; });
let replayFileTicket: ReplayFileImportTicket<ReplayFileSessionSnapshot> | null = null;
function replayFileSessionSnapshot(): ReplayFileSessionSnapshot {
  return {
    game: gameStore.game.value,
    sessionKey: gameStore.replay.sessionKey,
    loading: gameStore.replay.loading,
    source: gameStore.replay.source,
    sessionState: gameStore.state.sessionState,
    replayActive: gameStore.replay.active,
  };
}
function replayFileSessionIsCurrent(snapshot: ReplayFileSessionSnapshot): boolean {
  const current = replayFileSessionSnapshot();
  return current.game === snapshot.game
    && current.sessionKey === snapshot.sessionKey
    && current.loading === snapshot.loading
    && current.source === snapshot.source
    && current.sessionState === snapshot.sessionState
    && current.replayActive === snapshot.replayActive;
}
function restoreReplayFileFocus(): void {
  requestAnimationFrame(() => appMenuFocusFallback()?.focus());
}
function openReplayFilePicker(): void {
  if (gameStore.replay.loading || replayFileBusy.value) return;
  if (gameStore.game.value) {
    const subject = gameStore.isReplay.value ? 'current replay and its telestrator marks' : 'current game';
    if (!window.confirm(`Loading another replay will replace the ${subject}. Continue?`)) return;
  }
  replayFileError.value = '';
  replayFileTicket = sharedReplayFileImporter.begin(replayFileSessionSnapshot());
  replayFileInput.value?.click();
}
function cancelReplayFilePicker(): void {
  sharedReplayFileImporter.cancel(replayFileTicket);
  replayFileTicket = null;
  if (replayFileInput.value) replayFileInput.value.value = '';
  restoreReplayFileFocus();
}
async function loadReplayFileFromMenu(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const ticket = replayFileTicket;
  replayFileTicket = null;
  input.value = '';
  if (!file || !ticket) {
    sharedReplayFileImporter.cancel(ticket);
    restoreReplayFileFocus();
    return;
  }
  const result = await sharedReplayFileImporter.load({
    ticket,
    file,
    isCurrent: replayFileSessionIsCurrent,
    commit: async (text, byteLength) => {
      if (classifyReplayFileContent(text) === 'json') {
        gameStore.loadReplayFile(text, byteLength);
        view.value = replayHomeView;
        return;
      }
      const request = await readJnlpFile({ text: async () => text });
      const routeResult = routeJnlpRequest(request, { sourceName: 'Opened replay file' });
      if (routeResult === 'host-rejected') throw new Error(jnlpEntryError.value);
      if (routeResult === 'invalid') throw new Error(jnlpEntryError.value || 'JNLP could not be used.');
      applyJnlpResultView(routeResult);
    },
  });
  if (result.status === 'loaded') {
    replayFileError.value = '';
  } else if (result.status === 'session-changed') {
    replayFileError.value = 'The game or replay session changed while the file was loading. Choose the file again.';
  } else if (result.status === 'failed') {
    replayFileError.value = `Could not load replay: ${result.error.message}`;
  }
  restoreReplayFileFocus();
}
onBeforeUnmount(() => {
  stopReplayFileBusy();
  sharedReplayFileImporter.invalidate();
});
const settingsOpen = computed({
  get: () => ui.settingsOpen,
  set: (v: boolean) => (ui.settingsOpen = v),
});
watch(() => ui.settingsOpen, (open) => { setDisplayRatePolling(open); if (open) { trackDisplayRate(); void refreshDisplayRate(); } }); // owner 10-13: re-measure the monitor refresh rate when Settings opens
const settingsTab = computed({
  get: () => resolveSettingsTab(ui.settingsTab),
  set: (v: SettingsTab) => (ui.settingsTab = resolveSettingsTab(v)),
});
const activeSettingsSection = computed(() => SETTINGS_SECTIONS.find((section) => section.id === settingsTab.value) ?? SETTINGS_SECTIONS[0]!);
const footstepStyle = computed({
  get: () => settings.soundStyles.step ?? 'tick',
  set: (value: string) => { settings.soundStyles.step = value; previewSound('step'); },
});
// Owner 2026-07-14: the "Dodge" row of AUTOMATIC SKILL USAGE — a checkbox view over the dodgeReroll field
// (a re-roll, kept on its own proven path). On == 'auto' (auto-spend), off == 'manual' (prompt).
const autoDodge = computed({
  get: () => settings.dodgeReroll === 'auto',
  set: (v: boolean) => { settings.dodgeReroll = v ? 'auto' : 'manual'; },
});
// Owner 2026-07-14 (theme engine, spec black-red-ui-scheme.md): apply the derived --ui-* tokens to :root,
// re-running whenever the theme settings change (deriveTheme is pure; applyTheme writes :root).
watchEffect(() => applyTheme(settings.uiTheme, settings.uiPrimary, settings.uiSecondary));
function selectThemePreset(id: ThemeId) {
  settings.uiTheme = id;
  if (id !== 'custom') { settings.uiPrimary = THEME_PRESETS[id].primary; settings.uiSecondary = THEME_PRESETS[id].secondary; }
}
function onThemeColorEdit() { settings.uiTheme = 'custom'; } // editing a colour field switches the choice to Custom
const themePreview = computed(() => {
  const { primary, secondary } = resolveThemeColors(settings.uiTheme, settings.uiPrimary, settings.uiSecondary);
  return deriveTheme(primary, secondary);
});
/** When set, the next keydown rebinds this hotkey. */
const capturingKey = ref<RebindableKey | null>(null);
/** Owner 10-02: why the last rebind was refused (a key another shortcut owns); cleared on the next capture. */
const keybindRefusal = ref('');
// JLeav 09-23 (#5): a slider at its maximum looked like it could go further — the default track has no fill.
// v-fill-range paints the track up to the thumb (`--fill`), so the end of the range reads as full.
const vFillRange = {
  mounted(el: HTMLInputElement) { fillRange(el); el.addEventListener('input', () => fillRange(el)); },
  updated(el: HTMLInputElement) { fillRange(el); },
};
function fillRange(el: HTMLInputElement): void {
  const min = Number(el.min || 0), max = Number(el.max || 100), v = Number(el.value);
  const pct = max > min ? Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)) : 0;
  el.style.setProperty('--fill', `${pct}%`);
}

// Owner 10-09: the skill-markings flow (import, table, add, clear all) lives in components/SkillMarkingsSettings.vue.

// --- Per-skill display config (owner 2026-07-03 r6f) ------------------------
// A menu over EVERY skill the client can display (game/skillConfigRows.ts), grouped
// into "Skill Icons" and "Skill Markers". Each skill has a MY TEAM (home coach)
// and OPPOSITION (away coach) behaviour dropdown; Markers add a per-skill glyph.
// Owner 10-01 (S90): Team Captain (a BB2025 roster trait the server sends as a skill) is listed so its icon can be set
// to Never; it sits in the SKILL list. Every other trait is listed under its own "Traits" subheading.
// Kildash fix: Loner, Animosity, Bloodlust and the star-player traits were missing; the latter sit under "Star player traits".
const allSkills = SKILL_CONFIG_NAMES;
const skillConfigGroup = ref<'icons' | 'markers'>('icons');
const skillFilter = ref('');
const skillConfigStatus = ref('');
const filteredSkills = computed(() => {
  const q = skillFilter.value.trim().toLowerCase();
  return q ? allSkills.filter((s) => s.toLowerCase().includes(q)) : allSkills;
});
const isConfigTrait = (skill: string): boolean => !SKILL_CONFIG_AS_SKILL.has(skill) && playerSkillCategory(skill) === 'trait';
const filteredSkillRows = computed(() => filteredSkills.value.filter((skill) => !isConfigTrait(skill)));
const filteredTraitRows = computed(() => filteredSkills.value.filter((skill) => isConfigTrait(skill) && !isStarPlayerTrait(skill)));
const filteredStarTraitRows = computed(() => filteredSkills.value.filter((skill) => isConfigTrait(skill) && isStarPlayerTrait(skill)));
// Owner 10-02 (S94): an Injuries group - Niggling Injury and every stat bust - so they can be shown, hidden or marked.
const filteredInjuryRows = computed(() => {
  const q = skillFilter.value.trim().toLowerCase();
  return INJURY_CONFIG_KEYS.filter((row) => !q || row.label.toLowerCase().includes(q) || row.key.toLowerCase().includes(q));
});
const skillKind = computed<'icon' | 'marker'>(() => (skillConfigGroup.value === 'icons' ? 'icon' : 'marker'));
/** Render position for the CURRENT group (owner 2026-07-03 r6f): icons default to
 *  'head', markers to 'feet'; either can be switched to the other. */
const skillGroupPosition = computed<SkillRenderPosition>({
  get: () => (skillConfigGroup.value === 'icons' ? settings.iconPosition : settings.markerPosition),
  set: (v) => {
    if (skillConfigGroup.value === 'icons') settings.iconPosition = v;
    else settings.markerPosition = v;
  },
});
const BEHAVIOUR_OPTIONS: { value: SkillBehaviour; label: string }[] = [
  { value: 'always', label: 'All the time' },
  { value: 'added', label: 'Gained' }, // #15 addendum (owner 08-11): label-only rename (value/semantics unchanged)
  { value: 'never', label: 'Never' },
];
type SkillCol = 'Mine' | 'Opp';
/** Effective behaviour for a skill/kind/column (falls back to the group default). */
function skillBehaviour(skill: string, kind: 'icon' | 'marker', col: SkillCol): SkillBehaviour {
  // icons read tolerantly (skillConfigRows.resolveSkillConfigKey); markers match the exact wire spelling, as the generator does
  const entry = kind === 'icon' ? skillConfigEntryFor(settings.skillConfig, skill) : settings.skillConfig[skill];
  const v = entry?.[`${kind}${col}` as 'iconMine' | 'iconOpp' | 'markerMine' | 'markerOpp'];
  return v ?? (kind === 'icon' ? iconBehaviourDefault() : MARKER_BEHAVIOUR_DEFAULT);
}
function setSkillBehaviour(skill: string, kind: 'icon' | 'marker', col: SkillCol, value: SkillBehaviour) {
  if (kind === 'marker') {
    // Owner 10-09: a marker changed here goes through the markings model (it also owns the imported rules for the skill).
    commitMarkingStores(setTableMarker(currentMarkingStores(), skill, col === 'Mine' ? { markerMine: value } : { markerOpp: value }));
    return;
  }
  // the change goes to the key this row's read resolves to (else the row's name): nothing is renamed, moved or duplicated
  const key = iconWriteKey(settings.skillConfig, skill);
  const entry = { ...(settings.skillConfig[key] ?? {}) };
  entry[`${kind}${col}` as 'iconMine' | 'iconOpp'] = value;
  settings.skillConfig = { ...settings.skillConfig, [key]: entry };
}
function skillMarkerText(skill: string): string {
  return settings.skillConfig[skill]?.markerText ?? '';
}
function setSkillMarkerText(skill: string, value: string) {
  commitMarkingStores(setTableMarker(currentMarkingStores(), skill, { markerText: value }));
}
function resetSkillConfig() {
  // Owner 10-09: drop the JSON's copies of the table's markings first, or the reset brings them straight back.
  commitMarkingStores({ markingsConfig: normalizeMarkingStores(currentMarkingStores()).markingsConfig, skillConfig: {} });
  skillConfigStatus.value = 'Per-skill config reset to defaults.';
}

/** B3-8: UI-wide font choice — drives the CSS variable the root font uses.
 *  Nuffle ships embedded (public/fonts, FontFace-loaded in main.ts). */
// UI_FONTS lives in game/uiFonts.ts (shared with the setup wizard's Font step).
watchEffect(() => {
  document.documentElement.style.setProperty('--ui-font', UI_FONTS[settings.uiFont] ?? UI_FONTS.nuffle);
  document.documentElement.style.setProperty('--ui-min-text-size', `${settings.uiTextSize}px`);
  // Two-tier floor (owner 08-27): PRIMARY text never drops below 16px; sub-headers/annotations
  // keep the slider floor (12px default). The slider still raises both once it passes 16.
  const primaryFloor = Math.max(16, settings.uiTextSize);
  document.documentElement.style.setProperty('--ui-min-primary-text-size', `${primaryFloor}px`);
  document.body.style.fontSize = `${primaryFloor}px`;
});

/** F-2: packaged builds use the OS window's real fullscreen mode. Web preview
 *  retains document fullscreen as a fallback so the same control remains testable. */
type ObservableNativeFullscreenHost = NativeFullscreenHost & {
  onResized(handler: () => void): Promise<() => void>;
};
const fullscreen = ref(false);
const fullscreenIsNative = ref(false);
let nativeFullscreenHost: ObservableNativeFullscreenHost | null = null;
let removeNativeFullscreenObserver: (() => void) | null = null;
let fullscreenSyncTimer: ReturnType<typeof setTimeout> | null = null;

async function syncFullscreenState(): Promise<void> {
  const state = await readFullscreenSurface(nativeFullscreenHost, document);
  fullscreen.value = state.active;
  fullscreenIsNative.value = state.native;
}
const onDocumentFullscreenChange = () => { void syncFullscreenState(); };
const scheduleNativeFullscreenSync = () => {
  if (fullscreenSyncTimer !== null) clearTimeout(fullscreenSyncTimer);
  fullscreenSyncTimer = setTimeout(() => {
    fullscreenSyncTimer = null;
    void syncFullscreenState();
  }, 120);
};
document.addEventListener('fullscreenchange', onDocumentFullscreenChange);

onMounted(async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    nativeFullscreenHost = getCurrentWindow() as ObservableNativeFullscreenHost;
    removeNativeFullscreenObserver = await nativeFullscreenHost.onResized(scheduleNativeFullscreenSync);
  } catch {
    nativeFullscreenHost = null;
  }
  await syncFullscreenState();
});
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onDocumentFullscreenChange);
  removeNativeFullscreenObserver?.();
  removeNativeFullscreenObserver = null;
  if (fullscreenSyncTimer !== null) clearTimeout(fullscreenSyncTimer);
  fullscreenSyncTimer = null;
  nativeFullscreenHost = null;
});

async function toggleFullscreen(): Promise<void> {
  const state = await toggleFullscreenSurface(nativeFullscreenHost, document);
  fullscreen.value = state.active;
  fullscreenIsNative.value = state.native;
}

// S49 (owner 09-30): F11 / Alt+Enter toggle fullscreen app-wide. Capture phase + stopImmediatePropagation so the game
// view's own Enter (open chat) and the webview's F11 / Alt+Enter defaults never also act.
function onFullscreenHotkey(e: KeyboardEvent): void {
  if (fullscreenKeyDecision(e, { confirmKey: settings.confirmKey, capturingKey: !!capturingKey.value || !!capturingBinding.value }) !== 'toggle') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  void toggleFullscreen();
}
onMounted(() => window.addEventListener('keydown', onFullscreenHotkey, true));
onBeforeUnmount(() => window.removeEventListener('keydown', onFullscreenHotkey, true));

const settingsDialog = ref<HTMLElement | null>(null);
let settingsOpener: HTMLElement | null = null;

function appMenuFocusFallback(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.blade[data-active="true"]')
    ?? document.querySelector<HTMLElement>('.icon-button[title="Settings"]')
    // In a game the console blades are gone and the quick bar's menu button is the Settings route.
    ?? document.querySelector<HTMLElement>('.icon-button[title="Game menu (Esc)"]');
}
function settingsModalFocusFallback(): HTMLElement | null {
  return settingsDialog.value?.querySelector<HTMLElement>('.settings-x') ?? appMenuFocusFallback();
}
function credentialsModalFocusFallback(): HTMLElement | null {
  return credsMenuDialog.value?.querySelector<HTMLElement>('.creds-menu-close') ?? settingsModalFocusFallback();
}

function openSettings(tab: unknown = 'general') {
  settingsOpener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement : null;
  ui.settingsTab = resolveSettingsTab(tab);
  ui.settingsOpen = true;
  ui.gameMenuOpen = false;
}

// Settings remain live-preview: renderer/UI watchers see each edit immediately. Apply accepts the
// current preview as the new rollback point; Cancel restores the most recent accepted snapshot.
const settingsSnapshot = ref<string | null>(null);
const settingsDiscardBusy = ref(false);
const settingsDiscardError = ref('');
const settingsApplyBusy = ref(false);
const settingsApplyError = ref('');
const settingsTransactionBusy = computed(() => settingsTransactionIsBusy({
  discarding: settingsDiscardBusy.value,
  applying: settingsApplyBusy.value,
  creatorApplying: assetMods.creatorApplyBusy,
  assignmentPending: !!assetMods.pendingAssignments,
}));

// Owner 2026-09-04: Settings > Appearance > Player sprites lists ONLY what is actually available:
// the bundled Super FUMBBL Placeholder set (always), the FUMBBL Classic/Checkers modes only when an
// installed pack supplies FUMBBL iconsets, and one entry per installed sprite/walk-sheet pack.
const FUMBBL_ICONSET_CAPABILITIES = ['player-iconsets', 'fumbbl-id-images'];
// Owner 09-10: colourblind correction — a shell-wide colour-matrix filter (see the <svg> defs in the template) plus the
// green→blue UI-accent remap for the red-green modes.
const colorblindAccent = computed(() => settings.colorblindMode === 'deuteranopia' || settings.colorblindMode === 'protanopia');
const colorblindFilterStyle = computed(() => { const filter = colorblindCssFilter(settings.colorblindMode); return filter ? { filter } : undefined; });
const fumbblSpriteModesAvailable = computed(() =>
  assetMods.installed.some((pack) => pack.capabilities.some((name) => FUMBBL_ICONSET_CAPABILITIES.includes(name))));
const spritePackOptions = computed(() =>
  assetMods.installed.filter((pack) => packSupports(pack, 'playerSprites') || packSupports(pack, 'walkSheets')));
function spritePackValue(pack: InstalledAssetPack): string { return `pack:${pack.installId}`; }
const spriteChoice = computed<string>({
  get: () => {
    const active = settings.assetPackAssignments;
    const packId = active.playerSprites || active.walkSheets;
    return packId ? `pack:${packId}` : settings.spriteSet;
  },
  set: (value) => { void selectSpriteChoice(value); },
});
async function selectSpriteChoice(value: string): Promise<void> {
  const persist = (active: typeof settings.assetPackAssignments) => {
    settings.assetPackAssignments = active;
    settings.skillIconPackInstallId = active.skillIcons;
  };
  if (value.startsWith('pack:')) {
    const pack = assetMods.installed.find((candidate) => candidate.installId === value.slice(5));
    if (!pack) return;
    settings.spriteSet = 'walk'; // pack sprites take precedence; the placeholder set sits beneath them
    await commitAssetAssignments({
      ...settings.assetPackAssignments,
      playerSprites: packSupports(pack, 'playerSprites') ? pack.installId : '',
      walkSheets: packSupports(pack, 'walkSheets') ? pack.installId : '',
    }, persist, beginAssetAssignmentIntent());
    return;
  }
  settings.spriteSet = value as typeof settings.spriteSet;
  if (settings.assetPackAssignments.playerSprites || settings.assetPackAssignments.walkSheets) {
    await commitAssetAssignments({ ...settings.assetPackAssignments, playerSprites: '', walkSheets: '' }, persist, beginAssetAssignmentIntent());
  }
}
// A FUMBBL iconset mode persisted from an older build (or a pack that was removed) falls back to the placeholder
// set. Owner 09-15: 'checkers' is original art and never falls back.
watchEffect(() => {
  if (!fumbblSpriteModesAvailable.value && settings.spriteSet !== 'walk' && settings.spriteSet !== 'checkers' && settings.spriteSet !== 'chess') settings.spriteSet = 'walk';
});

function escSettings(e: KeyboardEvent) {
  if (e.code !== 'Escape') return;
  if (!settingsEscape()) return;
  e.preventDefault();
  e.stopImmediatePropagation();
}
/** The Settings-family Escape step (topmost modal first). Controller support P1: a pad's Start reaches the same step.
 *  False when no Settings-family surface is open. */
function settingsEscape(): boolean {
  // Owner 10-10: Escape on the controller-support notice closes the notice only (the box stays off).
  if (controllerOptIn.noticeOpen.value) { controllerOptIn.dismiss(); return true; }
  const action = settingsEscapeAction({
    settingsOpen: ui.settingsOpen,
    credentialsOpen: credsMenuOpen.value,
    registrationOpen: registerModalOpen.value,
    capturingKey: !!capturingKey.value || !!capturingBinding.value,
  });
  if (!action) return false;
  if (action === 'cancel-key-capture') {
    capturingKey.value = null;
    capturingBinding.value = null;
    return true;
  }
  if (action === 'close-registration') {
    closeRegisterModal();
    return true;
  }
  if (action === 'close-credentials') {
    closeCredsMenu();
    return true;
  }
  void cancelSettingsChanges();
  return true;
}
watch(() => ui.settingsOpen, (open) => {
  // Astra F5: Settings closed or cancelled - a markings import still in flight must not land afterwards.
  if (!open) invalidateMarkingsImports();
  if (open) {
    if (!settingsOpener && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      settingsOpener = document.activeElement;
    }
    settingsSnapshot.value = settingsFingerprint();
    settingsDiscardBusy.value = false;
    settingsDiscardError.value = '';
    settingsApplyBusy.value = false;
    settingsApplyError.value = '';
    void nextTick(() => { if (settingsDialog.value) focusInitialSettingsControl(settingsDialog.value); });
  } else {
    const opener = settingsOpener;
    settingsOpener = null;
    // Owner 10-06: "Run first-launch setup again" closes Settings and opens the wizard overlay, which takes focus
    // itself — restoring to the opener here would land behind it. The wizard's Finish restores to the shell instead.
    if (ui.setupWizardRerunOpen) return;
    void nextTick(() => { restoreDialogFocus(opener, appMenuFocusFallback()); });
  }
});
watch([() => ui.settingsOpen, credsMenuOpen, registerModalOpen], ([settingsUp, credsUp, registerUp], previous) => {
  const anyOpen = settingsUp || credsUp || registerUp;
  const wasOpen = previous?.some(Boolean) ?? false;
  if (anyOpen && !wasOpen) window.addEventListener('keydown', escSettings, true);
  else if (!anyOpen && wasOpen) window.removeEventListener('keydown', escSettings, true);
});
watch(credsMenuOpen, (open) => {
  if (open) void nextTick(() => { if (credsMenuDialog.value) focusFirstInDialog(credsMenuDialog.value, '.creds-panel input'); });
  else {
    const opener = credsMenuOpener;
    credsMenuOpener = null;
    void nextTick(() => { restoreDialogFocus(opener, ui.settingsOpen ? settingsModalFocusFallback() : appMenuFocusFallback()); });
  }
});
watch(registerModalOpen, (open) => {
  if (open) void nextTick(() => { if (registerDialog.value) focusFirstInDialog(registerDialog.value, 'input'); });
  else {
    const opener = registerModalOpener;
    registerModalOpener = null;
    void nextTick(() => { restoreDialogFocus(opener, credsMenuOpen.value ? credentialsModalFocusFallback() : (ui.settingsOpen ? settingsModalFocusFallback() : appMenuFocusFallback())); });
  }
});
onBeforeUnmount(() => window.removeEventListener('keydown', escSettings, true));
// Owner UAT 08-12: positional/layout state — the log panel's pos+size and the custom panel layout — is written
// IN-GAME by drag / the window-resize reanchor / the panel ResizeObserver (SpectateView), NOT by a settings-pane
// edit. It must NOT count toward the close-time dirty check: otherwise a background reflow while settings is open
// (the big modal can trigger one) leaves settings perpetually "dirty", so the ✕/Esc only ever raises the
// save/discard card and never closes (owner: "the X still stays up"). The fingerprint drops these app-managed keys.
function settingsFingerprint(): string {
  return settingsTransactionSnapshot(settings as unknown as Record<string, unknown>);
}
const settingsDirty = computed(() => settingsSnapshot.value != null && settingsFingerprint() !== settingsSnapshot.value);
function requestCloseSettings() {
  void cancelSettingsChanges();
}

async function applySettingsChanges(closeAfter = false): Promise<boolean> {
  if (settingsTransactionBusy.value) return false;
  settingsApplyBusy.value = true;
  settingsApplyError.value = '';
  try {
    settingsSnapshot.value = await acceptSettingsPreview(flushSettingsFile, settingsFingerprint);
    if (closeAfter) ui.settingsOpen = false;
    return true;
  } catch (error) {
    settingsApplyError.value = `Settings could not be saved: ${error instanceof Error ? error.message : String(error)}`;
    return false;
  } finally {
    settingsApplyBusy.value = false;
  }
}

async function cancelSettingsChanges(): Promise<boolean> {
  if (settingsTransactionBusy.value) return false;
  invalidateMarkingsImports(); // a pending markings import must not land on top of the restored snapshot
  if (!settingsDirty.value || settingsSnapshot.value == null) {
    ui.settingsOpen = false;
    return true;
  }
  settingsDiscardBusy.value = true;
  settingsDiscardError.value = '';
  settingsApplyError.value = '';
  const restored = await cancelSettingsPreview(settingsSnapshot.value, (snapshotText) =>
    restoreSettingsSnapshotTransaction({
      snapshotText,
      restoreAssets: async (requested) => {
        const ok = await commitAssetAssignments(
          requested as Partial<typeof settings.assetPackAssignments>,
          () => undefined,
          beginAssetAssignmentIntent(),
        );
        return ok ? { ...assetMods.activeAssignments } : null;
      },
      apply: (snapshot) => Object.assign(settings, snapshot),
    }));
  if (!restored) {
    settingsDiscardBusy.value = false;
    settingsDiscardError.value = 'The previous asset selection could not be restored. Your current settings are still active.';
    return false;
  }
  settingsDiscardBusy.value = false;
  ui.settingsOpen = false;
  return true;
}

function selectSettingsTab(tab: unknown, focusContent = false) {
  settingsTab.value = resolveSettingsTab(tab);
  if (focusContent) {
    void nextTick(() => settingsDialog.value?.querySelector<HTMLElement>('.settings-content h2')?.focus());
  }
}

function trapSettingsFocus(event: KeyboardEvent) {
  if (credsMenuOpen.value || registerModalOpen.value) return;
  // Owner 10-06: during the client walkthrough's Settings walk its docked card joins the cycle (Back / Skip / Next).
  trapDialogFocus(event, settingsDialog.value, [document.querySelector<HTMLElement>('.client-tour-card[data-docked="true"]')]);
}
function trapCredsFocus(event: KeyboardEvent) { if (!registerModalOpen.value) trapDialogFocus(event, credsMenuDialog.value); }
function trapRegisterFocus(event: KeyboardEvent) { trapDialogFocus(event, registerDialog.value); }

/** Owner 10-06: enter the live panel-layout mode from Settings. Goes through the Settings transaction so unsaved
 *  edits are not kept as the new baseline (same rule as the walkthrough buttons); the mode itself is a persisted
 *  setting so the Confirm Layout button (SpectateView) can end it. */
async function startUiCustomize(): Promise<void> {
  if (ui.settingsOpen && !(await cancelSettingsChanges())) return;
  settings.uiCustomize = true;
}

function resetPanelLayoutImmediately() {
  runConfirmedImmediateOperation(
    () => window.confirm('Reset every panel position and size now? This immediate layout change is not undone by Cancel.'),
    () => { settings.uiLayout = {}; },
  );
}

// owner 2026-07-21 (#102): the fork server address is the baked DDNS FORK_SERVER_HOST (settings.ts); the old
// editable IP input + applyForkIp were removed so distributed builds can't be misdirected. An advanced
// settings.forkHost override exists (empty by default) but has no dedicated input yet. Local dev = 'local' target.

// Owner ruling (08-18): the header server plates are DEPRECATED as controls — the FUMBBL plate is
// removed entirely and the Super FUMBBL plate is now inert branding (see the header template below).
// selectServerTop (formerly wired to both plates' @click) has no remaining caller — target selection
// now lives on the blades themselves: CreateGameModal (Play → Super FUMBBL) applies 'fork' itself,
// the Play blade's "PLAY ON FUMBBL" card opens a .jnlp whose routing sets the target, and the Spectate
// blade's own selector (SpectateBrowserView.vue) applies 'fumbbl' when a Spectate action needs it.
// No flow was found whose ONLY server-switch path was the header plate.

function selectMode(mode: 'play' | 'spectate' | 'team') {
  view.value = mode;
  ui.browserOpen = false;
}

function selectBlade(nextView: AppView) {
  if (nextView === 'team') {
    tournamentBuilderPackage.value = '';
    tournamentBuilderLaunchRevision.value += 1;
  }
  view.value = nextView;
  ui.browserOpen = false;
}

/** Connect through the target selected by the Spectate row action. FUMBBL and Super FUMBBL each apply their
 * target before emitting; overriding it here strands fork game ids on the official server. */
function openSpectateGame(gameId: number) {
  view.value = 'spectate';
  ui.browserOpen = false;
  void gameStore.connect({
    ...prepareSelectedSpectateConnection(),
    gameId: Number(gameId),
  });
}

/** Owner 08-18 sighting: dismiss the spectate connect-error modal below without waiting for a
 *  fresh connect() to clear it (e.g. the user just wants the browser list back). */
function dismissSpectateError(): void {
  gameStore.state.spectateConnectError = null;
  gameStore.state.joinError = null;
}
/** Retry the same attempt via the store's existing Reconnect path (re-uses lastConnect, which
 *  connect() records before it can fail — so it's populated even for a first-attempt failure). */
function retrySpectate(): void {
  dismissSpectateError();
  gameStore.reconnect();
}

/**
 * Q5 (owner 2026-07-02): the Game Menu embeds FFB-style game statistics.
 * Everything here is SERVER-provided — sums over gameResult playerResults —
 * mirroring upstream DialogGameStatistics' team comparison.
 */
const statsOpen = ref(false);

// Owner 09-22: the Esc > Game statistics pane is the end-of-game Statistics tab — same rows, same crest columns.
const gameStats = computed(() => {
  const game = gameStore.game.value;
  if (!game) return null;
  return {
    home: { team: game.teamHome.teamName, logo: teamLogo(game.teamHome, 'home') },
    away: { team: game.teamAway.teamName, logo: teamLogo(game.teamAway, 'away') },
    rows: gameStatRows(game),
  };
});

const LEAVE_GAME_DIALOG_ID = 'leaveGame' as const;
const leaveGameDialog = dialogDescriptor(LEAVE_GAME_DIALOG_ID);
const leaveGamePrompt = ref(false);
const leaveGamePromptMessage = computed(() => gameStore.isPlaying.value
  ? 'The game is saved. You do not concede or forfeit.'
  : 'You will stop spectating. The game is saved.');


/** Astra 10-06 (N1): the game the Return-to-Menu prompt was opened for. A confirm only ever leaves THAT game - a prompt
 *  outliving it (the client walkthrough left its demo underneath) can never leave a match that arrived later. */
type GameIdentity = { gameId: unknown; demo: boolean; server: string | null };
let leaveGamePromptFor: GameIdentity | null = null;
/** The loaded game: its id, whether it is the demo, and the server it came from (Astra: ids collide across servers). */
function currentGameIdentity(): GameIdentity | null {
  const game = gameStore.game.value;
  if (!game) return null;
  const conn = gameStore.connectionTarget();
  return { gameId: (game as { gameId?: unknown }).gameId ?? null, demo: !!gameStore.state.demoMode, server: conn ? `${conn.mode}|${conn.url}` : null };
}
function sameGame(a: GameIdentity, b: GameIdentity): boolean {
  return String(a.gameId) === String(b.gameId) && a.demo === b.demo && a.server === b.server;
}
/** A different game taking the window (a JNLP join, a reconnect onto another server, the demo going) closes a
 *  Return-to-Menu prompt opened for the previous one; the game going away for a reconnect keeps it. */
watch(() => gameStore.game.value, (game) => {
  if (!leaveGamePrompt.value || !game || !leaveGamePromptFor) return;
  const now = currentGameIdentity();
  if (now && !sameGame(now, leaveGamePromptFor)) cancelLeaveGame();
});
function requestLeaveGame() {
  // Registry-owned as a client-local dialog: opening this gate never resolves or
  // synthesizes a server dialog/wire command.
  if (leaveGameDialog?.handling !== 'client-local-only') return;
  leaveGamePromptFor = currentGameIdentity();
  leaveGamePrompt.value = true;
}

function cancelLeaveGame() {
  leaveGamePrompt.value = false;
  leaveGamePromptFor = null;
}

function confirmLeaveGame() {
  const now = currentGameIdentity();
  const meant = leaveGamePromptFor;
  leaveGamePromptFor = null;
  // A dropped connection being re-joined for the prompt's game: the coach still means to leave it - leaving cancels the
  // reconnect (as it did before the stale-prompt guard).
  const target = gameStore.reconnectTarget();
  const reconnectingMeant = !now && !!meant && !meant.demo && meant.gameId != null && !!target
    && String(target.gameId) === String(meant.gameId) && `${target.mode}|${target.url}` === meant.server;
  if (!reconnectingMeant && (!now || !meant || !sameGame(now, meant))) {
    leaveGamePrompt.value = false; // stale prompt: the game it was opened for is gone
    return;
  }
  leaveGamePrompt.value = false;
  ui.gameMenuOpen = false;
  statsOpen.value = false;
  gameStore.leaveGame();
  // Teardown first so the live-game render precedence and hidden blade ribbon are gone
  // before selecting Play (the console shell's landing blade, owner ruling: Hub deprecated).
  selectBlade('play');
}

/** Owner 08-19: endgame exits (spectate pair + the player card's Return to Menu) — the confirm-free
 *  leave-game path (the game is over, nothing to concede) landing in the BLADE shell per
 *  endGameExitPlan: menu → Play-blade home, browser → Spectate blade (SpectateBrowserView).
 *  browserOpen stays false — the legacy in-game browser overlay is deprecated as an endgame target. */
function onEndGameExit(exit: EndGameExit) {
  const plan = endGameExitPlan(exit);
  leaveGamePrompt.value = false;
  ui.gameMenuOpen = false;
  statsOpen.value = false;
  gameStore.leaveGame();
  view.value = plan.view;
  ui.browserOpen = plan.browserOpen;
}

function escLeaveGame(event: KeyboardEvent) {
  if (event.code !== 'Escape' || !leaveGamePrompt.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  cancelLeaveGame();
}

watch(leaveGamePrompt, (open) => {
  if (open) window.addEventListener('keydown', escLeaveGame, true);
  else window.removeEventListener('keydown', escLeaveGame, true);
});
onBeforeUnmount(() => window.removeEventListener('keydown', escLeaveGame, true));

function captureKey(event: KeyboardEvent) {
  if (capturingBinding.value) { captureBindingKey(event); return; }
  if (!capturingKey.value) return;
  event.preventDefault();
  event.stopPropagation();
  keybindRefusal.value = '';
  if (event.code !== 'Escape') {
    const refusal = hotkeyConflict(capturingKey.value, event.code, settings);
    if (refusal) keybindRefusal.value = refusal;
    else settings[capturingKey.value] = event.code;
  }
  capturingKey.value = null;
}

// ---------------------------------------------------------------------------------------------------------------
// Controller support P1 (owner 10-07, spec-controller-support.md): Settings > Controls binding table, the pad poller,
// the controller router (same action handlers as the keys), main-screen actions and the connect / disconnect toast.
const BINDING_METHODS: readonly BindingMethod[] = ['keyboard', 'controller'];
const BINDING_SLOTS: readonly BindingSlot[] = ['primary', 'secondary'];
/** The cell waiting for a key / button (null = none). */
const capturingBinding = ref<{ id: ControlActionId; method: BindingMethod; slot: BindingSlot } | null>(null);
const bindingRefusal = ref('');
const bindingConflicts = computed(() => findBindingConflicts(settings));
function bindingFixedLabel(id: ControlActionId, method: BindingMethod): string {
  const action = controlAction(id);
  return (method === 'keyboard' ? action.keyboardFixed : action.controllerFixed) ?? '';
}
function isCapturingBinding(id: ControlActionId, method: BindingMethod, slot: BindingSlot): boolean {
  const c = capturingBinding.value;
  return !!c && c.id === id && c.method === method && c.slot === slot;
}
function bindingCellText(id: ControlActionId, method: BindingMethod, slot: BindingSlot): string {
  if (isCapturingBinding(id, method, slot)) return method === 'keyboard' ? 'press a key…' : 'press a button…';
  const input = getBinding(settings, id)[method][slot];
  if (!input && method === 'keyboard' && slot === 'primary') {
    // Astra review P2.8: migration kept the coach's existing key over this new action's default.
    const note = legacyCollisionNote(settings, id);
    if (note) return `unbound (your ${keyLabel(note.key)} key kept ${controlAction(note.keptBy).label})`;
  }
  if (!input) return '—';
  return method === 'keyboard' ? keyLabel(input) : controllerInputLabel(input);
}
/** The pre-registry Keyboard table's test hooks, kept on the same cells (Roster / Log keyboard primary). */
function legacyBindTestId(id: ControlActionId, method: BindingMethod, slot: BindingSlot): string | undefined {
  if (method !== 'keyboard' || slot !== 'primary') return undefined;
  return id === 'roster' ? 'roster-key-bind' : id === 'logExpand' ? 'log-key-bind' : undefined;
}
/** Fixed shortcuts (not rebindable) — listed read-only under the bindings table. */
const FIXED_SHORTCUT_ROWS: readonly { label: string; keys: string }[] = [
  { label: 'Clear selection / close', keys: 'Esc' },
  { label: 'Pick action 1–6 (selected player)', keys: '1 – 6' },
  { label: 'Camera pan', keys: 'W A S D / Arrows' },
  { label: 'Open chat', keys: 'Enter' },
  { label: 'Toggle fullscreen', keys: 'F11 / Alt + Enter' },
  { label: 'Mark square / player', keys: 'Shift + click' },
  { label: 'Mark row · column', keys: 'Ctrl+Shift · Alt+Shift + click' },
];
/** Capture: B held this long cancels; a shorter B press binds B. */
const CAPTURE_CANCEL_HOLD_MS = 600;
let captureBHoldTimer: ReturnType<typeof setTimeout> | null = null;
/** The pad whose B started the hold (Astra B3: the floor moving to another pad cancels the hold, not the capture). */
let captureBHoldPad: number | null = null;
function clearCaptureBHold(): void { if (captureBHoldTimer) clearTimeout(captureBHoldTimer); captureBHoldTimer = null; captureBHoldPad = null; }
function startBindingCapture(id: ControlActionId, method: BindingMethod, slot: BindingSlot): void {
  clearCaptureBHold();
  routePadEvent.neutralise(); // Astra review P1: a capture never leaves the camera gliding
  if (!isBindingEditable(id, method)) return;
  capturingKey.value = null;
  bindingRefusal.value = '';
  capturingBinding.value = { id, method, slot };
}
function commitBinding(input: string): void {
  const c = capturingBinding.value;
  if (!c) return;
  capturingBinding.value = null;
  const refusal = controlBindingConflict(c.id, c.method, c.slot, input, settings);
  if (refusal) { bindingRefusal.value = refusal; return; }
  setBinding(settings, c.id, c.method, c.slot, input);
}
/** Backspace / Delete clears a secondary binding (a primary keeps its value). */
function clearCapturedSecondary(): void {
  const c = capturingBinding.value;
  capturingBinding.value = null;
  if (c?.slot === 'secondary') setBinding(settings, c.id, c.method, c.slot, '');
}
function captureBindingKey(event: KeyboardEvent): void {
  const c = capturingBinding.value;
  if (!c) return;
  event.preventDefault();
  event.stopPropagation();
  bindingRefusal.value = '';
  if (event.code === 'Escape') { capturingBinding.value = null; return; }
  if (event.code === 'Backspace' || event.code === 'Delete') { clearCapturedSecondary(); return; }
  if (c.method === 'keyboard') commitBinding(event.code);
  // a controller cell ignores other keys (the pad answers it)
}
/** Pad input while a cell captures. Uniform across methods: holding B (600 ms) cancels any cell, Esc too. In a
 *  controller cell a short B press binds B, a chord commits on the chord press, and a bare LT / RT is refused (reserved
 *  chord modifiers — Astra review P2.6). A keyboard cell ignores every other pad input. */
function captureBindingPad(event: PadEvent): boolean {
  const c = capturingBinding.value;
  if (!c) return false;
  // Another pad took the floor mid-hold: its B release will never arrive — drop the hold, keep the capture open.
  if (captureBHoldTimer && 'pad' in event && event.pad !== captureBHoldPad) clearCaptureBHold();
  if (event.type === 'press') {
    if (event.input === 'B') {
      clearCaptureBHold();
      captureBHoldPad = event.pad;
      captureBHoldTimer = setTimeout(() => { captureBHoldTimer = null; captureBHoldPad = null; capturingBinding.value = null; }, CAPTURE_CANCEL_HOLD_MS);
      return true;
    }
    // A keyboard cell ignores pad input. LB (chord modifier) and the bare triggers are judged on release / by their
    // gesture; a trigger's hold gesture never binds (its tap form carries both).
    if (c.method !== 'controller' || ['LB', 'LT', 'RT'].includes(event.input) || /\(hold\)$/.test(event.input)) return true;
    clearCaptureBHold();
    bindingRefusal.value = '';
    commitBinding(event.input);
  } else if (event.type === 'release') {
    if (event.input === 'B' && captureBHoldTimer) {
      clearCaptureBHold();
      if (c.method !== 'controller') return true; // a keyboard cell keeps waiting for a key
      bindingRefusal.value = '';
      commitBinding('B');
    } else if (c.method === 'controller' && event.input === 'LB' && !event.wasModifier) {
      clearCaptureBHold();
      bindingRefusal.value = '';
      commitBinding('LB'); // LB pressed and released alone (held + another button captured the chord instead)
    } else if (c.method === 'controller' && (event.input === 'LT' || event.input === 'RT') && !event.wasModifier) {
      // Held past the tap window with nothing else: the trigger binds as its tap gesture, not a plain press.
      capturingBinding.value = null;
      bindingRefusal.value = `${event.input} binds as a quick tap (tap = one step, hold = continuous) — tap it`;
    }
  }
  return true;
}
function resetBindings(): void {
  clearCaptureBHold();
  capturingBinding.value = null;
  bindingRefusal.value = '';
  resetControlBindings(settings);
}
watch(() => ui.settingsOpen, (open) => { if (!open) { clearCaptureBHold(); capturingBinding.value = null; bindingRefusal.value = ''; } });

/** The main-screen blades in ribbon order (only those the ribbon shows). */
function visibleBlades(): AppView[] {
  const blades: AppView[] = homeBladeEnabled ? ['home'] : [];
  blades.push('play', 'spectate', 'replay');
  if (FORK_EDITION) blades.push('team');
  return blades;
}
/** Main-screen (and app-wide) half of the action dispatcher; the in-game view registers over it. */
/** Astra review P2.2: focus in a text field owns the input (the keyboard path's rule, for pad presses too). */
function focusOwnsTyping(): boolean {
  const el = typeof document !== 'undefined' ? document.activeElement : null;
  return el instanceof HTMLElement && !!el.closest('input, textarea, select, [contenteditable="true"]');
}
function runShellAction(id: ControlActionId, source: 'keyboard' | 'controller'): boolean {
  if (id === 'fullscreen') { void toggleFullscreen(); return true; }
  // Owner 10-13: nothing on the shell acts under the open Report dialog (Start would open Settings over it, a blade key
  // would switch the blade it is reporting from).
  if (shellReportOpen.value && (id === 'gameMenu' || id === 'bladePrev' || id === 'bladeNext')) return false;
  if (id === 'gameMenu') {
    if (settingsEscape()) return true; // Settings (or a modal over it) is open: the same Esc step
    if (gameStore.game.value || ui.setupWizardRerunOpen) return false;
    if (source === 'controller' && !focusOwnsTyping()) { openSettings(); return true; } // spec: Start on the main screen = Settings
    return false; // the keyboard's Esc keeps escConsoleMenu
  }
  if (id === 'bladePrev' || id === 'bladeNext') {
    if (gameStore.game.value || view.value === 'console' || appShellModalOwnsKeyboard(ui.settingsOpen, ui.setupWizardRerunOpen)) return false;
    if (source === 'controller' && focusOwnsTyping()) return false;
    const next = nextInCycle(visibleBlades(), view.value, id === 'bladeNext' ? 1 : -1);
    if (next) selectBlade(next);
    return !!next;
  }
  return false;
}
/** Rebindable keyboard bindings on the main screen (in a game SpectateView's own keydown owns them). */
// ---- Owner 10-13: Report on the blade ribbon ("The Bug report button should be visible on the FUMBBL.Com / Play /
// Spectate / Replay blade menus as well") ----
// The same dialog as in a game (components/BugReportModal.vue): automatic window screenshot (no pitch here), the
// description, the attachments list, Send. No game is loaded on the shell, so the report carries gameId null and the
// MOST RECENT wire log (remembered from the last game, game/bugReportHost.ts), and context.blade says which blade.
const shellReportOpen = ref(false);
const shellReportBusy = ref(false);
const shellReportModal = ref<InstanceType<typeof BugReportModal> | null>(null);
// The store clears its wire-log path when a game is left: remember the last one for a report filed from the shell.
watch(() => gameStore.state.wireLogFile, (path) => { if (path) rememberWireLogFile(path); }, { immediate: true });
// A game taking over the window closes the shell's dialog (the in-game view has its own), and a capture still in flight
// is dropped: it must never open the shell's dialog over the game (Astra P2; closing alone does not reach a capture
// that has not opened the dialog yet).
watch(() => !!gameStore.game.value, (inGame) => {
  if (!inGame) return;
  shellReportModal.value?.cancelPending();
  shellReportOpen.value = false;
});
// ui.reportOpen: the fork dev console stands down under the report (the same mirror SpectateView keeps in a game).
watch(shellReportOpen, (open) => { ui.reportOpen = open; });
const shellReportHost = createShellReportHost({ blade: () => view.value, settings, state: gameStore.state });
const shellReportTitle = computed(() => `Report an issue (from the ${bladeLabel(view.value)} blade)`);
function openShellReport(): void {
  shellReportModal.value?.openReport();
}
function onShellReportSent(info: { wireLogAttached: boolean }): void {
  showCornerNotice('report', `🐞 Report sent, thanks!${info.wireLogAttached ? ' Your most recent game log went with it.' : ''}`, 4000);
}

function onShellActionKey(event: KeyboardEvent): void {
  // Owner 10-13 (Astra P1): the open Report dialog owns the keyboard. Keys typed inside it never get here (its root
  // stops them); a key whose target is outside it (body, or a blade button tabbed to) gets no native Enter / Space
  // activation (no selectBlade under the dialog), and Tab comes back into the report.
  if (shellReportOpen.value) { onReportOwnedKey(event, shellReportModal.value?.root ?? null); return; }
  if (gameStore.game.value || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (appShellModalOwnsKeyboard(ui.settingsOpen, ui.setupWizardRerunOpen) || capturingKey.value || capturingBinding.value) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  // Astra review P2.7: a key bound in two contexts (Zoom out in game + Previous blade here) tries each, like the pad.
  for (const id of actionsForInput(settings, 'keyboard', event.code)) {
    if (dispatchControlAction(id, 'keyboard')) { event.preventDefault(); return; }
  }
}

/** Settings > Controls live stick readout (after the deadzone) — owner round 2. */
const stickReadout = reactive({ connected: 0, left: { x: 0, y: 0 }, right: { x: 0, y: 0 } });
function trackStickReadout(event: PadEvent): void {
  if (event.type === 'connected') stickReadout.connected++;
  else if (event.type === 'disconnected') stickReadout.connected = Math.max(0, stickReadout.connected - 1);
  else if (event.type === 'stick') stickReadout[event.stick] = { x: event.x, y: event.y };
}
const fmtAxis = (v: number): string => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);

/** Owner (10-07): the 1.5 s corner notice on each auto input switch, and the disconnect toast (game/cornerNotice.ts;
 *  owner 10-10: the same chip says "Player portraits on / off"). */
const controllerToast = cornerNotice;
const showControllerToast = showCornerNotice;
/** Controller support P2a (owner o66mg): hide / show the OS cursor at the window level (immediate, unlike CSS). */
let nativeCursorVisible = true;
async function setNativeCursorVisible(visible: boolean): Promise<void> {
  if (!inTauri || nativeCursorVisible === visible) return;
  nativeCursorVisible = visible;
  try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().setCursorVisible(visible); } catch { /* API unavailable */ }
}
/** Owner 10-10: controller support is opt-in. The switcher reads the EFFECTIVE method: the coach's choice while the
 *  box is ticked, the mouse / keyboard pin while it is not (game/controllerRuntime.ts). */
const controllerInputSettings = {
  get inputMethod() { return effectiveInputMethod(settings); },
  get showInputSwitchNotice() { return settings.showInputSwitchNotice; },
};
/** Astra 10-10: put the cursor back whatever the cached state says (window blur while the pad hid it, the box being
 *  unticked). Only ever called while / right after controller support was on. */
function restoreCursor(): void {
  if (typeof document !== 'undefined') bodyCursorHider(document.body)(false);
  nativeCursorVisible = false; // force the native call through
  void setNativeCursorVisible(true);
}
const inputSwitcher = createInputSwitcher({
  settings: controllerInputSettings,
  showNotice: (text, durationMs) => showControllerToast('switch', text, durationMs),
  setCursorHidden: (hidden) => {
    if (typeof document !== 'undefined') bodyCursorHider(document.body)(hidden);
    // Owner o66mg: the OS cursor must vanish at once — WebView2 only re-reads CSS `cursor` on the next mouse event
    // (which would switch back to the mouse), so the native window hides it too. Browser build: CSS only.
    void setNativeCursorVisible(!hidden);
  },
  // Astra review P1: leaving the controller (auto switch or a pin) drops any pad pan at once.
  onChange: (next) => { if (next !== 'controller') routePadEvent.neutralise(); },
});
const routePadEvent = createControllerRouter({
  settings,
  switcher: inputSwitcher,
  showToast: (text, durationMs) => showControllerToast('disconnect', text, durationMs),
  showConnectToast: (text, durationMs, standard) => showControllerToast(standard ? 'connect' : 'nonstandard', text, durationMs),
  capture: captureBindingPad,
});
inputSwitcher.sync();
watch(() => effectiveInputMethod(settings), () => inputSwitcher.sync());
/** Owner 10-10: everything that listens to a gamepad lives in this runtime and runs ONLY while Settings > Controls
 *  "Enable controller support" is ticked (default off). Off = no poller, no gamepad / mouse-use listeners, no pad
 *  interceptor, no rumble; unticking unwinds it all at once. */
const controllerRuntime = createControllerRuntime({
  inputTarget: window,
  switcher: inputSwitcher,
  router: routePadEvent,
  pollerOptions: () => ({ deadzoneLeft: settings.stickDeadzoneLeft, deadzoneRight: settings.stickDeadzoneRight }),
  onPadEvent: trackStickReadout,
  restoreCursor,
  // Controller support P2b: rumble on dice / turnover / casualty cues (Settings > Controls "Rumble").
  onSoundCue: (id) => { hapticForSound(id, { enabled: () => settings.controllerRumble && activeInput.value === 'controller', pads: browserHapticPads }); },
  onStopped: () => {
    clearCaptureBHold();
    if (capturingBinding.value?.method === 'controller') capturingBinding.value = null; // its column is gone
    stickReadout.connected = 0;
    stickReadout.left = { x: 0, y: 0 };
    stickReadout.right = { x: 0, y: 0 };
    hideControllerNotices();
  },
});
/** The opt-in box: ticking asks first (the owner's notice), the setting turns on only on its OK. */
const controllerOptIn = createControllerOptIn(settings);
function onControllerBoxChange(event: Event): void {
  const box = event.target as HTMLInputElement;
  const checked = box.checked;
  controllerOptIn.boxChanged(checked);
  box.checked = settings.controllerSupportEnabled; // the box shows the SETTING: still off until the notice is acknowledged
}
watch(() => ui.settingsOpen, (open) => { if (!open) controllerOptIn.dismiss(); });
const controllerNoticeOk = ref<HTMLButtonElement | null>(null);
const controllerNoticeDialog = ref<HTMLElement | null>(null);
/** Astra P3 10-10: Tab / Shift+Tab stay inside the notice (it is modal over Settings). The dialog's own keydown trap
 *  covers focus inside it; this capture listener pulls a Tab pressed with focus anywhere else back to the OK button. */
function trapControllerNoticeTab(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !controllerOptIn.noticeOpen.value) return;
  const dialog = controllerNoticeDialog.value;
  if (dialog && dialog.contains(document.activeElement)) return; // the dialog's own trap handles it
  event.preventDefault();
  event.stopPropagation();
  controllerNoticeOk.value?.focus();
}
watch(controllerOptIn.noticeOpen, (open) => {
  if (open) window.addEventListener('keydown', trapControllerNoticeTab, true);
  else window.removeEventListener('keydown', trapControllerNoticeTab, true);
});
watch(controllerOptIn.noticeOpen, (open) => { if (open) void nextTick(() => controllerNoticeOk.value?.focus()); });
/** The binding table's columns: the controller pair only while controller support is on. */
const bindingMethods = computed<readonly BindingMethod[]>(() => (settings.controllerSupportEnabled ? BINDING_METHODS : ['keyboard']));
/** ... and its rows: the pad-only actions (crosshair, setup bumpers, ...) are listed only while it is on. */
const shownControlActions = computed(() => CONTROL_ACTIONS.filter((action) => settings.controllerSupportEnabled || !isPadOnlyAction(action.id)));
/** Owner 10-10: a keyboard cell also captures the middle mouse button (never the left or right button). */
function captureBindingMouse(event: MouseEvent): void {
  const c = capturingBinding.value;
  if (!c || c.method !== 'keyboard') return;
  const input = mouseButtonInput(event.button);
  if (!input) return;
  event.preventDefault(); // no autoscroll
  event.stopPropagation();
  bindingRefusal.value = '';
  commitBinding(input);
}
let offShellActions: (() => void) | null = null;
let stopControllerGate: (() => void) | null = null;
onMounted(() => {
  offShellActions = registerActionHandler(runShellAction);
  window.addEventListener('keydown', onShellActionKey);
  stopControllerGate = watch(() => settings.controllerSupportEnabled, (on) => {
    if (on) controllerRuntime.start(); else controllerRuntime.stop();
  }, { immediate: true, flush: 'sync' });
});
onBeforeUnmount(() => {
  offShellActions?.();
  window.removeEventListener('keydown', onShellActionKey);
  stopControllerGate?.();
  stopControllerGate = null;
  controllerRuntime.stop();
  window.removeEventListener('keydown', trapControllerNoticeTab, true);
  clearCaptureBHold(); // Astra review P3
  bodyCursorHider(document.body)(false);
  hideCornerNotice();
});
</script>

<template>
  <main v-if="!firstOpenGateOpen" class="shell" :class="{ 'cb-accent': colorblindAccent, 'shell--in-game': !!gameStore.game.value }" :style="colorblindFilterStyle">
    <!-- Owner 09-10: colourblind correction filters (daltonization: the channel difference a dichromat cannot see is
         shifted into channels they can). Applied as a CSS filter on the shell, so the WebGL pitch and the DOM get the
         same treatment with no asset conversion. Matrices = I + M·(I − S), S = Machado 2009 full-severity simulation. -->
    <!-- Owner 10-06: the matrices live in game/colorblindFilters.ts (shared with the FUMBBL.COM site webview). -->
    <svg class="cb-filter-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <filter v-for="mode in COLORBLIND_FILTER_MODES" :id="`cb-${mode}`" :key="mode" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" :values="COLORBLIND_MATRICES[mode]" /></filter>
    </svg>
    <!-- Owner 10-12: the circuit-board header strip is gone from the console shell (the blade ribbon is the menu bar
         now); the Super FUMBBL logo plate and the BETA stamp moved to the ribbon's right end (below). Only the Classic
         in-game view keeps its compact header plate, unchanged (Classic is Pellaeon's lane). -->
    <header v-if="gameStore.game.value && settings.uiMode === 'classic'" class="shell-header header-compact">
      <div class="server-switcher" role="group" aria-label="Server">
        <div class="server-plate server-plate-super server-plate-inert" aria-label="Super FUMBBL">
          <img :src="superFumbblLogoUrl" alt="Super FUMBBL" />
        </div>
      </div>
    </header>

    <!-- Fives integration (risk-b): the blade ribbon is the console shell nav — HIDE it during a live game so it
         doesn't steal ~42px above the pitch AND so a mid-game blade click can't desync `view` under the live-game
         render precedence (which always wins while gameStore.game is set). The in-game menu (☰) owns navigation then. -->
    <!-- Owner ruling (console shell restructure): the ribbon is ONE merged blade tree — Hub is gone (Play is
         the landing blade for both server plates), and the fork-only blades (Team/League/Players/Store) stay
         reachable alongside Play/Spectate/Replay rather than swapping out under a second parallel branch. -->
    <nav v-if="!gameStore.game.value" class="blade-ribbon" aria-label="Console views">
      <!-- Owner 10-12: the Super FUMBBL logo plate sits first at the ribbon's left edge (moved from the retired header
           strip). Inert branding (owner 08-18: a logo, not a button). It binds a logo mip level so the "FANTASY
           FOOTBALL" line stays crisp at any DPR. -->
        <div class="server-plate server-plate-super server-plate-inert ribbon-logo-plate" aria-label="Super FUMBBL">
          <img ref="ribbonLogo" :src="ribbonLogoSrc" alt="Super FUMBBL" />
        </div>
      <template v-if="view === 'console'">
        <button class="blade" type="button" :data-active="true" @click="view = 'console'">Protocol console</button>
      </template>
      <template v-else>
        <!-- Owner 10-05: FUMBBL.COM > Play > Spectate (every edition since 10-06). -->
        <button v-if="homeBladeEnabled" class="blade" type="button" :data-active="view === 'home'" data-tour="blade-home" @click="selectBlade('home')">FUMBBL.COM</button>
        <button class="blade" type="button" data-tour="blade-play" :data-active="view === 'play'" @click="selectBlade('play')">Play</button>
        <button class="blade" type="button" data-tour="blade-spectate" :data-active="view === 'spectate'" @click="selectBlade('spectate')">Spectate</button>
        <!-- Owner 10-06 (replay pane revamp): the Replay blade is in BOTH editions again, after Play / Spectate — its
             search finds any coach's games or a game id (owner 09-25 had made it fork-only; reverse here if wanted). -->
        <button class="blade" type="button" data-tour="blade-replay" :data-active="view === 'replay'" @click="selectBlade('replay')">Replay</button>
        <template v-if="FORK_EDITION">
        <span class="blade-ribbon-sep" aria-hidden="true"></span>
        <button class="blade" type="button" :data-active="view === 'team'" @click="selectBlade('team')">Team</button>
        </template>
        <!-- Tournaments / Statistics ribbon entries pulled (owner 09-07: "for now") — like the League/Players/Store
             entries removed 08-18 ("scope those back in later"): AppView values + mounts kept for the return; the
             scheduled-match notification can still route to the tournaments view. -->
      </template>
      <!-- Owner 10-12: BETA stamp right after the last blade (Replay, or Team in the fork edition). -->
      <span class="alpha-stamp ribbon-beta" aria-label="Beta release">BETA</span> <!-- owner 09-24: was ALPHA RELEASE -->
      <!-- Owner 10-13: Report on every blade, both editions, at the ribbon's right edge (the blades stay left). -->
      <button class="ribbon-report" type="button" data-testid="ribbon-report" :title="shellReportTitle"
        :disabled="shellReportOpen" @click="openShellReport"><span class="ribbon-report-bug" aria-hidden="true">🐞</span> Report</button>
    </nav>
    <BugReportModal ref="shellReportModal" v-model:open="shellReportOpen" v-model:busy="shellReportBusy"
      :host="shellReportHost" @sent="onShellReportSent" />

    <input ref="replayFileInput" type="file" hidden
      accept="application/json,application/x-java-jnlp-file,text/xml,.json,.ffbreplay,.jnlp"
      aria-hidden="true" tabindex="-1" @change="loadReplayFileFromMenu" @cancel="cancelReplayFilePicker" />
    <div v-if="ambiguousJnlpEntry" class="launch-splash" role="alertdialog" aria-modal="true"
      aria-labelledby="jnlp-choice-title">
      <div class="splash-content">
        <h2 id="jnlp-choice-title">Open this JNLP as replay or live?</h2>
        <p>The JNLP does not match one unique upstream launch shape: {{ ambiguousJnlpEntry.request.entryClassification.reason }}</p>
        <div class="splash-actions">
          <button type="button" @click="chooseAmbiguousJnlp('replay')">Replay</button>
          <button type="button" @click="chooseAmbiguousJnlp('live')">Live</button>
          <button type="button" data-testid="jnlp-choice-cancel" @click="cancelAmbiguousJnlp()">Cancel</button>
        </div>
      </div>
    </div>
    <div v-if="replayFileError" class="replay-file-alert" role="alert" aria-live="assertive">
      <span>{{ replayFileError }}</span>
      <button type="button" aria-label="Dismiss replay file error" @click="replayFileError = ''">×</button>
    </div>

    <!-- owner 2026-07-08 (FC): view-layer fork — the FUMBBL-Classic presentation
         mounts instead of SpectateView when the mode is set (shared store). -->
    <!-- Owner 09-23: the art pack must be installed before the pitch draws (split builds); see startArtPackSync. -->
    <div v-if="!!gameStore.game.value && !artPack.ready" class="art-pack-wait" role="status" aria-live="polite">
      <template v-if="artPack.error">
        <h3>Art pack download failed</h3>
        <p class="hint">{{ artPack.error }}</p>
        <button class="primary" type="button" @click="startArtPackSync()">Retry</button>
      </template>
      <template v-else>
        <h3>Downloading the art pack…</h3>
        <p class="hint">{{ artPack.done }} / {{ artPack.total }} parts · {{ formatMb(artPack.downloadedBytes) }} of {{ formatMb(artPack.pendingBytes) }}<template v-if="artPack.current"> · {{ artPack.current }}</template></p>
        <div class="art-pack-bar"><div class="art-pack-fill" :style="{ width: artPack.pendingBytes ? (100 * artPack.downloadedBytes / artPack.pendingBytes) + '%' : '0%' }" /></div>
      </template>
    </div>
    <template v-if="!!gameStore.game.value && artPack.ready">
      <component :is="ClassicView" v-if="ClassicView && settings.uiMode === 'classic' && !gameStore.isReplay.value" :mode="liveGameMode as 'play' | 'spectate'" @select-mode="selectMode" />
      <SpectateView v-else ref="spectateViewRef" :mode="liveGameMode" @end-game-exit="onEndGameExit" />
    </template>
    <!-- Owner ruling (console shell restructure): Play blade is up for BOTH server plates — the "PLAY ON
         SUPER FUMBBL" entry card (CreateGameModal) replaces the old fork stopgap that routed here into
         SpectateView's play mode. Hub is deprecated — its dashboard was placeholder-only (no live target
         for Next Match / Team Snapshot / Upcoming Matches / the three Quick Action buttons), so it retires
         with no migration rather than adding dead weight to Play. -->
    <!-- Owner: the current BUILD survives clicking away — the blade switch rides inside a KeepAlive that
         caches ONLY TeamBuilderView (include filter; every other blade mounts/unmounts exactly as before),
         so returning to Team restores the draft (slots, name, mode, pack, skills) instead of a reset.
         Entering a live game unmounts the KeepAlive (the game branch above) — that edge drops the draft. -->
    <!-- Owner 09-17: a join that is still waiting for the other coach loads the BOARD with the waiting modal over
         it, instead of sitting on the console shell until the game state arrives. -->
    <WaitingBoardView v-else-if="gameStore.state.waitingForMatch" />
    <KeepAlive v-else include="TeamBuilderView">
      <component :is="FumbblHomePane" v-if="FumbblHomePane && view === 'home'" />
      <PlayView v-else-if="view === 'play'" ref="playViewRef" />
      <SpectateBrowserView v-else-if="view === 'spectate'" :tour-example="ui.clientTourActive" @spectate="openSpectateGame" />
      <ReplayLauncherView v-else-if="view === 'replay'" />
      <TeamBuilderView v-else-if="FORK_EDITION && view === 'team'" :initial-mode="tournamentBuilderPackage ? 'tournament' : 'create'" :initial-package-name="tournamentBuilderPackage" :launch-revision="tournamentBuilderLaunchRevision" />
      <TournamentsView v-else-if="FORK_EDITION && view === 'tournaments'" @create-team="openTournamentTeamBuilder" />
      <StatisticsView v-else-if="FORK_EDITION && view === 'statistics'" />
      <div v-else-if="view === 'league'" class="ui-placeholder">League — Place Holder</div>
      <div v-else-if="view === 'players'" class="ui-placeholder">Players — Place Holder</div>
      <div v-else-if="view === 'store'" class="ui-placeholder">Store — Place Holder</div>
      <ProtocolConsole v-else />
    </KeepAlive>

    <!-- Owner 08-18 sighting fix: a spectate connect failure previously left NO trace anywhere the
         user could see — the joinError/connectionClosed overlays live inside SpectateView.vue, which
         only mounts once gameStore.game is set, and a failed connect never sets game (App.vue falls
         back to SpectateBrowserView instead, looking as if nothing happened). This modal renders at
         the app-shell level, keyed on gameStore.state.spectateConnectError, so every silent-death
         path (socket refused/errored before open, join timeout, close before a game arrived) is
         visible regardless of which blade is showing. Reuses the save-prompt modal idiom (W30). -->
    <div v-if="!gameStore.game.value && gameStore.state.spectateConnectError" class="modal-backdrop save-prompt-backdrop"
      @click.self="dismissSpectateError()">
      <div class="save-prompt spectate-error-prompt">
        <h3>Couldn't spectate game {{ gameStore.state.spectateConnectError.gameId }}</h3>
        <p class="hint">{{ gameStore.state.spectateConnectError.message }}</p>
        <p class="hint spectate-error-detail">{{ gameStore.state.spectateConnectError.detail }}</p>
        <div class="save-prompt-actions">
          <button class="primary" @click="retrySpectate()">Retry</button>
          <button @click="dismissSpectateError()">Dismiss</button>
        </div>
      </div>
    </div>

    <!-- Owner 08-18: REJOIN progress/failure modal — same silent-death class as the spectate fix
         above (join overlays live in SpectateView, which never mounts when the join fails before
         a game arrives). App-shell mount so the Play-blade rejoin is visible end-to-end; renders
         nothing unless a tracked rejoin attempt is live (rejoinFlow.ts). -->
    <RejoinProgressModal />

    <!-- Owner 10-08: the floating FUMBBL window - the docked site kept open (small, movable) while another blade, a
         game or a replay is on screen. Shell level, so it survives every view change. Astra 10-08 (P2): it stays IN
         the shell (no Teleport) - the colourblind filter makes the shell one stacking context, and only inside it is
         the frame's z-index (75) below the shell's dialogs, menus and alerts (z >= 80) in every colour mode. The
         opposite of the match-ready popup below, which must be ABOVE the layers on <body> and so lives there. -->
    <component :is="FumbblFloat" v-if="FumbblFloat && fumbblFloatVisible" />

    <!-- owner 2026-07-10: Developer log panel (unlocked by `-dev`, toggled in Settings → Developer). -->
    <DevPanel v-if="settings.devPanelOpen" />

    <!-- Game Menu (Esc; owner 2026-07-02 — first step toward the BB3-style shell) -->
    <div v-if="ui.gameMenuOpen" class="modal-backdrop game-menu-backdrop" @click.self="ui.gameMenuOpen = false">
      <div class="game-menu" :data-wide="statsOpen">
        <!-- Owner 10-11 ("Graduate C"): the menu's title, buttons and hint are lettered by DisplayCaps (Nuffle lead
             letter per word, Graduate small capitals after). Each label stays plain text in its `text`. -->
        <h2><DisplayCaps text="Game Menu" /></h2>
        <template v-if="!statsOpen">
          <button @click="ui.gameMenuOpen = false"><DisplayCaps text="Resume" /></button>
          <button :disabled="!gameStats" :title="gameStats ? '' : 'No game loaded'"
            @click="statsOpen = true"><DisplayCaps text="Game statistics" /></button>
          <button @click="openSettings('general')"><DisplayCaps text="Settings" /></button>
          <!-- Owner 09-10: Help moved here from the retired hamburger; the Protocol console is a fork-edition dev tool. -->
          <button @click="ui.gameMenuOpen = false; guideOpen = true"><DisplayCaps text="Help / Field Manual" /></button>
          <button v-if="FORK_EDITION" @click="openConsole()"><DisplayCaps text="Protocol console" /></button>
          <button :disabled="!gameStore.game.value"
            :title="gameStore.game.value ? '' : 'No game loaded'"
            @click="requestLeaveGame()"><DisplayCaps text="Return to Menu" /></button>
          <!-- Owner 2026-07-06 (note 5): request to concede (play mode only). The
               server confirms via the concedeGame dialog if concession is legal. -->
          <button :disabled="!gameStore.canConcedeGame"
            :title="gameStore.canConcedeGame ? 'Request to concede the game' : 'Available only at the start of your turn'"
            @click="gameStore.concedeGame(); ui.gameMenuOpen = false"><DisplayCaps text="Concede" /></button>
          <p class="hint"><DisplayCaps text="Esc closes" /></p>
        </template>
        <template v-else-if="gameStats">
          <div class="pg-stats">
            <div class="pg-stats-cols">
              <div class="pg-stat-col pg-bevel" data-side="home">
                <div class="pg-stat-col-head"><img :src="gameStats.home.logo" :alt="gameStats.home.team" /></div>
                <div v-for="row in gameStats.rows" :key="row.key" class="pg-stat-cell pg-h" :data-lead="row.homeLead">{{ row.home }}</div>
              </div>
              <div class="pg-stat-col pg-bevel" data-side="label">
                <div class="pg-stat-col-head"></div>
                <div v-for="row in gameStats.rows" :key="row.key" class="pg-stat-cell pg-stat-label">{{ row.label }}</div>
              </div>
              <div class="pg-stat-col pg-bevel" data-side="away">
                <div class="pg-stat-col-head"><img :src="gameStats.away.logo" :alt="gameStats.away.team" /></div>
                <div v-for="row in gameStats.rows" :key="row.key" class="pg-stat-cell pg-a" :data-lead="row.awayLead">{{ row.away }}</div>
              </div>
            </div>
          </div>
          <button @click="statsOpen = false"><DisplayCaps text="Back" /></button>
        </template>
      </div>
    </div>

    <!-- W30: reuse the owner-approved compact save-prompt visual. SpectateView's
         yes/no rail is activation-scoped and must not own app-shell navigation. -->
    <!-- Owner 09-23: art-pack progress strip on the console (split builds, first run / after an update). -->
    <div v-if="artPack.split && !artPack.ready && !gameStore.game.value" class="art-pack-strip" role="status" aria-live="polite">
      <template v-if="artPack.error">Art pack download failed — {{ artPack.error }} <button type="button" @click="startArtPackSync()">Retry</button></template>
      <template v-else>Downloading the art pack… {{ artPack.done }} / {{ artPack.total }} parts · {{ formatMb(artPack.downloadedBytes) }} of {{ formatMb(artPack.pendingBytes) }}</template>
    </div>
    <!-- Owner 09-23: a newer public release exists — one button opens its GitHub page. -->
    <div v-if="updatePrompt" class="modal-backdrop save-prompt-backdrop" data-testid="update-prompt" @click.self="!updateProgress && dismissUpdate()">
      <div class="save-prompt" role="dialog" aria-modal="true" aria-labelledby="update-prompt-title">
        <h3 id="update-prompt-title">Super FUMBBL {{ updatePrompt.version }} is available</h3>
        <!-- Owner 09-25: the in-app path downloads + installs here and relaunches; the fallback opens the release page. -->
        <div v-if="updateProgress" class="update-progress" role="status" aria-live="polite">
          <div class="update-progress-track"><div class="update-progress-fill" :style="{ width: (updatePercent() ?? 100) + '%' }" :data-indeterminate="updatePercent() === null"></div></div>
          <small>{{ updateProgress.phase === 'installing' ? 'Installing… the client restarts when it is done.' : updatePercent() === null ? 'Downloading…' : `Downloading… ${updatePercent()}%` }}</small>
        </div>
        <p v-if="updateNotesText(updatePrompt.notes)" class="update-notes">{{ updateNotesText(updatePrompt.notes) }}</p>
        <p v-if="updateError" class="update-error" role="alert">{{ updateError }}</p>
        <!-- Owner 09-30 (S51): an app patch is installed - Restart reloads the page onto it (the shell keeps running). -->
        <div v-if="patchReady" class="save-prompt-actions">
          <small>Update installed.</small>
          <button class="primary" @click="restartAfterPatch()">Restart</button>
          <button @click="dismissUpdate()">Later</button>
        </div>
        <div v-else-if="!updateProgress" class="save-prompt-actions">
          <button v-if="updatePrompt.inApp && (!updateError || pendingPatch)" class="primary" @click="installUpdateNow()">Update now</button>
          <button v-else class="primary" @click="openUpdateRelease()">Download now</button>
          <button @click="dismissUpdate()">{{ updatePrompt.inApp ? 'Later' : 'Download later' }}</button>
        </div>
      </div>
    </div>

    <div v-if="leaveGamePrompt" class="modal-backdrop save-prompt-backdrop"
      :data-dialog-id="LEAVE_GAME_DIALOG_ID" @click.self="cancelLeaveGame()">
      <div class="save-prompt">
        <h3>Leave the game and return to the menu?</h3>
        <p class="hint">{{ leaveGamePromptMessage }}</p>
        <div class="save-prompt-actions">
          <button class="primary" @click="confirmLeaveGame()">Return to Menu</button>
          <button @click="cancelLeaveGame()">Stay in game</button>
        </div>
      </div>
    </div>

    <!-- Astra 10-06 (N5): on <body>, above the client walkthrough (220) and the disclaimer (12500), which are on <body>
         too - inside the shell a colourblind filter would trap it under them. -->
    <Teleport to="body">
    <div v-if="tournamentNotificationState.active" class="match-ready-popup" role="alertdialog" aria-live="assertive">
      <button class="match-ready-close" type="button" title="Dismiss" @click="dismissTournamentNotification(tournamentNotificationState.active!.id)">✕</button>
      <h3>{{ tournamentNotificationState.active.kind === 'test' ? 'Notification test' : 'Your opponent is waiting' }}</h3>
      <p>{{ tournamentNotificationState.active.message }}</p>
      <button v-if="tournamentNotificationState.active.kind === 'match-waiting'" class="primary" type="button" @click="openTournamentNotification">Open tournament match</button>
    </div>
    </Teleport>
    <div v-if="settingsOpen" class="modal-backdrop" @click.self="requestCloseSettings()"
      @keydown.capture="captureKey" @mousedown.capture="captureBindingMouse" tabindex="-1">
      <!-- owner 2026-07-06: large settings window — left sidebar of categories,
           the selected category's controls fill the scrollable content pane. -->
      <div ref="settingsDialog" class="settings-pane" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title"
        @keydown="trapSettingsFocus">
        <button class="settings-x" type="button" aria-label="Cancel changes and close settings" title="Close settings" @click="requestCloseSettings()">✕</button>
        <SettingsCategoryNav v-model="settingsTab" />

        <div class="settings-main">
          <SettingsCategoryNav v-model="settingsTab" compact @content-focus="selectSettingsTab(settingsTab, true)" />
        <div :id="`settings-panel-${settingsTab}`" class="settings-content" role="tabpanel"
          :aria-labelledby="`settings-tab-${settingsTab}`">
        <h2 tabindex="-1">{{ activeSettingsSection.label }}</h2>
        <!-- ============================ GENERAL ============================ -->
        <section v-if="settingsTab === 'general'">
          <AccountSettings v-if="FORK_EDITION" />

          <fieldset class="settings-group">
            <legend>Discord</legend>
            <label class="row">
              <span>Discord Rich Presence (show my game as my Discord activity)</span>
              <input v-model="settings.discordPresence" type="checkbox" />
            </label>
            <label class="row">
              <span>Let friends join as spectators from Discord (Spectate button)</span>
              <input v-model="settings.discordSpectateInvites" type="checkbox" :disabled="!settings.discordPresence" />
            </label>
          </fieldset>
          <fieldset class="settings-group">
            <legend>Connection</legend>
            <label class="creds-open-row"><!-- owner 09-10: "Login credentials" caption cut -->
              <button type="button" class="creds-open-btn" @click="openCredsMenu('fumbbl')">Manage login credentials ▸</button>
            </label>
            <p class="creds-status">
              <span>FUMBBL: <b>{{ settings.coach.trim() || '—' }}</b></span>
              <span v-if="FORK_EDITION" class="connection-fork-status">
                <span>Super FUMBBL:
                  <b v-if="forkChallenge.kind === 'ok'">✓ {{ settings.coach40k.trim() }}</b>
                  <button
                    v-else
                    type="button"
                    class="creds-challenge-btn"
                    :disabled="forkChallenge.kind === 'checking'"
                    @click="verifyForkCredentials"
                  >{{ forkChallenge.kind === 'checking' ? 'Verifying…' : 'Verify' }}</button>
                </span>
                <span
                  v-if="forkChallenge.kind === 'checking' || forkChallenge.kind === 'warn' || forkChallenge.kind === 'fail'"
                  class="creds-challenge-result"
                  :data-kind="forkChallenge.kind"
                >{{ forkChallenge.message }}</span>
              </span>
            </p>
            <p class="hint">Credentials are stored locally on this machine only.</p>
            <!-- Owner 09-10: the raw server URL is a fork-edition control; the public edition is FUMBBL-only. -->
            <label v-if="FORK_EDITION">Server
              <input v-model="settings.url" placeholder="ws://host:port/command" />
            </label>
            <label v-if="FORK_EDITION">Tournament Bot URL <span class="hint-inline">(optional — blank = https://&lt;fork host&gt;, or http://&lt;local host&gt;:4310)</span>
              <input v-model="settings.botConfigUrl" type="text" placeholder="bot URL (optional)" />
            </label>
            <label v-if="FORK_EDITION" class="row"><input v-model="settings.compression" type="checkbox" /> LZ-String compression</label>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Launch screens</legend>
            <label class="row"><input v-model="settings.hideWelcomeSplash" type="checkbox" /> <span>Hide the welcome splash on launch</span></label>
            <label class="row"><input v-model="settings.hideTutorialSplash" type="checkbox" /> <span>Hide the getting-started tutorial on launch</span></label>
            <div class="actions" style="justify-content: flex-start">
              <button type="button" @click="replayIntro()">Replay the intro screens now</button>
              <button type="button" @click="rerunSetupWizard()">Run first-launch setup again</button>
            </div>
            <!-- Owner 10-06: the FUMBBL.COM walkthrough (game/homeTour.ts). -->
            <div v-if="homeBladeEnabled" class="actions" style="justify-content: flex-start">
              <button type="button" @click="rerunHomeTour()">Run the FUMBBL.COM walkthrough again</button>
            </div>
            <div class="actions" style="justify-content: flex-start">
              <button type="button" @click="rerunClientTour()">Run the client walkthrough again</button>
            </div>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Gameplay assistance</legend>
            <label class="row">
              <span>Tackle zones shown</span>
              <select v-model="settings.tackleZoneMode">
                <option value="opposition">Opposition</option>
                <option value="friendly">Friendly</option>
                <!-- Owner 10-13: Classic (fork only) still draws both teams for 'both', so it keeps the old wording. -->
                <option v-if="ClassicView && settings.uiMode === 'classic'" value="both">Both</option>
                <option v-else value="both" title="Selecting an opposing player shows your tackle zones; selecting your own player shows the opponent's">Relevant to the selected player</option>
              </select>
            </label>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Movement planner</legend>
            <label class="row">
              <span>Declare Blitz</span>
              <select v-model="settings.declareBlitzBehavior">
                <option value="fumbbl">FUMBBL (default)</option>
                <option value="modern">Modern</option>
              </select>
            </label>
            <p class="hint">FUMBBL: declare Blitz from the player context menu. Modern: select your player,
              then an opponent; click the target again (or use Confirm) to commit the previewed route.</p>
            <!-- Owner 09-16: planner colours — Primary = the route line; Secondary = steps that owe a roll. -->
            <label class="row">
              <span>Primary color</span>
              <input v-model="settings.plannerPrimaryColor" type="color" />
            </label>
            <label class="row">
              <span>Secondary color</span>
              <input v-model="settings.plannerSecondaryColor" type="color" />
            </label>
            <p class="hint">Primary draws the planned route. Secondary marks each step that needs a roll — a dodge, a rush or a pickup.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Auras</legend>
            <label class="row">
              <span>Disturbing Presence <em class="aura-swatch dp-friendly" />/<em class="aura-swatch dp-opp" /></span>
              <select v-model="settings.auraDisturbingPresence">
                <option value="selected">On when selected (default)</option>
                <option value="always">Always on</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label class="row">
              <span>Pick-Me-Up <em class="aura-swatch pmu-friendly" />/<em class="aura-swatch pmu-opp" /></span>
              <select v-model="settings.auraPickMeUp">
                <option value="selected">On when selected (default)</option>
                <option value="always">Always on</option>
                <option value="off">Off</option>
              </select>
            </label>
            <p class="hint">Each aura shades a 3-square radius. Colour marks side —
              friendly (home) vs opposition (away): Disturbing Presence blue/red, Pick-Me-Up green/beige.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Mouse</legend>
            <label class="row">
              <input v-model="settings.friendlyPlayerSwitch" type="checkbox" />
              <span>Left click switches friendly players</span>
            </label>
            <p class="hint">Refunds an untouched declaration. After the server confirms any movement, action,
              skill, or effect was consumed, the click ends the current activation without activating the next player.</p>
            <label class="row" data-testid="defer-friendly-switch-end">
              <input v-model="settings.deferFriendlySwitchEnd" type="checkbox" :disabled="!settings.friendlyPlayerSwitch" />
              <span>Hold the previous player's end until the new player is activated</span>
            </label>
            <p class="hint">The first click on another player sends nothing. The previous player's activation ends
              when you click the new player a second time. Clicking anywhere else, right click or Esc cancels.</p>
            <label class="row">
              <input v-model="settings.leftClickOpensContextMenu" type="checkbox" />
              <span>Left click opens context menu</span>
            </label>
            <p class="hint">Shows the selected friendly player's legal actions instead of immediately declaring Move.
              Right click always opens the player context menu; Shift+click marks (see Controls › Keyboard).</p>
          </fieldset>

          <!-- Owner 10-04: every client confirmation prompt has its own line. Off = the gesture goes straight through. -->
          <fieldset class="settings-group" data-testid="confirmation-settings">
            <legend>Confirmations</legend>
            <p class="hint">Each prompt below asks before the client does something that is hard to take back.
              Turn one off and you are no longer asked: the action goes through at once (or, for the concede offer, the question is simply not raised).</p>
            <template v-for="row in CONFIRMATION_SETTING_ROWS" :key="row.key">
              <label class="row">
                <input v-model="settings[row.key]" type="checkbox" />
                <span>{{ row.label }}</span>
              </label>
              <p class="hint">{{ row.hint }}</p>
            </template>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Cinematics</legend>
            <!-- Owner 08-19: "Injury cinematics" retired — cinematicMode had zero consumers (dead since
                 the injury-banner rework); the dropdown promised behavior that no longer exists. -->
            <label class="row">
              <input v-model="settings.clickDismissCinematics" type="checkbox" />
              <span>Require click to dismiss splash screens</span>
            </label>
          </fieldset>

          <fieldset v-if="jnlpAssocSupported" class="settings-group">
            <legend>FUMBBL join files (.jnlp)</legend>
            <p class="hint">
              Opening a FUMBBL <code>.jnlp</code> join/replay link launches this app instead of Java
              Web Start. Per-user setting only — no admin rights needed, and reversible any time.
            </p>
            <p class="settings-immediate-note">This changes Windows immediately and is not undone by Cancel.</p>
            <div class="actions" style="justify-content: flex-start">
              <button type="button" :disabled="jnlpAssocBusy" @click="toggleJnlpAssociation()">
                {{ jnlpAssocOn ? 'Remove .jnlp association' : 'Associate .jnlp files with this app' }}
              </button>
              <span v-if="jnlpAssocOn" class="hint">Currently associated with this app.</span>
            </div>
            <p v-if="jnlpAssocError" class="hint" style="color: var(--danger, #e05555)">{{ jnlpAssocError }}</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Match log</legend>
            <label class="row">
              <input v-model="settings.showServerSequencingEvents" type="checkbox" />
              <span>Show server sequencing events</span>
            </label>
            <p class="hint">Shows internal plan and play steps such as server-resolved movement. Hidden entries remain available and appear immediately when enabled.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Diagnostics</legend>
            <label class="row">
              <input v-model="settings.debugLog" type="checkbox" />
              <span>Verbose log (all events, not just dice rolls)</span>
            </label>
            <!-- Owner 09-10: the wire-log file + dev panel toggles are fork-edition diagnostics; the public edition keeps
                 the wire log ON silently (it rides bug reports) and never shows the panel. -->
            <template v-if="FORK_EDITION">
            <label class="row">
              <input v-model="settings.wireLog" type="checkbox" />
              <span>Verbose wire log → file (one per game)</span>
            </label>
            <div v-if="settings.wireLog" style="margin: 2px 0 4px 24px;">
              <template v-if="gameStore.state.wireLogFile">
                <input type="text" readonly :value="gameStore.state.wireLogFile"
                  @focus="($event.target as HTMLInputElement).select()"
                  style="width: 100%; font-size: max(var(--ui-min-text-size, 12px), 11px); padding: 3px 5px; box-sizing: border-box;" />
                <button type="button" @click="copyWireLogPath" style="margin-top: 4px; font-size: max(var(--ui-min-text-size, 12px), 11px);">
                  {{ wireLogCopied ? 'Copied!' : 'Copy path' }}
                </button>
              </template>
              <span v-else class="hint">Writes one JSONL file per game to the app log folder (packaged build only).</span>
            </div>
            <label class="row">
              <input v-model="settings.devPanelOpen" type="checkbox" />
              <span>Show developer log panel</span>
            </label>
            <label v-if="settings.devMode" class="row">
              <span>Coach brain</span>
              <select :value="settings.coachBrain" @change="gameStore.setCoachBrain(($event.target as HTMLSelectElement).value as typeof settings.coachBrain)">
                <option value="none">none</option>
                <option value="random">random</option>
                <option value="fly-chaos">fly-chaos</option>
              </select>
            </label>
            <label v-if="settings.devMode && settings.coachBrain === 'fly-chaos'" class="row">
              <span>Fly brain URL</span>
              <input v-model="settings.flyBrainUrl" type="text" />
            </label>
            <span class="hint">The dev stream is always captured (it rides bug reports); this only shows the live panel.</span>
            </template>
          </fieldset>
        </section>

        <!-- ============================ CONTROLS ============================ -->
        <!-- Controller support P1 (owner 10-07, spec-controller-support.md): input method, every key / button binding. -->
        <section v-if="settingsTab === 'controls'" data-testid="settings-controls">
          <!-- Owner 10-10: controller support is opt-in. Ticking the box asks first (the notice below the Settings
               window); it turns on when the coach presses OK. While off nothing here reads a gamepad. -->
          <fieldset class="settings-group" data-testid="controller-support">
            <legend>Controller</legend>
            <label class="row">
              <input type="checkbox" data-testid="controller-support-enabled" :checked="settings.controllerSupportEnabled"
                @change="onControllerBoxChange" />
              <span>Enable controller support</span>
            </label>
            <p class="hint">Off by default. Controller support is mostly untested; the mouse and keyboard keep working
              when it is on.</p>
          </fieldset>

          <fieldset v-if="settings.controllerSupportEnabled" class="settings-group" data-testid="input-method-group">
            <legend>Input method</legend>
            <label class="row">
              <span>Input method</span>
              <select v-model="settings.inputMethod" data-testid="input-method">
                <option value="auto">Auto (follow the last device used)</option>
                <option value="keyboard">Keyboard</option>
                <option value="controller">Controller</option>
              </select>
            </label>
            <p class="hint">An Xbox-layout pad (or a DualShock / DualSense) runs the same actions as the keys. Auto switches
              to the controller the moment you press a button or move a stick, and back to mouse and keyboard when you move
              the mouse, click, scroll or type. The mouse and keyboard keep working in every mode.</p>
            <label class="row">
              <input v-model="settings.showInputSwitchNotice" type="checkbox" data-testid="input-switch-notice" />
              <span>Show input switch notice</span>
            </label>
            <label class="row">
              <input v-model="settings.controllerRumble" type="checkbox" data-testid="controller-rumble" />
              <span>Rumble (dice, turnovers, casualties)</span>
            </label>
          </fieldset>

          <fieldset v-if="settings.controllerSupportEnabled" class="settings-group" data-testid="stick-deadzones">
            <legend>Stick deadzones</legend>
            <label class="row">
              <span>Left stick deadzone</span>
              <input v-model.number="settings.stickDeadzoneLeft" v-fill-range type="range" :min="STICK_DEADZONE_MIN" :max="STICK_DEADZONE_MAX" step="0.01" data-testid="deadzone-left" />
              <span>{{ settings.stickDeadzoneLeft.toFixed(2) }}</span>
            </label>
            <label class="row">
              <span>Right stick deadzone</span>
              <input v-model.number="settings.stickDeadzoneRight" v-fill-range type="range" :min="STICK_DEADZONE_MIN" :max="STICK_DEADZONE_MAX" step="0.01" data-testid="deadzone-right" />
              <span>{{ settings.stickDeadzoneRight.toFixed(2) }}</span>
            </label>
            <label class="row">
              <span>Crosshair speed</span>
              <input v-model.number="settings.crosshairSpeed" v-fill-range type="range" :min="CROSSHAIR_SPEED_MIN" :max="CROSSHAIR_SPEED_MAX" step="1" data-testid="crosshair-speed" />
              <span>{{ settings.crosshairSpeed }} sq/s</span>
            </label>
            <label class="row">
              <input v-model="settings.crosshairAcceleration" type="checkbox" data-testid="crosshair-acceleration" />
              <span>Crosshair acceleration</span>
            </label>
            <p class="hint">The left stick moves the pitch crosshair at a steady speed; with acceleration on it speeds up to
              twice that while you hold one direction. Precision (L3) halves it.</p>
            <p class="hint stick-readout" data-testid="stick-readout" aria-live="off">
              <template v-if="stickReadout.connected > 0">
                Left x {{ fmtAxis(stickReadout.left.x) }} y {{ fmtAxis(stickReadout.left.y) }} ·
                Right x {{ fmtAxis(stickReadout.right.x) }} y {{ fmtAxis(stickReadout.right.y) }}
              </template>
              <template v-else>No controller seen yet — press a button on the pad to show the live readout.</template>
            </p>
            <ul v-if="connectedPads.length" class="hint connected-pads" data-testid="connected-pads">
              <li v-for="pad in connectedPads" :key="pad.pad" :data-mapping="pad.standard ? 'standard' : 'non-standard'">
                {{ padShortName(pad.id) }} — <strong>{{ pad.standard ? 'standard' : 'non-standard' }}</strong>
                <span v-if="!pad.standard"> (not usable — run the client through Steam Input so it appears as an Xbox pad)</span>
              </li>
            </ul>
            <p class="hint">Raise a deadzone if a resting stick drifts (the readout shows non-zero with the stick
              untouched); lower it for finer control. Output is 0 at the deadzone edge and 1 at full tilt.</p>
          </fieldset>

          <fieldset class="settings-group" data-testid="edit-bindings">
            <legend>Edit Bindings</legend>
            <!-- Owner 10-02 + controller support P1: every binding in one table (action | keyboard | controller).
                 Owner 10-10: the controller columns (and the pad-only actions) show only while controller support is on. -->
            <p v-if="settings.controllerSupportEnabled" class="hint">Click a cell, then press a key or a controller button. Hold LB (or RT) and press another
              button for a chord; LB acts when released, so a plain LB (blade cycling) fires on letting go. LT and RT bind as a quick tap (the same binding zooms continuously while held). Esc, or
              holding B for 0.6 s, cancels any cell; in a controller cell a short B press binds B. Backspace or Delete
              clears a secondary binding. A keyboard cell also takes the middle mouse button.</p>
            <p v-else class="hint" data-testid="bindings-hint-keyboard">Click a cell, then press the new key (the middle mouse button works too). Esc cancels;
              Backspace or Delete clears a secondary binding.</p>
            <table class="keybind-table bindings-table">
              <thead><tr><th scope="col">Action</th><th scope="col" colspan="2">Keyboard / mouse</th><th v-if="settings.controllerSupportEnabled" scope="col" colspan="2">Controller</th></tr></thead>
              <tbody>
                <tr v-for="action in shownControlActions" :key="action.id" :data-action="action.id">
                  <td>{{ action.label }}</td>
                  <template v-for="method in bindingMethods" :key="method">
                    <td v-if="bindingFixedLabel(action.id, method)" colspan="2"><span class="keybind static">{{ bindingFixedLabel(action.id, method) }}</span></td>
                    <template v-else>
                      <td v-for="slot in BINDING_SLOTS" :key="slot">
                        <button type="button" class="keybind binding-cell" :data-binding="`${action.id}:${method}:${slot}`"
                          :data-testid="legacyBindTestId(action.id, method, slot)"
                          :data-capturing="isCapturingBinding(action.id, method, slot)"
                          :aria-label="`${action.label}, ${method} ${slot}: ${bindingCellText(action.id, method, slot)}. Click to rebind.`"
                          @click="startBindingCapture(action.id, method, slot)">{{ bindingCellText(action.id, method, slot) }}</button>
                      </td>
                    </template>
                  </template>
                </tr>
              </tbody>
            </table>
            <p v-if="bindingRefusal" class="hint keybind-refusal" role="status" data-testid="binding-refusal">{{ bindingRefusal }}</p>
            <h4 class="fixed-shortcuts-title">Fixed shortcuts</h4>
            <ul class="fixed-shortcuts" data-testid="fixed-shortcuts">
              <li v-for="row in FIXED_SHORTCUT_ROWS" :key="row.label"><span>{{ row.label }}</span><span class="keybind static">{{ row.keys }}</span></li>
            </ul>
            <p v-for="conflict in bindingConflicts" :key="`${conflict.method}:${conflict.input}`" class="hint keybind-refusal" role="status" data-testid="binding-conflict">
              {{ conflict.method === 'keyboard' ? keyLabel(conflict.input) : controllerInputLabel(conflict.input) }} is bound to more than one action:
              {{ conflict.actions.map((id) => controlAction(id).label).join(', ') }}.</p>
            <div class="row">
              <button type="button" data-testid="reset-bindings" @click="resetBindings()">Reset to defaults</button>
            </div>
            <label class="row">
              <span>Camera pan speed</span>
              <input v-model.number="settings.cameraPanSpeed" v-fill-range type="range" min="2" max="30" step="1" />
              <span>{{ settings.cameraPanSpeed }} px</span>
            </label>
          </fieldset>
        </section>

        <!-- ============================ ACCESSIBILITY ============================ -->
        <section v-if="settingsTab === 'accessibility'">
          <fieldset class="settings-group">
            <legend>Text and contrast</legend>
            <label class="row">
              <span>UI font</span>
              <select v-model="settings.uiFont">
                <option value="nuffle">Nuffle (Blood Bowl)</option>
                <option value="system">System</option>
                <option value="arial">Arial / Helvetica</option>
              </select>
            </label>
            <label class="row">
              <span>Minimum text size</span>
              <input v-model.number="settings.uiTextSize" v-fill-range type="range" min="12" max="20" step="1" />
              <span>{{ settings.uiTextSize }}px</span>
            </label>
            <p class="hint">Sub-headers and annotations are kept at or above this size; primary text never drops below 16px. Raising this past 16 lifts everything together.</p>
            <label class="row">
              <span>Brightness</span>
              <input v-model.number="settings.brightness" v-fill-range type="range" min="50" max="150" step="5" />
              <span>{{ settings.brightness }}%</span>
            </label>
            <label class="row">
              <span>Colourblind mode</span>
              <select v-model="settings.colorblindMode">
                <option value="off">Off</option>
                <option value="deuteranopia">Deuteranopia (red-green, most common)</option>
                <option value="protanopia">Protanopia (red-green)</option>
                <option value="tritanopia">Tritanopia (blue-yellow)</option>
              </select>
            </label>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Grid lines</legend>
            <label class="row">
              <input v-model="settings.gridLines" type="checkbox" />
              <span>Show pitch grid lines</span>
            </label>
            <label class="row">
              <span>Line width</span>
              <input v-model.number="settings.gridLineWidth" v-fill-range type="range" min="0.1" max="3" step="0.1" :disabled="!settings.gridLines" />
              <span>{{ settings.gridLineWidth }}×</span>
            </label>
            <label class="row">
              <span>Line color</span>
              <input v-model="settings.gridLineColor" type="color" :disabled="!settings.gridLines" />
            </label>
            <label class="row">
              <span>Line opacity</span>
              <input v-model.number="settings.gridLineOpacity" v-fill-range type="range" min="0.1" max="1" step="0.05" :disabled="!settings.gridLines" />
              <span>{{ Math.round(settings.gridLineOpacity * 100) }}%</span>
            </label>
            <p class="hint">Turning grid lines off, widening or recolouring them helps legibility over busy pitch textures.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Echos</legend>
            <label class="row">
              <input v-model="settings.activePlayerEcho" type="checkbox" />
              <span>Selection echo (on the active player)</span>
            </label>
            <label class="row">
              <input v-model="settings.clickEcho" type="checkbox" />
              <span>Cursor click echo</span>
            </label>
            <label class="row">
              <span>Echo colour</span>
              <input v-model="settings.clickEchoColor" type="color" :disabled="!settings.clickEcho" />
            </label>
            <label class="row">
              <span>Echo size</span>
              <input v-model.number="settings.echoSize" v-fill-range type="range" min="0.5" max="2" step="0.1" :disabled="!settings.clickEcho" />
              <span>{{ settings.echoSize }}×</span>
            </label>
            <div class="echo-preview" :style="{ '--click-echo-color': settings.clickEchoColor, '--echo-scale': settings.echoSize }">
              <span class="echo-preview-ring"></span>
              <em>preview</em>
            </div>
          </fieldset>
        </section>

        <!-- ============================ DISPLAY ============================ -->
        <section v-if="settingsTab === 'display'">
          <fieldset class="settings-group">
            <legend>Video</legend>
            <label class="row">
              <span>Auto Director (camera follows the action)</span>
              <input v-model="settings.autoDirector" type="checkbox" />
            </label>
            <label class="row">
              <span>Resolution scale</span>
              <select v-model.number="settings.renderScale">
                <option :value="0">Auto (display native)</option>
                <option :value="0.5">50%</option>
                <option :value="0.75">75%</option>
                <option :value="1">100% (display native)</option>
                <option :value="1.5">150%</option>
                <option :value="2">200%</option>
                <option :value="3">300%</option>
                <option :value="4">400%</option>
              </select>
            </label>
            <label class="row">
              <span>FPS limit</span>
              <select v-model="settings.fpsCap">
                <option :value="30">30</option>
                <option :value="60">60</option>
                <option :value="120">120</option>
                <option value="display">{{ matchDisplayLabel(measuredRefreshHz) }}</option>
              </select>
            </label>
            <p class="hint">{{ measuredRefreshHz ? "Match display caps the frame rate at your monitor's refresh rate." : "Match display caps the frame rate at your monitor's refresh rate; measuring it now." }}</p>
            <div class="actions" style="justify-content: flex-start">
              <button @click="toggleFullscreen">{{ fullscreen ? 'Exit native fullscreen' : 'Native fullscreen' }}</button>
            </div>
            <p class="hint">Uses the desktop window's native fullscreen mode{{ fullscreenIsNative ? '.' : '; browser preview uses webpage fullscreen.' }}</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Pitch</legend>
            <label class="row">
              <span>Pitch orientation</span>
              <select v-model="settings.pitchOrientation">
                <option value="ns">North–south (end zones top/bottom)</option>
                <option value="ew">East–west (end zones left/right)</option>
              </select>
            </label>
            <label class="row">
              <input v-model="settings.pitchFlipped" type="checkbox" />
              <span>Flip the pitch view</span>
            </label>
            <label class="row">
              <span>Spectator and replay view</span>
              <select v-model="settings.spectatorView">
                <option value="drive">Follow the drive</option>
                <option value="home">Home team at the bottom</option>
                <option value="away">Away team at the bottom</option>
                <option value="mine">My team at the bottom</option>
              </select>
            </label>
            <label class="row">
              <input v-model="settings.flatRender" type="checkbox" />
              <span>Flat (non-isometric) pitch</span>
            </label>
            <label class="row">
              <input v-model="settings.showStadium" type="checkbox" />
              <span>Stadium</span>
            </label>
            <label class="row">
              <span>Stadium stands</span>
              <select v-model="settings.stadiumStands" :disabled="!settings.showStadium">
                <option value="classic">Classic seats + fans</option>
                <option value="crowd">Baked crowd tiles</option>
              </select>
            </label>
            <label class="row">
              <span>Backdrop</span>
              <select v-model="settings.backdrop" data-testid="backdrop-select">
                <option v-for="o in BACKDROP_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </label>
            <!-- Owner 10-12: CC BY 4.0 - the Hubble credit stays visible and unaltered while the image is chosen. -->
            <p v-if="settings.backdrop === 'galaxy'" class="hint" data-testid="backdrop-galaxy-credit">
              <a :href="GALAXY_BACKDROP_URL" @click.prevent="openExternal(GALAXY_BACKDROP_URL)">{{ GALAXY_BACKDROP_CREDIT }}</a>
            </p>
            <label v-if="settings.backdrop === 'color'" class="row">
              <span>Backdrop colour</span>
              <input v-model="settings.backdropColor" type="color" data-testid="backdrop-color" />
            </label>
            <label class="row">
              <span>Tileset (turf)</span>
              <select v-model="settings.turf">
                <option v-for="t in turfCatalog.options" :key="t" :value="t">{{ TURF_LABELS[t] ?? t }}</option>
              </select>
            </label>
            <label v-if="settings.uiMode === 'classic'" class="row">
              <span>Classic effects</span>
              <input type="checkbox" v-model="settings.classicEffects" />
            </label>
            <p v-if="settings.uiMode === 'classic'" class="hint">Off = the pure classic look. On opts our cinematics (push arrows, turnover…) into FUMBBL Classic.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Player sprites</legend>
            <label class="row">
              <span>Player sprites</span>
              <select v-model="spriteChoice">
                <option value="walk">Super FUMBBL</option>
                <!-- Owner 09-15: the checker discs are ORIGINAL art (67af2368) — offered always, no pack gate. -->
                <option value="checkers">Checkers</option>
                <option value="chess">Chess</option>
                <option v-for="pack in spritePackOptions" :key="pack.installId" :value="spritePackValue(pack)">{{ pack.name }} {{ pack.version }}</option>
              </select>
            </label>
            <!-- Owner 09-15: the Checkers disc letter font. -->
            <label v-if="settings.spriteSet === 'checkers'" class="row">
              <span>Checker letter font</span>
              <select v-model="settings.checkerLetterFont">
                <option value="arial">Arial / Helvetica</option>
                <option value="helvetica">Helvetica / Arial</option>
                <option value="system">System sans</option>
                <option value="nuffle">Nuffle</option>
              </select>
            </label>
            <!-- Owner 09-10: sprite-set explainer paragraph cut. -->
            <label class="row">
              <input v-model="settings.walkAnimation" type="checkbox" />
              <span>Animate player walk cycles</span>
            </label>
            <!-- Owner 09-10: the FPS override row is cut — every walk sheet runs at its authored 10 fps (settings.walkFps stays null). -->
            <label class="row">
              <input v-model="settings.walkFaceCamera" type="checkbox" />
              <span>Idle players face the camera (home team faces south)</span>
            </label>
            <label class="row">
              <input v-model="settings.castShadows" type="checkbox" />
              <span>Cast shadows on players</span>
            </label>
            <!-- Owner 10-03: casualty blood splatters on the pitch can be turned off. -->
            <label class="row">
              <input v-model="settings.bloodSplatters" type="checkbox" data-testid="blood-splatters-toggle" />
              <span>Blood splatters where players are casualtied</span>
            </label>
            <label class="row">
              <input v-model="settings.uniformFigures" type="checkbox" />
              <span>Players stay one size across the pitch (North-South)</span>
            </label>
            <label class="row">
              <input v-model="settings.uniformFiguresEw" type="checkbox" />
              <span>Players stay one size across the pitch (East-West)</span>
            </label>
            <p class="hint">Sprites, dice and markers render at the same scale on every square and the far end of the pitch narrows less. Off is the classic depth scaling. North-South starts off, East-West starts on; each orientation keeps its own choice.</p>
            <label class="row">
              <input v-model="settings.oneSpritePerPosition" type="checkbox" />
              <span>One sprite per position</span>
            </label>
            <p class="hint">Uses the first available sprite variant for every player sharing the same position on a team. This is a local display override only.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Movement animation</legend>
            <label class="row">
              <span>Movement animation</span>
              <select v-model="settings.moveStyle">
                <option value="trail">Slide + echo</option>
                <option value="slide">Slide (direct)</option>
                <option value="walk">Walk (tile-by-tile, step bob)</option>
                <option value="hop">Hop (per-tile arc)</option>
                <option value="hoptrail">Hop + path trail (bob with echo, default)</option>
              </select>
            </label>
            <label class="row">
              <span>Movement speed</span>
              <select v-model.number="settings.moveSpeedMs">
                <option :value="50">50ms — fastest</option>
                <option :value="100">100ms</option>
                <option :value="150">150ms</option>
                <option :value="200">200ms (default)</option>
                <option :value="300">300ms</option>
                <option :value="400">400ms — slowest</option>
              </select>
            </label>
            <label class="row" v-if="settings.moveStyle === 'trail' || settings.moveStyle === 'hoptrail'">
              <span>Path-trail colour</span>
              <select v-model="settings.trailColor">
                <option value="auto">Auto (contrast with background)</option>
                <option value="white">White</option>
                <option value="black">Black</option>
                <option value="gold">Gold</option>
              </select>
            </label>
            <label class="row" v-if="settings.moveStyle === 'trail' || settings.moveStyle === 'hoptrail'">
              <span>Path-trail marks</span>
              <select v-model="settings.trailMarks">
                <option value="echo">Echo footprints</option>
                <option value="numbers">Numbers (count squares moved, default)</option>
              </select>
            </label>
          </fieldset>

          <!-- Owner 09-16: every log APPEARANCE setting lives here (moved from UI > Log window) + the dice toggles. -->
          <fieldset class="settings-group">
            <legend>Log</legend>
            <label class="row">
              <span>Opacity</span>
              <input v-model.number="settings.logOpacity" v-fill-range type="range" min="0.05" max="1" step="0.01" />
              <span>{{ Math.round(settings.logOpacity * 100) }}%</span>
            </label>
            <label class="row">
              <span>Font size</span>
              <input v-model.number="settings.logFontSize" v-fill-range type="range" min="8" max="22" step="0.5" />
              <span>{{ settings.logFontSize }}px</span>
            </label>
            <label class="row">
              <span>Font</span>
              <select v-model="settings.logFont">
                <option value="nuffle">Nuffle (Blood Bowl)</option>
                <option value="arial">Arial / Helvetica</option>
                <option value="mono">Monospace</option>
              </select>
            </label>
            <label class="row">
              <span>Display dice rolls as numbers</span>
              <input v-model="settings.logDiceAsNumbers" type="checkbox" />
            </label>
            <label class="row">
              <span>Show timestamps</span>
              <input v-model="settings.logTimestamps" type="checkbox" />
            </label>
            <p class="hint">Rolls show as one summed number instead of individual dice.</p>
            <label class="row">
              <span>Display dice roll needed as numbers</span>
              <input v-model="settings.logNeededAsNumbers" type="checkbox" />
            </label>
            <p class="hint">The roll needed shows as a number instead of a die.</p>
            <label class="row">
              <span>Log style</span>
              <select v-model="settings.logStyle">
                <option value="text">Text</option>
                <option value="graphical">Graphical</option>
              </select>
            </label>
            <p class="hint">Graphical: each line is a row in the acting team's colour, with the action's icon (and a reroll's source) on the left.</p>
            <label v-if="settings.logStyle === 'graphical'" class="row">
              <span>Row colour strength</span>
              <input v-model.number="settings.logTintStrength" v-fill-range type="range" min="0" max="100" step="5" data-testid="log-tint-strength" />
              <span>{{ settings.logTintStrength }}%</span>
            </label>
            <p v-if="settings.logStyle === 'graphical'" class="hint">How strongly the team colours paint the Graphical rows.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Skill display</legend>
            <!-- B2-17: icons and markings are mutually exclusive display modes -->
            <label class="row">
              <span>Skill display</span>
              <select v-model="settings.skillDisplay">
                <option value="icons">Skill icons (badges)</option>
                <option value="markings">Skill markings (text)</option>
              </select>
            </label>
            <label class="row">
              <span>Action decorations</span>
              <select v-model="settings.actionDecorations">
                <option value="art">Super FUMBBL artwork</option>
                <option value="emoji">Emoji glyphs</option>
              </select>
            </label>
            <!-- Per-skill display config (owner 2026-07-03 r6f): every skill in the
                 game, grouped into Skill Icons / Skill Markers, each with MY TEAM
                 (home coach) / OPPOSITION (away coach) behaviour + a marker glyph. -->
            <details class="skill-config">
              <summary>Skill display config — per-skill icons &amp; markers</summary>
              <label class="row">
                <span>Configure</span>
                <select v-model="skillConfigGroup">
                  <option value="icons">Skill Icons</option>
                  <option value="markers">Skill Markers</option>
                </select>
              </label>
              <label class="row">
                <span>Render position</span>
                <select v-model="skillGroupPosition">
                  <option value="head">Over head</option>
                  <option value="feet">At feet</option>
                  <option value="centre">On token</option>
                </select>
              </label>
              <input class="sc-filter" v-model="skillFilter" placeholder="Filter skills…" spellcheck="false" />
              <div class="sc-table" :data-markers="skillConfigGroup === 'markers'">
                <div class="sc-thead">
                  <span class="sc-skill">Skill</span>
                  <span v-if="skillConfigGroup === 'markers'">Marker</span>
                  <span>My team</span>
                  <span>Opposition</span>
                </div>
                <div v-for="skill in filteredSkillRows" :key="skill" class="sc-trow">
                  <span class="sc-skill" :title="skill">{{ skill }}</span>
                  <input v-if="skillConfigGroup === 'markers'" class="sc-glyph"
                    :value="skillMarkerText(skill)"
                    @input="setSkillMarkerText(skill, ($event.target as HTMLInputElement).value)"
                    maxlength="6" spellcheck="false" placeholder="glyph" />
                  <select :value="skillBehaviour(skill, skillKind, 'Mine')"
                    @change="setSkillBehaviour(skill, skillKind, 'Mine', ($event.target as HTMLSelectElement).value as SkillBehaviour)">
                    <option v-for="o in BEHAVIOUR_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                  <select :value="skillBehaviour(skill, skillKind, 'Opp')"
                    @change="setSkillBehaviour(skill, skillKind, 'Opp', ($event.target as HTMLSelectElement).value as SkillBehaviour)">
                    <option v-for="o in BEHAVIOUR_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                </div>
                <!-- Owner 10-01 (S90): traits under their own subheading (Team Captain stays in the skill list above). -->
                <div v-if="filteredTraitRows.length" class="sc-subhead" role="heading" aria-level="4">Traits</div>
                <div v-for="skill in filteredTraitRows" :key="skill" class="sc-trow sc-trow-trait">
                  <span class="sc-skill" :title="skill">{{ skill }}</span>
                  <input v-if="skillConfigGroup === 'markers'" class="sc-glyph"
                    :value="skillMarkerText(skill)"
                    @input="setSkillMarkerText(skill, ($event.target as HTMLInputElement).value)"
                    maxlength="6" spellcheck="false" placeholder="glyph" />
                  <select :value="skillBehaviour(skill, skillKind, 'Mine')"
                    @change="setSkillBehaviour(skill, skillKind, 'Mine', ($event.target as HTMLSelectElement).value as SkillBehaviour)">
                    <option v-for="o in BEHAVIOUR_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                  <select :value="skillBehaviour(skill, skillKind, 'Opp')"
                    @change="setSkillBehaviour(skill, skillKind, 'Opp', ($event.target as HTMLSelectElement).value as SkillBehaviour)">
                    <option v-for="o in BEHAVIOUR_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                </div>
                <div v-if="filteredStarTraitRows.length" class="sc-subhead" role="heading" aria-level="4">Star player traits</div>
                <div v-for="skill in filteredStarTraitRows" :key="skill" class="sc-trow sc-trow-trait">
                  <span class="sc-skill" :title="skill">{{ skill }}</span>
                  <input v-if="skillConfigGroup === 'markers'" class="sc-glyph"
                    :value="skillMarkerText(skill)"
                    @input="setSkillMarkerText(skill, ($event.target as HTMLInputElement).value)"
                    maxlength="6" spellcheck="false" placeholder="glyph" />
                  <select :value="skillBehaviour(skill, skillKind, 'Mine')"
                    @change="setSkillBehaviour(skill, skillKind, 'Mine', ($event.target as HTMLSelectElement).value as SkillBehaviour)">
                    <option v-for="o in BEHAVIOUR_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                  <select :value="skillBehaviour(skill, skillKind, 'Opp')"
                    @change="setSkillBehaviour(skill, skillKind, 'Opp', ($event.target as HTMLSelectElement).value as SkillBehaviour)">
                    <option v-for="o in BEHAVIOUR_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                </div>
                <!-- Owner 10-02 (S94): injuries (Niggling Injury, stat busts) - shown / hidden / marked like a skill. -->
                <div v-if="filteredInjuryRows.length" class="sc-subhead" role="heading" aria-level="4">Injuries</div>
                <div v-for="row in filteredInjuryRows" :key="row.key" class="sc-trow sc-trow-injury">
                  <span class="sc-skill" :title="row.label">{{ row.label }}</span>
                  <input v-if="skillConfigGroup === 'markers'" class="sc-glyph"
                    :value="skillMarkerText(row.key)"
                    @input="setSkillMarkerText(row.key, ($event.target as HTMLInputElement).value)"
                    maxlength="6" spellcheck="false" placeholder="glyph" />
                  <select :value="skillBehaviour(row.key, skillKind, 'Mine')"
                    @change="setSkillBehaviour(row.key, skillKind, 'Mine', ($event.target as HTMLSelectElement).value as SkillBehaviour)">
                    <option v-for="o in BEHAVIOUR_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                  <select :value="skillBehaviour(row.key, skillKind, 'Opp')"
                    @change="setSkillBehaviour(row.key, skillKind, 'Opp', ($event.target as HTMLSelectElement).value as SkillBehaviour)">
                    <option v-for="o in BEHAVIOUR_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                </div>
              </div>
              <div class="actions" style="justify-content: flex-start">
                <button type="button" @click="resetSkillConfig">Reset per-skill config</button>
                <span class="hint" aria-live="polite">{{ skillConfigStatus }}</span>
              </div>
            </details>
          </fieldset>

          <!-- Owner 10-13: ONE "Skill markings" box (appearance, fumbbl.com import, table, add, clear all) as a sibling
               of Skill display, no nested fieldsets. Only while Skill markings are the chosen display. -->
          <SkillMarkingsSettings v-if="settings.skillDisplay === 'markings'" :skills="allSkills" />

          <fieldset class="settings-group">
            <legend>On-field markings</legend>
            <label class="row">
              <input v-model="settings.showRowMarkers" type="checkbox" />
              <span>Show row-number markers</span>
            </label>
            <label class="row">
              <input v-model="settings.showSweetSpot" type="checkbox" />
              <span>Show sweet-spot markers</span>
            </label>
            <label class="row">
              <input v-model="settings.showFieldLogos" type="checkbox" />
              <span>Show on-field team logos</span>
            </label>
            <label class="row"><input v-model="settings.dugoutCounts" type="checkbox" /> <span>Player counts on dugout labels (e.g. "2 RESERVES")</span></label>
            <label class="row"><input v-model="settings.hideZeroRerolls" type="checkbox" /> <span>Hide reroll chips at zero</span></label>
            <!-- Owner 08-19: showPlayerNumbers + showBlockDice rows RETIRED from Settings > UI
                 (settings keep their defaults; toggles no longer surfaced). -->
            <!-- owner 2026-07-08: end-zone label — team name (FUMBBL) or TOUCHDOWN -->
            <label class="row">
              <span>End-zone label</span>
              <select v-model="settings.endZoneLabel">
                <option value="team">Team name</option>
                <option value="touchdown">TOUCHDOWN only</option>
              </select>
            </label>
            <!-- owner 09-05: red/blue end-zone shading (tile turf + Acasas pack) -->
            <label class="row">
              <input v-model="settings.endZoneTint" type="checkbox" />
              <span>Red/blue end-zone tint</span>
            </label>
            <!-- owner 2026-07-07: toggle the on-pitch turn/score/re-roll tracks -->
            <label class="row">
              <input v-model="settings.turnTrack" type="checkbox" />
              <span>On-pitch turn/score/reroll tracks</span>
            </label>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Position rings</legend>
            <label class="row">
              <input v-model="settings.showPositionRings" type="checkbox" />
              <span>Show position rings under players</span>
            </label>
            <label class="row">
              <span>Ring density</span>
              <input v-model.number="settings.positionRingDensity" v-fill-range type="range" min="0.3" max="1.5" step="0.1" :disabled="!settings.showPositionRings" />
              <span>{{ settings.positionRingDensity }}×</span>
            </label>
            <label class="row">
              <span>Ring colour</span>
              <select v-model="settings.positionRingColor" :disabled="!settings.showPositionRings">
                <option value="auto">Auto (per position)</option>
                <option value="#f5c542">Gold</option>
                <option value="#ffffff">White</option>
                <option value="#66e0ff">Cyan</option>
                <option value="#ff8a8a">Red</option>
                <option value="#9ab8ff">Blue</option>
              </select>
            </label>
          </fieldset>

          <!-- Owner 09-14: the Injury results group (Stun display banner/tag) is cut — the stun reads as the token toast like a KO; the 'tag' variant only swapped toast styles. -->
        </section>

        <!-- ============================ ART (id 'mods') ============================ -->
        <section v-if="settingsTab === 'mods'">
          <fieldset class="settings-group">
            <legend>Dice</legend>
            <label class="row">
              <input v-model="settings.blockDice3d" type="checkbox" />
              <span>3D dice (block dice + on-pitch action dice)</span>
            </label>
            <label class="row">
              <span>D6 style</span>
              <select v-model="settings.d6FaceVariant">
                <option value="brushed-metal">Black (default)</option>
                <option value="black">White</option>
                <option value="team">Brushed metal, home and away</option>
              </select>
            </label>
            <label class="row">
              <span>Block die surface</span>
              <select v-model="settings.blockDiceSurface">
                <option value="auto">Match the face set (default)</option>
                <option value="black">Black</option>
                <option value="white">White</option>
                <option value="team">Brushed metal, home and away</option>
              </select>
            </label>
            <label class="row">
              <span>Dice tumble ({{ settings.blockTumbleMs }}ms)</span>
              <input v-model.number="settings.blockTumbleMs" v-fill-range type="range" min="100" max="600" step="25" />
            </label>
            <label class="row">
              <span>Die-roll tag position</span>
              <select v-model="settings.dieTagPosition">
                <option value="corner">On die — top-right corner (default)</option>
                <option value="top">On die — top</option>
                <option value="side">To the side of the die</option>
                <option value="bottom">On die — bottom</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label class="row">
              <span>Planner roll tags</span>
              <select v-model="settings.plannerTagStyle">
                <option value="dieWord">Die and word (&#9857;+ RUSH) (default)</option>
                <option value="letter">Letter and number (R2+)</option>
              </select>
            </label>
            <p class="hint">Marks the rush, dodge and pickup rolls on a planned path.</p>
            <label class="row">
              <span>Blitz target marker</span>
              <select v-model="settings.blitzTargetMarker">
                <option value="turn">Keep for the turn (default)</option>
                <option value="fumbbl">Clear when the blitz ends (FUMBBL)</option>
              </select>
            </label>
            <p class="hint">How long the target marker stays on a blitzed player. The blitzer keeps its own marker for the turn either way.</p>
          </fieldset>

          <AssetPackSettings :live-game="gameStore.game.value" />
        </section>

        <!-- ============================ UI ============================ -->
        <section v-if="settingsTab === 'ui'">
          <fieldset class="settings-group">
            <legend>HUD layout</legend>
            <label v-if="FORK_EDITION" class="row">
              <span>UI mode</span>
              <select v-model="settings.uiMode">
                <option value="fumbbl40k">Super FUMBBL (default)</option>
                <option value="classic">FUMBBL Classic</option>
              </select>
            </label>
            <p v-if="FORK_EDITION" class="hint">FUMBBL Classic mirrors the classic Java client's layout &amp; prompts (preview).</p>
            <label v-if="settings.uiMode === 'fumbbl40k'" class="row">
              <span>Modern HUD style</span>
              <select v-model="settings.modernHudStyle">
                <option value="chrome">Console chrome (default)</option>
                <option value="minimalist">Minimalist</option>
              </select>
            </label>
            <p v-if="settings.uiMode === 'fumbbl40k'" class="hint">Chrome adds the molded retro-console casing. Minimalist keeps the compact, flatter HUD.</p>
            <label class="row">
              <input v-model="settings.bottomBarsSwapped" type="checkbox" />
              <span>Log bottom-left, Quick bar bottom-right</span>
            </label>
            <p class="hint">Puts the Log window at the bottom-left and the Quick bar (settings, tackle
              zones, skill icons, …) at the bottom-right, so the Log leads in reading order. On by
              default; uncheck to swap them back (Quick bar left, Log right).</p>
            <label class="row">
              <span>Player portraits</span>
              <select v-model="settings.playerCardMode" data-testid="player-card-mode">
                <option value="auto">On: show automatically (default)</option>
                <option value="called">Off: only when called</option>
              </select>
            </label>
            <p class="hint">On: clicking a player on the pitch opens their card (portrait, stats and skills), as before.
              Off: the pitch opens no card; it still opens from a roster row, or with the Player card key if you bind one
              (Settings › Controls). The middle mouse button on the pitch switches portraits off and on (also bindable there).</p>
            <label class="row">
              <input v-model="settings.chatDockRosterTab" type="checkbox" />
              <span>Roster tab in the chat dock</span>
            </label>
            <p class="hint">The roster opens from the helmet button on the Quick bar. Tick this to also keep the old
              Roster tab next to Log and Chat.</p>
            <label class="row">
              <input v-model="settings.preClickBlockDice" type="checkbox" />
              <span>Show block dice on every target before choosing</span>
            </label>
            <p class="hint">After you declare a Block or Blitz, the dice dots show over every player you can block. Off: they show only once you click a target.</p>
            <label class="row">
              <input v-model="settings.coachCornerCounts" type="checkbox" />
              <span>Reserve / Out counts on the coach panels</span>
            </label>
            <p class="hint">A small tab on each coach panel showing how many players are in Reserves and how many are
              out of the game (KO, injured, dead or sent off). Right-click a tab to hide them.</p>
            <label class="row">
              <input v-model="settings.skipArmourDiceOnCasualty" type="checkbox" />
              <span>Skip armour rolls if a casualty occurs</span>
            </label>
            <p class="hint">When a knockdown ends in a casualty, the armour roll is not shown; the casualty result, its
              sound and the apothecary offer follow the knockdown directly. The knockdown sound still plays.</p>
            <!-- Owner 10-06: Customize UI Layout is a BUTTON that closes Settings and enters the live layout mode;
                 a centred "Confirm Layout" button on the game screen exits it (SpectateView). -->
            <div class="actions" style="justify-content: flex-start">
              <button type="button" @click="startUiCustomize">Customize UI Layout</button>
              <button type="button" @click="resetPanelLayoutImmediately">Reset all panels now…</button>
            </div>
            <p class="settings-immediate-note">Resetting every panel changes the live layout immediately and is not undone by Cancel.</p>
            <p class="hint">Customize UI Layout closes this dialog and shows a ⠿ grip (top-left) on each panel to move it, a
              ⤡ handle (bottom-right) to resize it (contents scale with it), and ↺ to reset one. Panels: both coach
              corners, the scoreboard, and the quick bar. Press <b>Confirm Layout</b> in the middle of the screen when done.</p>
          </fieldset>

          <!-- Owner 10-13: the three setup-phase aids, each separately switchable -->
          <fieldset class="settings-group">
            <legend>Setup</legend>
            <label class="row"><input v-model="settings.setupRulesCard" type="checkbox" /> <span>Setup rules card at setup</span></label>
            <label class="row"><input v-model="settings.setupFormationsPanel" type="checkbox" /> <span>Formations panel at setup</span></label>
            <label class="row"><input v-model="settings.setupZoneHelpers" type="checkbox" /> <span>Zone helpers at setup</span></label>
          </fieldset>

          <fieldset class="settings-group">
            <legend>UI theme</legend>
            <div class="theme-presets">
              <button type="button" class="theme-preset" :data-active="settings.uiTheme === 'brand-red'"
                @click="selectThemePreset('brand-red')">
                <span class="theme-swatch" :style="{ background: THEME_PRESETS['brand-red'].secondary, borderColor: THEME_PRESETS['brand-red'].primary }"></span>
                <span>Black / Red</span>
              </button>
              <button type="button" class="theme-preset" :data-active="settings.uiTheme === 'fumbbl'"
                @click="selectThemePreset('fumbbl')">
                <span class="theme-swatch" :style="{ background: THEME_PRESETS['fumbbl'].secondary, borderColor: THEME_PRESETS['fumbbl'].primary }"></span>
                <span>FUMBBL</span>
              </button>
              <button type="button" class="theme-preset" :data-active="settings.uiTheme === 'custom'"
                @click="selectThemePreset('custom')">
                <span class="theme-swatch" :style="{ background: settings.uiSecondary, borderColor: settings.uiPrimary }"></span>
                <span>Custom</span>
              </button>
            </div>
            <label class="row">
              <span>Primary (accent)</span>
              <input v-model="settings.uiPrimary" type="color" @input="onThemeColorEdit" />
            </label>
            <label class="row">
              <span>Secondary (base)</span>
              <input v-model="settings.uiSecondary" type="color" @input="onThemeColorEdit" />
            </label>
            <div class="theme-preview">
              <span class="theme-chip" :style="{ background: themePreview['--ui-primary'], color: themePreview['--ui-text-on-primary'] }">Primary</span>
              <span class="theme-chip" :style="{ background: themePreview['--ui-surface'], color: themePreview['--ui-text'], borderColor: themePreview['--ui-border'] }">Surface</span>
              <span class="theme-chip" :style="{ background: themePreview['--ui-active'], color: themePreview['--ui-text-on-primary'] }">Active</span>
              <span class="theme-chip" :style="{ background: themePreview['--ui-danger'], color: '#fff' }">Danger</span>
              <span class="theme-chip" :style="{ background: themePreview['--ui-success'], color: '#111' }">Success</span>
            </div>
            <p class="hint">Text colour is chosen automatically for legibility — even a low-contrast custom pick stays readable. Status colours (danger/success/info) stay fixed across themes.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Element opacity</legend>
            <label class="row">
              <span>Coach panels</span>
              <input v-model.number="settings.hudCoachOpacity" v-fill-range type="range" min="0.2" max="1" step="0.01" />
              <span>{{ Math.round(settings.hudCoachOpacity * 100) }}%</span>
            </label>
            <label class="row">
              <span>Scoreboard</span>
              <input v-model.number="settings.hudScoreboardOpacity" v-fill-range type="range" min="0.2" max="1" step="0.01" />
              <span>{{ Math.round(settings.hudScoreboardOpacity * 100) }}%</span>
            </label>
            <label class="row">
              <span>Quick bar</span>
              <input v-model.number="settings.hudQuickBarOpacity" v-fill-range type="range" min="0.2" max="1" step="0.01" />
              <span>{{ Math.round(settings.hudQuickBarOpacity * 100) }}%</span>
            </label>
            <label class="row">
              <span>Chat toasts</span>
              <input v-model.number="settings.hudToastOpacity" v-fill-range type="range" min="0.2" max="1" step="0.01" />
              <span>{{ Math.round(settings.hudToastOpacity * 100) }}%</span>
            </label>
            <label class="row">
              <span>Roster window</span>
              <input v-model.number="settings.rosterOpacity" v-fill-range type="range" min="0.2" max="1" step="0.01" data-testid="roster-opacity" />
              <span>{{ Math.round(settings.rosterOpacity * 100) }}%</span>
            </label>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Confirm bar</legend>
            <label class="row">
              <span>Hide the Confirm bar</span>
              <input v-model="settings.hideConfirmBar" type="checkbox" data-testid="hide-confirm-bar" />
            </label>
            <p class="hint">Hides the bar at the bottom of the pitch that confirms a move, block, blitz or foul. The confirm key and a second click still confirm.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Chat &amp; notifications</legend>
          <label class="row">
            <span>Disable chat</span>
            <input v-model="settings.chatDisabled" type="checkbox" />
          </label>
          <label class="row" v-if="!settings.chatDisabled">
            <span>Chat toasts</span>
            <input v-model="settings.chatToastsEnabled" type="checkbox" />
          </label>
          <label class="row" v-if="!settings.chatDisabled && settings.chatToastsEnabled">
            <span>Chat toast position</span>
            <select v-model="settings.chatToastPos">
              <option value="left">Left (default)</option>
              <option value="right">Right</option>
              <option value="bottomLeft">Bottom-left</option>
              <option value="top">Top</option>
              <option value="center">Center</option>
            </select>
          </label>
            <label class="row">
              <span>Chat toast text size</span>
              <input v-model.number="settings.chatToastTextSize" v-fill-range type="range" min="12" max="28" step="1"
                aria-describedby="chat-toast-text-size-help" />
              <span>{{ settings.chatToastTextSize }}px</span>
            </label>
            <p id="chat-toast-text-size-help" class="hint">Changes the coach name and message in incoming
              chat toasts only. The minimum text-size accessibility setting can raise this further.</p>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Telestrator</legend>
            <label class="row">
              <span>Pitch marking color</span>
              <input v-model="settings.markColor" type="color" />
            </label>
          </fieldset>

          <fieldset class="settings-group">
            <legend>Sound</legend>
            <label class="row">
              <span>Game sound</span>
              <input v-model.number="settings.soundVolume" v-fill-range type="range" min="0" max="100" step="5" />
              <span>{{ settings.soundVolume === 0 ? 'muted' : settings.soundVolume + '%' }}</span>
            </label>
            <label class="row">
              <span>Footstep style</span>
              <select v-model="footstepStyle">
                <option value="tick">Tick</option>
                <option value="footsteps">Footsteps by weather</option>
              </select>
            </label>
            <p class="hint">Event-specific sound packs are managed in Art.</p>
          </fieldset>
        </section>

        <!-- ============================ CREDITS ============================= -->
        <section v-if="settingsTab === 'credits'">
          <!-- Owner 09-30 (S51): which web app runs on which shell; an app patch can be dropped for the built-in one. -->
          <template v-if="appPatchStatus">
            <h3 class="credits-head">Version</h3>
            <p class="hint" data-testid="app-version-line">{{ versionLine(appVersion, appPatchStatus) }}</p>
            <p v-if="appPatchStatus.lastError" class="hint update-error">Last app update error: {{ appPatchStatus.lastError }}</p>
            <button v-if="appPatchStatus.activeVersion" type="button" @click="useBuiltInAppVersion()">Use the built-in version ({{ appPatchStatus.embeddedVersion }})</button>
          </template>
          <h3 class="credits-head">Attributions</h3>
          <p class="hint">Third-party assets and fonts used in Super FUMBBL, with thanks to their creators.</p>
          <ul class="credits-list">
            <li>Boxing bell by Benboncan, Dramatic Organ by InspectorJ and Chainsaw by ItsTheGoodstuff (freesound.org), CC BY 4.0. Referee whistle by SpliceSound and Videogame Menu Button Click by Christopherderp (CC0).</li>
            <li>
              <img class="credits-icon" :src="helmetIconUrl" alt="" />
              <span>Roster tab helmet —
                <a href="https://www.flaticon.com/free-icons/american-football"
                  @click.prevent="openExternal('https://www.flaticon.com/free-icons/american-football')"
                  title="american football icons">American football icons created by justicon — Flaticon</a>
              </span>
            </li>
            <li>
              <span>"Super FUMBBL" wordmark font (SNES Italic) —
                <a href="https://famfonts.com/super-nintendo/"
                  @click.prevent="openExternal('https://famfonts.com/super-nintendo/')"
                  title="Super Nintendo font by 629Fonts">629Fonts — FamFonts</a>
              </span>
            </li>
            <li>
              <span>UI font (Nuffle) —
                <a href="http://www.pixelsagas.com"
                  @click.prevent="openExternal('http://www.pixelsagas.com')"
                  title="Nuffle by Neale Davidson (Pixel Sagas, SIL Open Font License 1.1)">Neale Davidson — Pixel Sagas (OFL 1.1)</a>
              </span>
            </li>
            <li>
              <span>Menu and pitch lettering font (Graduate):
                <a href="https://fonts.google.com/specimen/Graduate"
                  @click.prevent="openExternal('https://fonts.google.com/specimen/Graduate')"
                  title="Graduate by Eduardo Tunni (SIL Open Font License 1.1)">Eduardo Tunni (SIL Open Font License 1.1)</a>
              </span>
            </li>
            <!-- Owner 09-09: licensed and generated art credited here to match docs/licenses/ and the provenance ledger. -->
            <li>
              <span>Stadium props (cameras, light towers, stands) — "Football Championship Megapack" by
                <a href="https://sakpix.itch.io/football-championship-megapack-top-down-pixel-art-sports-collection"
                  @click.prevent="openExternal('https://sakpix.itch.io/football-championship-megapack-top-down-pixel-art-sports-collection')"
                  title="SakPix on itch.io">SakPix</a> (licensed purchase).
              </span>
            </li>
            <li><span>Pitch textures (grass, dugout stone) — Acasas and unTied, licensed via GameDev Market. Sign fans — licensed purchase.</span></li>
            <li><span>Sound effects — The Sound Guild, Gamemaster Audio and Khron Studio libraries (licensed purchases), plus owner recordings.</span></li>
            <li><span>Player sprites, star players, team crests and dugout cobble — original pixel art produced with PixelLab. Skill badges — Super FUMBBL originals; the illustrated set via Codex image generation.</span></li>
            <li>
              <span>Whirlpool Galaxy backdrop (the "Whirlpool Galaxy (Hubble)" backdrop option). Image: NASA, ESA, S. Beckwith (STScI), and The Hubble Heritage Team (STScI/AURA).
                <a href="https://esahubble.org/images/heic0506a/"
                  @click.prevent="openExternal('https://esahubble.org/images/heic0506a/')"
                  title="ESA/Hubble heic0506a">ESA/Hubble heic0506a</a>,
                <a href="https://esahubble.org/copyright/"
                  @click.prevent="openExternal('https://esahubble.org/copyright/')"
                  title="ESA/Hubble usage terms">CC BY 4.0</a>, unmodified.
              </span>
            </li>
            <li><span>KrisB block dice faces (the "Rick dice (built-in)" block dice option) — by Kristofer Bengtsson (KrisB), used with permission.</span></li>
            <li><span>Kickoff banners, stadium skybox, space backdrop, crest and decoration art — generated with OpenAI, Codex and Gemini image models from Super FUMBBL prompts; no third-party source imagery.</span></li>
            <li><span>Home and away brushed-metal dice (the "Brushed metal, home and away" dice option): Super FUMBBL originals made with Codex image generation.</span></li>
            <li><span>FUMBBL logo — used under FUMBBL's branding guidelines (FUMBBL Branding page). FUMBBL is Christer Kaivo-oja's site; Super FUMBBL is an independent client.</span></li>
          </ul>
          <h3 class="credits-head license-head">License</h3>
          <p class="hint">Super FUMBBL's code is released under the MIT License (also in the LICENSE file at the project root).</p>
          <p class="hint">Super FUMBBL's original artwork (sprites, crests, skill badges, decorations, pitches, banners, dice, wordmark) is licensed under the Super FUMBBL Media License: use, modify and distribute for non-commercial purposes; no selling the assets or using them on merchandise; credit Super FUMBBL with a link and indicate any changes. Full text: docs/licenses/super-fumbbl-media-license.md. The KrisB block dice faces are © Kristofer Bengtsson (KrisB), used with permission, and are not covered by the Super FUMBBL Media License.</p>
          <pre class="license-text">{{ CLIENT_MIT_LICENSE }}</pre>
          <h3 class="credits-head license-head">Upstream FFB license</h3>
          <p class="hint">Super FUMBBL builds on the FFB client/server by Christer Kaivo-oja, also released under the MIT License.</p>
          <pre class="license-text">{{ CHRISTER_MIT_LICENSE }}</pre>

          <!-- FUMBBL Contributors mirror (owner 2026-07-23). Mirrors
               https://fumbbl.com/p/attribution in its entirety (also ATTRIBUTION.md at the
               repo root). If the source page changes, re-mirror BOTH copies. -->
          <h3 class="credits-head license-head">FUMBBL Contributors</h3>
          <p class="hint">Mirrored from
            <a href="https://fumbbl.com/p/attribution"
              @click.prevent="openExternal('https://fumbbl.com/p/attribution')"
              title="FUMBBL attribution page">fumbbl.com/p/attribution</a>
            — see that page for updates and corrections.</p>
          <div class="attribution-mirror">
            <p>This page lists people who have contributed assets (images, sounds, code, etc) to FUMBBL, with information on what they have contributed and additional information requested as part of the licensing terms. Contributors are listed in roughly chronological order.</p>
            <p>If you think you should be here, or find errors or omissions, don't hesitate to get in touch with Christer and it will be resolved promptly.</p>
            <h4>Licenses and policies</h4>
            <h5>Code</h5>
            <p>Any code contributed to the open parts of the FUMBBL codebase are licensed under the MIT License. Contributions should only be made if you agree to this license.</p>
            <h5>Graphics and sounds</h5>
            <p>Licensing of media assets has historically been a little bit complicated. All contributions in the past have given FUMBBL permission to use the assets for any purpose, but limited ability to redistribute them. Going forward, we are asking contributors to agree to a somewhat more permissive license when it comes to third parties using the content. The Modern FUMBBL Media License is as follows:</p>
            <ul>
              <li>FUMBBL is granted a license to use, modify, and distribute the contributed media assets for any purpose, including commercial purposes.</li>
              <li>Third parties are granted a license to use, modify, and distribute the contributed media assets for non-commercial purposes but may not use them for direct commercial purposes. This includes selling the assets or using them on merchandise or products that are sold.</li>
              <li>Third parties can also use the assets on sites and services that are commercial in nature, as long as the assets themselves are not sold or used on merchandise.</li>
              <li>Appropriate credit must be given to the original creator(s), a link to the FUMBBL website must be provided, and any changes made to the original assets must be indicated.</li>
            </ul>
            <p>Content licensed under this license is marked with an icon on the source page (icon markers are not reproduced in this mirror).</p>
            <h4>Developers</h4>
            <ul>
              <li><b>Christer</b> — Site owner and website developer. Assistant FFB developer.</li>
              <li><b>Mr-Klipp</b> — Co-developer in the early days of FUMBBL, contributed with various core code for the site.</li>
              <li><b>SkiJunkie</b> — JavaBBowl developer, the original client used by FUMBBL.</li>
              <li><b>Kalimar</b> — Primary FFB developer between October 2013 through May 2017.</li>
              <li><b>Candlejack</b> — Primary FFB developer as of March 2019. Dice Stats module.</li>
              <li><b>HimalayaP1C7</b> — Front-end for Gamefinder 2.0 and Blackbox 2.0 systems.</li>
            </ul>
            <h4>Roster Logos</h4>
            <ul>
              <li><b>Mr_Foulscumm</b> — Chaos Chosen, Dark Elf, Dwarf, Elven Union, Goblin, High Elf, Khemri, Lizardmen, Necromantic Horror, Norse, Nurgle, Ogre, Orc, Skaven, Vampire, Wood Elf</li>
              <li><b>Qaz</b> — Amazon, Chaos Dwarf, Halfling, Human, Undead</li>
              <li><b>Frylen</b> — Black Orc, Imperial Nobility, Khorne, Old World Alliance, Snotling, Underworld, Bretonnian</li>
              <li><b>Garion</b> — Chaos Renegades</li>
              <li><b>ryanfitz</b> — Gnome</li>
            </ul>
            <h4>Sounds</h4>
            <ul>
              <li><b>PurpleChest</b> — Hurt sound for the FFB Client.</li>
              <li><b>bigbullies</b> — Projectile Vomit sound.</li>
              <li><b>Mischa Kissin Tip</b> — Pump Up The Crowd and Trapdoor sounds.</li>
            </ul>
            <h4>Portraits</h4>
            <ul>
              <li><b>Knut_Rockie</b> — Portraits for Amazon, Black Orc, Chaos Chosen, Chaos Renegade, Dark Elf, Dwarf, Elven Union, Goblin, Halfling, High Elf, Human, Imperial Nobility, Khorne, Lizardmen, Necromantic Horror, Norse, Nurgle, Ogre, Old World Alliance, Orc, Shambling Undead, Skaven, Snotling, Tomb Kings, Underworld Denizens, Vampire, Wood Elf positionals.</li>
              <li><b>ryanfitz</b> — Colouring of portraits by Knut Rockie.</li>
              <li><b>Garion</b> — Drawing and colouring a number of star player portraits.</li>
              <li><b>Marcepan</b> — Portraits for unique Gnome positionals: Beastmaster, Illusionist, Woodland Fox, Lineman.</li>
            </ul>
            <h4>Icons</h4>
            <ul>
              <li><b>Pat</b> — Original JavaBBowl icons</li>
              <li><b>Nick Kelsh</b> — 2nd generation icons</li>
              <li><b>WhatBall</b> — 3rd gen icons</li>
              <li><b>Cowhead</b> — 3rd gen icon contributor</li>
              <li><b>harvestmouse</b> — 3rd gen icon contributor</li>
              <li><b>Balle2000</b> — 3rd gen icon contributor</li>
              <li><b>MisterFurious</b> — 3rd gen icon contributor</li>
              <li><b>Marcepan</b> — 3rd gen icon contributor</li>
              <li><b>Tussock</b> — 3rd gen icon contributor</li>
            </ul>
            <h4>Other Graphics</h4>
            <ul>
              <li><b>ArrestedDevelopment</b> — Minor tournament banners</li>
              <li><b>Garion</b> — Pitches: Basic, Blackbox, Chaos, Dark Elf, Fumbbl Cup, Goblin, Khorne, Necromantic, Norse, Nurgle, Skaven, Slaanesh, Tzeentch, Vampire. Tournament Banners: Steel Gauntlet</li>
              <li><b>Kam</b> — Tournament Banners: FUMBBL Cup, Warpstone Open, Ulthuan Invitational, Grotty Little Tournament, Crown of Sand, XFL</li>
              <li><b>Whatball</b> — Pitches: Default (edited by Garion)</li>
              <li><b>Angelux</b> — Pitches: Tomb Kings (edited by Garion)</li>
              <li><b>ZioCrock</b> — Pitches: Amazon, High Elf, Lizardman (all edited by Garion)</li>
            </ul>
          </div>
        </section>
        </div>
        <footer class="settings-footer">
          <p v-if="settingsDiscardError || settingsApplyError" class="settings-footer-error" role="alert">
            {{ settingsDiscardError || settingsApplyError }}
          </p>
          <span v-else class="settings-footer-status" role="status" aria-live="polite">
            {{ assetMods.creatorApplyBusy || assetMods.pendingAssignments ? 'Finishing the asset-pack change…' : (settingsDirty ? 'Changes are previewing live.' : 'Settings are up to date.') }}
          </span>
          <div class="settings-footer-actions">
            <button type="button" :disabled="settingsTransactionBusy" @click="cancelSettingsChanges()">
              {{ settingsDiscardBusy ? 'Restoring…' : 'Cancel' }}
            </button>
            <button type="button" :disabled="!settingsDirty || settingsTransactionBusy" @click="applySettingsChanges(false)">
              {{ settingsApplyBusy ? 'Applying…' : 'Apply' }}
            </button>
            <button type="button" class="primary" :disabled="settingsTransactionBusy" @click="applySettingsChanges(true)">
              OK
            </button>
          </div>
        </footer>
        </div>
      </div>
    </div>

    <!-- Owner 10-06: "Run first-launch setup again" (Settings → General) — the same wizard as the first-launch gate,
         drawn over the live shell. (It replaced the first-run account-setup splash that lived here.) -->
    <FirstLaunchSetup v-if="ui.setupWizardRerunOpen" overlay @finish="finishSetupWizard" />

    <!-- Owner 2026-07-04: tabbed LOGIN CREDENTIALS menu — FUMBBL (official account)
         + Super FUMBBL (fork account), each entered separately. Opened by the button
         on the launch splash or Settings → Connection. -->
    <!-- Owner 10-10: ticking "Enable controller support" asks first - the owner's wording, one button. OK turns it on;
         Escape / a click outside closes the notice and leaves the box off. Shown on every off -> on. -->
    <div v-if="controllerOptIn.noticeOpen.value" class="modal-backdrop save-prompt-backdrop controller-notice-backdrop"
      data-testid="controller-support-notice" @click.self="controllerOptIn.dismiss()">
      <div ref="controllerNoticeDialog" class="save-prompt controller-notice" role="alertdialog" aria-modal="true"
        aria-labelledby="controller-notice-title" aria-describedby="controller-notice-text"
        @keydown="trapDialogFocus($event, controllerNoticeDialog)">
        <h3 id="controller-notice-title">{{ CONTROLLER_SUPPORT_NOTICE_TITLE }}</h3>
        <p id="controller-notice-text" class="hint controller-notice-text" data-testid="controller-support-notice-text">{{ CONTROLLER_SUPPORT_NOTICE }}</p>
        <div class="save-prompt-actions">
          <button ref="controllerNoticeOk" class="primary" type="button" data-testid="controller-support-notice-ok"
            @click="controllerOptIn.acknowledge()">{{ CONTROLLER_SUPPORT_NOTICE_BUTTON }}</button>
        </div>
      </div>
    </div>

    <div v-if="credsMenuOpen" class="modal-backdrop creds-menu-backdrop" @click.self="closeCredsMenu">
      <div ref="credsMenuDialog" class="creds-menu" role="dialog" aria-modal="true" aria-labelledby="credentials-dialog-title"
        @keydown="trapCredsFocus">
        <div class="creds-menu-head">
          <h2 id="credentials-dialog-title">Login credentials</h2>
          <button class="creds-menu-close" @click="closeCredsMenu">✕</button>
        </div>
        <div class="creds-tabs">
          <button :data-active="credsMenuTab === 'fumbbl'" @click="credsMenuTab = 'fumbbl'">FUMBBL</button>
          <button :data-active="credsMenuTab === 'fumbbl40k'" @click="credsMenuTab = 'fumbbl40k'">Super FUMBBL</button>
        </div>
        <section v-if="credsMenuTab === 'fumbbl'" class="creds-panel">
          <p class="hint">Your official <b>FUMBBL</b> account — required to spectate live matches.</p>
          <label class="creds-field">Coach name
            <input v-model="settings.coach" type="text" autocomplete="username" placeholder="your FUMBBL coach name" />
          </label>
          <label class="creds-field">Password
            <input v-model="settings.password" type="password" autocomplete="current-password" placeholder="FUMBBL password" />
          </label>
          <!-- Owner 08-18 auth-challenge. "Check name", NOT "Verify": fumbbl.com gives this client no
               way to prove a coach's password, so the button is labelled for what it actually does. -->
          <div class="creds-challenge">
            <button
              type="button"
              class="creds-challenge-btn"
              :disabled="fumbblChallenge.kind === 'checking'"
              @click="checkFumbblCoach"
            >{{ fumbblChallenge.kind === 'checking' ? 'Checking…' : 'Check name' }}</button>
            <p v-if="fumbblChallenge.kind !== 'idle'" class="creds-challenge-result" :data-kind="fumbblChallenge.kind">
              {{ fumbblChallenge.message }}
            </p>
          </div>
        </section>
        <section v-else class="creds-panel">
          <p class="hint">Your <b>Super FUMBBL</b> (fork) account — used to play on the Super FUMBBL server.</p>
          <label class="creds-field">Coach name
            <input v-model="settings.coach40k" type="text" autocomplete="username" placeholder="your Super FUMBBL coach name" />
          </label>
          <label class="creds-field">Password
            <input v-model="coachPasswordModel" type="password" autocomplete="current-password" placeholder="Super FUMBBL password" />
            <!-- Non-blocking honesty: the OS credential store is unusable, so the password is session-only. -->
            <p v-if="credentialStore.notice" class="hint">{{ credentialStore.notice }}</p>
          </label>
          <!-- Owner 08-18 auth-challenge. A REAL credential check here — config-web's fork login is a
               yes/no oracle for coach+password — so this one gets to say "Verified". -->
          <div class="creds-challenge">
            <button
              type="button"
              class="creds-challenge-btn"
              :disabled="forkChallenge.kind === 'checking'"
              @click="verifyForkCredentials"
            >{{ forkChallenge.kind === 'checking' ? 'Verifying…' : 'Verify' }}</button>
            <p v-if="forkChallenge.kind !== 'idle'" class="creds-challenge-result" :data-kind="forkChallenge.kind">
              {{ forkChallenge.message }}
            </p>
          </div>
          <!-- Owner 2026-07-08: register a fork account straight from here — no FUMBBL account needed. -->
          <div class="creds-register">
            <button type="button" class="creds-register-btn" @click="openRegisterModal">Register a new fork account ✦</button>
            <p class="hint">No Super FUMBBL account yet? Register one here — no FUMBBL account needed.</p>
          </div>
        </section>
        <p class="creds-menu-note">Stored locally on this machine only — never sent anywhere but the server you connect to.</p>
        <div class="creds-menu-actions">
          <button class="creds-menu-done" @click="closeCredsMenu">Done</button>
        </div>
      </div>
    </div>

    <!-- Owner 2026-07-08: REGISTER a new fork account. Asks the user to match their real FUMBBL name
         (so opponents recognise them) and to choose a DIFFERENT password than their FUMBBL one. -->
    <div v-if="registerModalOpen" class="modal-backdrop creds-menu-backdrop" @click.self="closeRegisterModal">
      <form ref="registerDialog" class="creds-menu register-modal" role="dialog" aria-modal="true"
        aria-labelledby="register-dialog-title" @keydown="trapRegisterFocus" @submit.prevent="registerForkAccount">
        <div class="creds-menu-head">
          <h2 id="register-dialog-title">Register a Super FUMBBL account</h2>
          <button type="button" class="creds-menu-close" @click="closeRegisterModal">✕</button>
        </div>
        <div class="creds-panel">
          <label class="creds-field">Coach name
            <input v-model="registerCoach" type="text" autocomplete="username" placeholder="your coach name" />
          </label>
          <p class="hint">Please use your <b>actual FUMBBL name</b> — it's how opponents will recognise and
            challenge you on the fork.</p>
          <label class="creds-field">Password
            <input v-model="registerPassword" type="password" autocomplete="new-password" placeholder="choose a fork password" />
          </label>
          <p class="hint">⚠ Use a <b>different password</b> than your FUMBBL account — fork passwords are stored
            for this test server, so don't reuse a real one.</p>
        </div>
        <p v-if="registerStatus" class="creds-menu-note register-status">{{ registerStatus }}</p>
        <div class="creds-menu-actions">
          <button type="button" class="register-cancel" @click="closeRegisterModal">Cancel</button>
          <button type="submit" class="creds-menu-done" :disabled="registering">
            {{ registering ? 'Registering…' : 'Create account' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Launch splash (owner 2026-07-03 r6f): thank-you + community links over the
         TABBL logo watermark + a Twitch channel preview. Click anywhere to clear;
         the content card stops propagation so the links/embed stay usable. -->
    <div v-if="splashOpen" class="launch-splash" @click="nextSplash()">
      <img class="splash-watermark" :src="tabblLogoUrl" alt="" />
      <div class="splash-content" @click.stop>
        <h1 class="splash-title splash-title-oneline">Thanks so much for trying out FUMBBL 40k</h1>
        <p>Please report any bugs or issues.</p>
        <p>If you haven't already, join us on the TABBL Discord at
          <a href="https://discord.gg/JxySytA297" @click.prevent="openExternal('https://discord.gg/JxySytA297')">discord.gg/JxySytA297</a>
        </p>
        <p>And go give me a follow at
          <a :href="twitchChannelUrl" @click.prevent="openExternal(twitchChannelUrl)">twitch.tv/flutethecat</a>
        </p>
        <!-- owner 2026-07-03: Twitch REJECTS the tauri.localhost embed parent, so the
             live iframe only works on the web origin; the desktop build gets a
             clickable card that opens the channel externally. -->
        <div v-if="!inTauri" class="splash-twitch">
          <iframe :src="twitchEmbedUrl" title="Twitch — flutethecat" allowfullscreen
            frameborder="0" scrolling="no" loading="lazy"></iframe>
        </div>
        <button v-else type="button" class="splash-twitch splash-twitch-card"
          @click="openExternal(twitchChannelUrl)" title="Open flutethecat's Twitch channel">
          <span class="twitch-glyph">▶</span>
          <span class="twitch-cta">Watch <b>flutethecat</b> on Twitch</span>
          <span class="twitch-host">twitch.tv/flutethecat</span>
        </button>
        <p class="splash-credit">Credit to AjaxTheRiot
          (<a href="https://twitch.tv/ajaxtheriot" @click.prevent="openExternal('https://twitch.tv/ajaxtheriot')">twitch.tv/ajaxtheriot</a>)
          for coming up with this idea to rebuild the client to begin with.</p>
        <button class="splash-continue" @click="nextSplash()">Next: getting started ▸</button>
      </div>
    </div>

    <!-- Second splash (owner 2026-07-03 r6f; owner 2026-08-27): the getting-started guide is now the
         Field Manual — a paginated in-game help guide (console → six rails → showtime → settings
         deep-links). Also reachable any time from ☰ → Help / Field Manual. -->
    <FieldManual v-if="guideOpen" @close="guideOpen = false" @play-tutorial="playTutorial()"
      @open-settings="(tab) => { guideOpen = false; openSettings(tab); }" />
    <!-- Controller support P1 (owner 10-07): the auto input-switch notice (corner, 1.5 s) / controller disconnect.
         Owner 10-10: also "Player portraits on / off". Kept OUTSIDE the private fence above (everything in it is cut from
         the public export). -->
    <div v-if="controllerToast" class="controller-toast" role="status" aria-live="polite" :data-kind="controllerToast.kind"
      data-testid="controller-toast">{{ controllerToast.text }}</div>
    <!-- Owner ruling (08-18): the header's "Signed in as" identity block relocates here, stacked directly
         above the version stamp — same quiet/muted styling family, bottom-left, under every panel (owner 08-18 2nd). -->
    <div class="corner-stamp">
      <div class="header-identity" aria-label="Signed in accounts">
        <!-- Owner 09-10: the public edition shows just the coach name (no "Signed in as" / service labels, no fork account). -->
        <span v-if="FORK_EDITION" class="identity-label">Signed in as</span>
        <span class="identity-account">
          <span v-if="FORK_EDITION" class="identity-service">FUMBBL</span>
          <span class="identity-name" :class="{ 'is-signed-out': !settings.coach.trim() }"
            :title="settings.coach.trim() || 'Signed out'">{{ settings.coach.trim() || '—' }}</span>
        </span>
        <span v-if="FORK_EDITION" class="identity-account">
          <span class="identity-service">SuperFUMBBL</span>
          <span class="identity-name" :class="{ 'is-signed-out': !settings.coach40k.trim() }"
            :title="settings.coach40k.trim() || 'Signed out'">{{ settings.coach40k.trim() || '—' }}</span>
        </span>
      </div>
      <!-- Owner commission 08-12: persistent version stamp, bottom-right of every view. Reads the SAME build-injected
           __APP_VERSION__ (package.json + dev letter) the release stamps use — never hand-maintained, and it shows the
           BARE version so a stray dev letter would be visible here (leak canary). -->
      <div class="version-stamp" :title="`build ${gitSha}`">v{{ appVersion }}</div>
    </div>
    <!-- Owner 10-06: the client walkthrough - after the first-launch wizard (the shell is only mounted once the
         first-open gate, wizard included, has cleared) and after the FUMBBL.COM site walkthrough when the pane exists;
         it ends on the third-party disclaimer. -->
    <ClientTour :host="clientTourHost" :should-start="clientTourShouldStart" :suspended="clientTourSuspended" :in-game="!!gameStore.game.value" :demo-game="!!gameStore.state.demoMode"
      :game-menu-open="ui.gameMenuOpen" :settings-open="ui.settingsOpen" :twitch-url="twitchChannelUrl"
      :colorblind-filter="colorblindFilterStyle?.filter" />
  </main>
  <BetaLaunchSplash v-else-if="betaSplashOpen" @dismiss="betaSplashOpen = false" />
  <div v-else-if="introOpen" class="intro-splash" role="dialog" aria-label="Super FUMBBL intro" @click="finishIntro">
    <video
      ref="introVideo"
      class="intro-video"
      :src="INTRO_VIDEO_URL"
      playsinline
      @ended="finishIntro"
      @error="finishIntro"
      @playing="onIntroActivity"
      @loadedmetadata="onIntroActivity"
      @loadeddata="onIntroActivity"
      @canplay="onIntroActivity"
      @progress="onIntroActivity"
      @timeupdate="onIntroProgress"
    ></video>
    <button v-if="introNeedsGesture" class="intro-play" type="button" aria-label="Play intro" @click.stop="startIntroPlayback">▶</button>
    <button class="intro-skip" type="button" @click.stop="finishIntro">Skip ▸</button>
  </div>
  <FirstOpenLegalNotice
    v-else-if="legalNoticeOpen"
    :client-license="CLIENT_MIT_LICENSE"
    :busy="legalNoticeBusy"
    :error="legalNoticeError"
    @acknowledge="acknowledgeLegalNotice"
  />
  <FirstOpenContributions v-else-if="contributionsOpen" @continue="continueContributions" />
  <FirstLaunchSetup v-else @finish="finishSetupWizard" />
  <!-- Controller support P2b: card focus ring + glyph badges, chord-layer badges (pointer-transparent). -->
  <PadOverlay v-if="settings.controllerSupportEnabled" />
</template>

<style>
/* First-open retro intro (owner 08-27) — fullscreen black stage ahead of the legal notice. */
.intro-splash {
  position: fixed;
  inset: 0;
  z-index: 13000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}
.intro-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.intro-skip {
  position: absolute;
  right: 24px;
  bottom: 20px;
  z-index: 2; /* above the video layer (WebKitGTK composites video over the DOM) */
  pointer-events: auto;
  padding: 8px 18px;
  color: var(--ui-text);
  font-size: max(var(--ui-min-primary-text-size, 16px), 1rem);
  letter-spacing: 0.06em;
  background: color-mix(in srgb, var(--ui-surface) 72%, transparent);
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  cursor: pointer;
}
.intro-skip:hover { color: var(--ui-heading); border-color: var(--ui-heading); }
.intro-play {
  position: absolute;
  z-index: 2;
  pointer-events: auto;
  width: 96px;
  height: 96px;
  color: var(--ui-text);
  font-size: max(var(--ui-min-primary-text-size, 16px), 2.4rem);
  line-height: 1;
  background: color-mix(in srgb, var(--ui-surface) 72%, transparent);
  border: 2px solid var(--ui-border);
  border-radius: 50%;
  cursor: pointer;
}
.intro-play:hover { color: var(--ui-heading); border-color: var(--ui-heading); }

.match-ready-popup {
  /* Astra N5: above the walkthrough disclaimer (12500); teleported to <body>. */
  position: fixed;
  z-index: 12600;
  right: 24px;
  top: 72px;
  width: min(380px, calc(100vw - 48px));
  padding: 18px;
  border: 1px solid var(--ui-primary);
  border-left-width: 5px;
  border-radius: 8px;
  background: var(--ui-surface);
  color: var(--ui-text);
  box-shadow: 0 12px 36px rgba(0, 0, 0, .55);
}
.match-ready-popup h3 { margin: 0 28px 8px 0; }
.match-ready-popup p { line-height: 1.45; }
.match-ready-close { position: absolute; right: 8px; top: 8px; }
/* Console-UI PLACEHOLDER law (owner 2026-08-04, spec-console-ui-program): undesigned / question-blocked
   sections ship as this shared zebra block — testers SEE the stripes by owner intent; questions queue,
   never block. Theme-token only (no hardcoded hex, per the Claude-Design mandate). The consuming component
   supplies the label text, e.g. <div class="ui-placeholder">League — Place Holder</div>. */
.ui-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64px;
  padding: 16px;
  border: 2px dashed var(--ui-border);
  border-radius: 6px;
  color: var(--ui-muted);
  font-family: 'Nuffle', system-ui, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-align: center;
  background: repeating-linear-gradient(45deg, var(--ui-surface) 0 12px, var(--ui-surface-2) 12px 24px);
}
/* Owner 2026-07-04: app-wide click echo — small, gold (configurable), 15% opacity,
   short-lived, centred on the cursor. ~40% of the earlier pitch-echo size. */
.click-echo {
  position: fixed;
  z-index: 9999;
  /* owner 2026-07-06: size scaled by settings.echoSize (--echo-scale, 1 = 9px). */
  width: calc(9px * var(--echo-scale, 1));
  height: calc(9px * var(--echo-scale, 1));
  margin: calc(-4.5px * var(--echo-scale, 1)) 0 0 calc(-4.5px * var(--echo-scale, 1)); /* centre on the cursor point */
  border-radius: 50%;
  border: 1.5px solid var(--click-echo-color, #f5c518);
  background: var(--click-echo-color, #f5c518);
  opacity: 0.3;
  pointer-events: none;
  /* Owner 2026-07-05: half-diameter (9px), 30% opacity. */
  animation: click-echo-pop 440ms ease-out forwards;
}
@keyframes click-echo-pop {
  from { transform: scale(0.4); opacity: 0.3; }
  to { transform: scale(2); opacity: 0; }
}

:root {
  color-scheme: dark;
  /* Sampled from the on-pitch sprite ramps in UAT: navy/royal/electric blue
     and oxblood/crimson/coral red. Text variants retain the sampled hue while
     lifting luminance for small-copy contrast. */
  --seat-home-deep: #080c64;
  --seat-home-mid: #003eb3;
  --seat-home-bright: #0058fe;
  --seat-home-text: #4a86fe;
  --seat-away-deep: #7f0000;
  --seat-away-mid: #b30000;
  --seat-away-bright: #fe0000;
  --seat-away-text: #fe6666;
  /* B2-16/UI11 + B3-8: display font is user-selectable (default Nuffle) */
  font-family: var(--ui-font, 'Nuffle', system-ui, sans-serif);
  /* Owner 2026-07-05: base UI 20% larger. The whole shell is rem-based, so scaling
     the root font-size grows every panel/dialog/button/label 20%; the JS-sized pitch
     canvas is unaffected. */
  font-size: max(var(--ui-min-text-size, 12px), 120%);
  background: var(--ui-surface);
  color: var(--ui-text);
}
body {
  margin: 0;
}
.cb-filter-defs { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }
.shell {
  /* Owner 10-12: the console page column (Play blade field) and the ribbon's logo plate share one left edge. */
  --console-column-width: min(2200px, 94vw);
  --console-column-inset: max(0px, calc((100vw - var(--console-column-width)) / 2));
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* Owner 2026-07-11: the game canvas can render wider than the window; without this the body
     scrolls horizontally and the full-width header (incl. its motherboard background) is dragged
     past the viewport's right edge and clipped. Clip horizontal overflow to the viewport so the
     top bar always ends exactly at the window edge. (Canvas pan is handled inside the renderer, not
     by DOM scroll, so nothing interactive is lost.) */
  overflow-x: hidden;
  max-width: 100vw;
  /* Owner UX 08-12: the chrome is INERT to text-selection app-wide (labels/buttons/panels can't be highlighted). */
  user-select: none;
  -webkit-user-select: none;
}
/* Owner 09-28: with a game on screen the window itself never scrolls - a HUD element reaching past the window
   edge put a scroll bar on the viewport. The pitch pans inside the renderer and every panel scrolls inside
   itself, so nothing is lost. The console blades (no game) keep their normal scrolling. */
.shell--in-game { overflow: hidden; }
html:has(.shell--in-game), body:has(.shell--in-game) { overflow: hidden; }
/* Owner UX 08-12: positive carve-outs that STAY selectable — the log/chat panel (owner-named copy-pastable) and
   EVERY editable field (user-select:none must NEVER reach an input/textarea). Global (App.vue is un-scoped), so it
   reaches all views incl. the console (team-builder names, filters) and Classic inherits at Pellaeon's re-sync. */
input, textarea, [contenteditable="true"], .log-panel {
  user-select: text;
  -webkit-user-select: text;
}
/* Owner 2026-07-11: motherboard PCB texture behind the top bar. Owner 10-12: the console shell no longer shows it
   (the blade ribbon carries the logo + BETA now); only the Classic in-game compact header plate keeps it. */
.shell-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.25rem 1rem;
  background-color: #0c1408; /* PCB-dark fallback before the image paints */
  background-image:
    linear-gradient(90deg, rgba(10, 16, 8, 0.82) 0%, rgba(10, 16, 8, 0.5) 35%, rgba(10, 16, 8, 0.5) 65%, rgba(10, 16, 8, 0.82) 100%),
    url('./assets/resources/motherboard-header.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border-bottom: 1px solid #16391a;
}
/* owner 2026-07-14: once a game is loaded, the menu bar SHRINKS to give the pitch more room. */
.shell-header.header-compact .server-plate { width: 92px; height: 32px; padding: 0 0.45rem; }
.shell-header.header-compact .server-plate-super img { max-height: 25px; }
/* owner 2026-07-14: narrow windows shrink the plate (kept for the Classic in-game header, its only remaining user). */
@media (max-width: 720px) {
  .shell-header .server-plate { width: 86px; height: 36px; padding: 0 0.35rem; }
  .shell-header .server-plate-super img { max-height: 26px; max-width: 72px; }
}

/* Console-UI S2: server switcher plates are a matched 52px-high bevelled pair. */
.server-switcher {
  display: inline-flex;
  gap: 0.45rem;
  flex-shrink: 0;
}
.server-plate {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 132px;
  height: 52px;
  padding: 0 0.6rem;
  border: 2px outset color-mix(in srgb, var(--ui-text) 28%, var(--ui-surface-2));
  border-radius: 6px;
  cursor: pointer;
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.32),
    inset -1px -1px 2px rgba(0, 0, 0, 0.55),
    0 2px 6px rgba(0, 0, 0, 0.5);
  transition: filter 0.15s ease, opacity 0.15s ease;
}
.server-plate img { display: block; width: auto; }
.server-plate-super { background: var(--ui-surface); }
.server-plate-super img { max-width: 112px; max-height: 42px; }
.server-plate-fumbbl { background: var(--ui-eggshell); }
.server-plate-fumbbl img { max-width: 108px; max-height: 24px; }
.server-plate:not([data-active='true']) { opacity: 0.55; filter: grayscale(1); }
.server-plate:not([data-active='true']):hover { opacity: 1; filter: grayscale(0); }
.server-plate[data-active='true'] {
  opacity: 1;
  filter: none;
}
.server-plate-super[data-active='true'] {
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.32),
    inset -1px -1px 2px rgba(0, 0, 0, 0.55),
    inset 0 -3px 0 var(--ui-heading),
    0 2px 6px rgba(0, 0, 0, 0.5);
}
.server-plate-fumbbl[data-active='true'] {
  /* README signature exception: the FUMBBL plate underline is the fixed brand-red bevel edge. */
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.32),
    inset -1px -1px 2px rgba(0, 0, 0, 0.55),
    inset 0 -3px 0 #A10005,
    0 2px 6px rgba(0, 0, 0, 0.5);
}
/* Owner ruling (08-18): the header's Super FUMBBL plate is pure branding now — no button semantics,
   no dimmed/grayscale idle state (it carries no [data-active] to trigger the rule above), no hover
   affordance, default cursor. It's a logo, always shown at full strength. */
.server-plate.server-plate-inert {
  cursor: default;
  opacity: 1;
  filter: none;
}
.server-plate.server-plate-inert:hover { opacity: 1; filter: none; }

/* Console-UI S2 blade ribbon: the selected server owns the complete horizontal blade set. */
/* Owner 10-12: 64px (was 42px) so the Super FUMBBL logo plate from the retired header strip fits at its right end at
   a 48px logo; at 40px (56px ribbon) the "FANTASY FOOTBALL" line was marginal at DPR 1 ("increase further"). */
.blade-ribbon {
  display: flex;
  flex-shrink: 0;
  align-items: stretch;
  min-height: 64px;
  padding: 0 1.25rem 0 var(--console-column-inset);
  overflow-x: auto;
  background: var(--ui-surface-2);
  border-bottom: 3px solid var(--ui-primary);
}
.blade {
  flex: 0 0 auto;
  padding: 0.55rem 1.15rem;
  border: 0;
  color: var(--ui-muted);
  background: transparent;
  font-family: inherit;
  font-size: max(var(--ui-min-primary-text-size, 16px), 1.125rem);
  line-height: 1;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.blade:hover { color: var(--ui-text); background: var(--ui-hover); }
/* Owner 10-12: no bold on the selected blade. Nuffle has one weight, so 700 was synthesised and read as an
   outline / glow around the lettering; the fill, the inset bar and the text colour carry the selection. */
.blade[data-active='true'] {
  color: var(--ui-text);
  background: var(--ui-primary);
  box-shadow: inset 0 3px 0 var(--ui-heading);
}
/* Owner ruling (console shell restructure): a hairline divider marks the merged tree's Super FUMBBL section
   (Team/League/Players/Store) without splitting the ribbon into a separate parallel branch. */
.blade-ribbon-sep {
  flex: 0 0 auto;
  align-self: center;
  width: 1px;
  height: 1.4rem;
  margin: 0 0.35rem;
  background: var(--ui-border);
}
/* Owner 10-12: the logo plate leads the ribbon at its left edge; BETA follows the last blade. */
.server-plate.ribbon-logo-plate {
  flex: 0 0 auto;
  align-self: center;
  width: auto;
  height: auto;
  margin-right: 1rem;
  padding: 1px 4px 1px 0;
}
.server-plate.ribbon-logo-plate img { height: 48px; width: auto; max-width: none; max-height: none; object-fit: contain; }
.blade-ribbon .ribbon-beta { flex: 0 0 auto; align-self: center; margin-left: 0.6rem; }
/* Owner 10-13: Report sits at the ribbon's right edge (margin-left: auto pushes it past the blades and the stamp),
   amber like the in-game REPORT button, on the one ribbon row. */
.blade-ribbon .ribbon-report {
  flex: 0 0 auto;
  align-self: center;
  margin-left: auto;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--ui-accent);
  border-radius: 6px;
  color: var(--ui-accent);
  background: transparent;
  font-family: inherit;
  font-size: max(var(--ui-min-primary-text-size, 16px), 0.95rem);
  line-height: 1;
  letter-spacing: 0.04em;
  white-space: nowrap;
  cursor: pointer;
}
.blade-ribbon .ribbon-report:hover:not(:disabled) { color: var(--ui-text); background: var(--ui-hover); }
.blade-ribbon .ribbon-report:disabled { opacity: 0.6; cursor: default; }
.blade-ribbon .ribbon-report-bug { font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif; }
@media (max-width: 640px) {
  .blade-ribbon { padding-left: 1.25rem; }
  .blade-ribbon .ribbon-beta { display: none; }
  .server-plate.ribbon-logo-plate img { height: 30px; }
}
/* owner 2026-07-12: the standalone Browse button was dropped — the FUMBBL / Super FUMBBL server
   buttons now open the browser (selectServer). Session state + Disconnect stay grouped on the right. */
/* owner 2026-07-03 r5: stencil-style ALPHA RELEASE stamp */
.alpha-stamp {
  margin-left: 16px;
  padding: 2px 9px;
  border: 2px solid #c0532f;
  border-radius: 3px;
  color: #d5643a;
  font-family: 'Nuffle', system-ui, sans-serif;
  font-weight: 800;
  font-size: max(var(--ui-min-text-size, 12px), 0.72rem);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  transform: rotate(-6deg);
  opacity: 0.9;
  box-shadow: inset 0 0 0 1px #c0532f55;
  text-shadow: 0 0 1px #c0532f66;
  user-select: none;
  white-space: nowrap;
}
/* owner 2026-07-08: build credit + Twitch link beside the ALPHA stamp */
.build-credit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  font-size: max(var(--ui-min-text-size, 12px), 0.68rem);
  color: var(--ui-muted);
  white-space: nowrap;
}
.build-credit .twitch-link {
  display: inline-flex;
  align-items: center;
  color: #9146ff; /* Twitch brand purple */
  cursor: pointer;
  transition: color 0.15s ease, filter 0.15s ease;
}
.build-credit .twitch-link:hover {
  color: #a970ff;
  filter: drop-shadow(0 0 4px #9146ff88);
}
/* Owner ruling (08-18): the header's mode/version tagline is dropped outright (the ALPHA RELEASE
   stamp already carries the alpha branding); the "Signed in as" identity block relocates here,
   stacked directly above the persistent version stamp (owner commission 08-12) in one quiet,
   muted corner group — bottom-right, clear of the scrollbar gutter. */
.corner-stamp {
  position: fixed;
  left: 20px; /* owner 08-18 (2nd): bottom-LEFT — the right corner collided with the in-game quick bar */
  bottom: 4px;
  z-index: 1; /* owner 08-18 (2nd): under every panel/toolbar — game UI draws over it, never the reverse */
  /* owner 08-19: ONE line + visible on any background — row layout inside a soft dark pill,
     light text with a dark outline so it reads over pitch green and light paper alike. */
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(10, 12, 14, 0.55);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  user-select: none;
}
.corner-stamp .header-identity { flex-wrap: nowrap; white-space: nowrap; }
.corner-stamp, .corner-stamp .identity-label, .corner-stamp .identity-service, .corner-stamp .identity-name { color: #e8ecef; }
.corner-stamp .header-identity {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: baseline;
  gap: 0.5rem;
  max-width: 60vw;
}
.corner-stamp .identity-label,
.corner-stamp .identity-service,
.corner-stamp .identity-name {
  color: var(--ui-muted);
  font-size: max(var(--ui-min-text-size, 12px), 10px);
  font-weight: 400;
  letter-spacing: 0.03em;
  opacity: 0.65;
}
.corner-stamp .identity-label { text-transform: uppercase; }
.corner-stamp .identity-account { display: inline-flex; align-items: baseline; min-width: 0; gap: 0.25rem; }
.corner-stamp .identity-name {
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.corner-stamp .version-stamp {
  position: static;
  color: var(--ui-muted);
  font-size: max(var(--ui-min-text-size, 12px), 10px);
  letter-spacing: 0.03em;
  opacity: 0.65;
}
.app-menu {
  position: fixed;
  inset: 0;
  z-index: 90;
}
.app-menu-panel {
  position: absolute;
  top: 52px;
  /* Owner 2026-07-11: the dropdown opens top-RIGHT (where its menu button sat before the hamburger was
     retired 09-10), never top-left where it used to be; kept right-aligned for any opener that reuses it. */
  right: 12px;
  display: flex;
  flex-direction: column;
  min-width: 220px;
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  box-shadow: 0 6px 22px #000b;
  /* Owner 2026-07-11: bind the dropdown to the viewport (same convention as the quick-bar/log clamp +
     the .game-menu cap) — never run off the bottom edge; scroll internally if it ever grows taller than
     the window. top:52px + a 12px bottom gutter = 64px reserved. */
  max-height: calc(100vh - 64px);
  overflow-x: hidden;
  overflow-y: auto;
}
.app-menu-panel button {
  background: transparent;
  color: var(--ui-text);
  border: none;
  border-bottom: 1px solid var(--ui-border);
  padding: 0.6rem 0.9rem;
  text-align: left;
  cursor: pointer;
}
.app-menu-panel button:last-child { border-bottom: none; }
.app-menu-panel button:hover { background: var(--ui-hover); }
/* Dev controls section (owner 2026-07-03 r6f) */
.app-menu-panel button.menu-section {
  margin-top: 0.2rem;
  border-top: 1px solid var(--ui-border);
  color: var(--ui-muted);
  font-size: max(var(--ui-min-primary-text-size, 16px), 0.82rem);
  font-weight: 700;
}
.app-menu-panel button.menu-sub { padding-left: 1.6rem; color: var(--ui-muted); font-size: max(var(--ui-min-primary-text-size, 16px), 0.85rem); }
.app-menu-panel button:disabled { opacity: 0.55; cursor: wait; }
.replay-file-alert {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 210;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: min(440px, calc(100vw - 32px));
  padding: 12px 14px;
  color: #ffe8e8;
  border: 1px solid #b84a4a;
  border-radius: 6px;
  background: #351313;
  box-shadow: 0 6px 22px #000b;
}
.replay-file-alert button {
  padding: 0;
  color: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: max(var(--ui-min-primary-text-size, 16px), 18px);
  line-height: 1;
}
/* JLeav 09-23 (#5): filled slider track — the thumb sits at the end of a fully painted bar at maximum. */
.settings-pane .settings-content input[type='range'] { /* beats the generic .settings-pane input surface rule */
  -webkit-appearance: none; appearance: none;
  height: 6px; padding: 0; border: none; border-radius: 3px; outline: none; cursor: pointer;
  background: linear-gradient(to right, var(--ui-primary, #b0242a) var(--fill, 0%), #2a2d33 var(--fill, 0%));
}
.settings-pane .settings-content input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; border-radius: 50%; background: #e8ecf2; border: 2px solid var(--ui-primary, #b0242a);
}
.settings-pane .settings-content input[type='range']::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #e8ecf2; border: 2px solid var(--ui-primary, #b0242a); }
.settings-pane .settings-content input[type='range']:focus-visible { box-shadow: 0 0 0 2px rgba(232, 236, 242, 0.35); }
/* Owner 09-23: art-pack sync surfaces. */
.art-pack-strip {
  position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 150;
  background: rgba(20, 22, 26, 0.92); color: var(--ui-text, #e8ecf2); border: 1px solid var(--ui-border, #333);
  border-radius: 6px; padding: 8px 14px; font-size: max(var(--ui-min-text-size, 12px), 0.8rem); display: flex; gap: 10px; align-items: center;
}
.art-pack-wait {
  position: fixed; inset: 0; z-index: 150; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  background: rgba(8, 9, 12, 0.85); color: var(--ui-text, #e8ecf2); text-align: center; padding: 24px;
}
.art-pack-wait h3 { margin: 0; }
.art-pack-bar { width: min(420px, 80vw); height: 8px; background: #2a2d33; border-radius: 4px; overflow: hidden; }
.art-pack-fill { height: 100%; background: var(--ui-primary, #b0242a); transition: width .2s; }
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: #0008;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.game-menu-backdrop { background: #000a; }
/* Owner UAT 08-12: the settings save/discard confirm is a SMALL reactive-style dialog (it was mis-styled
   with .settings-pane = the giant 920x680 window). Compact card, centered by .modal-backdrop, z-ordered
   ABOVE the credentials panel (.creds-menu-backdrop = z 110) so it lands over the top of the join creds. */
.save-prompt-backdrop { z-index: 200; }
.save-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: min(320px, 92vw);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  padding: 1.1rem 1.3rem;
  box-shadow: 0 8px 30px #000a;
  text-align: center;
  font-family: Arial, Helvetica, sans-serif;
}
.save-prompt h3 { margin: 0; font-size: max(var(--ui-min-primary-text-size, 16px), 0.98rem); letter-spacing: 0.03em; }
.save-prompt .hint { margin: 0; color: var(--ui-muted); font-size: max(var(--ui-min-text-size, 12px), 0.74rem); line-height: 1.35; }
/* Owner 09-25: in-app update progress */
.update-progress { display: grid; gap: 6px; margin: 4px 0 10px; }
.update-progress-track { height: 10px; border-radius: 5px; overflow: hidden; background: color-mix(in srgb, var(--ui-text) 12%, transparent); }
.update-progress-fill { height: 100%; background: var(--ui-primary); transition: width .2s linear; }
.update-progress-fill[data-indeterminate='true'] { animation: update-indeterminate 1.2s ease-in-out infinite; }
@keyframes update-indeterminate { 0% { opacity: .35; } 50% { opacity: 1; } 100% { opacity: .35; } }
.update-error { margin: 0 0 10px; color: var(--ui-danger, #ff8d8d); }
.save-prompt-actions { display: flex; justify-content: center; gap: 0.6rem; margin-top: 0.2rem; }
.save-prompt-actions button {
  flex: 1;
  padding: 0.45rem 0.7rem;
  color: var(--ui-text);
  background: var(--ui-surface-2);
  border: 1px solid var(--ui-border);
  border-radius: 5px;
  font-size: max(var(--ui-min-primary-text-size, 16px), 0.85rem);
  white-space: nowrap;
  cursor: pointer;
}
.save-prompt-actions button:hover { background: color-mix(in srgb, var(--ui-primary) 25%, var(--ui-surface-2)); }
.save-prompt-actions .primary { color: var(--ui-text-on-primary); background: var(--ui-primary); border-color: var(--ui-primary); }
/* Owner 08-18: spectate connect-error modal — the raw transport detail renders small/muted beneath
   the plain-language reason (fail-open honesty: never nothing, but the friendly line leads). */
.spectate-error-prompt .spectate-error-detail { font-size: max(var(--ui-min-text-size, 12px), 0.66rem); opacity: 0.75; word-break: break-word; }
.game-menu {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  /* Owner 2026-07-08: Join/Spectate-flow panes cap to the viewport so they never overflow
     a narrow window, and scroll internally when the content (creds / register form) is tall. */
  width: min(260px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  padding: 1.4rem 1.6rem;
  text-align: center;
}
.game-menu h2 {
  margin: 0 0 0.4rem;
  font-size: max(var(--ui-min-primary-text-size, 16px), 1.05rem);
  letter-spacing: 0.08em;
}
.game-menu button {
  background: var(--ui-surface-2);
  color: var(--ui-text);
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  padding: 0.55rem 0;
  font-size: max(var(--ui-min-primary-text-size, 16px), 0.92rem);
  cursor: pointer;
}
.game-menu button:hover:not(:disabled) { background: #3a5f3f; }
.game-menu button:disabled { color: var(--ui-text-dim); cursor: default; }
.game-menu .hint { margin: 0.3rem 0 0; color: var(--ui-text-dim); font-size: max(var(--ui-min-text-size, 12px), 0.72rem); }
.game-menu[data-wide='true'] { width: min(520px, 94vw); }
/* Owner 09-22: Esc > Game statistics = the end-of-game Statistics tab (SpectateView .pg-stats), same rules. */
.pg-stats { padding: 4px 0 8px; }
.pg-bevel {
  background: linear-gradient(180deg, color-mix(in srgb, var(--ui-surface-2) 88%, var(--ui-text) 8%) 0%, var(--ui-surface) 100%);
  border: 1px solid color-mix(in srgb, var(--ui-border) 70%, var(--ui-text) 12%);
  border-top-color: color-mix(in srgb, var(--ui-text) 28%, var(--ui-border));
  border-left-color: color-mix(in srgb, var(--ui-text) 18%, var(--ui-border));
  border-bottom-color: #000c;
  border-right-color: #000a;
  border-radius: 10px;
  box-shadow: 0 3px 0 #000b, 0 8px 18px #0008, inset 0 1px 0 #ffffff1f;
}
.pg-stats-cols { display: grid; grid-template-columns: 1fr 1.35fr 1fr; gap: 12px; align-items: stretch; }
.pg-stat-col { display: flex; flex-direction: column; padding: 0 0 6px; overflow: hidden; }
.pg-stat-col-head { min-height: 34px; display: flex; align-items: center; justify-content: center; padding: 3px; border-bottom: 1px solid #000a; box-shadow: 0 1px 0 #ffffff14; }
.pg-stat-col[data-side='home'] .pg-stat-col-head { border-top: 3px solid #3d7cff; }
.pg-stat-col[data-side='away'] .pg-stat-col-head { border-top: 3px solid #f2363c; }
.pg-stat-col[data-side='label'] .pg-stat-col-head { border-top: 3px solid color-mix(in srgb, var(--ui-text) 25%, transparent); }
.pg-stat-col-head img { width: 34px; height: 34px; object-fit: contain; image-rendering: pixelated; }
.pg-stat-cell { box-sizing: border-box; height: 1.9rem; padding: 0 12px; border-top: 1px solid var(--ui-border); font-size: 0.98rem; line-height: calc(1.9rem - 1px); white-space: nowrap; overflow: hidden; font-variant-numeric: tabular-nums; text-align: center; }
.pg-stat-cell.pg-h { color: var(--seat-home-text); }
.pg-stat-cell.pg-a { color: var(--seat-away-text); }
.pg-stat-cell.pg-stat-label { color: var(--ui-muted); font-size: max(var(--ui-min-text-size, 12px), 0.78rem); letter-spacing: .04em; text-transform: uppercase; }
.pg-stat-cell[data-lead='true'] { font-weight: 800; }
.settings-pane {
  /* B2-16 (owner): Settings render in Arial/Helvetica, not the display font */
  font-family: Arial, Helvetica, sans-serif;
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  /* owner 2026-07-06: large window — left sidebar + scrollable content pane. */
  position: relative;
  display: flex;
  flex-direction: row;
  width: min(920px, 94vw);
  height: min(680px, 88vh);
  overflow: hidden;
}
/* owner 2026-07-06: top-right close ✕ (replaces the old bottom Close button). */
.settings-x {
  position: absolute;
  top: 0.5rem;
  right: 0.6rem;
  z-index: 2;
  width: 1.7rem;
  height: 1.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--ui-muted);
  border: none;
  border-radius: 5px;
  font-size: max(var(--ui-min-primary-text-size, 16px), 1rem);
  line-height: 1;
  cursor: pointer;
}
.settings-x:hover { background: var(--ui-hover); color: var(--ui-text); }
/* --- left sidebar: category list --------------------------------------- */
.settings-sidebar {
  flex: 0 0 190px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.1rem 0.8rem;
  background: var(--ui-surface-2);
  border-right: 1px solid var(--ui-border);
  min-height: 0;
}
.settings-sidebar h3 { margin: 0 0 0.4rem 0.3rem; }
.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  overflow-y: auto;
}
.settings-nav button {
  text-align: left;
  background: transparent;
  color: var(--ui-muted);
  border: none;
  border-radius: 5px;
  padding: 0.5rem 0.7rem;
  cursor: pointer;
  font-size: max(var(--ui-min-primary-text-size, 16px), 0.9rem);
}
.settings-nav button:hover { background: var(--ui-hover); color: var(--ui-text); }
.settings-nav button[data-active='true'] {
  background: var(--ui-hover);
  color: var(--ui-text);
  box-shadow: inset 3px 0 0 var(--ui-primary);
}
/* --- right content pane ------------------------------------------------- */
.settings-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.settings-category-select { display: none !important; }
.settings-content {
  flex: 1;
  min-height: 0;
  min-width: 0;
  /* extra top padding so controls clear the absolute top-right ✕ */
  padding: 2.4rem 1.4rem 1.2rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.settings-content > h2 {
  margin: 0 2.2rem 0.8rem 0;
  color: var(--ui-text);
  font-size: max(var(--ui-min-primary-text-size, 16px), 1.15rem);
}
.settings-content > h2:focus { outline: none; }
.settings-content section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.settings-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  min-height: 58px;
  padding: 0.65rem 1.1rem;
  border-top: 1px solid var(--ui-border);
  background: var(--ui-surface-2);
}
.settings-footer-status,
.settings-footer-error {
  min-width: 0;
  margin: 0;
  color: var(--ui-muted);
  font-size: max(var(--ui-min-text-size, 12px), 0.76rem);
}
.settings-footer-error { color: var(--ui-danger); }
.settings-footer-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.settings-footer-actions button {
  min-width: 76px;
  padding: 0.48rem 0.8rem;
  border: 1px solid var(--ui-border);
  border-radius: 5px;
  background: var(--ui-surface);
  color: var(--ui-text);
  cursor: pointer;
}
.settings-footer-actions button.primary {
  border-color: var(--ui-primary);
  background: var(--ui-primary);
  color: var(--ui-text-on-primary);
}
.settings-footer-actions button:disabled { cursor: default; opacity: 0.5; }
.settings-immediate-note,
.asset-pack-immediate {
  margin: 0;
  color: var(--ui-info, #8bb8e8);
  font-size: max(var(--ui-min-text-size, 12px), 0.74rem);
}

@media (max-width: 640px), (max-height: 500px) {
  .settings-pane {
    width: min(96vw, 920px);
    height: min(94dvh, 680px);
  }
  .settings-sidebar { display: none; }
  .settings-category-select {
    display: flex !important;
    flex: 0 0 auto;
    flex-direction: column !important;
    gap: 0.25rem !important;
    padding: 0.75rem 3rem 0.65rem 0.9rem;
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-surface-2);
  }
  .settings-category-select select { width: 100%; }
  .settings-content { padding: 1rem 0.9rem; }
  .settings-content > h2 { margin-right: 0; }
  .settings-pane label.row { align-items: stretch; flex-wrap: wrap; }
  .settings-pane label.row > select,
  .settings-pane label.row > input:not([type='checkbox']):not([type='color']) { max-width: 100%; }
  .settings-footer { align-items: stretch; flex-direction: column; gap: 0.45rem; }
  .settings-footer-actions { width: 100%; }
  .settings-footer-actions button { flex: 1; }
}
/* --- grouped controls (fieldset) --------------------------------------- */
/* owner 2026-07-14: UI theme picker (Settings → Accessibility). */
.theme-presets { display: flex; gap: 10px; margin-bottom: 8px; }
.theme-preset { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 8px 12px; border: 1px solid var(--ui-border); border-radius: 8px; background: var(--ui-surface-2); color: var(--ui-text); cursor: pointer; font-size: max(var(--ui-min-primary-text-size, 16px), 0.8rem); }
.theme-preset:hover { border-color: var(--ui-primary); }
.theme-preset[data-active='true'] { border-color: var(--ui-primary); box-shadow: inset 0 0 0 1px var(--ui-primary); }
.theme-swatch { width: 34px; height: 22px; border-radius: 4px; border: 2px solid; display: block; }
.theme-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.theme-chip { padding: 4px 10px; border-radius: 5px; border: 1px solid transparent; font-size: max(var(--ui-min-text-size, 12px), 0.75rem); font-weight: 700; }
/* owner 2026-07-14 (Yularen button contract): keyboard focus ring on every interactive control — the
   accessibility must-have. Themed via --ui-focus (surface-aware, high-contrast on any preset). */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--ui-focus);
  outline-offset: 2px;
}
.settings-group {
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  padding: 0.5rem 0.8rem 0.7rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.settings-group legend {
  padding: 0 0.4rem;
  font-size: max(var(--ui-min-text-size, 12px), 0.78rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  /* owner 2026-07-14: ALL settings section headers = a fixed brand red, not the dark Carmine --ui-primary
     (too dim). Toned down a notch from the first #ff3b3b (owner: "a bit too bright"). Fixed like the
     semantic tokens so it stays consistent on any theme. */
  color: #e23b3b;
  font-weight: 700;
}
/* aura colour-legend swatches next to each aura label */
.aura-swatch {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 2px;
  vertical-align: -1px;
  border: 1px solid rgba(0, 0, 0, 0.4);
}
.aura-swatch.dp-friendly { background: #4a8cff; }
.aura-swatch.dp-opp { background: #e0402f; }
.aura-swatch.pmu-friendly { background: #2ec24f; }
.aura-swatch.pmu-opp { background: #d8c9a0; }
/* --- echo preview swatch ------------------------------------------------ */
.echo-preview {
  position: relative;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--ui-border);
  border-radius: 5px;
  background: var(--ui-surface);
}
.echo-preview em { color: var(--ui-text-dim); font-size: max(var(--ui-min-text-size, 12px), 0.72rem); }
.echo-preview-ring {
  position: absolute;
  width: calc(9px * var(--echo-scale, 1));
  height: calc(9px * var(--echo-scale, 1));
  border-radius: 50%;
  border: 1.5px solid var(--click-echo-color, #f5c518);
  background: var(--click-echo-color, #f5c518);
  animation: click-echo-pop 1200ms ease-out infinite;
}
.settings-pane label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: max(var(--ui-min-primary-text-size, 16px), 0.8rem);
  /* owner 2026-07-14: settings-menu body/label text = WHITE (max-contrast body token). Grey is reserved
     for SUBTEXT only — the descriptive .hint lines below each control keep --ui-muted. */
  color: var(--ui-text);
}
.settings-pane label.row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}
/* #166/#163: a toggle the client CANNOT honour (behaviourless skill → always prompted). Dimmed + not-allowed so it
   reads as deliberately unavailable rather than broken, with the reason inline. */
.settings-pane label.row.locked {
  opacity: 0.62;
  cursor: not-allowed;
}
.settings-pane label.row.locked input { cursor: not-allowed; }
.settings-pane .locked-tag {
  margin-left: auto;
  font-size: max(var(--ui-min-text-size, 12px), 0.78rem);
  font-style: italic;
  color: var(--ui-text-dim);
  white-space: nowrap;
}
.settings-pane input:not([type='checkbox']),
.settings-pane select {
  background: var(--ui-surface-2);
  color: var(--ui-text);
  border: 1px solid var(--ui-border);
  border-radius: 4px;
  padding: 0.4rem 0.55rem;
}
.settings-pane .keybind {
  background: var(--ui-surface-2);
  color: var(--ui-text);
  border: 1px solid var(--ui-border);
  border-radius: 4px;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  min-width: 110px;
}
.settings-pane .hint { margin: 0; color: var(--ui-muted); font-size: max(var(--ui-min-text-size, 12px), 0.72rem); }
/* Owner 10-02: the keyboard bindings as a table - action left, key right; rebindable keys are buttons with the accent edge. */
/* Bordered like the skill-config table above it; static keys read as quiet labels. */
.settings-pane .keybind-table { width: 100%; border-collapse: collapse; }
.settings-pane .keybind-table th { text-align: left; font-weight: 700; color: var(--ui-muted); font-size: max(var(--ui-min-text-size, 12px), 0.72rem); text-transform: uppercase; letter-spacing: 0.04em; padding: 0 0.5rem 0.3rem; border-bottom: 1px solid var(--ui-border); }
.settings-pane .keybind-table td { padding: 0.32rem 0.5rem; border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 60%, transparent); vertical-align: middle; }
.settings-pane .keybind-table td:last-child, .settings-pane .keybind-table th:last-child { width: 1%; white-space: nowrap; text-align: right; }
.settings-pane .keybind-table button.keybind { border-color: var(--ui-accent); }
.settings-pane .keybind.static { display: inline-block; cursor: default; background: transparent; text-align: center; }
.settings-pane .keybind-refusal { color: var(--ui-danger, #e05a5a); }
.settings-pane .bindings-table td:not(:first-child), .settings-pane .bindings-table th:not(:first-child) { width: 1%; white-space: nowrap; text-align: center; }
.settings-pane .bindings-table .binding-cell { min-width: 5.5rem; }
.settings-pane .fixed-shortcuts-title { margin: 0.8rem 0 0.3rem; font-size: max(var(--ui-min-text-size, 12px), 0.72rem); text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-muted); }
.settings-pane .fixed-shortcuts { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
.settings-pane .fixed-shortcuts li { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.settings-pane .bindings-table .binding-cell[data-capturing="true"] { background: color-mix(in srgb, var(--ui-accent) 25%, transparent); }
/* Controller support P1 (owner 10-07): pad input in controller mode hides the OS cursor until the mouse moves. */
body.pad-cursor-hidden, body.pad-cursor-hidden * { cursor: none !important; }
/* Owner 10-10: the controller-support notice sits above the Settings window (the save-prompt idiom, a little wider). */
.controller-notice-backdrop { z-index: 260; }
.save-prompt.controller-notice { width: min(440px, 92vw); }
.save-prompt .controller-notice-text { color: var(--ui-text); font-size: max(var(--ui-min-primary-text-size, 16px), 0.85rem); line-height: 1.45; }
.controller-toast {
  position: fixed; left: 50%; bottom: 72px; transform: translateX(-50%); z-index: 2000; max-width: min(92vw, 560px);
  padding: 0.6rem 1rem; border-radius: 8px; border: 1px solid var(--ui-accent); background: var(--ui-surface, #1b1b1f);
  color: var(--ui-text, #fff); box-shadow: 0 6px 24px rgb(0 0 0 / 45%); pointer-events: none; text-align: center;
}
/* The auto-switch notice is a small corner chip. */
.controller-toast[data-kind="switch"], .controller-toast[data-kind="connect"], .controller-toast[data-kind="player-cards"] { left: auto; right: 16px; top: 16px; bottom: auto; transform: none; padding: 0.35rem 0.75rem; font-size: 0.85rem; }
.settings-pane .actions {
  display: flex;
  justify-content: flex-end;
}
.settings-pane .actions .primary {
  background: var(--ui-primary);
  color: var(--ui-text-on-primary);
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
}
.skill-config { margin: 0.3rem 0; border: 1px solid var(--ui-border); border-radius: 6px; padding: 0.3rem 0.5rem; }
.skill-config summary { cursor: pointer; color: var(--ui-accent); font-size: max(var(--ui-min-primary-text-size, 16px), 0.82rem); padding: 0.2rem 0; font-weight: 600; }
.sc-filter {
  width: 100%; box-sizing: border-box; margin: 0.3rem 0;
  background: var(--ui-surface); color: inherit; border: 1px solid var(--ui-border); border-radius: 4px; padding: 0.3rem 0.5rem;
}
.sc-table { max-height: 260px; overflow-y: auto; border: 1px solid var(--ui-border); border-radius: 5px; }
.sc-thead, .sc-trow {
  display: grid;
  grid-template-columns: 1fr 8.5em 8.5em;
  gap: 5px; align-items: center; padding: 2px 6px;
}
.sc-table[data-markers='true'] .sc-thead,
.sc-table[data-markers='true'] .sc-trow {
  /* #15 (owner 08-11): the Marker glyph column sits LEFT of the My-team/Opposition dropdowns. */
  grid-template-columns: 1fr 4.5em 8em 8em;
}
.sc-thead { position: sticky; top: 0; background: var(--ui-surface-2); color: var(--ui-muted); font-size: max(var(--ui-min-text-size, 12px), 0.68rem); font-weight: 700; z-index: 1; }
.sc-trow { font-size: max(var(--ui-min-text-size, 12px), 0.74rem); border-top: 1px solid var(--ui-border); }
/* Owner 10-01 (S90/S94): the Traits / Injuries subheadings - a band across the table (not sticky: two stacked). */
.sc-subhead { padding: 0.3rem 0.5rem; border-top: 1px solid var(--ui-border); background: var(--ui-surface); color: var(--ui-heading); font-size: max(var(--ui-min-text-size, 12px), 0.72rem); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.sc-trow:nth-child(odd) { background: var(--ui-surface-2); }
.sc-skill { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-trow select, .sc-glyph {
  background: var(--ui-surface); color: inherit; border: 1px solid var(--ui-border); border-radius: 4px;
  padding: 0.15rem 0.25rem; font-size: max(var(--ui-min-text-size, 12px), 0.72rem); width: 100%; box-sizing: border-box;
}
.sc-glyph { text-align: center; }

/* Credits / attributions pane (owner 2026-07-03 r6f) */
.credits-head { margin: 0 0 0.2rem; font-size: max(var(--ui-min-primary-text-size, 16px), 0.95rem); color: var(--ui-text); }
.credits-list { list-style: none; margin: 0.4rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.credits-list li { display: flex; align-items: center; gap: 0.6rem; font-size: max(var(--ui-min-primary-text-size, 16px), 0.8rem); color: var(--ui-text); }
.credits-icon { width: 28px; height: 28px; object-fit: contain; flex: none; }
.credits-list a { color: var(--ui-accent); text-decoration: none; }
.credits-list a:hover { text-decoration: underline; }
.license-head { margin-top: 1rem; }
.update-notes { margin: 0.4rem 0; max-height: 12rem; overflow: auto; white-space: pre-wrap; }
.license-text { margin: 0.4rem 0 0; padding: 0.6rem 0.8rem; font-size: max(var(--ui-min-text-size, 12px), 0.7rem); line-height: 1.4; color: var(--ui-text); background: rgba(0, 0, 0, 0.2); border-radius: 4px; white-space: pre-wrap; }
.attribution-mirror { margin-top: 0.4rem; font-size: max(var(--ui-min-text-size, 12px), 0.75rem); line-height: 1.45; color: var(--ui-text); }
.attribution-mirror h4 { margin: 0.8rem 0 0.2rem; font-size: max(var(--ui-min-primary-text-size, 16px), 0.85rem); color: var(--ui-text); }
.attribution-mirror h5 { margin: 0.5rem 0 0.2rem; font-size: max(var(--ui-min-text-size, 12px), 0.78rem); color: var(--ui-text); }
.attribution-mirror p { margin: 0.3rem 0; }
.attribution-mirror ul { margin: 0.2rem 0 0.4rem; padding-left: 1.1rem; }
.attribution-mirror li { margin: 0.15rem 0; }
.attribution-mirror a { color: var(--ui-accent); text-decoration: none; }
.attribution-mirror a:hover { text-decoration: underline; }

/* Launch splash (owner 2026-07-03 r6f) */
.launch-splash {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vh 4vw;
  cursor: pointer;
  background: radial-gradient(ellipse at center, #0b1a12f2 0%, #05080cf7 70%, #020304fb 100%);
  backdrop-filter: blur(3px);
  animation: splash-in 0.35s ease-out;
}
@keyframes splash-in { from { opacity: 0; } to { opacity: 1; } }
.splash-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(82vmin, 720px);
  height: min(82vmin, 720px);
  transform: translate(-50%, -50%);
  object-fit: contain;
  opacity: 0.14;
  filter: saturate(1.1);
  pointer-events: none;
  user-select: none;
}
.splash-content {
  position: relative;
  z-index: 1;
  max-width: 560px;
  width: 100%;
  box-sizing: border-box;
  max-height: 92vh;
  /* owner 2026-07-14: overflow-y:auto alone forces overflow-x to compute to `auto` → a stray horizontal
     scrollbar; pin overflow-x hidden so only the vertical scroll can appear. */
  overflow: hidden auto;
  text-align: center;
  padding: 26px 30px 22px;
  border-radius: 14px;
  background: #0e1512d9;
  border: 1px solid #2f6b3e88;
  box-shadow: 0 16px 50px #000c, inset 0 0 0 1px #ffffff08;
  cursor: default;
  color: #dfe6df;
  /* Owner 2026-07-04g: splash BODY text in Helvetica/Arial (headings + CTA
     buttons keep their Nuffle display font via their own font-family). */
  font-family: Arial, Helvetica, sans-serif;
}
.splash-title {
  font-family: 'Nuffle', system-ui, sans-serif;
  font-size: max(var(--ui-min-primary-text-size, 16px), 1.55rem);
  font-weight: 900;
  margin: 0 0 0.5rem;
  color: #eafbea;
  text-shadow: 0 2px 10px #000c, 0 0 18px #2f6b3e66;
  letter-spacing: 0.01em;
}
/* owner 2026-07-03: keep the welcome header on ONE line — shrink to fit the card
   width and never wrap. */
.splash-title-oneline {
  white-space: nowrap;
  font-size: max(var(--ui-min-primary-text-size, 16px), clamp(0.82rem, 3.1vw, 1.2rem));
}
.splash-content p { margin: 0.5rem 0; font-size: max(var(--ui-min-primary-text-size, 16px), 0.95rem); line-height: 1.5; }
.splash-content a { color: #7fd68f; text-decoration: none; font-weight: 700; }
.splash-content a:hover { text-decoration: underline; color: #9deaad; }
.splash-twitch {
  margin: 0.9rem auto 0.4rem;
  width: 100%;
  max-width: 460px;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #333a46;
  background: #000;
}
.splash-twitch iframe { width: 100%; height: 100%; display: block; border: 0; }
/* owner 2026-07-03: desktop-build Twitch card (the live embed can't render there) */
.splash-twitch-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  cursor: pointer;
  color: #efeaff;
  background: linear-gradient(160deg, #6441a5 0%, #9146ff 55%, #772ce8 100%);
  border: 1px solid #a970ff;
  aspect-ratio: 16 / 6;
  font-family: 'Nuffle', system-ui, sans-serif;
  transition: filter 0.15s ease, transform 0.1s ease;
}
.splash-twitch-card:hover { filter: brightness(1.12); }
.splash-twitch-card:active { transform: translateY(1px); }
.splash-twitch-card .twitch-glyph { font-size: max(var(--ui-min-primary-text-size, 16px), 1.5rem); line-height: 1; opacity: 0.95; }
.splash-twitch-card .twitch-cta { font-size: max(var(--ui-min-primary-text-size, 16px), 1rem); }
.splash-twitch-card .twitch-cta b { color: #fff; }
.splash-twitch-card .twitch-host { font-size: max(var(--ui-min-text-size, 12px), 0.78rem); opacity: 0.85; letter-spacing: 0.02em; }
.splash-credit { font-size: max(var(--ui-min-primary-text-size, 16px), 0.82rem) !important; color: #9aa8a0; margin-top: 0.9rem !important; }
.splash-continue {
  margin-top: 1rem;
  background: #2f6b3e;
  color: #eafbea;
  border: 1px solid #4a8a58;
  border-radius: 7px;
  padding: 0.5rem 1.4rem;
  font-family: 'Nuffle', system-ui, sans-serif;
  font-size: max(var(--ui-min-primary-text-size, 16px), 0.9rem);
  font-weight: 700;
  cursor: pointer;
  animation: splash-hint 1.6s ease-in-out infinite;
}
.splash-continue:hover { background: #3a8350; }
@keyframes splash-hint { 0%, 100% { opacity: 0.72; } 50% { opacity: 1; } }
/* owner 2026-07-04: the credentials button + status on the splash / Connection tab */
.creds-open-btn {
  padding: 0.55rem 1rem;
  font-size: max(var(--ui-min-primary-text-size, 16px), 0.9rem);
  font-weight: 700;
  color: var(--ui-text-on-primary);
  background: var(--ui-primary);
  border: 1px solid var(--ui-primary);
  border-radius: 8px;
  cursor: pointer;
}
.creds-open-btn:hover { filter: brightness(1.15); }
.creds-status { display: flex; gap: 1.2rem; justify-content: center; margin: 0.5rem 0 0; font-size: max(var(--ui-min-primary-text-size, 16px), 0.8rem); color: var(--ui-muted); }
.creds-status b { color: var(--ui-text); }
.connection-fork-status { display: flex; flex-direction: column; }
/* owner 2026-07-04: tabbed FUMBBL / Super FUMBBL credentials menu */
.creds-menu-backdrop { z-index: 110; } /* above the settings modal (z 100) + launch splash */
.creds-menu {
  width: 380px;
  max-width: 92vw;
  /* Owner 2026-07-08: tall creds/register forms scroll inside the pane instead of
     overflowing the viewport on a short window. */
  max-height: 88vh;
  overflow-y: auto;
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: 12px;
  padding: 14px 16px 16px;
  box-shadow: 0 10px 40px #000b;
  color: var(--ui-text);
}
.creds-menu-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.creds-menu-head h2 { margin: 0; font-size: max(var(--ui-min-primary-text-size, 16px), 1.15rem); font-family: 'Nuffle', system-ui, sans-serif; color: var(--ui-primary); }
.creds-menu-close { background: none; border: none; color: var(--ui-muted); font-size: max(var(--ui-min-primary-text-size, 16px), 1.1rem); cursor: pointer; }
.creds-menu-close:hover { color: var(--ui-text); }
.creds-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
.creds-tabs button {
  flex: 1;
  padding: 7px 0;
  font-size: max(var(--ui-min-primary-text-size, 16px), 0.88rem);
  font-weight: 700;
  color: var(--ui-muted);
  background: var(--ui-surface-2);
  border: 1px solid var(--ui-border);
  border-radius: 7px;
  cursor: pointer;
}
.creds-tabs button[data-active='true'] { color: var(--ui-text-on-primary); background: var(--ui-primary); border-color: var(--ui-primary); }
.creds-panel { display: flex; flex-direction: column; gap: 0.4rem; }
.creds-panel .hint { margin: 0 0 0.4rem; }
.creds-menu-note { margin: 0.8rem 0 0; font-size: max(var(--ui-min-text-size, 12px), 0.72rem); color: var(--ui-muted); text-align: center; }
.creds-menu-actions { display: flex; justify-content: flex-end; margin-top: 0.9rem; }
.creds-menu-done {
  padding: 0.45rem 1.2rem;
  font-weight: 700;
  color: var(--ui-text-on-primary);
  background: var(--ui-primary);
  border: 1px solid var(--ui-primary);
  border-radius: 8px;
  cursor: pointer;
}
.creds-menu-done:hover { filter: brightness(1.15); }
/* owner 2026-07-08: register-a-fork-account control in the Super FUMBBL creds tab */
/* owner 2026-08-18: per-tab auth challenge. Secondary styling on purpose — Done stays the primary
   action, since checking is optional and a coach who skips it must not feel blocked. */
.creds-challenge { margin-top: 0.7rem; padding-top: 0.7rem; border-top: 1px solid #2c332c; }
.creds-challenge-btn {
  padding: 0.4rem 0.9rem;
  font-weight: 600;
  color: var(--ui-text);
  background: var(--ui-surface-2);
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  cursor: pointer;
}
.creds-challenge-btn:hover:not(:disabled) { border-color: var(--ui-primary); color: var(--ui-primary); }
.creds-challenge-btn:disabled { opacity: 0.6; cursor: default; }
.creds-challenge-result { margin: 0.45rem 0 0; font-size: max(var(--ui-min-text-size, 12px), 0.78rem); line-height: 1.35; color: #cbd4cb; }
/* `warn` is the FUMBBL name check: it passed, but it did not prove the password — so it is
   deliberately NOT the same green as a real verification. */
.creds-challenge-result[data-kind='ok'] { color: #7fd18a; }
.creds-challenge-result[data-kind='warn'] { color: #d9c07a; }
.creds-challenge-result[data-kind='fail'] { color: #e2867f; }

.creds-register { margin-top: 0.7rem; padding-top: 0.7rem; border-top: 1px solid #2c332c; }
.creds-register-btn {
  padding: 0.4rem 0.9rem;
  font-weight: 600;
  color: var(--ui-text-on-primary);
  background: var(--ui-primary);
  border: 1px solid var(--ui-primary);
  border-radius: 8px;
  cursor: pointer;
}
.creds-register-btn:hover:not(:disabled) { filter: brightness(1.15); }
.creds-register-btn:disabled { opacity: 0.6; cursor: default; }
.creds-register-status { margin: 0.4rem 0 0; color: #cbd4cb; }
/* owner 2026-07-08: register-account modal */
.register-modal { max-width: min(400px, 92vw); }
.register-status { text-align: left; color: #cbd4cb; }
.register-cancel {
  margin-right: auto;
  padding: 0.45rem 1rem;
  color: var(--ui-text);
  background: var(--ui-surface-2);
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  cursor: pointer;
}
.register-cancel:hover { filter: brightness(1.2); }
.creds-menu-done:disabled { opacity: 0.6; cursor: default; }
.creds-field { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; margin: 0.6rem 0; text-align: left; font-size: max(var(--ui-min-primary-text-size, 16px), 0.82rem); color: var(--ui-muted); }
.creds-field input {
  width: 100%; box-sizing: border-box;
  background: var(--ui-surface-2); color: var(--ui-text); border: 1px solid var(--ui-border); border-radius: 6px; padding: 0.45rem 0.6rem;
}
.creds-field input:focus { outline: none; border-color: var(--ui-primary); }
.splash-dontshow { display: inline-flex; align-items: center; gap: 6px; margin-top: 0.9rem; font-size: max(var(--ui-min-primary-text-size, 16px), 0.82rem); color: #b8c0b8; cursor: pointer; }
.splash-dontshow input { cursor: pointer; }

/* Red-green colourblind mode (owner 2026-07-03 r3): the app's success/primary
   accents are green (#3a5f3f family), confusable with red danger/away states for
   red-green colourblind users. Remap those greens to a distinguishable blue so
   green-vs-red reads as blue-vs-red. Applied via `.cb-accent` on the shell (deuteranopia/protanopia modes).
   Global styles (App.vue + SpectateView are un-scoped) so this reaches both. */
.cb-accent .menubar button,
.cb-accent .game-browser button,
.cb-accent .settings-pane .actions .primary,
.cb-accent .confirm-move,
.cb-accent .apo-actions .apo-use,
.cb-accent .sc-yes {
  background: #2f6fb0;
  border-color: #4a86c8;
}
.cb-accent .menubar button:hover,
.cb-accent .game-menu button:hover:not(:disabled),
.cb-accent .end-turn:hover:not(:disabled),
.cb-accent .confirm-move:hover,
.cb-accent .sc-yes:hover {
  background: #3d84cf;
}
</style>
