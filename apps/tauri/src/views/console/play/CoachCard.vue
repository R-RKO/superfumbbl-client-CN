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
 * fails, and the card must not make the header taller.
 * - The card is the header's flex item itself: basis 0, a fixed 180 px min-width (40 px badge + 8 px gap + ~120 px
 *   of text + padding), growing into the free space up to 380 px. Its only spacing is the header's own 14 px gap. When
 *   180 px no longer fits beside the title, the card wraps to its own row instead of collapsing its text to nothing.
 * - It is exactly 40 px tall, the height of the Play title (h1: 40 px, line-height 1), so the title row never grows:
 *   a 40 px badge slot (always present, empty while there is no badge) and two fixed text rows (16 px + 14 px, 2 px
 *   gap) that are single-line and clipped with an ellipsis. Its outline is an inset shadow, not a border, so the badge
 *   gets the full 40 px.
 * - Nothing inside the card can change its size; the text chip that replaces a missing badge sits in the clipped
 *   name row.
 */
import { computed, ref, watch } from 'vue';
import DisplayCaps from '../../../components/DisplayCaps.vue';
import CoachBadge from './CoachBadge.vue';
import { settings } from '../../../game/settings';
import { coachProfileStatParts, coachTitleBadgeUrl, coachTitleSlug, type FumbblCoachProfile } from '../../../game/fumbblCoachProfile';

const props = defineProps<{ name: string; profile: FumbblCoachProfile | null }>();

const displayName = computed(() => props.profile?.name || props.name);
const title = computed(() => props.profile?.title);
const slug = computed(() => coachTitleSlug(title.value));
const badgeUrl = computed(() => coachTitleBadgeUrl(title.value, settings.coachBadgeStyle)); // a style switch retries the badge
const badgeFailed = ref(false);
watch(badgeUrl, () => { badgeFailed.value = false; });
const showBadge = computed(() => !!title.value && !!badgeUrl.value && !badgeFailed.value);
const stats = computed(() => coachProfileStatParts(props.profile).join(' · '));
/** The full, untruncated card for assistive tech (the visible rows clip with an ellipsis; Astra P3). */
const ariaLabel = computed(() => ['FUMBBL coach', displayName.value, title.value, stats.value].filter(Boolean).join(', '));
</script>

<template>
  <section v-if="name" class="coach-card" :aria-label="ariaLabel">
    <span class="coach-badge-slot">
      <CoachBadge v-if="showBadge" :title="title!" :size="40" @error="badgeFailed = true" />
    </span>
    <div class="coach-lines">
      <div class="coach-line">
        <strong class="coach-name">{{ displayName }}</strong>
        <span v-if="title && !showBadge" class="coach-title-chip" :class="slug ? `tier-${slug}` : ''"><DisplayCaps :text="title" /></span>
      </div>
      <div class="coach-stats">{{ stats }}</div>
    </div>
  </section>
</template>

<style scoped>
.coach-card {
  box-sizing: border-box; display: flex; align-items: center; gap: 8px; flex: 1 1 0; min-width: 180px; max-width: 380px; height: 40px; margin-right: auto;
  padding: 0 10px 0 0; overflow: hidden; border-radius: 6px;
  color: var(--ui-forest, #1A401C); background: var(--ui-old-lace, #F8F5E7);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-forest, #1A401C) 30%, transparent), 0 2px 6px rgba(26, 64, 28, .14);
}
.coach-badge-slot { position: relative; display: block; flex: 0 0 40px; width: 40px; height: 40px; }
.coach-lines { display: grid; grid-template-rows: 16px 14px; gap: 2px; flex: 1 1 0; min-width: 0; }
.coach-line { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; white-space: nowrap; }
.coach-name { min-width: 0; overflow: hidden; font-size: 15px; font-weight: 700; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
.coach-stats { min-width: 0; overflow: hidden; color: color-mix(in srgb, var(--ui-forest, #1A401C) 72%, transparent); font-size: 12px;
  line-height: 14px; text-overflow: ellipsis; white-space: nowrap; }

.coach-title-chip {
  flex: none; padding: 1px 8px; border-radius: 999px; color: #fff; background: var(--ui-forest, #1A401C);
  font-family: 'Nuffle', system-ui, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: .06em; line-height: 14px;
  text-shadow: 1px 1px 0 #000; --display-caps-rest-shadow: 1px 1px 0 #000; white-space: nowrap;
}
.coach-title-chip.tier-rookie, .coach-title-chip.tier-experienced { color: var(--ui-forest, #1A401C); text-shadow: none; --display-caps-rest-shadow: none;
  background: color-mix(in srgb, var(--ui-forest, #1A401C) 14%, transparent); }
.coach-title-chip.tier-emerging-star, .coach-title-chip.tier-star { background: #790004; }
.coach-title-chip.tier-super-star, .coach-title-chip.tier-mega-star, .coach-title-chip.tier-legend { color: #101010; text-shadow: none;
  --display-caps-rest-shadow: none; background: #efc957; box-shadow: inset 0 0 0 1px #a8862a; }
</style>
