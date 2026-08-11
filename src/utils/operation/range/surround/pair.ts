import { TextObjectPrefix } from './type';
import { getLineInfo } from '@utils/editor/line';
import { OperationRange } from '@utils/operation/operationType';
import { DEFAULT_MAX_SEARCH_LINES, DEFAULT_SURROUND_PAIRS } from './constants';
import { findQuoteRangeAt, getQuoteRanges, isExtendedQuotesEnd } from '@utils/text/quote';

/**
 * 複数行対応で囲みペアの範囲を返す
 * カーソルから左上方向にN番目の開き記号を探し、対応する閉じ記号を右下方向に探す
 * @param startChar 開き記号
 * @param endChar 閉じ記号
 * @param textObjectPrefix 'i' = 囲みを含まない内側, 'a' = 囲みを含む外側
 * @param nth 何番目に近い囲みか
 * @param maxSearchLines 最大検索行数
 * @param isInsertMode インサートモードかどうか
 * @param ignoreFirstQuote カーソル位置から左方向に探索するとき最初に見つかったquotesは無視する
 * @param ignoreQuotedRanges Quotesで囲まれた範囲は無視するかどうか
 * @returns { startLine, startCol, endLine, endCol, mode } | null
 */
export function getSurroundByPairs(
  textObjectPrefix: TextObjectPrefix,
  {
    pairs = DEFAULT_SURROUND_PAIRS,
    nth = 1,
    maxSearchLines = DEFAULT_MAX_SEARCH_LINES,
    isInsertMode = false,
    ignoreFirstQuote = false,
    ignoreQuotedRanges = true,
  }: {
    pairs?: { [key: string]: string };
    nth?: number;
    maxSearchLines?: number;
    isInsertMode?: boolean;
    ignoreFirstQuote?: boolean;
    ignoreQuotedRanges?: boolean;
  } = {},
): OperationRange | null {
  const lineInfo = getLineInfo();
  const editor = lineInfo.editor;
  const cursorLine = lineInfo.line;
  const cursorCol = isInsertMode ? Math.max(0, lineInfo.col - 1) : lineInfo.col;

  const openSymbols = Object.keys(pairs);
  const startSearchLine = Math.max(0, cursorLine - maxSearchLines);
  const endSearchLine = Math.min(editor.document.lineCount - 1, cursorLine + maxSearchLines);

  const bracketOpens = ['(', '[', '{', '<'];
  const useQuoteCriteria = Object.keys(pairs).every((pair) => bracketOpens.includes(pair));
  const quotes = ['"', "'"];

  // カーソルから左上方向にnth番目の開き記号を探す
  // 途中で見つけた開き記号の位置と種類をすべて記録
  let foundCount = 0;
  let openLine = -1;
  let openCol = -1;
  let openChar = '';

  // スキップした開き記号の情報（位置と文字）を記録
  const skippedOpenPositions: { line: number; col: number }[] = [];

  outer: for (let line = cursorLine; line >= startSearchLine; line--) {
    const lineText = editor.document.lineAt(line).text;
    const quoteRanges = ignoreQuotedRanges
      ? useQuoteCriteria
        ? getQuoteRanges(lineText)
        : getQuoteRanges(lineText, { inside: true })
      : [];
    const searchTo = line === cursorLine ? cursorCol : lineText.length - 1;
    for (let col = searchTo; col >= 0; col--) {
      const qr = findQuoteRangeAt(quoteRanges, col);
      if (qr) {
        col = qr.start;
        continue;
      }
      if (openSymbols.includes(lineText[col])) {
        if (ignoreFirstQuote && quotes.includes(lineText[col])) {
          ignoreFirstQuote = false;
          continue;
        }
        foundCount++;
        if (foundCount < nth) {
          if (!isExtendedQuotesEnd(lineText, col)) {
            skippedOpenPositions.push({ line, col });
          }
        }
        if (foundCount === nth) {
          openLine = line;
          openCol = col;
          openChar = lineText[col];
          break outer;
        }
      }
    }
  }
  if (openLine === -1) return null;

  const closeChar = pairs[openChar];
  const isSameChar = openChar === closeChar;
  const nestableSymbols = ['{', '[', '(', '<'];
  const isNestable = nestableSymbols.includes(openChar);

  let closeLine = -1;
  let closeCol = -1;
  let closeCount = 0;

  outer: for (let line = openLine; line <= endSearchLine; line++) {
    const lineText = editor.document.lineAt(line).text;
    const quoteRanges = ignoreQuotedRanges
      ? useQuoteCriteria
        ? getQuoteRanges(lineText)
        : getQuoteRanges(lineText, { inside: true })
      : [];
    const searchFrom = line === openLine ? openCol + 1 : 0;
    for (let col = searchFrom; col < lineText.length; col++) {
      const qr = findQuoteRangeAt(quoteRanges, col);
      if (qr) {
        col = qr.end;
        continue;
      }

      const char = lineText[col];

      // ネスト考慮: 探索中の開き記号と同じ文字が見つかったらcloseCountを-1
      if (isNestable && char === openChar) {
        closeCount--;
        continue;
      }

      if (char === closeChar) {
        if (isSameChar) {
          const isSkipped = skippedOpenPositions.some((pos) => pos.line === line && pos.col === col);
          if (isSkipped) {
            closeCount--;
            continue;
          } else {
            closeCount++;
          }
        } else {
          closeCount++;
        }
        if (closeCount === 1) {
          closeLine = line;
          closeCol = col;
          break outer;
        }
      }
    }
  }
  if (closeLine === -1) return null;

  if (openLine === closeLine && openCol === closeCol) return null;

  if (textObjectPrefix === 'a') {
    return { startLine: openLine, startCol: openCol, endLine: closeLine, endCol: closeCol, mode: 'char' };
  }

  // -----------------------------------------------------------
  // 囲みの内側のスペースを削除する
  // -----------------------------------------------------------

  // // textObjectPrefix === 'i': 囲みを含まない内側 + 空白をスキップ
  // // 開始記号の次の文字から空白をスキップして内側の開始位置を特定
  // let innerStartLine = -1;
  // let innerStartCol = -1;
  // outer: for (let line = openLine; line <= closeLine; line++) {
  //   const lineText = editor.document.lineAt(line).text;
  //   const searchFrom = line === openLine ? openCol + 1 : 0;
  //   const searchTo = line === closeLine ? closeCol : lineText.length;
  //   for (let col = searchFrom; col < searchTo; col++) {
  //     if (lineText[col].trim() !== '') {
  //       innerStartLine = line;
  //       innerStartCol = col;
  //       break outer;
  //     }
  //   }
  // }

  // // 閉じ記号の前の文字から空白をスキップして内側の終了位置を特定
  // let innerEndLine = -1;
  // let innerEndCol = -1;
  // outer: for (let line = closeLine; line >= openLine; line--) {
  //   const lineText = editor.document.lineAt(line).text;
  //   const searchFrom = line === closeLine ? closeCol - 1 : lineText.length - 1;
  //   const searchTo = line === openLine ? openCol : -1;
  //   for (let col = searchFrom; col > searchTo; col--) {
  //     if (lineText[col].trim() !== '') {
  //       innerEndLine = line;
  //       innerEndCol = col;
  //       break outer;
  //     }
  //   }
  // }

  // -----------------------------------------------------------
  // 囲みの内側のスペースを削除しない
  // -----------------------------------------------------------

  let innerStartLine = -1;
  let innerStartCol = -1;
  for (let line = openLine; line <= closeLine; line++) {
    const lineText = editor.document.lineAt(line).text;
    const col = line === openLine ? openCol + 1 : 0;
    if (col < lineText.length) {
      innerStartLine = line;
      innerStartCol = col;
      break;
    }
  }

  let innerEndLine = -1;
  let innerEndCol = -1;
  for (let line = closeLine; line >= openLine; line--) {
    const lineText = editor.document.lineAt(line).text;
    const col = line === closeLine ? closeCol - 1 : lineText.length - 1;
    if (col >= 0) {
      innerEndLine = line;
      innerEndCol = col;
      break;
    }
  }

  // -----------------------------------------------------------

  if (innerStartLine === -1 || innerEndLine === -1) return null;
  if (innerStartLine > innerEndLine) return null;
  if (innerStartLine === innerEndLine && innerStartCol > innerEndCol) return null;

  return {
    startLine: innerStartLine,
    startCol: innerStartCol,
    endLine: innerEndLine,
    endCol: innerEndCol,
    mode: 'char',
  };
}

