/**
 * Shapes of the upstream data the FUMBBL log style reads (tables.generated.ts, dumped by the upstream Java code:
 * scripts/generate-upstream-log-tables.mjs). Every map is keyed by the WIRE name the server sends.
 */

export interface UpstreamSkillRow {
  /** NamedProperties field names of the skill's properties. */
  props: string[];
  /** NamedProperties field names this skill cancels (CancelSkillProperty). */
  cancels: string[];
  /** Skill.getConfusionMessage(). */
  confusion: string;
  defaultValue: number;
  /** SkillValueEvaluator: DEFAULT (always the default value), MODIFIER (highest value), ROLL (lowest value). */
  evaluator: string;
}

export interface UpstreamRollModifierRow {
  modifier: number;
  included: boolean;
  reportString: string;
  /** DodgeModifier.isUseStrength (Break Tackle). */
  useStrength?: boolean;
}

export interface UpstreamArmourModifierRow {
  kind: 'static' | 'variableAttacker';
  value?: number;
  foulAssist: boolean;
  registeredTo?: string;
}

export interface UpstreamInjuryModifierRow {
  kind: 'static' | 'variableAttacker' | 'variableDefender' | 'variableOther';
  value?: number;
  niggling: boolean;
  registeredTo?: string;
}

export interface UpstreamRulesTables {
  skills: Record<string, UpstreamSkillRow>;
  /** By factory (DODGE_MODIFIER, CATCH_MODIFIER, ...), then modifier name. */
  rollModifiers: Record<string, Record<string, UpstreamRollModifierRow>>;
  armourModifiers: Record<string, UpstreamArmourModifierRow>;
  injuryModifiers: Record<string, UpstreamInjuryModifierRow>;
  casualtyModifiers: Record<string, { modifier: number; reportString: string }>;
  seriousInjuries: Record<string, { description: string; showSiRoll: boolean }>;
  /** Kick-off result name -> description. */
  kickoffResults: Record<string, string>;
  /** Weather name -> GameMechanic.weatherDescription. */
  weather: Record<string, string>;
  /** Prayer roll -> prayer. */
  prayers: Record<string, { name: string; duration: string; description: string }>;
  /** Prayer name -> description. */
  prayerDescriptions: Record<string, string>;
  /** Block die face -> BlockResult name. */
  blockResults: Record<string, string>;
  /** Reroll source wire name -> ReRollSource.getName(game). */
  reRollSources: Record<string, string>;
  inducementTypes: Record<string, { description: string | null; usages: string[] }>;
}

export interface UpstreamLogTables {
  BB2020: UpstreamRulesTables;
  BB2025: UpstreamRulesTables;
  COMMON: {
    /** SkillUse name -> description template (%g = the player's genitive). */
    skillUses: Record<string, string>;
    /** PlayerAction name -> description (only actions upstream describes). */
    playerActions: Record<string, string>;
    genders: Record<string, { nominative: string; genitive: string; dative: string; self: string; plural: boolean }>;
    /** PlayerState base -> PlayerState.getDescription(). */
    playerStateDescriptions: Record<string, string>;
  };
}
