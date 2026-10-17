/**
 * Ports of upstream's report renderers shared by BB2020 and BB2025 (ffb-client-logic client/report/mixed/), line for
 * line.
 */
import type { GameJson, PlayerJson } from '@fumbbl40k/ffb-protocol';
import {
  actingPlayer, agilityWithModifiers, bool, dative, directionName, formatRollModifiersByName, formatThousands, genitive,
  hasSkillProperty, hasSkillToCancelProperty, hasTacklezones, hasUnusedSkillWithProperty, ints, isBoxCoordinate, isHomeTeamId,
  nominative, num, playerById, playerCoordinate, playerName, playerStateValue, provided, rollModifierRows, self, sideOfPlayer,
  skillWithProperty, strings, tablesOf, teamById, canonicalSkill, inducementType, type Report,
} from '../model';
import type { TextStyle, UpstreamPrinter } from '../printer';
import { neededRollText, type UpstreamRendererSet } from '../registry';
import { agilityResult, skillUseDescription } from './common';

function teamOf(game: GameJson | null, teamId: unknown): { name: string; home: boolean } {
  const home = isHomeTeamId(game, teamId);
  const team = teamById(game, teamId) ?? (home ? game?.teamHome : game?.teamAway) ?? null;
  return { name: String(team?.teamName ?? 'null'), home };
}
function styleFor(game: GameJson | null, player: PlayerJson | null, bold = false): TextStyle {
  const home = sideOfPlayer(game, player) === 'home';
  return home ? (bold ? 'homeBold' : 'home') : (bold ? 'awayBold' : 'away');
}

