import procedureSources from '../../public/audio/b1-speech/PROCEDURE.json';
import { heardProceduralPlan, heardProceduralPlanSupport } from './heardProceduralPlan';
import intentionSources from '../../public/audio/b1-speech/INTENTION.json';
import { heardSpecificIntention, heardSpecificIntentionSupport } from './heardSpecificIntention';
import motiveSources from '../../public/audio/b1-speech/MOTIVE.json';
import { heardNarrativeMotive, heardNarrativeMotiveSupport } from './heardNarrativeMotive';
import referenceSources from '../../public/audio/b1-speech/REFERENCE.json';
import { heardB1Reference, heardB1ReferenceSupport } from './heardB1Reference';
import conditionalSources from '../../public/audio/b1-speech/CONDITION.json';
import { heardConditionalMeaning, heardConditionalSupport } from './heardConditionalMeaning';
import{z}from'zod';
import sources from'../../public/audio/b1-speech/MAINIDEA.json';
import{lessonSchema,recordingSchema,sourceCreditSchema,type Lesson}from'../shared/content';
import{validateAudioTextSegments}from'./beginnerListening';
import{corpusMainPoint,mainPointSupport}from'./corpusMainPoint';
const sourceSchema=z.object({rootId:z.string().regex(/^(?:voa-article|gutenberg-book)-\d+$/),sourceHash:z.string().regex(/^[a-f0-9]{64}$/),title:z.string().min(1).max(300),text:z.string().min(40).max(2000),audio:recordingSchema.extend({src:z.string().regex(/^\/audio\/b1-speech\/[a-z0-9-]+\.mp3$/),duration:z.number().positive().max(60),synthetic:z.literal(false)}),credit:sourceCreditSchema,segments:z.array(z.object({start:z.number().int().nonnegative(),end:z.number().int().positive(),text:z.string().min(1),audioStart:z.number().nonnegative(),audioEnd:z.number().positive()}).strict()).min(1).max(100)}).strict().superRefine(validateAudioTextSegments);
const admitted=sources.map(source=>sourceSchema.parse(source));
const admittedConditional=conditionalSources.map(source=>sourceSchema.parse(source));
const admittedReference=referenceSources.map(source=>sourceSchema.parse(source));
const local=(en:string,hans:string,hant:string)=>({en,'zh-Hans':hans,'zh-Hant':hant});
export const mainPointListeningSources=sources;
const listeningTargets={
 plan:{references:procedureSources.map(source=>sourceSchema.parse(source)),frame:heardProceduralPlan,support:heardProceduralPlanSupport,suffix:'plan',sourceId:'b1-procedural-plan',goalId:'integrated-procedural-plan',title:local('Follow the complete procedure','跟随完整操作计划','跟隨完整操作計畫')},
 intention:{references:intentionSources.map(source=>sourceSchema.parse(source)),frame:heardSpecificIntention,support:heardSpecificIntentionSupport,suffix:'intent',sourceId:'b1-specific-intention',goalId:'specific-speaker-intention',title:local('Listen for the expressed intention','听懂具体意图','聽懂具體意圖')},
 main:{references:admitted,frame:corpusMainPoint,support:mainPointSupport,suffix:'main',sourceId:'b1-main-points',goalId:'main-point-vs-detail',title:local('Listen for the overall point','听懂整体主旨','聽懂整體主旨')},
 condition:{references:admittedConditional,frame:heardConditionalMeaning,support:heardConditionalSupport,suffix:'rel',sourceId:'b1-conditional-meaning',goalId:'condition-outcome-limits',title:local('Listen for conditions and reasons','听懂条件与理由','聽懂條件與理由')},
 reference:{references:admittedReference,frame:heardB1Reference,support:heardB1ReferenceSupport,suffix:'ref',sourceId:'b1-context-reference',goalId:'b1-context-reference',title:local('Listen for the reference','听懂指代','聽懂指代')},
 motive:{references:motiveSources.map(source=>sourceSchema.parse(source)),frame:heardNarrativeMotive,support:heardNarrativeMotiveSupport,suffix:'why',sourceId:'b1-narrative-motive',goalId:'stated-narrative-motive',title:local('Listen for the stated reason','听懂所述理由','聽懂所述理由')},
};


