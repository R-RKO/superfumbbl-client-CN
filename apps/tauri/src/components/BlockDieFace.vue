<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { blockDieLogSymbol, isBlockDieFaceValue } from '../game/blockDieLog';
import { blockDieSymbolArt, markBlockDiePackFaceFailed } from '../game/blockDieFaceArt';
import { settings } from '../game/settings';

const props = defineProps<{
  value: number;
  result: string;
}>();

// Owner 09-08: the log draws the 64 px content-trimmed faces (`*-64.png`, Lanczos from the owner masters that sit
// beside them) — the 1254 px masters sampled nearest-neighbour down to ~19 px lost most of the art (decimated).
// Owner 10-06: the set follows the bundled block-dice family (Settings > Asset packs > Block dice).
const valid = computed(() => isBlockDieFaceValue(props.value));
const symbol = computed(() => isBlockDieFaceValue(props.value) ? blockDieLogSymbol(props.value) : null);
// Owner 10-10: a PACK-bound face wins per face, as on the block choice card (blockDieSymbolArt; reactive to pack
// changes). A pack face is a full die image with its own plate and may be any size: it is drawn as supplied, contained
// in the same box as the bundled symbol (object-fit: contain below) - no stretch, no change to the line box.
const art = computed(() => symbol.value ? blockDieSymbolArt(symbol.value, settings.blockDiceFamily) : null);
const url = computed(() => art.value?.url ?? '');
const failed = ref(false);
watch(() => [props.value, settings.blockDiceFamily, url.value], () => { failed.value = false; });
/** A broken pack image falls back to the bundled symbol (never a blank); a broken bundled symbol to the value tile. */
function onImageError(): void {
  if (art.value?.pack) markBlockDiePackFaceFailed(art.value.url);
  else failed.value = true;
}
</script>

<template>
  <span v-if="valid" class="block-die-face" :data-symbol="symbol" :data-pack-face="art?.pack ? '' : undefined" role="img" :aria-label="result">
    <span class="block-die-result">{{ result }}</span>
    <img v-if="!failed" :src="url" alt="" aria-hidden="true" @error="onImageError" />
    <span v-else class="block-die-fallback" :data-value="value" aria-hidden="true"></span>
  </span>
  <span v-else>{{ result }}</span>
</template>

<style scoped>
.block-die-face {
  display: inline-block;
  position: relative;
  width: var(--block-die-size, 1.8em);
  height: var(--block-die-size, 1.8em);
  overflow: hidden;
  vertical-align: middle;
  flex: none;
}
.block-die-face img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: auto; /* owner 09-08: smooth minification of the 64 px face (pixelated decimated it) */
}
.block-die-result {
  position: absolute;
  inset: 0;
  color: transparent;
  white-space: nowrap;
  user-select: text;
}
.block-die-fallback {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 20%;
  font-weight: 800;
  line-height: 1;
}
.block-die-fallback::after {
  content: attr(data-value);
}
</style>
