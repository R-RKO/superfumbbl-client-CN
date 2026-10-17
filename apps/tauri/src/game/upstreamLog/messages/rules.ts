/**
 * Ports of upstream's ruleset-specific report renderers (ffb-client-logic client/report/bb2020/ and bb2025/), line
 * for line. Where the two editions share a renderer body with a one-word difference, one function takes the edition.
 */
import type { GameJson, PlayerJson } from '@fumbbl40k/ffb-protocol';
import {
  actingPlayer, agilityWithModifiers, arrayProvided, bool, buildEnumeration, dative, directionName, formatRollModifiersByName,
  formatThousands, genitive, ints, isHomeTeamId, movementWithModifiers, nominative, num, passingWithModifiers, playerById,
  playerName, provided, self, skillHasProperty, skillIntValue, skillWithProperty, strengthWithModifiers, strings, tablesOf,
  teamById, type Report, type UpstreamRules, rollModifierRows, seriousInjury, canonicalSkill,
} from '../model';
import type { UpstreamPrinter } from '../printer';
import { neededRollText, type UpstreamRendererSet } from '../registry';
import { agilityResult, playerStateDescription } from './common';

type Rules = UpstreamRules;

function teamOf(game: GameJson | null, teamId: unknown): { name: string; home: boolean } {
  const home = isHomeTeamId(game, teamId);
  const team = teamById(game, teamId) ?? (home ? game?.teamHome : game?.teamAway) ?? null;
  return { name: String(team?.teamName ?? 'null'), home };
}

const PASSING_DISTANCE_2020: Record<string, number> = {
  'Quick Pass': 0, 'Short Pass': 1, 'Long Pass': 2, 'Long Bomb': 3, 'Pass to Partner': 0,
};

function animalSavagery(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const attacker = playerById(game, r.attackerId);
    const indent = out.getIndent() + 1;
    out.player(indent, false, attacker);
    if (provided(r.defenderId)) {
      out.print(indent, 'none', ' lashes out against ');
      out.player(indent, false, playerById(game, r.defenderId));
      // UtilGameOption.isOptionEnabled reads getOptionWithDefault: an absent option takes GameOptionFactory's default (true)
      const endsActivation = game?.gameOptions?.gameOptionArray?.find((o) => o.gameOptionId === 'animalSavageryLashOutEndsActivation')?.gameOptionValue;
      if (rules === 'BB2025' && (endsActivation === undefined || endsActivation === 'true')) out.print(indent, 'none', ` but still loses ${genitive(attacker)} action`);
      out.println(indent, 'none', '.');
    } else {
      out.println(indent, 'none', ` has no one to lash out against and thus loses ${genitive(attacker)} action.`);
    }
  };
}

function casualtyModifierLine(r: Report, out: UpstreamPrinter, game: GameJson | null, roll: number): void {
  const names = strings(r.casualtyModifiers);
  if (!names.length) return;
  const table = tablesOf(game).casualtyModifiers;
  let modifiers = 0;
  const reportStrings: string[] = [];
  for (const name of names) {
    const niggling = /^(\d+) Niggling Injur(y|ies)$/.exec(name);
    const row = niggling ? { modifier: Number(niggling[1]), reportString: name } : table[name] ?? { modifier: 0, reportString: `0 ${name}` };
    reportStrings.push(row.reportString);
    modifiers += row.modifier;
  }
  // Java's natural String order (UTF-16 code units), as List.sort(Comparator.naturalOrder())
  reportStrings.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  out.println(out.getIndent() + 1, 'none', `Rolled ${roll}${reportStrings.map((s) => ` + ${s}`).join('')} = ${roll + modifiers}`);
}

const seriousInjuryRow = seriousInjury;

function apothecaryRoll(rules: Rules) {
  const fallback = rules === 'BB2025'
    ? ' but that stat cannot be reduced any further. The result counts as Miss Next Game instead.'
    : ' but that stat cannot be reduced any further. So a different injury has been chosen randomly.';
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const casualtyRoll = ints(r.casualtyRoll);
    if (!casualtyRoll.length) return;
    out.println(out.getIndent(), 'bold', 'Apothecary used.');
    const player = playerById(game, r.playerId);
    const si = seriousInjuryRow(game, r.seriousInjury);
    let status = `Casualty Roll [ ${casualtyRoll[0]}`;
    if (si && si.showSiRoll) status += ` ][ ${casualtyRoll[1] ?? 0}`;
    out.println(out.getIndent(), 'roll', `${status} ]`);
    casualtyModifierLine(r, out, game, casualtyRoll[0]!);
    out.player(out.getIndent() + 1, false, player);
    out.printlnT(out.getIndent() + 1, ` ${playerStateDescription(r.playerState)}.`);
    if (si) {
      const original = seriousInjuryRow(game, r.seriousInjuryOld);
      if (original) out.println(out.getIndent() + 1, 'explanation', `${playerName(player)} would have ${original.description}${fallback}`);
      out.player(out.getIndent() + 1, false, player);
      out.printlnT(out.getIndent() + 1, ` ${si.description}.`);
    }
  };
}

function blitzRoll(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    out.println(out.getIndent(), 'roll', `${rules === 'BB2025' ? 'Charge!' : 'Blitz'} Roll [ ${num(r.roll)} ]`);
    const team = teamOf(game, r.teamId);
    out.print(out.getIndent() + 1, team.home ? 'home' : 'away', team.name);
    out.println(out.getIndent() + 1, 'none', rules === 'BB2025'
      ? ` may select ${num(r.nrOfPlayers)} open players to perform actions.`
      : ` may activate ${num(r.nrOfPlayers)} open players`);
  };
}

function boughtItems(r: Report, withCards: boolean): string {
  const items: string[] = [];
  const add = (count: number, one: string, many: string) => {
    if (count > 0) items.push(count === 1 ? one : many.replace('$1', String(count)));
  };
  if (withCards) add(num(r.nrOfCards), '1 Card', '$1 Cards');
  add(num(r.nrOfInducements), '1 Inducement', '$1 Inducements');
  add(num(r.nrOfStars), '1 Star', '$1 Stars');
  add(num(r.nrOfMercenaries), '1 Mercenary', '$1 Mercenaries');
  return buildEnumeration(items);
}

function inducementsBought(withCards: boolean) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    if (!out.state.inducementsBoughtReportReceived) {
      out.state.inducementsBoughtReportReceived = true;
      out.println(out.getIndent(), 'bold', 'Buy Inducements');
    }
    out.printT(out.getIndent() + 1, 'Team ');
    const team = teamOf(game, r.teamId);
    out.print(out.getIndent() + 1, team.home ? 'home' : 'away', team.name);
    const total = (withCards ? num(r.nrOfCards) : 0) + num(r.nrOfInducements) + num(r.nrOfStars) + num(r.nrOfMercenaries);
    const status = total === 0
      ? ' buys no Inducements.'
      : ` buys ${boughtItems(r, withCards)} for ${formatThousands(num(r.gold))} gold total increasing their Team Value to ${formatThousands(num(r.teamValue))}`;
    out.printlnT(out.getIndent() + 1, status);
  };
}

