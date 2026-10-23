/**
 * DEV-ONLY verification harness for the inducements phase screen (not shipped —
 * reachable only at /inducements-preview.html under `vite dev`).
 *
 * Drives InducementsPhase.vue with MOCKED server state so all three phases and
 * both seats can be eyeballed against `Inducements Pane.dc.html` without a live
 * fork game. The fixture numbers are the handoff's (petty 340k / treasury 150k →
 * scum 50k) so the money readouts can be checked by hand.
 */
import { createApp, h, reactive } from 'vue';
import { applyTheme } from '../game/theme';
import { installFontStackVariables } from '../game/fontStacks';
import InducementsPhase, { type PanelView, type PickerCard, type SummaryCardView } from '../components/InducementsPhase.vue';
import {
  KIND_LABEL, bladeOf, estimateInducementBudget, ownedResources, phaseMoney, summaryCards,
  type Blade, type InducementPhase, type InducementRole, type PhaseOption,
} from '../game/inducementsPhase';
import { crestDataUrl } from '../game/teamCrests';
import { buildInducementOptions } from '../game/inducementCatalog';
import { purchaseOptionsFromWire } from '../game/inducementPurchase';
import { useInducementPrompt } from '../game/useInducementPrompt';

/** Bretonnian Pastries lane (10-23): a server game-options fixture that CARRIES the Pastries keys (the scratch server's
 *  wire), projected through the real catalogue. Without it (toolbar "server: no pastries") the row is absent, as on a
 *  server that does not know the inducement. */
const PASTRIES_WIRE = { gameOptions: { gameOptionArray: [
  { gameOptionId: 'inducementBretonnianPastriesCost', gameOptionValue: '15000' },
  { gameOptionId: 'inducementBretonnianPastriesMax', gameOptionValue: '1' },
] } };
const PASTRIES_TEAM = { playerArray: [], roster: { apothecary: true, maxBigGuys: 1, positionArray: [], keywords: [] }, specialRules: [], assistantCoaches: 0, cheerleaders: 0 };
function serverRows(withPastries: boolean): PhaseOption[] {
  const { options, changedOptionKeys } = purchaseOptionsFromWire(withPastries ? PASTRIES_WIRE : { gameOptions: { gameOptionArray: [] } });
  return buildInducementOptions(PASTRIES_TEAM, options, changedOptionKeys).filter((o) => o.key === 'bretonnianPastries');
}
const ICON_URL: Record<string, string> = { bretonnianPastries: new URL('../assets/resources/bretonnian_pastries.png', import.meta.url).href };

const BASE_OPTIONS: PhaseOption[] = [
  { key: 'bribes', label: 'Bribe', cost: 100_000, max: 3, available: true },
  { key: 'halflingMasterChef', label: 'Halfling Master Chef', cost: 300_000, max: 1, available: true },
  { key: 'wanderingApothecaries', label: 'Wandering Apothecary', cost: 100_000, max: 2, available: true },
  { key: 'biasedRef', label: 'Biased Referee', cost: 120_000, max: 1, available: true },
  { key: 'prayers', label: 'Prayers to Nuffle', cost: 50_000, max: 3, available: true },
  { key: 'teamMascot', label: 'Team Mascot', cost: 30_000, max: 1, available: true },
  { key: 'partTimeCoach', label: 'Part-time Assistant Coach', cost: 20_000, max: 5, available: true },
  { key: 'tempCheerleader', label: 'Temp Agency Cheerleader', cost: 20_000, max: 5, available: true },
  { key: 'weatherMage', label: 'Weather Mage', cost: 30_000, max: 1, available: true },
  { key: 'wizard', label: 'Sports Wizard', cost: 150_000, max: 1, available: true },
  { key: 'bloodweiserBabes', label: "Blitzer's Best Kegs", cost: 50_000, max: 2, available: true },
  { key: 'josefBugman', label: 'Infamous Coaching Staff: Josef Bugman', cost: 100_000, max: 1, available: true },
  { key: 'star:M1', label: "Morg 'n' Thorg", cost: 340_000, max: 1, available: true, star: true },
  { key: 'star:M2', label: 'Karla von Kill', cost: 210_000, max: 1, available: true, star: true },
  { key: 'star:M3', label: 'Zolcath the Zoat', cost: 230_000, max: 1, available: true, star: true },
  { key: 'star:M4', label: 'Akhorne the Squirrel', cost: 80_000, max: 1, available: true, star: true },
  { key: 'star:M5', label: 'Grak & Crumbleberry', cost: 250_000, max: 1, available: true, star: true },
  { key: 'star:M6', label: 'Glotl Stop', cost: 270_000, max: 1, available: true, star: true },
  { key: 'merc:P1', label: 'Mercenary Lineman', cost: 130_000, max: 3, available: true },
  { key: 'merc:P2', label: 'Mercenary Thrower', cost: 150_000, max: 1, available: true },
  { key: 'merc:P3', label: 'Mercenary Catcher', cost: 145_000, max: 1, available: true },
  { key: 'merc:P4', label: 'Mercenary Blitzer', cost: 175_000, max: 2, available: true },
];

