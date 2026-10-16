// Owner 10-15: the "i" in the Dice pane's top-right corner explains, in a few plain sentences, how the "expected"
// figures are worked out. Each line below states exactly what game/diceStats.ts adds up for that figure; the test
// (test/diceExpectedHelp.test.ts) recomputes the quoted numbers with the same helpers so the wording cannot drift.

/** The tooltip / accessible name of the button. */
export const DICE_EXPECTED_HELP_LABEL = 'How expected results are calculated';

/** One sentence per figure. */
export const DICE_EXPECTED_HELP: readonly { key: 'rolls' | 'armour' | 'injury' | 'block'; text: string }[] = [
  // diceLuck.actionTrial: a stated target t is held to 2..6 and the chance is (7 - t) / 6; a 3+ is 4/6
  { key: 'rolls', text: 'Rolls: each roll adds its chance to pass. A 3+ counts 4/6.' },
  // diceStats armour: twoD6AtLeast(threshold) / 36, AV 9 -> 2D6 of 9 or more -> 10 of 36
  { key: 'armour', text: 'Armour: the chance 2D6 breaks it, for example 10 of 36 against AV 9+.' },
  // diceLuck.koWeight6 / injuryScore6: stunned 0, KO 3/6 without kegs, casualty 1
  { key: 'injury', text: 'Injury: the average result, with stunned as 0, a KO as half or less and a casualty as 1.' },
  // diceStats settleBlockRollLuck: the chance of a good (or bad) result given the dice count and who picks
  { key: 'block', text: 'Block: the chance of a good or bad result, given the dice and who picks.' },
];
