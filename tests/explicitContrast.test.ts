import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { corpusExplicitContrast, corpusLesson, corpusSchema } from '../src/core/corpus';
import { corpusOperation, explicitContrastPrompt } from '../src/core/corpusPractice';
import { advance, attempts, claimSession, createSession, db, markExposure, sessions, submit, type Session } from '../src/data/db';
import { asTestLesson, questions, score } from '../src/shared/content';

const operation = 'choice:explicit-contrast';
const ids = [
  'ee0e201871c20470be211a28f2f6d49ab3700f2370a903b778b9a83cb7e00cc8',
  'c448213083ad4640727ec83a4cb62e246cd415d84aff7aadfb5a6a5a8e8eca92',
  'c37a185e05f98c36a6210b28c4b63fc07afdbf5563f561ff1a63269db0a370eb',
  '53838c98433deacd3278f5990a15b1ad7b8fa18e81087ef5e480182367c392c5',
  'a04297365078d64be23589530a12fbff0ca50a370c18ddf2f12a7f5895792a96',
  '61fd3fae5b76dd40b4e5236e239c276765ca7af02f1b50a06627f02864a6b639',
  '8e17a03b93d58c39188380ccb6934fb31700721eced676065053d9dc116162e0',
  'adef8ab82d936e1026b56c0f01cafab418e18d74bed7d3f9a2a0011c3e04fae0',
  'de9830b1d23f322630f908d5fc06fc6c546cb97a95c7583b6c16007df64c5e05',
  '8380120d0ac2483b130ea16bf63fe85514ac61e474728290d008f47e16504a95',
  '95abcfdce69b7cf4ea7a2b9fb3edad8699904c4ebb13f528b72c54911073d5e4',
  '6683e0aec11a511732c163d7d040c3ec37d8e19eecd37d1ca9ccbaef2f71eea9',
  'd9072067b93389a03beba4181c5f839fd2edb5ded10c33d4cc4a48f61a7527e8',
  'e330a42444fe4e18193094fb124dff602ce20be0ece80f23777fe38fb490026f',
  '662a93e1f5e24b5edee770fe9e621047309d3592c32efe95658980c81dac832f',
  '3d5c86620badca79a7247b1e29438ac8e5fff5e786f13829ab1f9a30afab70c3',
  'f146320e147979cd1cbf0adb7ca67547a329378542736a2fcdb103a0fdd27833',
  'ebfca1b06a0939c7ad74b0aa2de8ee17900f5ef7dd3ea2b9b12d543444f92ce2',
  'b07d190bfbb8995a7c02e729ac14cf36677407e5aa9ae76bb94f6113ea94025b',
  '95bb4304fe9184435c39ade3a095a8781e49990119902dd48fb54973d686a21c',
  '98fbd2c1d64b8ed4cf075fe93d2d0169b6c8492723c7588713b45d7df7f4649b',
  '0c958d7fd6a53a1415ce0a46586c649a88c32d0e1f2aa0de0c884ec6d98d9da3',
  'eb87dd6168e1cbbfd16516bc907ac157b007713054e59749645a8757380c7267',
  '3448212d543c591e97abe8e3ec303b0ac35e689138f2f5a21b7c209022579cb9',
  '62e1ca31226634afb8160c78afa70508dc31f3515b808f2a9278936224e49b6f',
  'd65ec04c18e391e3055a608ecb389e797a0afe9e39e8a15b1ee8c4c9b36b8fff',
  'f615eabf7acbc856c484ebd674afdf69e3a481173773af163cfe9a8a78ca932d',
  'f36e93e045bdac6c5f33f457d28506b3fb8a2dd55acb1351e50b98ee719fe2df',
  'a05dcac4b9a79def3f8dd8340387117f0167e8160caca2e35349b4be4e643787',
  'a94a1972e493f9d44f41591f7b6fe8e1e5b80f6c9555ee0487db0fa7f98479c5',
  '78599d9030145ce35dffa664c38be8ceed6011cdf701dc2dc0b79135f6883110',
  'fe7073dc32cc8c76fc4ae6d9fe1ef6b5e2eb293dd7610d23ed44e09d051d5166',
  'fa5fae2199ff9ffea3b8afe6c4e0f0e5041ad996f60f0ab1b9930f092678a897',
  '42a0cb028bf325d9dc31436997242eddacd0561f99efe80792ff236748dc57c5',
  'ee7c0258bb7fa4881f37a4a402997016c76033667261a42f49b04e4939ac0e72',
  '3c7b0ad6e08770cd518eb2347dfa215517159be4016935a79d5f00b84dbde6f6',
  '2855bae7969e21d10ed74fa26725f15aa934eb0208bc7ad8d17066764ffb6833',
  '9d7ee611dd9056392a4402af4e44997e7323b9c86d8534801e6d553bd4ec5a21',
  'e021e4d21e24b911e432d17f3388dc10720b0f00939adbee3a42d8c7c31a6135',
  'd4add05a3febb8579555a74e50cd151c743d4ebf036d2d5361d440a28a92892a',
  '38d1ef945c2416c5fcae0ad58ff494ea5ad6f64d6311e36eb6ab2db56800a399',
  '2c4f878e1b1f74d7c11e6613a59a15f5ccac7f8c5433e9154196e4c0c441a0f9',
  'e4fbe911b2ac0a1ca2be4792bd0a22478de631ed42865d64ccb44d5d39b44ef1',
  'f7c156e3675f68828ef3e27b3f0824a9fe9b131571b28eddbb94cdc007fd99f9',
  '46d689c283d1cfb0368b6bf5c124ef3d1618b44c6aa5e8a268e0a2e2696da494',
  '28552cfc6183e67f485736b3dc8f6846dce445bafb25650c54ceffe53fe8316b',
  'b840db20c74b022cf3c202a97f187edbdd31af3ccfd470441fb3abb57a1e2d88',
  '068a116777585bb4f41d8c31a4c8c00b60380d4a66b6b21361b4db7f0e117a86',
  '12f99b0a4b5bb2ff5aecbc04cb387e77089e931c229eaaa7540fed927da377ef',
  'e764cb60904f2de921c1026a0b71f90c5ae9d82e1a184b257064519037177907',
  'c830a93b180b70989f68b92c53a17d9fc5b8e6ab68ab25446ad3fa29c4bc09b5',
  '92816d1c326da1ea984b128e8c623d93482172aaca44d0eb6dca3cc3792263ad',
  'c402d47901630b01be6c2fdcdd5e9dc524d3e76040762b4fe8590bd83fe1dc76',
  '33b04133b827e2ab0d3b1ca847202fee3e6b530caad5b5cc145550b363d5945a',
  '94b6a3c40bff1f51078a0a3f91dd54aa0a900d2090a3b1f7dca04858a375cc54',
  'cca42f94ca67b750b28966c2819cfcaafc926351e6151ce382a0695f11a4aa8f',
  'f13bde4af882c5a5a7f03254b6143e44f75e7903bab90df263598fde3f8f590f',
  '44cdf8b99fd822fd4e3839c3628144e2072d8884a8572a4d906c069f26c3fa8e',
  '64552515df29bbed47a7f4aba367c401ce70d05e23b7e4ee76e1a1f1c05035a0',
  '081f36135e2abfcf20dfcf897676a115cce35586e25e35f23bbaf62a586b8dc4',
  'a58234fe4ddae569241baa1bd61bc4196d7c277b8dc6359fb43b8ca9ad3bc893',
  '2ec15b393b5c92a9753cfa24dfc786c22529b195fe9619678fc31c067cc1e72f',
  '47c30150c864396923780ea92e1c2abc0235180b0bf3d4db186117ae69db6710',
  '8eb586d8cba8ad25df29fecb76dd05cbe3638a14cd91fc894ebd0a2a52df0f9f',
  '1c6bf1c3eea5eab1a6c6d10d8ff64e533d0d7bdb09c89120af1932e21e0c8e25',
  '6d5792bb422cb1dbb62692822f1a3f512943a13ae31fcf5beda3f82fbfbcb1b9',
  'dffc4d6df6cd19982884cfe0cfa2f9d21d8b4637bdbe910c15ae80ed039939c4',
  '85e19f5bcfa904306466adbd49c8a3a83bc15e218163058795def4e9aa175194',
  '2d1356d4af02988dce4828e00704ea6815e3ba8adb795a00e4c5a5d7227a07d9',
  '1a8b33f22f8a93bcbd235e79b51754fdc433778bef0af91a0e97642dd06f985b',
  '03dd6b7ba087ec04b6fe2bf477272c758cab80c62a6caac327776ac7b25182d5',
  '63ede507aec0089bf749f9caf6b80d466e2d7cb3c0b97dee615f8f9759e76e6b',
  'ef3e14cfa047ad845117a7f5059e0744c8cea6cf14b8c2e70933fd27afe38f6b',
  '1cdda9f43576f70260f7a65f461c8558c1b19ae484222ffc931a60c66297948b',
  '280d8ca325d26a396683eb9c8a17681a6e597fb0770d42721c24e008eb5bca1b',
  '6d4119ea5dfd12812a972d72204c20ec760e481d27730e7b9185ea47635cec70',
  '53524fa4c2fc5bafb40ea46d42b0a9868fd6e890a5b1775aeae248230fdb3552',
  '0b8197c155abcec110c193ecce103512c8c45774c647d9b8f090b41cd286e2fe',
  'eac909a8d00ffee3d43160ec731e42758f4a246771e6e1c47cbdaa41757d4726',
  '9f7886aedb15ecae8160a683946170166a2ab9a0510d326445c81cee35c7cbf6',
  '414e600a9a3f187f878b878768a433b6b96202ae3ce640980e16a3aae4724bdd',
  '7b2967f4a2b7a49d39450ebccf5ea3b6f98a6efccecd0d7b89bc964aa062d36f',
  '76c79d04a775d248890f896fe1f3e4e4ba80b0956adf3b8cce85e5c64b3d65a3',
  'fb5fdf25da5f36433a2c406ed8e08713de943b4783b8773fcb007e41b7f3bce5',
  '308309e793e0687426ec08d0c1d21c7f4cf050fab536be7e4fe741ab0113493a',
  'e6ab06ff7e04b473e1a802d516a95e68614218117e2fc134c78292e59c0b31aa',
  '44eb6fd24cdfd6dd9ee8426b44f4813e22458072c63ec10bf11784c7db50524d',
  '8ae620e15ef19a432ff1d518fc757df39ba99e059b357f90101d5da8e8054e99',
  '91c63eacaa80c4552ed305082ec71595db6c632d535bf13ddacf022895fd9352',
  '65914403ef8fbb94f3d9e8df93679f4f29ed81b733df3bdf1083c847848d87d5',
  '6513e74cde5f0987055d11ae700f77623f1e84a91fca4e11383591d4a744264d',
  'e10e1d6a4024942e9c17c330a0f990b3e2ef6661fe0fef55638d5cfd49512318',
  '15bb40728963e9d443cb73d98cfb09bb42c08e2594fbd9b205f8394d438dce8f',
  '3d6569d9c741421fc23b828bc1c7d29ec4be715f61df46e63444e01bcbbb4ad0',
  'c75ac382a3de8300d1968efee841b7dedd94c08e1f2d886e30e72cf71c534042',
  'cf84a91bfd774370a82d90245c51b4e7d230ebc1f12510697745b0b67ffdf11a',
  'f5aa03bddde3994297a3a9111e7cac431c684d63ec9ea391a91e9ebd8c12b312',
  '20ef8767f251f16870dfd2d4b3bd12ca70bce58903cd5af57e2f8dcf50102b4d',
  '295fa895d8153bad1b2915a61d23f17e5c2b7d2f043da50ee47d81cb74600ecb',
  'a71423db139114dd35c0501eabe80198bf87330a38e5dcb130655f866b331c63',
  'd9224972f6603e472101ae2441e7cda3d9b3b93491800f947719698d3fcf6457',
  '475ff537c2852233838d6b9adcc74f6c14915046410da45e05aeaace9faff9d4',
  '28ec02552683206d55564d4a7165b7be6c7e52f82ce524ae1ffbc442f61f7e0d',
];
const psychology = 'b149c407c50af09d1356dbc933d82564949cea6bad2d7388556eb35fc81b7920';
const passages = ['public/corpus/open-reading.json', 'public/corpus/additional-2.json', 'public/corpus/additional-3.json', 'public/corpus/additional-4.json'].flatMap(file => corpusSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).records.flatMap(source => source.passages.map(passage => ({ source, passage }))));
const frames = ids.map(id => passages.find(item => item.passage.id === id)!);
const bank = { version: 1 as const, failures: [] as [], records: frames.map(({ source, passage }) => ({ ...source, passages: [passage] })) };

