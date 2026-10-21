import rules from '../../content/quote-language-rules.json';
const archaic = new RegExp(`\\b(?:${rules.archaicForms.join('|')})\\b`, 'i');
// shortcut: lexical archaic-form holds; review unfamiliar historical syntax separately.
export const readableQuotation = (text: string) => !archaic.test(text);