function allYouCanEat(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  if (!bool(r.reRolled)) {
    out.player(out.getIndent(), true, player);
    out.println(out.getIndent(), 'bold', ` hopes the ref did not spot ${dative(player)}.`);
  }
  out.println(out.getIndent() + 1, 'roll', `All You Can Eat Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent(), false, player);
  out.println(out.getIndent() + 2, 'none', ` ${bool(r.successful) ? 'goes unnoticed.' : 'is spotted.'}`);
  if (!bool(r.reRolled)) out.println(out.getIndent() + 2, 'neededRoll', `Roll a ${num(r.minimumRoll)}+ to succeed`);
}

function argueTheCall(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  out.println(out.getIndent(), 'roll', `Argue the Call Roll [ ${num(r.roll)} ]`);
  let minimumRoll = 6;
  if (bool(r.friendsWithRef)) {
    out.println(out.getIndent() + 1, 'explanation', 'Being friends with the ref allows argue to succeed on 5+.');
    minimumRoll = 5;
  }
  const target = minimumRoll;
  const biasedRefs = num(r.biasedRefs);
  let modifiers = '';
  if (biasedRefs > 0) {
    modifiers += ` + ${biasedRefs} Biased Referee${biasedRefs > 1 ? 's' : ''}`;
    minimumRoll -= biasedRefs;
  }
  if (bool(r.successful)) {
    out.print(out.getIndent() + 1, 'none', 'The ref refrains from banning ');
    out.player(out.getIndent() + 1, false, player);
    let status = '';
    if (!isBoxCoordinate(playerCoordinate(game, r.playerId))) {
      status += ` and ${nominative(player)}${bool(r.staysOnPitch) ? ' stays on the pitch' : ' is sent to the reserve instead'}`;
    }
    out.println(out.getIndent() + 1, 'none', `${status}.`);
    out.println(out.getIndent() + 1, 'neededRoll', `Succeeded on a roll of ${minimumRoll} (Roll${modifiers} >= ${target})`);
  } else {
    out.print(out.getIndent() + 1, 'none', 'The ref bans ');
    out.player(out.getIndent() + 1, false, player);
    out.println(out.getIndent() + 1, 'none', ' from the game.');
    out.println(out.getIndent() + 1, 'neededRoll', `Would have succeeded on a roll of ${minimumRoll} (Roll${modifiers} >= ${target})`);
  }
  if (bool(r.coachBanned)) {
    out.print(out.getIndent() + 1, 'none', 'Coach ');
    const home = sideOfPlayer(game, player) === 'home';
    out.print(out.getIndent() + 1, home ? 'home' : 'away', String((home ? game?.teamHome : game?.teamAway)?.coach ?? 'null'));
    out.println(out.getIndent() + 1, 'none', ' is also banned from the game.');
  }
}

function balefulHex(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Baleful Hex Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, actingPlayer(game));
  out.printT(out.getIndent() + 1, bool(r.successful) ? ' makes ' : ' fails to make ');
  out.player(out.getIndent() + 1, false, playerById(game, r.targetPlayerId));
  out.printlnT(out.getIndent() + 1, ' miss a turn.');
}

function biasedRef(r: Report, out: UpstreamPrinter): void {
  out.println(out.getIndent(), 'roll', `Biased Roll [ ${num(r.roll)} ]`);
  out.println(out.getIndent(), 'none', bool(r.foulingPlayerBanned) ? 'The biased referee spots the foul.' : 'The biased referee does not spot the foul.');
}

function blockChoice(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const defender = playerById(game, r.defenderId);
  let status = 'Block Result';
  if (bool(r.showNameInReport)) status += ` against ${playerName(defender)}`;
  const result = String(r.blockResult ?? 'null');
  out.println(out.getIndent(), 'roll', `${status} [ ${result} ]`);
  const attacker = actingPlayer(game);
  if (result === 'BOTH DOWN') {
    if (hasSkillProperty(game, attacker, 'preventFallOnBothDown')) {
      out.player(out.getIndent() + 1, false, attacker);
      out.printlnT(out.getIndent() + 1, ` has been saved by ${genitive(attacker)} ${skillWithProperty(game, attacker, 'preventFallOnBothDown')} skill.`);
    }
    if (hasSkillProperty(game, defender, 'preventFallOnBothDown')) {
      out.player(out.getIndent() + 1, false, defender);
      const skill = skillWithProperty(game, defender, 'preventFallOnBothDown');
      out.printlnT(out.getIndent() + 1, hasTacklezones(playerStateValue(game, r.defenderId))
        ? ` has been saved by ${genitive(defender)} ${skill} skill.`
        : ` has not been saved by ${genitive(defender)} ${skill} skill, due to having no tacklezones.`);
    }
  } else if (result === 'POW/PUSH') {
    if (hasSkillToCancelProperty(game, attacker, 'ignoreDefenderStumblesResult')
      && (hasSkillProperty(game, defender, 'ignoreDefenderStumblesResult')
        || hasUnusedSkillWithProperty(game, defender, 'ignoresDefenderStumblesResultForFirstBlock'))) {
      out.player(out.getIndent() + 1, false, attacker);
      out.printlnT(out.getIndent() + 1, ' uses Tackle to bring opponent down.');
    }
  }
}

function blockReRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  const roll = ints(r.blockRoll);
  const results = tablesOf(game).blockResults;
  let status = 'Re-Rolled Block Dice';
  for (const face of roll) status += ` [ ${results[String(face)] ?? results['3']} ]`;
  out.println(2, 'roll', status);
  const source = String(r.reRollSource ?? 'null');
  status = ` re-rolled ${roll.length} block ${roll.length === 1 ? 'die' : 'dice'} using ${tablesOf(game).reRollSources[source] ?? source}.`;
  out.player(3, true, player);
  out.println(3, 'explanation', status);
}

function bloodLustRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = actingPlayer(game);
  out.println(out.getIndent(), 'roll', `Blood Lust Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, player);
  const ok = bool(r.successful);
  if (ok) {
    out.printlnT(out.getIndent() + 1, ' resists the Blood Lust.');
  } else {
    out.printlnT(out.getIndent() + 1, ' gives in to the Blood Lust.');
    out.printlnT(out.getIndent() + 1, 'Player must feed at the end of the action or lose tackle zone (and drop ball if carrying) and suffer a turnover.');
  }
  const needed = neededRollText(r, ok);
  if (needed !== null) out.println(out.getIndent() + 1, 'neededRoll', needed);
}

