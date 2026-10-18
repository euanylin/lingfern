import { translateInstruction, contentText, messages } from '../locales';
import { GutenbergLicence } from './GutenbergLicence';
import { gutenbergTerms, isGutenbergSource } from '../shared/sourceLicence';
import { useEffect, useRef, useState } from 'react';
import { feedbackNotes, saveFeedbackNote, type Attempt, type FeedbackNote } from '../data/db';
import { prepareFeedback } from '../shared/ai-feedback';
import { practiceLocale, answerText, correctAnswerText, explanationText, type Lesson, type Locale, type Question } from '../shared/content';
import { copy } from './i18n';
import { SharingUpload } from './SharingUpload';

const requests = messages('aiHandoff_requests');
const labels = messages('aiHandoff');

export function AiHandoff({ locale, lesson, material, question, attempt }: { locale: Locale; lesson: Lesson; material: Lesson['materials'][number]; question: Question; attempt: Attempt }) {
  const t = labels[locale];
  const [request, setRequest] = useState(0);
  const [included, setIncluded] = useState({ goal: true, material: true, task: true, response: true, feedback: true });
  const materialInput = useRef<HTMLTextAreaElement>(null);
  const [materialExcerpt, setMaterialExcerpt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pasted, setPasted] = useState('');
  const [pending, setPending] = useState<{ kind: FeedbackNote['kind']; content: string; unknownReferences: boolean }>();
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  useEffect(() => { void feedbackNotes.where('attemptId').equals(attempt.id).toArray().then(rows => setNotes(rows.filter(row => row.profileId === attempt.profileId))).catch(() => setMessage(t.invalid)); }, [attempt.id, attempt.profileId, t.invalid]);
  function previewPlainText() {
    const content = pasted.trim();
    if (!content || new TextEncoder().encode(content).length > 64 * 1024) { setMessage(t.invalid); return; }
    setPending({ kind: 'text', content, unknownReferences: false }); setMessage('');
  }
  async function previewJson(file?: File) {
    if (!file) return;
    try {
      if (file.size > 64 * 1024) throw new Error('FEEDBACK_SIZE');
      setPending({ kind: 'structured', ...prepareFeedback(await file.text(), lesson, material) }); setMessage('');
    } catch { setPending(undefined); setMessage(t.invalid); }
  }
  async function saveNote() {
    if (!pending) return;
    const note: FeedbackNote = { id: crypto.randomUUID(), profileId: attempt.profileId, attemptId: attempt.id, ...pending, createdAt: new Date().toISOString() };
    try { await saveFeedbackNote(note); setNotes(previous => [...previous, note]); setPending(undefined); setPasted(''); setMessage(t.saved); }
    catch { setMessage(t.invalid); }
  }
  const answer = answerText(question, attempt.answer);
  const correct = correctAnswerText(question);
  const evidence = [{ blockId: question.blockId, ...question.evidence }, ...(question.additionalEvidence ?? [])].map(span => {
    const block = material.blocks.find(item => item.id === span.blockId);
    return block ? block.text.slice(span.start, span.end) : '';
  }).filter(Boolean);
  const materialText = material.blocks.map(block => [block.title, block.text].filter(Boolean).join('\n')).join('\n\n');
  function applyExcerpt() {
    const input = materialInput.current;
    if (!input) return;
    const selected = materialText.slice(input.selectionStart, input.selectionEnd).trim();
    if (selected) setMaterialExcerpt(selected);
  }
  const contentLocale = practiceLocale(lesson, locale);
  const fields = {
    goal: `${lesson.skill} — ${contentText(lesson.goal, contentLocale)}`,
    material: `${materialExcerpt === null ? materialText : `${t.excerptOnly}\n${materialExcerpt}`}${!material.credit ? `\n\n${t.source}: ${material.audio ? `${material.audio.author}; ${material.audio.license}` : lesson.sourceId}` : ''}`,
    task: question.prompt,
    response: answer,
    feedback: `${attempt.correct === null ? copy[locale].unscored : attempt.correct ? copy[locale].correct : copy[locale].incorrect}. ${'criteria' in question ? `${copy[locale].possibleResponse}: ` : ''}${correct}. ${evidence.join(' / ')}. ${translateInstruction(explanationText(question, attempt.answer, contentLocale), contentLocale)}${'criteria' in question ? `\n${question.criteria.map((criterion, index) => `${contentText(criterion, contentLocale)}: ${attempt.selfAssessment?.[index] ?? 'not self-assessed'}`).join('\n')}` : ''}`,
  };
  const sections = (Object.keys(included) as (keyof typeof included)[]).filter(key => included[key]).map(key => ({ label: t[key], text: fields[key] }));
  const sourceCredit = material.credit ? [material.credit.attribution, material.credit.license, material.credit.sourceUrl, material.audio?.author, material.audio?.license, material.audio?.sourceUrl].filter(Boolean).join('\n') : '';
  if (material.credit && (included.material || included.task || included.feedback)) sections.push({ label: t.source, text: sourceCredit + (isGutenbergSource(material.credit.sourceUrl) ? '\n\n' + gutenbergTerms : '') });
  const markdown = [`# Lingfern`, ...sections.map(({ label, text }) => `## ${label}\n${text}`), `## ${t.request}\n${requests[locale][request]}`].join('\n\n');
  const json = JSON.stringify({ product: 'Lingfern', sections, request: requests[locale][request] }, null, 2);
  const tooLarge = Math.max(new TextEncoder().encode(markdown).length, new TextEncoder().encode(json).length) > 64 * 1024;
  const saveFile = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <details className="ai-handoff"><summary>{t.title}</summary><p className="muted">{t.intro}</p>
    <fieldset><legend>{t.request}</legend>{requests[locale].map((label, index) => <label className="ai-request" key={label}><input type="radio" name={`ai-request-${attempt.id}`} checked={request === index} onChange={() => setRequest(index)}/>{label}</label>)}</fieldset>
    <fieldset><legend>{t.preview}</legend><div className="ai-select">{(Object.keys(included) as (keyof typeof included)[]).map(key => <label key={key}><input type="checkbox" checked={included[key]} onChange={event => setIncluded(previous => ({ ...previous, [key]: event.target.checked }))}/>{t[key]}</label>)}</div>
      {included.material && <details className="ai-excerpt"><summary>{t.excerpt}</summary><label htmlFor={`ai-material-${attempt.id}`}>{t.material}</label><textarea ref={materialInput} id={`ai-material-${attempt.id}`} readOnly value={materialText} rows={5}/><div className="ai-actions"><button type="button" onClick={applyExcerpt}>{t.applyExcerpt}</button>{materialExcerpt !== null && <button type="button" onClick={() => setMaterialExcerpt(null)}>{t.fullMaterial}</button>}</div></details>}
    </fieldset>
    <article className="ai-preview"><h3>{t.preview}</h3><p><strong>Lingfern</strong></p>{sections.map(({ label, text }) => <section key={label}><h4>{label}</h4>{label === t.source && isGutenbergSource(material.credit?.sourceUrl) ? <><p>{sourceCredit}</p><GutenbergLicence sourceUrl={material.credit?.sourceUrl} locale={locale}/></> : <p>{text}</p>}</section>)}<section><h4>{t.request}</h4><p>{requests[locale][request]}</p></section></article>
    {tooLarge && <p role="alert" className="error">{t.tooLarge}</p>}
    <div className="ai-actions"><button type="button" disabled={tooLarge} onClick={() => void (navigator.clipboard?.writeText(markdown) ?? Promise.reject()).then(() => setMessage(t.copied)).catch(() => setMessage(t.failed))}>{t.copy}</button><button type="button" disabled={tooLarge} onClick={() => saveFile('lingfern-context.md', markdown, 'text/markdown;charset=utf-8')}>{t.markdown}</button><button type="button" disabled={tooLarge} onClick={() => saveFile('lingfern-context.json', json, 'application/json')}>{t.json}</button>{typeof navigator.share === 'function' && <button type="button" disabled={tooLarge} onClick={() => void navigator.share({ text: markdown }).catch(() => setMessage(t.failed))}>{t.share}</button>}</div>
    <SharingUpload key={`${attempt.profileId}:${attempt.id}:${contentText(lesson.title, locale)}:${markdown}`} locale={locale} profileId={attempt.profileId} attemptId={attempt.id} title={contentText(lesson.title, locale)} text={markdown}/>
    <section className="ai-import"><h3>{t.importTitle}</h3><label htmlFor={`ai-paste-${attempt.id}`}>{t.paste}</label><textarea id={`ai-paste-${attempt.id}`} value={pasted} onChange={event => setPasted(event.target.value)} rows={5}/><div className="ai-actions"><button type="button" onClick={previewPlainText}>{t.review}</button><label className="backup-file-label"><input className="sr-only" type="file" accept=".json,application/json" aria-label={t.structured} onChange={event => { void previewJson(event.target.files?.[0]); event.target.value = ''; }}/><span className="button backup-file-button">{t.structured}</span></label></div>
      {pending && <div className="ai-preview"><h4>{t.review}</h4><p>{pending.content}</p>{pending.unknownReferences && <p className="muted">{t.unknown}</p>}<button type="button" onClick={() => void saveNote()}>{t.save}</button></div>}
      {notes.length > 0 && <div><h4>{t.notes}</h4>{notes.map(note => <div className="ai-preview" key={note.id}><p>{note.content}</p>{note.unknownReferences && <p className="muted">{t.unknown}</p>}</div>)}</div>}
    </section><p role="status" aria-live="polite">{message}</p>
  </details>;
}
