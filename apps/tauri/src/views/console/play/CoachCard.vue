<script setup lang="ts">
/**
 * Play screen coach card (owner 10-20): coach name (+ the title as a text chip when there is no badge) on line 1,
 * "Record W/D/L · win % · CR" on line 2. Text from FUMBBL only (game/fumbblCoachProfile.ts); a part FUMBBL did not
 * send is left out, not dashed.
 *
 * The title is drawn on an ORIGINAL rank badge (CoachBadge.vue: public/badges/coach/<slug>.png, no text baked in) with
 * the title text centred on it. Unknown title or a badge that fails to load -> the text-only chip. No FUMBBL images.
 *
 * Stable geometry (Astra rounds 1-2, 10-20): the header's buttons must never move when the data arrives or a badge
 * fails. Owner 10-21: "quite small, can we increase the size of it by around 30%" - the card is ~30% larger and the
 * title row may grow to its 52 px (accepted by the owner; it replaces the round-2 "fits the 40 px title row" rule).
 * - The card is the header's flex item itself: basis 0, a fixed 234 px min-width (52 px badge + 10 px gap + ~158 px
 *   of text + padding), growing into the free space up to 520 px (room for the longest stats line, "Record 100/100/100 · 100 % · CR 2000 · +50.0 WAR", owner 10-21). Its only spacing is the header's own 14 px gap. When
 *   234 px no longer fits beside the title, the card wraps to its own row instead of collapsing its text to nothing.
 * - It is exactly 52 px tall: a 52 px badge slot (always present, empty while there is no badge) and two fixed text
 *   rows (21 px + 18 px, 3 px gap) that are single-line and clipped with an ellipsis. Its outline is an inset shadow,
 *   not a border, so the badge gets the full 52 px.
 * - Nothing inside the card can change its size; the text chip that replaces a missing badge sits in the clipped
 *   name row.
 */
import { computed, ref, watch } from 'vue';
import DisplayCaps from '../../../components/DisplayCaps.vue';
import CoachBadge from './CoachBadge.vue';
import { settings } from '../../../game/settings';
import { coachProfileStatItems, coachProfileStatParts, coachTitleBadgeUrl, coachTitleSlug, type FumbblCoachProfile } from '../../../game/fumbblCoachProfile';

const props = defineProps<{ name: string; profile: FumbblCoachProfile | null }>();

const displayName = computed(() => props.profile?.name || props.name);
const title = computed(() => props.profile?.title);
const slug = computed(() => coachTitleSlug(title.value));
const badgeUrl = computed(() => coachTitleBadgeUrl(title.value, settings.coachBadgeStyle)); // a style switch retries the badge
const badgeFailed = ref(false);
watch(badgeUrl, () => { badgeFailed.value = false; });
const showBadge = computed(() => !!title.value && !!badgeUrl.value && !badgeFailed.value);
const stats = computed(() => coachProfileStatParts(props.profile).join(' · '));
/** The parts, the WAR one carrying its "wins above a .500 coach" description (owner 10-21). */
const statItems = computed(() => coachProfileStatItems(props.profile));
/** The full, untruncated card for assistive tech (the visible rows clip with an ellipsis; Astra P3). */
const ariaLabel = computed(() => ['FUMBBL coach', displayName.value, title.value, stats.value].filter(Boolean).join(', '));
</script>

<template>
  <section v-if="name" class="coach-card" :aria-label="ariaLabel">
    <span class="coach-badge-slot">
      <CoachBadge v-if="showBadge" :title="title!" :size="52" @error="badgeFailed = true" />
    </span>
    <div class="coach-lines">
      <div class="coach-line">
        <strong class="coach-name">{{ displayName }}</strong>
        <span v-if="title && !showBadge" class="coach-title-chip" :class="slug ? `tier-${slug}` : ''"><DisplayCaps :text="title" /></span>
      </div>
      <div class="coach-stats"><template v-for="(item, i) in statItems" :key="i"><span class="coach-stat"
        :title="item.title" :aria-label="item.title ? `${item.text}, ${item.title}` : undefined">{{ item.text }}</span><template
        v-if="i < statItems.length - 1"> · </template></template></div>
    </div>
  </section>
</template>

<style scoped>
.coach-card {
  box-sizing: border-box; display: flex; align-items: center; gap: 10px; flex: 1 1 0; min-width: 234px; max-width: 520px; height: 52px; margin-right: auto;
  padding: 0 13px 0 0; overflow: hidden; border-radius: 6px;
  color: var(--ui-forest, #1A401C); background: var(--ui-old-lace, #F8F5E7);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-forest, #1A401C) 30%, transparent), 0 2px 6px rgba(26, 64, 28, .14);
}
.coach-badge-slot { position: relative; display: block; flex: 0 0 52px; width: 52px; height: 52px; }
.coach-lines { display: grid; grid-template-rows: 21px 18px; gap: 3px; flex: 1 1 0; min-width: 0; }
.coach-line { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; white-space: nowrap; }
.coach-name { min-width: 0; overflow: hidden; font-size: 20px; font-weight: 700; line-height: 21px; text-overflow: ellipsis; white-space: nowrap; }
.coach-stats { min-width: 0; overflow: hidden; color: color-mix(in srgb, var(--ui-forest, #1A401C) 72%, transparent); font-size: 16px;
  line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }

.coach-title-chip {
  flex: none; padding: 1px 10px; border-radius: 999px; color: #fff; background: var(--ui-forest, #1A401C);
  font-family: var(--font-display); font-size: 14px; font-weight: 800; letter-spacing: .06em; line-height: 18px;
  text-shadow: 1px 1px 0 #000; --display-caps-rest-shadow: 1px 1px 0 #000; white-space: nowrap;
}
.coach-title-chip.tier-rookie, .coach-title-chip.tier-experienced { color: var(--ui-forest, #1A401C); text-shadow: none; --display-caps-rest-shadow: none;
  background: color-mix(in srgb, var(--ui-forest, #1A401C) 14%, transparent); }
.coach-title-chip.tier-emerging-star, .coach-title-chip.tier-star { background: #790004; }
.coach-title-chip.tier-super-star, .coach-title-chip.tier-mega-star, .coach-title-chip.tier-legend { color: #101010; text-shadow: none;
  --display-caps-rest-shadow: none; background: #efc957; box-shadow: inset 0 0 0 1px #a8862a; }
</style>