function breatheFire(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = actingPlayer(game);
  out.println(out.getIndent(), 'roll', `Breathe Fire Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, player);
  const strong = bool(r.strongOpponent);
  const needed = (potential: 'KNOCK_DOWN' | 'PRONE' | 'NO_EFFECT') => {
    const text = potential === 'KNOCK_DOWN' ? '6 to knock down opponent' : potential === 'PRONE' ? '4 to place opponent prone' : '2 to avoid knock down';
    out.println(out.getIndent() + 1, 'neededRoll', ` (Roll${strong ? ' - 1 opponent has strength 5 or more' : ''} >= ${text}).`);
  };
  const defender = playerById(game, r.defenderId);
  switch (r.status) {
    case 'KNOCK_DOWN':
      out.print(out.getIndent() + 1, 'none', ' engulfs ');
      out.player(out.getIndent() + 1, false, defender);
      out.println(out.getIndent() + 1, 'none', ' in flames.');
      break;
    case 'PRONE':
      out.print(out.getIndent() + 1, 'none', ' forces ');
      out.player(out.getIndent() + 1, false, defender);
      out.println(out.getIndent() + 1, 'none', ' to take cover.');
      needed('KNOCK_DOWN');
      break;
    case 'NO_EFFECT':
      out.print(out.getIndent() + 1, 'none', ' misses ');
      out.player(out.getIndent() + 1, false, defender);
      out.println(out.getIndent() + 1, 'none', '.');
      needed('KNOCK_DOWN');
      needed('PRONE');
      break;
    case 'FAILURE':
      out.println(out.getIndent() + 1, 'none', ` engulfs ${self(player)} in flames.`);
      needed('KNOCK_DOWN');
      needed('PRONE');
      needed('NO_EFFECT');
      break;
    default:
      break;
  }
}

function briberyAndCorruptionReRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const team = teamOf(game, r.teamId);
  out.print(out.getIndent(), team.home ? 'homeBold' : 'awayBold', team.name);
  switch (r.briberyAncCorruptionAction) {
    case 'USED': out.printlnT(out.getIndent(), ' use Bribery and Corruption to re-roll their Argue the Call roll.'); break;
    case 'ADDED': out.printlnT(out.getIndent(), ' may re-roll a natural 1 on an Argue the Call roll once in this game due to Bribery and Corruption.'); break;
    case 'WASTED': out.printlnT(out.getIndent(), ' have no use for their Bribery and Corruption as the coach was banned for more than one argue.'); break;
    default: break;
  }
}

function reRollsLost(label: string, amountKey: string) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const team = teamOf(game, r.teamId);
    out.print(out.getIndent() + 1, team.home ? 'home' : 'away', team.name);
    const amount = num(r[amountKey]);
    out.println(out.getIndent() + 1, 'none', ` lose ${amount === 1 ? `1 ${label} Re-Roll as it was` : `${amount} ${label} Re-Rolls as they were`} not used in this drive.`);
  };
}

function catchOfTheDay(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  if (!bool(r.reRolled)) {
    out.player(out.getIndent(), true, player);
    out.println(out.getIndent(), 'bold', ' tries to get the ball from the ground:');
  }
  out.println(out.getIndent() + 1, 'roll', `Catch of the Day Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 2, false, player);
  const ok = bool(r.successful);
  out.printlnT(out.getIndent() + 2, ok ? ' gets the ball.' : ' fails to get the ball.');
  const needed = neededRollText(r, ok);
  if (needed !== null) out.printlnT(out.getIndent() + 2, needed);
}

function cloudBurster(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const thrower = playerById(game, r.throwerId);
  const interceptor = playerById(game, r.interceptorId);
  // the report sends no thrower team (ReportCloudBurster writes throwerId / interceptorId only), so upstream's
  // "home is throwing" test (home team id equals null) is always false: the thrower is drawn AWAY_BOLD, the
  // interceptor HOME_BOLD
  const homeIsThrowing = isHomeTeamId(game, r.throwerTeamId);
  out.print(1, homeIsThrowing ? 'homeBold' : 'awayBold', playerName(thrower), thrower?.playerId);
  out.println(1, 'bold', ' uses CloudBurster');
  out.print(2, homeIsThrowing ? 'awayBold' : 'homeBold', playerName(interceptor), interceptor?.playerId);
  out.println(2, 'none', ` has to reroll ${genitive(interceptor)} successful interception.`);
}

function dedicatedFans(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const teamRoll = (roll: number, modifier: number, teamName: string, style: TextStyle, conceded: boolean) => {
    if (roll > 0) out.println(out.getIndent(), 'roll', `Dedicated Fans Roll [ ${roll} ]`);
    out.print(out.getIndent() + 1, style, teamName);
    let text = modifier > 0 ? ` gain ${modifier}` : modifier < 0 ? ` lose ${Math.abs(modifier)}` : ' keep their';
    text += ' Dedicated Fan';
    if (Math.abs(modifier) !== 1) text += 's';
    if (conceded && modifier !== 0) text += ' due to conceding';
    out.println(out.getIndent() + 1, 'none', `${text}.`);
  };
  const conceded = bool(r.conceded);
  teamRoll(num(r.rollHome), num(r.dedicatedFansModifierHome), String(game?.teamHome?.teamName ?? 'null'), 'homeBold',
    conceded && !!game && teamById(game, r.teamId) === game.teamHome);
  teamRoll(num(r.rollAway), num(r.dedicatedFansModifierAway), String(game?.teamAway?.teamName ?? 'null'), 'awayBold',
    conceded && !!game && teamById(game, r.teamId) === game.teamAway);
}

function doubleHiredStaff(r: Report, out: UpstreamPrinter): void {
  out.println(out.getIndent(), 'bold', `Inamous Coaching Staff ${String(r.name ?? 'null')} takes money from both teams and plays for neither.`);
}

