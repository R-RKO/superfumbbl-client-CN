<script lang="ts">
import { displayDiceSide, type ServerSide } from '@fumbbl40k/ffb-pitch';
import blockIconUrl from '@fumbbl40k/ffb-pitch/assets/decorations/block-attacker-fist.png';
import moveIconUrl from '@fumbbl40k/ffb-pitch/assets/decorations/action-move.png';
import passIconUrl from '@fumbbl40k/ffb-pitch/assets/decorations/action-pass.png';
import handoffIconUrl from '@fumbbl40k/ffb-pitch/assets/decorations/action-handoff.png';
import foulIconUrl from '@fumbbl40k/ffb-pitch/assets/decorations/action-foul.png';
import catchIconUrl from '@fumbbl40k/ffb-pitch/assets/status/catch.png';
import dodgeIconUrl from '@fumbbl40k/ffb-pitch/assets/status/dodge.png';
import rushIconUrl from '@fumbbl40k/ffb-pitch/assets/status/gfi.png';
import pickupIconUrl from '@fumbbl40k/ffb-pitch/assets/status/pickup.png';
import stallingIconUrl from '@fumbbl40k/ffb-pitch/assets/status/stalling.png';
import rerollIconUrl from '@fumbbl40k/ffb-pitch/assets/tokens/reroll_icon.png';
import mascotIconUrl from '../assets/resources/team_mascot.png';
import teamRerollIconUrl from '../assets/resources/re_roll.png';
import briberyIconUrl from '../assets/resources/re_roll_argue.png';
import apothecaryIconUrl from '../assets/resources/apothecary.png';
import { reactiveSkillIconUrl } from '../game/assetModUi';
import { koLetteringUrl } from '../game/koLettering';
import { LOG_ACTION_ICONS, LOG_ACTION_KINDS, LOG_ACTION_LABELS, logRowIcons, type LogActionKind, type LogActionPlate, type LogIconSpec, type RerollSourceIcon } from '../game/logActionPlates';

/**
 * Owner 10-15 (Log style "Graphical"): the art each row's left cell shows, reused from what the pitch already shows
 * (no new art):
 *   Block / Pass / Hand-off / Foul -> the renderer's action markers over the acting player (assets/decorations);
 *   Catch / Dodge / Rush / Pick-up -> the renderer's cause tags on the roll die (assets/status);
 *   Reroll -> the renderer's reroll token (rerolled dice, turn track); Mascot -> the Team Mascot inducement icon.
 */
/** The art files of the `art` entries in the icon table (logActionPlates.LOG_ACTION_ICONS). */
const ART_URLS: Readonly<Record<string, string>> = {
  move: moveIconUrl, block: blockIconUrl, pass: passIconUrl, handoff: handoffIconUrl, foul: foulIconUrl,
  catch: catchIconUrl, dodge: dodgeIconUrl, rush: rushIconUrl, pickup: pickupIconUrl,
  reroll: rerollIconUrl, mascot: mascotIconUrl, apothecary: apothecaryIconUrl, stalling: stallingIconUrl,
};
const iconOf = (kind: LogActionKind): LogIconSpec => LOG_ACTION_ICONS[kind].icon as LogIconSpec;
/** Per-kind views of the icon table, derived (the table in logActionPlates.ts is the one place to edit). */
export const LOG_ACTION_ICON_URLS: Readonly<Partial<Record<LogActionKind, string>>> = Object.fromEntries(
  LOG_ACTION_KINDS.flatMap((kind) => { const icon = iconOf(kind); return icon.type === 'art' && ART_URLS[icon.art] ? [[kind, ART_URLS[icon.art]]] : []; }));
export const LOG_ACTION_SKILL_ICONS: Readonly<Partial<Record<LogActionKind, string>>> = Object.fromEntries(
  LOG_ACTION_KINDS.flatMap((kind) => { const icon = iconOf(kind); return icon.type === 'skill' ? [[kind, icon.skill]] : []; }));
export const LOG_ACTION_EMOJI: Readonly<Partial<Record<LogActionKind, string>>> = Object.fromEntries(
  LOG_ACTION_KINDS.flatMap((kind) => { const icon = iconOf(kind); return icon.type === 'emoji' ? [[kind, icon.emoji]] : []; }));

