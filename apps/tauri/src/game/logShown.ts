import { currentLocale, shownText, type LocalText } from '../i18n';

/**
 * i18n (Astra r2): the client log STORES English (`text`: bug reports, diagnostics, the text-matched classification and
 * Classic read it). A client-authored line also carries its message (`local`); the Modern view shows that message in
 * the current language. Token runs (names / tags / dice) index the English text, so a line shown in another language
 * drops them; a line whose message reads the same keeps the entry itself. Cached per entry and locale.
 */
type Shown = { text: string; local?: LocalText; names?: unknown[]; tags?: unknown[]; d6?: unknown[]; blockDice?: unknown[] };
const cache = new WeakMap<object, { locale: string; line: object }>();

export function shownLogLine<T extends Shown>(entry: T): T {
  if (!entry.local) return entry;
  const locale = currentLocale.value; // read first: a computed over the log follows the language
  const hit = cache.get(entry);
  if (hit && hit.locale === locale) return hit.line as T;
  const text = shownText(entry.local);
  const line = text === entry.text ? entry : { ...entry, text, names: [], tags: [], d6: [], blockDice: [] };
  cache.set(entry, { locale, line });
  return line;
}
