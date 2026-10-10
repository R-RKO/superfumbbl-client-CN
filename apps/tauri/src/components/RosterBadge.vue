<script setup lang="ts">
/**
 * Owner 10-10: the roster row's LVL / injury badge as a piece of its own, for the post-game MVP card (the roster row
 * left the MVP tab, and the card took over the two things only the row had: this badge and the player's value).
 * Same art, same text fallback, same rule as the row in PostGameRoster.vue: an injury REPLACES the level; an injury
 * suffered this game wears the added-skill gold box; a rookie with no injury shows nothing. PostGameRoster keeps its
 * own inline markup (the pick panes' check mark shares its badge slot); a change to the badge look belongs in both.
 */
import { ROSTER_INJURY_TEXT, ROSTER_INJURY_TITLE, ROSTER_RIP_SKULL_URL, rosterInjuryArt, rosterLevelArt, type RosterInjuryBadge } from '../game/rosterLevelArt';

defineProps<{ injury?: RosterInjuryBadge | null; injuryNew?: boolean; advancements?: number }>();
</script>

<template>
  <span v-if="injury || (advancements ?? 0) > 0" class="roster-badge" :data-level="advancements ?? 0" :data-injury="injury || null">
    <span v-if="injury === 'rip' && ROSTER_RIP_SKULL_URL" class="roster-badge-rip" :data-new="injuryNew ? 'true' : null" :title="ROSTER_INJURY_TITLE.rip">
      <img class="roster-badge-rip-skull" :src="ROSTER_RIP_SKULL_URL" alt="" />
      <img v-if="rosterInjuryArt('rip')" class="roster-badge-rip-text" :src="rosterInjuryArt('rip')!.src" :srcset="rosterInjuryArt('rip')!.srcset" alt="RIP" />
      <span v-else class="roster-badge-rip-text roster-badge-text roster-badge-inj-text">RIP</span>
    </span>
    <template v-else-if="injury">
      <img v-if="rosterInjuryArt(injury)" class="roster-badge-inj-img" :data-new="injuryNew ? 'true' : null" :src="rosterInjuryArt(injury)!.src"
        :srcset="rosterInjuryArt(injury)!.srcset" :alt="ROSTER_INJURY_TEXT[injury]" :title="ROSTER_INJURY_TITLE[injury]" />
      <span v-else class="roster-badge-text roster-badge-inj-text" :data-new="injuryNew ? 'true' : null" :title="ROSTER_INJURY_TITLE[injury]">{{ ROSTER_INJURY_TEXT[injury] }}</span>
    </template>
    <template v-else>
      <img v-if="rosterLevelArt(advancements!)" class="roster-badge-lvl-img" :src="rosterLevelArt(advancements!)!.src"
        :srcset="rosterLevelArt(advancements!)!.srcset" :alt="`LVL ${advancements}`" :title="`Level ${advancements}`" />
      <span v-else class="roster-badge-text" :title="`Level ${advancements}`">LVL {{ advancements }}</span>
    </template>
  </span>
</template>

<style scoped>
/* Sizes are the roster row's (PostGameRoster.vue .pg-roster-lvl-img / -inj-img / -rip / -lvl-text), in em off the host's font size. */
.roster-badge { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; user-select: none; -webkit-user-select: none; }
.roster-badge img { -webkit-user-drag: none; }
.roster-badge-lvl-img { height: 1em; width: auto; max-width: 3.6em; object-fit: contain; image-rendering: auto; }
.roster-badge-inj-img { height: 1.5em; width: auto; max-width: 3.6em; object-fit: contain; image-rendering: auto; }
.roster-badge-rip { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 3.4em; height: 2.4em; }
.roster-badge-rip-skull { position: absolute; inset: 0; margin: auto; height: 2.7em; width: 2.7em; object-fit: contain; image-rendering: auto; }
.roster-badge-rip-text { position: relative; height: 1.1em; width: auto; image-rendering: auto; }
.roster-badge-text {
  display: inline-block;
  padding: 0.16em 0.34em 0.12em;
  font-family: ui-monospace, 'Consolas', 'Courier New', monospace;
  font-size: 0.74em;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.06em;
  white-space: nowrap;
  color: #ffd84a;
  background: #1d1533;
  border: 0.14em solid #ffd84a;
  box-shadow: 0 0.14em 0 #6b4300, inset 0 -0.16em 0 #3a2a5c;
  text-shadow: 0.12em 0.12em 0 #7a3d00;
  image-rendering: pixelated;
  -webkit-font-smoothing: none;
  font-smooth: never;
}
.roster-badge-text.roster-badge-inj-text { color: #ff5a5a; border-color: #ff5a5a; box-shadow: 0 0.14em 0 #5a0000, inset 0 -0.16em 0 #3a2a5c; text-shadow: 0.12em 0.12em 0 #5a0000; }
/* An injury suffered this game: the added skill's gold box (#e6b422), as on the roster row. */
.roster-badge-inj-img[data-new='true'], .roster-badge-rip[data-new='true'] { box-sizing: border-box; padding: 0.12em 0.2em; border-radius: 3px; box-shadow: 0 0 0 1px #e6b422, inset 0 0 0 1px rgb(0 0 0 / 55%); }
.roster-badge-text.roster-badge-inj-text[data-new='true'] { box-shadow: 0 0 0 1px #e6b422, 0 0.14em 0 #5a0000, inset 0 -0.16em 0 #3a2a5c; }
</style>
