import { blockDieLogParts, type BlockDieFaceValue, type BlockDieLogToken } from './blockDieLog';
import { d6LogParts } from './d6Log';
import { logNameParts, type LogNameTeam, type LogNameToken } from './logNames';
import { logTagParts, type LogTagKind, type LogTagToken } from './logTags';

/**
 * A Text / Graphical log line split into what the log row renders: text runs, tagged runs (titles, the armour glyph,
 * hidden words, "fails"), team-tagged player names, d6 faces and block-die faces.
 *
 * Owner 10-23 (setup wizard Log style panel): the same walk as SpectateView's `logSegments` (the live log; that file is
 * single-writer, so it keeps its own cached copy), here for the wizard's static example rows. Keep the two in step.
 */
export type LogRowSegment = {
  t?: string;
  side?: LogNameTeam;
  pid?: string;
  /** A tag kind, or 'dienum' (a die drawn as its number under Settings > Display > Log's numbers toggles). */
  tk?: LogTagKind | 'dienum';
  face?: 1 | 2 | 3 | 4 | 5 | 6;
  kind?: 'roll' | 'target';
  blockFace?: BlockDieFaceValue;
  result?: string;
  title?: string;
  /** The server side of the team that rolled a d6 (home/away dice colour). */
  dteam?: 'home' | 'away';
};

export interface LogRowLine {
  text: string;
  d6?: { index: number; value: 1 | 2 | 3 | 4 | 5 | 6; kind: 'roll' | 'target'; team?: 'home' | 'away' }[];
  blockDice?: BlockDieLogToken[];
  names?: LogNameToken[];
  tags?: LogTagToken[];
}

export function logRowSegments(entry: LogRowLine): LogRowSegment[] {
  const segs: LogRowSegment[] = [];
  const faceParts = entry.blockDice?.length ? blockDieLogParts(entry) : d6LogParts(entry);
  // Dice parts, name tokens and decoration tags index the SAME text: walk an absolute cursor (a die glyph consumes its
  // own source length - one digit for a d6, the result word for a block die); each text run splits by tag first, then
  // the untagged pieces by name.
  let at = 0;
  for (const part of faceParts) {
    if ('blockFace' in part && part.blockFace) { segs.push({ blockFace: part.blockFace, result: part.result }); at += part.result.length; continue; }
    if ('face' in part && part.face) { segs.push(part.team ? { face: part.face, kind: part.kind, dteam: part.team } : { face: part.face, kind: part.kind }); at += 1; continue; }
    const text = part.text ?? '';
    for (const piece of logTagParts(text, at, entry.tags)) {
      if (piece.kind) { if (piece.text) segs.push({ t: piece.text, tk: piece.kind, ...(piece.title ? { title: piece.title } : {}) }); continue; }
      for (const named of logNameParts(piece.text, piece.start, entry.names)) {
        if (named.text) segs.push(named.team ? { t: named.text, side: named.team, ...(named.playerId ? { pid: named.playerId } : {}) } : { t: named.text });
      }
    }
    at += text.length;
  }
  return segs;
}
