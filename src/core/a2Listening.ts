import ruleSources from '../../public/audio/a2-speech/RULE.json';
import { z } from 'zod';
import sources from '../../public/audio/a2-speech/PERSONAL.json';
import reasonSources from '../../public/audio/a2-speech/REASON.json';
import changeSources from '../../public/audio/a2-speech/UPDATE.json';
import orderSources from '../../public/audio/a2-speech/ORDER.json';
import { lessonSchema, recordingSchema, sourceCreditSchema, type Lesson } from '../shared/content';
import { validateSentenceSegments } from './beginnerListening';
import { heardPersonalNeedPrompt, heardPersonalPreferencePrompt, heardActionOrderPrompt, heardChangePrompt, heardReasonPrompt, heardRulePrompt, heardIntegrationPrompt } from './corpusPractice';

const sourceSchema = z.object({
  rootId: z.string().regex(/^(?:(?:voa-article|gutenberg-book|wikipedia-article)-\d+|fleurs-work-[a-f0-9]{64})$/), sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().min(1).max(300), text: z.string().min(15).max(700),
  audio: recordingSchema.extend({ src: z.string().regex(/^\/audio\/a2-speech\/[a-z0-9-]+\.mp3$/), duration: z.number().positive().max(25), synthetic: z.literal(false) }),
  credit: sourceCreditSchema,
  segments: z.array(z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1), audioStart: z.number().nonnegative(), audioEnd: z.number().positive() }).strict()).min(1).max(60),
}).strict().superRefine(validateSentenceSegments);
const admitted = { need: sources.need.map(source => sourceSchema.parse(source)), preference: sources.preference.map(source => sourceSchema.parse(source)) };
const local = (en: string, hans: string, hant: string) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });

