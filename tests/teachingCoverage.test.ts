import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {corpusLesson,corpusSchema,corpusWorkedExample,corpusAttribution,corpusAttributionPairs,corpusOutcome} from '../src/core/corpus';
import {spokenAttributionMatchingPrompt,spokenAttributionPairs} from '../src/core/spokenAttribution';
import {questions,score,asTestLesson} from '../src/shared/content';

it('gives complete reading fallbacks at every non-beginner starting point without changing assessed source operations',()=>{
 const original=corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json','utf8')));
 // Use test-only boundary text with no unused teaching sentence.
 const text='The museum opened before 2005. The tram service began around 2010. Visitors followed the guide into the main gallery.';
 const bank={...original,records:original.records.slice(0,2).map((source,index)=>{const wording=index?text.replace('museum','theatre').replace('tram','bus').replace('Visitors','Guests'):text;return {...source,passages:[{id:String(index+1).repeat(64),text:wording,wordCount:wording.split(/\s+/).length}]};})};
 for(const level of ['B1','B2','C1','C2'] as const)for(const kind of ['table','sequence','completion'] as const) {
  // Meet advanced context minimums without adding unused restoration sentences.
  const input=level==='C1'||level==='C2'?{...bank,records:bank.records.map(source=>({...source,passages:source.passages.map(passage=>({...passage,text:Array(110).fill('a').join(' ')+'. '+passage.text,wordCount:passage.wordCount+110}))}))}:bank;
  const lesson=corpusLesson(input,new Set(),0,700,level,[],kind)!;
  expect(lesson).toBeDefined();
  expect(lesson.materials.map(material=>'kind' in material.questions[0]?material.questions[0].kind:'choice'),`${level}/${kind}`).toEqual([kind,kind]);
  if(kind==='sequence'||kind==='table')expect(corpusWorkedExample(lesson.materials[0],0,level)).toBeUndefined();
  const example=lesson.workedExample!.en;
  expect(example).toContain('Example:');expect(example).not.toContain('The author says');
  if(kind==='table'){expect(example).toContain('2005;');expect(example).toContain('2010. Enter only the digits');}
  if(kind==='sequence'){expect(example).toContain('“Mina opens a window.” →');expect(example).toContain('do not infer');}
  if(kind==='completion'&&!corpusWorkedExample(lesson.materials[0],0,level))expect(example).toContain('Answer: “blue”');
  for(const {question:q} of questions(lesson))if('kind' in q&&q.kind==='table')expect(score(q,q.rows.map(row=>row.answer)).correct).toBe(true);
  const tested=asTestLesson(lesson);expect(tested.teaching).toBeUndefined();expect(tested.workedExample).toBeUndefined();
 }
});

it('uses unused named-source wording for the exact listening matching prompt, with all assessed claims excluded',()=>{
 const text='According to Dana, the route may shorten journeys during the trial. Robin Jones argued that a shorter journey does not necessarily cost less. According to Mira, the timetable may change during the trial.';
 const task=corpusAttributionPairs(text,0)!;
 const source=corpusSchema.parse(JSON.parse(readFileSync('public/corpus/gutenberg.json','utf8'))).records[0];
 const material={id:'unused-source',rootId:source.rootId,title:source.title,blocks:[{id:'unused-source',text}],questions:[{kind:'matching' as const,id:'claims',blockId:'unused-source',prompt:spokenAttributionMatchingPrompt,pairs:task.pairs,choices:task.choices,evidence:task.evidence,additionalEvidence:task.otherEvidence.map(span=>({...span,blockId:'unused-source'})),explanation:{en:'Match sources','zh-Hans':'Match sources','zh-Hant':'Match sources'}}]};
 const example=corpusWorkedExample(material,0,'B2',true)!;
 expect(example).toBeDefined();expect(example.en).toContain(['Dana','Robin Jones','Mira'].find(name=>!task.choices.includes(name))!);
 for(const pair of task.pairs)expect(example.en).not.toContain(pair.label);
});

it('validates both complete listening fallback constructions using the actual operation parsers',()=>{
 const matching='Maya said the service might open next month. Noah argued the opening depended on further funding.';
 const task=spokenAttributionPairs(matching,0)!;expect(task.pairs).toHaveLength(2);expect(new Set(task.choices).size).toBe(2);
 const result='News of the discovery spread, leading to 200 people coming to Riverton from the rest of the United States and abroad.';
 const outcome=corpusOutcome(result,0)!;expect(outcome).toBeDefined();expect(outcome.options[outcome.answer]).toContain('200 people');expect(outcome.options[outcome.answer]).toContain('resulting in');
});

it('accepts the inspected full named said-that report, while rejecting nested reports and incomplete quotations',()=>{
 const context='Envy is an emotion which occurs when a person lacks another\'s quality, skill, achievement, or possession and either desires it or wishes that the other lacked it. Envy can also refer to the wish for another person to lack something one already possesses so as to remove the equality of possession between both parties.';
 const statement='Bertrand Russell said that envy was one of the most potent causes of unhappiness.';
 for(let seed=0;seed<6;seed++) {
  const text=context+' '+statement,task=corpusAttribution(text,seed)!;
  expect(task).toBeDefined();expect(text.slice(task.evidence.start,task.evidence.end)).toBe(statement);
  expect(task.spans[task.accepted[0]].text).toBe(statement);expect(task.accepted).toHaveLength(1);
 }
 for(const invalid of [statement.replace('Bertrand Russell','He'),statement.replace('said that envy','said that Mira claimed envy'),statement.replace('said that envy','said that “envy'),statement.replace('Bertrand Russell','Recent Research')])expect(corpusAttribution(context+' '+invalid,0)).toBeUndefined();
});