function cheeringFansTotals(out: UpstreamPrinter, game: GameJson | null, r: Report, home: boolean, mascotLine: boolean): void {
  const temps = inducementValueOf(game, home, 'ADD_CHEERLEADER');
  const team = home ? game?.teamHome : game?.teamAway;
  const roll = num(home ? r.rollHome : r.rollAway);
  out.println(out.getIndent(), 'roll', `Cheering Fans Roll ${home ? 'Home' : 'Away'} Team [ ${roll} ]`);
  const cheerleaders = num(team?.cheerleaders);
  let status = `Rolled ${roll} + ${cheerleaders} Cheerleaders`;
  if (temps > 0) status += ` + ${temps} Temp Agency Cheerleaders`;
  out.printlnT(out.getIndent() + 1, `${status} = ${roll + cheerleaders + temps}.`);
  if (mascotLine && strings(r.teamIdsReRolledCheeringFangs).includes(String(team?.teamId))) {
    out.teamName(false, team?.teamId);
    out.printlnT(out.getIndent() + 1, ' rerolled a natural 1 using their Team Mascot');
  }
}

function inducementValueOf(game: GameJson | null, home: boolean, usage: string): number {
  const set = (home ? game?.turnDataHome : game?.turnDataAway)?.inducementSet;
  const types = tablesOf(game).inducementTypes;
  for (const entry of (set?.inducementArray ?? []) as Record<string, unknown>[]) {
    if (types[String(entry?.inducementType ?? '')]?.usages.includes(usage)) return num(entry.value);
  }
  return 0;
}

function cheeringFans2020(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  cheeringFansTotals(out, game, r, true, false);
  cheeringFansTotals(out, game, r, false, false);
  if (r.teamId == null) {
    out.printlnT(out.getIndent(), 'Neither team gains a Prayer to Nuffle.');
  } else {
    const home = isHomeTeamId(game, r.teamId);
    out.printT(out.getIndent(), 'Team ');
    out.print(out.getIndent(), home ? 'home' : 'away', String((home ? game?.teamHome : game?.teamAway)?.teamName ?? 'null'));
    out.printlnT(out.getIndent(), bool(r.prayerAvailable) ? ' gains a Prayer to Nuffle.' : ' would gain a Prayer to Nuffle but all are in effect.');
  }
}

function cheeringFans2025(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  cheeringFansTotals(out, game, r, true, true);
  cheeringFansTotals(out, game, r, false, true);
  for (const teamId of strings(r.teamIdsAdditionalAssist)) {
    const home = teamId === game?.teamHome?.teamId;
    out.printT(out.getIndent(), 'Team ');
    out.print(out.getIndent(), home ? 'home' : 'away', String((home ? game?.teamHome : game?.teamAway)?.teamName ?? 'null'));
    out.printlnT(out.getIndent(), ' gain an additional offensive assist for the first block action in their next turn.');
  }
}

function chompRemoved(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.player(out.getIndent() + 1, false, playerById(game, r.playerId));
  out.printlnT(out.getIndent() + 1, ` got unchomped ${bool(r.successful) ? 'and is free to move again.' : 'but is still held by another player.'}`);
}

function chompRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Chomp Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, playerById(game, r.attackerId));
  out.printT(out.getIndent() + 1, bool(r.successful) ? ' chomped ' : ' failed to chomp ');
  out.player(out.getIndent() + 1, false, playerById(game, r.defenderId));
  out.printlnT(out.getIndent() + 1, '.');
}

function dodgySnackRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Dodgy Snack Effect Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, playerById(game, r.playerId));
  out.println(out.getIndent() + 1, 'none', num(r.roll) === 1 ? ' is sent to reserves.' : ' suffers -MA and -AV for this drive.');
}

function setupAgain(label: string, oneWording: string) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    out.println(out.getIndent(), 'roll', `${label} Roll [${num(r.roll)}]`);
    const team = teamOf(game, r.teamId);
    out.print(out.getIndent() + 1, team.home ? 'home' : 'away', team.name);
    const amount = num(r.nrOfPlayers);
    if (amount > 1) out.println(out.getIndent() + 1, 'none', ` may select up to ${amount} players to setup again`);
    else if (amount === 1) out.println(out.getIndent() + 1, 'none', oneWording);
    else out.println(out.getIndent() + 1, 'none', ' have no eligible players, moving on to kick-off');
  };
}

function solidDefence2020(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Solid Defence Roll [${num(r.roll)}]`);
  const team = teamOf(game, r.teamId);
  out.print(out.getIndent() + 1, team.home ? 'home' : 'away', team.name);
  out.println(out.getIndent() + 1, 'none', ` may reorganize ${num(r.nrOfPlayers)} players`);
  out.println(out.getIndent() + 2, 'explanation', 'Numbers mark original player positions.');
}

function gettingEvenRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  out.println(out.getIndent(), 'roll', `Getting Even Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, player);
  const ok = bool(r.successful);
  const keyword = String(r.keyword ?? 'null');
  out.printlnT(out.getIndent() + 1, ok ? ` gains hatred towards players of type '${keyword}'.` : ` remains peaceful towards players of type '${keyword}'.`);
  const needed = neededRollText(r, ok);
  if (needed !== null) out.println(out.getIndent() + 1, 'neededRoll', needed);
}

function hypnoticGazeRoll(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const player = actingPlayer(game);
    if (!bool(r.reRolled)) {
      const defender = provided(r.defenderId) ? playerById(game, r.defenderId) : playerById(game, game?.defenderId);
      out.player(out.getIndent(), true, player);
      out.print(out.getIndent(), 'bold', ' gazes upon ');
      out.player(out.getIndent(), true, defender);
      out.println(out.getIndent(), 'bold', ':');
    }
    out.println(out.getIndent() + 1, 'roll', `Hypnotic Gaze Roll [ ${num(r.roll)} ]`);
    out.player(out.getIndent() + 2, false, player);
    const ok = bool(r.successful);
    out.printlnT(out.getIndent() + 2, ok ? ` hypnotizes ${genitive(player)} victim.` : ` fails to affect ${genitive(player)} victim.`);
    let needed = neededRollText(r, ok);
    if (needed !== null) {
      if (rules === 'BB2020') {
        // AgilityMechanic.formatHypnoticGazeResult: the inflictsConfusion skill's value replaces AG when it has one
        const value = skillIntValue(game, player, skillWithProperty(game, player, 'inflictsConfusion'));
        needed += agilityResult(value === 0 ? agilityWithModifiers(player) : value, game, 'GAZE_MODIFIER', r.rollModifiers);
      }
      out.println(out.getIndent() + 2, 'neededRoll', needed);
    }
  };
}

