import { prettySkillName } from './logic/prettySkillName';
const normalized = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
export function reportedAutomaticRerollSkill(report: Record<string, unknown>): string | null {
  return normalized(report.reportId) === 'reroll' && normalized(report.reRollSource) === 'blindrage' ? 'Blind Rage' : null;
}
/** Owner 10-20: the report that carries a FAILED Loner gate roll - the standalone `reRoll` {reRollSource: 'Loner',
 *  successful: false, roll 1-6}, or the legacy team reroll report with the gate roll folded in. Its roll is the Loner
 *  check, not the action's: the Modern view never presents it as a die (the ORIGINAL roll re-tumbles instead). */
export function isFailedLonerGateReport(report: Record<string, unknown>): boolean {
  if ((report.reportId !== 'reRoll' && report.reportId !== 'blockReRoll') || report.successful !== false) return false;
  const roll = Number(report.roll);
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) return false;
  const source = normalized(report.reRollSource);
  return source === 'loner' || source.includes('teamreroll');
}
/** Astra r5: where in the frame's report order the failed Loner's GATED use sits - the team-reroll-family spend
 *  (`reRoll` Team ReRoll / Leader / Brilliant Coaching / ...: useTeamReRoll) or the working `mascotUsed` that the
 *  failed Loner report right after it gates (bb2025 checkForLoner), for THAT player. A skill reroll (Dodge, Pro) is never
 *  it. The legacy shape (gate roll folded into the team report) is its own use. Null when the frame has no failed Loner.
 *  The roll a failed Loner re-tumbles is snapshotted at this index, after the frame's earlier rolls went by. */
