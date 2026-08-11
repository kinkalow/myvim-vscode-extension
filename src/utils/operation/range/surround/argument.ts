import * as vscode from 'vscode';
import { getLineInfo } from '@utils/editor/line';
import {
  TextObjectPrefix,
  ArgumentSurroundRange,
  ArgumentSurroundCharInfo as CharInfo,
  ArgumentSurroundInfo as ArgInfo,
} from './type';
import { findNearestOpenSymbol, findMatchingCloseSymbol } from './search/argument';
import { findQuoteRangeAt, getQuoteRanges } from '@utils/text/quote';
import { getActiveEditor } from '@utils/editor/editor';
import { getTextInRange } from '@utils/editor/document';
import { DEFAULT_MAX_SEARCH_LINES } from './constants';

// 設定
const ARGUMENT_PAIRS: { open: string; close: string; separator: string }[] = [
  { open: '(', close: ')', separator: ',' },
  { open: '{', close: '}', separator: ',' },
  { open: '[', close: ']', separator: ',' },
  { open: '<', close: '>', separator: ',' },
  { open: '{', close: '}', separator: ';' },
];

// -------------------------------------
// 複数行対応
// -------------------------------------

// ネスト判定対象の括弧ペア
const BRACKET_PAIRS: Record<string, string> = {
  '(': ')',
  '{': '}',
  '[': ']',
  '<': '>',
};
const OPEN_CHARS = new Set(Object.keys(BRACKET_PAIRS));
const CLOSE_TO_OPEN: Record<string, string> = Object.fromEntries(Object.entries(BRACKET_PAIRS).map(([o, c]) => [c, o]));

/**
 * open〜close内の全Argumentsを返す
 * 例: (a , b , c)
 *      ***----** outer
 *      *   *   * inner
 *      ********* chars
 * @params open: 開始文字
 * @params close: 終了文字
 * @params separator: セパレータ
 * @params maxSearchLines: 最大検索行数
 * @params startNestLevel: カーソル位置のネストレベル。一番外側が0でネストがあるごとに1加算
 * @params additionalNestPairs: open-close以外の追加のネスト判定ペア。例: { open: ['(', '[', '{', '<'], close: [')', ']', '}', '>'] }
 * @returns
 *   - args: 各Argumentの情報を格納した配列
 *   - chars: 全Argumentの各文字を格納した配列（囲み記号は除く）
 */