function injuryTypeString(type: string, attacker: PlayerJson | null, defender: PlayerJson | null): string {
  switch (type) {
    case 'ballAndChain': return `${playerName(defender)} is at least knocked out by ${genitive(defender)} own Ball & Chain.`;
    case 'bitten': return `${playerName(attacker)} bites ${playerName(defender)}`;
    case 'crowdpush': case 'crowdpushForSpp': return `${playerName(defender)}  is pushed into the crowd.`;
    case 'ktmCrowd': return `${playerName(defender)} is kicked into the crowd and is knocked out.`;
    case 'stab': case 'stabForSpp': return attacker ? `${playerName(attacker)} stabs ${playerName(defender)}` : `${playerName(defender)} is stabbed`;
    case 'trapdoorFall': return `${playerName(defender)} is injured by the fall.`;
    case 'trapdoorFallForSpp': return `${playerName(defender)}  is injured by the fall.`;
    default: return '';
  }
}

/** SkipInjuryParts (report/logcontrol): which parts an injury report leaves to its twin. */
function skipParts(value: unknown): { armour: boolean; injury: boolean; cas: boolean } {
  switch (value) {
    case 'ARMOUR': return { armour: true, injury: false, cas: false };
    case 'ARMOUR_AND_CAS': return { armour: true, injury: false, cas: true };
    case 'ARMOUR_AND_INJURY': return { armour: true, injury: true, cas: true };
    case 'EVERYTHING_BUT_CAS': return { armour: true, injury: true, cas: false };
    case 'INJURY': return { armour: false, injury: true, cas: true };
    case 'CAS': return { armour: false, injury: false, cas: true };
    default: return { armour: false, injury: false, cas: false };
  }
}

function injury(rules: Rules) {
  const fallback = rules === 'BB2025'
    ? ' but that stat cannot be reduced any further. The result counts as Miss Next Game instead.'
    : ' but that stat cannot be reduced any further. So a different injury has been chosen randomly.';
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const defender = playerById(game, r.defenderId);
    const attacker = playerById(game, r.attackerId);
    const skip = skipParts(r.skipInjuryParts);
    const tables = tablesOf(game);
    const typeString = injuryTypeString(String(r.injuryType ?? ''), attacker, defender);
    if (typeString.length > 0) out.printlnT(out.getIndent() + 1, typeString);

    const armorRoll = ints(r.armorRoll);
    if (armorRoll.length && !skip.armour) {
      out.println(out.getIndent(), 'roll', `Armour Roll [ ${armorRoll[0]} ][ ${armorRoll[1] ?? 0} ]`);
      const rolledTotal = armorRoll[0]! + (armorRoll[1] ?? 0);
      let status = `Rolled Total of ${rolledTotal}`;
      let total = 0;
      const names = strings(r.armorModifiers);
      const rows = names.map((name) => ({ name, row: tables.armourModifiers[name] }));
      const usingClaws = rows.some((m) => !!m.row?.registeredTo && skillHasProperty(game, m.row.registeredTo, 'reducesArmourToFixedValue'));
      const cancelling: string[] = [];
      for (const m of rows) {
        const skill = m.row?.registeredTo;
        if (skill && !cancelling.includes(skill) && ['ignoresArmourModifiersFromSkills', 'ignoresArmourModifiersFromSpecialEffects', 'ignoresArmourModifiersFromFouls']
          .some((p) => skillHasProperty(game, skill, p))) cancelling.push(skill);
      }
      for (const m of rows) {
        const value = !m.row ? 0 : m.row.kind === 'variableAttacker' ? skillIntValue(game, attacker, m.row.registeredTo ?? null) : num(m.row.value);
        if (value !== 0) {
          total += value;
          status += value > 0 ? ' + ' : ' - ';
          if (!m.row?.foulAssist) status += `${Math.abs(value)} `;
          status += m.name;
        }
      }
      if (total !== 0) status += ` = ${rolledTotal + total}`;
      out.printlnT(out.getIndent() + 1, status);
      if (attacker && usingClaws) {
        out.player(out.getIndent() + 1, false, attacker);
        out.printlnT(out.getIndent() + 1, " uses Claws to reduce opponent's armour to 8+.");
      }
      if (defender) {
        if (cancelling.length) {
          out.player(out.getIndent() + 1, false, defender);
          out.printlnT(out.getIndent() + 1, ` ignores armour modifiers due to ${cancelling.join(', ')}`);
        }
        if (bool(r.armorBroken)) {
          out.printT(out.getIndent() + 1, 'The armour of ');
          out.player(out.getIndent() + 1, false, defender);
          out.printlnT(out.getIndent() + 1, ' has been broken.');
        } else {
          out.player(out.getIndent() + 1, false, defender);
          out.printlnT(out.getIndent() + 1, ` has been saved by ${genitive(defender)} armour.`);
        }
      }
    }

    if (!bool(r.armorBroken)) return;
    let thickSkullUsed = false;
    let stuntyUsed = false;
    const injuryRoll = ints(r.injuryRoll);
    if (injuryRoll.length && !skip.injury) {
      out.println(out.getIndent(), 'roll', `Injury Roll [ ${injuryRoll[0]} ][ ${injuryRoll[1] ?? 0} ]`);
      const rolledTotal = injuryRoll[0]! + (injuryRoll[1] ?? 0);
      let status = `Rolled Total of ${rolledTotal}`;
      let total = 0;
      for (const name of strings(r.injuryModifiers)) {
        const row = tables.injuryModifiers[name];
        const value = !row ? 0
          : row.kind === 'variableAttacker' ? skillIntValue(game, attacker, row.registeredTo ?? null)
          : row.kind === 'variableDefender' ? skillIntValue(game, defender, row.registeredTo ?? null)
          : num(row.value);
        total += value;
        if (value === 0) {
          thickSkullUsed ||= !!row?.registeredTo && skillHasProperty(game, row.registeredTo, 'convertKOToStunOn8');
          stuntyUsed ||= !!row?.registeredTo && skillHasProperty(game, row.registeredTo, 'isHurtMoreEasily');
        } else if (value > 0) {
          status += ` + ${value} ${name}`;
        } else {
          status += ` ${value} ${name}`;
        }
      }
      if (total !== 0) status += ` = ${rolledTotal + total}`;
      out.printlnT(out.getIndent() + 1, status);
      if (stuntyUsed) {
        out.player(out.getIndent() + 1, false, defender);
        out.printlnT(out.getIndent() + 1, ' is Stunty and more easily hurt because of that.');
      }
      if (thickSkullUsed && defender) {
        out.player(out.getIndent() + 1, false, defender);
        out.printlnT(out.getIndent() + 1, `'s Thick Skull helps ${dative(defender)} to stay on the pitch.`);
      }
    }

    const reportInjury = (state: unknown, siName: unknown, siRoll: number, originalName: unknown) => {
      out.player(out.getIndent() + 1, false, defender);
      out.printlnT(out.getIndent() + 1, ` ${playerStateDescription(state)}.`);
      const si = seriousInjuryRow(game, siName);
      if (si) {
        if (si.showSiRoll) out.println(out.getIndent(), 'roll', `Lasting Injury Roll [ ${siRoll} ]`);
        const original = seriousInjuryRow(game, originalName);
        if (original) out.println(out.getIndent() + 1, 'explanation', `${playerName(defender)} would have ${original.description}${fallback}`);
        out.player(out.getIndent() + 1, false, defender);
        out.printlnT(out.getIndent() + 1, ` ${si.description}.`);
      }
    };
    const zapped = defender?.playerKind === 'zappedPlayer';
    const casualtyRoll = ints(r.casualtyRoll);
    const casualty = () => {
      if (zapped) {
        out.println(out.getIndent(), 'none', `${playerName(defender)} is badly hurt automatically because ${nominative(defender)} has been zapped.`);
      } else {
        out.println(out.getIndent(), 'roll', `Casualty Roll [ ${casualtyRoll[0]} ]`);
        casualtyModifierLine(r, out, game, casualtyRoll[0]!);
        reportInjury(r.injury, r.seriousInjury, casualtyRoll[1] ?? 0, r.seriousInjuryOld);
      }
    };
    if (rules === 'BB2025') {
      if (casualtyRoll.length) {
        if (!skip.injury) {
          out.player(out.getIndent() + 1, false, defender);
          out.printlnT(out.getIndent() + 1, ' suffers a casualty.');
        }
        if (!skip.cas) casualty();
      } else if (r.injury != null && !skip.injury) {
        reportInjury(r.injury, null, 0, null);
      }
    } else if (casualtyRoll.length && !skip.cas) {
      out.player(out.getIndent() + 1, false, defender);
      out.printlnT(out.getIndent() + 1, ' suffers a casualty.');
      casualty();
    } else if (r.injury != null && !skip.injury) {
      reportInjury(r.injury, null, 0, null);
    }
  };
}