/** Preserve source conditions when interpreting inspected recorded requirements or preferences. */
export function personalListeningLesson(input: unknown, seen: ReadonlySet<string>, seed: number, kind: 'need' | 'preference') {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || kind !== 'need' && kind !== 'preference') throw new Error('INVALID_PERSONAL_LISTENING');
  const parsed = z.array(sourceSchema).max(20).parse(input);
  // Re-review scope after changing inspected text, timing, voice, rights, or source.
  if (parsed.some(source => !admitted[kind].some(reference => JSON.stringify(source) === JSON.stringify(reference)))) throw new Error('UNKNOWN_PERSONAL_LISTENING_SOURCE');
  if (new Set(parsed.map(s => s.rootId)).size !== parsed.length || new Set(parsed.map(s => s.audio.sha256)).size !== parsed.length || new Set(parsed.map(s => s.audio.src)).size !== parsed.length) throw new Error('DUPLICATE_PERSONAL_LISTENING_SOURCE');
  const available = parsed.filter(source => !seen.has(source.audio.sha256));
  const first = available[seed % available.length], second = available.find(source => source.rootId !== first?.rootId);
  if (!first || !second) return;
  const materials = [first, second].map((source, index): Lesson['materials'][number] => {
    const needClaim = /I have to (go now|record again)\./.exec(source.text);
    const liking = /"I liked (the [a-z ]+)," answered ([A-Z][a-z]+) quietly\./.exec(source.text);
    const places = /^As for ([a-z ]+), I like them:/.exec(source.text);
    const criticised = /the ([a-z]+) was simply a bore\./.exec(source.text);
    if (kind === 'need' ? !needClaim : !places && !(liking && criticised)) throw new Error('UNSUPPORTED_PERSONAL_LISTENING_FRAME');
    const departure = needClaim?.[1] === 'go now', music = !!liking;
    const correct = kind === 'need' ? needClaim![1] : liking?.[1] ?? places![1];
    const wrong = kind === 'need' ? correct.replace(/^go now$/, 'stay here now').replace(/^record again$/, 'not record again')
      : liking ? `the ${criticised![1]}` : correct.replace(/^lonesome /, 'crowded ');
    if (wrong === correct) throw new Error('AMBIGUOUS_PERSONAL_LISTENING_FRAME');
    const options = (seed + index) % 2 ? [wrong, correct] : [correct, wrong];
    const span = kind === 'need' ? (() => { const segment = source.segments.find(s => s.text.includes('I have to'))!; return { start: segment.start, end: segment.end }; })()
      : music ? { start: source.text.indexOf('I liked'), end: source.text.indexOf('quietly.') + 'quietly.'.length }
        : { start: 0, end: source.text.indexOf('meditation.') + 'meditation.'.length };
    const evidenceFor = (range: { start: number; end: number }) => ({ start: range.start, end: range.end,
      audioStart: source.segments.find(s => s.start <= range.start && s.end > range.start)!.audioStart,
      audioEnd: source.segments.find(s => s.start < range.end && s.end >= range.end)!.audioEnd });
    const context = kind === 'need' && !departure ? source.segments.find(s => s.text === 'Are you recording?')
      : kind === 'preference' && music ? { start: 0, end: source.text.slice(0, span.start - 1).trimEnd().length } : undefined;
    const explanation = kind === 'need' ? departure
      ? local('“I have to go now” states a need to leave now, not to stay. The apartment statement and the reply “Oh” do not change it. It does not say the person has already left.', '“I have to go now”表示现在需要离开，不是留下。公寓说明及“Oh”的回应没有改变这项需要，也没有说明已经离开。', '「I have to go now」表示現在需要離開，不是留下。公寓說明及「Oh」的回應沒有改變這項需要，也沒有說明已經離開。')
      : local('“Now I have to record again” requires recording another time; “not record again” denies that requirement. The source does not specify how much is repeated or establish that the new recording is finished.', '“Now I have to record again”表示现在需要再录一次；not record again否认了这项需要。原文没有说明要重复录制多大范围，也没有证明新录制已经完成。', '「Now I have to record again」表示現在需要再錄一次；not record again否認了這項需要。原文沒有說明要重複錄製多大範圍，也沒有證明新錄製已經完成。')
      : music ? local('Felicia explicitly says “I liked the music”. The violinist is mentioned in Rose’s criticism, not as Felicia’s stated liking. Nothing here says Felicia disliked the violinist or liked only the music.', 'Felicia明说“I liked the music”。violinist（小提琴演奏者）出现在Rose的批评中，不是Felicia明说喜欢的对象。这里没有说明Felicia讨厌演奏者，或只喜欢音乐。', 'Felicia明說「I liked the music」。violinist（小提琴演奏者）出現在Rose的批評中，不是Felicia明說喜歡的對象。這裡沒有說明Felicia討厭演奏者，或只喜歡音樂。')
        : local('“As for lonesome places, I like them” keeps “them” with lonesome places. Crowded places are not the stated liking. This reports the fictional speaker’s statement without an exclusive ranking.', '“As for lonesome places, I like them”中的them指前面的僻静地方，没有说喜欢拥挤的地方。这是虚构人物的陈述，没有给出排他排名。', '「As for lonesome places, I like them」中的them指前面的僻靜地方，沒有說喜歡擁擠的地方。這是虛構人物的陳述，沒有給出排他排名。');
    const id = `corpus-${source.audio.sha256}`;
    return { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, audio: source.audio, credit: source.credit,
      blocks: [{ id, text: source.text }], questions: [{ id: `${id}-${kind === 'need' ? 'need' : 'like'}`, blockId: id,
        prompt: kind === 'need' ? heardPersonalNeedPrompt : `${heardPersonalPreferencePrompt}${liking?.[2] ?? 'the speaker'} say they ${music ? 'liked' : 'like'}?`, options, answer: options.indexOf(correct),
        evidence: evidenceFor(span), ...(context ? { additionalEvidence: [{ blockId: id, ...evidenceFor(context) }] } : {}),
        ...(!index ? { hints: [local('Listen for the person and action or thing.', '留意人物及动作或事物。', '留意人物及動作或事物。'), kind === 'need' ? local('Listen for have to; keep now and again.', '留意have to，保留now及again。', '留意have to，保留now及again。') : local('Listen for like or liked and what follows it.', '留意like或liked以及后面的对象。', '留意like或liked以及後面的對象。'), kind === 'need' ? local('A requirement is not completion. Again means doing it another time.', '需要不等于已完成；again表示再做一次。', '需要不等於已完成；again表示再做一次。') : local('Keep the named person’s liking; do not invent only, favourite or dislike.', '保留指定人物的喜好，不补写只喜欢、最喜欢或讨厌。', '保留指定人物的喜好，不補寫只喜歡、最喜歡或討厭。')] } : {}),
        explanations: options.map((_, i) => local((i === options.indexOf(correct) ? 'Correct. ' : 'This changes the stated meaning. ') + explanation.en, (i === options.indexOf(correct) ? '正确。' : '这改变了明说的意思。') + explanation['zh-Hans'], (i === options.indexOf(correct) ? '正確。' : '這改變了明說的意思。') + explanation['zh-Hant'])),
      }] };
  });
  return lessonSchema.parse({ id: `corpus-v1-a2-${kind}-${first.audio.sha256.slice(0, 16)}-${second.audio.sha256.slice(0, 16)}`, targetLevel: 'A2', skill: 'listening', reviewStatus: 'draft', sourceId: 'short-personal-utterances', goalId: kind === 'need' ? 'heard-stated-need' : 'heard-stated-preference',
    generation: { generator: 'corpus-v1', seed, startingPoint: 'A2' }, materials,
    title: kind === 'need' ? local('Listen for what is needed', '听懂需要做的事', '聽懂需要做的事') : local('Listen for what someone likes', '听懂人物的喜好', '聽懂人物的喜好'),
    goal: kind === 'need' ? local('Find the stated required action, keeping now and again without claiming completion.', '找出明说需要做的动作，保留现在与重复意义，不推成已完成。', '找出明說需要做的動作，保留現在與重複意義，不推成已完成。') : local('Find the named person’s stated liking without inventing exclusivity, ranking or dislike.', '找出指定人物明说的喜好，不推成只喜欢、排名或讨厌。', '找出指定人物明說的喜好，不推成只喜歡、排名或討厭。'),
    teaching: kind === 'need' ? local('Have to states a requirement. Now keeps its time; again means another time. Neither proves completion. Record means capture a show or sound; recording is doing that now; record again means recording another time; the source does not say how much is repeated. An apartment is a home in a building; D7 is an apartment code. “Oh” is a reaction, not a cancellation.', 'have to表示需要或必须做；now保留现在的时间，again表示再做一次。这些都不证明已经完成。record是录制节目或声音；recording是正在录制，再录一次没有说明要重复多大范围。apartment是公寓住房，D7是公寓编号；Oh是回应，不是取消需要。', 'have to表示需要或必須做；now保留現在的時間，again表示再做一次。這些都不證明已經完成。record是錄製節目或聲音；recording是正在錄製，再錄一次沒有說明要重複多大範圍。apartment是公寓住房，D7是公寓編號；Oh是回應，不是取消需要。')
      : local('Like/liked states liking; liked refers to the past. Keep the person, object and pronoun reference. Do not add only, favourite or dislike. Music is sound made for listening; a violinist plays a violin. Bore means an uninteresting person; impatiently means without patience. Lonesome means away from other people; crowded means full of people. Suitable means good for a purpose; meditation is quiet thought; accustomed means used to something; anxious means worried. These statements belong to fictional characters.', 'like/liked表示喜欢，liked指过去。保留人物、对象及代词指向，不补写只喜欢、最喜欢或讨厌。music是音乐；violinist是小提琴演奏者；bore指乏味的人，impatiently指不耐烦地。lonesome是远离人群的，crowded是拥挤的；suitable是适合的，meditation是静思，accustomed是习惯于，anxious是担心的。这些陈述来自虚构人物。', 'like/liked表示喜歡，liked指過去。保留人物、對象及代詞指向，不補寫只喜歡、最喜歡或討厭。music是音樂；violinist是小提琴演奏者；bore指乏味的人，impatiently指不耐煩地。lonesome是遠離人群的，crowded是擁擠的；suitable是適合的，meditation是靜思，accustomed是習慣於，anxious是擔心的。這些陳述來自虛構人物。'),
    workedExample: kind === 'need' ? local('Unscored made-up example: “I have to check the door again now.” Required action: check the door another time, now. “Leave it unchecked” removes the requirement; “it is already checked” invents completion.', '不计分虚构示例：“I have to check the door again now.” → 现在需要再检查一次门。“不检查”取消了需要；“已检查好”则虚构了完成。', '不計分虛構示例：「I have to check the door again now.」 → 現在需要再檢查一次門。「不檢查」取消了需要；「已檢查好」則虛構了完成。')
      : local('Unscored made-up example: “The two cafés are good. Noor says: I liked the small café.” Noor explicitly liked the small café. The other evaluation does not name Noor’s liking for the larger café. This is not an exclusive preference, a favourite ranking or dislike.', '不计分虚构示例：“The two cafés are good. Noor says: I liked the small café.” → Noor明说喜欢小咖啡馆。总体评价没有特别说Noor喜欢较大的那家；也没有说明只喜欢、最喜欢或讨厌。', '不計分虛構示例：「The two cafés are good. Noor says: I liked the small café.」 → Noor明說喜歡小咖啡館。總體評價沒有特別說Noor喜歡較大的那家；也沒有說明只喜歡、最喜歡或討厭。'),
    nextStep: local('Without hints, find the same kind of statement in the other original. Keep its person and limits.', '不用提示，在另一原作中找同类陈述，保留人物及限制。', '不用提示，在另一原作中找同類陳述，保留人物及限制。'),
  });
}