/** Reroll source art: the Team Reroll icon of the reroll prompts / coach panel, the inducement icons, otherwise the
 *  source's skill icon from the active skill icon family (the same resolver the reroll prompts and rosters use). */
export function rerollSourceIconUrl(icon: RerollSourceIcon): string {
  if (icon.kind === 'trr') return teamRerollIconUrl;
  if (icon.kind === 'resource') return icon.name === 'team_mascot' ? mascotIconUrl : icon.name === 're_roll_argue' ? briberyIconUrl : teamRerollIconUrl;
  return reactiveSkillIconUrl(icon.skill);
}
/** The source icon's tooltip (owner 10-15: "Team reroll", "Pro reroll", "Mascot"). */
export function rerollSourceLabel(icon: RerollSourceIcon): string {
  if (icon.kind === 'trr') return t('hud.logActionPlate.text.teamReroll');
  if (icon.kind === 'resource') return icon.name === 'team_mascot' ? 'Mascot' : t('hud.logActionPlate.text.briberyAndCorruptionReroll');
  return t('hud.logActionPlate.text.skillReroll', { skill: icon.skill });
}

/** The row's tint: the DISPLAYED side of the acting team, the same mapping as the log's home/away dice. No single
 *  owning team -> 'neutral'. */
export function logRowSide(side: ServerSide | null | undefined, viewerSeat: ServerSide | null | undefined): 'home' | 'away' | 'neutral' {
  return displayDiceSide(side ?? null, viewerSeat ?? null) ?? 'neutral';
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { $t } from '../i18n';
import { t } from '../i18n';

const props = defineProps<{
  /** The line's decoration; absent = an empty icon cell that keeps the text aligned. */
  plate?: LogActionPlate | null;
}>();

const icons = computed(() => logRowIcons(props.plate));
const sourceUrl = computed(() => (icons.value.source ? rerollSourceIconUrl(icons.value.source) : ''));
const sourceLabel = computed(() => (icons.value.source ? rerollSourceLabel(icons.value.source) : ''));
const actionUrl = computed(() => {
  const action = icons.value.action;
  if (!action) return '';
  // owner 10-16: a skill-use row shows the icon of the skill it names (falls back to the generic icon when unknown)
  if (action === 'skill' && props.plate?.skill) { const own = reactiveSkillIconUrl(props.plate.skill); if (own) return own; }
  const skill = LOG_ACTION_SKILL_ICONS[action];
  return skill ? reactiveSkillIconUrl(skill) : LOG_ACTION_ICON_URLS[action] ?? '';
});
const actionEmoji = computed(() => (icons.value.action ? LOG_ACTION_EMOJI[icons.value.action] ?? '' : ''));
// owner 10-15: the KO recovery rows' icon - the dugout-label "KO" lettering (koLettering.ts); plain "KO" until composed
const koUrl = koLetteringUrl();
const actionLabel = computed(() => (icons.value.action === 'skill' && props.plate?.skill ? props.plate.skill : icons.value.action ? LOG_ACTION_LABELS[icons.value.action] : ''));
</script>

<template>
  <span class="log-icons"><span class="log-icon log-icon-action" :data-action="icons.action ?? undefined"
    :role="icons.action ? 'img' : undefined" :aria-label="icons.action ? actionLabel : undefined" :aria-hidden="icons.action ? undefined : 'true'" :title="icons.action ? actionLabel : undefined"><template v-if="icons.action === 'ko'"><img v-if="koUrl" class="log-icon-ko" :src="koUrl" alt="" aria-hidden="true" draggable="false" /><span v-else class="log-icon-ko-text" aria-hidden="true">{{ $t('hud.logActionPlate.ko') }}</span></template><img v-else-if="icons.action && actionUrl" :src="actionUrl" alt="" aria-hidden="true" draggable="false" /><span v-else-if="icons.action && actionEmoji" class="log-icon-emoji" aria-hidden="true">{{ actionEmoji }}</span></span><span v-if="icons.source" class="log-icon log-icon-source"
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
.log-icon-ko { width: 100%; height: auto; max-height: 100%; }
.log-icon-ko-text { font-family: var(--font-display); font-weight: 700; font-size: calc(var(--log-icon-size, 2.4em) * 0.45); color: #fff; }
.log-icon-emoji {
  font-size: calc(var(--log-icon-size, 2.4em) * 0.72);
  line-height: 1;
  text-shadow: none;
  font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
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