function kickTeamMateFumble(rules: Rules) {
  return (_r: Report, out: UpstreamPrinter): void => {
    out.println(out.getIndent() + 2, 'explanation', rules === 'BB2025'
      ? 'Fumbled Kick Team-Mate always causes at least a KO.'
      : 'Fumbled Kick Team-Mate always removes kicked player and causes at least a KO.');
  };
}

function kickoffDodgySnack(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Dodgy Snack Roll Home Team [ ${num(r.rollHome)} ]`);
  out.println(out.getIndent(), 'roll', `Dodgy Snack Roll Away Team [ ${num(r.rollAway)} ]`);
  for (const id of strings(r.playerIds)) {
    out.player(out.getIndent() + 1, false, playerById(game, id));
    out.printlnT(out.getIndent() + 1, ' had a dodgy snack.');
  }
}

function extraReRoll(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    for (const home of [true, false]) {
      const team = home ? game?.teamHome : game?.teamAway;
      const part = inducementValueOf(game, home, 'ADD_COACH');
      const banned = rules === 'BB2020' && (home ? game?.turnDataHome : game?.turnDataAway)?.coachBanned === true;
      const roll = num(home ? r.rollHome : r.rollAway);
      out.println(out.getIndent(), 'roll', `Brilliant Coaching Roll ${home ? 'Home' : 'Away'} Team [ ${roll} ]`);
      const coaches = num(team?.assistantCoaches);
      let status = `Rolled ${roll} + ${coaches} Assistant Coaches`;
      if (part > 0) status += ` + ${part} Part-time Assistant Coaches`;
      if (rules === 'BB2020') status += ` ${banned ? '- 1 Banned' : ' + 0 Head'} Coach`;
      out.printlnT(out.getIndent() + 1, `${status} = ${roll + coaches - (banned ? 1 : 0) + part}.`);
    }
    if (r.teamId == null) {
      out.printlnT(out.getIndent(), rules === 'BB2025' ? 'Both teams gain a Re-Roll only available for this drive.' : 'Neither team gains a Re-Roll.');
    } else {
      const home = r.teamId === game?.teamHome?.teamId;
      out.printT(out.getIndent(), 'Team ');
      out.print(out.getIndent(), home ? 'home' : 'away', String((home ? game?.teamHome : game?.teamAway)?.teamName ?? 'null'));
      out.printlnT(out.getIndent(), ' gains a Re-Roll only available for this drive.');
    }
  };
}

function kickoffOfficiousRef(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  for (const home of [true, false]) {
    const roll = num(home ? r.rollHome : r.rollAway);
    const fans = num((home ? game?.gameResult?.teamResultHome : game?.gameResult?.teamResultAway)?.fanFactor);
    out.println(out.getIndent(), 'roll', `Officious Ref Roll ${home ? 'Home' : 'Away'} Team [ ${roll} ]`);
    out.printlnT(out.getIndent() + 1, `Rolled ${roll} + ${fans} Fan Factor = ${roll + fans}.`);
  }
  for (const id of strings(r.playerIdsHit)) {
    out.player(out.getIndent() + 1, false, playerById(game, id));
    out.printlnT(out.getIndent() + 1, ' gets into an argument with the ref.');
  }
}

function officiousRefRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Officious Ref Effect Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, playerById(game, r.playerId));
  out.println(out.getIndent() + 1, 'none', num(r.roll) === 1 ? ' is sent off.' : ' is stunned');
}

function mascotUsed(r: Report, out: UpstreamPrinter): void {
  out.println(out.getIndent(), 'roll', `Mascot Roll [ ${num(r.roll)} ]`);
  out.teamName(false, r.teamId);
  const ok = bool(r.successful);
  out.printlnT(out.getIndent(), ` used their Team Mascot${ok ? ' successfully.' : bool(r.reRollUsed) ? ' but it failed so they used a regular re-roll instead.' : ' but it failed.'}`);
  if (!ok) out.println(out.getIndent() + 1, 'none', `(Roll >= ${num(r.minimumRoll)} to succeed)`);
}

function teamCaptainRoll(r: Report, out: UpstreamPrinter): void {
  out.println(out.getIndent(), 'roll', `Team Captain Roll [ ${num(r.roll)} ]`);
  out.teamName(false, r.teamId);
  const ok = bool(r.successful);
  out.printlnT(out.getIndent(), ` look to their Team Captain for guidance${ok ? ' and save the re-roll.' : ' but nothing happens.'}`);
  if (!ok) out.println(out.getIndent() + 1, 'none', `(Roll >= ${num(r.minimumRoll)} to succeed)`);
}

function passRoll(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const thrower = playerById(game, r.playerId);
    const bomb = bool(r.bomb);
    const hailMary = bool(r.hailMaryPass);
    if (!bool(r.reRolled)) {
      out.player(out.getIndent(), true, thrower);
      const catcher = playerAtPass(game);
      if (hailMary) {
        out.println(out.getIndent(), 'bold', bomb ? ' throws a Hail Mary bomb:' : ' throws a Hail Mary pass:');
      } else if (catcher) {
        out.print(out.getIndent(), 'bold', bomb ? ' throws a bomb at ' : ' passes the ball to ');
        out.player(out.getIndent(), true, catcher);
        out.println(out.getIndent(), 'bold', ':');
      } else {
        out.println(out.getIndent(), 'bold', bomb ? ' throws a bomb to an empty field:' : ' passes the ball to an empty field:');
      }
    }
    if (strings(r.rollModifiers).includes('Nerves of Steel')) {
      // statusReport.report(new ReportNervesOfSteel(actingPlayer, ...)) renders the Nerves of Steel line inline
      const player = actingPlayer(game);
      if (player) {
        out.player(out.getIndent(), false, player);
        out.printT(out.getIndent(), ' is using Nerves of Steel to ');
        out.printlnT(out.getIndent(), bomb ? 'throw the bomb.' : 'pass the ball.');
      }
    }
    const passing = passingWithModifiers(thrower);
    out.println(out.getIndent() + 1, 'roll', passing > 0 ? `Pass Roll [ ${num(r.roll)} ]` : `Pass fumbled automatically as ${playerName(thrower)} has no Passing Ability`);
    out.player(out.getIndent() + 2, false, thrower);
    const result = String(r.passResult ?? '');
    let success = false;
    if (result === 'ACCURATE' || (result === 'INACCURATE' && hailMary)) {
      out.printlnT(out.getIndent() + 2, bomb ? ' throws the bomb successfully.' : ' passes the ball.');
      success = true;
    } else if (rules === 'BB2025') {
      if (result === 'SAVED_FUMBLE' || result === 'FUMBLE') out.printlnT(out.getIndent() + 2, bomb ? ' fumbles the bomb.' : ' fumbles the ball.');
      else out.printlnT(out.getIndent() + 2, ' misses the throw.');
    } else if (result === 'SAVED_FUMBLE') {
      out.printlnT(out.getIndent() + 2, bomb ? ' holds on to the bomb and puts out the fuse.' : ' holds on to the ball.');
    } else if (result === 'FUMBLE') {
      out.printlnT(out.getIndent() + 2, bomb ? ' fumbles the bomb.' : ' fumbles the ball.');
    } else if (result === 'WILDLY_INACCURATE') {
      out.printlnT(out.getIndent() + 2, ' lets the throw deviate.');
    } else {
      out.printlnT(out.getIndent() + 2, ' misses the throw.');
    }
    let needed = neededRollText(r, success);
    if (needed !== null) {
      let formatted = formatRollModifiersByName(rollModifierRows(game, 'PASS_MODIFIER', r.rollModifiers));
      const stat = r.statBasedRollModifier as { name?: unknown; value?: unknown } | null | undefined;
      if (stat && typeof stat === 'object') formatted += ` + ${num(stat.value)} ${String(stat.name ?? 'null')}`;
      if (passing > 0) {
        const distance = String(r.passingDistance ?? 'null');
        needed += ` (Roll - ${PASSING_DISTANCE_2020[distance] ?? 0} ${distance}${formatted} >= PA ${passing}+).`;
      }
      out.println(out.getIndent() + 2, 'neededRoll', needed);
    }
  };
}

function playerAtPass(game: GameJson | null): PlayerJson | null {
  const c = game?.passCoordinate;
  if (!Array.isArray(c)) return null;
  const data = game?.fieldModel?.playerDataArray?.find((d) => Array.isArray(d.playerCoordinate) && d.playerCoordinate[0] === c[0] && d.playerCoordinate[1] === c[1]);
  return data ? playerById(game, data.playerId) : null;
}

function prayerAmount(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    out.println(out.getIndent(), 'bold', 'Praying to Nuffle');
    const tv = (value: number) => ` has a TV of ${formatThousands(value)} after buying inducements.`;
    out.print(out.getIndent() + 1, 'homeBold', String(game?.teamHome?.teamName ?? 'null'));
    out.println(out.getIndent() + 1, 'none', tv(num(r.teamValue)));
    out.print(out.getIndent() + 1, 'awayBold', String(game?.teamAway?.teamName ?? 'null'));
    out.println(out.getIndent() + 1, 'none', tv(num(r.opponentTeamValue)));
    if (bool(r.homeTeam)) out.print(out.getIndent() + 2, 'home', String(game?.teamHome?.teamName ?? 'null'));
    else out.print(out.getIndent() + 2, 'away', String(game?.teamAway?.teamName ?? 'null'));
    const amount = num(r.number);
    out.println(out.getIndent() + 2, 'explanation', ` is granted ${amount}${rules === 'BB2025' ? ' additional' : ''} ${amount === 1 ? 'Prayer' : 'Prayers'} to Nuffle`);
  };
}

function prayerRoll(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const prayer = tablesOf(game).prayers[String(num(r.roll))];
    if (rules === 'BB2025') {
      out.print(out.getIndent(), 'roll', `Prayer Roll [ ${num(r.roll)} ] for `);
      out.println(out.getIndent(), bool(r.homeTeam) ? 'homeBold' : 'awayBold', String(r.teamName ?? 'null'));
    } else {
      out.println(out.getIndent(), 'roll', `Prayer Roll [ ${num(r.roll)} ]`);
    }
    out.println(out.getIndent() + 1, 'bold', prayer?.name ?? 'null');
    out.println(out.getIndent() + 2, 'explanation', `${prayer?.duration ?? 'null'}: ${prayer?.description ?? 'null'}`);
  };
}

function puntDirection(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  if (r.direction != null) {
    const direction = directionName(r.direction);
    out.println(out.getIndent(), 'roll', `Punt Direction Roll [ ${num(r.directionRoll)} ] ${direction}`);
    out.player(out.getIndent() + 1, false, playerById(game, r.playerId));
    out.printlnT(out.getIndent() + 1, ` punts the ball ${direction}${bool(r.outOfBounds) ? ' putting it out of bounds' : ''}.`);
  } else {
    out.player(out.getIndent() + 1, false, playerById(game, r.playerId));
    out.printlnT(out.getIndent() + 1, ' intentionally punts the ball out of bounds.');
  }
}

function puntDistance(r: Report, out: UpstreamPrinter): void {
  const roll = num(r.roll);
  if (roll <= 0) return;
  out.println(out.getIndent(), 'roll', `Punt Distance Roll [ ${roll} ]`);
  out.printlnT(out.getIndent() + 1, `The ball is punted ${roll} squares${bool(r.outOfBounds) ? ' putting it out of bounds' : ''}`);
}

function raiseDead(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const raised = playerById(game, r.playerId);
    out.player(out.getIndent(), false, raised);
    out.printT(out.getIndent(), bool(r.nurglesRot) ? ' is now Plague Ridden and will join team ' : ' is raised from the dead to join team ');
    const home = !!raised && !!game?.teamHome?.playerArray?.some((p) => p.playerId === raised.playerId);
    const team = home ? game?.teamHome : game?.teamAway;
    out.print(out.getIndent(), home ? 'home' : 'away', String(team?.teamName ?? 'null'));
    let position: string;
    if (rules === 'BB2025') {
      position = String(r.positionName ?? 'null');
    } else {
      position = bool(r.nurglesRot) ? 'Rotter' : 'Zombie';
      const roster = (team?.roster ?? {}) as { raisedPositionId?: unknown; positionArray?: { positionId?: unknown; positionName?: unknown; displayName?: unknown }[] };
      const raisedPosition = roster.positionArray?.find((p) => p.positionId === roster.raisedPositionId);
      if (raisedPosition) position = provided(raisedPosition.displayName) ? raisedPosition.displayName : String(raisedPosition.positionName ?? 'null');
    }
    out.println(out.getIndent(), 'none', ` as a ${position}.`);
  };
}

function saboteurRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  out.println(out.getIndent(), 'roll', `Saboteur Roll [ ${num(r.roll)} ]`);
  out.player(out.getIndent() + 1, false, playerById(game, r.playerId));
  out.println(out.getIndent() + 1, 'none', bool(r.successful)
    ? " sabotages their weapon! They are KO'd and the blocker is knocked down."
    : ' fails to detonate the weapon.');
}

function stallerDetected(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    out.println(out.getIndent(), 'bold', 'Stalling Detection');
    if (rules === 'BB2025' || provided(r.playerId)) out.player(out.getIndent() + 1, true, playerById(game, r.playerId));
    else out.print(out.getIndent() + 1, 'none', 'Nobody');
    out.println(out.getIndent() + 1, 'none', rules === 'BB2025' ? ' could stall' : ' is stalling');
  };
}

function steadyFootingRoll(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  out.println(out.getIndent(), 'roll', num(r.roll) > 0 ? `Steady Footing Roll [ ${num(r.roll)} ]` : 'New Steady Footing Result');
  out.player(out.getIndent() + 1, false, player);
  const ok = bool(r.successful);
  out.printlnT(out.getIndent() + 1, ok ? ` stays on ${genitive(player)}  feet.` : ' fails to keep standing.');
  const needed = neededRollText(r, ok);
  if (needed !== null) out.println(out.getIndent() + 1, 'neededRoll', needed);
}

function swarming2020(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const team = teamOf(game, r.teamId);
  const style = team.home ? 'homeBold' : 'awayBold';
  const limit = typeof r.swarmingPlayerLimit === 'number' ? r.swarmingPlayerLimit : 0;
  const amount = num(r.swarmingPlayerAmount);
  if (limit < 0) {
    out.println(0, 'roll', `Swarming Roll [${amount}]`);
    out.print(1, style, team.name);
    out.println(1, 'none', ` are allowed to place ${amount} swarming players.`);
    return;
  }
  out.println(0, 'roll', `Swarming Roll [${num(r.swarmingPlayerRoll)}]`);
  out.print(1, style, team.name);
  out.println(1, 'none', ` have ${limit} swarming players on the pitch.`);
  out.println(1, 'none', amount === 0 ? 'They are not allowed to place any swarming players.' : `They are allowed to place ${amount} swarming players.`);
}

function swarming2025(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const team = teamOf(game, r.teamId);
  out.println(0, 'roll', `Swarming Roll [${num(r.swarmingPlayerRoll)}]`);
  out.print(1, team.home ? 'homeBold' : 'awayBold', team.name);
  out.println(1, 'none', ` are allowed to place ${num(r.swarmingPlayerRoll)} swarming players.`);
}

function swoopDirection(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  const direction = directionName(r.direction);
  out.println(out.getIndent(), 'roll', `Swoop Direction Roll [ ${num(r.directionRoll)} ] ${direction}`);
  out.player(out.getIndent() + 1, false, player);
  out.printlnT(out.getIndent() + 1, ` swoops ${direction}${bool(r.outOfBounds) ? ` which takes ${dative(player)} out of bounds` : ''}.`);
}

function swoopPlayer(rules: Rules) {
  return (r: Report, out: UpstreamPrinter): void => {
    out.println(out.getIndent(), 'roll', `Swoop Roll [ ${num(r.distance)} ] in direction ${directionName(r.scatterDirection)}`);
    const start = ints(r.startCoordinate);
    const end = ints(r.endCoordinate);
    let status = `Player swoops from square (${start[0]},${start[1]}`;
    if (rules === 'BB2025' && bool(r.outOfBounds)) status += ') into the fans';
    else status += `) to square (${end[0]},${end[1]}`;
    out.printlnT(out.getIndent() + 1, `${status}).`);
  };
}

function teamEvent(r: Report, out: UpstreamPrinter): void {
  out.teamName(false, r.teamId);
  out.println(out.getIndent() + 1, 'none', ` ${String(r.message ?? 'null')}`);
}

function tentaclesShadowing(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const acting = actingPlayer(game);
    const defender = playerById(game, r.defenderId);
    const skill = canonicalSkill(game, r.skill);
    if (!skill) return; // upstream: getSkill().hasSkillProperty throws before printing
    const shadow = skillHasProperty(game, skill, 'canFollowPlayerLeavingTacklezones');
    const hold = skillHasProperty(game, skill, 'canHoldPlayersLeavingTacklezones');
    const reRolled = bool(r.reRolled);
    if (!reRolled) {
      if (shadow) {
        out.player(out.getIndent(), true, defender);
        out.print(out.getIndent(), 'bold', ' tries to shadow ');
        out.player(out.getIndent(), true, acting);
        out.println(out.getIndent(), 'bold', ':');
      }
      if (hold) {
        out.player(out.getIndent(), true, defender);
        out.print(out.getIndent(), 'bold', ' tries to hold ');
        out.player(out.getIndent(), true, acting);
        out.println(out.getIndent(), 'bold', ` with ${genitive(defender)} tentacles:`);
      }
    }
    const ok = bool(r.successful);
    let needed: string | null = null;
    if (shadow) {
      out.println(out.getIndent() + 1, 'roll', `Shadowing Roll [ ${num(r.roll)} ]`);
      out.player(out.getIndent() + 2, false, defender);
      out.printlnT(out.getIndent() + 2, ok ? ` shadows ${genitive(defender)} opponent successfully.` : ` fails to shadow ${genitive(defender)} opponent.`);
      needed = neededRollText(r, ok);
      if (needed !== null) {
        if (rules === 'BB2020') needed += ` (Roll + MA ${movementWithModifiers(defender)} - MA ${movementWithModifiers(acting)} >= 6).`;
        out.println(out.getIndent() + 2, 'neededRoll', needed);
      }
    }
    if (hold) {
      out.println(out.getIndent() + 1, 'roll', `Tentacles Roll [ ${num(r.roll)} ]`);
      out.player(out.getIndent() + 2, false, defender);
      out.printlnT(out.getIndent() + 2, ok ? ` holds ${genitive(defender)} opponent successfully.` : ` failed to hold ${genitive(defender)} opponent.`);
      const own = neededRollText(r, ok);
      // upstream reuses the shadow block's builder variable; a fresh one is only made when the roll was not rerolled
      needed = own ?? needed;
      if (needed !== null) {
        needed += ` (Roll + ST ${strengthWithModifiers(defender)} - ST ${strengthWithModifiers(acting)} >= 6).`;
        out.println(out.getIndent() + 2, 'neededRoll', needed);
      }
    }
  };
}

function thenIStartedBlastin(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    if (num(r.roll) > 0) {
      out.println(out.getIndent(), 'roll', rules === 'BB2025'
        ? `"Blastin' Solves Everything" Roll [ ${num(r.roll)} ]`
        : `"Then I Started Blastin'!" Roll [ ${num(r.roll)} ]`);
    }
    const thrower = playerById(game, r.playerId);
    out.player(out.getIndent(), false, thrower);
    if (provided(r.targetPlayerId)) {
      out.print(out.getIndent(), 'none', ' hits ');
      if (bool(r.fumble)) out.print(out.getIndent(), 'none', self(thrower));
      else if (bool(r.successful)) out.player(out.getIndent(), false, playerById(game, r.targetPlayerId));
      else out.print(out.getIndent(), 'none', 'a player chosen by the opposing coach');
    } else {
      out.print(out.getIndent(), 'none', " starts blastin' ");
    }
    out.println(out.getIndent(), 'none', '.');
  };
}

function throwAtPlayer(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const player = playerById(game, r.playerId);
  out.println(out.getIndent(), 'roll', `Throw a Rock Roll [ ${num(r.roll)} ]`);
  out.printT(out.getIndent() + 1, 'Fans throw a rock at ');
  out.player(out.getIndent() + 1, true, player);
  out.printlnT(out.getIndent() + 1, bool(r.successful) ? ` knocking ${dative(player)} down.` : ` but miss ${dative(player)}.`);
}

function throwAtStallingPlayer(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    if (rules === 'BB2025' && num(r.roll) <= 0) {
      out.player(out.getIndent() + 1, true, playerById(game, r.playerId));
      out.printlnT(out.getIndent() + 1, ' stalled but the crowd can not be bothered.');
      return;
    }
    out.println(out.getIndent(), 'roll', `Throw a Rock Roll [ ${num(r.roll)} ]`);
    out.player(out.getIndent() + 1, true, playerById(game, r.playerId));
    out.printlnT(out.getIndent() + 1, bool(r.successful) ? ' is hit by a rock.' : ' is not punished for stalling.');
  };
}

function throwTeamMateRoll(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const thrower = actingPlayer(game);
    const thrown = playerById(game, r.thrownPlayerId);
    const canThrow = num(thrower?.passing) > 0;
    const kick = bool(r.kicked);
    if (!bool(r.reRolled)) {
      out.player(out.getIndent(), true, thrower);
      out.print(out.getIndent(), 'bold', kick ? ' tries to kick ' : ' tries to throw ');
      out.player(out.getIndent(), true, thrown);
      out.println(out.getIndent(), 'bold', ':');
    }
    out.println(out.getIndent() + 1, 'roll', `${kick ? 'Kick Team-Mate' : 'Throw Team-Mate'} Roll [ ${num(r.roll)} ]`);
    out.player(out.getIndent() + 2, false, thrower);
    const ok = bool(r.successful);
    if (ok) {
      out.printT(out.getIndent() + 2, kick ? ' kicks ' : ' throws ');
      out.player(out.getIndent() + 2, false, thrown);
      out.printlnT(out.getIndent() + 2, ` ${r.passResult === 'ACCURATE' ? 'superbly' : rules === 'BB2025' ? 'with a subpar result' : 'successfully'}.`);
    } else if (rules === 'BB2020' && r.passResult === 'WILDLY_INACCURATE') {
      out.printT(out.getIndent() + 2, ' lets ');
      out.player(out.getIndent() + 2, false, thrown);
      out.printlnT(out.getIndent() + 2, ' deviate.');
    } else {
      out.printT(out.getIndent() + 2, ' fumbles ');
      out.player(out.getIndent() + 2, false, thrown);
      out.printlnT(out.getIndent() + 2, '.');
    }
    let needed: string | null = null;
    const min = num(r.minimumRoll);
    if (ok && !bool(r.reRolled) && canThrow) {
      needed = `Succeeded on a roll of ${min}${rules === 'BB2025'
        ? (kick ? '+ to avoid a Fumbled Kick' : '+ to avoid a Fumbled Throw')
        : (kick ? '+ to avoid a fumble or terrible kick' : '+ to avoid a fumble or terrible throw')}`;
    }
    if (!ok && !bool(r.reRolled) && canThrow) {
      needed = `Roll a ${min}${rules === 'BB2025'
        ? (kick ? '+ to make at least a Subpar Kick' : '+ to make at least a Subpar Throw')
        : (kick ? '+ to have at least a successful kick' : '+ to have at least a successful throw')}`;
    }
    if (needed !== null) {
      const distance = String(r.passingDistance ?? 'null');
      needed += ` (Roll  - ${PASSING_DISTANCE_2020[distance] ?? 0} ${distance}${formatRollModifiersByName(rollModifierRows(game, 'PASS_MODIFIER', r.rollModifiers))} > 1).`;
      out.println(out.getIndent() + 2, 'neededRoll', needed);
    }
    out.setIndent(out.getIndent() + 1);
  };
}

function turnEnd(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    out.setIndent(0);
    const scorer = playerById(game, r.playerIdTouchdown);
    if (scorer) {
      out.player(out.getIndent(), true, scorer);
      out.println(out.getIndent() + 1, 'bold', ' scores a touchdown.');
    }
    const recoveries = Array.isArray(r.knockoutRecoveryArray) ? (r.knockoutRecoveryArray as Report[]) : [];
    for (const recovery of recoveries) {
      let status = `Knockout Recovery Roll [ ${num(recovery.roll)} ] `;
      const kegs = num(recovery.bloodweiserBabes);
      if (kegs > 0) status += rules === 'BB2025' ? ` + ${kegs}  Blitzer's Best Kegs` : ` + ${kegs} Bloodweiser Kegs`;
      if (rules === 'BB2025' && num(recovery.bugmansXXXXXXModifier) > 0) status += " + Bugman's XXXXXX";
      out.println(out.getIndent(), 'roll', status);
      out.player(out.getIndent() + 1, false, playerById(game, recovery.playerId));
      out.printlnT(out.getIndent() + 1, bool(recovery.recovering) ? ' is regaining consciousness.' : ' stays unconscious.');
      if (provided(recovery.reason)) out.println(out.getIndent() + 2, 'explanation', `Recovery is re-rolled using ${recovery.reason}`);
    }
    const heat = Array.isArray(r.heatExhaustionArray) ? (r.heatExhaustionArray as Report[]) : [];
    if (heat.length) {
      out.println(out.getIndent(), 'roll', `Heat Exhaustion Roll [ ${num(r.heatRoll)} ] `);
      for (const entry of heat) {
        out.player(out.getIndent() + 1, false, playerById(game, entry.playerId));
        out.printlnT(out.getIndent() + 1, bool(entry.exhausted) ? ' is suffering from heat exhaustion.' : ' is unaffected.');
      }
    }
    if (Array.isArray(r.unzapArray)) {
      for (const entry of r.unzapArray as Report[]) {
        const player = playerById(game, entry?.playerId) ?? (entry as unknown as PlayerJson);
        out.player(out.getIndent(), true, player);
        out.printlnT(out.getIndent(), ' recovers from Zap! spell effect.');
      }
    }
    if (game?.turnMode === 'regular') {
      if (game.homePlaying) out.println('spaceAboveBelow', 'turnHome', `${String(game.teamHome?.teamName ?? 'null')} start turn ${num(game.turnDataHome?.turnNr)}.`);
      else out.println('spaceAboveBelow', 'turnAway', `${String(game.teamAway?.teamName ?? 'null')} start turn ${num(game.turnDataAway?.turnNr)}.`);
    }
  };
}

