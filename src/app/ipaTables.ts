import { z } from 'zod';

// Table data: IPA (2026), adapted by Lingfern, CC BY-SA 4.0; see docs/ipa-classification.md.
export const officialIpaChart = 'https://www.internationalphoneticassociation.org/IPAcharts/IPA_charts_EI/IPA_charts_EI.html';
export type IpaCell = readonly (string | null)[];
export const vowelColumns = ['front', 'near-front', 'central', 'near-back', 'back'] as const;
// Slots follow IPA ordering: unrounded/rounded vowels, voiceless/voiced consonants.
export const vowelRows = [
  { key: 'close', cells: [['i', null], [null, null], [null, null], [null, null], [null, 'u']] },
  { key: 'near-close', cells: [[null, null], ['ɪ', null], [null, null], [null, 'ʊ'], [null, null]] },
  { key: 'close-mid', cells: [[null, null], [null, null], [null, null], [null, null], [null, null]] },
  { key: 'mid', cells: [[null, null], [null, null], ['ə', null], [null, null], [null, null]] },
  { key: 'open-mid', cells: [['ɛ', null], [null, null], [null, null], [null, null], ['ʌ', 'ɔ']] },
  { key: 'near-open', cells: [['æ', null], [null, null], [null, null], [null, null], [null, null]] },
  { key: 'open', cells: [[null, null], [null, null], [null, null], [null, null], ['ɑ', null]] },
] as const;
export const rhoticRows = [{ key: 'central', cells: [['ɝ'], ['ɚ']] }] as const;
export const diphthongRows = [
  { key: 'close-mid', cells: [['eɪ'], ['oʊ']] },
  { key: 'open-mid', cells: [['ɔɪ'], []] },
  { key: 'open', cells: [['aɪ'], ['aʊ']] },
] as const;
export const consonantColumns = ['bilabial', 'labiodental', 'dental', 'alveolar', 'postalveolar', 'palatal', 'velar', 'glottal', 'labial-velar'] as const;
export const consonantRows = [
  { key: 'stop', cells: [['p', 'b'], [null, null], [null, null], ['t', 'd'], [null, null], [null, null], ['k', 'ɡ'], [null, null], [null, null]] },
  { key: 'nasal', cells: [[null, 'm'], [null, null], [null, null], [null, 'n'], [null, null], [null, null], [null, 'ŋ'], [null, null], [null, null]] },
  { key: 'fricative', cells: [[null, null], ['f', 'v'], ['θ', 'ð'], ['s', 'z'], ['ʃ', 'ʒ'], [null, null], [null, null], ['h', null], [null, null]] },
  { key: 'affricate', cells: [[null, null], [null, null], [null, null], [null, null], ['tʃ', 'dʒ'], [null, null], [null, null], [null, null], [null, null]] },
  { key: 'approximant', cells: [[null, null], [null, null], [null, null], [null, 'ɹ'], [null, null], [null, 'j'], [null, null], [null, null], [null, 'w']] },
  { key: 'lateral-approximant', cells: [[null, null], [null, null], [null, null], [null, 'l'], [null, null], [null, null], [null, null], [null, null], [null, null]] },
] as const;
export const ipaSymbols: readonly string[] = [...vowelRows, ...rhoticRows, ...diphthongRows, ...consonantRows].flatMap(row => row.cells.flatMap(cell => cell.filter(symbol => symbol !== null)));

const entrySchema = z.object({ ipa: z.string().min(1), group: z.enum(['vowel', 'consonant']), category: z.enum(['simple-vowel', 'rhotic-vowel', 'diphthong', 'stop', 'fricative', 'affricate', 'nasal', 'approximant']), voicing: z.enum(['voiceless', 'voiced']).optional(), pair: z.string().optional(), example: z.string().min(1), before: z.string(), bold: z.string().min(1), after: z.string(), transcription: z.string().min(1), audio: z.string().regex(/^\/ipa\/audio\/[a-z]+\.mp3$/), soundAudio: z.string().regex(/^\/ipa\/phonemes\/sound-\d{2}\.mp3$/) }).strict().refine(entry => entry.before + entry.bold + entry.after === entry.example);
export const ipaChartSchema = z.object({ accent: z.string(), reviewStatus: z.string(), entries: z.array(entrySchema).length(ipaSymbols.length) }).strict().refine(chart => new Set(chart.entries.map(entry => entry.ipa)).size === ipaSymbols.length && chart.entries.every(entry => ipaSymbols.includes(entry.ipa)), 'Expected the complete English sound inventory');
export type IpaEntry = z.infer<typeof entrySchema>;
