import { PlayerStateBase, baseState, rendersOnPitch } from '@fumbbl40k/ffb-pitch';
import { data, t } from '../i18n';

/**
 * The roster LOCATION / STATUS of a player as an invariant English TOKEN (Astra r1/r2 #4): `data-status` styling and the
 * player card's 'On pitch' check compare it, so it never changes with the language. playerStateLabel() renders it.
 */
export type PlayerStateToken = 'On pitch' | "KO'd" | 'Badly Hurt' | 'Seriously Hurt' | 'Dead' | 'Sent off' | 'Missing next game' | 'Reserves';

export const PLAYER_STATE_TOKENS: readonly PlayerStateToken[] = data(['On pitch', "KO'd", 'Badly Hurt', 'Seriously Hurt', 'Dead', 'Sent off', 'Missing next game', 'Reserves']);

export function playerStateToken(playerState: number): PlayerStateToken {
  if (rendersOnPitch(playerState)) return data('On pitch');
  switch (baseState(playerState)) {
    case PlayerStateBase.KNOCKED_OUT: return data("KO'd");
    case PlayerStateBase.BADLY_HURT: return data('Badly Hurt');
    case PlayerStateBase.SERIOUS_INJURY: return data('Seriously Hurt');
    case PlayerStateBase.RIP: return data('Dead');
    case PlayerStateBase.BANNED: return data('Sent off');
    case PlayerStateBase.MISSING: return data('Missing next game');
    case PlayerStateBase.RESERVE:
    default: return data('Reserves');
  }
}

const LABEL_KEYS: Readonly<Record<string, string>> = {
  'On pitch': 'hud.text.onPitch', "KO'd": 'hud.playerState.ko', 'Badly Hurt': 'hud.text.badlyHurt', 'Seriously Hurt': 'hud.text.seriouslyHurt',
  'Dead': 'hud.playerState.dead', 'Sent off': 'hud.text.sentOff', 'Missing next game': 'hud.text.missingNextGame', 'Reserves': 'hud.playerState.reserves',
};

/** The localised label of a token (render step only); anything else renders unchanged. */
export function playerStateLabel(token: string): string {
  const key = LABEL_KEYS[token];
  return key ? t(key) : token;
}