export function getAllArgs(
  open: string,
  close: string,
  separator: string,
  {
    maxSearchLines = DEFAULT_MAX_SEARCH_LINES,
    startNestLevel = 0,
    additionalNestPairs = { open: [], close: [] },
  }: {
    maxSearchLines?: number;
    startNestLevel?: number;
    additionalNestPairs?: { open: string[]; close: string[] };
  } = {},
): { args: ArgInfo[]; chars: CharInfo[] } | null {
  const lineInfo = getLineInfo();
  const editor = lineInfo.editor;
  const cursorLine = lineInfo.line;
  const cursorCol = lineInfo.col;
  const startSearchLine = Math.max(0, cursorLine - maxSearchLines);
  const endSearchLine = Math.min(editor.document.lineCount - 1, cursorLine + maxSearchLines);

  // ネストを判定するopenとcloseのペアを作成
  const allNestPairs: Map<string, string> = new Map([
    [open, close],
    ...additionalNestPairs.open.map((open, i): [string, string] => {
      return [open, additionalNestPairs.close[i]];
    }),
  ]);
  const closeToOpen: Map<string, string> = new Map([...allNestPairs.entries()].map(([o, c]) => [c, o]));

  // -----------------------------------------------------------------------
  // カーソルより左上方向にopenを探す
  // -----------------------------------------------------------------------
  let openLine = -1;
  let openCol = -1;

  let depth = startNestLevel;
  outer: for (let line = cursorLine; line >= startSearchLine; line--) {
    const lineText = editor.document.lineAt(line).text;
    const quoteRanges = getQuoteRanges(lineText);
    const searchTo = line === cursorLine ? cursorCol : lineText.length - 1;
    for (let col = searchTo; col >= 0; col--) {
      const qr = findQuoteRangeAt(quoteRanges, col);
      if (qr) {
        col = qr.start;
        continue;
      }
      const ch = lineText[col];
      if (ch === close) {
        depth++;
      } else if (ch === open) {
        if (depth === 0) {
          openLine = line;
          openCol = col;
          break outer;
        }
        depth--;
      }
    }
  }
  if (openLine === -1) return null;

  // -----------------------------------------------------------------------
  // openより下方向にcloseを探す
  // -----------------------------------------------------------------------
  let closeLine = -1;
  let closeCol = -1;
  let openDepth = 1;
  outer: for (let line = openLine; line <= endSearchLine; line++) {
    const lineText = editor.document.lineAt(line).text;
    const quoteRanges = getQuoteRanges(lineText);
    const searchFrom = line === openLine ? openCol + 1 : 0;
    for (let col = searchFrom; col < lineText.length; col++) {
      const qr = findQuoteRangeAt(quoteRanges, col);
      if (qr) {
        col = qr.end;
        continue;
      }
      const ch = lineText[col];
      if (ch === open) {
        openDepth++;
      } else if (ch === close) {
        openDepth--;
        if (openDepth === 0) {
          closeLine = line;
          closeCol = col;
          break outer;
        }
      }
    }
  }
  if (closeLine === -1) return null;

  // -----------------------------------------------------------------------
  // open〜closeの間の全テキストを配列に結合
  // -----------------------------------------------------------------------
  const chars: CharInfo[] = [];

  // ネスト深さを0で設定
  const nestDepth: Map<string, number> = new Map([...allNestPairs.keys()].map((o) => [o, 0]));

  // 現在のネストレベルを計算する関数
  const getCurrentNestLevel = (): number => {
    let total = 0;
    for (const depth of nestDepth.values()) total += depth;
    return total;
  };

  for (let line = openLine; line <= closeLine; line++) {
    const lineText = editor.document.lineAt(line).text;
    const quoteRanges = getQuoteRanges(lineText);
    const startCol = line === openLine ? openCol + 1 : 0;
    const endCol = line === closeLine ? closeCol : lineText.length;
    for (let col = startCol; col < endCol; col++) {
      const qr = findQuoteRangeAt(quoteRanges, col);
      if (qr) {
        const rangeEnd = Math.min(qr.end, endCol - 1);
        for (let c = col; c <= rangeEnd; c++) {
          chars.push({ char: lineText[c], line, col: c, nestLevel: getCurrentNestLevel(), isQuoted:true });
        }
        col = rangeEnd;
        continue;
      }
      const ch = lineText[col];
      // chがオープンのネスト対象ならそのchのdepthを増やして、charsに追加
      if (allNestPairs.has(ch)) {
        nestDepth.set(ch, (nestDepth.get(ch) ?? 0) + 1);
        chars.push({ char: ch, line, col, nestLevel: getCurrentNestLevel(), isQuoted:false });
        continue;
      }
      // chがクローズのネスト対象なら追加してから、depthを減らす
      if (closeToOpen.has(ch)) {
        const openCh = closeToOpen.get(ch)!;
        const currentDepth = nestDepth.get(openCh) ?? 0;
        chars.push({ char: ch, line, col, nestLevel: getCurrentNestLevel(), isQuoted: false });
        if (currentDepth > 0) nestDepth.set(openCh, currentDepth - 1);
        continue;
      }
      // 通常文字
      chars.push({ char: ch, line, col, nestLevel: getCurrentNestLevel(), isQuoted:false });
    }
  }

  // -----------------------------------------------------------------------
  // ネスト判定しながらseparatorを探す
  // chars[i].nestLevel === 0 のseparatorのみ対象
  // -----------------------------------------------------------------------
  const args: ArgInfo[] = [];
  const pushArg = (startIdx: number, endIdx: number, hasSeparator: boolean) => {
    const outerStart = chars[startIdx];
    const outerEnd = chars[endIdx];
    let innerStartIdx = startIdx;
    let innerEndIdx = hasSeparator ? endIdx - 1 : endIdx;
    while (innerStartIdx <= innerEndIdx && chars[innerStartIdx]?.char.trim() === '') {
      innerStartIdx++;
    }
    while (innerEndIdx >= innerStartIdx && chars[innerEndIdx]?.char.trim() === '') {
      innerEndIdx--;
    }
    if (!chars[innerStartIdx] || !chars[innerEndIdx]) return;
    args.push({
      outerStart,
      outerEnd,
      innerStart: chars[innerStartIdx],
      innerEnd: chars[innerEndIdx],
      text: chars
        .slice(innerStartIdx, innerEndIdx + 1)
        .map((c) => c.char)
        .join(''),
      hasSeparator,
    });
  };

  let segStart = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i].char;
    if (ch === separator && chars[i].nestLevel === 0  && !chars[i].isQuoted) {
      pushArg(segStart, i, true);
      segStart = i + 1;
    }
  }
  if (segStart <= chars.length - 1) {
    pushArg(segStart, chars.length - 1, false);
  }

  return { args, chars };
}

