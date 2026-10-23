import { englishTermForId } from '../i18n/terms';

/**
 * Roster / race ids (sprite sheets, asset-pack targets: `blackorc`, `race:elvenunion`) are DATA. Their display name is
 * the canonical English roster name from the term dictionaries (`Black Orc`), shown through terms() so it follows the
 * language. A few rosters only the asset-target list knows have no term; they keep their English proper name here
 * (never the bare id).
 */
const NO_TERM_ROSTER_NAMES: Readonly<Record<string, string>> = {
  albionfae: 'Albion Fae',
  chaoshalfling: 'Chaos Halfling',
  daemonsofkhorne: 'Daemons of Khorne',
  eshinadepts: 'Eshin Adepts',
  forestgoblin: 'Forest Goblin',
  gnomesffbtest: 'Gnomes (FFB test)',
  goblincheaters: 'Goblin Cheaters',
  horrorsoftzeentch: 'Horrors of Tzeentch',
  nurglings: 'Nurglings',
  prizeplayers: 'Prize Players',
  prohalflings: 'Pro Halflings',
  pygmy: 'Pygmy',
  skryreslaves: 'Skryre Slaves',
  squigherders: 'Squig Herders',
  strigoyan: 'Strigoyan',
  'vampire(sep23test)': 'Vampire (Sep 23 test)',
};

const bareId = (id: string): string => id.replace(/^race:/, '');

/** English display name of a roster / race id (pass it through terms() to show it). */
export function rosterDisplayName(id: string): string {
  const raw = bareId(String(id ?? '').trim());
  return englishTermForId(raw) ?? NO_TERM_ROSTER_NAMES[raw.toLowerCase()] ?? NO_TERM_ROSTER_NAMES[raw.toLowerCase().replace(/[^a-z0-9()]/g, '')]
    ?? (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw);
}

/**
 * Roster-qualified position ids whose last segment is not a dictionary key, mapped to the dictionary's term for the
 * same position (Astra r4: `blackorc.goblinbruiserlineman` is the dictionary's "Goblin Bruiser"). Shown through
 * terms(), so they translate.
 */
const POSITION_ALIASES: Readonly<Record<string, string>> = {
  'blackorc.goblinbruiserlineman': 'Goblin Bruiser',
  'bretonnian.blitzers': 'Blitzer',
  'chaoschosen.beastmanrunner': 'Beastman Runner Lineman',
  'chaosdwarf.chaosdwarfflamesmith': 'Flamesmith',
  'chaosdwarf.enslavedminotaur': 'Minotaur',
  'chaoshalfling.chaosspawn': 'Spawn',
  'chaosrenegade.renegadedarkelflineman': 'Renegade Dark Elf',
  'chaosrenegade.renegadehumanlineman': 'Renegade Human',
  'chaosrenegade.renegadeorclineman': 'Renegade Orc',
  'chaosrenegade.renegaderatogre': 'Rat Ogre',
  'chaosrenegade.renegadeskavenlineman': 'Renegade Skaven',
  'gnoblar.ogregorger': 'Gorger',
  'imperialnobility.imperialretainerlineman': 'Imperial Retainer',
  'khorne.bloodbornmarauderlineman': 'Bloodborn Marauder',
  'norse.berserker': 'Norse Berserker',
  'norse.ulfwerenar': 'Ulfwerener',
  'nurgle.rotter': 'Rotter Lineman',
  'ogre.runtpunter': 'Ogre Runt Punter',
  'oldworldalliance.dwarfblocker': 'Dwarf Blocker Lineman',
  'oldworldalliance.dwarftrollslayer': 'Troll Slayer',
  'orc.blackorcblocker': 'Black Orc',
  'skryreslaves.slave': 'Skaven Slave',
};

/**
 * Positions with NO dictionary term: the old-ruleset / Secret League / test rosters of the asset-target catalogue
 * (Albion Fae, Daemons of Khorne, Horrors of Tzeentch, Skryre Slaves ...) and a few compound old names the dictionary
 * only knows in part (a Piranha Warrior Blitzer is not the dictionary's generic "Piranha Warrior"). They keep their
 * English proper name (spaced, never the run-together id) in every language until a term exists.
 */
