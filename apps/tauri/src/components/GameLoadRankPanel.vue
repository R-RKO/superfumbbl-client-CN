<script setup lang="ts">
/**
 * Game-load rank panel (owner 10-20), Modern view. Owner 10-21: it IS the waiting board's red match-up bar - a second
 * instance of components/WaitingVsBanner.vue (crest circle | TEAM NAME + coach in the pink accent | red VS medallion |
 * mirrored), never a hand-drawn copy. Our additions ride the banner's slots: the rank badge between each crest and its
 * names (the title centred on it, or the text chip), and "Record W/D/L · win % · CR · WAR" under the coach in the
 * banner's small type. The race / TV row is not shown.
 *
 * Layout (browser check 10-21; game/rankBarLayout.ts): each side is [crest | badge | text column], the column taking
 * the remaining width; the record line is ONE line - the bar steps its +30% growth, the record line, the badge and
 * finally the type down until it fits (the growth is secondary to a clean layout); team names wrap only at spaces (at
 * most two lines, the name's font shrunk to fit). Placement: the waiting board's place, a third of the way down the
 * pitch, but always below the in-game top HUD band (coach panels, scoreboard, clock).
 *
 * Logic and timing live in game/gameLoadRankPanel.ts; this is presentation only. pointer-events: none throughout.
 * Text from FUMBBL and the game state only; the crests come from the banner's own local loader and the badge PNGs are
 * the only other images (no FUMBBL art).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import CoachBadge from '../views/console/play/CoachBadge.vue';
import WaitingVsBanner from './WaitingVsBanner.vue';
import { coachProfileStatItems, coachProfileStatParts, coachTitleSlug } from '../game/fumbblCoachProfile';
import type { RankPanelSide, RankPanelState } from '../game/gameLoadRankPanel';
import type { BannerSide, WaitingBannerModel } from '../game/waitingVsBanner';
import { DEFAULT_BAR_FONTS, RANK_BAR_LAYOUT_SCALE, makeMeasureBarText, rankBarLayout, rankBarTop, renderedFont, type BarFonts } from '../game/rankBarLayout';
import { settings } from '../game/settings';

/** `covering` (owner 10-21: "load the elements and sprites behind this pane"): the renderer has not reported ready -
 *  the pitch sits behind the waiting board's backdrop until it does, then the backdrop fades and the bar stays. */
const props = defineProps<{ panel: RankPanelState | null; covering?: boolean }>();

/** The in-game top HUD band the bar must clear (SpectateView: coach corner panels, scoreboard, turn timer). */
const HUD_SELECTOR = '.coach-panel, .hud-center, .turn-timer';

const layer = ref<HTMLElement | null>(null);
const bannerHost = ref<HTMLElement | null>(null);
const areaWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);
const rootPx = ref(16);
const top = ref(0);
/** The fonts the team name and the record line actually render with (read from the elements; Astra r3). */
const fonts = ref<BarFonts>({ ...DEFAULT_BAR_FONTS });
/** Astra r4: a font LOAD leaves the computed family / weight unchanged, so the layout would keep its fallback-font
 *  measurements; this epoch (bumped on document.fonts.ready and on a UI-font change) invalidates it explicitly. */
const fontsEpoch = ref(0);
const measureText = computed(() => { void fontsEpoch.value; return makeMeasureBarText(fonts.value); });
let layoutRuns = 0;

const badgeFailed = reactive<Record<'left' | 'right', boolean>>({ left: false, right: false });
watch([() => props.panel?.seq, () => settings.coachBadgeStyle], () => { badgeFailed.left = false; badgeFailed.right = false; });

const which = (slot: 'mine' | 'opponent'): 'left' | 'right' => (slot === 'mine' ? 'left' : 'right');
const name = (s: RankPanelSide): string => s.profile?.name || s.coach;
const title = (s: RankPanelSide): string | undefined => s.profile?.title;
const stats = (s: RankPanelSide): string => coachProfileStatParts(s.profile).join(' · ');
const showBadge = (s: RankPanelSide, w: 'left' | 'right'): boolean => !!coachTitleSlug(title(s)) && !badgeFailed[w];

function bannerSide(s: RankPanelSide): BannerSide {
  const coach = name(s);
  return { teamName: s.team || (coach ? `${coach}'s team` : 'Team'), coach: coach || undefined, race: s.race || undefined };
}
const model = computed<WaitingBannerModel | null>(() => (props.panel
  ? { mine: bannerSide(props.panel.left), opponent: bannerSide(props.panel.right) }
  : null));
