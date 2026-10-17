import type { GameJson, PlayerJson } from '@fumbbl40k/ffb-protocol';
import type { LogNameToken } from '../logNames';
import type { TeamSide } from '../teamSide';
import { DIRECTION_END, DIRECTION_MARK, isHomeTeamId, playerName, sideOfPlayer } from './model';
import type { UpstreamLineSpace, UpstreamLogDirection, UpstreamLogLine, UpstreamLogSpan, UpstreamLogState, UpstreamSpanStyle } from './types';

/** Upstream's TextStyle (client/TextStyle.java), the ones the report renderers use. */
export type TextStyle = 'none' | 'bold' | 'home' | 'homeBold' | 'away' | 'awayBold' | 'roll' | 'neededRoll' | 'explanation'
  | 'turn' | 'turnHome' | 'turnAway';

/** Upstream's ParagraphStyle: an indent level (StatusReport.findParagraphStyle) or one of the spacing styles. */
export type Paragraph = number | 'spaceAbove' | 'spaceBelow' | 'spaceAboveBelow';

const SPAN_OF: Partial<Record<TextStyle, UpstreamSpanStyle>> = {
  bold: 'bold', homeBold: 'bold', awayBold: 'bold', roll: 'roll', neededRoll: 'neededRoll', explanation: 'explanation',
  turn: 'turn', turnHome: 'turn', turnAway: 'turn',
};
const TEAM_OF: Partial<Record<TextStyle, TeamSide>> = {
  home: 'home', homeBold: 'home', turnHome: 'home', away: 'away', awayBold: 'away', turnAway: 'away',
};

/**
 * A port of upstream's StatusReport printing (client/StatusReport.java + ui/ChatLogTextPane.append):
 *  - every print appends a text run in a TextStyle and sets the paragraph style of the CURRENT line, so a line takes
 *    the paragraph (indent) of its last text print;
 *  - a print of null text, and the end of every println, inserts a line separator: println() therefore ends the
 *    current line and adds an empty one;
 *  - an indent outside 0..6 has no ParagraphStyle and falls back to INDENT_0.
 */
export class UpstreamPrinter {
  readonly lines: UpstreamLogLine[] = [];
  private text = '';
  private spans: UpstreamLogSpan[] = [];
  private names: LogNameToken[] = [];
  private dirs: UpstreamLogDirection[] = [];
  private paragraph: Paragraph | null = null;
  private open = false;
  /** The previous report left its paragraph open: this report's first line continues it (no line break between). */
  private continues: boolean;

  constructor(readonly game: GameJson | null, readonly state: UpstreamLogState) {
    this.continues = state.open;
  }

  getIndent(): number { return this.state.indent; }
  setIndent(indent: number): void { this.state.indent = indent; }

  /** print(int|ParagraphStyle, TextStyle, String). `null` text ends the line. */
  print(paragraph: Paragraph, style: TextStyle | null, text: string | null, playerId?: string): void {
    if (text === null) {
      this.separator();
      return;
    }
    this.paragraph = typeof paragraph === 'number' ? (paragraph >= 0 && paragraph <= 6 ? paragraph : 0) : paragraph;
    text = this.takeDirections(text);
    const s = style ?? 'none';
    if (text.length > 0) {
      const span = SPAN_OF[s];
      if (span) this.spans.push({ start: this.text.length, length: text.length, style: span });
      const team = TEAM_OF[s];
      if (team) this.names.push({ index: this.text.length, length: text.length, team, ...(playerId ? { playerId } : {}) });
    }
    this.text += text;
    this.open = true;
  }

  /** print(int, String). */
  printT(paragraph: Paragraph, text: string | null): void {
    this.print(paragraph, null, text);
  }

  /** println(int|ParagraphStyle, TextStyle, String). */
  println(paragraph: Paragraph, style: TextStyle | null, text: string | null): void {
    this.print(paragraph, style, text);
    this.separator();
  }

  /** println(int, String). */
  printlnT(paragraph: Paragraph, text: string | null): void {
    this.println(paragraph, null, text);
  }

  /** println(): ends the current line and adds an empty one. */
  blankLine(): void {
    this.separator();
    this.separator();
  }

  /** print(int, boolean, Player): the player's name in the team colour (bold or not); nothing for a missing player. */
  player(paragraph: Paragraph, bold: boolean, player: PlayerJson | null): void {
    if (!player) return;
    const home = sideOfPlayer(this.game, player) === 'home';
    this.print(paragraph, home ? (bold ? 'homeBold' : 'home') : (bold ? 'awayBold' : 'away'), playerName(player), player.playerId);
  }

  /** printTeamName(boolean, teamId): at getIndent() + 1. */
  teamName(bold: boolean, teamId: unknown): void {
    const home = isHomeTeamId(this.game, teamId);
    const team = home ? this.game?.teamHome : this.game?.teamAway;
    this.print(this.getIndent() + 1, home ? (bold ? 'homeBold' : 'home') : (bold ? 'awayBold' : 'away'), String(team?.teamName ?? 'null'));
  }

  /** The report is done. A line it left open (IndomitableMessage ends with print(".")) shows at once, as upstream's
   *  log document shows every print, marked `open`: the next report's first line continues it (`continues`) and the
   *  view joins the two without a line break. */
  finish(): UpstreamLogLine[] {
    if (this.open) {
      this.separator(true);
      this.state.open = true;
    } else if (this.lines.length) {
      this.state.open = false;
    }
    return this.lines;
  }

  /** Strip the direction marks (model.directionName) out of a printed run, recording each word as a direction token. */
  private takeDirections(text: string): string {
    if (!text.includes(DIRECTION_MARK)) return text;
    let out = '';
    let at = 0;
    while (at < text.length) {
      const start = text.indexOf(DIRECTION_MARK, at);
      const end = start < 0 ? -1 : text.indexOf(DIRECTION_END, start);
      if (start < 0 || end < 0) {
        out += text.slice(at);
        break;
      }
      out += text.slice(at, start);
      const word = text.slice(start + 1, end);
      const direction = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      const canonical = direction.replace(/^(North|South)(east|west)$/i, (_m, a: string, b: string) => `${a}${b.toLowerCase()}`);
      this.dirs.push({ index: this.text.length + out.length, length: word.length, direction: canonical, ...(word === word.toLowerCase() ? { lower: true as const } : {}) });
      out += word;
      at = end + 1;
    }
    return out;
  }

  private separator(open = false): void {
    const paragraph = this.paragraph ?? 0;
    const space: UpstreamLineSpace | undefined = paragraph === 'spaceAbove' ? 'above' : paragraph === 'spaceBelow' ? 'below'
      : paragraph === 'spaceAboveBelow' ? 'aboveBelow' : undefined;
    this.lines.push({
      text: this.text,
      indent: typeof paragraph === 'number' ? paragraph : 0,
      ...(space ? { space } : {}),
      spans: this.spans,
      names: this.names,
      ...(this.dirs.length ? { dirs: this.dirs } : {}),
      ...(this.continues ? { continues: true as const } : {}),
      ...(open ? { open: true as const } : {}),
    });
    this.continues = false;
    this.text = '';
    this.spans = [];
    this.names = [];
    this.dirs = [];
    this.paragraph = null;
    this.open = false;
  }
}