/**
 * 1つの囲みペアを指定して複数行対応の囲み範囲を返す
 * @param startChar 開き記号
 * @param endChar 閉じ記号
 * @param textObjectPrefix 'i' = 囲みを含まない内側, 'a' = 囲みを含む外側
 * @param nth 何番目に近い囲みか
 * @param maxSearchLines 最大検索行数
 * @param isInsertMode インサートモードかどうか
 * @param ignoreFirstQuote カーソル位置から左方向に探索するとき最初に見つかったquotesは無視する
 * @param ignoreQuotedRanges Quotesで囲まれた範囲は無視するかどうか
 * @returns { startLine, startCol, endLine, endCol, mode } | null
 */
export function getSurroundByPair(
  startChar: string,
  endChar: string,
  textObjectPrefix: TextObjectPrefix,
  {
    nth = 1,
    maxSearchLines = DEFAULT_MAX_SEARCH_LINES,
    isInsertMode = false,
    ignoreFirstQuote = false,
    ignoreQuotedRanges = true,
  }: {
    nth?: number;
    maxSearchLines?: number;
    isInsertMode?: boolean;
    ignoreFirstQuote?: boolean;
    ignoreQuotedRanges?: boolean;
  } = {},
): OperationRange | null {
  return getSurroundByPairs(textObjectPrefix, {
    pairs: { [startChar]: endChar },
    nth,
    maxSearchLines,
    isInsertMode,
    ignoreFirstQuote,
    ignoreQuotedRanges,
  });
}

