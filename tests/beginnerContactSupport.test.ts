import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { corpusAddress, corpusPhone, corpusLesson, corpusSchema, corpusStartingPoint, corpusWorkedExample, roomMatchingPrompt } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';

const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));

it('demonstrates speaker ownership without replacing unused-source examples or revealing assessed speech', () => {
  const operation = 'matching:Who says each sentence? Match it to a person.';
  const missing: Record<string, number[]> = { A1: [], A2: [] };
  let sourceExamples = 0;
  for (const level of ['A1', 'A2'] as const) for (let seed = 0; seed < 52; seed++) {
    const lesson = lessonSchema.parse(corpusLesson(bank, new Set(), seed, 160, level, [], 'matching', [], operation));
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const unused = corpusWorkedExample(lesson.materials[0], seed, level);
    if (unused) { sourceExamples++; expect(lesson.workedExample).toEqual(unused); }
    else {
      missing[level].push(seed);
      for (const [locale, marker] of [['en', 'Example:'], ['zh-Hans', '示例：'], ['zh-Hant', '示例：']] as const) {
        const example = lesson.workedExample![locale];
        expect(example).toContain(marker); expect(example).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i); expect(example).toContain('Zora'); expect(example).toContain('Timo'); expect(example).toContain('red kite');
        expect(example).toContain(locale === 'en' ? '→ “Timo has a red kite.”: Zora.' : locale === 'zh-Hans' ? '→ “Timo has a red kite.”：Zora。' : '→ 「Timo has a red kite.」：Zora。');
      }
      expect(lesson.workedExample!['zh-Hans']).not.toBe(lesson.workedExample!.en);
      expect(lesson.workedExample!['zh-Hant']).not.toBe(lesson.workedExample!['zh-Hans']);
    }
    const original = structuredClone(lesson), reapplied = corpusStartingPoint(lesson, level), test = asTestLesson(reapplied);
    expect(lesson).toEqual(original);
    expect(test.teaching).toBeUndefined(); expect(test.workedExample).toBeUndefined(); expect(test.nextStep).toBeUndefined();
    for (const [index, material] of lesson.materials.entries()) {
      const question = material.questions[0];
      expect(corpusOperation(question)).toBe(operation);
      if (!('kind' in question) || question.kind !== 'matching') throw new Error('Expected speaker matching');
      expect(reapplied.materials[index].blocks).toEqual(material.blocks);
      expect(reapplied.materials[index].questions[0]).toEqual(question);
      if (!unused) for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) for (const pair of question.pairs) {
        expect(lesson.workedExample![locale]).not.toContain(pair.label);
        expect(lesson.workedExample![locale]).not.toContain(pair.answer);
      }
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => pair.answer).reverse()).correct).toBe(false);
      expect(test.materials[index].blocks).toEqual(material.blocks);
      expect(test.materials[index].questions[0]).toEqual({ ...question, hints: undefined });
      expect(test.materials[index].questions.every(question => !question.hints)).toBe(true);
    }
  }
  expect(sourceExamples).toBe(99);
  expect(missing).toEqual({ A1: [8, 24, 40], A2: [14, 46] });
});

it('demonstrates room matching when needed and preserves unused-source examples and exact questions', () => {
  const operation = `matching:${roomMatchingPrompt}`;
  let sourceExamples = 0, fallbacks = 0;
  for (const level of ['A1', 'A2'] as const) for (let seed = 0; seed < 12; seed++) {
    const lesson = lessonSchema.parse(corpusLesson(bank, new Set(), seed, 160, level, [], 'matching', [], operation));
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const unused = corpusWorkedExample(lesson.materials[0], seed, level);
    expect(!!unused).toBe(seed % 2 === 0);
    if (unused) { sourceExamples++; expect(lesson.workedExample).toEqual(unused); }
    else {
      fallbacks++;
      for (const [locale, marker] of [['en', 'Example:'], ['zh-Hans', '示例：'], ['zh-Hant', '示例：']] as const) {
        expect(lesson.workedExample![locale]).toContain(marker); expect(lesson.workedExample![locale]).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
        expect(lesson.workedExample![locale]).toContain('Mira');
        expect(lesson.workedExample![locale]).toContain('rest');
        expect(lesson.workedExample![locale]).toContain('sun room');
      }
      expect(lesson.workedExample!['zh-Hans']).not.toBe(lesson.workedExample!.en);
      expect(lesson.workedExample!['zh-Hant']).not.toBe(lesson.workedExample!['zh-Hans']);
    }
    const original = structuredClone(lesson), reapplied = corpusStartingPoint(lesson, level);
    expect(lesson).toEqual(original);
    const test = asTestLesson(reapplied);
    expect(test.teaching).toBeUndefined(); expect(test.workedExample).toBeUndefined(); expect(test.nextStep).toBeUndefined();
    for (const [index, material] of lesson.materials.entries()) {
      const question = material.questions[0];
      expect(corpusOperation(question)).toBe(operation);
      if (!('kind' in question) || question.kind !== 'matching') throw new Error('Expected room matching');
      expect(reapplied.materials[index].blocks).toEqual(material.blocks);
      expect(reapplied.materials[index].questions[0]).toEqual(question);
      if (!unused || index === 0) for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) for (const pair of question.pairs) {
        expect(lesson.workedExample![locale]).not.toContain(pair.label);
        expect(lesson.workedExample![locale]).not.toContain(pair.answer);
      }
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => pair.answer).reverse()).correct).toBe(false);
      expect(test.materials[index].blocks).toEqual(material.blocks);
      expect(test.materials[index].questions[0]).toEqual({ ...question, hints: undefined });
      expect(test.materials[index].questions.every(question => !question.hints)).toBe(true);
    }
  }
  expect(sourceExamples).toBe(12); expect(fallbacks).toBe(12);
});