function event(r: Report, out: UpstreamPrinter): void {
  out.println(out.getIndent() + 1, 'none', typeof r.message === 'string' ? r.message : null);
}

function fanFactor(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Fan Factor Roll [${num(r.dedicatedFansRoll)}]`);
  out.printT(out.getIndent() + 1, 'Team ');
  const team = teamOf(game, r.teamId);
  out.print(out.getIndent() + 1, team.home ? 'home' : 'away', team.name);
  out.printlnT(out.getIndent() + 1,
    ` has ${num(r.dedicatedFansResult)}k fans behind them (${num(r.dedicatedFans)}k Dedicated Fans and ${num(r.dedicatedFansRoll)}k fair-weather fans)`);
}

function freePettyCash(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'bold', 'Assigning Petty Cash');
  out.printT(out.getIndent() + 1, 'Team ');
  const team = teamOf(game, r.teamId);
  out.print(out.getIndent() + 1, team.home ? 'home' : 'away', team.name);
  out.printlnT(out.getIndent() + 1, ` receives ${formatThousands(num(r.gold))} gold as petty cash from being the underdog before adding inducements.`);
}

function goForItRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = actingPlayer(game);
  out.println(out.getIndent(), 'roll', `Rush Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, player);
  const ok = bool(r.successful);
  out.printlnT(out.getIndent() + 1, ok ? ' rushes!' : ' trips while rushing.');
  const needed = neededRollText(r, ok);
  if (needed !== null) {
    out.println(out.getIndent() + 1, 'neededRoll',
      `${needed} (Roll${formatRollModifiersByName(rollModifierRows(game, 'GO_FOR_IT_MODIFIER', r.rollModifiers))} > ${num(r.minimumRoll) - 1}).`);
  }
}

function hitAndRun(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const indent = out.getIndent();
  out.player(indent, false, playerById(game, r.playerId));
  out.print(indent, 'none', ' moves one square ');
  out.print(indent, 'none', directionName(r.direction));
  out.println(indent, 'none', '.');
}

function indomitable(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  out.player(out.getIndent() + 1, false, player);
  out.printT(out.getIndent() + 1, ' uses Indomitable to push ');
  out.printT(out.getIndent() + 1, genitive(player));
  out.printT(out.getIndent() + 1, ' strength to the double of ');
  out.player(out.getIndent(), false, playerById(game, r.defenderId));
  // upstream ends with print(".") and no line break: its next log text continues this line
  out.printT(out.getIndent() + 1, '.');
}

function inducement(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const type = inducementType(game, r.inducementType);
  if (!provided(r.teamId) || !type) return;
  const team = teamOf(game, r.teamId);
  out.print(out.getIndent(), team.home ? 'home' : 'away', team.name);
  const usages = type.usages;
  const value = num(r.value);
  if (usages.includes('REROLL')) {
    out.printT(out.getIndent(), ' use ');
    out.print(out.getIndent(), 'bold', 'Extra Team Training');
    out.printlnT(out.getIndent(), ` to add ${value}${value === 1 ? ' Re-Roll.' : ' Re-Rolls.'}`);
  } else if (usages.includes('APOTHECARY')) {
    out.printT(out.getIndent(), ' use ');
    out.print(out.getIndent(), 'bold', 'Wandering Apothecaries');
    out.printlnT(out.getIndent(), ` to add ${value}${value === 1 ? ' Apothecary.' : ' Apothecaries.'}`);
  } else if (usages.includes('REGENERATION')) {
    out.printT(out.getIndent(), ' use ');
    out.print(out.getIndent(), 'bold', type.description ?? 'null');
    out.printlnT(out.getIndent(), ' to re-roll the failed Regeneration.');
  }
}

function kickoffPitchInvasion(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const amount = num(r.amount);
  if (amount > 0) {
    out.println(out.getIndent(), 'roll', `Pitch Invasion Roll [ ${amount} ]`);
    out.println(out.getIndent() + 1, 'explanation', `Affected Teams will have ${amount} player${amount > 1 ? 's' : ''} stunned.`);
  }
  const fanHome = num(game?.gameResult?.teamResultHome?.fanFactor);
  const fanAway = num(game?.gameResult?.teamResultAway?.fanFactor);
  out.println(out.getIndent(), 'roll', `Pitch Invasion Roll Home Team [ ${num(r.rollHome)} ]`);
  out.printlnT(out.getIndent() + 1, `Rolled ${num(r.rollHome)} + ${fanHome} Fan Factor = ${num(r.rollHome) + fanHome}.`);
  out.println(out.getIndent(), 'roll', `Pitch Invasion Roll Away Team [ ${num(r.rollAway)} ]`);
  out.printlnT(out.getIndent() + 1, `Rolled ${num(r.rollAway)} + ${fanAway} Fan Factor = ${num(r.rollAway) + fanAway}.`);
  for (const id of strings(r.playerIds)) {
    out.player(out.getIndent() + 1, false, playerById(game, id));
    out.println(out.getIndent() + 1, 'none', ' is stunned');
  }
}

