import { contentLocale } from '../../src/shared/locale';
import { useState } from 'react';
import { travelVariant } from './variants';
import type { Session } from '../../src/data/db';
import type { Lesson, Locale } from '../../src/shared/content';

export const generatedPracticeLabels = {
  'zh-Hans': { title: '虚构行程变式', note: 'A2 阅读草稿 · 两种通知模板、有限的时间和地点组合。相关变式不算新根材料，不用于独立检测。', start: '开始变式练习', resume: '继续变式练习', exhausted: '连续检查了 30 个候选，均已练习过。本次没有生成新题；请复习已保存的任务或选择其他材料。' },
  'zh-Hant': { title: '虛構行程變式', note: 'A2 閱讀草稿 · 兩種通知模板、有限的時間和地點組合。相關變式不算新根材料，不用於獨立檢測。', start: '開始變式練習', resume: '繼續變式練習', exhausted: '連續檢查了 30 個候選，均已練習過。本次沒有生成新題；請複習已儲存的任務或選擇其他材料。' },
  en: { title: 'Fictional journey variants', note: 'A2 reading draft · Two notice templates with finite time and place combinations. Related variants are not new root materials and cannot be independent checks.', start: 'Start variant practice', resume: 'Resume variant practice', exhausted: 'All 30 candidates checked were already used. No new task was generated; review a saved task or choose other material.' },
};
export function GeneratedPractice({ locale, history, busy, onStart }: { locale: Locale; history: Session[]; busy: boolean; onStart: (lesson: Lesson) => Promise<void> }) {
  const [exhausted, setExhausted] = useState(false);
  const t = generatedPracticeLabels[contentLocale(locale)];
  const active = history.find(session => session.lesson.generation?.generator === 'travel-v1' && session.status === 'active');
  async function start() {
    setExhausted(false);
    const lesson = active?.lesson ?? travelVariant(crypto.getRandomValues(new Uint32Array(1))[0], new Set(history.map(session => session.lesson.id))).lesson;
    if (lesson) await onStart(lesson);
    else setExhausted(true);
  }
  return <section className="task-row generated-practice"><h2>{t.title}</h2><p>{t.note}</p><button className="primary" disabled={busy} onClick={() => void start()}>{active ? t.resume : t.start}</button>{exhausted && <p role="status">{t.exhausted}</p>}</section>;
}
