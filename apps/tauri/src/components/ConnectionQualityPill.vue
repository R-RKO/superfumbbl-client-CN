<script setup lang="ts">
// Owner 10-21: POOR CONNECTION pill on the quick bar, beside the spectator controls. Renders NOTHING while the
// connection is good (no element, no reserved space). Copy + rules: game/connectionQuality.ts. Plain quick-bar type.
// Astra 10-21 round 2: the pill hangs off the match-controls row's left side; it is clamped to the quick bar's own
// left edge — when the full pill would cross it (e.g. a narrow window, where a left dock covers the area beyond), it
// collapses to the icon only (same colour) and the tooltip carries the copy.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { connectionQualityLabel, type ConnectionQuality } from '../game/connectionQuality';

const props = defineProps<{ quality: ConnectionQuality; rttMs: number | null }>();
const label = computed(() => connectionQualityLabel(props.quality));
const rttText = computed(() => (props.rttMs != null ? `Round trip ${Math.round(props.rttMs)} ms` : ''));
const compact = ref(false);
const title = computed(() => (compact.value ? [label.value, rttText.value].filter(Boolean).join('. ') : rttText.value || label.value || ''));
const ariaLabel = computed(() => [label.value, rttText.value].filter(Boolean).join('. '));

const root = ref<HTMLElement | null>(null);
/** Width of the full (labelled) pill, measured while it last showed in full. */
let fullWidth = 0;
/** Gap kept between the pill and the row it hangs off (matches .quick-conn-slot's right offset). */
const ROW_GAP_PX = 7.2;

/** Room (px) between the quick bar's left edge and the match-controls row the pill sits beside; null = unbounded. */
function availableWidth(el: HTMLElement): number | null {
  const row = el.parentElement;
  const bar = el.closest('.config-bar') as HTMLElement | null;
  if (!row || !bar) return null;
  return row.getBoundingClientRect().left - bar.getBoundingClientRect().left - ROW_GAP_PX;
}
async function measure(): Promise<void> {
  await nextTick();
  const el = root.value;
  if (!el) return;
  if (!compact.value) fullWidth = el.getBoundingClientRect().width;
  const room = availableWidth(el);
  const next = room != null && fullWidth > 0 && fullWidth > room;
  if (next === compact.value) return;
  compact.value = next;
}
function onResize(): void { void measure(); }
let observer: ResizeObserver | null = null;
/** Astra round 3: watch the quick bar AND the controls row the pill hangs beside — a spectator chip appearing widens
 *  the row (shrinking the room) without resizing the bar. */
function observeTargets(el: HTMLElement | null): void {
  if (!observer) return;
  observer.disconnect();
  if (!el) return;
  const bar = el.closest('.config-bar');
  if (bar) observer.observe(bar);
  if (el.parentElement) observer.observe(el.parentElement);
}
onMounted(() => {
  void measure();
  window.addEventListener('resize', onResize);
  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(onResize);
    observeTargets(root.value);
  }
});
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); observer?.disconnect(); });
// The pill mounts / changes copy with the quality: re-measure in full first (the label width differs per copy).
watch(() => props.quality, () => { compact.value = false; void measure(); }, { flush: 'post' });
watch(root, (el, prev) => {
  if (!el || el === prev) return;
  observeTargets(el);
  compact.value = false;
  void measure();
});
defineExpose({ measure });
</script>

<template>
  <span v-if="label" ref="root" class="quick-conn" :class="[`quick-conn-${props.quality}`, { 'quick-conn-compact': compact }]"
    data-testid="connection-quality-pill" role="status" :data-quality="props.quality" :data-compact="compact"
    :title="title" :aria-label="ariaLabel">
    <span class="quick-conn-icon" aria-hidden="true">{{ props.quality === 'lost' ? '✕' : '!' }}</span><span v-if="!compact" class="quick-conn-label">{{ label }}</span>
  </span>
</template>

<style scoped>
.quick-conn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  flex: 0 0 auto;
  height: 38.4px;
  padding: 0 9.6px;
  white-space: nowrap;
  font-family: Arial, Helvetica, sans-serif;
  font-size: max(var(--ui-min-text-size, 12px), 0.72rem);
  font-weight: 800;
  letter-spacing: 0.048em;
  text-transform: uppercase;
  color: #ffb547;
  border: 2.4px solid #8a5a1c;
  border-radius: 4.8px;
  background: linear-gradient(180deg, #3a2812, #0c0a08);
  box-shadow: inset 0 1px 0 #ffc46a44, 0 3px 0 #050607, 0 0 9px #d2863166;
  cursor: default;
}
.quick-conn-compact { gap: 0; padding: 0; width: 38.4px; justify-content: center; }
.quick-conn-icon { font-size: max(var(--ui-min-primary-text-size, 16px), 0.864rem); line-height: 1; animation: quick-conn-pulse 1.6s ease-in-out infinite; }
.quick-conn-lost { color: #ff5454; border-color: #84282d; background: linear-gradient(180deg, #38161a, #0c090b); box-shadow: inset 0 1px 0 #ff6d7455, 0 3px 0 #050607, 0 0 9px #d2313866; }
@keyframes quick-conn-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
@media (prefers-reduced-motion: reduce) { .quick-conn-icon { animation: none; } }
</style>