/** The picker rows: the server-option-driven Pastries row (reactive on `state.pastries`) plus the fixture rows. */
const currentOptions = (): PhaseOption[] => [...serverRows(state.pastries), ...BASE_OPTIONS];

const STATS: Record<string, number[]> = {
  'star:M1': [5, 6, 3, 4, 11], 'star:M2': [6, 4, 3, 4, 9], 'star:M3': [5, 5, 4, 5, 10],
  'star:M4': [7, 1, 2, 0, 6], 'star:M5': [5, 5, 4, 5, 10], 'star:M6': [4, 5, 4, 0, 10],
  'merc:P1': [6, 3, 3, 4, 9], 'merc:P2': [6, 3, 3, 2, 9], 'merc:P3': [8, 2, 3, 5, 8], 'merc:P4': [7, 3, 3, 4, 9],
};
const SKILLS: Record<string, string[]> = {
  'star:M1': ['Block', 'Mighty Blow (+2)', 'Thick Skull', 'Throw Team-mate', 'Loner (4+)'],
  'star:M2': ['Block', 'Dauntless', 'Dodge', 'Jump Up', 'Loner (4+)'],
  'star:M3': ['Dodge', 'Juggernaut', 'Prehensile Tail', 'Regeneration', 'Sure Feet', 'Loner (4+)'],
  'star:M4': ['Claws', 'Dauntless', 'Dodge', 'Frenzy', 'Jump Up', 'Loner (4+)'],
  'star:M5': ['Kick Team-mate', 'Loner (4+)', 'Mighty Blow (+1)', 'Thick Skull'],
  'star:M6': ['Frenzy', 'Loner (4+)', 'Mighty Blow (+1)', 'Prehensile Tail', 'Stand Firm'],
};
const SPECIAL: Record<string, string> = {
  'star:M1': 'The Ballista: +1 to injury with Mighty Blow',
  'star:M2': 'Indomitable: reroll a failed Dauntless roll',
  'star:M3': 'Excuse Me, Are You a Zoat?',
  'star:M4': 'The Death of Kings',
  'star:M5': 'Two for One: hired with Crumbleberry',
  'star:M6': 'Blind Rage',
};
const GLYPH: Record<string, string> = {
  bribes: '⚖', halflingMasterChef: '🍲', wanderingApothecaries: '✚', biasedRef: '⚑',
  prayers: '☨', teamMascot: '☂', partTimeCoach: '📣', tempCheerleader: '★',
  weatherMage: '☁', wizard: '⚡', bloodweiserBabes: '🍺', josefBugman: '🍻',
};

const STAT_KEYS = ['MA', 'ST', 'AG', 'PA', 'AV'] as const;
const statChips = (key: string) =>
  (STATS[key] ?? []).map((v, i) => ({ k: STAT_KEYS[i] ?? '', v: i >= 2 ? `${v}+` : String(v) }));

// The pane reads --ui-* tokens; the real app applies them at boot, so do the same
// here with the Black/Red preset the handoff's palette was derived from.
applyTheme('brand-red', '#790004', '#000000');

