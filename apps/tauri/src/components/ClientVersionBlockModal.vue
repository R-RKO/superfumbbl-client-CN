<script setup lang="ts">
// Owner 10-26: the client version gate's modal (game/clientVersionGate.ts). `refuse` (public edition): the coach-seat
// join did not leave; Update now / Close. `warn` (fork edition or a dev-lettered build): the join went; Update now /
// Continue anyway. The backdrop does not dismiss it (no re-ask loop: it stays until the coach picks).
import { nextTick, onMounted, ref } from 'vue';
import type { ClientVersionBlock } from '../game/clientVersionGate';
import { $t } from '../i18n';

const props = defineProps<{ block: ClientVersionBlock; checking?: boolean; message?: string | null }>();
const emit = defineEmits<{ update: []; close: []; continue: [] }>();
const root = ref<HTMLElement | null>(null);
defineExpose({ root });

function dismiss(): void { if (props.block.kind === 'warn') emit('continue'); else emit('close'); }
function onKeydown(event: KeyboardEvent): void {
  event.stopPropagation(); // Sol r1: no key typed in the modal reaches a dialog or the pitch behind it
  if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
  if (event.key !== 'Tab') return;
  const buttons = Array.from(root.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
  if (buttons.length === 0) return;
  const at = buttons.indexOf(document.activeElement as HTMLElement);
  const next = event.shiftKey ? (at <= 0 ? buttons.length - 1 : at - 1) : (at < 0 || at === buttons.length - 1 ? 0 : at + 1);
  event.preventDefault();
  buttons[next]!.focus();
}
onMounted(() => { void nextTick(() => root.value?.querySelector<HTMLElement>('button.primary')?.focus()); });
</script>

<template>
  <div class="modal-backdrop save-prompt-backdrop client-version-backdrop" data-testid="client-version-block" :data-kind="block.kind">
    <div ref="root" class="save-prompt" role="dialog" aria-modal="true" aria-labelledby="client-version-block-title" @keydown="onKeydown" @keyup.stop>
      <h3 id="client-version-block-title">{{ $t('clientVersion.title') }}</h3>
      <p class="hint">{{ $t('clientVersion.versions', { current: block.current, latest: block.latest }) }}</p>
      <p class="hint">{{ block.kind === 'refuse' ? $t('clientVersion.refuseHint') : $t('clientVersion.warnHint') }}</p>
      <p class="hint">{{ $t('clientVersion.restartHint') }}</p>
      <p v-if="message" class="update-error" role="alert" data-testid="client-version-message">{{ message }}</p>
      <div class="save-prompt-actions">
        <button class="primary" data-testid="client-version-update" :disabled="checking" @click="emit('update')">{{ checking ? $t('clientVersion.checking') : $t('app.savePrompt.updateNow') }}</button>
        <button v-if="block.kind === 'warn'" data-testid="client-version-continue" @click="emit('continue')">{{ $t('clientVersion.continueAnyway') }}</button>
        <button v-else data-testid="client-version-close" @click="emit('close')">{{ $t('app.savePrompt.close') }}</button>
      </div>
    </div>
  </div>
</template>

<style>
/* Sol r3: above the controller notice (260) - this modal owns the keyboard while it is up, so it must also be on top. */
.modal-backdrop.save-prompt-backdrop.client-version-backdrop { z-index: 270; }
</style>
