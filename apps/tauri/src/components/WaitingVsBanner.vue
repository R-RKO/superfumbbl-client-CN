<script setup lang="ts">
// Owner 10-06: TEAM VS TEAM splash across the top of the waiting board — crest, team name, coach and TV for each
// side. Presentation only: the model comes from game/waitingVsBanner.ts (names at once, race/TV as data arrives).
import { ref, watch } from 'vue';
import { teamLogoUrl } from '../game/teamLogos';
import { formatBannerTv, type BannerSide, type WaitingBannerModel } from '../game/waitingVsBanner';

/** `inline` (owner 10-09): sits in the flow directly above the waiting box instead of across the top of the board.
 *  Owner 10-21: the game-load rank panel is a second instance of THIS banner (never a hand-drawn copy):
 *  - `scale` multiplies every size (bar, crest, VS medallion, type) through `--vs-scale`; unset = 1, the waiting board
 *    renders exactly as before (no style attribute, every size `calc(<original> * var(--vs-scale, 1))`);
 *  - `kits` picks each crest's home / away kit (the waiting board: mine = home, opponent = away);
 *  - `hideMeta` drops the race / TV row;
 *  - slots `badge` (between the crest and the names) and `detail` (under the coach, in the meta row's small type)
 *    carry the panel's rank badge and record line (slot prop `side`: mine / opponent); without them nothing extra renders;
 *  - `keepWords` (browser check 10-21): team names wrap ONLY at spaces, never inside a word, and the text column takes
 *    the side's remaining width; the detail line stays on one line;
 *  - `vars` (bar-level) and `sideVars` (per side) set the fit custom properties the rank bar computes
 *    (game/rankBarLayout.ts): --vs-bar-width, --vs-type (type scale, else --vs-scale), --vs-team-fit, --vs-detail-fit.
 *    Unset, every one falls back to the shipped value. */
const props = defineProps<{
  model: WaitingBannerModel; inline?: boolean;
  scale?: number; kits?: { mine: 'home' | 'away'; opponent: 'home' | 'away' }; hideMeta?: boolean;
  keepWords?: boolean; vars?: Record<string, string>; sideVars?: { mine?: Record<string, string>; opponent?: Record<string, string> };
}>();
const kit = (slot: 'mine' | 'opponent'): 'home' | 'away' => props.kits?.[slot] ?? (slot === 'mine' ? 'home' : 'away');
const scaleStyle = (): Record<string, string> | undefined => {
  const style = { ...(props.scale && props.scale !== 1 ? { '--vs-scale': String(props.scale) } : {}), ...(props.vars ?? {}) };
  return Object.keys(style).length ? style : undefined;
};

/** A crest that failed to load falls back to the initials (like the Play blade). */
const failed = ref(new Set<string>());
watch(() => [props.model.mine.race, props.model.opponent.race], () => { failed.value = new Set(); });

