/**
 * Controller support P2a (Astra review): which surfaces gate the pad crosshair, from a SNAPSHOT of the store and view
 * state (pure, so the real derivation is tested with fixtures). Feeds game/crosshair.ts crosshairGate.
 *
 *  - cardOpen: a card / dialog owns focus — the crosshair hides, A / X / the stick stay off the pitch.
 *  - pitchPickOpen: a server SQUARE / PLAYER pick whose renderer picker is ARMED (the crosshair serves it): push
 *    direction, kick aim, a square pick (not while "Cast Zap?" is up — its picker is disabled), an on-pitch player pick
 *    (touchback receiver, interception, Pick-Me-Up …; never a pane-only MVP / Assign Touchdown pick). The setup
 *    legality panel keeps the pitch interactive (the coach moves the offenders under it).
 *  - mandatoryChoiceOpen: the server requires an answer and the pad's B has no decline to take — B is inert.
 */
import { isPickKeptOffPitch } from './endGamePick';
import type { CrosshairGateInput } from './crosshair';

type Maybe<T> = T | null | undefined;

/** The store slice the gate reads (shapes as in game/store.ts state). */
export interface CrosshairGateStoreState {
  reRollPrompt?: Maybe<{ mine: boolean }>;
  skillChoice?: Maybe<{ mine: boolean; using?: boolean }>;
  blockPartial?: Maybe<{ mine: boolean; pickable: boolean }>;
  multiBlockResolution?: Maybe<{ rolls: { isOwnChoice: boolean | null; pickable: boolean }[] }>;
  followupChoice?: Maybe<object>;
  apothecaryChoice?: Maybe<{ mine: boolean }>;
  apothecaryD16?: Maybe<{ mine: boolean }>;
  injuryInteraction?: Maybe<{ mine: boolean }>;
  bloodlust?: Maybe<{ stage: 'reroll' | 'decision' | 'bite' }>;
  kickSkill?: Maybe<object>;
  yesNo?: Maybe<object>;
  blitzBlockChoice?: Maybe<object>;
  foulChoiceHold?: Maybe<object>;
  coinChoicePrompt?: Maybe<object>;
  receiveChoicePrompt?: Maybe<object>;
  selectSkill?: Maybe<object>;
  selectPosition?: Maybe<object>;
  selectWeather?: Maybe<object>;
  keywordChoice?: Maybe<object>;
  cardChoice?: Maybe<object>;
  cardBuy?: Maybe<object>;
  inducementBuy?: Maybe<object>;
  inducementUse?: Maybe<object>;
  wizardTargetConfirm?: Maybe<object>;
  sendOff?: Maybe<object>;
  pushChoice?: Maybe<object>;
  kickPlacement?: Maybe<object>;
  squarePick?: Maybe<object>;
  playerPick?: Maybe<{ key: string; declinable: boolean }>;
  pickMeUpEligible?: Maybe<object>;
}

export interface CrosshairGateSnapshot {
  state: CrosshairGateStoreState;
  /** game.dialogParameter is set (a server dialog is open). */
  dialogOpen: boolean;
  view: {
    wideRailPrompt: boolean;
    endActivationConfirm: boolean;
    endTurnWarn: boolean;
    setupLegalityPanel: boolean;
    unknownPanel: boolean;
    /** P2b (Astra P2-3): the unanswered-prompt panel's "pick a tile" coordinate pick is armed — the crosshair serves it. */
    unknownTilePick?: boolean;
  };
  /** renderer.pitchPickers() */
  pickers: { push: boolean; kick: boolean; tile: boolean; tileSkill: string | undefined; player: boolean };
}

export function crosshairGateInput(snap: CrosshairGateSnapshot): CrosshairGateInput {
  const st = snap.state;
  const v = snap.view;
  const p = snap.pickers;
  const blockCard = !!st.blockPartial?.mine; // my pick, or my uphill reroll card (pickable false)
  const blockPick = blockCard && !!st.blockPartial?.pickable;
  const multiBlockPick = !!st.multiBlockResolution?.rolls.some((r) => r.isOwnChoice === true);
  const listChoice = !!st.selectSkill || !!st.selectPosition || !!st.selectWeather || !!st.keywordChoice;
  const teamChooser = !!st.coinChoicePrompt || !!st.receiveChoicePrompt;
  const apothecary = !!st.apothecaryChoice?.mine || !!st.apothecaryD16?.mine || !!st.injuryInteraction?.mine;
  const bloodlustCard = !!st.bloodlust && st.bloodlust.stage !== 'bite';
  const playerPickOffPitch = !!st.playerPick && isPickKeptOffPitch(st.playerPick.key);
  const nonDeclinablePick = !!st.playerPick && !st.playerPick.declinable;
  // Cards the pad's B can answer (a real decline / cancel): with one of these up an open dialog is not "mandatory".
  const declinableCard = !!st.reRollPrompt?.mine || (!!st.skillChoice?.mine && !st.skillChoice?.using) || !!st.followupChoice
    || !!st.yesNo || !!st.blitzBlockChoice || !!st.foulChoiceHold || v.wideRailPrompt || v.endActivationConfirm || v.endTurnWarn
    || (!!st.playerPick && st.playerPick.declinable) || bloodlustCard;
  const cardOpen = declinableCard || blockCard || multiBlockPick || listChoice || teamChooser || apothecary || !!st.kickSkill
    || !!st.cardChoice || !!st.cardBuy || !!st.inducementBuy || !!st.inducementUse || !!st.wizardTargetConfirm
    || !!st.sendOff || playerPickOffPitch || v.unknownPanel;
  // The crosshair serves a server pick only while the renderer's picker for it is armed.
  const squarePickArmed = !!st.squarePick && !st.wizardTargetConfirm && p.tile && !(p.tileSkill ?? '').startsWith('order66-');
  const playerPickArmed = (!!st.playerPick && !playerPickOffPitch || !!st.pickMeUpEligible) && p.player;
  const pitchPickOpen = (!!st.pushChoice && p.push) || (!!st.kickPlacement && p.kick) || squarePickArmed || playerPickArmed
    || v.setupLegalityPanel || !!v.unknownTilePick;
  return {
    cardOpen,
    pitchPickOpen,
    mandatoryChoiceOpen: !!st.pushChoice || blockPick || multiBlockPick || !!st.kickPlacement || teamChooser || nonDeclinablePick
      || listChoice || apothecary || (snap.dialogOpen && !declinableCard),
  };
}
