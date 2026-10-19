import { messages } from '../locales';
import type { Locale } from '../shared/content';
import type { useQuestionSheetLayout } from './useQuestionSheetLayout';

export function QuestionSheetResize({ locale, controls, resize }: { locale: Locale; controls: string; resize: ReturnType<typeof useQuestionSheetLayout>['resize'] }) {
  const { minimum, maximum, height, ...handlers } = resize;
  if (maximum <= minimum) return null;
  const value = Math.round((height - minimum) / (maximum - minimum) * 100);
  return <div className="question-sheet-resize" role="separator" tabIndex={0} aria-label={messages('workspace')[locale].resize} aria-orientation="horizontal" aria-controls={controls} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} {...handlers}><span aria-hidden="true"/></div>;
}