export function lonerGatedUse(reports: readonly Record<string, unknown>[]): { index: number; playerId: string } | null {
  const isReroll = (r: Record<string, unknown>) => (r.reportId === 'reRoll' || r.reportId === 'blockReRoll') && r.reRollSource != null;
  const lonerIndex = reports.findIndex((r) => isReroll(r) && normalized(r.reRollSource) === 'loner' && isFailedLonerGateReport(r) && String(r.playerId ?? '') !== '');
  if (lonerIndex < 0) {
    const legacy = reports.findIndex((r) => isReroll(r) && normalized(r.reRollSource).includes('teamreroll') && isFailedLonerGateReport(r) && String(r.playerId ?? '') !== '');
    return legacy < 0 ? null : { index: legacy, playerId: String(reports[legacy]!.playerId) };
  }
  const playerId = String(reports[lonerIndex]!.playerId);
  for (let j = lonerIndex - 1; j >= 0; j--) {
    const r = reports[j]!;
    if (r.reportId === 'mascotUsed' && r.successful === true) return { index: j, playerId };
    if (isReroll(r) && String(r.playerId ?? '') === playerId && TEAM_TYPE_REROLL_SOURCES.has(normalized(r.reRollSource))) return { index: j, playerId };
  }
  return { index: lonerIndex, playerId };
}
/** The team-type sources useTeamReRoll reports (ffb-common ReRollSources; normalised). */
const TEAM_TYPE_REROLL_SOURCES = new Set(['teamreroll', 'leader', 'brilliantcoachingreroll', 'pumpupthecrowd', 'staroftheshow']);
/** Classify only server-reported grants and failures; never infer an outcome from team resources. */
export function rerollPresentation(reports: readonly Record<string, unknown>[]) {
  const report = reports.find((r) => (r.reportId === 'reRoll' || r.reportId === 'blockReRoll') && r.reRollSource != null);
  const pid = report ? String(report.playerId ?? '') : '';
  if (!report || !pid) return null;
  const raw = String(report.reRollSource);
  const isTeam = normalized(raw).includes('teamreroll');
  const isProSource = (value: unknown) => /^Pro\b/i.test(prettySkillName(String(value ?? '')));
  const isReroll = (r: Record<string, unknown>) => (r.reportId === 'reRoll' || r.reportId === 'blockReRoll') && r.reRollSource != null;
  const isPro = isProSource(raw);
  // Owner 10-10: Pro with a fallback (sources Pro TRR / Pro Mascot / Pro Mascot TRR, bb2025 RollMechanic.useReRoll
  // :319-361) reports the Pro roll, the fallback it spent, then the Pro roll AGAIN in one frame. The frame's Pro
  // outcome is its LAST Pro report: a first failure the fallback rescued is not a failed Pro.
  const proReports = isPro ? reports.filter((r) => isReroll(r) && String(r.playerId ?? '') === pid && isProSource(r.reRollSource)) : [];
  const finalPro = proReports[proReports.length - 1] ?? report;
  // The fallback is whatever the server reported BETWEEN this player's first and last Pro roll.
  const between = proReports.length > 1 ? reports.slice(reports.indexOf(report) + 1, reports.indexOf(finalPro)) : [];
  const proSucceeded = isPro && finalPro.successful === true;
  const proFailed = isPro && finalPro.successful === false;
  const proRescued = proSucceeded && proReports.length > 1 && report.successful === false;
  // What the server reported between the two Pro rolls: a team-reroll family report (Team ReRoll, Leader, Brilliant
  // Coaching...) or, with none, a successful mascotUsed. Unknown stays unnamed.
  const fallback = proRescued ? between.find((r) => isReroll(r) && String(r.playerId ?? '') === pid && !isProSource(r.reRollSource) && normalized(r.reRollSource) !== 'loner') : undefined;
  const proRescuedBy = !proRescued ? null
    : fallback ? (normalized(fallback.reRollSource).includes('teamreroll') ? 'a team reroll' : prettySkillName(String(fallback.reRollSource)))
      : between.some((r) => r.reportId === 'mascotUsed' && r.successful === true) ? 'the Team Mascot' : '';
  const roll = Number(report.roll);
  // Owner 10-20: a failed Loner. bb2020 / bb2025 RollMechanic (useTeamReRoll -> checkForLoner) write the team reroll
  // spend (`reRoll` {reRollSource: Team ReRoll / Leader / ..., roll: 0}) and THEN the gate's own report
  // `reRoll` {reRollSource: 'Loner' (ReRollSources.LONER, the hasToRollToUseTeamReroll check), successful, roll}; after a
  // working Mascot the Loner report follows `mascotUsed` alone. Read that report's own outcome / roll / player. The
  // legacy shape folded the gate roll into the team report itself (roll > 0, successful false). Astra 10-20 (P2-2): a
  // Pro-TRR fallback whose Loner fails reports [Pro false, Team ReRoll, Loner false] - BOTH verdicts are presented (the
  // Pro failure card, then the Loner cue). Loner only ever gates a team-reroll-family spend, never a skill reroll.
  const lonerReport = [...reports].reverse().find((r) => isReroll(r) && normalized(r.reRollSource) === 'loner' && String(r.playerId ?? '') !== '');
  const lonerRoll = lonerReport ? Number(lonerReport.roll) : roll;
  const lonerFailed = (lonerReport
    ? lonerReport.successful === false && Number.isInteger(lonerRoll) && lonerRoll > 0
    : isTeam && report.successful === false && Number.isInteger(roll) && roll > 0);
  return { pid, raw, isTeam, source: isTeam ? 'a team reroll' : prettySkillName(raw), proSucceeded, proFailed,
    /** null = not a rescued Pro; '' = rescued, fallback not named by the frame; else the fallback's display name. */
    proRescuedBy,
    skill: proSucceeded ? 'Pro' : isPro ? null : reportedAutomaticRerollSkill(report),
    isBlockReroll: report.reportId === 'blockReRoll' || reports.some((r) => r.reportId === 'blockRoll'),
    lonerFailed,
    /** The failed Loner's player and gate roll, from the report that carried it (null unless lonerFailed). */
    lonerPid: lonerFailed ? (lonerReport ? String(lonerReport.playerId) : pid) : null,
    lonerRoll: lonerFailed ? lonerRoll : null };
}

/** Owner 10-15: which icon the reroll toast leads with. A skill icon (when skill icons are on) wins; a WORKING Team
 *  Mascot (the splash showMascotSplash raises from a successful mascotUsed report) shows the Mascot inducement icon;
 *  any other team reroll (including a failed Mascot that fell back to a Team ReRoll report) keeps the TRR icon. */
export function rerollToastIconKind(splash: { skill?: string; isTeam: boolean; mascot?: boolean }, skillIconsOn: boolean): 'skill' | 'mascot' | 'trr' | 'logo' {
  if (splash.skill && skillIconsOn) return 'skill';
  if (splash.mascot) return 'mascot';
  return splash.isTeam ? 'trr' : 'logo';
}