const admittedOrder = orderSources.map(source => sourceSchema.parse(source));

/** Require the inspected continuation to establish the action after "before". */
export function actionOrderListeningLesson(input: unknown, seen: ReadonlySet<string>, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_ACTION_ORDER_LISTENING');
  const parsed = z.array(sourceSchema).max(20).parse(input);
  if (parsed.some(source => !admittedOrder.some(reference => JSON.stringify(source) === JSON.stringify(reference)))) throw new Error('UNKNOWN_ACTION_ORDER_SOURCE');
  if (new Set(parsed.map(s => s.rootId)).size !== parsed.length || new Set(parsed.map(s => s.audio.sha256)).size !== parsed.length || new Set(parsed.map(s => s.audio.src)).size !== parsed.length) throw new Error('DUPLICATE_ACTION_ORDER_SOURCE');
  const available = parsed.filter(source => !seen.has(source.audio.sha256));
  const first = available[seed % available.length], second = available.find(source => source.rootId !== first?.rootId);
  if (!first || !second) return;
  const materials = [first, second].map((source, index): Lesson['materials'][number] => {
    const knock = /^He (passed the door a dozen times), before he had the courage to (go up and knock)\. But he made a dash, and did it:/.exec(source.text);
    const station = /^Philip had to (walk some five miles) before he (reached a little station),/.exec(source.text);
    if (!knock && !station) throw new Error('UNSUPPORTED_ACTION_ORDER_FRAME');
    const actions = knock ? [knock[1], knock[2]] : [station![1], station![2].replace(/^reached /, 'reach ')];
    const correct = actions.join(' → '), wrong = [...actions].reverse().join(' → ');
    const options = (seed + index) % 2 ? [wrong, correct] : [correct, wrong];
    const end = (knock ?? station)![0].length;
    const explanation = knock
      ? local('He passed the door repeatedly before approaching and knocking. “Made a dash, and did it” confirms the later action; courage or an infinitive alone would not. Reversing these actions changes before. The later question does not tell us whether the master is at home.', '他先多次经过门口，后来才上前敲门。“made a dash, and did it”确认后来确实做了；仅有勇气或不定式不能证明完成。反序会改变before。之后的问句没有说明主人是否在家。', '他先多次經過門口，後來才上前敲門。「made a dash, and did it」確認後來確實做了；僅有勇氣或不定式不能證明完成。反序會改變before。之後的問句沒有說明主人是否在家。')
      : local('Philip’s walk of some five miles comes before reaching the station. “Reached” establishes arrival; had to alone would only state a requirement. Some means about five, not an exact measurement. “Could wait” states a possibility, not a completed train wait. Reversing walk and arrival changes before.', 'Philip先步行约五英里，才到达车站。reached确认到达；仅有had to只表示需要。some five是大约五，不是精确测量。could wait表示可以等车，不证明已经等车。把步行与到站反序会改变before。', 'Philip先步行約五英里，才到達車站。reached確認到達；僅有had to只表示需要。some five是大約五，不是精確測量。could wait表示可以等車，不證明已經等車。把步行與到站反序會改變before。');
    const id = `corpus-${source.audio.sha256}`;
    return { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, audio: source.audio, credit: source.credit,
      blocks: [{ id, text: source.text }], questions: [{ id: `${id}-order`, blockId: id, prompt: heardActionOrderPrompt, options, answer: options.indexOf(correct),
        evidence: { start: 0, end, audioStart: source.segments[0].audioStart, audioEnd: source.segments.find(s => s.start < end && s.end >= end)!.audioEnd },
        ...(!index ? { hints: [local('Find the two actions whose order is asked.', '找出所问的两个动作。', '找出所問的兩個動作。'), local('Listen for before; keep the earlier action before the later one.', '留意before，保留先后关系。', '留意before，保留先後關係。'), local('Check what actually happened. Need, possibility and intention alone do not prove completion.', '核对实际发生的事。需要、可能或意图本身不能证明完成。', '核對實際發生的事。需要、可能或意圖本身不能證明完成。')] } : {}),
        explanations: options.map((_, i) => local((i === options.indexOf(correct) ? 'Correct. ' : 'The actions are reversed. ') + explanation.en, (i === options.indexOf(correct) ? '正确。' : '动作先后颠倒了。') + explanation['zh-Hans'], (i === options.indexOf(correct) ? '正確。' : '動作先後顛倒了。') + explanation['zh-Hant'])) }] };
  });
  return lessonSchema.parse({ id: `corpus-v1-a2-order-${first.audio.sha256.slice(0, 16)}-${second.audio.sha256.slice(0, 16)}`, targetLevel: 'A2', skill: 'listening', reviewStatus: 'draft', sourceId: 'short-action-order', goalId: 'heard-explicit-action-order', generation: { generator: 'corpus-v1', seed, startingPoint: 'A2' }, materials,
    title: local('Listen for action order', '听懂动作先后', '聽懂動作先後'),
    goal: local('Put the two stated actions in time order, keeping completion and uncertainty.', '按时间排列所述两个动作，保留完成与不确定范围。', '按時間排列所述兩個動作，保留完成與不確定範圍。'),
    teaching: local('Before puts one event earlier than another. Follow time, not just word order. Confirm the later action in the source: an intention, requirement or possibility alone is not completion. These are fictional journeys. Passed the door means went past it; a dozen means twelve; courage means being brave; made a dash means moved quickly; did it refers back to the approach and knock. Master means the person served in this household; my dear is a form of address. Some five miles means about five miles; a station is where trains stop; ample time for reflection means enough time to think.', 'before表示一事早于另一事，要按时间而非只按文字排列。核对后一个动作确实发生；意图、需要或可能本身不能证明完成。这是虚构人物的行程。passed the door是经过门口；a dozen是十二；courage是勇气；made a dash是快速行动；did it回指上前敲门。master在这里是受侍奉的主人；my dear是称呼。some five miles是约五英里；station是车站；ample time for reflection是有充分时间思考。', 'before表示一事早於另一事，要按時間而非只按文字排列。核對後一個動作確實發生；意圖、需要或可能本身不能證明完成。這是虛構人物的行程。passed the door是經過門口；a dozen是十二；courage是勇氣；made a dash是快速行動；did it回指上前敲門。master在這裡是受侍奉的主人；my dear是稱呼。some five miles是約五英里；station是車站；ample time for reflection是有充分時間思考。'),
    workedExample: local('Unscored made-up example: “Before she opened the box, Lina read the label.” First read the label, then opened the box. “Opened → read” reverses the time relation even though opened appears first in the sentence. Both past actions are stated; no exact minutes are supplied.', '不计分虚构示例：“Before she opened the box, Lina read the label.” 先读标签，再打开盒子。opened虽先出现，“打开→读”仍把时间颠倒。原文明说两个过去动作，没有给出相隔几分钟。', '不計分虛構示例：「Before she opened the box, Lina read the label.」先讀標籤，再打開盒子。opened雖先出現，「打開→讀」仍把時間顛倒。原文明說兩個過去動作，沒有給出相隔幾分鐘。'),
    nextStep: local('Without hints, order the actions in the other original. Check what happened and what remains uncertain.', '不用提示，在另一原作中排列动作。核对已发生与仍不确定的内容。', '不用提示，在另一原作中排列動作。核對已發生與仍不確定的內容。'),
  });
}