const kits = computed(() => (props.panel ? { mine: props.panel.left.side, opponent: props.panel.right.side } : undefined));

const layout = computed(() => {
  layoutRuns += 1;
  const m = model.value;
  const p = props.panel;
  return rankBarLayout({
    areaWidth: areaWidth.value,
    rootPx: rootPx.value,
    layoutScale: RANK_BAR_LAYOUT_SCALE,
    teamNames: [m?.mine.teamName ?? '', m?.opponent.teamName ?? ''],
    records: [p ? stats(p.left) : '', p ? stats(p.right) : ''],
    measure: measureText.value,
  });
});
const barVars = computed(() => ({ '--vs-bar-width': `${layout.value.barWidth}px`, '--vs-type': String(layout.value.typeScale) }));
const sideVars = computed(() => ({
  mine: { '--vs-team-fit': String(layout.value.teamFit[0]), '--vs-detail-fit': String(layout.value.recordFit) },
  opponent: { '--vs-team-fit': String(layout.value.teamFit[1]), '--vs-detail-fit': String(layout.value.recordFit) },
}));

const ariaLabel = computed(() => {
  const p = props.panel;
  if (!p) return '';
  const card = (s: RankPanelSide) => [name(s), title(s), stats(s), s.team].filter(Boolean).join(', ');
  return `${card(p.left)} versus ${card(p.right)}`;
});

const hudElements = (): HTMLElement[] => {
  const scope = layer.value?.parentElement;
  return scope ? Array.from(scope.querySelectorAll<HTMLElement>(HUD_SELECTOR)) : [];
};

/** Width, root font size, the rendered fonts and the vertical place. Run after Vue has applied the new sizing
 *  (nextTick + an animation frame) whenever anything it depends on changes size - never on a timer. */
function measure(): void {
  const el = layer.value;
  if (typeof window !== 'undefined') {
    rootPx.value = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    areaWidth.value = el?.clientWidth || window.innerWidth;
  }
  if (!el) return;
  const team = renderedFont(el.querySelector('.vs-team'));
  const record = renderedFont(el.querySelector('.vs-detail'));
  if (team && record) {
    const next: BarFonts = { team: team.family, teamWeight: team.weight, record: record.family, recordWeight: record.weight };
    const was = fonts.value;
    if (next.team !== was.team || next.teamWeight !== was.teamWeight || next.record !== was.record || next.recordWeight !== was.recordWeight) fonts.value = next;
  }
  const layerTop = el.getBoundingClientRect().top;
  let hudBottom = 0;
  for (const hud of hudElements()) {
    const r = hud.getBoundingClientRect();
    if (r.height > 0) hudBottom = Math.max(hudBottom, r.bottom - layerTop);
  }
  top.value = rankBarTop({ height: el.clientHeight, barHeight: bannerHost.value?.offsetHeight ?? 0, hudBottom });
}
let frame = 0;
/** After the DOM settles: nextTick, then the next animation frame (a size change, a font load, a HUD reflow). */
function remeasure(): void {
  void nextTick(() => {
    if (typeof requestAnimationFrame !== 'function') { measure(); return; }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { frame = 0; measure(); });
  });
}
let observer: ResizeObserver | null = null;
/** Observe the layer, the bar itself and every HUD element while the bar shows; release them all on hide. */
function observe(): void {
  observer?.disconnect();
  if (!layer.value) return;
  if (!observer && typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(remeasure);
  if (!observer) return;
  observer.observe(layer.value);
  if (bannerHost.value) observer.observe(bannerHost.value);
  for (const hud of hudElements()) observer.observe(hud);
}
const observedCount = (): number => (layer.value ? 1 + (bannerHost.value ? 1 : 0) + hudElements().length : 0);
/** Fonts changed underneath the same family names: drop the cached layout, then measure again. */
function fontsChanged(): void {
  fontsEpoch.value += 1;
  remeasure();
}
defineExpose({ observedCount, layoutRuns: () => layoutRuns, fontsChanged });
onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('resize', remeasure);
  if (typeof document !== 'undefined') void document.fonts?.ready?.then(fontsChanged);
});
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('resize', remeasure);
  observer?.disconnect();
  observer = null;
  if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
});
watch([() => props.panel?.seq, layer], async () => {
  await nextTick();
  if (!props.panel || !layer.value) { observer?.disconnect(); return; } // hidden: nothing stays observed
  observe();
  measure();
  remeasure(); // the bar's own height after its first layout
});
// the UI font setting changes the record line's font: measure again in the new one (Astra r3)
watch(() => settings.uiFont, fontsChanged);
</script>

