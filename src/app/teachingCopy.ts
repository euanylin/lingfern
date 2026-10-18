/** Clean older saved examples without changing their lesson or content hash. */
export function teachingExample(text: string | undefined) {
  return text
    ?.replace(/^(?:Unscored made-up transcript|Made-up examples?|Illustrative (?:example|relation)):\s*/i, 'Example: ')
    .replace(/^(?:虚构文字示范（不评分）|虛構文字示範（不評分）|虚构示例|虛構示例)[：:]\s*/, '示例：')
    .replace(/^((?:Example|示例)[:：]\s*)[“「]([^”」]+)[”」]\s*→\s*([“「]([^”」]+)[”」]\s*→\s*[“「]([^”」]+)[”」]\s*→\s*[“「]([^”」]+)[”」])/, (match, label, paragraph, steps, first, second, third) =>
      paragraph === [first, second, third].join(' ') ? label + steps : match)
    .replace(/Keep the complete sentences in the order given[.;] (?:do not infer when events happened|Do not guess when events happened)\./, 'Keep sentence order.')
    .replace('按材料给出的顺序排列完整句子，不推断事件发生的时间。', '按句子顺序排列。')
    .replace('按材料給出的順序排列完整句子，不推斷事件發生的時間。', '按句子順序排列。');
}
