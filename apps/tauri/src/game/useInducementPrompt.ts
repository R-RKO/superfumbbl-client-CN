import { t, terms } from '../i18n';
import { inducementChoiceLabel } from './inducementChoiceLabel';
import type { UseInducementOffer } from './inducementUse';

/**
 * The Modern prompt for an upstream `useInducement` dialog (DialogUseInducementParameter: teamId,
 * inducementTypeArray, cards, playerId). Server-derived: every offered type/card becomes a button; nothing is
 * answered without the coach's click.
 *
 * - ONE inducement type aimed at a named player (Bretonnian Pastries on a Knocked-out player, Igor on a dead one):
 *   "Use <inducement> on <player>?" with Use / Decline. Pastries carries its own sentence (the short mechanic in our
 *   own words); any other type, including one the client has never seen, gets the generic sentence with its name.
 * - Anything else (several types, cards, no player): the generic "Which inducement do you want to use?" with one
 *   button per offered type/card.
 */
export interface UseInducementPromptView {
  prompt: string;
  declineLabel: string;
  options: { kind: 'inducement' | 'card'; value: string; label: string }[];
}

/** The display name of an inducement wire key (localised through the game-term dictionary). */
export function inducementDisplayName(type: string): string {
  return terms(inducementChoiceLabel(type));
}

export function useInducementPrompt(offer: UseInducementOffer, playerName: string | null): UseInducementPromptView {
  const only = offer.inducementTypeArray.length === 1 && offer.cards.length === 0 ? offer.inducementTypeArray[0]! : null;
  if (only && offer.playerId && playerName) {
    return {
      prompt: only === 'bretonnianPastries'
        ? t('store.text.useBretonnianPastriesOn', { player: playerName })
        : t('store.text.useInducementOnPlayer', { inducement: inducementDisplayName(only), player: playerName }),
      declineLabel: t('hud.decline'),
      options: [{ kind: 'inducement', value: only, label: t('hud.use') }],
    };
  }
  return {
    prompt: t('store.text.whichInducementDoYou'),
    declineLabel: t('hud.decline'),
    options: [
      ...offer.inducementTypeArray.map((value) => ({ kind: 'inducement' as const, value, label: inducementChoiceLabel(value) })),
      ...offer.cards.map((value) => ({ kind: 'card' as const, value, label: value })),
    ],
  };
}