it('keeps inspected contrasts and rejects a conditional antecedent', () => {
  expect([...new Set(frames.map(item => item.source.rootId))].sort()).toEqual([
    'bccampus-book-introduction-tourism-hospitality',
    'bccampus-book-physical-geology-2e',
    'frontiers-article-10.3389-frym.2020.467994',
    'frontiers-article-10.3389-frym.2024.1205267',
    'frontiers-article-10.3389-frym.2025.1461108',
    'frontiers-article-10.3389-frym.2025.1571049',
    'openstax-book-american-government-3e',
    'openstax-book-anatomy-and-physiology-2e',
    'openstax-book-astronomy-2e',
    'openstax-book-biology-2e',
    'openstax-book-business-ethics',
    'openstax-book-college-physics-2e',
    'openstax-book-entrepreneurship',
    'openstax-book-introduction-anthropology',
    'openstax-book-introduction-business',
    'openstax-book-introduction-political-science',
    'openstax-book-introduction-sociology-3e',
    'openstax-book-microbiology',
    'openstax-book-organizational-behavior',
    'openstax-book-principles-economics-3e',
    'openstax-book-principles-management',
    'openstax-book-psychology-2e',
    'openstax-book-us-history',
    'openstax-book-world-history-volume-1',
    'plos-article-10.1371-journal.pone.0345687',
    'plos-article-10.1371-journal.pone.0351518',
    'plos-article-10.1371-journal.pone.0351782',
    'plos-article-10.1371-journal.pone.0356872',
    'plos-article-10.1371-journal.pone.0357011',
    'plos-article-10.1371-journal.pone.0357098',
    'plos-article-10.1371-journal.pone.0357099',
    'plos-article-10.1371-journal.pone.0357404',
    'plos-article-10.1371-journal.pone.0357446',
    'plos-article-10.1371-journal.pone.0357447',
    'plos-article-10.1371-journal.pone.0357475',
    'plos-article-10.1371-journal.pone.0357566',
    'plos-article-10.1371-journal.pone.0357710',
    'plos-article-10.1371-journal.pone.0357774',
    'plos-article-10.1371-journal.pone.0358076',
    'plos-article-10.1371-journal.pone.0358229',
    'plos-article-10.1371-journal.pone.0358231',
    'plos-article-10.1371-journal.pone.0358469',
    'plos-article-10.1371-journal.pone.0358701',
    'plos-article-10.1371-journal.pone.0358972',
    'plos-article-10.1371-journal.pone.0358980',
  ]);
  for (const { passage } of frames) for (let seed = 0; seed < 6; seed++) {
    const task = corpusExplicitContrast(passage.text, seed)!;
    expect(task.prompt).toBe(explicitContrastPrompt);
    expect(passage.text.slice(task.evidence.start, task.evidence.end)).toBe(task.sentence);
    expect(passage.text.slice(task.otherEvidence.start, task.otherEvidence.end).endsWith('.')).toBe(true);
    expect(task.options[task.answer].startsWith('By contrast,')).toBe(true);
    expect(task.options).toEqual(expect.arrayContaining([expect.stringContaining('Similarly,'), expect.stringContaining('Because ')]));
    expect(new Set(task.options).size).toBe(3);
    expect(corpusExplicitContrast(passage.text, seed)).toEqual(task);
  }
  const conditional = passages.find(item => item.passage.id === psychology)!;
  expect(corpusExplicitContrast(conditional.passage.text, 0)).toBeUndefined();
  const biology = frames[0].passage.text;
  expect(corpusExplicitContrast(biology.replace('In contrast,', 'However,'), 0)).toBeUndefined();
  expect(corpusExplicitContrast(biology.slice(biology.indexOf('In contrast,')), 0)).toBeUndefined();
  expect(corpusExplicitContrast(biology + '\n\n' + biology.slice(biology.indexOf('In contrast,')), 0)).toBeUndefined();
  expect(() => corpusExplicitContrast(biology, -1)).toThrow('INVALID_CORPUS_CONTRAST');
});