const state = reactive({
  phase: 'overdog' as InducementPhase,
  seat: 'overdog' as InducementRole,
  blade: 'inducements' as Blade,
  picks: {} as Record<string, number>,
  /** Tournament/league preset mode: read-only allocations + TOURNAMENT MODE banner. */
  preset: false,
  /** Owner 10-11 side panels: passive viewer (no local seat), a 40+ character team name, crest states. */
  viewer: 'play' as 'play' | 'spectate',
  longName: false,
  logo: 'crest' as 'crest' | 'none' | 'broken',
  /** Team-model shapes: BB2020+ (default), a BB2016 team (fans = Fan Factor), or a model missing most counts. */
  roster: 'bb2025' as 'bb2025' | 'bb2016' | 'sparse',
  /** A finished leg rebuilt from the model after a rejoin, the model carrying no purchase: the neutral note. */
  lockedIn: false,
  /** Pastries lane: the server game options carry the Pastries keys (default on), and the mocked use dialog. */
  pastries: true,
  useDialog: false,
});

/** Mock TEAM models: the side panels' owned-resource tiles read these roster fields through the real projection
 *  (`ownedResources`), exactly as the mount does. Zero and two-digit counts are in here on purpose. */
const TEAMS = {
  overdog: { teamName: 'Deathskull Ladz', coach: 'Grimgor_the_Coach', race: 'Orc', reRolls: 3, apothecaries: 1, dedicatedFans: 7, assistantCoaches: 2, cheerleaders: 1 },
  underdog: { teamName: 'Penguin Academy', coach: 'IceFloeIvan', race: 'Human', reRolls: 2, apothecaries: 0, dedicatedFans: 12, assistantCoaches: 0, cheerleaders: 10 },
};
const LONG_NAME = 'The Extraordinarily Longwinded Gentlemen of Altdorf-upon-Reik';

/** Preselections mirroring the prototype's fixture, so the summaries are populated. */
// Kept inside each side's cap so the readouts stay meaningful: the overdog sits
// at 180k of 400k, and the underdog at 350k — 340k petty exhausted plus 10k drawn
// from scum, which is exactly the petty→scum→treasury cascade to eyeball.
const OVERDOG_PICKS = { bribes: 1, 'star:M4': 1, bretonnianPastries: 1 };
const UNDERDOG_PICKS = { halflingMasterChef: 1, prayers: 1 };

function pickerCards(): Record<Blade, PickerCard[]> {
  const out: Record<Blade, PickerCard[]> = { inducements: [], stars: [], mercenaries: [] };
  for (const option of currentOptions()) {
    const blade = bladeOf(option.key);
    const taken = state.picks[option.key] ?? 0;
    out[blade].push({
      key: option.key, name: option.label, cost: option.cost,
      costLabel: option.cost > 0 ? `${option.cost / 1000}k` : '—',
      countLabel: blade === 'stars' ? (taken > 0 ? 'Hired' : '') // owner 10-15: no "1 available" line on star cards
        : `${taken} of ${option.max} ${blade === 'mercenaries' ? 'hired' : 'taken'}`,
      portrait: { url: ICON_URL[option.key] ?? null, glyph: blade === 'inducements' ? (GLYPH[option.key] ?? '◆') : blade === 'stars' ? '★' : '⚔' },
      stats: statChips(option.key), skills: SKILLS[option.key] ?? [], special: SPECIAL[option.key] ?? null,
      option,
    });
  }
  return out;
}

function cardsOf(picks: Record<string, number>): SummaryCardView[] {
  return summaryCards(picks, currentOptions()).map((c) => ({
    key: c.key, name: c.name, blade: c.blade, kind: KIND_LABEL[c.blade], qty: c.qty,
    totalLabel: `${c.total / 1000}k`, showBadge: c.showBadge,
    portrait: { url: ICON_URL[c.key] ?? null, glyph: c.blade === 'inducements' ? (GLYPH[c.key] ?? '◆') : c.blade === 'stars' ? '★' : '⚔' },
    skills: SKILLS[c.key] ?? [],
  }));
}

const OVER_MONEY = (spent: number) => phaseMoney({
  role: 'overdog', availableGold: 400_000, pettyCash: 0, scumPool: 400_000, teamTreasury: 400_000, spent,
});
const UNDER_MONEY = (spent: number) => phaseMoney({
  role: 'underdog', availableGold: 390_000, pettyCash: 340_000, scumPool: 50_000, teamTreasury: 150_000, spent,
});

/** Owner 10-12 gold estimate: the waiting underdog's own expected budget, as the mount derives it (TV gap 160k,
 *  treasury 150k, BB2025 defaults). The overdog fixture then spends 180k, so the server's petty (340k) is 160k + 180k:
 *  the hand-over from "Estimated" to the real figure is visible. */
