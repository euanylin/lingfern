import rules from '../../content/quote-language-rules.json';
const archaic = new RegExp(`\\b(?:${rules.archaicForms.join('|')})\\b`, 'i');
// shortcut: lexical holds catch common archaic forms; unfamiliar historical syntax still needs source review.
export const readableQuotation = (text: string) => !archaic.test(text);
