import scopes from '../../content/corpus/c1-register-audience-scopes.json';
const local = (en: string, hans: string, hant: string) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });
export const registerAudienceOperation = 'matching:register-audience';
export const registerAudiencePrompt = 'Match each quoted passage to the interpretation best supported by its wording, voice and audience in the complete context. A courteous formula alone does not establish a relationship or a private feeling.';
const roles = {
  intimate: ['An intimate personal greeting to the named correspondent', '写给具名收信人的亲密私人称呼', '寫給具名收信人的親密私人稱呼'],
  adapted: ['Formal regards adapted to a close personal relationship', '有意把正式问候改成适合亲密关系的表达', '有意把正式問候改成適合親密關係的表達'],
  quoted: ['Warm words belong to a quoted speaker within the personal letter', '私人书信内引述另一说话者的亲切话语', '私人書信內引述另一說話者的親切話語'],
  distance: ['Courtesy accompanies a denial of special affection and creates distance', '客套语言伴随对特殊感情的否认，拉开关系距离', '客套語言伴隨對特殊感情的否認，拉開關係距離'],
  formula: ['A deferential closing, without proving employment or unlimited obedience', '惯用的谦恭结尾，不能据此确立雇佣或无限服从', '慣用的謙恭結尾，不能據此確立僱傭或無限服從'],
  outside: ['The outer narrative challenges the letter’s courteous self-presentation', '外层叙述对书信的评价，不等于信内的客套自述', '外層敘述對書信的評價，不等於信內的客套自述'],
  aside: ['A personal aside adds familiarity within a formal public address', '正式公开演讲内的个人插语增添熟悉感', '正式公開演講內的個人插語增添熟悉感'],
  public: ['Formal titles acknowledge the institutional audience of the address', '正式职衔明确演讲面对的机构受众', '正式職銜明確演講面對的機構受眾'],
  institution: ['Public language credits the institution with collective action', '面向公众的机构语言把集体行动归于该组织', '面向公眾的機構語言把集體行動歸於該組織'],
  field: ['Guidance qualified by the audience’s different writing fields', '根据受众写作领域的差异，限定建议的适用范围', '根據受眾寫作領域的差異，限定建議的適用範圍'],
  explain: ['Expanded name and short form explain a resource for unfamiliar users', '展开名称并说明简称，帮助不熟悉资源的受众理解', '展開名稱並說明簡稱，幫助不熟悉資源的受眾理解'],
  teachers: ['Guidance includes teachers, alongside student writers', '建议把教师也列为使用者，不只面向学生作者', '建議把教師也列為使用者，不只面向學生作者'],
  literal: ['The formula proves private feelings and the recipient’s agreement', '惯用表达证明了说话者的真实内心及受话者已同意', '慣用表達證明了說話者的真實內心及受話者已同意'],
  universal: ['One style and set of rules required for every audience and purpose', '所有受众及目的都必须采用同一语体和规则', '所有受眾及目的都必須採用同一語體和規則'],
} as const;
type Role = keyof typeof roles;
function interpretation(part: string, whole: string): Role | undefined {
  if (/My dearest Lucy/.test(part) && /Unopened by her/.test(whole)) return 'intimate';
  if (/‘respectful duty,’/.test(part) && /simply his ‘love’ instead/.test(part)) return 'adapted';
  if (/My dears, I want/.test(part) && /I have left you everything/.test(part) && /Hawkins said/.test(whole)) return 'quoted';
  if (/My esteem for your whole family/.test(part) && /affections have been long engaged elsewhere/.test(part)) return 'distance';
  if (/Your most obedient/.test(part) && /humble servant/.test(part) && /returning the letters/.test(whole)) return 'formula';
  if (/With what indignation/.test(part) && /every line was an insult/.test(part)) return 'outside';
  if (/as one who has taken some interest in the election of Presidents/.test(part) && /Mr. Secretary General, delegates to the United Nations/.test(whole)) return 'aside';
  if (/Mr. Secretary General, delegates to the United Nations, ladies and gentlemen/.test(part)) return 'public';
  if (/Rising to its responsibility, the United Nations helped/.test(part)) return 'institution';
  if (/rules are different for different fields/.test(part) && /business, technology, government, or academic writing/.test(part)) return 'field';
  if (/Online Writing Lab, or OWL for short/.test(part)) return 'explain';
  if (/resources for writing teachers/.test(part) && /Teachers can download presentations/.test(part)) return 'teachers';
}
export function corpusRegisterAudience(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || text.length > 12000) throw new Error('INVALID_REGISTER_AUDIENCE');
  // shortcut: only inspected complete contexts; extend after reviewing competing voices and audience interpretations.
  const scope = [...scopes.reading, ...scopes.listening].find(s => s.text === text);
  if (!scope) return;
  const all = scope.parts.map(part => ({ ...part, role: interpretation(text.slice(part.start, part.end), text) }));
  if (all.length !== 3 || all.some(p => !p.role || p.start < 0 || p.end <= p.start || p.end > text.length) || new Set(all.map(p => p.role)).size !== 3) return;
  const selected = seed % 2 ? all.filter((_, i) => i !== Math.floor(seed / 2) % 3) : all;
  const choices = [...all.map(p => roles[p.role!][0]), roles.literal[0], roles.universal[0]];
  choices.push(...choices.splice(0, seed % choices.length));
  return { prompt: registerAudiencePrompt, pairs: selected.map(p => ({ label: p.label, answer: roles[p.role!][0] })), choices,
    evidence: { start: all[0].start, end: all[0].end }, otherEvidence: all.slice(1).map(p => ({ start: p.start, end: p.end })),
    explanation: local(
      all.map(p => `${p.label}: ${roles[p.role!][0]}.`).join(' ') + ' Keep the speaker, audience and complete frame. Courtesy does not by itself prove sincerity, intimacy, literal service or acceptance. A change of voice is not a change in the same speaker’s attitude; qualified guidance does not impose universal rules. An observed response requires evidence beyond a formula.',
      all.map(p => `${p.label}：${roles[p.role!][1]}。`).join(' ') + ' 保留说话者、受众及完整框架。客套本身不能证明真诚、亲密、实际服务或已被接受；换了声音不等于同一说话者改变态度，有适用条件的建议也不是统一规则。实际反应需要套语以外的证据。',
      all.map(p => `${p.label}：${roles[p.role!][2]}。`).join(' ') + ' 保留說話者、受眾及完整框架。客套本身不能證明真誠、親密、實際服務或已被接受；換了聲音不等於同一說話者改變態度，有適用條件的建議也不是統一規則。實際反應需要套語以外的證據。'),
  };
}
export const registerAudienceSupport = {
  goal: local('Explain how wording suits an audience and relationship, distinguishing quoted voices, conventional courtesy and supported limits.', '解释措辞怎样适合受众及关系，区分引述声音、惯用客套与有依据的适用边界。', '解釋措辭怎樣適合受眾及關係，區分引述聲音、慣用客套與有依據的適用邊界。'),
  teaching: local('Identify who is speaking or writing, to whom, for what purpose, and within whose account. Compare titles, greetings, expanded terms, qualifications and endings with the actual message. Formal language can express distance; a personal aside can occur in a formal address. Do not infer sincerity or acceptance from a formula. Read or replay the complete context before matching. Vocabulary: regards are greetings; esteem is respect; a deferential formula expresses conventional respect; an institutional audience represents an organization. Historical names and writing guides supply context, not current recommendations.', '先确认谁在说或写、面向谁、目的是什么、嵌在谁的叙述里。把职衔、称呼、术语解释、限定和结尾与实际内容比较。正式语言可能拉开距离，正式演讲也可以带个人插语。不能从惯用客套推断真诚或已被接受。完整阅读或重听后再匹配。词汇：regards是问候，esteem是尊重，deferential formula是表达惯常敬意的套语，institutional audience是代表机构的受众。历史人名及写作指南用于理解原文，不是当前推荐。', '先確認誰在說或寫、面向誰、目的是什麼、嵌在誰的敘述裡。把職銜、稱呼、術語解釋、限定和結尾與實際內容比較。正式語言可能拉開距離，正式演講也可以帶個人插語。不能從慣用客套推斷真誠或已被接受。完整閱讀或重聽後再匹配。詞彙：regards是問候，esteem是尊重，deferential formula是表達慣常敬意的套語，institutional audience是代表機構的受眾。歷史人名及寫作指南用於理解原文，不是目前推薦。'),
  workedExample: local('Complete unscored invented example: A museum notice says, “Dear visitors, please leave bags at reception. Staff can help.” A friend then texts, “Hi Jo, leave your bag with me!” Both concern bags, but the notice addresses public visitors through a courteous instruction and a staff role; the text addresses a named friend personally. Neither message proves that a bag has been handed over. “Dear” alone does not establish intimacy. The audience, purpose and complete wording support the comparison.', '完整不计分虚构示例：博物馆告示写：“Dear visitors, please leave bags at reception. Staff can help.” 朋友随后发信息：“Hi Jo, leave your bag with me!” 两者都谈包，但告示用客气指令和工作人员角色面向公众参观者，信息则亲自面向具名朋友。两条信息都不能证明包已交出，Dear本身也不证明亲密。须结合受众、目的和完整措辞比较。', '完整不計分虛構示例：博物館告示寫：「Dear visitors, please leave bags at reception. Staff can help.」朋友隨後傳訊息：「Hi Jo, leave your bag with me!」兩者都談包，但告示用客氣指令和工作人員角色面向公眾參觀者，訊息則親自面向具名朋友。兩條訊息都不能證明包已交出，Dear本身也不證明親密。須結合受眾、目的和完整措辭比較。'),
  nextStep: local('Without hints, apply the same audience-and-relationship comparison to the other original. Cite exact wording and explain why a literal, universal or wrong-voice interpretation fails.', '在另一原作中不用提示，独立比较受众及关系。引用精确措辞，说明字面化、绝对化或混淆声音的解读为什么不成立。', '在另一原作中不用提示，獨立比較受眾及關係。引用精確措辭，說明字面化、絕對化或混淆聲音的解讀為什麼不成立。'),
  hints: [local('Return to the goal: who addresses whom, for what purpose?', '回到目标：谁面向谁，目的是什么？', '回到目標：誰面向誰，目的是什麼？'), local('Locate the greeting or title, the substantive message and the surrounding voice.', '定位称呼或职衔、实质内容及外层声音。', '定位稱呼或職銜、實質內容及外層聲音。'), local('Compare wording with context: courtesy alone does not establish intimacy or acceptance; keep any audience or field limitation.', '把措辞与语境比较：客套本身不确立亲密或接受，保留受众及领域限定。', '把措辭與語境比較：客套本身不確立親密或接受，保留受眾及領域限定。')],
};