/** Generate same-goal applications from intact, exactly inspected B1 listening sources. */
function b1ListeningLesson(input:unknown,seen:ReadonlySet<string>,seed:number,kind:keyof typeof listeningTargets='main'){
 const target=listeningTargets[kind],{references,support}=target;
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error('INVALID_MAIN_POINT_LISTENING');
 const parsed=z.array(sourceSchema).max(20).parse(input);
 if(parsed.some(source=>!references.some(reference=>JSON.stringify(source)===JSON.stringify(reference))))throw new Error('UNKNOWN_MAIN_POINT_SOURCE');
 if(new Set(parsed.map(s=>s.rootId)).size!==parsed.length||new Set(parsed.map(s=>s.audio.sha256)).size!==parsed.length||new Set(parsed.map(s=>s.audio.src)).size!==parsed.length)throw new Error('DUPLICATE_MAIN_POINT_SOURCE');
 const available=parsed.filter(s=>!seen.has(s.audio.sha256)),first=available[seed%available.length],second=available.find(s=>s.rootId!==first?.rootId);if(!first||!second)return;
 const materials=[first,second].map((source,index):Lesson['materials'][number]=>{const frame=target.frame(source.text,(seed+index)>>>0);if(!frame)throw new Error('UNSUPPORTED_MAIN_POINT_FRAME');const id=`corpus-${source.audio.sha256}`;
  // The whole verified window supports the argument; no new fine-grained word timestamps are claimed.
  const audioEvidence=(span:{start:number;end:number})=>({...span,audioStart:0,audioEnd:source.audio.duration});
  return{id,rootId:source.rootId,sourceId:source.rootId,title:source.title,audio:source.audio,credit:source.credit,blocks:[{id,text:source.text}],questions:[{id:`${id}-${target.suffix}`,blockId:id,prompt:frame.prompt,options:frame.options,answer:frame.answer,evidence:audioEvidence(frame.evidence),additionalEvidence:frame.additionalEvidence.map(span=>({blockId:id,...audioEvidence(span)})),...(!index?{hints:support.hints}:{}),explanations:'optionExplanations'in frame?frame.optionExplanations:frame.explanations}]};
 });
 return lessonSchema.parse({id:`corpus-v1-b1-${target.suffix}-${first.audio.sha256.slice(0,16)}-${second.audio.sha256.slice(0,16)}`,targetLevel:'B1',skill:'listening',reviewStatus:'draft',sourceId:target.sourceId,goalId:target.goalId,generation:{generator:'corpus-v1',seed,startingPoint:'B1'},title:target.title,goal:support.goal,teaching:support.teaching,workedExample:support.workedExample,nextStep:support.nextStep,materials});
}

export const conditionListeningSources=conditionalSources;
export function mainPointListeningLesson(input:unknown,seen:ReadonlySet<string>,seed:number){return b1ListeningLesson(input,seen,seed);}
export function conditionListeningLesson(input:unknown,seen:ReadonlySet<string>,seed:number){return b1ListeningLesson(input,seen,seed,'condition');}

export const referenceListeningSources=referenceSources;
export function referenceListeningLesson(input:unknown,seen:ReadonlySet<string>,seed:number){return b1ListeningLesson(input,seen,seed,'reference');}

export const motiveListeningSources=motiveSources;
export function motiveListeningLesson(input:unknown,seen:ReadonlySet<string>,seed:number){return b1ListeningLesson(input,seen,seed,'motive');}

export const intentionListeningSources=intentionSources;
export function intentionListeningLesson(input:unknown,seen:ReadonlySet<string>,seed:number){return b1ListeningLesson(input,seen,seed,'intention');}

export const procedureListeningSources=procedureSources;
export function procedureListeningLesson(input:unknown,seen:ReadonlySet<string>,seed:number){return b1ListeningLesson(input,seen,seed,'plan');}