// ------------------------------------------------------------------
// カレント行のみ対応
// ------------------------------------------------------------------

/**
 * 現在行のカーソル位置を起点として最も近い囲みの範囲を返す
 * 囲みの開始文字と終端文字を pairs で指定する。複数指定可能
 * @params pairs 囲みの定義。例: pairs = { '(': ')', '[': ']', '"': '"', ... }
 * @params textObjectPrefix 'i'または'a'
 * @returns 見つかった場合は囲みの範囲、見つからない場合は null
 *   - leftCol 開始のcol
 *   - rightCol 終端のcol
 *   - leftChar 開始文字
 *   - rightChar 終端文字
 */
export function getNearestSurroundByPairs(
  pairs: { [key: string]: string },
  textObjectPrefix: TextObjectPrefix,
): OperationRange | null {
  const lineInfo = getLineInfo();
  const lineText = lineInfo.text;
  const lineNum = lineInfo.line;
  const cursorCol = lineInfo.col;
  const before = lineText.substring(0, cursorCol + 1);
  const after = lineText.substring(cursorCol);
  const openSymbols = Object.keys(pairs);

  // カーソル位置を含む左側で一番近い開き記号を検索
  let leftCol = -1;
  let leftChar = '';
  for (let i = before.length - 1; i >= 0; i--) {
    if (openSymbols.includes(before[i])) {
      leftCol = i;
      leftChar = before[i];
      break;
    }
  }
  if (leftCol === -1) return null;

  // カーソルより右側で一番近い閉じ記号を検索
  let rightChar = pairs[leftChar];
  let addjust = leftChar === rightChar ? 1 : 0;
  let foundCloseIndex = -1;
  for (let i = 0 + addjust; i < after.length; i++) {
    if (after[i] === rightChar) {
      foundCloseIndex = i;
      break;
    }
  }
  if (foundCloseIndex === -1) return null;

  let rightCol = cursorCol + foundCloseIndex;

  if (leftCol === rightCol) return null;

  if (textObjectPrefix === 'a')
    return { startLine: lineNum, startCol: leftCol, endLine: lineNum, endCol: rightCol, mode: 'char' };
  leftCol += 1;
  rightCol -= 1;
  if (leftCol > rightCol) return null;
  leftChar = lineText[leftCol];
  rightChar = lineText[rightCol];
  return { startLine: lineNum, startCol: leftCol, endLine: lineNum, endCol: rightCol, mode: 'char' };
}

/**
 * 現在行のカーソル位置を起点として最も近い囲みの範囲を返す
 * 囲みの開始文字と終端文字を leftChar と rightChar で指定する
 * @params pairs 囲みの定義。例: pairs = { '(': ')', '[': ']', '"': '"', ... }
 * @param leftChar 開始文字
 * @param rightChar 終端文字
 * @params textObjectPrefix 'i'または'a'
 * @returns 見つかった場合は囲みの範囲、見つからない場合は null
 *   - leftCol 開始文字のcol
 *   - rightCol 終端文字のcol
 */
export function getNearestSurroundRangeByPair(
  leftChar: string,
  rightChar: string,
  textObjectPrefix: TextObjectPrefix,
): OperationRange | null {
  return getNearestSurroundByPairs({ [leftChar]: rightChar }, textObjectPrefix);
}