const admittedChange = changeSources.map(source => sourceSchema.parse(source));

// Preserve the recorded change without claiming it remains true.
export function stateChangeListeningLesson(input: unknown, seen: ReadonlySet<string>, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_STATE_CHANGE_LISTENING');
  const parsed = z.array(sourceSchema).max(20).parse(input);
  if (parsed.some(source => !admittedChange.some(reference => JSON.stringify(source) === JSON.stringify(reference)))) throw new Error('UNKNOWN_STATE_CHANGE_SOURCE');
  if (new Set(parsed.map(s => s.rootId)).size !== parsed.length || new Set(parsed.map(s => s.audio.sha256)).size !== parsed.length || new Set(parsed.map(s => s.audio.src)).size !== parsed.length) throw new Error('DUPLICATE_STATE_CHANGE_SOURCE');
  const available = parsed.filter(source => !seen.has(source.audio.sha256));
  const first = available[seed % available.length], second = available.find(source => source.rootId !== first?.rootId);
  if (!first || !second) return;
  const materials = [first, second].map((source, index): Lesson['materials'][number] => {
    const bulb = /^After hundreds of hours of operation the filament in the bulb eventually burns out and the light bulb no longer (works)\.$/.exec(source.text);
    const riches = /^The fabulous riches of the (tomb) are no longer in it, but have been removed to the (Egyptian Museum in Cairo)\.$/.exec(source.text);
    if (!bulb && !riches) throw new Error('UNSUPPORTED_STATE_CHANGE_FRAME');
    const correct = bulb ? `${bulb[1]} → no longer ${bulb[1]}` : `in the ${riches![1]} → removed to the ${riches![2]}`;
    const wrong = bulb ? `no longer ${bulb[1]} → ${bulb[1]} again` : `in the ${riches![2]} → returned to the ${riches![1]}`;
    const options = (seed + index) % 2 ? [wrong, correct] : [correct, wrong];
    const explanation = bulb
      ? local('The bulb operates first; after its filament burns out it no longer works. The recording does not report a repair or restored working. Hundreds is not an exact lifetime. The source context is an incandescent filament bulb, not all lamp technologies.', '灯泡先在运作，灯丝烧坏后不再工作。录音没有说修好或恢复工作。hundreds不是精确寿命；原作语境是有灯丝的白炽灯泡，不是所有灯具。', '燈泡先在運作，燈絲燒壞後不再工作。錄音沒有說修好或恢復工作。hundreds不是精確壽命；原作語境是有燈絲的白熾燈泡，不是所有燈具。')
      : local('The recording says the riches are no longer in the tomb and have been removed to the Egyptian Museum in Cairo. “It” refers to the tomb. The change runs away from the tomb, not back to it. This identifies the source’s report, not a verified live location or date of movement.', '录音说财宝已不在墓中，已移至开罗的埃及博物馆；it指墓。变化方向是离开墓，并非回到墓中。这是在识别材料所报告的变化，没有核实实时馆藏地点或搬移日期。', '錄音說財寶已不在墓中，已移至開羅的埃及博物館；it指墓。變化方向是離開墓，並非回到墓中。這是在識別材料所報告的變化，沒有核實即時館藏地點或搬移日期。');
    const id = `corpus-${source.audio.sha256}`;
    return { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, audio: source.audio, credit: source.credit,
      blocks: [{ id, text: source.text }], questions: [{ id: `${id}-change`, blockId: id, prompt: heardChangePrompt, options, answer: options.indexOf(correct),
        evidence: { start: 0, end: source.text.length, audioStart: source.segments[0].audioStart, audioEnd: source.segments.at(-1)!.audioEnd },
        ...(!index ? { hints: [local('Find whose state or location changes.', '找出哪个事物的状态或位置改变。', '找出哪個事物的狀態或位置改變。'), local('Listen for no longer and what happened to that same thing.', '留意no longer及同一事物后来发生的变化。', '留意no longer及同一事物後來發生的變化。'), local('Keep earlier → updated direction; do not invent repair, return or an exact date.', '保留原先→更新的方向，不补写修好、返回或确切日期。', '保留原先→更新的方向，不補寫修好、返回或確切日期。')] } : {}),
        explanations: options.map((_, i) => local((i === options.indexOf(correct) ? 'Correct. ' : 'This reverses the reported change. ') + explanation.en, (i === options.indexOf(correct) ? '正确。' : '这颠倒了材料所述变化。') + explanation['zh-Hans'], (i === options.indexOf(correct) ? '正確。' : '這顛倒了材料所述變化。') + explanation['zh-Hant'])) }] };
  });
  return lessonSchema.parse({ id: `corpus-v1-a2-change-${first.audio.sha256.slice(0, 16)}-${second.audio.sha256.slice(0, 16)}`, targetLevel: 'A2', skill: 'listening', reviewStatus: 'draft', sourceId: 'short-reported-changes', goalId: 'heard-reported-state-change', generation: { generator: 'corpus-v1', seed, startingPoint: 'A2' }, materials,
    title: local('Listen for a reported change', '听懂材料所述变化', '聽懂材料所述變化'),
    goal: local('Identify the earlier and updated state of the same thing; keep the direction of change.', '找出同一事物原先与更新后的状态，保留变化方向。', '找出同一事物原先與更新後的狀態，保留變化方向。'),
    teaching: local('Track one thing through a change. No longer means a former state has stopped; have been removed reports that something was moved away. Keep earlier → updated order, not a repair or return absent from the recording. The bulb context is the incandescent type: filament means the thin wire inside; operation means working; burns out means stops working; eventually means in the end. Hundreds gives no exact number of hours. In the museum description, fabulous riches means great wealth or valuable objects; a tomb is a burial place; it points back to the tomb. Cairo is the named city. Identify what this recording reports, without adding a movement date or treating it as live visitor information.', '追踪同一事物的变化。no longer表示原先状态不再持续；have been removed表示东西已被移走。保留原先→更新的方向，不补写录音没说的修复或返回。灯泡段落讨论白炽灯；filament是内部细灯丝，operation是运作，burns out是烧坏而停止工作，eventually是最终，hundreds没有给出确切小时数。博物馆说明中fabulous riches指大量财富或贵重物品，tomb是墓，it回指墓；Cairo是开罗。识别录音所报告的情况，不补写搬移日期或当作实时参观信息。', '追蹤同一事物的變化。no longer表示原先狀態不再持續；have been removed表示東西已被移走。保留原先→更新的方向，不補寫錄音沒說的修復或返回。燈泡段落討論白熾燈；filament是內部細燈絲，operation是運作，burns out是燒壞而停止工作，eventually是最終，hundreds沒有給出確切小時數。博物館說明中fabulous riches指大量財富或貴重物品，tomb是墓，it回指墓；Cairo是開羅。識別錄音所報告的情況，不補寫搬移日期或當作即時參觀資訊。'),
    workedExample: local('Unscored made-up example: “The notice said the gate was open. Now it says the gate is shut.” Reported change: open → shut. “Shut → open” reverses it. The notice gives no exact closing time and does not say it has reopened.', '不计分虚构示例：“The notice said the gate was open. Now it says the gate is shut.” 所述变化是开着→关着；“关着→开着”颠倒方向。告示没有给出确切关门时间，也没有说重新打开。', '不計分虛構示例：「The notice said the gate was open. Now it says the gate is shut.」所述變化是開著→關著；「關著→開著」顛倒方向。告示沒有給出確切關門時間，也沒有說重新打開。'),
    nextStep: local('Without hints, identify the other original’s earlier and updated states. Keep the same thing, direction and stated limits.', '不用提示，在另一原作中找出原先与更新状态，保留同一事物、方向和明说的限制。', '不用提示，在另一原作中找出原先與更新狀態，保留同一事物、方向和明說的限制。'),
  });
}

