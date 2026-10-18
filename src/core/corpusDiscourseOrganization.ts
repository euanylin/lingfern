import scopes from '../../content/corpus/c1-discourse-organization-scopes.json';
import { sentenceSegments } from './corpusSegments';
const local = (en: string, hans: string, hant: string) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });
export const discourseOrganizationPrompt = 'Match each named part to its main function in the organization of the complete account. Use its relationship to the other parts, not just its subject or date.';
export const discourseOrganizationOperation = 'matching:discourse-organization';
const roles = {
  setting: 'Establishes a setting and a qualified emotional effect',
  reversal: 'Reverses the earlier emotional state and motivates a renewed attempt',
  reflection: 'Moves from concrete description to a general reflection on human vulnerability',
  limits: 'Qualifies the available evidence and explains limits of the comparisons',
  countercases: 'Introduces tentative countercases supported by observations and reports',
  hypothesis: 'Develops explanatory alternatives while acknowledging a lack of direct evidence',
  overview: 'Summarizes the main case and its outcome before the detailed account',
  background: 'Returns to earlier attempts and conditions that explain the background',
  return: 'Returns to the main proposal and details how its outcome was reached',
  systems: 'Broadens a familiar image through connected examples of different ecosystems',
  mechanisms: 'Shifts from examples to processes explaining how the systems change',
  proof: 'Establishes an unconditional proof that removes every uncertainty',
  unrelated: 'Abandons the earlier subject for an unrelated topic',
};
type Role = keyof typeof roles;
const evidenceCues: Partial<Record<Role, RegExp>> = {
  setting: /consolation|although they did not remove my grief/,
  reversal: /soul-inspiriting fled|remembered the effect/,
  reflection: /I looked on the valley|Why does man|If our impulses|but now we are moved/,
  limits: /few experiments have been fairly tried|avoid the ill effects/,
  countercases: /some reason to believe|I am assured by two/,
  hypothesis: /must either|rests on no direct evidence/,
  overview: /was a proposed|voters rejected/,
  background: /When .* became a state|In 1855|On May 13|Supreme Court ruled/,
  return: /was proposed by|proposal received|Therefore,/,
  systems: /other ecosystems are just as vital|transitional zone|also considered part/,
  mechanisms: /always changing|sustain and transform|fragile and resilient|Minor fluctuations/,
};
const roleChinese: Record<Role, [string, string]> = {
  setting: ['建立场景并说明有限的情绪作用', '建立場景並說明有限的情緒作用'],
  reversal: ['逆转先前情绪，并说明再次尝试的动机', '逆轉先前情緒，並說明再次嘗試的動機'],
  reflection: ['从具体描写转向对人类脆弱性的概括反思', '從具體描寫轉向對人類脆弱性的概括反思'],
  limits: ['限定现有证据并解释比较的局限', '限定現有證據並解釋比較的局限'],
  countercases: ['以观察与报告提出暂定反例', '以觀察與報告提出暫定反例'],
  hypothesis: ['展开解释性的备选假说，同时承认缺少直接证据', '展開解釋性的備選假說，同時承認缺少直接證據'],
  overview: ['在详细叙述前概述主事件及结果', '在詳細敘述前概述主事件及結果'],
  background: ['回溯较早的尝试及条件，交代背景', '回溯較早的嘗試及條件，交代背景'],
  return: ['回到主提议，详述结果怎样产生', '回到主提議，詳述結果怎樣產生'],
  systems: ['通过相互联系的不同生态实例，拓宽熟悉的意象', '透過相互聯繫的不同生態實例，拓寬熟悉的意象'],
  mechanisms: ['从实例转向解释系统怎样变化的过程', '從實例轉向解釋系統怎樣變化的過程'],
  proof: ['确立消除所有不确定性的无条件证明', '確立消除所有不確定性的無條件證明'],
  unrelated: ['放弃原有主题，转向无关话题', '放棄原有主題，轉向無關話題'],
};
/** Structural cues describe reusable rhetorical relations; source partitions contain no stored questions or answers. */
function functionOf(part: string, index: number, whole: string): Role | undefined {
  if (/although they did not remove my grief, they subdued/.test(part)) return 'setting';
  if (/All of soul-inspiriting fled with sleep/.test(part) && /I remembered the effect/.test(part)) return 'reversal';
  if (/Alas! Why does man/.test(part) && /but now we are moved/.test(part)) return 'reflection';
  if (/few experiments have been fairly tried/.test(part) && /avoid the ill effects/.test(part)) return 'limits';
  if (/Although I do not know of any thoroughly well-authenticated cases/.test(part) && /some reason to believe/.test(part)) return 'countercases';
  if (/must either/.test(part) && /rests on no direct evidence/.test(part)) return 'hypothesis';
  if (index === 0 && /was a proposed/.test(part) && /voters rejected/.test(part) && /Background[\s\S]+Proposal/.test(whole)) return 'overview';
  if (/When .+ became a state in \d{4}/.test(part) && /ruled in the case/.test(part) && /Background/.test(whole)) return 'background';
  if (/was proposed by/.test(part) && /referendum was held/.test(part) && /was not established/.test(part)) return 'return';
  if (/other ecosystems are just as vital/.test(part) && /transitional zone/.test(part) && /also considered part/.test(part)) return 'systems';
  if (/These ecological systems are always changing/.test(part) && /sustain and transform/.test(part) && /cycles and pulses/.test(part)) return 'mechanisms';
}
export function corpusDiscourseOrganization(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_DISCOURSE_ORGANIZATION');
  // shortcut: only complete inspected source partitions; extend after reviewing competing whole-text functions.
  const scope = [...scopes.reading, ...scopes.listening].find(scope => scope.text === text);
  if (!scope || scope.parts.length < 2 || scope.parts.length > 3) return;
  const parts = scope.parts.map((part, index) => ({ ...part, role: functionOf(text.slice(part.start, part.end), index, text) }));
  if (parts.some(part => !part.role || part.start < 0 || part.end <= part.start || part.end > text.length)
    || new Set(parts.map(part => part.role)).size !== parts.length) return;
  const all = parts.map(part => ({ label: part.label, answer: roles[part.role!], part }));
  // Ask a different structural comparison, retaining the complete unasked context.
  const selected = all.length === 3 && seed % 2 ? all.filter((_, index) => index !== Math.floor(seed / 2) % 3) : all;
  const choices = [...all.map(pair => pair.answer), roles.proof, roles.unrelated];
  const rotate = seed % choices.length; choices.push(...choices.splice(0, rotate));
  const evidence = parts.flatMap(part => sentenceSegments(text.slice(part.start, part.end))
    .filter(sentence => evidenceCues[part.role!]?.test(sentence.segment))
    .map(sentence => ({ start: part.start + sentence.index + sentence.segment.length - sentence.segment.trimStart().length,
      end: part.start + sentence.index + sentence.segment.trimEnd().length })));
  if (!evidence.length || parts.some(part => !evidence.some(span => span.start >= part.start && span.end <= part.end))) return;
  return { prompt: discourseOrganizationPrompt, pairs: selected.map(({ label, answer }) => ({ label, answer })), choices,
    evidence: evidence[0], otherEvidence: evidence.slice(1),
    explanation: local(
      all.map(pair => `${pair.label}: ${pair.answer}.`).join(' ') + ' These are the main functions in this account, not mutually exclusive topics. Read the complete part with the adjacent parts: dates alone do not explain the order, a topic label does not explain its contribution, and a qualified report is not unconditional proof. Swapping functions loses these connections; an unrelated-topic reading ignores the continued subject.',
      all.map(pair => `${pair.label}：${roleChinese[pair.part.role!][0]}。`).join(' ') + ' 这里区分各部分在整篇中的主要作用，并非互斥的主题。把完整部分与相邻部分一起看：日期本身不解释编排，主题标签不解释作用，有保留的报告不等于无条件证明。调换作用会丢失联系；“无关转题”则忽略了持续讨论的对象。',
      all.map(pair => `${pair.label}：${roleChinese[pair.part.role!][1]}。`).join(' ') + ' 這裡區分各部分在整篇中的主要作用，並非互斥的主題。把完整部分與相鄰部分一起看：日期本身不解釋編排，主題標籤不解釋作用，有保留的報告不等於無條件證明。調換作用會丟失聯繫；「無關轉題」則忽略了持續討論的對象。'),
  };
}
export const discourseOrganizationSupport = {
  goal: local('Explain how the parts build the complete account: distinguish overview, background, examples, qualification and reflection, using their relations.', '结合各部分的关系，解释它们怎样构成整篇：区分概述、背景、例子、限定与反思。', '結合各部分的關係，解釋它們怎樣構成整篇：區分概述、背景、例子、限定與反思。'),
  teaching: local('For each part, ask what it contributes and why it appears here. A summary can reveal an outcome before earlier background; examples can prepare a wider explanation; a change of scene can develop a change of thought. Keep qualifications and distinguish evidence from a hypothesis. Do not equate chronological order, a section heading or a repeated topic with rhetorical function. Read or replay the complete account before matching. Background: a referendum is a public vote; a hypothesis is a proposed explanation. Names and dates locate the discussion, not facts to memorize.', '逐部分问：它增加了什么，为什么放在这里？概述可以先透露结果，再补更早的背景；例子可以为较广的解释铺路；场景变化可以推进思想变化。保留限定，区分证据与假说。不能把时间顺序、章节标题或重复主题直接当作篇章作用。先完整阅读或重听，再匹配。背景：referendum是公民投票，hypothesis是提出的解释；人名与日期用于定位，不是要背诵的知识。', '逐部分問：它增加了什麼，為什麼放在這裡？概述可以先透露結果，再補更早的背景；例子可以為較廣的解釋鋪路；場景變化可以推進思想變化。保留限定，區分證據與假說。不能把時間順序、章節標題或重複主題直接當作篇章作用。先完整閱讀或重聽，再匹配。背景：referendum是公民投票，hypothesis是提出的解釋；人名與日期用於定位，不是要背誦的知識。'),
  workedExample: local('Unscored invented example, complete report: “The repair succeeded on Friday. Earlier in the week the team had replaced a cable without success. On Friday they tested each connection and found a loose plug.” The opening summarizes the result; the second sentence supplies earlier unsuccessful background; the last returns to the successful repair and explains its mechanism. Moving the second sentence after the last would change the progression. “Every repair always succeeds” is unsupported. This explains organization rather than merely listing Monday before Friday.', '完整不计分虚构示例：“The repair succeeded on Friday. Earlier in the week the team had replaced a cable without success. On Friday they tested each connection and found a loose plug.” 开头概述结果，第二句补充更早的失败背景，最后回到成功修理并解释机制。把第二句放到最后，会改变叙述推进。“每次修理都会成功”没有依据。这里解释编排作用，而非只把周一排在周五前。', '完整不計分虛構示例：「The repair succeeded on Friday. Earlier in the week the team had replaced a cable without success. On Friday they tested each connection and found a loose plug.」開頭概述結果，第二句補充更早的失敗背景，最後回到成功修理並解釋機制。把第二句放到最後，會改變敘述推進。「每次修理都會成功」沒有依據。這裡解釋編排作用，而非只把週一排在週五前。'),
  nextStep: local('On the other original without hints, match the functions and cite the language linking adjacent parts. Explain what a reversed or absolute interpretation would lose.', '在另一原作中不用提示匹配作用，并引用连接相邻部分的语言，说明倒置或绝对化理解会丢失什么。', '在另一原作中不用提示匹配作用，並引用連接相鄰部分的語言，說明倒置或絕對化理解會丟失什麼。'),
  hints: [local('Identify the goal: how does each part contribute to the complete account?', '先回到目标：每部分怎样构成整篇？', '先回到目標：每部分怎樣構成整篇？'), local('Compare the beginning and end of each part with its neighbours; locate a return, change or qualification.', '把每部分的开头、结尾与相邻部分比较，定位回返、变化或限定。', '把每部分的開頭、結尾與相鄰部分比較，定位回返、變化或限定。'), local('A summary can precede its background; examples can lead to an explanation. Check the whole relation, not just the date or heading.', '概述可以先于背景，例子可以引出解释；检查整体关系，不只看日期或标题。', '概述可以先於背景，例子可以引出解釋；檢查整體關係，不只看日期或標題。')],
};
export const readingDiscourseOrganizationSupport = { ...discourseOrganizationSupport,
  teaching: local(discourseOrganizationSupport.teaching.en + ' Vocabulary: consolation means comfort; melancholy is deep sadness; sublime describes overwhelming grandeur. A genus groups species; a hybrid has parents from different groups; fertile means able to reproduce. These are historical literary and scientific accounts, not current advice or established modern findings.', discourseOrganizationSupport.teaching['zh-Hans'] + ' 词汇：consolation是慰藉，melancholy是深沉忧郁，sublime指令人震撼的壮美；genus是生物分类中的属，hybrid指杂交后代，fertile指有繁殖能力。这里阅读历史文学与科学论述，不把历史主张当当前建议或现代已证实结论。', discourseOrganizationSupport.teaching['zh-Hant'] + ' 詞彙：consolation是慰藉，melancholy是深沉憂鬱，sublime指令人震撼的壯美；genus是生物分類中的屬，hybrid指雜交後代，fertile指有繁殖能力。這裡閱讀歷史文學與科學論述，不把歷史主張當目前建議或現代已證實結論。'),
};
export const heardDiscourseOrganizationSupport = { ...discourseOrganizationSupport,
  teaching: local(discourseOrganizationSupport.teaching.en + ' Vocabulary: disestablished means abolished; opposition means resistance to a proposal. Sawgrass is a wetland plant; sloughs are slow-water channels; hammocks are slightly raised wooded areas; mangroves grow near salty coastal water. The recording may announce headings, contents or an image description: distinguish these reader cues from the article body. No image is needed to answer. County history is not current legal guidance.', discourseOrganizationSupport.teaching['zh-Hans'] + ' 词汇：disestablished是撤销，opposition是对提议的反对；sawgrass是湿地植物，slough是缓流水道，hammock是稍高的林地，mangrove是近海咸水环境的红树林。录音可能读出标题、目录或图片说明；须区分朗读者的结构提示与文章正文。答题不需要图片；县史不作为当前法律指引。', discourseOrganizationSupport.teaching['zh-Hant'] + ' 詞彙：disestablished是撤銷，opposition是對提議的反對；sawgrass是濕地植物，slough是緩流水道，hammock是稍高的林地，mangrove是近海鹹水環境的紅樹林。錄音可能讀出標題、目錄或圖片說明；須區分朗讀者的結構提示與文章正文。答題不需要圖片；縣史不作為目前法律指引。'),
};
