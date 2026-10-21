<script setup lang="ts">
/**
 * Game-load rank panel (owner 10-20), Modern view: two coach cards side by side with "VS" between them - badge
 * (96 px, title centred on it), coach name, "Record W/D/L · win % · CR", team name muted underneath. Logic and timing
 * live in game/gameLoadRankPanel.ts; this is presentation only. pointer-events: none throughout - it never takes input
 * from the board. Text from FUMBBL and the game state only; the badge PNGs are the only images (no FUMBBL art).
 */
import { reactive, watch } from 'vue';
import CoachBadge from '../views/console/play/CoachBadge.vue';
import { coachProfileStatParts, coachTitleSlug } from '../game/fumbblCoachProfile';
import type { RankPanelSide, RankPanelState } from '../game/gameLoadRankPanel';
import { settings } from '../game/settings';

const props = defineProps<{ panel: RankPanelState | null }>();

const badgeFailed = reactive<Record<'left' | 'right', boolean>>({ left: false, right: false });
watch([() => props.panel?.seq, () => settings.coachBadgeStyle], () => { badgeFailed.left = false; badgeFailed.right = false; });

const name = (s: RankPanelSide): string => s.profile?.name || s.coach;
const title = (s: RankPanelSide): string | undefined => s.profile?.title;
const stats = (s: RankPanelSide): string => coachProfileStatParts(s.profile).join(' · ');
const showBadge = (s: RankPanelSide, which: 'left' | 'right'): boolean => !!coachTitleSlug(title(s)) && !badgeFailed[which];
const ariaLabel = (s: RankPanelSide): string => [name(s), title(s), stats(s), s.team].filter(Boolean).join(', ');
</script>

<template>
  <Transition name="rank-panel">
    <div v-if="panel" :key="panel.seq" class="rank-panel" role="status" aria-live="polite" :aria-label="`${name(panel.left)} versus ${name(panel.right)}`">
      <template v-for="which in (['left', 'right'] as const)" :key="which">
        <span v-if="which === 'right'" class="rank-vs" aria-hidden="true">VS</span>
        <section class="rank-coach" :class="[which, `seat-${panel[which].side}`]" :aria-label="ariaLabel(panel[which])">
          <span class="rank-badge-slot">
            <CoachBadge v-if="showBadge(panel[which], which)" :title="title(panel[which])!" :size="96" @error="badgeFailed[which] = true" />
            <span v-else-if="title(panel[which])" class="rank-title-chip">{{ title(panel[which]) }}</span>
          </span>
          <strong class="rank-name">{{ name(panel[which]) }}</strong>
          <span class="rank-stats">{{ stats(panel[which]) }}</span>
          <span class="rank-team">{{ panel[which].team }}</span>
        </section>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.rank-panel {
  /* Owner 10-20 (browser check): left 0 / right 0 + auto margins and an explicit max-content width - a half-way left offset
     box is capped at half the stage (shrink-to-fit), which squeezed the cards and cut the stats line short. */
  position: absolute; left: 0; right: 0; top: 50%; z-index: 40; transform: translateY(-50%);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 22px; box-sizing: border-box;
  width: max-content; max-width: calc(100% - 32px);
  margin: 0 auto; padding: 18px 26px;
  border: 1px solid #efc95766; border-radius: 10px; color: #f4ecd8;
  background: linear-gradient(180deg, #14181ef2, #0b0d10f2); box-shadow: 0 14px 40px #000c, 0 0 0 1px #000 inset;
  pointer-events: none; user-select: none;
}
/* Sized to the content, never clipped: the card is at least as wide as the longest expected stats line
   ("Record 100/100/100 · 100 % · CR 2000", ~37ch of 14 px text), and the line itself never ellipsizes. */
.rank-coach { display: grid; justify-items: center; gap: 3px; width: max-content; min-width: 38ch; max-width: 46ch; text-align: center; font-size: 14px; }
.rank-badge-slot { display: grid; place-items: center; width: 96px; height: 96px; }
.rank-title-chip {
  padding: 3px 10px; border-radius: 999px; color: #101010; background: #efc957;
  font-family: 'Nuffle', system-ui, sans-serif; font-size: 13px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
}
.rank-name { max-width: 100%; font-size: 20px; font-weight: 700; line-height: 24px; overflow-wrap: anywhere; }
.rank-stats { min-height: 17px; color: #f4ecd8d9; font-size: 14px; line-height: 17px; white-space: nowrap; }
.rank-team { min-height: 16px; max-width: 100%; color: #f4ecd88c; font-size: 13px; line-height: 16px; overflow-wrap: anywhere; }
.rank-vs {
  color: #efc957; font-family: 'SNES', 'Nuffle', sans-serif; font-size: 40px; font-style: italic; line-height: 1;
  text-shadow: 2px 2px 0 #000;
}
.rank-panel-enter-active, .rank-panel-leave-active { transition: opacity var(--p-400, 400ms) ease; }
.rank-panel-enter-from, .rank-panel-leave-to { opacity: 0; }
/* Too narrow for the two cards side by side (2 x 38ch + VS + padding ~ 700 px): stack them, VS between. */
@media (max-width: 760px) {
  .rank-panel { flex-direction: column; gap: 8px; padding: 12px 16px; }
  .rank-vs { font-size: 26px; }
}
</style>
