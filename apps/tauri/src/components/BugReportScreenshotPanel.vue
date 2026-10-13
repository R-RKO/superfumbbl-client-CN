<script setup lang="ts">
// Owner 10-13: the automatic Report screenshot, shown in the Report dialog so the coach SEES what rides along and can
// untick it (chat text may be in the picture). Display only: the capture itself is bugReportScreenshot.ts, taken when
// Report was pressed; this panel never captures anything.
import type { ReportCaptureResult } from '../game/bugReportScreenshot';

const props = defineProps<{
  /** null while the capture is still being composed. */
  result: ReportCaptureResult | null;
  modelValue: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

function onToggle(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="br-shot" data-testid="br-shot">
    <span class="cg-field-label">Screenshot</span>
    <p v-if="!props.result" class="hint br-shot-pending" data-testid="br-shot-pending">Capturing screenshot...</p>
    <template v-else-if="props.result.status === 'ok'">
      <img class="br-shot-thumb" data-testid="br-shot-thumb" :src="props.result.shot.dataUrl"
        :class="{ 'br-shot-thumb-off': !props.modelValue }" alt="Screenshot of your client" />
      <label class="br-shot-include">
        <input type="checkbox" data-testid="br-shot-include" :checked="props.modelValue" :disabled="props.disabled"
          @change="onToggle" />
        Include this screenshot
      </label>
      <p class="hint br-shot-note">The screenshot shows your client as it was when you opened this report.</p>
      <p v-for="note in props.result.shot.notes" :key="note" class="hint br-shot-extra">{{ note }}</p>
    </template>
    <template v-else>
      <p class="hint br-shot-none" data-testid="br-shot-none">No screenshot could be captured.</p>
      <p v-for="note in props.result.notes" :key="note" class="hint br-shot-extra">{{ note }}</p>
    </template>
  </div>
</template>

<style scoped>
.br-shot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0 8px;
}
.br-shot-thumb {
  display: block;
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
  align-self: flex-start;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  background: #0d0f12;
}
.br-shot-thumb-off {
  opacity: 0.35;
}
.br-shot-include {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.br-shot p {
  margin: 0;
}
</style>