function kickoffSequenceActivationsCount(r: Report, out: UpstreamPrinter): void {
  const available = num(r.number);
  out.println(out.getIndent() + 1, 'explanation',
    `Max ${num(r.nrOfPlayersAllowed)} open players can be used - ${num(r.nrOfPlayers)} used (${available} ${available === 1 ? 'remains' : 'remain'} open).`);
}

function kickoffSequenceActivationsExhausted(r: Report, out: UpstreamPrinter): void {
  out.println(out.getIndent() + 1, 'explanation', bool(r.limitReached) ? 'Moved allowed number of players.' : 'No more open players available.');
}

function kickoffTimeout(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.print(out.getIndent(), 'none', `Timeout in turn ${num(r.turnNr)} of `);
  if (game?.homePlaying) out.println(out.getIndent(), 'home', String(game.teamHome?.teamName ?? 'null'));
  else out.println(out.getIndent(), 'away', String(game?.teamAway?.teamName ?? 'null'));
  const modifier = num(r.turnModifier);
  if (modifier < 0) {
    out.printlnT(out.getIndent() + 1, 'The referee adjusts the clock back.');
    out.printlnT(out.getIndent() + 1, `Turn Counter is moved ${Math.abs(modifier)} step backward.`);
  } else {
    out.printlnT(out.getIndent() + 1, 'The referee does not stop the clock.');
    out.printlnT(out.getIndent() + 1, `Turn Counter is moved ${Math.abs(modifier)} step forward.`);
  }
}

