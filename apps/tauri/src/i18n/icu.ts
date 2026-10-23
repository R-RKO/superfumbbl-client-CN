/**
 * Minimal ICU MessageFormat subset for the client catalogue (no imports: scripts/i18n-check.mjs loads this file
 * directly with Node's type stripping).
 *
 *   text {name} text                                   a parameter
 *   {n, plural, =0 {none} one {# item} other {# items}}  CLDR plural categories + exact matches; `#` = the number
 *   '' -> '      '{' '}' '#' -> quoted literal text      ICU apostrophe quoting (an apostrophe that does not precede
 *                                                       { } # or another ' is an ordinary character: "Don't")
 *
 * parseMessage throws on malformed input (unbalanced braces, unknown plural selector, a plural without `other`,
 * an unterminated quote); scripts/i18n-check.mjs runs it over every catalogue so a broken message fails the build,
 * and the runtime falls back to the raw text instead of throwing.
 */
export type IcuNode =
  | { kind: 'text'; value: string }
  | { kind: 'arg'; name: string }
  | { kind: 'pound' }
  | { kind: 'plural'; name: string; branches: Map<string, IcuNode[]> };

const SELECTOR = /^(=\d+|zero|one|two|few|many|other)$/;

export class IcuError extends Error {}

export function parseMessage(message: string): IcuNode[] {
  let i = 0;
  const fail = (why: string): never => { throw new IcuError(`${why} at ${i} in ${JSON.stringify(message)}`); };

  function parseNodes(inPlural: boolean, closing: boolean): IcuNode[] {
    const nodes: IcuNode[] = [];
    let text = '';
    const flush = () => { if (text) { nodes.push({ kind: 'text', value: text }); text = ''; } };
    while (i < message.length) {
      const ch = message[i]!;
      if (ch === "'") {
        const next = message[i + 1];
        if (next === "'") { text += "'"; i += 2; continue; }
        if (next === '{' || next === '}' || (inPlural && next === '#')) {
          i++;
          let closed = false;
          while (i < message.length) {
            if (message[i] === "'") {
              if (message[i + 1] === "'") { text += "'"; i += 2; continue; }
              i++; closed = true; break;
            }
            text += message[i]; i++;
          }
          if (!closed) fail('unterminated quote');
          continue;
        }
        text += ch; i++; continue;
      }
      if (ch === '}') {
        if (!closing) fail('unbalanced }');
        flush();
        return nodes;
      }
      if (inPlural && ch === '#') { flush(); nodes.push({ kind: 'pound' }); i++; continue; }
      if (ch === '{') {
        flush();
        i++;
        const head = /^\s*(\w+)\s*(?:,\s*(\w+)\s*,)?\s*/.exec(message.slice(i));
        if (!head) fail('bad placeholder');
        i += head![0].length;
        const name = head![1]!;
        if (!head![2]) {
          if (message[i] !== '}') fail('bad placeholder');
          i++;
          nodes.push({ kind: 'arg', name });
          continue;
        }
        if (head![2] !== 'plural') fail(`unsupported format "${head![2]}"`);
        const branches = new Map<string, IcuNode[]>();
        for (;;) {
          while (/\s/.test(message[i] ?? '')) i++;
          if (message[i] === '}') { i++; break; }
          const sel = /^(=\d+|\w+)\s*\{/.exec(message.slice(i));
          if (!sel || !SELECTOR.test(sel[1]!)) fail('bad plural selector');
          if (branches.has(sel![1]!)) fail(`duplicate plural selector "${sel![1]}"`); // i18n:check rejects it (Astra r2)
          i += sel![0].length;
          branches.set(sel![1]!, parseNodes(true, true));
          i++; // the branch's closing }
          if (i > message.length) fail('unbalanced {');
        }
        if (!branches.size) fail('empty plural');
        nodes.push({ kind: 'plural', name, branches });
        continue;
      }
      text += ch; i++;
    }
    if (closing) fail('unbalanced {');
    flush();
    return nodes;
  }

  const nodes = parseNodes(false, false);
  return nodes;
}

/** Throws when a plural block has no `other` branch (a locale may omit any category except `other`). */
export function validateMessage(message: string): void {
  const check = (nodes: IcuNode[]): void => {
    for (const n of nodes) {
      if (n.kind !== 'plural') continue;
      if (!n.branches.has('other')) throw new IcuError(`plural "${n.name}" has no other branch in ${JSON.stringify(message)}`);
      for (const b of n.branches.values()) check(b);
    }
  };
  check(parseMessage(message));
}

/** Every parameter / plural variable name the message uses. */
export function messageParams(message: string): string[] {
  const out = new Set<string>();
  const walk = (nodes: IcuNode[]): void => {
    for (const n of nodes) {
      if (n.kind === 'arg') out.add(n.name);
      else if (n.kind === 'plural') { out.add(n.name); for (const b of n.branches.values()) walk(b); }
    }
  };
  walk(parseMessage(message));
  return [...out].sort();
}
