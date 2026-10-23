<script setup lang="ts">
// Owner 10-21: "On the waiting to join/lobby screen where a user is waiting for the other player to join we are
// currently displaying the room name. Let's hide that room name and add a button to the bottom right to reveal it."
// The ONE body of both "Waiting for…" cards (the pre-game waiting board and SpectateView's in-game waiting overlay):
// the game (room) name is only in the DOM while "Show room name" is pressed. Per card instance - it resets whenever
// the card mounts again; nothing is persisted.
import { ref } from 'vue';
import { $t } from '../i18n';

const props = defineProps<{
  wait: { gameName?: string; teamName?: string; coach?: string; opponentCoach?: string };
  /** Astra 10-21 r2: a game confirmation card is open over this card (SpectateView) - its buttons do nothing (no
   *  disconnect, no toggle) until that card is answered; the confirmation keeps the keys. */
  locked?: boolean;
}>();
const emit = defineEmits<{ cancel: [] }>();

const roomNameShown = ref(false);
function onCancel(): void { if (!props.locked) emit('cancel'); }
function onToggleRoomName(): void { if (!props.locked) roomNameShown.value = !roomNameShown.value; }
</script>

<template>
  <h2 v-if="wait.opponentCoach" class="waiting-card-title">{{ $t('waitingBoard.waitingForOpponentcoach', { opponentCoach: wait.opponentCoach }) }}</h2>
  <h2 v-else class="waiting-card-title">{{ $t('waitingBoard.waitingForTheOther') }}</h2>
  <p class="waiting-card-status">
    <span class="waiting-card-spinner" aria-hidden="true"></span>
    <span v-if="wait.opponentCoach">{{ $t('waitingBoard.waitingFor') }} <strong>{{ wait.opponentCoach }}</strong>{{ $t('waitingBoard.toJoin') }}<span v-if="roomNameShown && wait.gameName" class="waiting-card-room-name"> “{{ wait.gameName }}”</span>{{ $t('waitingBoard.areTheyAfraid') }}</span>
    <span v-else-if="wait.gameName"><template v-if="roomNameShown"><span class="waiting-card-room-name">{{ $t('waitingBoard.youReInGamename', { gameName: wait.gameName }) }}</span>{{ $t('waitingBoard.theGameStarts') }}</template><template v-else>{{ $t('waitingBoard.theGameStarts2') }}</template>{{ $t('waitingBoard.asSoonAsThe') }} <em>{{ $t('waitingBoard.same') }}</em>{{ $t('waitingBoard.gameName') }}</span>
    <span v-else>{{ $t('waitingBoard.waitingForTheGame') }}</span>
  </p>
  <p v-if="wait.teamName" class="waiting-card-hint hint">{{ $t('waitingBoard.playingAsCoachWith', { coach: wait.coach, teamName: wait.teamName }) }}</p>
  <div class="waiting-card-actions" :class="{ 'has-room-toggle': !!wait.gameName }">
    <!-- Astra 10-21 r2 (controller): the host card is a v-pad-focus scope; B = Cancel, A starts on the toggle. -->
    <button type="button" class="waiting-card-cancel" data-pad-cancel :aria-disabled="locked ? 'true' : undefined" @click="onCancel">{{ $t('waitingBoard.cancel') }}</button>
    <button v-if="wait.gameName" type="button" class="waiting-card-room-toggle" data-pad-primary :aria-pressed="roomNameShown ? 'true' : 'false'"
      :aria-disabled="locked ? 'true' : undefined" @click="onToggleRoomName">{{ roomNameShown ? $t('waitingBoard.hideRoomName') : $t('waitingBoard.showRoomName') }}</button>
  </div>
</template>

<style scoped>
.waiting-card-title { margin: 0 0 0.6rem; font-family: var(--font-display); color: #e8918c; font-size: max(var(--ui-min-primary-text-size, 16px), 1.3rem); }
.waiting-card-status, .waiting-card-hint { margin: 0.5rem 0 0; font-size: max(var(--ui-min-primary-text-size, 16px), 0.92rem); line-height: 1.5; }
.waiting-card-status { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
/* Cancel alone stays centred; with a room name, Cancel keeps the left of the row and the reveal toggle sits in the
   card's bottom-right corner. Wraps (toggle still right-aligned) rather than overflowing on the narrowest card. */
.waiting-card-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-items: center; margin-top: 1.1rem; }
.waiting-card-actions.has-room-toggle { justify-content: flex-start; }
.waiting-card-actions button { border-radius: 6px; padding: 0.5rem 1.2rem; cursor: pointer; font-weight: 600; background: var(--ui-surface); color: var(--ui-text); border: 1px solid var(--ui-border); }
.waiting-card-actions button:hover { background: var(--ui-hover); }
.waiting-card-actions .waiting-card-room-toggle { margin-left: auto; padding: 0.5rem 0.8rem; font-weight: 500; }
.waiting-card-actions .waiting-card-room-toggle[aria-pressed='true'] { border-color: #e8918c; }
.waiting-card-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #e8918c55; border-top-color: #e8918c; animation: waiting-card-spin 0.8s linear infinite; flex: none; }
@keyframes waiting-card-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .waiting-card-spinner { animation: none; } }
</style>