const UNDER_ESTIMATE = estimateInducementBudget({
  rulesVersion: 'BB2025', role: 'underdog', treasury: 150_000, myTv: 1_000_000, oppTv: 1_160_000,
  myPettyCashFromTvDiff: 160_000, oppPettyCashFromTvDiff: 0, options: {},
});

function panelFor(role: InducementRole): PanelView {
  const mine = state.viewer === 'play' && role === state.seat;
  const live = state.phase === role;
  const picks = mine && live ? state.picks : role === 'overdog' ? OVERDOG_PICKS : UNDERDOG_PICKS;
  const confirmed = state.phase === 'done' || (role === 'overdog' && state.phase === 'underdog');
  const spent = summaryCards(picks, currentOptions()).reduce((n, c) => n + c.total, 0);
  // As the mount: a coach's picks reach anyone else only once that coach confirms (the reveal), and budgets are sent
  // to the dialog's addressee alone, so they exist only while the local coach holds the live dialog.
  const showCards = confirmed || (mine && live);
  return {
    role, seat: role === 'overdog' ? 'home' : 'away',
    teamName: state.longName ? LONG_NAME : TEAMS[role].teamName,
    coachName: TEAMS[role].coach,
    logo: state.logo === 'none' ? null : state.logo === 'broken' ? '/missing-team-logo.png'
      : crestDataUrl(TEAMS[role].race, role === 'overdog' ? 'home' : 'away'),
    owned: state.roster === 'bb2016'
      ? ownedResources({ ...TEAMS[role], fanFactor: TEAMS[role].dedicatedFans, dedicatedFans: 0 }, { fanFactorRuleset: true })
      : state.roster === 'sparse' ? ownedResources({ teamName: TEAMS[role].teamName, reRolls: TEAMS[role].reRolls, apothecaries: 0 })
        : ownedResources(TEAMS[role]),
    status: confirmed ? 'confirmed' : live ? 'selecting' : 'waiting',
    money: mine && live ? (role === 'overdog' ? OVER_MONEY(spent) : UNDER_MONEY(spent)) : null,
    estimate: mine && role === 'underdog' && state.phase === 'overdog' ? UNDER_ESTIMATE : null,
    cards: showCards && !(state.lockedIn && mine && confirmed) ? cardsOf(picks) : [],
    editable: mine && live,
    dimmed: role === 'underdog' && state.phase === 'overdog',
    emptyNote: live ? 'Nothing selected yet.' : confirmed ? (state.lockedIn && mine ? 'Your choices are locked in.' : 'No inducements.') : 'Waiting…',
  };
}

/** The seat may act only during its own leg ('done' matches neither role). */
const canAct = () => state.phase === state.seat;

installFontStackVariables();
createApp({
  render: () => [h(InducementsPhase, {
    class: 'induce-phase', // the mount's class: the host rules in inducements-preview.html key off it, as the client's do
    phase: state.phase,
    overdog: panelFor('overdog'),
    underdog: panelFor('underdog'),
    mySide: state.viewer === 'play' ? state.seat : null,
    viewerMode: state.viewer,
    canAct: canAct() && !state.preset && state.viewer === 'play',
    picks: state.picks,
    options: canAct() ? currentOptions() : [],
    cap: state.seat === 'overdog' ? 400_000 : 390_000,
    blade: state.blade,
    cards: pickerCards(),
    selectorLimits: { stars: 2, mercenaries: 4, staff: 2 },
    confirmPending: false,
    presetMode: state.preset,
    onAcknowledge: () => { state.preset = false; },
    onBlade: (b: Blade) => { state.blade = b; },
    onAdd: (k: string) => { state.picks[k] = (state.picks[k] ?? 0) + 1; },
    onRemove: (k: string) => {
      const n = (state.picks[k] ?? 0) - 1;
      if (n <= 0) delete state.picks[k]; else state.picks[k] = n;
    },
    onClear: () => { for (const k of Object.keys(state.picks)) delete state.picks[k]; },
    onConfirm: () => { state.phase = state.phase === 'overdog' ? 'underdog' : 'done'; },
  }), state.useDialog ? useDialogMock() : null],
}).mount('#app');

