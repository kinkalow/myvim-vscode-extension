export interface OperationRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  mode: 'char' | 'line' | 'block';
}

// prettier-ignore
export const textObjects = [
  'a',
  'ia', 'iA', 'ic', 'if', 'im', 'iM', 'in', 'iN', 'it', 'i2', 'i"', "i6", "i'", 'i(', 'i@', 'i`', 'i[', 'i{', 'i,', 'i<',
  'oa', 'oA', 'oc', 'of', 'om', 'oM', 'on', 'oN', 'ot', 'o2', 'o"', "o6", "o'", 'o(', 'o@', 'o`', 'o[', 'o{', 'o,', 'o<',
  'ie', 'iI', 'il', 'ip', 'ir', 'iW', 'iw',
  'm', 'M', 'n', 'N',
  'y', 'Y',
  '0', '$', '^',
  ' ', ',',
  'A', 'gg', 'G', 'h', 'j', 'k', 'l',
  'b', 'B', 'w', 'W',
] as const;
export type TextObject = (typeof textObjects)[number];

export const modes = ['i', 'n', 'v'] as const;
export type Mode = (typeof modes)[number];

export const operators = ['c', 'd', 'p', 'y', '_'] as const;
export type Operator = (typeof operators)[number];
