<script setup lang="ts">
// Owner 10-21 / 10-22: connection indicator on the quick bar, beside the spectator controls — a retro pixel-art
// signal-bars ICON, always shown (steady while good), pulsing while poor or lost. Rules + copy: game/connectionQuality.ts.
// Art: public/icons/connection/connection-<state>-{24,48}.png (24 px = 1x, 48 px = 2x, exact renders; provenance in
// docs/art-provenance/connection-icons). The icon is a fixed 24 CSS px in-flow slot (SpectateView's .quick-conn-slot, Astra 10-22
// round 1), identical in every state, so a state change never moves the row.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { connectionQualityLabel, type ConnectionQuality } from '../game/connectionQuality';
import { t } from '../i18n';

const props = defineProps<{ quality: ConnectionQuality; rttMs: number | null }>();

/** Art basename per state (unique across public/ for the app-patch flat-name rule). */
const ICON_STATE: Record<ConnectionQuality, string> = { good: 'good', weak: 'weak', poor: 'poor', lost: 'disconnected' };
const iconBase = computed(() => `/icons/connection/connection-${ICON_STATE[props.quality] ?? 'good'}`);
const src = computed(() => `${iconBase.value}-24.png`);
const srcset = computed(() => `${iconBase.value}-24.png 1x, ${iconBase.value}-48.png 2x`);

const label = computed(() => {
  const lead = connectionQualityLabel(props.quality);
  if (props.quality === 'lost' || props.rttMs == null) return lead;
  return t('hud.connectionQualityIcon.label.leadRoundTripP1', { lead, p1: Math.round(props.rttMs) });
});

/** prefers-reduced-motion: steady icon, no pulse (the class is withheld; the CSS media rule is a second guard). */
const reducedMotion = ref(false);
let motionQuery: MediaQueryList | null = null;
function onMotionChange(): void { reducedMotion.value = motionQuery?.matches === true; }
onMounted(() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  onMotionChange();
  motionQuery.addEventListener?.('change', onMotionChange);
});
onBeforeUnmount(() => { motionQuery?.removeEventListener?.('change', onMotionChange); });
const pulse = computed(() => (props.quality === 'poor' || props.quality === 'lost') && !reducedMotion.value);
</script>

<template>
  <span class="quick-conn" :class="[`quick-conn-${props.quality}`, { 'quick-conn-pulse': pulse }]"
    data-testid="connection-quality-icon" role="status" :data-quality="props.quality"
    :title="label" :aria-label="label">
    <img class="quick-conn-img" :src="src" :srcset="srcset" width="24" height="24" alt="" aria-hidden="true" draggable="false" />
  </span>
</template>

<style scoped>
.quick-conn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  cursor: default;
  filter: drop-shadow(0 2px 0 #050607);
}
.quick-conn-img { display: block; width: 24px; height: 24px; image-rendering: pixelated; pointer-events: none; user-select: none; }
.quick-conn-pulse { animation: quick-conn-pulse 1.2s ease-in-out infinite; }
@keyframes quick-conn-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
@media (prefers-reduced-motion: reduce) { .quick-conn-pulse { animation: none; } }
</style>
