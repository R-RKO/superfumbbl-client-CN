import type { LogNameToken } from '../logNames';

/**
 * The FUMBBL log style (owner 10-16): the upstream Java client's own log, line for line. Upstream's TextStyle maps
 * to a span style; the team colour styles (HOME / AWAY and their BOLD / TURN variants) become name tokens (the view
 * tints and clicks them like the Text style's names) plus a bold / turn span where upstream draws them bold.
 */
export type UpstreamSpanStyle = 'bold' | 'roll' | 'neededRoll' | 'explanation' | 'turn';

export interface UpstreamLogSpan {
  start: number;
  length: number;
  style: UpstreamSpanStyle;
}

/** Upstream's ParagraphStyle SPACE_ABOVE / SPACE_BELOW / SPACE_ABOVE_BELOW (4 px of space, indent 0). */
export type UpstreamLineSpace = 'above' | 'below' | 'aboveBelow';

/** A field direction word in a line (upstream prints mapToLocal(direction): the direction as the reader sees the pitch). */
export interface UpstreamLogDirection {
  index: number;
  length: number;
  /** The field direction (North ... Northwest). */
  direction: string;
  /** Upstream lower-cases it here ("... squares northeast of where it was aimed"). */
  lower?: true;
}

export interface UpstreamLogLine {
  text: string;
  /** Upstream's INDENT_0..INDENT_6 (12 px per level in the Java client). */
  indent: number;
  space?: UpstreamLineSpace;
  spans: UpstreamLogSpan[];
  names: LogNameToken[];
  /** Direction words, named at render time for the pitch as shown (absent when the line has none). */
  dirs?: UpstreamLogDirection[];
  /** The report left this paragraph open (no line break yet); the next report's first line continues it. */
  open?: true;
  /** This line continues the paragraph the previous report left open. */
  continues?: true;
}

/** Upstream's StatusReport bookkeeping that outlives a single report (the indent and the "header printed" flags). */
export interface UpstreamLogState {
  indent: number;
  pettyCashReportReceived: boolean;
  cardsBoughtReportReceived: boolean;
  inducementsBoughtReportReceived: boolean;
  /** The last report left its paragraph open (upstream's log continues it with the next report's text:
   *  IndomitableMessage ends with print(".")). */
  open: boolean;
}

export function createUpstreamLogState(): UpstreamLogState {
  return { indent: 0, pettyCashReportReceived: false, cardsBoughtReportReceived: false, inducementsBoughtReportReceived: false, open: false };
}