it('transfers the contrast across the inspected books at B2 and keeps Practice/Test scoring', () => {
  const reached = new Set<string>();
  for (let seed = 0; seed < 400; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 500, 'B2', [], 'choice', [], operation)!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.goal.en).toContain('explicit contrast');
    reached.add(lesson.materials[0].rootId);
    const tested = asTestLesson(lesson);
    expect(tested.teaching).toBeUndefined();
    for (const [index, material] of lesson.materials.entries()) {
      const question = material.questions[0];
      const review = tested.materials[index].questions[0];
      if ('kind' in question || 'kind' in review) throw new Error('Expected contrast choice');
      expect(corpusOperation(question)).toBe(operation);
      expect(review.options).toEqual(question.options);
      expect(review.hints).toBeUndefined();
      expect(score(question, question.answer).correct).toBe(true);
      expect(score(question, (question.answer + 1) % 3).correct).toBe(false);
      expect(score(review, question.answer)).toEqual(score(question, question.answer));
      expect(score(material.questions[1], 'The contrast stays with the previous claim.').correct).toBeNull();
    }
  }
  expect(reached).toEqual(new Set(frames.map(item => item.source.rootId)));
  expect(corpusLesson({ ...bank, records: [bank.records[0]] }, new Set(), 0, 300, 'B2', [], 'choice', [], operation)).toBeUndefined();
  for (const point of ['A2', 'B1', 'C1'] as const) expect(corpusLesson(bank, new Set(), 0, 700, point, [], 'choice', [], operation)).toBeUndefined();
});

it('saves the B2 contrast and its Test snapshot without changing the score', async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  try {
    const practice = corpusLesson(bank, new Set(), 0, 300, 'B2', [], 'choice', [], operation)!;
    for (const lesson of [practice, asTestLesson(practice)]) {
      const created = await createSession(lesson, `contrast-${lesson.mode ?? 'practice'}`);
      let current: Session = await claimSession(created.id, 'contrast-owner');
      for (const { question } of questions(lesson)) {
        await markExposure(current);
        const saved = await submit(current.id, 'contrast-owner', 'kind' in question ? 'The contrast stays with the previous claim.' : question.answer);
        expect(saved.correct).toBe('kind' in question ? null : true);
        expect(await attempts.get(saved.id)).toEqual(saved);
        current = await advance(current.id, 'contrast-owner');
      }
      expect((await sessions.get(current.id))!.status).toBe('completed');
    }
  } finally { await Promise.all(db.tables.map(table => table.clear())); }
});
