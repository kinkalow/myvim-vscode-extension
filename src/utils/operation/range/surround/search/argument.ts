import { getLineInfo } from '@utils/editor/line';
import { DEFAULT_MAX_SEARCH_LINES } from '../constants';
import { findQuoteRangeAt, getQuoteRanges } from '@utils/text/quote';

const OPEN_SYMBOLS = ['(', '[', '{', '<'] as const;
const CLOSE_SYMBOLS = [')', ']', '}', '>'] as const;
const PAIRS: { [key: string]: string } = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>',
};
const CLOSE_TO_OPEN: { [key: string]: string } = {
  ')': '(',
  ']': '[',
  '}': '{',
  '>': '<',
};

type OpenSymbol = keyof typeof PAIRS;
type CloseSymbol = (typeof PAIRS)[OpenSymbol];

interface FoundSymbol {
  char: string;
  line: number;
  col: number;
}

export function getCloseSymbol(openSymbol: OpenSymbol): CloseSymbol {
  return PAIRS[openSymbol];
}

/**
 * カーソル位置から左上方向に探索し、ネストを考慮した上で最も近い囲み記号を返す
 * @param maxSearchLines 最大検索行数
 * @returns 見つかった囲み記号の情報、見つからなければ null
 */
export function findNearestOpenSymbol(maxSearchLines: number = DEFAULT_MAX_SEARCH_LINES): FoundSymbol | null {
  const lineInfo = getLineInfo();
  const editor = lineInfo.editor;
  const cursorLine = lineInfo.line;
  const cursorCol = lineInfo.col;
  const startSearchLine = Math.max(0, cursorLine - maxSearchLines);

  // 各囲み記号のネスト深さを管理
  // 閉じ記号が見つかったらカウントを増やし、開き記号が見つかったらカウントを減らす
  // カウントが0になったらその開き記号が対象
  const nestCount: { [key: string]: number } = {
    '(': 0,
    '[': 0,
    '{': 0,
    '<': 0,
  };

  for (let line = cursorLine; line >= startSearchLine; line--) {
    const lineText = editor.document.lineAt(line).text;
    const quoteRanges = getQuoteRanges(lineText);
    const searchTo = line === cursorLine ? cursorCol : lineText.length - 1;
    for (let col = searchTo; col >= 0; col--) {
      const qr = findQuoteRangeAt(quoteRanges, col);
      if (qr) {
        col = qr.start;
        continue;
      }
      const char = lineText[col];
      // 閉じ記号が見つかったらネスト深さを増やす
      if (CLOSE_SYMBOLS.includes(char as any)) {
        const openChar = CLOSE_TO_OPEN[char];
        nestCount[openChar] += 1;
        continue;
      }
      // 開き記号が見つかったら
      if (OPEN_SYMBOLS.includes(char as any)) {
        if (nestCount[char] > 0) {
          nestCount[char] -= 1;
          continue;
        }
        return { char, line, col };
      }
    }
  }

  return null;
}

/**
 * findNearestOpenSymbolで見つかった開き記号に対応する閉じ記号を探す
 * @param openSymbol findNearestOpenSymbolの返り値
 * @param maxSearchLines 最大検索行数
 * @returns 見つかった閉じ記号の情報、見つからなければ null
 */
export function findMatchingCloseSymbol(openSymbol: FoundSymbol, maxSearchLines: number = 10): FoundSymbol | null {
  const lineInfo = getLineInfo();
  const editor = lineInfo.editor;
  const cursorLine = lineInfo.line;

  const closeChar = PAIRS[openSymbol.char];
  const endSearchLine = Math.min(editor.document.lineCount - 1, cursorLine + maxSearchLines);

  let nestCount = 0;
  for (let line = openSymbol.line; line <= endSearchLine; line++) {
    const lineText = editor.document.lineAt(line).text;
    const quoteRanges = getQuoteRanges(lineText);
    const searchFrom = line === openSymbol.line ? openSymbol.col + 1 : 0;
    for (let col = searchFrom; col < lineText.length; col++) {
      const qr = findQuoteRangeAt(quoteRanges, col);
      if (qr) {
        col = qr.end;
        continue;
      }
      const char = lineText[col];
      // 同じ開き記号が見つかったらネスト深さを増やす
      if (char === openSymbol.char) {
        nestCount++;
        continue;
      }
      // 閉じ記号が見つかったら
      if (char === closeChar) {
        if (nestCount > 0) {
          nestCount--;
          continue;
        }
        return { char, line, col };
      }
    }
  }

  return null;
}
