import { expect, it } from 'vitest';
import { teachingExample } from '../src/app/teachingCopy';

it('cleans saved example labels without modifying source statements or missing support', () => {
  expect(teachingExample(undefined)).toBeUndefined();
  for (const label of ['Unscored made-up transcript:', 'Made-up example:', 'Made-up examples:', 'Illustrative example:', 'Illustrative relation:'])
    expect(teachingExample(`${label} “A clear sentence.”`)).toBe('Example: “A clear sentence.”');
  for (const label of ['虚构文字示范（不评分）：', '虛構文字示範（不評分）：', '虚构示例：', '虛構示例：'])
    expect(teachingExample(`${label}“A clear sentence.”`)).toBe('示例：“A clear sentence.”');
  const source = 'Example: “The speaker said unscored work remained.” → “1903”.';
  expect(teachingExample(source)).toBe(source);
});

it('shows the saved listening sequence once and retains its order', () => {
  const text = '虚构文字示范（不评分）：“Mina opens a window. She looks at the garden. She closes the window.” → “Mina opens a window.” → “She looks at the garden.” → “She closes the window.”按材料给出的顺序排列完整句子，不推断事件发生的时间。';
  expect(teachingExample(text)).toBe('示例：“Mina opens a window.” → “She looks at the garden.” → “She closes the window.”按句子顺序排列。');
  expect(text).toContain('虚构文字示范（不评分）');
  const other = 'Made-up example: “Mira reads a note. She writes an answer. She closes the book.” → “Mira reads a note.” → “She writes an answer.” → “She closes the book.”';
  expect(teachingExample(other)).toBe('Example: “Mira reads a note.” → “She writes an answer.” → “She closes the book.”');
  const different = 'Example: “A different sentence.” → “First sentence.” → “Second sentence.” → “Third sentence.”';
  expect(teachingExample(different)).toBe(different);
});
