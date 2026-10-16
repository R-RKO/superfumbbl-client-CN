<script setup lang="ts">
/**
 * Owner 10-16: chat text with its :shortcode: emoji drawn as the unicode emoji (game/chatEmoji.ts), DISPLAY ONLY (the
 * stored entry keeps the literal). Used by the Text and Bubbles chat, the chat toasts and (through the same chat
 * markup) the popped-out chat. No whitespace between tags on purpose: the chat parent is a <pre>.
 */
import { computed } from 'vue';
import { renderChatEmoji } from '../game/chatEmoji';

const props = defineProps<{ text: string }>();
const segments = computed(() => renderChatEmoji(props.text));
</script>

<template><template v-for="(s, i) in segments" :key="i"><span v-if="s.emoji" class="chat-emoji" role="img" :aria-label="s.code" :title="s.code">{{ s.t }}</span><template v-else>{{ s.t }}</template></template></template>

<style scoped>
.chat-emoji {
  font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
  font-size: 1.2em;
  line-height: 1;
  vertical-align: -0.08em;
  font-weight: 400;
  letter-spacing: 0;
}
</style>
