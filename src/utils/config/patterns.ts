export const alnumPattern = '[A-Za-z0-9]';
export const standardPattern = '[A-Za-z0-9_]';
export const extendedWordPattern = '[A-Za-z0-9_-]';
export const bigWordPattern = '[A-Za-z0-9_.-]';
export const nonWhitespacePattern = '[\S]';

export const textPatterns = {
  alnum: alnumPattern,
  standard: standardPattern,
  extendedWord: extendedWordPattern,
  bigWord: bigWordPattern,
  nonWhitespace: nonWhitespacePattern,
} as const;

export const wordSeparators = {
  alnum: '`~!@#$%^&*()=+[{]}\\|;:\'",.<>/?_-',
  standard: '`~!@#$%^&*()=+[{]}\\|;:\'",.<>/?-',
  extendedWord: '`~!@#$%^&*()=+[{]}\\|;:\'",.<>/?',
  bigWord: '`~!@#$%^&*()=+[{]}\\|;:\'",<>/?',
  nonWhitespace: '',
} as const;

export type TextPatternName = keyof typeof textPatterns;
