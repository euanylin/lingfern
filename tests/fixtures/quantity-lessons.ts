import { readFileSync } from 'node:fs';
import type { Lesson } from '../../src/shared/content';
const raw = JSON.parse(readFileSync(new URL('./content/a1-reading.json', import.meta.url), 'utf8')) as Lesson;
import type { SpokenCorpus } from '../../src/core/spokenCorpus';
const words = ['butterflies','containers','vegetables','waterfalls','architects','libraries','astronauts','musicians','mountains','hospitals','workshops','newspapers','buildings','paintings','passengers','neighbours','batteries','forests','crystals','dolphins','volcanoes','telescopes','carpenters','orchards','fountains','printers','bicycles','harbours','satellites','laboratories','valleys','cameras','diamonds','bridges','farmers','lighthouses','carriages','monuments','pyramids','treasures'];
const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });

export function quantityFixture(count: number, seconds?: number) {
  const lesson = structuredClone(raw) as Lesson;
  lesson.targetLevel = 'B2'; lesson.id = `quantity-${count}-${seconds ?? 'reading'}`;
  lesson.skill = seconds === undefined ? 'reading' : 'listening';
  const timelines: { start: number; end: number; text: string; audioStart: number; audioEnd: number }[][] = [];
  for (const [index, material] of lesson.materials.entries()) {
    const tokens: string[] = [], segments: typeof timelines[number] = [];
    for (let n = 0; tokens.length + 10 <= count && n < words.length; n++) tokens.push('The', words[(n + index) % words.length], 'report', 'described', 'independent', 'findings', 'for', 'this', 'village', `${n + 1}.`);
    while (tokens.length < count) tokens.push('additional');
    const text = tokens.join(' '); let start = 0;
    const sentences = text.match(/[^.]+\.(?:\s|$)|[^.]+$/g)!;
    for (const [n, sentence] of sentences.entries()) { const value = sentence.trimEnd(); segments.push({ start, end: start + value.length, text: value, audioStart: n * (seconds ?? 300) / sentences.length, audioEnd: Math.min(seconds ?? 300, n * (seconds ?? 300) / sentences.length + 2) }); start += sentence.length; }
    const blockId = `quantity-block-${index}`;
    material.blocks = [{ id: blockId, text }]; material.id = `quantity-material-${index}`;
    material.questions = [{ id: `quantity-choice-${index}`, blockId, prompt: 'Which report is described first?', options: [words[index], 'Unrelated information'], answer: 0, explanations: [english('The source identifies this report.'), english('This is not in the source.')], hints: [english('Read.'), english('Find the report.'), english('Check the wording.')], evidence: { start: 0, end: segments[0].end, ...(seconds === undefined ? {} : { audioStart: segments[0].audioStart, audioEnd: segments[0].audioEnd }) } }];
    if (seconds !== undefined) material.audio = { src: '/audio/test-quantity/recording.mp3', sha256: 'a'.repeat(64), duration: seconds, author: 'Synthetic test fixture', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Test.mp3', license: 'CC-BY-SA-3.0' };
    timelines.push(segments);
  }
  const bank = { records: lesson.materials.map((material, index) => ({ clips: [{ text: material.blocks[0].text, audio: material.audio, segments: timelines[index] }] })) } as unknown as SpokenCorpus;
  return { lesson, bank, timelines };
}