const admittedReason = reasonSources.map(source => sourceSchema.parse(source));

/** Match reasons to the asked action or name part, not a nearby detail. */
export function statedReasonListeningLesson(input: unknown, seen: ReadonlySet<string>, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_STATED_REASON_LISTENING');
  const parsed = z.array(sourceSchema).max(20).parse(input);
  if (parsed.some(source => !admittedReason.some(reference => JSON.stringify(source) === JSON.stringify(reference)))) throw new Error('UNKNOWN_STATED_REASON_SOURCE');
  if (new Set(parsed.map(s => s.rootId)).size !== parsed.length || new Set(parsed.map(s => s.audio.sha256)).size !== parsed.length || new Set(parsed.map(s => s.audio.src)).size !== parsed.length) throw new Error('DUPLICATE_STATED_REASON_SOURCE');
  const available = parsed.filter(source => !seen.has(source.audio.sha256));
  const first = available[seed % available.length], second = available.find(source => source.rootId !== first?.rootId);
  if (!first || !second) return;
  const materials = [first, second].map((source, index): Lesson['materials'][number] => {
    const silence = /^Peter wondered if he meant him, for you know (Peter is a great gossip)\. But he didn't say anything, because (he didn't know just what to say), and in a minute Grandfather Frog began the story Peter so much wanted\.$/.exec(source.text);
    const name = /^In each cheek is a pocket opening from the outside, and these (pockets) are lined with (hair)\. He is called Silky Pocket Mouse because of (the fineness and softness of his coat)\.$/.exec(source.text);
    if (!silence && !name) throw new Error('UNSUPPORTED_STATED_REASON_FRAME');
    const correct = silence ? silence[2] : name![3], wrong = silence ? silence[1] : `the ${name![1]} lined with ${name![2]}`;
    const options = (seed + index) % 2 ? [wrong, correct] : [correct, wrong];
    const explanation = silence
      ? local('The because-clause explicitly says Peter was silent because he did not know just what to say. His gossiping appears in the first sentence about wondering whom Frog meant, a different action. Keep the negative reason; this does not mean Peter can never speak.', 'because从句明说Peter没说话，是因为不知该说什么。第一句谈爱议论别人，是他猜Frog在指谁的另一层语境，不是这里沉默的理由。保留否定，不推成Peter永远不能说话。', 'because從句明說Peter沒說話，是因為不知該說什麼。第一句談愛議論別人，是他猜Frog在指誰的另一層語境，不是這裡沉默的理由。保留否定，不推成Peter永遠不能說話。')
      : local('The question asks about “Silky”. The because-of phrase gives the fineness and softness of the coat, meaning fur. Hair-lined cheek pockets are another detail. The full original separately links “Pocket Mice” to their pockets; do not replace the stated reason for “Silky” or deny that separate naming role.', '题目只问名称中的Silky。because of给出毛皮细密柔软的理由；颊囊内衬毛是另一细节。完整原作另用颊囊解释Pocket Mice这一类称呼，不能把那个作用换成Silky的理由，也不能说颊囊与其他名称部分无关。', '題目只問名稱中的Silky。because of給出毛皮細密柔軟的理由；頰囊內襯毛是另一細節。完整原作另用頰囊解釋Pocket Mice這一類稱呼，不能把那個作用換成Silky的理由，也不能說頰囊與其他名稱部分無關。');
    const id = `corpus-${source.audio.sha256}`;
    return { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, audio: source.audio, credit: source.credit,
      blocks: [{ id, text: source.text }], questions: [{ id: `${id}-reason`, blockId: id, prompt: heardReasonPrompt + '\n' + (silence ? 'Why did Peter not say anything?' : 'What stated reason explains “Silky” in the mouse’s name?'), options, answer: options.indexOf(correct),
        evidence: { start: 0, end: source.text.length, audioStart: 0, audioEnd: source.audio.duration },
        ...(!index ? { hints: [local('Find the exact action or word the question asks about.', '找到题目所问的具体动作或词。', '找到題目所問的具體動作或詞。'), local('Locate because or because of and its stated reason.', '找到because或because of及明说的理由。', '找到because或because of及明說的理由。'), local('A true nearby detail, or a reason for another action/name-part, may not answer this question.', '旁边的真实细节，或另一动作／名称部分的理由，不一定回答本题。', '旁邊的真實細節，或另一動作／名稱部分的理由，不一定回答本題。')] } : {}),
        explanations: options.map((_, i) => local((i === options.indexOf(correct) ? 'Correct. ' : 'This is not the stated reason for what was asked. ') + explanation.en, (i === options.indexOf(correct) ? '正确。' : '这不是题目所问的明说理由。') + explanation['zh-Hans'], (i === options.indexOf(correct) ? '正確。' : '這不是題目所問的明說理由。') + explanation['zh-Hant'])) }] };
  });
  return lessonSchema.parse({ id: `corpus-v1-a2-reason-${first.audio.sha256.slice(0, 16)}-${second.audio.sha256.slice(0, 16)}`, targetLevel: 'A2', skill: 'listening', reviewStatus: 'draft', sourceId: 'short-stated-reasons', goalId: 'heard-stated-reason', generation: { generator: 'corpus-v1', seed, startingPoint: 'A2' }, materials,
    title: local('Listen for an explicit reason', '听懂明说的原因', '聽懂明說的原因'),
    goal: local('Find the stated reason for the asked action or name-part; keep it separate from other details.', '找出所问动作或名称部分的明说原因，区分其他细节。', '找出所問動作或名稱部分的明說原因，區分其他細節。'),
    teaching: local('Because plus a clause and because of plus a noun phrase give reasons. First identify the asked person/action or word; a nearby detail or another reason is not interchangeable. These are animal books: Peter Rabbit is thinking about Grandfather Frog’s remark; the other description names a mouse. A gossip talks about other people; wondered means thought about a question. A cheek is a side of the face; a pocket is a small pouch; lined with hair means hair inside. A coat here means fur; fineness means delicate texture and softness means not rough or hard. Keep the asked part of a name separate from another part.', 'because后接从句，because of后接名词短语，都可给出原因。先认准题目所问人物／动作或词，旁边细节或另一层理由不能互换。这是动物书：Peter Rabbit在想Grandfather Frog刚才的话，另一段描写一只鼠。gossip指爱议论别人的人，wondered是心里疑问；cheek是脸颊，pocket是小囊，lined with hair指里面衬着毛；coat在这里是毛皮，fineness是细密，softness是柔软。名称中所问部分与另一部分也要区分。', 'because後接從句，because of後接名詞短語，都可給出原因。先認準題目所問人物／動作或詞，旁邊細節或另一層理由不能互換。這是動物書：Peter Rabbit在想Grandfather Frog剛才的話，另一段描寫一隻鼠。gossip指愛議論別人的人，wondered是心裡疑問；cheek是臉頰，pocket是小囊，lined with hair指裡面襯著毛；coat在這裡是毛皮，fineness是細密，softness是柔軟。名稱中所問部分與另一部分也要區分。'),
    workedExample: local('Unscored made-up example: “The boat is called Bluebird because of its blue paint. We left it in the harbour because the wind was strong.” Reason for the name: blue paint. Strong wind explains leaving the boat, not its name. Both details are true in the example; only one answers that question.', '不计分虚构示例：“The boat is called Bluebird because of its blue paint. We left it in the harbour because the wind was strong.” 名称的理由是蓝漆；风大解释留船在港，不解释名称。示例中两件事都真，只有一个回答这个问题。', '不計分虛構示例：「The boat is called Bluebird because of its blue paint. We left it in the harbour because the wind was strong.」名稱的理由是藍漆；風大解釋留船在港，不解釋名稱。示例中兩件事都真，只有一個回答這個問題。'),
    nextStep: local('Without hints, find the other original’s stated reason. Keep its person/action or name-part, negative wording and limits.', '不用提示，在另一原作中找明说理由，保留人物／动作或名称部分、否定及范围。', '不用提示，在另一原作中找明說理由，保留人物／動作或名稱部分、否定及範圍。'),
  });
}