<template>
  <Transition name="rank-cover">
    <div v-if="panel && covering" class="rank-cover" aria-hidden="true"></div>
  </Transition>
  <Transition name="rank-panel">
    <div v-if="panel && model" :key="panel.seq" ref="layer" class="rank-panel" role="status" aria-live="polite" :aria-label="ariaLabel">
      <div ref="bannerHost" class="rank-bar-slot" :style="{ top: `${top}px` }">
        <WaitingVsBanner :model="model" inline :scale="layout.layoutScale" :kits="kits" hide-meta keep-words
          :vars="barVars" :side-vars="sideVars">
          <template #badge="{ side: slot }">
            <CoachBadge v-if="showBadge(panel[which(slot)], which(slot))" :title="title(panel[which(slot)])!" :size="layout.badgeSize"
              @error="badgeFailed[which(slot)] = true" />
            <span v-else-if="title(panel[which(slot)])" class="rank-title-chip">{{ title(panel[which(slot)]) }}</span>
          </template>
          <template #detail="{ side: slot }">
            <span class="rank-stats" :data-side="which(slot)"><template v-for="(item, i) in coachProfileStatItems(panel[which(slot)].profile)" :key="i"><span
              class="rank-stat" :title="item.title" :aria-label="item.title ? `${item.text}, ${item.title}` : undefined">{{ item.text }}</span><template
              v-if="i < coachProfileStatItems(panel[which(slot)].profile).length - 1"> · </template></template></span>
          </template>
        </WaitingVsBanner>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.rank-panel {
  /* Owner 10-21: "on-pitch toasts are rendering on top of the [coach stat] panels" - the panel sits ABOVE every
     on-pitch toast and pill. Tier table (SpectateView.vue unless noted; pinned by test/gameLoadRankPanelLayer.test.ts):
       13  .chat-toast-stack            22  .action-toast            40  .loner-failed-cue / .injury-splash /
       42  .turn-boundary-stack           .ko-toast / .fall-toast    42  .masterchef-splash   43  .staller-splash
       44  .opponent-left-toast         52  .reroll-toast (+ Team Captain)                  54  reactive pills
       45-49 coin toss / weather / kick-off cines, click-to-skip catcher, cine-tier cards (unchanged)
       55  THIS PANEL (pointer-events none; a click or key dismisses it)
       55  .mvp-nominate-overlay (EndGamePickPane)   57  end-game front (config bar, chat, log)   60+ admin / modals
     Input cards (yes/no 47, skill choice 48, prompt-front 52 ...) sit below the toast tiers, so instead of a z-index
     the panel PAUSES whenever a card addressed to this coach is up (gameLoadRankPanel.ts inputPending), and it never
     shows during the end-game.
     The layer covers the pitch host; the bar's slot is placed by rankBarTop (a third down, below the top HUD). */
  position: absolute; inset: 0; z-index: 55;
  pointer-events: none; user-select: none;
}
.rank-bar-slot { position: absolute; left: 0; right: 0; display: flex; justify-content: center; }
.rank-title-chip {
  padding: 3px 10px; border-radius: 999px; color: #101010; background: #efc957;
  font-family: 'Nuffle', system-ui, sans-serif; font-size: 0.9em; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
  white-space: nowrap;
}
/* The record line is one line (the layout sizes it to fit); each part is kept whole. */
.rank-stat { white-space: nowrap; }
/* The loading cover: the waiting board's pitch backdrop at the same strength (WaitingBoardView.vue: the #05070c board
   under the .waiting-board-overlay gradient), so sprites still loading behind it are not seen. pinned equal there. */
.rank-cover {
  position: absolute; inset: 0; z-index: 55; pointer-events: none;
  background: radial-gradient(ellipse at center, #0b122099 0%, #05070cc4 80%), #05070c;
}
.rank-cover-leave-active { transition: opacity var(--p-400, 400ms) ease; }
.rank-cover-leave-to { opacity: 0; }
.rank-panel-enter-active, .rank-panel-leave-active { transition: opacity var(--p-400, 400ms) ease; }
.rank-panel-enter-from, .rank-panel-leave-to { opacity: 0; }
</style>