function lookIntoMyEyes(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const acting = actingPlayer(game);
  out.println(out.getIndent(), 'roll', `Look Into My Eyes Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, acting);
  out.printlnT(out.getIndent() + 1, bool(r.successful)
    ? ` steals the ball from ${genitive(acting)} opponent.`
    : ` fails to steal the ball from ${genitive(acting)} opponent.`);
}

function modifiedDodgeResultSuccessful(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  // upstream/master guards the null skill some stored replays carry
  const skill = canonicalSkill(game, r.skill);
  if (skill) out.println(out.getIndent() + 1, 'explanation', `Using ${skill} would result in a successful dodge`);
}

function modifiedPassResult(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const skill = canonicalSkill(game, r.skill);
  if (!skill) return; // upstream: getSkill().getName() throws before printing
  out.println(out.getIndent() + 1, 'explanation', `Using ${skill} would change the result to ${String(r.passResult ?? 'null')}`);
}

function mostValuablePlayers(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.setIndent(0);
  const home = game?.gameResult?.teamResultHome;
  const away = game?.gameResult?.teamResultAway;
  const diff = (num(home?.score) + num(home?.penaltyScore)) - (num(away?.score) + num(away?.penaltyScore));
  const legally = game?.concededLegally === true ? ' without penalties due to excessive player loss' : '';
  if (home?.conceded === true) {
    out.println('spaceAboveBelow', 'turnHome', `Coach ${String(game?.teamHome?.coach ?? 'null')} concedes the game${legally}.`);
  } else if (away?.conceded === true) {
    out.println('spaceAboveBelow', 'turnAway', `Coach ${String(game?.teamAway?.coach ?? 'null')} concedes the game${legally}.`);
  } else if (diff > 0) {
    out.println('spaceAboveBelow', 'turnHome', `${String(game?.teamHome?.teamName ?? 'null')} win the game.`);
  } else if (diff < 0) {
    out.println('spaceAboveBelow', 'turnAway', `${String(game?.teamAway?.teamName ?? 'null')} win the game.`);
  } else {
    out.println('spaceAboveBelow', 'turn', 'The game ends in a tie.');
  }
  out.println(out.getIndent(), 'bold', 'Most Valuable Players');
  for (const [ids, style] of [[r.playerIdsHome, 'home'], [r.playerIdsAway, 'away']] as const) {
    for (const id of strings(ids)) {
      const player = playerById(game, id);
      out.print(out.getIndent() + 1, 'none', 'The jury voted ');
      out.print(out.getIndent() + 1, style, playerName(player), player?.playerId);
      out.print(out.getIndent() + 1, 'none', ' the most valuable player of ');
      out.print(out.getIndent() + 1, 'none', genitive(player));
      out.println(out.getIndent() + 1, 'none', ' team.');
    }
  }
}

function nervesOfSteel(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  if (!player) return;
  out.player(out.getIndent(), false, player);
  out.printT(out.getIndent(), ' is using Nerves of Steel to ');
  out.printlnT(out.getIndent(), bool(r.bomb) ? 'throw the bomb.' : `${String(r.ballAction ?? 'null')} the ball.`);
}

function oldPro(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent() + 1, 'roll', `Old Pro Roll [ ${num(r.roll)} ]`);
  const indent = out.getIndent() + 1;
  out.player(indent, false, playerById(game, r.playerId));
  out.println(indent, 'none', `${bool(r.selfInflicted) ? ' forced the opponent to re-roll a ' : ' re-rolled a '}${num(r.oldRoll)} into a ${num(r.roll)}.`);
}

function penaltyShootout(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `${String(r.rollCount ?? 'null')} Penalty Shootout Rolls: Home [${num(r.rollHome)}] Away [${num(r.rollAway)}]`);
  if (typeof r.homeTeam === 'boolean') {
    const team = r.homeTeam ? game?.teamHome : game?.teamAway;
    out.print(out.getIndent() + 1, r.homeTeam ? 'home' : 'away', String(team?.teamName ?? 'null'));
    out.println(out.getIndent() + 1, 'none', ' win this penalty');
    out.print(out.getIndent() + 1, 'none', 'Current score: ');
    out.print(out.getIndent() + 1, 'home', String(game?.teamHome?.teamName ?? 'null'));
    out.print(out.getIndent() + 1, 'none', ` ${num(r.penaltyScoreHome)} - ${num(r.penaltyScoreAway)} `);
    out.println(out.getIndent() + 1, 'away', String(game?.teamAway?.teamName ?? 'null'));
  } else {
    out.println(out.getIndent() + 1, 'none', 'Penalty is rerolled');
  }
  if (provided(r.teamId)) {
    const team = teamOf(game, r.teamId);
    out.print(out.getIndent(), team.home ? 'home' : 'away', team.name);
    out.println(out.getIndent(), 'none', ' win sudden death');
  }
}

function pickMeUp(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Pick-me-up Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent(), false, playerById(game, r.playerId));
  out.println(out.getIndent(), 'none', bool(r.successful) ? ' is picked up.' : ' is not picked up.');
}

/** PickUpRollMessage (BB2020; BB2025 differs only in Secure the Ball's base roll of 2). */
export function pickUpRoll(r: Report, out: UpstreamPrinter, game: GameJson | null, secureTheBallBase: boolean): void {
  const player = playerById(game, r.playerId);
  if (!bool(r.reRolled)) {
    out.player(out.getIndent(), true, player);
    out.println(out.getIndent(), 'bold', ' tries to pick up the ball:');
  }
  out.println(out.getIndent() + 1, 'roll', `Pickup Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 2, false, player);
  const ok = bool(r.successful);
  out.printlnT(out.getIndent() + 2, ok ? ' picks up the ball.' : ' drops the ball.');
  const needed = neededRollText(r, ok);
  if (needed !== null) {
    const base = secureTheBallBase && bool(r.secureTheBallUsed) ? 2 : agilityWithModifiers(player);
    out.println(out.getIndent() + 2, 'neededRoll', needed + agilityResult(base, game, 'PICKUP_MODIFIER', r.rollModifiers));
  }
}

function placeBallDirection(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.player(out.getIndent(), false, playerById(game, r.playerId));
  out.println(out.getIndent(), 'none', ` places the ball ${directionName(r.direction)}.`);
}

function playerEvent(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.player(out.getIndent() + 1, false, playerById(game, r.playerId));
  out.println(out.getIndent() + 1, 'none', ` ${String(r.message ?? 'null')}`);
}

function prayerEnd(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const name = String(r.prayer ?? 'null');
  out.println(out.getIndent(), 'roll', `Prayer effect ended: ${name}`);
  out.println(out.getIndent() + 2, 'explanation', `Effect was: ${tablesOf(game).prayerDescriptions[name] ?? 'null'}`);
}

function prayerWasted(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const name = String(r.name ?? 'null');
  if (provided(r.playerId)) {
    out.println(out.getIndent() + 1, 'explanation', `Prayer ${name} is wasted since there are no eligible skills.`);
    out.player(out.getIndent() + 1, true, playerById(game, r.playerId));
    out.println(out.getIndent() + 1, 'explanation', ' was the selected player');
  } else {
    out.println(out.getIndent() + 1, 'explanation', `Prayer ${name} is wasted since there are no eligible players.`);
  }
}