/**
 * 複数行のテキストをopen/close/separatorで分割して引数範囲を返す
 * @param open Argument判定の開始文字
 * @param close Argument判定の終了文字
 * @param separator Argument判定の区切り文字
 * @param textObjectPrefix 'i' = スペース・separator除いた内側, 'a' = スペース・separator含む外側
 * @param maxSearchLines 最大検索行数（デフォルト10）
 * @returns { startLine, startCol, endLine, endCol, mode, text, index } | null
 *   - startLine  Argumentの開始行
 *   - startCol   Argumentの開始列
 *   - endLine    Argumentの終了行
 *   - endCol     Argumentの終了列
 *   - mode       char | line | block
 *   - text       Argumentのテキスト
 *   - index      何番目の引数か
 */
export function getSurroundByArgument(
  open: string,
  close: string,
  separator: string,
  textObjectPrefix: TextObjectPrefix,
  { maxSearchLines = DEFAULT_MAX_SEARCH_LINES }: { maxSearchLines?: number } = {},
): ArgumentSurroundRange | null {
  const bracketPairs = { open: Object.keys(BRACKET_PAIRS), close: Object.values(BRACKET_PAIRS) };
  const result = getAllArgs(open, close, separator, { maxSearchLines, additionalNestPairs: bracketPairs });
  if (result === null) return null;
  const { args, chars } = result;

  const lineInfo = getLineInfo();
  const cursorLine = lineInfo.line;
  const cursorCol = lineInfo.col;

  // カーソルがどの引数の範囲内にあるか特定
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // rawStart以降 かつ rawEnd以前にカーソルがあるか
    const isAfterRawStart =
      cursorLine > arg.outerStart.line || (cursorLine === arg.outerStart.line && cursorCol >= arg.outerStart.col);
    const isBeforeRawEnd = cursorLine < arg.outerEnd.line || (cursorLine === arg.outerEnd.line && cursorCol <= arg.outerEnd.col);

    if (isAfterRawStart && isBeforeRawEnd) {
      if (textObjectPrefix === 'i') {
        // カーソルがスペース部分にいてもinnerStartからinnerEndを返す
        return {
          startLine: arg.innerStart.line,
          startCol: arg.innerStart.col,
          endLine: arg.innerEnd.line,
          endCol: arg.innerEnd.col,
          mode: 'char',
          text: arg.text,
          index: i,
        };
      } else {
        let startIdx = chars.indexOf(arg.outerStart);
        let endIdx = chars.indexOf(arg.outerEnd);

        // 複数の引数がある場合のみ、コンマやスペースの巻き込み調整を行う
        if (args.length > 1) {
          if (i === 0) {
            // 先頭の引数の場合：separatorの後に続く連続するスペースを範囲に含める
            while (endIdx + 1 < chars.length && chars[endIdx + 1].char.trim() === '') {
              endIdx++;
            }
          } else if (i === args.length - 1) {
            // 末尾の引数の場合：前の引数のテキストが終わった直後からを範囲にする
            const prevArg = args[i - 1];
            startIdx = chars.indexOf(prevArg.innerEnd) + 1;
          }
        }

        const finalStart = chars[startIdx];
        const finalEnd = chars[endIdx];

        return {
          startLine: finalStart.line,
          startCol: finalStart.col,
          endLine: finalEnd.line,
          endCol: finalEnd.col,
          mode: 'char',
          text: chars
            .slice(startIdx, endIdx + 1)
            .map((c) => c.char)
            .join(''),
          index: i,
        };
      }
    }
  }
  return null;
}