function twoForOne(r: Report, out: UpstreamPrinter, game: GameJson | null): void {
  const indent = out.getIndent();
  const used = bool(r.used);
  out.player(indent, false, playerById(game, r.playerId));
  out.print(indent, 'none', ` ${used ? 'gains' : 'loses'} Loner (2+) because `);
  out.player(indent, false, playerById(game, r.partnerId));
  out.println(indent, 'none', ` ${used ? 'is injured' : 'has recovered'}.`);
}

function fumblerooskie(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    out.player(out.getIndent(), false, playerById(game, r.playerId));
    out.println(out.getIndent(), 'none', bool(r.used)
      ? ` will drop the ball using ${rules === 'BB2025' ? 'Fumblerooski' : 'Fumblerooskie'} once he moves from the current square.`
      : ' did not vacate the square and thus keeps the ball.');
  };
}

function weatherMageResult(rules: Rules) {
  return (r: Report, out: UpstreamPrinter, game: GameJson | null): void => {
    const changed = () => {
      const name = String(r.weather ?? 'null');
      if (rules === 'BB2025') {
        out.println(out.getIndent() + 1, 'none', `The weather is changed to ${name}`);
      } else {
        out.println(out.getIndent() + 1, 'none',
          `The weather is changed to ${name}. It will return to ${String(r.oldWeather ?? 'null')} at the end of your ${game?.homePlaying ? "opponent's " : ''}turn or the end of the drive`);
      }
      out.println(out.getIndent() + 1, 'explanation', tablesOf(game).weather[name] ?? 'No weather at all, but the intro screen shown by the client.');
    };
    if (r.effect === 'NO_CHANGE') {
      out.println(out.getIndent() + 1, 'none', 'The mage fails to influence the weather enough to cause any changes');
    } else if (r.effect === 'CHANGED') {
      changed();
    } else {
      out.println(out.getIndent() + 1, 'explanation', 'There was only one option');
      changed();
    }
  };
}

