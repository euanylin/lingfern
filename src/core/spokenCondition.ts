import { corpusEvidence } from './corpus';

export const spokenConditionPrompt = 'Which statement uses “if” or “unless” to state a condition and its outcome?';

/** Select complete quoted conditions, without inferring necessity or unconditional truth. */
export function spokenCondition(text: string, seed: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || text.length > 12000) throw new Error('INVALID_SPOKEN_CONDITION');
  const candidates = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)]
    .map(part => part.segment.trim()).filter(sentence => sentence.length <= 240
      && (/^(?:If|Unless)\b.{10,}, .{10,}[.!]$/.test(sentence)
        // ponytail: comma-delimited conditions only; wider syntax needs contextual review.
        || /^.{10,}, (?:if|unless) .{10,}[.!]$/.test(sentence)
          && !/["“”\[\]]|\b(?:even if|as if|what if|asks?|asked|wonders?|wondered|checks?|checked|see|know|determine)\b/i.test(sentence)
          && (sentence.match(/\b(?:if|unless)\b/gi)?.length ?? 0) === 1)
      && text.indexOf(sentence) === text.lastIndexOf(sentence));
  const explanation = 'Keep the stated condition and outcome together, including other requirements in the recording. A conditional statement does not say that its outcome has already happened.';
  for (let index = 0; index < candidates.length; index++) {
    const evidenceText = candidates[(seed + index) % candidates.length];
    try {
      const evidence = corpusEvidence(text, { prompt: spokenConditionPrompt, evidenceText, explanation }, seed,
        alternative => /\b(?:if|unless|when|until|provided|whenever|once|would|could|might|must|should|require|need|condition)\b/i.test(alternative)
          || /^(?:The same|This|That|These|Those|It|They|He|She)\b/i.test(alternative)
          || /\band so on\b/i.test(alternative));
      return { ...evidence, prompt: spokenConditionPrompt, explanation };
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'INSUFFICIENT_SOURCE_SPANS') throw error;
    }
  }
}