function projectileVomit(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = actingPlayer(game);
  out.println(out.getIndent(), 'roll', `Projectile Vomit Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, player);
  if (bool(r.successful)) {
    out.print(out.getIndent() + 1, 'none', ' vomits on ');
    out.player(out.getIndent() + 1, false, playerById(game, r.defenderId));
    out.println(out.getIndent() + 1, 'none', '.');
  } else {
    out.printlnT(out.getIndent() + 1, ` vomits on ${self(player)}.`);
  }
}

function driveReRoll(phrase: string, explanation: string | null) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const player = playerById(game, r.playerId);
    out.player(out.getIndent(), false, player);
    out.printT(out.getIndent(), phrase);
    const home = sideOfPlayer(game, player) === 'home';
    out.print(out.getIndent(), home ? 'home' : 'away', String((home ? game?.teamHome : game?.teamAway)?.teamName ?? 'null'));
    out.printlnT(out.getIndent(), ' gains a Re-Roll only available for this drive.');
    if (explanation) out.println(out.getIndent(), 'explanation', explanation);
  };
}

function quickSnapRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Quick Snap Roll [ ${num(r.roll)} ]`);
  const team = teamOf(game, r.teamId);
  out.print(out.getIndent() + 1, team.home ? 'home' : 'away', team.name);
  out.println(out.getIndent() + 1, 'none', ` may move ${num(r.nrOfPlayers)} open players 1 square each`);
}

function raidingParty(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const indent = out.getIndent();
  out.player(indent, false, playerById(game, r.playerId));
  out.print(indent, 'none', ' allows ');
  out.player(indent, false, playerById(game, r.playerIdOtherPlayer));
  out.print(indent, 'none', ' to move one square ');
  out.print(indent, 'none', directionName(r.direction));
  out.println(indent, 'none', '.');
}

function referee(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  if (bool(r.foulingPlayerBanned)) {
    out.printT(out.getIndent(), 'The referee spots the foul ');
    if (bool(r.underScrutiny)) out.printT(out.getIndent(), 'because the team is under scrutiny ');
    out.printT(out.getIndent(), 'and bans ');
    out.player(out.getIndent(), false, actingPlayer(game));
    out.printlnT(out.getIndent(), ' from the game.');
  } else {
    out.printlnT(out.getIndent(), "The referee didn't spot the foul.");
  }
}

function scatterBall(r: Report, out: UpstreamPrinter): void {
  const gust = bool(r.gustOfWind);
  if (gust) {
    out.setIndent(out.getIndent() + 1);
    out.printlnT(out.getIndent(), 'A gust of wind scatters the ball.');
  }
  const rolls = ints(r.rolls);
  if (rolls.length) {
    const directions = Array.isArray(r.directionArray) ? r.directionArray : [];
    const status = `${rolls.length > 1 ? 'Scatter Rolls [ ' : 'Bounce Roll [ '}${rolls.join(', ')} ] ${directions.map(directionName).join(', ')}`;
    out.println(out.getIndent(), 'roll', status);
  }
  if (gust) out.setIndent(out.getIndent() - 1);
}

function scatterPlayer(r: Report, out: UpstreamPrinter): void {
  const rolls = ints(r.rolls);
  if (!rolls.length) return;
  const scatters = typeof r.isScatter === 'boolean' ? r.isScatter : rolls.length > 1;
  const directions = Array.isArray(r.directionArray) ? r.directionArray : [];
  out.println(out.getIndent(), 'roll', `${scatters ? 'Scatter Rolls [ ' : 'Bounce Roll [ '}${rolls.join(', ')} ] ${directions.map(directionName).join(', ')}`);
  const start = ints(r.startCoordinate);
  const end = ints(r.endCoordinate);
  out.printlnT(out.getIndent() + 1, `Player ${scatters ? 'scatters' : 'bounces'} from square (${start[0]},${start[1]}) to square (${end[0]},${end[1]}).`);
}

function selectTarget(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const attacker = playerById(game, r.attackerId);
  const defender = playerById(game, r.defenderId);
  out.print(out.getIndent(), styleFor(game, attacker), playerName(attacker), attacker?.playerId);
  out.print(out.getIndent(), 'none', ' targets ');
  out.print(out.getIndent(), styleFor(game, defender), playerName(defender), defender?.playerId);
  out.println(out.getIndent(), 'none', '.');
}

