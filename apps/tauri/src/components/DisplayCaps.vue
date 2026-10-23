<script lang="ts">
/**
 * Words that are abbreviations and stay in CAPITALS when they are typed in capitals ("Open JNLP", "Play on Super
 * FUMBBL"). The match is the whole word exactly as typed, so "TV" is kept and "Tv" or "tv" are lettered like any
 * other word. A caller adds its own with the `keep` prop.
 */
export const DISPLAY_CAPS_KEEP: readonly string[] = ['OK', 'TV', 'KO', 'MVP', 'RR', 'TRR', 'NAF', 'XML', 'JNLP', 'FUMBBL'];
</script>

<script setup lang="ts">
/**
 * "Graduate C" display lettering for menu text (owner 10-11): the first letter of each word in Nuffle, 25% larger,
 * the rest in Graduate small capitals. One line per label: `<DisplayCaps text="Game statistics" />` inside the
 * heading / button / hint that carries it. The casing rules are the shared `displayCapsRuns` (ffb-pitch), the same
 * function the end-zone lettering on the pitch uses.
 *
 * The label itself stays in the document as ONE plain text node (`.display-caps-plain`, visually hidden): that is
 * what a screen reader announces and what the element's text content is. The lettering beside it is aria-hidden and
 * carries no text of its own (each run is painted from a data attribute), so nothing is read out letter by letter.
 *
 * Abbreviations (owner 10-11, the blade buttons): a word in DISPLAY_CAPS_KEEP, or in the `keep` prop, is drawn as
 * typed in Nuffle capitals at the NORMAL size (`.display-caps-keep`), not as a lead plus small capitals and not
 * enlarged: four lead-sized capitals in a row ("JNLP") would stand taller than every other word on the button and
 * widen it, while Nuffle capitals at the label's own size are exactly what the button drew before this lettering.
 *
 * The lettering never takes the host's `text-transform`: a button that upper-cases its label (the blades' `.bevel`)
 * would otherwise turn the small capitals into full ones.
 *
 * Only with the default UI font. A coach who chose System or Arial in Settings gets the plain label in that font,
 * exactly as before.
 */
import { computed } from 'vue';
import { displayCapsRuns } from '@fumbbl40k/ffb-pitch';
import { settings } from '../game/settings';

type Run = { text: string; kind: 'lead' | 'rest' | 'keep' | 'fallback' };
const kindOf = (run: { lead: boolean; fallback?: true }): Run['kind'] => (run.fallback ? 'fallback' : run.lead ? 'lead' : 'rest');

const props = defineProps<{ text: string; keep?: readonly string[] }>();

function letter(text: string, keep: ReadonlySet<string>): Run[] {
  const words = text.split(/\s+/u).filter((word) => word.length > 0);
  // No abbreviation in this label: the shared rule on the whole label, exactly as before.
  if (!words.some((word) => keep.has(word))) return displayCapsRuns(text).map((run): Run => ({ text: run.text, kind: kindOf(run) }));
  const runs: Run[] = [];
  const push = (run: Run): void => {
    if (!run.text) return;
    const last = runs[runs.length - 1];
    if (last && last.kind === 'rest' && run.kind === 'rest') last.text += run.text;
    else runs.push(run);
  };
  words.forEach((word, index) => {
    if (index > 0) push({ text: ' ', kind: 'rest' });
    if (keep.has(word)) push({ text: word, kind: 'keep' });
    else for (const run of displayCapsRuns(word)) push({ text: run.text, kind: kindOf(run) });
  });
  return runs;
}

const runs = computed(() => (settings.uiFont === 'nuffle'
  ? letter(props.text, new Set([...DISPLAY_CAPS_KEEP, ...(props.keep ?? [])]))
  : null));
</script>

<template>
  <span v-if="runs" class="display-caps"><span class="display-caps-plain">{{ text }}</span><span class="display-caps-art" aria-hidden="true"><span
    v-for="(run, index) in runs" :key="index" :class="`display-caps-${run.kind}`" :data-t="run.text"></span></span></span>
  <template v-else>{{ text }}</template>
</template>

<style>
.display-caps { position: relative; }
.display-caps-plain {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
/* text-transform none: the runs are already in the case the two fonts need, whatever the host does to its text. */
.display-caps-art { white-space: pre-wrap; text-transform: none; }
/* line-height 0 on every run: neither the larger lead letter nor Graduate's own metrics may grow the line box. The
   host element's font sets the line height, so a button is exactly as tall as it was with a plain label. */
.display-caps-art > span { line-height: 0; }
.display-caps-art > span::before { content: attr(data-t); }
/* Graduate has no lowercase: its lowercase glyphs are small capitals. A character it does not carry falls back to
   Nuffle, then the system face. */
/* A host whose text shadow is too heavy for the finer Graduate letters (the blades' red buttons) hands them a lighter
   one in --display-caps-rest-shadow; without it they inherit the host's shadow like any text. */
.display-caps-rest { font-family: var(--font-graduate); text-shadow: var(--display-caps-rest-shadow, inherit); }
.display-caps-lead { font-family: var(--font-display); font-size: 1.25em; }
/* Script support (owner 10-23): a word whose first letter is not Latin, Greek or Cyrillic (kana, kanji, Hangul...)
   is drawn whole, as typed, in the system fallback faces at the label's own size (an ideograph's ink is about as tall
   as the 1.25em lead capital), nudged up so it centres on the capitals rather than sitting on the baseline. */
.display-caps-fallback { font-family: var(--font-fallback); vertical-align: 0.04em; }
/* An abbreviation: Nuffle capitals as typed, at the label's own size. */
.display-caps-keep { font-family: var(--font-display); }
</style>