/**
 * カーソル位置から近くの開き囲みを基準として、Argumentの囲み記号と区切り記号のペアを返す
 * ただし、ファイルタイプに依存して優先する区切り文字を変える
 * @returns [開き記号、閉じ記号、区切り文字][] | null
 */
export function getArgumentPairs(maxSearchLines: number = DEFAULT_MAX_SEARCH_LINES): [string, string, string][] | null {
  let pairs: [string, string, string][] = [];

  const openSymbol = findNearestOpenSymbol(maxSearchLines);
  if (openSymbol === null) return null;
  const closeSymbol = findMatchingCloseSymbol(openSymbol);
  if (closeSymbol === null) return null;

  // ファイルタイプによる場合分け
  const editor = getActiveEditor();
  if (editor.document.languageId === 'typescript' && openSymbol.char === '{') {
    const text = getTextInRange({
      startLine: openSymbol.line,
      startCol: openSymbol.col,
      endLine: closeSymbol.line,
      endCol: closeSymbol.col,
    });
    const separator = text.includes(';') ? ';' : ',';
    if (separator === ';') pairs.push([openSymbol.char, closeSymbol.char, separator]);
  }

  pairs.push([openSymbol.char, closeSymbol.char, ',']);
  return pairs;
}

/**
 * カーソル位置のArgument範囲を複数行対応で返す
 * @param textObjectPrefix 'i' = スペース・separator除いた内側, 'a' = スペース・separator含む外側
 * @param maxSearchLines 最大検索行数（デフォルト10）
 * @returns { startLine, startCol, endLine, endCol, mode, text, index } | null
 *   - startLine  Argumentの開始行
 *   - startCol   Argumentの開始col
 *   - endLine    Argumentの終了行
 *   - endCol     Argumentの終了col
 *   - mode       char | line | block
 *   - text       Argumentのテキスト
 *   - index      何番目の引数か（0始まり）
 */
export function getSurroundByArguments(
  textObjectPrefix: TextObjectPrefix,
  { maxSearchLines = DEFAULT_MAX_SEARCH_LINES }: { maxSearchLines?: number } = {},
): ArgumentSurroundRange | null {
  const pairs = getArgumentPairs(maxSearchLines);
  if (pairs === null) return null;
  let result = null;
  for (const [open, close, separator] of pairs) {
    result = getSurroundByArgument(open, close, separator, textObjectPrefix, { maxSearchLines });
    if (result !== null) break;
  }
  return result;
}

// /**
//  * カーソル位置のArgument範囲を複数行対応で返す
//  * @param textObjectPrefix 'i' = スペース・separator除いた内側, 'a' = スペース・separator含む外側
//  * @param maxSearchLines 最大検索行数（デフォルト10）
//  * @returns
//  *   - startLine  Argumentの開始行
//  *   - startCol   Argumentの開始col
//  *   - endLine    Argumentの終了行
//  *   - endCol     Argumentの終了col
//  *   - text       Argumentのテキスト
//  *   - index      何番目の引数か（0始まり）
//  */
// export function getSurroundByArguments(
//   textObjectPrefix: TextObjectPrefix,
//   maxSearchLines: number = DEFAULT_MAX_SEARCH_LINES,
// ): ArgumentSurroundRange | null {
//   for (const pair of ARGUMENT_PAIRS) {
//     const result = getSurroundByArgument(pair.open, pair.close, pair.separator, textObjectPrefix, maxSearchLines);
//     if (result !== null) return result;
//   }
//   return null;
// }

// -------------------------------------
// カレント行のみ
// -------------------------------------

/**
 * カーソル位置を起点として指定したopen/close/separatorのペアで囲む範囲を返す
 * @param open Argument判定の開始文字
 * @param close Argument判定の終了文字
 * @param separator Argument判定の区切り文字
 * @param textObjectPrefix 'i' = スペース・separator除いた内側, 'a' = スペース・separator含む外側
 * @returns { startLine, startCol, endLine, endCol, mode, text, index } | null
 *   - startLine  Argumentの開始行
 *   - startCol   Argumentの開始列
 *   - endLine    Argumentの終了行
 *   - endCol     Argumentの終了列
 *   - mode       char | line | block
 *   - text       Argumentのテキスト
 *   - index      何番目の引数か
 */