function crest(side: BannerSide, kit: 'home' | 'away'): string | null {
  if (!side.race) return null;
  const url = teamLogoUrl({ race: side.race, side: kit });
  return url && !failed.value.has(url) ? url : null;
}
function crestFailed(url: string | null): void {
  if (!url) return;
  const next = new Set(failed.value); next.add(url); failed.value = next;
}
function initials(name: string): string {
  const words = name.replace(/['’]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  const [first = '?', second] = words;
  return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase();
}
</script>

<template>
  <section class="vs-banner" :class="{ inline, 'keep-words': keepWords }" :style="scaleStyle()" data-testid="waiting-vs-banner" aria-label="Match-up">
    <div v-for="slot in (['mine', 'opponent'] as const)" :key="slot" class="vs-side" :class="slot" :style="sideVars?.[slot]" :data-testid="`vs-${slot}`">
      <span class="vs-crest">
        <img v-if="crest(model[slot], kit(slot))" :src="crest(model[slot], kit(slot))!"
          :alt="`${model[slot].teamName} logo`" @error="crestFailed(crest(model[slot], kit(slot)))" />
        <span v-else class="vs-initials" aria-hidden="true">{{ model[slot].unknown ? '?' : initials(model[slot].teamName) }}</span>
      </span>
      <span v-if="$slots.badge" class="vs-badge"><slot name="badge" :side="slot" /></span>
      <span class="vs-text">
        <strong class="vs-team" data-testid="vs-team">{{ model[slot].teamName }}</strong>
        <span v-if="model[slot].coach" class="vs-coach" data-testid="vs-coach">{{ model[slot].coach }}</span>
        <span v-if="$slots.detail" class="vs-meta vs-detail"><slot name="detail" :side="slot" /></span>
        <span v-if="!hideMeta" class="vs-meta">
          <span v-if="model[slot].race" data-testid="vs-race">{{ model[slot].race }}</span>
          <span v-if="formatBannerTv(model[slot].tv)" class="vs-tv" data-testid="vs-tv">{{ formatBannerTv(model[slot].tv) }}</span>
        </span>
      </span>
    </div>
    <span class="vs-mark" aria-label="versus">VS</span>
  </section>
</template>

<style scoped>
.vs-banner {
  position: absolute; top: 18px; left: 50%; transform: translateX(-50%); z-index: 3;
  width: var(--vs-bar-width, min(calc(880px * var(--vs-scale, 1)), calc(100% - 32px))); box-sizing: border-box;
  display: grid; grid-template-columns: 1fr auto 1fr; grid-template-areas: 'mine mark opponent'; align-items: center; gap: calc(14px * var(--vs-scale, 1));
  padding: calc(10px * var(--vs-scale, 1) * var(--vs-pad-y, 1)) calc(16px * var(--vs-scale, 1)); border-radius: calc(10px * var(--vs-scale, 1));
  background: linear-gradient(90deg, #300f0fe8 0%, rgba(12, 15, 21, 0.95) 32%, rgba(12, 15, 21, 0.95) 68%, #300f0fe8 100%);
  border: 2px solid #e03030cc; box-shadow: 0 10px 28px #000c, inset 0 0 0 1px #00000080;
  color: var(--ui-text, #f0f0f0); pointer-events: none;
}
.vs-banner.inline { position: relative; top: auto; left: auto; transform: none; flex: none; }
.vs-side { display: flex; align-items: center; gap: calc(12px * var(--vs-scale, 1)); min-width: 0; }
.vs-side.mine { grid-area: mine; }
.vs-side.opponent { grid-area: opponent; flex-direction: row-reverse; text-align: right; }
.vs-crest {
  flex: none; width: calc(64px * var(--vs-scale, 1)); height: calc(64px * var(--vs-scale, 1)); display: grid; place-items: center;
  border-radius: 50%; background: radial-gradient(circle at 50% 40%, #2a1012, #0b0d12 75%); border: 1px solid #e0303080;
}
.vs-crest img { width: calc(56px * var(--vs-scale, 1)); height: calc(56px * var(--vs-scale, 1)); object-fit: contain; filter: drop-shadow(0 2px 3px #000); }
.vs-initials { font-family: var(--font-display); font-size: calc(1.3rem * var(--vs-type, var(--vs-scale, 1))); color: #e8918c; }
.vs-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.vs-team {
  font-family: var(--font-display); font-size: calc(max(var(--ui-min-primary-text-size, 16px), 1.25rem) * var(--vs-type, var(--vs-scale, 1)) * var(--vs-team-fit, 1));
  letter-spacing: 0.04em; text-transform: uppercase; color: #fff; text-shadow: 0 2px 4px #000;
  /* Owner 10-12: wrap at word starts, whole name visible; only a token wider than the column breaks inside the word. */
  white-space: normal; word-break: normal; overflow-wrap: anywhere; min-width: 0;
}
.vs-coach { font-size: calc(max(var(--ui-min-primary-text-size, 16px), 0.95rem) * var(--vs-type, var(--vs-scale, 1))); color: #e8918c; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vs-meta { display: flex; gap: calc(8px * var(--vs-scale, 1)); font-size: calc(max(var(--ui-min-secondary-text-size, 13px), 0.82rem) * var(--vs-type, var(--vs-scale, 1))); color: var(--ui-text-muted, #b8bcc6); }
.vs-side.opponent .vs-meta { justify-content: flex-end; }
.vs-tv { font-weight: 700; color: #f2d4a0; }
/* Owner 10-21 (rank panel slots; absent on the waiting board): the badge sits between the crest and the names, and the
   detail line under the coach is the meta row's small type in small capitals. */
.vs-badge { flex: none; display: grid; place-items: center; }
.vs-detail {
  font-variant: small-caps; letter-spacing: 0.04em; white-space: nowrap;
  font-size: calc(max(var(--ui-min-secondary-text-size, 13px), 0.82rem) * var(--vs-type, var(--vs-scale, 1)) * var(--vs-detail-fit, 1));
}
/* keepWords (rank bar): never a break inside a word; the text column takes the side's remaining width. */
.vs-banner.keep-words .vs-team { overflow-wrap: normal; word-break: keep-all; }
.vs-banner.keep-words .vs-text { flex: 1 1 auto; row-gap: calc(3px * var(--vs-scale, 1) * var(--vs-pad-y, 1)); }
/* the rank bar's detail block: its lines stacked (each one line), aligned to the side's edge */
.vs-banner.keep-words .vs-detail { flex-direction: column; gap: 0; }
.vs-banner.keep-words .vs-side.opponent .vs-detail { align-items: flex-end; }
.vs-mark {
  grid-area: mark; display: grid; place-items: center; width: calc(66px * var(--vs-scale, 1)); height: calc(66px * var(--vs-scale, 1)); border-radius: 50%;
  font-family: var(--font-snes); font-size: calc(2rem * var(--vs-type, var(--vs-scale, 1))); font-style: italic; font-weight: 900; color: #fff;
  background: linear-gradient(135deg, #b81818, #5a0a0a); border: 2px solid #ff6a6acc;
  box-shadow: 0 0 18px #e0303099, 0 4px 10px #000c; text-shadow: 2px 2px 0 #000;
}
@media (max-width: 640px) {
  .vs-banner { gap: calc(8px * var(--vs-scale, 1)); padding: calc(8px * var(--vs-scale, 1)) calc(10px * var(--vs-scale, 1)); }
  .vs-crest { width: calc(40px * var(--vs-scale, 1)); height: calc(40px * var(--vs-scale, 1)); }
  .vs-crest img { width: calc(34px * var(--vs-scale, 1)); height: calc(34px * var(--vs-scale, 1)); }
  .vs-mark { width: calc(44px * var(--vs-scale, 1)); height: calc(44px * var(--vs-scale, 1)); font-size: calc(1.3rem * var(--vs-type, var(--vs-scale, 1))); }
  .vs-side { gap: calc(8px * var(--vs-scale, 1)); }
  .vs-meta { flex-direction: column; gap: 0; }
}
</style>
