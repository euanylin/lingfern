import { contentLanguage, contentText, messages } from '../locales';
import { teachingExample } from './teachingCopy';
import { useState } from 'react';
import { practiceLocale, questions, score, type Lesson, type Locale } from '../shared/content';

const unsavedCopy = messages('unsavedDemo_unsavedCopy');
export function UnsavedDemo({ lesson, locale, onClose }: { lesson: Lesson; locale: Locale; onClose: () => void }) {
  const [position, setPosition] = useState(0);
  const [answer, setAnswer] = useState<number>();
  const [shown, setShown] = useState(false);
  const all = questions(lesson);
  const { material, question } = all[position];
  const t = unsavedCopy[locale];
  const instructionLocale = practiceLocale(lesson, locale);
  if (!('options' in question)) return null;
  const text = material.blocks.find(block => block.id === question.blockId)!.text;
  return <section className="first-run"><h1>{t.open}</h1><p className="notice" role="status">{t.notice}</p><p lang={contentLanguage(lesson.teaching ?? lesson.goal, instructionLocale)}>{lesson.teaching && contentText(lesson.teaching, instructionLocale)}</p><p lang={contentLanguage(lesson.workedExample ?? lesson.goal, instructionLocale)}>{lesson.workedExample && teachingExample(contentText(lesson.workedExample, instructionLocale))}</p><h2 lang="en">{material.title}</h2><p lang="en">{text}</p><fieldset className="first-run-choices" disabled={shown}><legend lang="en">{question.prompt}</legend>{question.options.map((option, index) => <label className="option" key={option}><input type="radio" name="unsaved-answer" checked={answer === index} onChange={() => setAnswer(index)}/><span lang="en">{option}</span></label>)}</fieldset><button disabled={answer === undefined || shown} onClick={() => setShown(true)}>{t.save}</button>{shown && answer !== undefined && <section className="feedback" aria-live="polite"><h2>{score(question, answer).correct ? t.correct : t.wrong}</h2><blockquote lang="en">{text.slice(question.evidence.start, question.evidence.end)}</blockquote><p lang={contentLanguage(question.explanations[answer], instructionLocale)}>{contentText(question.explanations[answer], instructionLocale)}</p>{position < all.length - 1 ? <button onClick={() => { setPosition(position + 1); setAnswer(undefined); setShown(false); }}>{t.next}</button> : <p>{t.done}</p>}</section>}<p><button onClick={onClose}>{t.close}</button></p></section>;
}