/** A MOCKED server `useInducement` offer (the scratch server's game 1061 shape) rendered through the real prompt builder:
 *  nothing is sent anywhere, the buttons only close it. */
function useDialogMock() {
  const view = useInducementPrompt({
    commandNr: 1061, teamId: 'home', inducementTypeArray: ['bretonnianPastries'], cards: [], playerId: 'p1',
    authority: { role: 'player', myTeamId: 'home', decisionTeamId: 'home' },
  }, 'Grimgor Ironhide');
  const button = (label: string) => h('button', {
    style: 'font:inherit;padding:6px 16px;background:#242424;color:#e6e9ef;border:2px outset #4a4a4a;cursor:pointer',
    onClick: () => { state.useDialog = false; },
  }, label);
  return h('div', { style: 'position:fixed;inset:0;display:grid;place-items:center;z-index:200;background:#0008' }, [
    h('div', { style: 'max-width:420px;padding:16px 18px;background:#121212;border:2px solid #790004;color:#e6e9ef;font-size:15px;line-height:1.35;display:grid;gap:12px' }, [
      h('div', { style: 'display:flex;gap:12px;align-items:center' }, [
        h('img', { src: ICON_URL.bretonnianPastries, width: 64, height: 64, alt: '' }),
        h('div', view.prompt),
      ]),
      h('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, [...view.options.map((o) => button(o.label)), button(view.declineLabel)]),
    ]),
  ]);
}

// Harness toolbar: phase × seat switches, so both seats can be shot in every phase.
const bar = document.getElementById('bar')!;
function button(label: string, on: () => boolean, go: () => void) {
  const b = document.createElement('button');
  b.textContent = label;
  const sync = () => b.setAttribute('data-on', String(on()));
  b.onclick = () => { go(); document.querySelectorAll('#bar button').forEach((x) => (x as HTMLElement & { sync?: () => void }).sync?.()); };
  (b as HTMLElement & { sync?: () => void }).sync = sync;
  sync();
  bar.appendChild(b);
}
for (const p of ['overdog', 'underdog', 'done'] as const) {
  button(`phase: ${p}`, () => state.phase === p, () => { state.phase = p; for (const k of Object.keys(state.picks)) delete state.picks[k]; });
}
for (const s of ['overdog', 'underdog'] as const) {
  button(`seat: ${s}`, () => state.seat === s, () => { state.seat = s; });
}
button('server: pastries', () => state.pastries, () => {
  state.pastries = !state.pastries;
  for (const k of Object.keys(state.picks)) delete state.picks[k];
});
button('use dialog (mock)', () => state.useDialog, () => { state.useDialog = !state.useDialog; });
button('preset (tournament)', () => state.preset, () => { state.preset = !state.preset; });
button('spectator', () => state.viewer === 'spectate', () => { state.viewer = state.viewer === 'play' ? 'spectate' : 'play'; });
button('roster: BB2016', () => state.roster === 'bb2016', () => { state.roster = state.roster === 'bb2016' ? 'bb2025' : 'bb2016'; });
button('roster: sparse', () => state.roster === 'sparse', () => { state.roster = state.roster === 'sparse' ? 'bb2025' : 'sparse'; });
button('rejoin: locked in', () => state.lockedIn, () => { state.lockedIn = !state.lockedIn; });
button('long name', () => state.longName, () => { state.longName = !state.longName; });
button('logo: none', () => state.logo === 'none', () => { state.logo = state.logo === 'none' ? 'crest' : 'none'; });
button('logo: broken', () => state.logo === 'broken', () => { state.logo = state.logo === 'broken' ? 'crest' : 'broken'; });
// A long selections list for the acting seat (ignores the cap: this is a layout fixture, nothing is sent anywhere).
button('fill picks', () => Object.keys(state.picks).length > 6, () => {
  const full = Object.keys(state.picks).length > 6;
  for (const k of Object.keys(state.picks)) delete state.picks[k];
  if (!full) for (const o of currentOptions().slice(0, 16)) state.picks[o.key] = o.key === 'bribes' ? 3 : 1;
});
// The real mount bounds the phase to the middle 84% of the pitch host; `free` drops that to inspect natural heights.
const appHost = document.getElementById('app')!;
button('host: free height', () => !appHost.classList.contains('pitch-host'), () => { appHost.classList.toggle('pitch-host'); });
