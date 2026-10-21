import { z } from 'zod';
import { lessonSchema, recordingSchema, type Lesson } from '../shared/content';
import { corpusRestoration, corpusWorkedExample } from './corpus';
import { beginnerPolarityPrompt, heardDescriptionPrompt, heardMeaningPrompts, heardNumericPrompts, readingPolarityPrompt } from './corpusPractice';

const sourceObject = z.object({
  rootId: z.string().regex(/^voa-article-\d+$/), title: z.string().min(1).max(120), text: z.string().min(15).max(500),
  audio: recordingSchema.extend({ src: z.string().regex(/^\/audio\/a1-sentences\/voa-[a-z-]+\.mp3$/), duration: z.number().positive().max(12),
    author: z.literal('VOA Learning English'), license: z.literal('VOA Learning English original production (public domain)'),
    sourceUrl: z.string().regex(/^https:\/\/learningenglish\.voanews\.com\/a\/[a-z0-9-]+\/\d+\.html$/), synthetic: z.literal(false) }),
  segments: z.array(z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1),
    audioStart: z.number().nonnegative(), audioEnd: z.number().positive() }).strict()).min(1).max(12),
}).strict();
export function validateAudioTextSegments(source: Pick<z.infer<typeof sourceObject>, 'text' | 'segments'> & { audio: { duration: number } }, ctx: z.RefinementCtx) {
  let end = 0, time = 0;
  for (const segment of source.segments) {
    if (segment.start < end || segment.end <= segment.start || segment.end > source.text.length || source.text.slice(segment.start, segment.end) !== segment.text
      || source.text.slice(end, segment.start).trim() || segment.audioStart < time || segment.audioEnd <= segment.audioStart || segment.audioEnd > source.audio.duration)
      ctx.addIssue({ code: 'custom', message: 'Invalid audio/text segment' });
    end = segment.end; time = segment.audioEnd;
  }
  if (source.text.slice(end).trim()) ctx.addIssue({ code: 'custom', message: 'Unmatched transcript' });
}
export function validateSentenceSegments(source: Pick<z.infer<typeof sourceObject>, 'text' | 'segments'> & { audio: { duration: number } }, ctx: z.RefinementCtx) {
  if (source.text.split(/\s+/).length > 60) ctx.addIssue({ code: 'custom', message: 'Invalid beginner source' });
  validateAudioTextSegments(source, ctx);
}
const sourceSchema = sourceObject.superRefine((source, ctx) => {
  validateSentenceSegments(source, ctx);
  if (!source.audio.sourceUrl.endsWith(`/${source.rootId.slice('voa-article-'.length)}.html`)) ctx.addIssue({ code: 'custom', message: 'Invalid beginner source' });
});
const fleursSchema = z.object({ ...sourceObject.shape,
  rootId: z.string().regex(/^fleurs-work-[a-f0-9]{64}$/),
  audio: recordingSchema.extend({ src: z.string().regex(/^\/audio\/a1-sentences\/fleurs-[a-z-]+\.mp3$/), duration: z.number().positive().max(12),
    author: z.literal('FLEURS English volunteer speaker'), sourceUrl: z.literal('https://huggingface.co/datasets/google/fleurs'), license: z.literal('CC BY 4.0'), synthetic: z.literal(false) }),
  credit: z.object({ attribution: z.string().min(1).max(4000), license: z.string().min(1).max(1000), sourceUrl: z.string().regex(/^https:\/\/en\.wikinews\.org\/wiki\/[A-Za-z0-9_%.'()-]+$/) }).strict(),
}).strict().superRefine((source, ctx) => {
  validateSentenceSegments(source, ctx);
  if (!source.credit.license.includes('CC BY-SA 4.0') || !source.credit.license.includes('recording CC BY 4.0')) ctx.addIssue({ code: 'custom', message: 'Missing separate transcript/recording terms' });
});
const local = (en: string, hans: string, hant: string) => ({ en, 'zh-Hans': hans, 'zh-Hant': hant });

function parseSentenceSources(input: unknown, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_SENTENCE_LISTENING_SEED');
  const sources = z.array(sourceSchema).max(20).parse(input);
  if (new Set(sources.map(source => source.rootId)).size !== sources.length || new Set(sources.map(source => source.audio.sha256)).size !== sources.length
    || new Set(sources.map(source => source.audio.src)).size !== sources.length) throw new Error('DUPLICATE_SENTENCE_SOURCES');
  return sources;
}

/** Recognize exact recorded words without inferring meaning or proficiency. */
export function sentenceListeningLesson(input: unknown, seen: ReadonlySet<string>, seed: number) {
  const sources = parseSentenceSources(input, seed);
  const candidates = sources.filter(source => !seen.has(source.audio.sha256)).flatMap(source => {
    const offsets = new Set<number>();
    return Array.from({ length: source.text.split(/\s+/).length }, (_, index) => {
      const word = corpusRestoration(source.text, index, undefined, true)!;
      if (!word || offsets.has(word.evidence.start)) return;
      offsets.add(word.evidence.start);
      const segment = source.segments.find(part => part.start <= word.evidence.start && part.end >= word.evidence.end);
      if (!segment) return;
      const id = `corpus-${source.audio.sha256}`, offset = word.evidence.start - segment.start;
      const gap = segment.text.slice(0, offset) + '________' + segment.text.slice(offset + word.answer.length);
      const material: Lesson['materials'][number] = { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, audio: source.audio,
        credit: { attribution: `VOA Learning English, ${source.title}; recording excerpt transcoded to MP3.`, license: source.audio.license, sourceUrl: source.audio.sourceUrl },
        blocks: [{ id, text: source.text }], questions: [{ kind: 'completion', id: `${id}-restore`, blockId: id, prompt: `Listen and complete the sentence:\n${gap}`, answer: word.answer, accepted: [word.answer],
          evidence: { start: segment.start, end: segment.end, audioStart: segment.audioStart, audioEnd: segment.audioEnd },
          hints: [local('Listen for this sentence.', '留意这个句子。', '留意這個句子。'), local('Listen to the words beside the gap.', '听空格旁边的词。', '聽空格旁邊的詞。'), local('Check the spelling of the word you heard.', '检查听到的词的拼写。', '檢查聽到的詞的拼寫。')],
          explanation: local(`You heard “${segment.text}”.`, `你听到的是“${segment.text}”。`, `你聽到的是「${segment.text}」。`),
        }] };
      return { material, example: corpusWorkedExample(material, seed, 'A1', true) };
    }).filter(item => item !== undefined);
  });
  // Teach from an unused source sentence without revealing the scored word.
  const taught = candidates.filter(candidate => candidate.example);
  const first = taught[seed % taught.length];
  if (!first) return;
  const other = candidates.filter(candidate => candidate.material.rootId !== first.material.rootId);
  const second = other[(seed + 1) % other.length];
  if (!second) return;
  return lessonSchema.parse({ id: `corpus-v1-sentences-${first.material.audio!.sha256.slice(0, 16)}-${second.material.audio!.sha256.slice(0, 16)}`, targetLevel: 'B2', skill: 'listening',
    sourceId: 'voa-short-utterances', reviewStatus: 'draft', themes: ['daily-life'], goalId: 'heard-sentence-completion', generation: { generator: 'corpus-v1', seed, startingPoint: 'A1' },
    title: local('Listen to short sentences', '听短句', '聽短句'), goal: local('Listen and complete a sentence.', '听录音，补全句子。', '聽錄音，補全句子。'),
    teaching: local('Listen once. Find the sentence with the gap. Listen again if needed, then write the missing word.', '先听一次，找到有空格的句子。需要时再听，写下缺少的词。', '先聽一次，找到有空格的句子。需要時再聽，寫下缺少的詞。'),
    workedExample: first.example!, nextStep: local('Try another recording. Listen for the same kind of detail.', '换一段录音，留意句子中的词。', '換一段錄音，留意句子中的詞。'),
    materials: [first.material, second.material] });
}

/** Contrast an explicit description with a mentioned alternative. */
export function sentenceDescriptionLesson(input: unknown, seen: ReadonlySet<string>, seed: number) {
  const candidates = parseSentenceSources(input, seed).filter(source => !seen.has(source.audio.sha256)).flatMap(source => {
    // shortcut: two inspected complete forms; review arbitrary introductions and references before adding them.
    const origin = /^She is [A-Z][a-z]+\. She is new to ([A-Z][A-Za-z. ]+)\. Where are you from\? I am from (a [a-z]+ town)\.$/.exec(source.text);
    const object = /^It is not (a [a-z]+)\. It is (a [a-z]+)\. It is a big ([a-z]+)\.$/.exec(source.text);
    if (!origin && (!object || object[1] === object[2] || object[2] !== `a ${object[3]}`)) return [];
    const stated = origin ? `I come from ${origin[2]}.` : `It is ${object![2]}.`;
    const alternate = origin ? `I come from ${origin[1]}.` : `It is ${object![1]}.`;
    if (source.title.includes(stated) || source.title.includes(alternate)) return [];
    const detail = origin ? 'Where is the person who answers from?' : 'What is the object?';
    const explanation = origin
      ? local(`“I am from ${origin[2]}.” answers “Where are you from?” “New to ${origin[1]}” describes someone new there; it does not give their origin.`, `“I am from ${origin[2]}.”回答来自哪里。“new to ${origin[1]}”表示刚到那里，不能据此判断来自那里。`, `「I am from ${origin[2]}.」回答來自哪裡。「new to ${origin[1]}」表示剛到那裡，不能據此判斷來自那裡。`)
      : local(`“It is ${object![2]}.” names the object. “Not ${object![1]}” rules out the other object; “big” gives its size.`, `“It is ${object![2]}.”说明是什么。“not ${object![1]}”排除了另一个物品，big说明大小。`, `「It is ${object![2]}.」說明是什麼。「not ${object![1]}」排除了另一個物品，big說明大小。`);
    return [{ source, stated, alternate, detail, explanation }];
  });
  const first = candidates[seed % candidates.length];
  if (!first) return;
  const other = candidates.filter(candidate => candidate.source.rootId !== first.source.rootId);
  const second = other[(seed + 1) % other.length];
  if (!second) return;
  const materials = [first, second].map(({ source, stated, alternate, detail, explanation }, index) => {
    const id = `corpus-${source.audio.sha256}`, answer = (seed + index) % 2;
    const correct = local(`Yes. ${explanation.en}`, `正确。${explanation['zh-Hans']}`, `正確。${explanation['zh-Hant']}`);
    const incorrect = local(`“${alternate}” is not the stated description. ${explanation.en}`, `“${alternate}”不是录音确认的描述。${explanation['zh-Hans']}`, `「${alternate}」不是錄音確認的描述。${explanation['zh-Hant']}`);
    return { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, audio: source.audio,
      credit: { attribution: `VOA Learning English, ${source.title}; recording excerpt transcoded to MP3.`, license: source.audio.license, sourceUrl: source.audio.sourceUrl },
      blocks: [{ id, text: source.text }], questions: [{ id: `${id}-desc`, blockId: id, prompt: `${heardDescriptionPrompt}\n${detail}`,
        options: answer ? [alternate, stated] : [stated, alternate], answer,
        evidence: { start: 0, end: source.text.length, audioStart: source.segments[0].audioStart, audioEnd: source.segments.at(-1)!.audioEnd },
        ...(index === 0 ? { hints: [local('Listen for the description asked for.', '听题目问的人物或物品描述。', '聽題目問的人物或物品描述。'), local('Listen to the full answer, not just a familiar word.', '听完整回答，不只找熟悉的词。', '聽完整回答，不只找熟悉的詞。'), local('“From” gives origin. “Not” rules something out.', 'From说明来自哪里，not排除一种情况。', 'From說明來自哪裡，not排除一種情況。')] } : {}),
        explanations: answer ? [incorrect, correct] : [correct, incorrect] }] };
  });
  return lessonSchema.parse({ id: `corpus-v1-description-${first.source.audio.sha256.slice(0, 16)}-${second.source.audio.sha256.slice(0, 16)}`, targetLevel: 'A1', skill: 'listening',
    sourceId: 'voa-short-utterances', reviewStatus: 'draft', themes: ['daily-life'], goalId: 'heard-explicit-description', generation: { generator: 'corpus-v1', seed, startingPoint: 'A1' },
    title: local('Hear a description', '听懂简单描述', '聽懂簡單描述'), goal: local('Identify the stated description of a person or thing.', '听出人物或物品的明确描述。', '聽出人物或物品的明確描述。'),
    teaching: local('Listen to the whole answer. A mentioned word may describe something else or be ruled out. “From” tells where someone comes from. “New to” means new in a place. “Not” means no. A book is for reading; a pen is for writing. “Big” means large.', '听完整回答。提到的词可能描述别的事情，也可能被否定。From表示来自，new to表示刚到某地，not表示否定。Book是书，pen是笔，big表示大。', '聽完整回答。提到的詞可能描述別的事情，也可能被否定。From表示來自，new to表示剛到某地，not表示否定。Book是書，pen是筆，big表示大。'),
    workedExample: local('Made-up example: “I am new to London. I am from York.” Where am I from? → York. London is where I am new, not my stated origin. “It is not a bag. It is a cup.” What is it? → A cup. A bag is ruled out. Cup means a thing that holds a drink; bag means a thing for carrying things.', '虚构示例：“I am new to London. I am from York.”问来自哪里 → York。London是刚到的地方，不是所说的来源。“It is not a bag. It is a cup.”问是什么 → A cup。Bag被排除了。Cup是杯子，bag是袋子。', '虛構示例：「I am new to London. I am from York.」問來自哪裡 → York。London是剛到的地方，不是所說的來源。「It is not a bag. It is a cup.」問是什麼 → A cup。Bag被排除了。Cup是杯子，bag是袋子。'),
    nextStep: local('Try the other recording without hints. Identify the stated description and explain why the other detail does not answer the question.', '不用提示听另一原作，找到明确描述，并解释另一细节为什么不回答题目。', '不用提示聽另一原作，找到明確描述，並解釋另一細節為什麼不回答題目。'), materials });
}

/** Admit only inspected complete corrections, locations, and requests. */
export function sentenceMeaningLesson(input: unknown, seen: ReadonlySet<string>, seed: number, kind: 'location' | 'instruction' | 'verification') {
  const support = {
    location: {
      title: local('Hear a location', '听懂地点关系', '聽懂地點關係'), goal: local('Identify the location actually stated.', '听出原话说明的地点关系。', '聽出原話說明的地點關係。'),
      teaching: local('Listen for the place and its relation. “In” means inside; “outside” means not inside. “Across from” means on the other side; “next to” means beside. A living room is for relaxing. A gym is for exercise, a lounge for resting, a mailroom for letters. Do not guess a direction from “that way”.', '听清地点及其关系。In表示在里面，outside表示在外面；across from表示在对面，next to表示在旁边。Living room是客厅，relax是休息；gym是健身房，lounge是休息室，mailroom是收发室。不要根据that way猜左右方向。', '聽清地點及其關係。In表示在裡面，outside表示在外面；across from表示在對面，next to表示在旁邊。Living room是客廳，relax是休息；gym是健身房，lounge是休息室，mailroom是收發室。不要根據that way猜左右方向。'),
      example: local('Example: “The shop is across from the park. It is next to the school.” Where is the shop relative to the park? → Across from it. “Next to the park” changes the named relation. Shop means a place to buy things; park means a public outdoor place; school means a place to learn.', '示例：“The shop is across from the park. It is next to the school.”问商店与公园的位置关系 → 在对面。Next to the park改变了所说的关系。Shop是商店，park是公园，school是学校。', '示例：「The shop is across from the park. It is next to the school.」問商店與公園的位置關係 → 在對面。Next to the park改變了所說的關係。Shop是商店，park是公園，school是學校。'),
      clue: local('Keep the relation and the named place together.', '把位置词和对应的地点一起核对。', '把位置詞和對應的地點一起核對。'),
    },
    instruction: {
      title: local('Hear a request', '听懂基本请求', '聽懂基本請求'), goal: local('Identify the action requested.', '听出对方请求做的动作。', '聽出對方請求做的動作。'),
      teaching: local('Listen for the action. “Try again” means try once more. “Meet your coworkers” asks you to meet the people you work with; it does not ask them to stop working. “Please” is polite. “Busy working” means doing their work.', '听清请求的动作。Try again表示再试一次；meet your coworkers表示认识同事，不是叫他们停止工作。Please是礼貌用语，busy working表示忙于工作。', '聽清請求的動作。Try again表示再試一次；meet your coworkers表示認識同事，不是叫他們停止工作。Please是禮貌用語，busy working表示忙於工作。'),
      example: local('Example: “Please open the box. It is heavy.” What are you asked to do? → Open the box. You are not asked to close it. Open means make it not shut; box means a container; heavy means it weighs a lot.', '示例：“Please open the box. It is heavy.”问请求做什么 → 打开箱子，不是关上它。Open表示打开，box是箱子，heavy表示重。', '示例：「Please open the box. It is heavy.」問請求做什麼 → 打開箱子，不是關上它。Open表示打開，box是箱子，heavy表示重。'),
      clue: local('Find the action after “please” or “let’s”.', '留意please或let’s之后的动作。', '留意please或let’s之後的動作。'),
    },
    verification: {
      title: local('Hear a correction', '核对口头纠正', '核對口頭糾正'), goal: local('Identify the detail confirmed after a spoken correction.', '核对口头纠正后确认的信息。', '核對口頭糾正後確認的資訊。'),
      teaching: local('Listen to the question and the answer. A question is not a confirmed fact. After “No”, check every letter or digit in the correction. “Two N’s” means the letter N occurs twice. A phone number is a sequence of digits, not a count. Number words: zero=0, one=1, two=2, three=3, four=4, five=5, six=6, seven=7, eight=8, nine=9. The letter N is said “en”.', '听完问句及回答，问句不等于确认。No之后逐个核对纠正的字母或数字。Two N’s表示字母N有两个；电话号码是一串数字，不是数量。数字词：zero=0、one=1、two=2、three=3、four=4、five=5、six=6、seven=7、eight=8、nine=9。字母N的名称读作“en”。', '聽完問句及回答，問句不等於確認。No之後逐個核對糾正的字母或數字。Two N’s表示字母N有兩個；電話號碼是一串數字，不是數量。數字詞：zero=0、one=1、two=2、three=3、four=4、five=5、six=6、seven=7、eight=8、nine=9。字母N的名稱讀作「en」。'),
      example: local('Example: “Is it 777-1111? No, it is 777-1122.” Which number is confirmed? → 777-1122. The first number was asked about and rejected. Compare the last two digits; keep the rest unchanged.', '示例：“Is it 777-1111? No, it is 777-1122.”问确认哪个号码 → 777-1122。第一个只是被询问后否定的号码。核对末两位，其他数字不变。', '示例：「Is it 777-1111? No, it is 777-1122.」問確認哪個號碼 → 777-1122。第一個只是被詢問後否定的號碼。核對末兩位，其他數字不變。'),
      clue: local('Listen to the full detail after “No”.', '听完No后纠正的整条信息。', '聽完No後糾正的整條資訊。'),
    },
  }[kind];
  const candidates = parseSentenceSources(input, seed).filter(source => !seen.has(source.audio.sha256)).flatMap(source => {
    let stated = '', alternate = '', explanation = local('', '', '');
    if (kind === 'location') {
      const room = /^We relax in the ([a-z]+ room)\. I relax in the \1\.$/.exec(source.text);
      const gym = /^The ([a-z]+) is across from the ([a-z]+)\. It's next to the ([a-z]+)\. Go that way\.$/.exec(source.text);
      if (room) {
        stated = `We relax in the ${room[1]}.`; alternate = `We relax outside the ${room[1]}.`;
        explanation = local(`“In the ${room[1]}” says inside that room, not outside it.`, `“In the ${room[1]}”说明在该房间里面，不是在外面。`, `「In the ${room[1]}」說明在該房間裡面，不是在外面。`);
      } else if (gym && new Set(gym.slice(1)).size === 3) {
        stated = `The ${gym[1]} is across from the ${gym[2]}.`; alternate = `The ${gym[1]} is next to the ${gym[2]}.`;
        explanation = local(`The ${gym[1]} is across from the ${gym[2]}, and next to the ${gym[3]}. Do not move “next to” to a different place. “That way” does not specify left or right.`, `${gym[1]}在${gym[2]}对面，在${gym[3]}旁边，不能把next to换给另一地点。That way未说明左或右。`, `${gym[1]}在${gym[2]}對面，在${gym[3]}旁邊，不能把next to換給另一地點。That way未說明左或右。`);
      }
    } else if (kind === 'instruction') {
      if (source.text === "Nice to meet you. Let's try that again.") {
        stated = 'Try once more.'; alternate = 'Stop trying.';
        explanation = local('“Let’s try that again” invites another try, not stopping. The preceding line is a greeting.', '“Let’s try that again”邀请再试一次，不是停止尝试。前一句是见面问候。', '「Let’s try that again」邀請再試一次，不是停止嘗試。前一句是見面問候。');
      } else if (source.text === 'Please, meet your coworkers. But remember, they are busy working.') {
        stated = 'Meet your coworkers.'; alternate = 'Stop your coworkers working.';
        explanation = local('“Meet your coworkers” asks you to meet them. “They are busy working” warns you to respect their work, not to make them stop.', '“Meet your coworkers”请求认识同事；后一句提醒他们忙于工作，并未请求让他们停工。', '「Meet your coworkers」請求認識同事；後一句提醒他們忙於工作，並未請求讓他們停工。');
      }
    } else {
      const spelling = /^([A-Z][a-z]+), is that ([A-Z](?:-[A-Z]){1,7})\? No, ([A-Z](?:-[A-Z]){1,7})\. Well, \1 with two ([A-Z])'s\.$/.exec(source.text);
      const number = /^Is this (\d{3}-\d{4})\? No, this is (\d{3}-\d{4})\.$/.exec(source.text);
      if (spelling && spelling[2] !== spelling[3] && spelling[3].replaceAll('-', '').toLowerCase() === spelling[1].toLowerCase() && spelling[3].split('-').filter(letter => letter === spelling[4]).length === 2) {
        stated = spelling[3]; alternate = spelling[2];
        explanation = local(`The correction is “No, ${stated}.” “Two ${spelling[4]}'s” confirms the repeated letter. ${alternate} is the rejected spelling in the question.`, `纠正为“No, ${stated}.”，two ${spelling[4]}'s再次确认该字母有两个；${alternate}是问句中被否定的拼写。`, `糾正為「No, ${stated}.」，two ${spelling[4]}'s再次確認該字母有兩個；${alternate}是問句中被否定的拼寫。`);
      } else if (number && number[1] !== number[2]) {
        stated = number[2]; alternate = number[1];
        explanation = local(`“No, this is ${stated}” gives the answering person's number. ${alternate} was asked about and rejected.`, `“No, this is ${stated}”说明接听方的号码；${alternate}是被询问后否定的号码。`, `「No, this is ${stated}」說明接聽方的號碼；${alternate}是被詢問後否定的號碼。`);
      }
    }
    if (!stated || !alternate || stated === alternate) return [];
    return [{ source, stated, alternate, explanation }];
  });
  const first = candidates[seed % candidates.length]; if (!first) return;
  const other = candidates.filter(candidate => candidate.source.rootId !== first.source.rootId);
  const second = other[(seed + 1) % other.length]; if (!second) return;
  const materials = [first, second].map(({ source, stated, alternate, explanation }, index) => {
    const id = `corpus-${source.audio.sha256}`, answer = (seed + index) % 2;
    const correct = local(`Yes. ${explanation.en}`, `正确。${explanation['zh-Hans']}`, `正確。${explanation['zh-Hant']}`);
    const wrong = local(`“${alternate}” is not the requested detail. ${explanation.en}`, `“${alternate}”不符合所问信息。${explanation['zh-Hans']}`, `「${alternate}」不符合所問資訊。${explanation['zh-Hant']}`);
    return { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, audio: source.audio,
      credit: { attribution: `VOA Learning English, ${source.title}; continuous recording excerpt transcoded to MP3.${source.audio.src.endsWith('-headroom.mp3') ? ' Gain reduced by 6 dB before encoding; no speed/pitch change.' : ''}`, license: source.audio.license, sourceUrl: source.audio.sourceUrl },
      blocks: [{ id, text: source.text }], questions: [{ id: `${id}-${kind.slice(0, 4)}`, blockId: id, prompt: heardMeaningPrompts[kind], options: answer ? [alternate, stated] : [stated, alternate], answer,
        evidence: { start: 0, end: source.text.length, audioStart: source.segments[0].audioStart, audioEnd: source.segments.at(-1)!.audioEnd },
        ...(index === 0 ? { hints: [support.goal, support.clue, kind === 'location' ? local('“In” means inside; “across from” means opposite; “next to” means beside.', 'In是在里面，across from是在对面，next to是在旁边。', 'In是在裡面，across from是在對面，next to是在旁邊。') : kind === 'instruction' ? local('“Again” means once more; “meet” means get to know someone.', 'Again表示再一次，meet表示认识某人。', 'Again表示再一次，meet表示認識某人。') : local('“No” rejects the detail in the question. Keep the correction.', 'No否定问句中的细节，应保留纠正的信息。', 'No否定問句中的細節，應保留糾正的資訊。')] } : {}), explanations: answer ? [wrong, correct] : [correct, wrong] }] };
  });
  return lessonSchema.parse({ id: `corpus-v1-heard-${kind}-${first.source.audio.sha256.slice(0, 16)}-${second.source.audio.sha256.slice(0, 16)}`, targetLevel: 'A1', skill: 'listening', sourceId: 'voa-short-utterances', reviewStatus: 'draft', themes: ['daily-life'], goalId: `heard-explicit-${kind}`, generation: { generator: 'corpus-v1', seed, startingPoint: 'A1' },
    title: support.title, goal: support.goal, teaching: support.teaching, workedExample: support.example,
    nextStep: local('Try the same goal on the other recording without hints. Check the complete answer and explain why the other option changes it.', '不用提示，在另一原作上完成同一目标。核对完整回答，解释另一选项改动了什么。', '不用提示，在另一原作上完成同一目標。核對完整回答，解釋另一選項改動了什麼。'), materials });
}

// Keep counts and times tied to their referents; never combine groups or zones.
export function sentenceNumericLesson(input: unknown, seen: ReadonlySet<string>, seed: number, kind: 'count' | 'time') {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('INVALID_SENTENCE_LISTENING_SEED');
  const sources = z.array(z.union([sourceSchema, fleursSchema])).max(20).parse(input);
  if (new Set(sources.map(s => s.rootId)).size !== sources.length || new Set(sources.map(s => s.audio.sha256)).size !== sources.length || new Set(sources.map(s => s.audio.src)).size !== sources.length) throw new Error('DUPLICATE_SENTENCE_SOURCES');
  const numbers: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const vocabulary = 'zero=0, one=1, two=2, three=3, four=4, five=5, six=6, seven=7, eight=8, nine=9, ten=10.';
  const candidates = sources.filter(source => !seen.has(source.audio.sha256)).flatMap(source => {
    let answer = '', alternate = '', label = '', explanation = local('', '', '');
    if (kind === 'count') {
      const letters = /^([A-Z][a-z]+), is that ([A-Z](?:-[A-Z]){1,7})\? No, ([A-Z](?:-[A-Z]){1,7})\. Well, \1 with ([a-z]+) ([A-Z])'s\.$/.exec(source.text);
      const people = /^Earlier this week, a police helicopter crash killed ([a-z]+) people and wounded ([a-z]+) more\.$/.exec(source.text);
      if (letters && numbers[letters[4]] > 0 && letters[3].replaceAll('-', '').toLowerCase() === letters[1].toLowerCase()) {
        const count = letters[3].split('-').filter(letter => letter === letters[5]).length;
        const rejected = letters[2].split('-').filter(letter => letter === letters[5]).length;
        if (count !== numbers[letters[4]] || rejected === count) return [];
        answer = String(count); alternate = String(rejected); label = `The letter ${letters[5]}`;
        explanation = local(`“${letters[4]} ${letters[5]}'s” confirms ${count} copies of that letter in the corrected spelling ${letters[3]}. ${letters[2]} was asked about and rejected; its count ${rejected} is not confirmed.`, `“${letters[4]} ${letters[5]}'s”确认纠正后${letters[3]}中该字母有${count}个；${letters[2]}是被否定的拼写，其中${rejected}个的数量不成立。`, `「${letters[4]} ${letters[5]}'s」確認糾正後${letters[3]}中該字母有${count}個；${letters[2]}是被否定的拼寫，其中${rejected}個的數量不成立。`);
      } else if (people && numbers[people[1]] > 0 && numbers[people[2]] > 0) {
        const killed = numbers[people[1]], injured = numbers[people[2]];
        answer = String(injured); alternate = String(killed + injured); label = 'The helicopter crash: people wounded';
        explanation = local(`“Wounded ${people[2]} more” gives ${injured} injured people. The ${killed} people killed are another group. Adding both groups gives ${killed + injured}, not the injured-person count asked for.`, `“Wounded ${people[2]} more”说明受伤${injured}人；死亡的${killed}人是另一组，两组相加为${killed + injured}，不是题目所问的受伤人数。`, `「Wounded ${people[2]} more」說明受傷${injured}人；死亡的${killed}人是另一組，兩組相加為${killed + injured}，不是題目所問的受傷人數。`);
      }
    } else {
      const office = /^My office, (\d{1,2}(?::\d{2})? [ap]\.m\.) \1$/.test(source.text);
      const quake = /^A moderate earthquake shook western Montana at \d{1,2}:\d{2} [ap]\.m\. on Monday\.$/.test(source.text);
      if (!office && !quake) return [];
      const matches = [...source.text.matchAll(/\b(1[0-2]|[1-9])(?::([0-5]\d))? ([ap])\.m\./g)];
      if (!matches.length || new Set(matches.map(m => `${m[1]}:${m[2] ?? '00'} ${m[3]}`)).size !== 1) return [];
      const [, hour, minute = '00', period] = matches[0];
      answer = `${hour}:${minute} ${period}.m.`;
      const variation = (seed >>> 1) % 3;
      alternate = variation === 0 ? `${hour}:${minute} ${period === 'a' ? 'p' : 'a'}.m.` : variation === 1 ? `${Number(hour) === 12 ? 1 : Number(hour) + 1}:${minute} ${period}.m.` : `${hour}:${String((Number(minute) + 1) % 60).padStart(2, '0')} ${period}.m.`;
      label = office ? 'The office exchange' : 'The reported earthquake';
      explanation = local(`The recording states “${matches[0][0]}”: ${answer}. Keep the hour, minutes and a.m./p.m. ${office ? 'Both turns repeat the same time; :00 writes the implied zero minutes.' : '“Monday” gives the reported day, not a different clock time.'} No time zone is stated; do not convert it.`, `录音说“${matches[0][0]}”，即${answer}，保留小时、分钟和a.m./p.m.。${office ? '两个话轮重复同一时刻，:00写出省略的零分钟。' : 'Monday是报道中的星期，不是另一个钟点。'}原文没有给出时区，不作换算。`, `錄音說「${matches[0][0]}」，即${answer}，保留小時、分鐘和a.m./p.m.。${office ? '兩個話輪重複同一時刻，:00寫出省略的零分鐘。' : 'Monday是報導中的星期，不是另一個鐘點。'}原文沒有給出時區，不作換算。`);
    }
    if (!answer || answer === alternate) return [];
    return [{ source, answer, alternate, label, explanation }];
  });
  const first = candidates[seed % candidates.length]; if (!first) return;
  const others = candidates.filter(c => c.source.rootId !== first.source.rootId), second = others[(seed + 1) % others.length]; if (!second) return;
  const count = kind === 'count';
  const goal = count ? local('Hear a count and what it counts.', '听出数量及它对应的对象。', '聽出數量及它對應的對象。') : local('Hear the reported clock time.', '听出原话所报的时刻。', '聽出原話所報的時刻。');
  const materials = [first, second].map(({ source, answer: stated, alternate, label, explanation }, index) => {
    const id = `corpus-${source.audio.sha256}`, answer = (seed + index) % 2;
    const good = local(`Yes. ${explanation.en}`, `正确。${explanation['zh-Hans']}`, `正確。${explanation['zh-Hant']}`);
    const bad = local(`“${alternate}” changes the requested detail. ${explanation.en}`, `“${alternate}”改动了所问信息。${explanation['zh-Hans']}`, `「${alternate}」改動了所問資訊。${explanation['zh-Hant']}`);
    return { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, audio: source.audio,
      credit: 'credit' in source ? source.credit : { attribution: `VOA Learning English, ${source.title}; continuous recording excerpt transcoded to MP3.${source.audio.src.endsWith('-headroom.mp3') ? ' Gain reduced6dB before encoding; no speed/pitch change.' : ''}`, license: source.audio.license, sourceUrl: source.audio.sourceUrl },
      blocks: [{ id, text: source.text }], questions: [{ id: `${id}-${kind}`, blockId: id, prompt: `${heardNumericPrompts[kind]}\n${label}`, options: answer ? [alternate, stated] : [stated, alternate], answer,
        evidence: { start: 0, end: source.text.length, audioStart: source.segments[0].audioStart, audioEnd: source.segments.at(-1)!.audioEnd },
        ...(index === 0 ? { hints: [goal, count ? local('Find the group asked for, not every number mentioned.', '找到所问的对象，不是把所有数字都选上。', '找到所問的對象，不是把所有數字都選上。') : local('Listen to the hour, minutes and the final letters.', '听小时、分钟以及最后的字母。', '聽小時、分鐘以及最後的字母。'), count ? local('“No” rejects the proposed spelling; “more” means another group.', 'No否定问句的拼写；more表示另一组人。', 'No否定問句的拼寫；more表示另一組人。') : local('a.m. is before noon; p.m. runs from noon until midnight.', 'a.m.是午夜后至中午前；p.m.是中午起至午夜前。', 'a.m.是午夜後至中午前；p.m.是中午起至午夜前。')] } : {}), explanations: answer ? [bad, good] : [good, bad] }] };
  });
  const teaching = count ? local(`Listen for the number and the group it describes. Do not add different groups. N is a letter, said “en”. In the old news sentence, “killed” means died, “wounded” means hurt, “more” means other people. A helicopter is a kind of flying machine; a crash is an accident. The sentence mentions a separate accident from the report's headline. Number words: ${vocabulary}`, `听清数字及它对应的对象，不混合不同组。N是字母，名称读作“en”。旧新闻句中killed表示死亡，wounded表示受伤，more表示另外的人；helicopter是直升机，crash是事故。句子提到的是与原报道标题不同的另一起事故。数字词：${vocabulary}`, `聽清數字及它對應的對象，不混合不同組。N是字母，名稱讀作「en」。舊新聞句中killed表示死亡，wounded表示受傷，more表示另外的人；helicopter是直升機，crash是事故。句子提到的是與原報導標題不同的另一起事故。數字詞：${vocabulary}`)
    : local(`Listen for hour, minutes and a.m./p.m. a.m. is before noon; p.m. runs from noon until midnight. Noon is12 in the day; midnight is12 at night. Keep the reported time, not your local time zone. Office is a place for work. In the old news sentence, moderate means not very large, earthquake means ground shaking, shook means made the ground move; western Montana is a place in the US, Monday is a day. Number words: ${vocabulary}`, `听清小时、分钟和a.m./p.m.。a.m.是午夜后至中午前，p.m.是中午起至午夜前。保留原话时刻，不换算本地时区。Office是办公室；旧新闻中的moderate表示中等，earthquake是地震，shook表示摇动，western Montana是地名，Monday是星期一。数字词：${vocabulary}`, `聽清小時、分鐘和a.m./p.m.。a.m.是午夜後至中午前，p.m.是中午起至午夜前。保留原話時刻，不換算本地時區。Office是辦公室；舊新聞中的moderate表示中等，earthquake是地震，shook表示搖動，western Montana是地名，Monday是星期一。數字詞：${vocabulary}`);
  const example = count ? local('Example: “Four boxes are green. One box is white.” How many boxes are green? →4. Do not choose5: that adds both colours. A box is a container; green is like leaves; white is like snow.', '示例：“Four boxes are green. One box is white.”绿色箱子几个？→4。不是5，5把两种颜色加到一起了。Box是箱子，green是绿色，white是白色。', '示例：「Four boxes are green. One box is white.」綠色箱子幾個？→4。不是5，5把兩種顏色加到一起了。Box是箱子，green是綠色，white是白色。')
    : local('Example: “At four p.m. I am cooking.” What time? →4:00 p.m. “4:00 a.m.” changes afternoon to before noon. Cooking means making food. Four=4; :00 writes zero minutes.', '示例：“At four p.m. I am cooking.”什么时刻？→4:00 p.m.。4:00 a.m.把下午改成了中午之前。Cooking表示做饭，four=4，:00表示零分钟。', '示例：「At four p.m. I am cooking.」什麼時刻？→4:00 p.m.。4:00 a.m.把下午改成了中午之前。Cooking表示做飯，four=4，:00表示零分鐘。');
  return lessonSchema.parse({ id: `corpus-v1-numeric-${kind}-${first.source.audio.sha256.slice(0, 16)}-${second.source.audio.sha256.slice(0, 16)}`, targetLevel: 'A1', skill: 'listening', sourceId: 'short-numeric-utterances', reviewStatus: 'draft', themes: ['daily-life'], goalId: `heard-explicit-${kind}`, generation: { generator: 'corpus-v1', seed, startingPoint: 'A1' },
    title: count ? local('Hear a count', '听清数量', '聽清數量') : local('Hear a clock time', '听清时刻', '聽清時刻'), goal, teaching, workedExample: example,
    nextStep: local('Try the same goal on the other recording without hints. Explain which number and unit are stated and what the other option changes.', '不用提示，在另一原作上完成同一目标。说明数字及其对象／时刻，核对另一选项改动了什么。', '不用提示，在另一原作上完成同一目標。說明數字及其對象／時刻，核對另一選項改動了什麼。'), materials });
}

/** Score reported simple-present statements without inferring facts or speaker identity. */
export function sentencePolarityLesson(input: unknown, seen: ReadonlySet<string>, seed: number, skill: 'reading' | 'listening' = 'listening') {
  const reading = skill === 'reading';
  const sources = parseSentenceSources(input, seed);
  const candidates = sources.filter(source => !seen.has(source.audio.sha256)
    && !/\b(?:if|unless|only|sometimes|might|may|perhaps|before|after|but)\b/i.test(source.text)).flatMap(source => {
    if (reading && source.text.includes('It is not a book.') && source.text.includes('It is a big book.')) return [];
    const statements = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(source.text)].flatMap(statement => {
      const match = /^((?:It|She|He|This) is|I am|(?:You|We|They) are|I['’]m)( not)? ([A-Za-z]+(?: [A-Za-z]+){0,6})\.\s*$/.exec(statement.segment);
      if (!match || /\b(?:here|there|not|never|and|or|either|neither)\b/i.test(match[3])) return [];
      // A name supplied by the title cannot prove independent comprehension.
      if (/^[A-Z][a-z]+$/.test(match[3]) && source.title.includes(match[3])) return [];
      if (reading && (!['It is', 'This is'].includes(match[1]) || !/^(?:a (?:big )?(?:pen|book)|the (?:gym|mailroom)|beautiful)$/.test(match[3]))) return [];
      // Admit the reviewed same-room correction; leave other deictic contexts unavailable.
      if (match[1] === 'This is' && source.text !== "Oh, Pete. This is not the gym. That's right, Anna. This is the mailroom.") return [];
      const end = statement.index + statement.segment.trimEnd().length;
      const segment = source.segments.find(segment => segment.start <= statement.index && segment.end >= end);
      if (!segment) return [];
      return [{ source, statement: statement.segment.trim(), prefix: match[1], predicate: match[3], negative: !!match[2], segment }];
    });
    // shortcut: inspected atomic present-be polarity; review other forms and scopes before extending.
    const key = (candidate: typeof statements[number]) => `${candidate.prefix.replace(/^I['’]m$/, 'I am')} ${candidate.predicate}`.toLowerCase();
    return statements.filter(candidate => !statements.some(other => key(other) === key(candidate) && other.negative !== candidate.negative));
  });
  const negative = candidates.filter(candidate => candidate.negative);
  const negativeRoots = new Set(negative.map(candidate => candidate.source.rootId));
  const allPositive = candidates.filter(candidate => !candidate.negative);
  const positiveOnly = allPositive.filter(candidate => !negativeRoots.has(candidate.source.rootId));
  const primary = reading && seed % 2 ? positiveOnly.length ? positiveOnly : allPositive : negative;
  const first = primary[(reading ? Math.floor(seed / 2) : seed) % primary.length];
  if (!first) return;
  const affirmative = candidates.filter(candidate => !candidate.negative && candidate.source.rootId !== first.source.rootId);
  const reserved = affirmative.filter(candidate => !negativeRoots.has(candidate.source.rootId));
  const positive = reserved.length ? reserved : affirmative;
  const application = reading && !first.negative ? negative.filter(candidate => candidate.source.rootId !== first.source.rootId) : positive;
  const second = application[(reading ? Math.floor(seed / 2) + 1 : seed + 1) % application.length];
  if (!second) return;
  const pair = !reading && seed % 2 ? [second, first] : [first, second];
  const materials = pair.map((candidate, index) => {
    const { source, statement, prefix, predicate, negative, segment } = candidate;
    const id = `corpus-${source.audio.sha256}`;
    const probeNegative = ((seed >>> 2) + index) % 2 === 1;
    const probe = `${prefix}${probeNegative ? ' not' : ''} ${predicate}.`;
    const stated = reading ? negative === probeNegative ? 'Yes' : 'No' : statement;
    const alternate = reading ? stated === 'Yes' ? 'No' : 'Yes' : `${prefix}${negative ? '' : ' not'} ${predicate}.`;
    const answer = (seed + index) % 2;
    const options = answer ? [alternate, stated] : [stated, alternate];
    const correct = local(`You hear “${statement}”. Keep the same person or thing. Listen for “not”.`, `录音说的是“${statement}”。保留人物和动作，核对是否有“not”。`, `錄音說的是「${statement}」。保留人物和動作，核對是否有「not」。`);
    const incorrect = local(`“${alternate}” changes the recording's yes/no meaning. It says “${statement}”.`, `“${alternate}”改变了录音的肯定或否定含义。原话是“${statement}”。`, `「${alternate}」改變了錄音的肯定或否定含義。原話是「${statement}」。`);
    const textCorrect = local(`Text: “${statement}” Question: “${probe}” Choose “${stated}”. “Yes” means the same message; “No” means a different message. Keep the same person or thing.`, `原文：“${statement}”题目：“${probe}”应选“${stated}”。Yes表示意思相同，No表示不同。保留同一人物或事物，核对“not”。`, `原文：「${statement}」題目：「${probe}」應選「${stated}」。Yes表示意思相同，No表示不同。保留同一人物或事物，核對「not」。`);
    const textIncorrect = local(`“${alternate}” gives the wrong yes/no answer. Text: “${statement}” Question: “${probe}” Compare “not”. Choose “${stated}”.`, `“${alternate}”误判了题目是否符合原文。原文：“${statement}”题目：“${probe}”核对“not”，应选“${stated}”。`, `「${alternate}」誤判了題目是否符合原文。原文：「${statement}」題目：「${probe}」核對「not」，應選「${stated}」。`);
    const explanations = reading ? [textCorrect, textIncorrect] : [correct, incorrect];
    return { id, rootId: source.rootId, sourceId: source.rootId, title: source.title, ...(!reading ? { audio: source.audio } : {}),
      credit: { attribution: `VOA Learning English, ${source.title}; ${reading ? 'transcript of a continuous recording excerpt' : 'recording excerpt transcoded to MP3'}.`, license: source.audio.license, sourceUrl: source.audio.sourceUrl },
      blocks: [{ id, text: source.text }], questions: [{ id: `${id}-${reading ? 'rpol' : 'pol'}`, blockId: id, prompt: reading ? `${readingPolarityPrompt}\n${probe}` : beginnerPolarityPrompt, options, answer,
        evidence: { start: segment.start, end: segment.end, ...(!reading ? { audioStart: segment.audioStart, audioEnd: segment.audioEnd } : {}) },
        ...(index === 0 ? { hints: [reading ? local('Compare the text and the question.', '对照原文和题目。', '對照原文和題目。') : local('Listen for the whole statement.', '听完整句子。', '聽完整句子。'), reading ? local('Find the same person, thing or place.', '找到同一人物、物品或地点。', '找到同一人物、物品或地點。') : local('Keep the person and action.', '保留人物和动作。', '保留人物和動作。'), reading ? local('“Not” changes the message. Yes means the same; No means different.', '“Not”改变意思。两句意思相同选Yes，不同选No。', '「Not」改變意思。兩句意思相同選Yes，不同選No。') : local('“Not” changes yes to no.', '“Not”把肯定改为否定。', '「Not」把肯定改為否定。')] } : {}),
        explanations: answer ? explanations.toReversed() : explanations }] };
  });
  return lessonSchema.parse({ id: `corpus-v1-${reading ? 'reading-' : ''}polarity-${pair[0].source.audio.sha256.slice(0, 16)}-${pair[1].source.audio.sha256.slice(0, 16)}`, targetLevel: 'A1', skill,
    sourceId: 'voa-short-utterances', reviewStatus: 'draft', themes: ['daily-life'], goalId: reading ? 'stated-polarity-verification' : 'heard-polarity-verification', generation: { generator: 'corpus-v1', seed, startingPoint: 'A1' },
    title: reading ? local('Check what you read', '核对读到的信息', '核對讀到的資訊') : local('Check what you hear', '核对听到的信息', '核對聽到的資訊'), goal: reading ? local('Check if a sentence says the same as the text.', '判断一句话是否保留了原文的肯定或否定。', '判斷一句話是否保留了原文的肯定或否定。') : local('Hear yes and no in short sentences.', '核对录音说的内容，留意“not”。', '核對錄音說的內容，留意「not」。'),
    teaching: reading ? local('Read the text and the question. Same message: Yes. Different message: No. Check “not”. Words: a pen is for writing; a book is for reading; beautiful means nice to see; cook means make food. Places: a kitchen is a room for cooking; a gym is for exercise; a mailroom is for letters.', '阅读原文和题目。意思相同选Yes，不同选No，核对“not”。词语：pen是笔，book是书，beautiful表示美丽，cook表示做饭。地点：kitchen是厨房，gym是健身房，mailroom是收发室。', '閱讀原文和題目。意思相同選Yes，不同選No，核對「not」。詞語：pen是筆，book是書，beautiful表示美麗，cook表示做飯。地點：kitchen是廚房，gym是健身房，mailroom是收發室。') : local('Listen to all the words. Pick the same message. Keep the person or thing and the action. “Not” changes yes to no.', '听完整句子，选择含义相同的话。不要改变人物、动作或肯定／否定。', '聽完整句子，選擇含義相同的話。不要改變人物、動作或肯定／否定。'),
    workedExample: reading ? local('Made-up example: A cup holds a drink. Text: “It is a cup.” Question: “It is a cup.” → Yes. Question: “It is not a cup.” → No. Text: “It is not a cup.” Question: “It is a cup.” → No. Question: “It is not a cup.” → Yes.', '虚构示例：Cup是杯子。原文：“It is a cup.”题目：“It is a cup.” → Yes；题目：“It is not a cup.” → No。原文：“It is not a cup.”题目：“It is a cup.” → No；题目：“It is not a cup.” → Yes。', '虛構示例：Cup是杯子。原文：「It is a cup.」題目：「It is a cup.」 → Yes；題目：「It is not a cup.」 → No。原文：「It is not a cup.」題目：「It is a cup.」 → No；題目：「It is not a cup.」 → Yes。') : local('Made-up example: “It is red.” Choose “It is red.” “It is not red” changes the message.', '虚构示例：“It is red.”应选择“It is red.”。“It is not red”改变了含义。', '虛構示例：「It is red.」應選擇「It is red.」。「It is not red」改變了含義。'),
    nextStep: reading ? local('Read the other text. Compare the person/thing and “not”, without hints.', '阅读另一原作，核对人物／事物及“not”的含义，不用提示。', '閱讀另一原作，核對人物／事物及「not」的含義，不用提示。') : local('Try another recording. Keep the person, action and “not”.', '换一份录音，保留人物、动作及“not”的含义。', '換一份錄音，保留人物、動作及「not」的含義。'), materials });
}