const admittedRule = ruleSources.map(source => sourceSchema.parse(source));

/** Preserve required/optional force and the exact recorded condition. */
export function statedRuleListeningLesson(input: unknown, seen: ReadonlySet<string>, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_STATED_RULE_LISTENING');
  const parsed = z.array(sourceSchema).max(20).parse(input);
  if (parsed.some(source => !admittedRule.some(reference => JSON.stringify(source) === JSON.stringify(reference)))) throw new Error('UNKNOWN_STATED_RULE_SOURCE');
  if (new Set(parsed.map(s => s.rootId)).size !== parsed.length || new Set(parsed.map(s => s.audio.sha256)).size !== parsed.length || new Set(parsed.map(s => s.audio.src)).size !== parsed.length) throw new Error('DUPLICATE_STATED_RULE_SOURCE');
  const available = parsed.filter(source => !seen.has(source.audio.sha256));
  const first = available[seed % available.length], second = available.find(source => source.rootId !== first?.rootId);
  if (!first || !second) return;
  const materials = [first, second].map((source, index): Lesson['materials'][number] => {
    const required = /^Before designating building lots, the game requires players to select which class of residents may live there\. The social class chosen for a lot will not be modified by the simulation\.$/.test(source.text);
    const allowed = /^Following the completion of the first five stages, the player could choose to continue using Dr\. Mario, or they may have elected to switch to either Dr\. Peach or Dr\. Bowser\.$/.test(source.text);
    if (!required && !allowed) throw new Error('UNSUPPORTED_STATED_RULE_FRAME');
    const correct = required ? 'Players must select a resident class before designating building lots.' : 'After the first five stages, players could keep Dr. Mario or choose Dr. Peach or Dr. Bowser.';
    const wrong = required ? 'Players may designate building lots without first selecting a resident class.' : 'After the first five stages, players had to stop using Dr. Mario and switch characters.';
    const options = (seed + index) % 2 ? [wrong, correct] : [correct, wrong];
    const explanation = required
      ? local('Requires makes selecting a resident class necessary before designating lots. The wrong option removes that prerequisite. The simulation will not modify the class; this does not establish that a player can never change it. These are game categories, not rules for real people.', 'requires表示划定地块前必须先选居民类别；错误选项取消了这一前置要求。后句只说模拟系统不会更改类别，没有证明玩家永远不能更改。这是游戏类别，不是对现实人群的规定。', 'requires表示劃定地塊前必須先選居民類別；錯誤選項取消了這一前置要求。後句只說模擬系統不會更改類別，沒有證明玩家永遠不能更改。這是遊戲類別，不是對現實人群的規定。')
      : local('Could choose and or describe options after five stages: continue with Mario or switch to either named character. Switching is not compulsory. The recording does not establish what was allowed before stage five, or a current service or character roster.', 'could choose和or说明完成前五关后的选择：继续用Mario，或换为另外两位之一；并非必须换人。录音没有证明五关前的权限，也没有核实当前服务或角色名单。', 'could choose和or說明完成前五關後的選擇：繼續用Mario，或換為另外兩位之一；並非必須換人。錄音沒有證明五關前的權限，也沒有核實目前服務或角色名單。');
    const id = `corpus-${source.audio.sha256}`;
    return { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, audio: source.audio, credit: source.credit,
      blocks: [{ id, text: source.text }], questions: [{ id: `${id}-rule`, blockId: id, prompt: heardRulePrompt + '\nWhich summary preserves the stated requirement or permission?', options, answer: options.indexOf(correct),
        evidence: { start: 0, end: source.text.length, audioStart: 0, audioEnd: source.audio.duration },
        ...(!index ? { hints: [local('Listen for the action and its condition.', '留意动作及对应条件。', '留意動作及對應條件。'), local('Distinguish requires from could choose; keep before/after.', '区分requires与could choose，保留before／after。', '區分requires與could choose，保留before／after。'), local('Do not remove a prerequisite or turn an option into a duty.', '不取消前置要求，不把选择改成义务。', '不取消前置要求，不把選擇改成義務。')] } : {}),
        explanations: options.map((_, i) => local((i === options.indexOf(correct) ? 'Correct. ' : 'This changes the rule. ') + explanation.en, (i === options.indexOf(correct) ? '正确。' : '这改变了规则。') + explanation['zh-Hans'], (i === options.indexOf(correct) ? '正確。' : '這改變了規則。') + explanation['zh-Hant'])) }] };
  });
  return lessonSchema.parse({ id: `corpus-v1-a2-rule-${first.audio.sha256.slice(0, 16)}-${second.audio.sha256.slice(0, 16)}`, targetLevel: 'A2', skill: 'listening', reviewStatus: 'draft', sourceId: 'short-stated-rules', goalId: 'heard-stated-rule', generation: { generator: 'corpus-v1', seed, startingPoint: 'A2' }, materials,
    title: local('Listen for rules and options', '听懂规则与选择', '聽懂規則與選擇'),
    goal: local('Distinguish a required action from an allowed choice, keeping the stated condition.', '区分必须做的动作与允许的选择，保留明说条件。', '區分必須做的動作與允許的選擇，保留明說條件。'),
    teaching: local('Requires marks a necessary action; could choose/may and or describe options. Keep before/after with the action, and keep the actor: a simulation not changing something is different from a player being forbidden to change it. These recordings describe games. A building lot is an area for a building; designate means mark or assign it. A resident lives there; class is a game category; simulation is the computer model. A stage is a game level; continue means keep using; switch means change. Dr. Mario, Dr. Peach and Dr. Bowser are character names. Interpret the recorded description without assuming current availability or adding restrictions before the stated condition.', 'requires表示必须做；could choose／may及or表示选择。把before／after与动作对应，保留执行者：模拟系统不会改变某项，不等于禁止玩家改变。录音描述游戏。building lot是建筑地块，designate是划定或指定，resident是居民，class是游戏类别，simulation是电脑模拟；stage是游戏关卡，continue是继续，switch是更换；Dr. Mario、Dr. Peach和Dr. Bowser是角色名。理解录音中的描述，不推定当前可玩，也不补写所述条件之前的限制。', 'requires表示必須做；could choose／may及or表示選擇。把before／after與動作對應，保留執行者：模擬系統不會改變某項，不等於禁止玩家改變。錄音描述遊戲。building lot是建築地塊，designate是劃定或指定，resident是居民，class是遊戲類別，simulation是電腦模擬；stage是遊戲關卡，continue是繼續，switch是更換；Dr. Mario、Dr. Peach和Dr. Bowser是角色名。理解錄音中的描述，不推定目前可玩，也不補寫所述條件之前的限制。'),
    workedExample: local('Unscored made-up example: “Before entering the pool, visitors must shower. Afterwards they may swim or sit by the pool.” Showering is required first; swimming is optional, not compulsory. The rule says nothing about requiring both swimming and sitting, or whether a visitor has already showered.', '不计分虚构示例：“Before entering the pool, visitors must shower. Afterwards they may swim or sit by the pool.” 先淋浴是要求；之后游泳是选择，不是必须。没有要求游泳和坐着两项都做，也没有证明访客已经淋浴。', '不計分虛構示例：「Before entering the pool, visitors must shower. Afterwards they may swim or sit by the pool.」先淋浴是要求；之後游泳是選擇，不是必須。沒有要求游泳和坐著兩項都做，也沒有證明訪客已經淋浴。'),
    nextStep: local('Without hints, identify the other original’s required or optional action and its condition. Keep the actor; add no unstated ban.', '不用提示，在另一原作中找出要求或选择及其条件，保留执行者，不添加未说的禁令。', '不用提示，在另一原作中找出要求或選擇及其條件，保留執行者，不添加未說的禁令。'),
  });
}

