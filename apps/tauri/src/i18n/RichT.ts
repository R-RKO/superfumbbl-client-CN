import { createTextVNode, defineComponent, h, type PropType, type VNode } from 'vue';
import { t, type MessageParams } from './index';

/**
 * Rich-text messages (Astra r1 #8): ONE catalogue message may carry simple emphasis tags, so a translation can move the
 * bold / italic words wherever its grammar needs them instead of the template fixing English word order:
 *
 *   "fieldManual.watchLive": "<b>Watch anything, live:</b> pick <b>FUMBBL</b> or <b>Super FUMBBL</b> in the header…"
 *   <RichT k="fieldManual.watchLive" />
 *
 * Allowed tags: <b> <strong> <em> <kbd>, not nested, no attributes. Tags are read from the formatted message, so a
 * param must not contain markup (an unknown or unbalanced tag renders as text). Never v-html.
 */
const TAG = /<(b|strong|em|kbd)>([\s\S]*?)<\/\1>/g;

export type RichPart = string | { tag: 'b' | 'strong' | 'em' | 'kbd'; text: string };

export function richParts(text: string): RichPart[] {
  const parts: RichPart[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ tag: m[1] as 'b' | 'strong' | 'em' | 'kbd', text: m[2]! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** The message as VNodes (text + emphasis elements). */
export function tRich(key: string, params?: MessageParams): VNode[] {
  return richParts(t(key, params)).map((p) => (typeof p === 'string' ? createTextVNode(p) : h(p.tag, p.text)));
}

export const RichT = defineComponent({
  name: 'RichT',
  props: {
    k: { type: String, required: true },
    params: { type: Object as PropType<MessageParams>, default: undefined },
  },
  setup(props) {
    return () => tRich(props.k, props.params);
  },
});
