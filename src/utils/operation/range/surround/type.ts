import { OperationRange } from '@utils/operation/operationType';

export interface ArgumentSurroundRange extends OperationRange {
  text: string; // 検索結果のArgumentの文字列
  index: number; // 何番目のArgumentか
}

export type ArgumentSurroundCharInfo = {
  char: string; // 1文字
  line: number; // 行番号
  col: number; // 列番号
  nestLevel: number; // ネストレベル。一番外側のレベルが0で内側に進むにつれて1加算される
  isQuoted: boolean;
};

export type ArgumentSurroundInfo = {
  outerStart: ArgumentSurroundCharInfo; // Argumentの開始位置と文字情報
  outerEnd: ArgumentSurroundCharInfo; // Argumentの終了位置と文字情報
  innerStart: ArgumentSurroundCharInfo; // Argumentの内側の開始位置と文字情報
  innerEnd: ArgumentSurroundCharInfo; // Argumentの内側の終了位置と文字情報
  text: string; // Argumentの内側のテキスト
  hasSeparator: boolean; // separatorを含むかどうか（最後の引数だけseparatorを含まいのでfalse）
};

//
// カレント行のみ
//

export type EdgeType =
  | 'line'
  | 'trimStart'
  | 'trimEnd'
  | 'trimBoth'
  | 'startToCursor'
  | 'startToLeftOfCursor'
  | 'trimStartToCursor'
  | 'trimStartToLeftOfCursor'
  | 'cursorToTrimEnd'
  | 'cursorToEnd';

export const validEdgeType = [
  'line',
  'trimStart',
  'trimEnd',
  'trimBoth',
  'startToCursor',
  'startToLeftOfCursor',
  'trimStartToCursor',
  'trimStartToLeftOfCursor',
  'cursorToTrimEnd',
  'cursorToEnd',
];

export interface LineSurroundRangeCol {
  startCol: number;
  endCol: number;
}

export interface LineSurroundRange extends LineSurroundRangeCol {
  leftChar: string;
  rightChar: string;
}

export type TextObjectPrefix = 'i' | 'a';