it('demonstrates requested-name and wrong-number distinctions without using assessed answers', () => {
  const name = corpusAddress('Taylor: I am your neighbor, Taylor Bell. But, please call me Taylor.', 0)!;
  const phone = corpusPhone("Taylor's work number is 321-0199.\nTaylor: You have the wrong number.\nTaylor: No. This is 321-0188.", 0)!;
  expect(name.name).toBe('Taylor'); expect(name.fullName).toBe('Taylor Bell');
  expect(phone.number).toBe('321-0199'); expect(phone.wrong).toBe('321-0188');
  for (const level of ['A1', 'A2'] as const) for (const operation of ['choice:requested-address', 'choice:work-phone']) {
    const roots = new Set<string>();
    for (let seed = 0; seed < 52; seed++) {
      const lesson = lessonSchema.parse(corpusLesson(bank, new Set(), seed, 160, level, [], 'choice', [], operation));
      expect(lesson).toBeDefined();
      expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
      for (const material of lesson.materials) {
        roots.add(material.rootId);
        const question = material.questions[0];
        expect(corpusOperation(question)).toBe(operation);
        if (!('options' in question)) throw new Error('Expected contact selection');
        const text = material.blocks[0].text;
        const task = operation === 'choice:requested-address' ? corpusAddress(text, seed) : corpusPhone(text, seed);
        expect(task).toBeDefined();
        expect(question.options[question.answer]).toBe(task!.options[task!.answer]);
        for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
          const example = lesson.workedExample![locale];
          expect(example).toContain(operation === 'choice:requested-address' ? name.name : phone.number);
          expect(example).toContain(operation === 'choice:requested-address' ? name.fullName : phone.wrong);
          for (const option of question.options) expect(example).not.toContain(option);
        }
        expect(score(question, question.answer).correct).toBe(true);
        expect(score(question, 1 - question.answer).correct).toBe(false);
      }
      expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      expect(lesson.workedExample!['zh-Hans']).toContain('示例：'); expect(lesson.workedExample!['zh-Hans']).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      expect(lesson.workedExample!['zh-Hant']).toContain('示例：'); expect(lesson.workedExample!['zh-Hant']).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      expect(lesson.teaching!['zh-Hans']).not.toBe(lesson.teaching!.en);
      expect(lesson.teaching!['zh-Hant']).not.toBe(lesson.teaching!['zh-Hans']);
    }
    expect(roots.size).toBeGreaterThan(2);
  }
});

it('keeps exact material/scoring snapshots and hides support in generated Test', () => {
  for (const operation of ['choice:requested-address', 'choice:work-phone']) {
    const practice = corpusLesson(bank, new Set(), 0, 120, 'A1', [], 'choice', [], operation)!;
    const original = structuredClone(practice);
    const reapplied = corpusStartingPoint(practice, 'A2');
    for (const [index, material] of reapplied.materials.entries()) {
      expect(material.blocks).toEqual(practice.materials[index].blocks);
      const exactHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
      expect(exactHash([material.blocks, material.questions[0]])).toBe(exactHash([practice.materials[index].blocks, practice.materials[index].questions[0]]));
      expect(material.questions[0]).toEqual(practice.materials[index].questions[0]);
    }
    const test = asTestLesson(reapplied);
    expect(test.teaching).toBeUndefined(); expect(test.workedExample).toBeUndefined();
    for (const [index, material] of test.materials.entries()) {
      expect(material.blocks).toEqual(reapplied.materials[index].blocks);
      const question = material.questions[0], supported = reapplied.materials[index].questions[0];
      expect(question).toEqual({ ...supported, hints: undefined });
      if (!('options' in question)) throw new Error('Expected contact selection');
      expect(score(question, question.answer)).toEqual(score(supported, question.answer));
      expect(material.questions.every(question => !question.hints)).toBe(true);
    }
    expect(practice).toEqual(original);
  }
});
