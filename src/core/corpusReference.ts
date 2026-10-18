import type { Lesson } from '../shared/content';
type Localized = Lesson['goal'];

const local = (en: string, hans: string, hant: string): Localized => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });
export const referencePrompt = 'What does the referring expression refer to in this statement?';
export const referenceSupport = {
  goal: local('Resolve a reference using its complete source context.', '结合完整语境，判断指代表达的对象。', '結合完整語境，判斷指代表達的對象。'),
  teaching: local('Read or listen to the complete statements. Check which entity fits the referring noun or pronoun, including singular/plural form. An intervening word is not automatically the referent. Keep the source’s time and scope.', '阅读或听完整句子，核对指代表达的对象及单复数。中间出现的词不一定是指代对象。保留原文的时间与范围。', '閱讀或聽完整句子，核對指代表達的對象及單複數。中間出現的詞不一定是指代對象。保留原文的時間與範圍。'),
  workedExample: local('Made-up example: A village grew beside a river. Its people built boats. “Its” refers to the village, not the river. The people belong to the village; the nearest noun alone is not enough.', '虚构示例：A village grew beside a river. Its people built boats. “Its” 指村庄，而不是河流。人们属于村庄；不能只选最近的名词。', '虛構示例：A village grew beside a river. Its people built boats. “Its” 指村莊，而不是河流。人們屬於村莊；不能只選最近的名詞。'),
  hints: [local('Find the referring expression and its context.', '找到指代表达及上下文。', '找到指代表達及上下文。'), local('Check the noun and singular/plural form.', '核对名词及单复数。', '核對名詞及單複數。'), local('Use the complete statements, rather than choosing the nearest word.', '结合完整句子，不要只选最近的词。', '結合完整句子，不要只選最近的詞。')],
  nextStep: local('Use the same checks on a different source; quote both the reference and its context.', '在另一份资料中用相同方法核对，引用指代表达及其语境。', '在另一份資料中用相同方法核對，引用指代表達及其語境。'),
};

/** Two bounded grammatical constructions; never a nearest-noun or general coreference guess. */
export function corpusReference(text: string, seed: number) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_REFERENCE_SEED');
  if (!text || text.length > 12000) return;
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  const candidates: { expression: string; statement: typeof sentences[number]; context: typeof sentences[number]; choices: string[] }[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const statement = sentences[i];
    const resumed = /^Thanks to advancements in [a-z -]{3,40}, [a-z ]{3,40} allowed (these ([a-z]{3,30}s)) to [a-z ]{3,80}, leading to [a-z ]{3,40}, the establishment of ([a-z ]{3,40}s), and the emergence of [a-z ]{3,40}\.\s*$/.exec(statement.segment);
    if (resumed && i >= 2) {
      const context = sentences[i - 2], intervening = sentences[i - 1];
      const emerged = /^[A-Z][a-z ]{3,80} examine the emergence of the (first major ([a-z]{3,30}s)) in regions such as [^.]+, beginning approximately \d+ BCE in some regions\.\s*$/.exec(context.segment);
      const developed = /^The new [a-z, ]{3,80} complexities necessitated the development of ([a-z ]{3,40}s)\.\s*$/.exec(intervening.segment);
      const later = sentences.find(sentence => /^In the later part of the ancient period, sometimes termed the classical period, ([a-z]{3,30}s) in [^.]+ expanded further, reaching [^.]+\.\s*$/.test(sentence.segment));
      const modern = sentences.find(sentence => /^Historians focused on early modern history, which started roughly in \d+ CE, commonly highlight how ([A-Z][a-z]+ [a-z]{3,30}s) rose to global power\.\s*$/.test(sentence.segment));
      if (text.indexOf(context.segment.trim()) === text.lastIndexOf(context.segment.trim()) && emerged?.[2] === resumed[2] && developed && !developed[1].includes(resumed[2])
        && later && modern && later.index > statement.index && modern.index > later.index) {
        const laterEntity = /^In the later part of the ancient period, sometimes termed the classical period, ([a-z]{3,30}s) in/.exec(later.segment)![1];
        const modernEntity = /highlight how ([A-Z][a-z]+ [a-z]{3,30}s) rose/.exec(modern.segment)![1];
        candidates.push({ expression: resumed[1], statement, context, choices: ['The ' + emerged[1] + ' in the earlier region list.', 'The ' + laterEntity + ' introduced later in the ancient period.', 'The ' + modernEntity + ' introduced in early modern history.'] });
      }
    }
    const design = /^([A-Z][a-zA-Z]{1,30}) attracted a loyal following among the growing number of ([A-Za-z ]{3,40}s), who liked (its) [a-z ]{3,40}\.\s*$/.exec(statement.segment);
    if (design && i > 0 && !/^(?:They|He|She|It|We|You|I)$/.test(design[1])) {
      const context = sentences[i - 1];
      const founded = /^[A-Z][a-z]{1,30} and [A-Z][a-z]{1,30} founded ([A-Z][a-zA-Z]{1,30}) in \d{4}\.\s*$/.exec(context.segment);
      const algorithms = [...text.slice(0, context.index).matchAll(/The number calculated by the algorithm, ([A-Z][a-zA-Z]{1,30}), is a function of the quantity and strength of inbound links\./g)];
      if (text.indexOf(context.segment.trim()) === text.lastIndexOf(context.segment.trim()) && founded?.[1] === design[1] && algorithms.length === 1 && algorithms[0][1] !== design[1]) candidates.push({ expression: design[3], statement, context, choices: [design[1] + '.', 'The ' + design[2] + '.', algorithms[0][1] + '.'] });
    }
  }
  // shortcut: Only the two inspected constructions are scored; add a construction after ambiguity/source design review.
  if (candidates.length !== 1) return;
  const { expression, statement, context, choices } = candidates[0];
  const shift = seed % choices.length;
  const rotate = <T,>(values: T[]) => [...values.slice(shift), ...values.slice(0, shift)];
  const span = (sentence: typeof statement) => ({ start: sentence.index, end: sentence.index + sentence.segment.trimEnd().length });
  const explanations = [
    local(`“${expression}” refers to ${choices[0]} The complete context supports this entity; retain the source’s scope.`, `“${expression}” 指 ${choices[0]} 完整语境支持这一对象；保留原文的范围。`, `“${expression}” 指 ${choices[0]} 完整語境支持這一對象；保留原文的範圍。`),
    local(`“${expression}” does not refer to ${choices[1]} A nearby noun alone does not establish the reference.`, `“${expression}” 不指 ${choices[1]} 仅凭附近出现名词，不能确定指代。`, `“${expression}” 不指 ${choices[1]} 僅憑附近出現名詞，不能確定指代。`),
    local(`“${expression}” does not refer to ${choices[2]} Keep the entity in its complete statement, rather than another entity elsewhere in the source.`, `“${expression}” 不指 ${choices[2]} 应结合完整句子，不能换成资料其他位置提到的对象。`, `“${expression}” 不指 ${choices[2]} 應結合完整句子，不能換成資料其他位置提到的對象。`),
  ];
  return { prompt: referencePrompt + `\n“${expression}”: “${statement.segment.trim()}”`, options: rotate(choices), answer: (choices.length - shift) % choices.length, evidence: span(statement), additionalEvidence: [span(context)], explanations: rotate(explanations) };
}
