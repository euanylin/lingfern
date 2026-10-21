import type { Locale } from '../shared/locale';

export const instructionPacks: Partial<Record<Locale, Record<string, string>>> = {};
const loaders: Partial<Record<Locale, () => Promise<{ default: Record<string, string> }>>> = {
  ja: () => import('./ja/teaching.json'),
  ko: () => import('./ko/teaching.json'),
  fr: () => import('./fr/teaching.json'),
  es: () => import('./es/teaching.json'),
  de: () => import('./de/teaching.json'),
  pt: () => import('./pt/teaching.json'),
  it: () => import('./it/teaching.json'),
  ru: () => import('./ru/teaching.json'),
  ar: () => import('./ar/teaching.json'),
  hi: () => import('./hi/teaching.json'),
  id: () => import('./id/teaching.json'),
};
export async function loadInstructionLocale(locale: Locale) {
  const load = Object.hasOwn(loaders, locale) ? loaders[locale] : undefined;
  if (load && !instructionPacks[locale]) instructionPacks[locale] = (await load()).default;
}
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compileTemplates = (pack: Record<string, string>) => Object.keys(pack).filter(source => /\{v\d+\}/.test(source)).sort((a, b) => b.replace(/\{v\d+\}/g, '').length - a.replace(/\{v\d+\}/g, '').length).map(source => {
  const slots: string[] = [];
  let pattern = '', end = 0;
  for (const match of source.matchAll(/\{v\d+\}/g)) {
    pattern += escape(source.slice(end, match.index)) + '([\\s\\S]*?)';
    slots.push(match[0]); end = match.index + match[0].length;
  }
  return { source, slots, pattern: new RegExp('^' + pattern + escape(source.slice(end)) + '$') };
});

const compiled = new WeakMap<Record<string, string>, ReturnType<typeof compileTemplates>>();
function templates(pack: Record<string, string>) {
  let value = compiled.get(pack);
  if (!value) { value = compileTemplates(pack); compiled.set(pack, value); }
  return value;
}

// Translate only inspected explanation slots; preserve source and answer data.
const instructionSlots: Record<string, readonly string[]> = {
  'Yes. {v0}': ['{v0}'],
  'This keeps the stated meaning. {v0}': ['{v0}'],
  'This changes the stated detail. {v0}': ['{v0}'],
  'This changes a relation or action. {v0}': ['{v0}'],
  '“{v0}” is not the stated description. {v1}': ['{v1}'],
  '“{v0}” is not the requested detail. {v1}': ['{v1}'],
  '“{v0}” changes the requested detail. {v1}': ['{v1}'],
  'The recording states “{v0}”: {v1}. Keep the hour, minutes and a.m./p.m. {v2} No time zone is stated; do not convert it.': ['{v2}'],
  'Example: “{v0}” → “{v1}”. {v2} “{v3}”. Check the spelling and word ending.': ['{v2}'],
};

function translateKnown(text: string, pack: Record<string, string>, depth: number): string {
  if (Object.hasOwn(pack, text)) return pack[text];
  if (depth === 2) return text;
  for (const template of templates(pack)) {
    const match = template.pattern.exec(text);
    if (!match) continue;
    return pack[template.source].replace(/\{v\d+\}/g, slot => {
      const value = match[template.slots.indexOf(slot) + 1];
      return instructionSlots[template.source]?.includes(slot) ? translateKnown(value, pack, depth + 1) : value;
    });
  }
  return text;
}

/** Translate known instructions without changing snapshots or source quotes. */
export function translateInstruction(text: string, locale: Locale): string {
  const pack = instructionPacks[locale];
  return pack ? translateKnown(text, pack, 0) : text;
}
