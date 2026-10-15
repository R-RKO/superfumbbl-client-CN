<script lang="ts">
import { displayDiceSide, type ServerSide } from '@fumbbl40k/ffb-pitch';
import blockIconUrl from '@fumbbl40k/ffb-pitch/assets/decorations/block-attacker-fist.png';
import passIconUrl from '@fumbbl40k/ffb-pitch/assets/decorations/action-pass.png';
import handoffIconUrl from '@fumbbl40k/ffb-pitch/assets/decorations/action-handoff.png';
import foulIconUrl from '@fumbbl40k/ffb-pitch/assets/decorations/action-foul.png';
import catchIconUrl from '@fumbbl40k/ffb-pitch/assets/status/catch.png';
import dodgeIconUrl from '@fumbbl40k/ffb-pitch/assets/status/dodge.png';
import rushIconUrl from '@fumbbl40k/ffb-pitch/assets/status/gfi.png';
import pickupIconUrl from '@fumbbl40k/ffb-pitch/assets/status/pickup.png';
import rerollIconUrl from '@fumbbl40k/ffb-pitch/assets/tokens/reroll_icon.png';
import mascotIconUrl from '../assets/resources/team_mascot.png';
import teamRerollIconUrl from '../assets/resources/re_roll.png';
import briberyIconUrl from '../assets/resources/re_roll_argue.png';
import { reactiveSkillIconUrl } from '../game/assetModUi';
import { LOG_ACTION_LABELS, logRowIcons, type LogActionKind, type LogActionPlate, type RerollSourceIcon } from '../game/logActionPlates';

/**
 * Owner 10-15 (Log style "Graphical"): the art each row's left cell shows, reused from what the pitch already shows
 * (no new art):
 *   Block / Pass / Hand-off / Foul -> the renderer's action markers over the acting player (assets/decorations);
 *   Catch / Dodge / Rush / Pick-up -> the renderer's cause tags on the roll die (assets/status);
 *   Reroll -> the renderer's reroll token (rerolled dice, turn track); Mascot -> the Team Mascot inducement icon.
 */
export const LOG_ACTION_ICON_URLS: Readonly<Record<LogActionKind, string>> = {
  block: blockIconUrl, pass: passIconUrl, handoff: handoffIconUrl, foul: foulIconUrl,
  catch: catchIconUrl, dodge: dodgeIconUrl, rush: rushIconUrl, pickup: pickupIconUrl,
  reroll: rerollIconUrl, mascot: mascotIconUrl,
};

/** Reroll source art: the Team Reroll icon of the reroll prompts / coach panel, the inducement icons, otherwise the
 *  source's skill icon from the active skill icon family (the same resolver the reroll prompts and rosters use). */
export function rerollSourceIconUrl(icon: RerollSourceIcon): string {
  if (icon.kind === 'trr') return teamRerollIconUrl;
  if (icon.kind === 'resource') return icon.name === 'team_mascot' ? mascotIconUrl : icon.name === 're_roll_argue' ? briberyIconUrl : teamRerollIconUrl;
  return reactiveSkillIconUrl(icon.skill);
}
function rerollSourceLabel(icon: RerollSourceIcon): string {
  if (icon.kind === 'trr') return 'Team reroll';
  if (icon.kind === 'resource') return icon.name === 'team_mascot' ? 'Team Mascot' : 'Bribery and Corruption';
  return icon.skill;
}

/** The row's tint: the DISPLAYED side of the acting team, the same mapping as the log's home/away dice. No single
 *  owning team -> 'neutral'. */
export function logRowSide(side: ServerSide | null | undefined, viewerSeat: ServerSide | null | undefined): 'home' | 'away' | 'neutral' {
  return displayDiceSide(side ?? null, viewerSeat ?? null) ?? 'neutral';
}
</script>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  /** The line's decoration; absent = an empty icon cell that keeps the text aligned. */
  plate?: LogActionPlate | null;
}>();

const icons = computed(() => logRowIcons(props.plate));
const sourceUrl = computed(() => (icons.value.source ? rerollSourceIconUrl(icons.value.source) : ''));
const sourceLabel = computed(() => (icons.value.source ? `Reroll source: ${rerollSourceLabel(icons.value.source)}` : ''));
const actionUrl = computed(() => (icons.value.action ? LOG_ACTION_ICON_URLS[icons.value.action] : ''));
const actionLabel = computed(() => (icons.value.action ? LOG_ACTION_LABELS[icons.value.action] : ''));
</script>

<template>
  <span class="log-icons"><span class="log-icon log-icon-action" :data-action="icons.action ?? undefined"
    :role="icons.action ? 'img' : undefined" :aria-label="icons.action ? actionLabel : undefined" :aria-hidden="icons.action ? undefined : 'true'" :title="icons.action ? actionLabel : undefined"><img v-if="icons.action" :src="actionUrl" alt="" aria-hidden="true" draggable="false" /></span><span v-if="icons.source" class="log-icon log-icon-source"
    :data-source="icons.source.kind === 'skill' ? icons.source.skill : icons.source.kind === 'resource' ? icons.source.name : 'trr'"
    role="img" :aria-label="sourceLabel" :title="sourceLabel"><img :src="sourceUrl" alt="" aria-hidden="true" draggable="false" /></span></span>
</template>

<style scoped>
/* The wrapper takes no box: its cells are the row's grid cells (see SpectateView .log.log-graphical) - the action icon
   in column 1 (fixed width, always present, empty when the line has no action), the reroll source icon in column 2
   ONLY on a reroll line (absent otherwise, so column 2 is zero wide and the text starts at the action column's edge).
   Each icon is centred in its cell both ways. Sizes come from the row (--log-icon-size / --log-source-size). No plate or
   background: the bare icon sits on the row's team tint. */
.log-icons { display: contents; }
.log-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  justify-self: center;
  user-select: none;
}
.log-icon-action {
  grid-column: 1;
  width: var(--log-icon-size, 2.4em);
  height: var(--log-icon-size, 2.4em);
}
.log-icon-source {
  grid-column: 2;
  width: var(--log-source-size, 1.9em);
  height: var(--log-source-size, 1.9em);
  margin-right: 0.3em;
}
.log-icon img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: auto;
  /* readable on the blue, red and neutral rows: a thin white edge, then a dark one, around the art */
  filter: drop-shadow(0 0 0.6px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 0.9px rgba(0, 0, 0, 0.95));
  pointer-events: none;
}
</style>