// Reuse admitted recordings without duplicating audio or admitting new sources.
export const integrationListeningSources = [...sources.need.filter(source => source.rootId === 'voa-article-3113733'), ...changeSources.filter(source => source.rootId === 'fleurs-work-1b3df646fd1c6e0b98536428d944dc731450501c3b48a99500c8574311931422')];
const admittedIntegration = integrationListeningSources.map(source => sourceSchema.parse(source));
export function shortIntegrationListeningLesson(input: unknown, seen: ReadonlySet<string>, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_SHORT_INTEGRATION_LISTENING');
  const parsed = z.array(sourceSchema).max(20).parse(input);
  if (parsed.some(source => !admittedIntegration.some(reference => JSON.stringify(source) === JSON.stringify(reference)))) throw new Error('UNKNOWN_SHORT_INTEGRATION_SOURCE');
  if (new Set(parsed.map(s => s.rootId)).size !== parsed.length || new Set(parsed.map(s => s.audio.sha256)).size !== parsed.length || new Set(parsed.map(s => s.audio.src)).size !== parsed.length) throw new Error('DUPLICATE_SHORT_INTEGRATION_SOURCE');
  const available = parsed.filter(source => !seen.has(source.audio.sha256));
  const first = available[seed % available.length], second = available.find(source => source.rootId !== first?.rootId);
  if (!first || !second) return;
  const materials = [first, second].map((source, index): Lesson['materials'][number] => {
    const apartment = /^And I am in apartment D7\. I have to go now\. Oh\.$/.test(source.text);
    const museum = /^The fabulous riches of the tomb are no longer in it, but have been removed to the Egyptian Museum in Cairo\.$/.test(source.text);
    if (!apartment && !museum) throw new Error('UNSUPPORTED_SHORT_INTEGRATION_FRAME');
    const a = apartment ? ['The speaker names apartment D7', 'The speaker names apartment D8'] : ['The riches are no longer in the tomb', 'The riches are still in the tomb'];
    const b = apartment ? ['and says they have to go now', 'and says they have to stay now'] : ['and the named destination is the Egyptian Museum in Cairo', 'and the named destination is the Egyptian Museum in Alexandria'];
    const pairs = [[0,0],[0,1],[1,0],[1,1]], offset = (seed + index) % 4, ordered = [...pairs.slice(offset), ...pairs.slice(0,offset)];
    const options = ordered.map(([x,y]) => `${a[x]} ${b[y]}.`), answer = ordered.findIndex(([x,y]) => !x && !y);
    const explanation = apartment
      ? local('The first sentence names apartment D7; the next states a need to go now. A correct summary keeps both. D8 changes the named unit; staying reverses the stated need. This does not prove the person has left, give a full street address, or establish where they are physically standing. “Oh” is a reply, not a revision of these details.', '第一句给出公寓D7，下一句说明现在需要离开；摘要要两条都保留。D8改变了房号，留下颠倒了所说需要。没有证明已经离开，没有给出完整街道地址，也没有核实人物实际站在哪里。“Oh”是回应，不是对两条信息的修正。', '第一句給出公寓D7，下一句說明現在需要離開；摘要要兩條都保留。D8改變了房號，留下顛倒了所說需要。沒有證明已經離開，沒有給出完整街道地址，也沒有核實人物實際站在哪裡。「Oh」是回應，不是對兩條資訊的修正。')
      : local('No longer in it says the riches are no longer in the tomb; the following clause names the Egyptian Museum in Cairo as their destination. Keep both the departure from the tomb and the named city. Still in the tomb or Alexandria changes a stated detail. This identifies the recording’s report, not a live collection location or a movement date.', 'no longer in it说明财宝已不在墓中，后半句给出移往开罗的埃及博物馆；要同时保留离开墓及所说城市。“仍在墓中”或Alexandria都改变了明说信息。这是在识别录音的报告，没有核实实时馆藏位置或搬移日期。', 'no longer in it說明財寶已不在墓中，後半句給出移往開羅的埃及博物館；要同時保留離開墓及所說城市。「仍在墓中」或Alexandria都改變了明說資訊。這是在識別錄音的報告，沒有核實即時館藏位置或搬移日期。');
    const spans = apartment ? source.segments.slice(0, 2).map(s => ({ start:s.start, end:s.end })) : [{ start:0,end:source.text.indexOf(', but') },{ start:source.text.indexOf('have been removed'),end:source.text.length }];
    const evidenceFor = (span: { start:number;end:number }) => ({...span,audioStart:source.segments.find(s=>s.start<=span.start&&s.end>span.start)!.audioStart,audioEnd:source.segments.find(s=>s.start<span.end&&s.end>=span.end)!.audioEnd});
    const id = `corpus-${source.audio.sha256}`;
    return { id,rootId:source.rootId,sourceId:source.rootId,title:source.title,audio:source.audio,credit:source.credit,blocks:[{id,text:source.text}],questions:[{id:`${id}-int`,blockId:id,prompt:heardIntegrationPrompt+'\n'+(apartment?'Which summary keeps both the apartment detail and the stated need?':'Which summary keeps both the tomb detail and the named destination?'),options,answer,evidence:evidenceFor(spans[0]),additionalEvidence:[{blockId:id,...evidenceFor(spans[1])}],
      ...(!index?{hints:[local('Identify the two details requested.', '认准题目要求的两条信息。', '認準題目要求的兩條資訊。'),local('Listen for a separate clue for each detail.', '为每条信息各找一处录音线索。', '為每條資訊各找一處錄音線索。'),local('Check both halves: one correct detail does not make the whole summary correct.', '核对两个部分，一条正确不能代表整项都正确。', '核對兩個部分，一條正確不能代表整項都正確。')]}:{}),
      explanations:ordered.map(([x,y])=>local((!x&&!y?'Both clues match. ':`Check ${x&&y?'both clues':x?'the first clue':'the second clue'}. `)+explanation.en,(!x&&!y?'两条线索都吻合。':`需核对${x&&y?'两条线索':x?'第一条线索':'第二条线索'}。`)+explanation['zh-Hans'],(!x&&!y?'兩條線索都吻合。':`需核對${x&&y?'兩條線索':x?'第一條線索':'第二條線索'}。`)+explanation['zh-Hant']))}]};
  });
  return lessonSchema.parse({id:`corpus-v1-a2-integrate-${first.audio.sha256.slice(0,16)}-${second.audio.sha256.slice(0,16)}`,targetLevel:'A2',skill:'listening',reviewStatus:'draft',sourceId:'short-two-clue-integration',goalId:'heard-short-two-clue-integration',generation:{generator:'corpus-v1',seed,startingPoint:'A2'},materials,
    title:local('Listen and combine two details','听懂并整合两条信息','聽懂並整合兩條資訊'),
    goal:local('Combine two stated details from one short recording and keep both in a summary.','整合同一短录音中的两条明说信息，摘要要两条都保留。','整合同一短錄音中的兩條明說資訊，摘要要兩條都保留。'),
    teaching:local('Identify the two details asked for; listen for one clue for each. Check both halves of every option. One correct half cannot repair a wrong other half. Apartment means a home within a building; D7 is the named unit, not a full address or proof of the speaker’s physical position. Have to go states a need, not completed departure. In the other recording, riches means valuable objects, tomb is a burial place, and it points back to the tomb. No longer means the former state has ended; have been removed reports movement away; Cairo is the named city. Keep what this recording reports without claiming a current museum location.','先认准题目问哪两条信息，再为每条各听一处线索；每个选项的两个部分都要核对，不能用一半正确抵消另一半错误。apartment是楼里的住宅，D7是所说房号，不是完整地址，也没有证明说话者实际站在哪里；have to go表示需要离开，不表示已经走了。另一录音的riches指贵重物品，tomb是墓，it回指墓；no longer表示原先状态已结束，have been removed表示已被移走，Cairo是开罗。保留录音报告的两条信息，不据此核实时下馆藏。','先認準題目問哪兩條資訊，再為每條各聽一處線索；每個選項的兩個部分都要核對，不能用一半正確抵消另一半錯誤。apartment是樓裡的住宅，D7是所說房號，不是完整地址，也沒有證明說話者實際站在哪裡；have to go表示需要離開，不表示已經走了。另一錄音的riches指貴重物品，tomb是墓，it回指墓；no longer表示原先狀態已結束，have been removed表示已被移走，Cairo是開羅。保留錄音報告的兩條資訊，不據此核實時下館藏。'),
    workedExample:local('Unscored made-up example: “The coach is blue. It leaves at ten.” Both clues: blue + ten. Blue + eleven keeps only the colour; red + ten keeps only the time; red + eleven changes both. The statement does not prove the coach has already left.','不计分虚构示例：“The coach is blue. It leaves at ten.” 两条都吻合是“蓝色＋十点”；“蓝色＋十一点”只保留颜色，“红色＋十点”只保留时间，“红色＋十一点”两条都错。陈述没有证明大巴已出发。','不計分虛構示例：「The coach is blue. It leaves at ten.」兩條都吻合是「藍色＋十點」；「藍色＋十一點」只保留顏色，「紅色＋十點」只保留時間，「紅色＋十一點」兩條都錯。陳述沒有證明大巴已出發。'),
    nextStep:local('Without hints, find both clues in the other original and reject every option that changes either.','不用提示，在另一原作中找齐两条线索，排除改变任意一条的选项。','不用提示，在另一原作中找齊兩條線索，排除改變任意一條的選項。')});
}