function skillUseOtherPlayer(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  const other = playerById(game, r.playerIdOtherPlayer);
  const indent = out.getIndent();
  out.player(indent, false, player);
  const skill = canonicalSkill(game, r.skill);
  if (!skill) throw new Error('unknown skill'); // upstream: getSkill().getName() throws here
  out.printT(indent, ` uses ${skill} of `);
  out.player(indent, false, other);
  const description = skillUseDescription(r.skillUse, player);
  if (description === null) throw new Error('unknown skill use'); // upstream: getSkillUse().getDescription() throws here
  out.printlnT(indent, ` ${description}.`);
}

function skillWasted(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const skill = canonicalSkill(game, r.skill);
  if (!skill) return;
  const player = playerById(game, r.playerId);
  const indent = out.getIndent();
  if (player) {
    out.player(indent, false, player);
    out.printlnT(indent, ` wastes ${skill}.`);
  } else {
    out.printlnT(indent, `${skill} is wasted.`);
  }
}

function thrownKeg(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Beer Barrel Bash Roll [ ${num(r.roll)} ]`);
  const thrower = playerById(game, r.playerId);
  out.player(out.getIndent(), false, thrower);
  out.print(out.getIndent(), 'none', ' hits ');
  if (bool(r.fumble)) out.print(out.getIndent(), 'none', self(thrower));
  else if (bool(r.successful)) out.player(out.getIndent(), false, playerById(game, r.targetPlayerId));
  else out.print(out.getIndent(), 'none', 'no one');
  out.println(out.getIndent(), 'none', '.');
}

function trapDoor(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Trapdoor Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent(), false, playerById(game, r.playerId));
  out.println(out.getIndent(), 'none', bool(r.escaped) ? ' escapes the trapdoor.' : ' falls down the trapdoor.');
}

function weatherMageRoll(r: Report, out: UpstreamPrinter): void {
  const roll = ints(r.weatherRoll);
  out.println(out.getIndent(), 'roll', `Weather Roll [ ${roll[0]} ][ ${roll[1]} ] `);
  out.println(out.getIndent() + 1, 'none', 'The weather mage works his magic');
}

function winnings(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.print(out.getIndent() + 1, 'homeBold', String(game?.teamHome?.teamName ?? 'null'));
  out.println(out.getIndent() + 1, 'none', ` earns ${formatThousands(num(r.winningsHome))} gold.`);
  out.print(out.getIndent() + 1, 'awayBold', String(game?.teamAway?.teamName ?? 'null'));
  out.println(out.getIndent() + 1, 'none', ` earns ${formatThousands(num(r.winningsAway))} gold.`);
}

export const MIXED_MESSAGES: Record<string, UpstreamRendererSet> = {
  allYouCanEat,
  argueTheCall,
  balefulHex,
  biasedRef,
  blockChoice,
  blockReRoll,
  bloodLustRoll,
  breatheFire,
  briberyAndCorruptionReRoll,
  brilliantCoachingReRoll: reRollsLost('Brilliant Coaching', 'rerollBrilliantCoachingOneDrive'),
  catchOfTheDay,
  cloudBurster,
  dedicatedFans,
  doubleHiredStaff,
  event,
  fanFactor,
  freePettyCash,
  goForItRoll,
  hitAndRun,
  indomitable,
  inducement,
  kickoffPitchInvasion,
  kickoffSequenceActivationsCount,
  kickoffSequenceActivationsExhausted,
  kickoffTimeout,
  lookIntoMyEyesRoll: lookIntoMyEyes,
  modifiedDodgeResultSuccessful,
  modifiedPassResult,
  mostValuablePlayers,
  nervesOfSteel,
  oldPro,
  penaltyShootout,
  pickMeUp,
  pickUpRoll: { BB2020: (r, out, game) => pickUpRoll(r, out, game, false), BB2025: (r, out, game) => pickUpRoll(r, out, game, true) },
  placedBallDirection: placeBallDirection,
  playerEvent,
  prayerEnd,
  prayerWasted,
  projectileVomit,
  pumpUpTheCrowdReRoll: driveReRoll(' Pumps Up The Crowd so ', null),
  pumpUpTheCrowdReRollLost: reRollsLost('Pump Up The Crowd', 'rerollPumpUpTheCrowdOneDrive'),
  quickSnapRoll,
  raidingParty,
  referee,
  scatterBall,
  scatterPlayer,
  selectBlitzTarget: selectTarget,
  selectGazeTarget: selectTarget,
  showStarReRoll: driveReRoll(' is the Star of the Show and ', 'Will be added for the next drive.'),
  showStarReRollLost: reRollsLost('Star of the Show', 'rerollShowStarOneDrive'),
  skillUseOtherPlayer,
  skillWasted,
  thrownKeg,
  trapDoor,
  weatherMageRoll,
  winnings,
};