const POSITION_NO_TERM_NAMES: Readonly<Record<string, string>> = {
  'albionfae.brownie': 'Brownie', 'albionfae.fenbeast': 'Fenbeast', 'albionfae.leprechaun': 'Leprechaun', 'albionfae.pixie': 'Pixie',
  'amazon.eaglewarriorthrower': 'Eagle Warrior Thrower', 'amazon.kokakalimblitzer': 'Koka Kalim Blitzer',
  'amazon.piranhawarriorblitzer': 'Piranha Warrior Blitzer', 'amazon.piranhawarriorcatcher': 'Piranha Warrior Catcher',
  'amazon.triballinewoman': 'Tribal Linewoman',
  'bretonnian.yeomen': 'Yeomen',
  'chaoschosen.chaosogre': 'Chaos Ogre', 'chaoschosen.chosenblocker': 'Chosen Blocker',
  'chaosdwarf.hobgoblinsneakystabba': 'Hobgoblin Sneaky Stabba',
  'chaoshalfling.carver': 'Carver', 'chaoshalfling.chaoshalfling': 'Chaos Halfling', 'chaoshalfling.headcarver': 'Head Carver',
  'daemonsofkhorne.bloodletterdaemon': 'Bloodletter Daemon', 'daemonsofkhorne.bloodthirster': 'Bloodthirster',
  'daemonsofkhorne.khorneherald': 'Khorne Herald', 'daemonsofkhorne.pitfighter': 'Pit Fighter',
  'eshinadepts.adept': 'Adept', 'eshinadepts.stalker': 'Stalker',
  'forestgoblin.forestgoblin': 'Forest Goblin', 'forestgoblin.shaman': 'Shaman', 'forestgoblin.spiderrider': 'Spider Rider',
  'forestgoblin.stikka': 'Stikka',
  'gnoblar.gnoblarbully': 'Gnoblar Bully', 'gnoblar.ogreirongut': 'Ogre Irongut', 'gnoblar.ogremaneater': 'Ogre Maneater',
  'gnoblar.trapper': 'Trapper',
  'gnome.daredevil': 'Daredevil', 'gnome.dwarvencannon': 'Dwarven Cannon', 'gnome.madbommaz': 'Mad Bommaz', 'gnome.squigslayer': 'Squig Slayer',
  'goblincheaters.pogostick': 'Pogo Stick',
  'horrorsoftzeentch.firewyrm': 'Fire Wyrm', 'horrorsoftzeentch.flamer': 'Flamer', 'horrorsoftzeentch.greaterhorror': 'Greater Horror',
  'horrorsoftzeentch.horror': 'Horror',
  'lizardmen.skinkrunner': 'Skink Runner',
  'norse.snowtroll': 'Snow Troll',
  'nurglings.beast': 'Beast of Nurgle', 'nurglings.nurgling': 'Nurgling', 'nurglings.plaguebearer': 'Plaguebearer', 'nurglings.putrifier': 'Putrifier',
  'prizeplayers.sandskeleton': 'Sand Skeleton',
  'prohalflings.borrower': 'Borrower', 'prohalflings.mootguard': 'Moot Guard', 'prohalflings.punter': 'Punter',
  'pygmy.alligatorwarrior': 'Alligator Warrior', 'pygmy.pygmy': 'Pygmy',
  'skink.adeptofsotek': 'Adept of Sotek', 'skink.raptor': 'Raptor', 'skink.whiptail': 'Whiptail',
  'skryreslaves.doomwheel': 'Doom Wheel', 'skryreslaves.jezzail': 'Jezzail', 'skryreslaves.mechavermin': 'Mecha Vermin',
  'skryreslaves.poisonedwindglobadier': 'Poisoned Wind Globadier',
  'snotling.snotlinggoon': 'Snotling Goon', 'snotling.snotlingmob': 'Snotling Mob', 'snotling.splattawagon': 'Splatta Wagon',
  'squigherders.squig': 'Squig', 'squigherders.squigherder': 'Squig Herder', 'squigherders.squighopper': 'Squig Hopper',
  'strigoyan.cryptghoul': 'Crypt Ghoul', 'strigoyan.strigoyanlord': 'Strigoyan Lord',
  'tombkings.anointedblitzer': 'Anointed Blitzer', 'tombkings.anointedthrower': 'Anointed Thrower',
  'underworlddenizens.mutantratogre': 'Mutant Rat Ogre', 'underworlddenizens.skavenlineman': 'Skaven Lineman',
  'underworlddenizens.underworldsnotlings': 'Underworld Snotlings', 'underworlddenizens.underworldtroll': 'Underworld Troll',
};

/** English display name of a position id (`blackorc.goblinbruiser`): the dictionary term (exact id, else the
 *  roster-qualified alias), else its no-term English proper name, else `fallback`. */
export function positionDisplayName(id: string, fallback: string): string {
  const full = String(id ?? '').trim().toLowerCase();
  return englishTermForId(full.split('.').pop()) ?? POSITION_ALIASES[full] ?? POSITION_NO_TERM_NAMES[full] ?? fallback;
}

/** Test seams: the alias / no-term tables. */
export const POSITION_NAME_TABLES = { aliases: POSITION_ALIASES, noTerm: POSITION_NO_TERM_NAMES } as const;
