import { z } from 'zod';
import { fullVowels, fullConsonants, nonPulmonic, otherSymbols, affricates } from './fullIpa';
import { ipaSymbols } from './ipaTables';

export const fullIpaSoundSymbols: readonly string[] = [...new Set([
  ...fullVowels.flatMap(row => row.cells.flatMap(([, left, right]) => [left, right])),
  ...fullConsonants.flatMap(([, ...cells]) => cells.flat()),
  ...nonPulmonic.flatMap(([, ...cells]) => cells.flat()),
  ...otherSymbols.map(([symbol]) => symbol),
  ...affricates.map(([symbol]) => symbol),
  ...ipaSymbols,
].filter((symbol): symbol is string => !!symbol && symbol !== '—'))];

export const fullIpaAudioSchema = z.object({
  version: z.literal(1),
  entries: z.array(z.object({
    ipa: z.string().min(1),
    soundAudio: z.string().regex(/^\/ipa\/phonemes\/sound-\d{2,3}\.mp3$/),
  }).strict()).length(fullIpaSoundSymbols.length),
}).strict().refine(data => new Set(data.entries.map(entry => entry.ipa)).size === fullIpaSoundSymbols.length
  && data.entries.every(entry => fullIpaSoundSymbols.includes(entry.ipa)), 'Expected every independent sound in the full IPA chart');

export type FullIpaSound = z.infer<typeof fullIpaAudioSchema>['entries'][number];