const both = <T>(make: (rules: Rules) => T): { BB2020: T; BB2025: T } => ({ BB2020: make('BB2020'), BB2025: make('BB2025') });

export const RULES_MESSAGES: Record<string, UpstreamRendererSet> = {
  animalSavagery: both(animalSavagery),
  apothecaryRoll: both(apothecaryRoll),
  blitzRoll: both(blitzRoll),
  cardsAndInducementsBought: { BB2020: inducementsBought(true) },
  prayersAndInducementsBought: { BB2025: inducementsBought(false) },
  cheeringFans: { BB2020: cheeringFans2020, BB2025: cheeringFans2025 },
  chompRemoved: { BB2025: chompRemoved },
  chompRoll: { BB2025: chompRoll },
  dodgySnackRoll: { BB2025: dodgySnackRoll },
  dwarfenWisdomRoll: { BB2025: setupAgain('Dwarfen Wisdom', ' may select 1 player to setup again') },
  gettingEvenRoll: { BB2025: gettingEvenRoll },
  hypnoticGazeRoll: both(hypnoticGazeRoll),
  injury: both(injury),
  kickTeamMateFumble: both(kickTeamMateFumble),
  kickoffDodgySnack: { BB2025: kickoffDodgySnack },
  extraReRoll: both(extraReRoll),
  kickoffOfficiousRef: { BB2020: kickoffOfficiousRef },
  officiousRefRoll: { BB2020: officiousRefRoll },
  mascotUsed: { BB2025: mascotUsed },
  passRoll: both(passRoll),
  prayerAmount: both(prayerAmount),
  prayerRoll: both(prayerRoll),
  puntDirectionRoll: { BB2025: puntDirection },
  puntDistanceRoll: { BB2025: puntDistance },
  raiseDead: both(raiseDead),
  saboteurRoll: { BB2025: saboteurRoll },
  solidDefenceRoll: { BB2020: solidDefence2020, BB2025: setupAgain('Solid Defence', ' may select 1 player to setup again') },
  stallerDetected: both(stallerDetected),
  steadyFootingRoll: { BB2025: steadyFootingRoll },
  swarmingPlayersRoll: { BB2020: swarming2020, BB2025: swarming2025 },
  swoopDirectionRoll: { BB2025: swoopDirection },
  swoopPlayer: both(swoopPlayer),
  teamCaptainRoll: { BB2025: teamCaptainRoll },
  teamEvent: { BB2025: teamEvent },
  tentaclesShadowingRoll: both(tentaclesShadowing),
  thenIStartedBlastin: both(thenIStartedBlastin),
  throwAtPlayer: { BB2025: throwAtPlayer },
  throwAtStallingPlayer: both(throwAtStallingPlayer),
  throwTeamMateRoll: both(throwTeamMateRoll),
  turnEnd: both(turnEnd),
  twoForOne: { BB2020: twoForOne },
  fumblerooskie: both(fumblerooskie),
  weatherMageResult: both(weatherMageResult),
};