export function getLineSurroundByArgument(
  open: string,
  close: string,
  separator: string,
  textObjectPrefix: TextObjectPrefix,
): ArgumentSurroundRange | null {
  const lineInfo = getLineInfo();
  const text = lineInfo.text;
  const line = lineInfo.line;
  const cursorCol = lineInfo.col;

  // カーソルより左側でopenを探す
  let openCol = -1;
  for (let i = cursorCol; i >= 0; i--) {
    if (text[i] === open) {
      openCol = i;
      break;
    }
  }
  if (openCol === -1) return null;

  // openより右側でcloseを探す
  let closeCol = -1;
  for (let i = openCol + 1; i < text.length; i++) {
    if (text[i] === close) {
      closeCol = i;
      break;
    }
  }
  if (closeCol === -1) return null;

  // カーソルがopen〜closeの範囲内にあるか
  if (cursorCol <= openCol || cursorCol >= closeCol) return null;

  // open〜closeの間をseparatorで分割して各引数の範囲を収集
  const args: {
    rawLeftCol: number; // separator・スペースを含む生の開始col
    rawRightCol: number; // separator・スペースを含む生の終了col
    innerLeftCol: number; // スペース・separator除いた開始col
    innerRightCol: number; // スペース・separator除いた終了col
    text: string;
  }[] = [];

  let argStart = openCol + 1;
  const inner = text.substring(openCol + 1, closeCol);

  for (let i = 0; i <= inner.length; i++) {
    const col = openCol + 1 + i;
    if (i === inner.length || text[col] === separator) {
      const rawLeftCol = argStart;
      const rawRightCol = i === inner.length ? col - 1 : col; // separatorを含む。closeは含まない

      const argText = text.substring(rawLeftCol, col);
      const trimmedLeft = argText.search(/\S/);
      const trimmedRightLen = argText.trimEnd().length;

      const innerLeftCol = trimmedLeft === -1 ? rawLeftCol : rawLeftCol + trimmedLeft;
      const innerRightCol = rawLeftCol + trimmedRightLen - 1;

      args.push({
        rawLeftCol,
        rawRightCol,
        innerLeftCol,
        innerRightCol,
        text: argText.trim(),
      });

      argStart = col + 1; // separator の次から
    }
  }

  // カーソルがどの引数の範囲内にあるか特定
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (cursorCol >= arg.rawLeftCol && cursorCol <= arg.rawRightCol) {
      if (textObjectPrefix === 'i') {
        // スペースとseparatorを除いた内側
        return {
          startLine: line,
          startCol: arg.innerLeftCol,
          endLine: line,
          endCol: arg.innerRightCol,
          mode: 'char',
          text: arg.text,
          index: i,
        };
      } else {
        // スペースとseparatorを含む外側。open/closeは含まない
        return {
          startLine: line,
          startCol: arg.rawLeftCol,
          endLine: line,
          endCol: arg.rawRightCol,
          mode: 'char',
          text: text.substring(arg.rawLeftCol, arg.rawRightCol + 1),
          index: i,
        };
      }
    }
  }

  return null;
}

/**
 * カーソル位置のArgument範囲を返す
 * @param textObjectPrefix 'i'または'a'
 * @returns { startLine, startCol, endLine, endCol, mode, text, index } | null
 *   - startLine  Argumentの開始行
 *   - startCol   Argumentの開始列
 *   - endLine    Argumentの終了行
 *   - endCol     Argumentの終了列
 *   - mode       char | line | block
 *   - text       Argumentのテキスト
 *   - index      何番目の引数か
 */
export function getLineSurroundByArguments(textObjectPrefix: TextObjectPrefix): ArgumentSurroundRange | null {
  for (const pair of ARGUMENT_PAIRS) {
    const result = getLineSurroundByArgument(pair.open, pair.close, pair.separator, textObjectPrefix);
    if (result !== null) return result;
  }

  return null;
}
