import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';
import { getLineInfo } from '@utils/editor/line';
import { getOnePrintableChar } from '@utils/ui/input';
import { getSurroundRangeByCountPair } from '@utils/text/surround/line';
import { OperationRange } from '@utils/operation/operationType';
import { CURSOR_HIGHLIGHT_STYLE } from '@utils/config/highlight';

//
// 複数行対応
//

interface PosEntry {
  line: number;
  col: number;
  isSynthetic: boolean; // prefixCharsとsuffixCharsの部分をtrueにする
}

/** テキストインデックスからlineとcolの位置を返す */
function resolveIndexToPosition(
  index: number,
  boundaries: {
    prefixStartIndex: number;
    currentLineStartIndex: number;
    suffixStartIndex: number;
    linesBelowStartIndex: number;
  },
  posMap: PosEntry[],
  lineInfo: { line: number; col: number; text: string },
): { line: number; col: number } {
  const { prefixStartIndex, currentLineStartIndex, suffixStartIndex, linesBelowStartIndex } = boundaries;

  // prefixの領域
  if (index >= prefixStartIndex && index < currentLineStartIndex) {
    return { line: lineInfo.line, col: 0 };
  }

  // suffixの領域
  if (index >= suffixStartIndex && index < linesBelowStartIndex) {
    return { line: lineInfo.line, col: Math.max(0, lineInfo.text.length - 1) };
  }

  // それ以外
  const clampedIndex = Math.max(0, Math.min(index, posMap.length - 1));
  const pos = posMap[clampedIndex];
  return { line: pos.line, col: pos.col };
}

/**
 * 数値+文字の入力を返す（例: "2a", "a"）
 */
async function getCountChar(): Promise<string> {
  let buffer = '';
  while (true) {
    const char = await getOnePrintableChar();
    buffer += char === 'enter' ? '\n' : char;
    if (!/^\d$/.test(char)) break;
  }
  return buffer;
}

/**
 * 左右それぞれの countChar を受け取る
 * @param isSamePair trueの場合、囲みの開始文字と終端文字が同じになる
 * @param leftInputChar 左側の囲み文字を指定（例："2{", "$"）
 * @param rightInputChar 右側の囲み文字を指定（例："2}", "$"）
 */
async function getPairChars(
  isSamePair: boolean,
  leftInputChar?: string,
  rightInputChar?: string,
): Promise<{ leftChar: string; rightChar: string }> {
  const leftChar = leftInputChar || (await getCountChar());
  const rightChar = isSamePair ? leftChar : rightInputChar || (await getCountChar());
  return { leftChar, rightChar };
}

/**
 * カーソル位置を起点として左右に進み、同じ文字が両サイドに同じ回数だけ出現した時点で
 * そのペアをまとめて色分けリストに追加する
 * @param text 連結された全文字列
 * @param cursorIdx カーソル位置のインデックス
 * @param posMap 各インデックスに対応する実座標情報
 */
function scanSamePairRangesMultiLine(
  text: string,
  cursorIdx: number,
  posMap: PosEntry[],
): {
  one: vscode.Range[];
  two: vscode.Range[];
  three: vscode.Range[];
  other: vscode.Range[];
} {
  const one: vscode.Range[] = [];
  const two: vscode.Range[] = [];
  const three: vscode.Range[] = [];
  const other: vscode.Range[] = [];

  // 左上方向を探索
  const leftCountMap = new Map<string, number>(); // char, count
  const leftPending = new Map<string, { count: number; index: number }[]>(); // char, {count, index}
  for (let i = cursorIdx; i >= 0; i--) {
    const char = text[i];
    const count = (leftCountMap.get(char) ?? 0) + 1;
    leftCountMap.set(char, count);
    const pos = posMap[i];
    if (pos.isSynthetic) continue;
    if (!leftPending.has(char)) leftPending.set(char, []);
    leftPending.get(char)!.push({ count, index: i });
  }

  // 右下方向を探索
  const indexToCount = new Array(text.length).fill(-1);
  for (let i = cursorIdx + 1; i < text.length; i++) {
    const char = text[i];
    const pos = posMap[i];
    if (pos.isSynthetic) continue;
    const queue = leftPending.get(char);
    if (!queue || queue.length === 0) continue;
    const partner = queue.shift()!;
    indexToCount[i] = partner.count;
    indexToCount[partner.index] = partner.count;
  }

  // 配色構築
  for (let i = 0; i < text.length; i++) {
    const count = indexToCount[i];
    const pos = posMap[i];
    if (pos.isSynthetic) continue;
    const range = new vscode.Range(pos.line, pos.col, pos.line, pos.col + 1);
    if (count === 1) one.push(range);
    else if (count === 2) two.push(range);
    else if (count === 3) three.push(range);
    else other.push(range);
  }

  return { one, two, three, other };
}

/** カーソル位置から左上/右上に進み、各文字に対してカラー色を設定する */
function scanCharRangesMultiLine(
  text: string,
  startIdx: number,
  endIdx: number,
  step: 1 | -1,
  posMap: PosEntry[],
): {
  one: vscode.Range[];
  two: vscode.Range[];
  three: vscode.Range[];
  other: vscode.Range[];
} {
  const countMap = new Map<string, number>();
  const one: vscode.Range[] = [];
  const two: vscode.Range[] = [];
  const three: vscode.Range[] = [];
  const other: vscode.Range[] = [];

  const inBounds = step === 1 ? (i: number) => i < endIdx : (i: number) => i >= endIdx;

  for (let i = startIdx; inBounds(i); i += step) {
    const char = text[i];
    const count = (countMap.get(char) ?? 0) + 1;
    countMap.set(char, count);

    const pos = posMap[i];
    if (pos.isSynthetic) continue;

    const range = new vscode.Range(pos.line, pos.col, pos.line, pos.col + 1);
    if (count === 1) one.push(range);
    else if (count === 2) two.push(range);
    else if (count === 3) three.push(range);
    else other.push(range);
  }

  return { one, two, three, other };
}

/**
 * 行番号の配列から、連続する行をまとめてvscode.Rangeの配列を作る
 * @param lines 対象となる行番号の配列(昇順ソート済み前提)
 * @param excludeLine 除外する行（通常はカーソル行）
 * @param document 各行の文字数を取得するためのTextDocument
 * @returns 連続する行をまとめたRangeの配列
 */
function buildVisibleLineRanges(lines: number[], excludeLine: number, document: vscode.TextDocument): vscode.Range[] {
  const ranges: vscode.Range[] = [];

  let blockStart: number | null = null;
  let blockEnd: number | null = null;

  const flushBlock = () => {
    if (blockStart === null || blockEnd === null) return;
    const endLineLength = document.lineAt(blockEnd).text.length;
    ranges.push(new vscode.Range(blockStart, 0, blockEnd, endLineLength));
    blockStart = null;
    blockEnd = null;
  };

  for (const line of lines) {
    if (line === excludeLine) {
      flushBlock();
      continue;
    }
    if (blockStart === null) {
      blockStart = line;
      blockEnd = line;
    } else if (line === blockEnd! + 1) {
      blockEnd = line;
    } else {
      flushBlock();
      blockStart = line;
      blockEnd = line;
    }
  }
  flushBlock(); // 最後のブロック

  return ranges;
}

/** 画面に見える領域のテキスト情報（行、列、合成か）を返す
 * prefix、カーソル、suffix、カレント行の次の行におけるそれぞれの開始位置も返す
 */
function buildVisibleBuffer(
  editor: vscode.TextEditor,
  lineInfo: { line: number; col: number; text: string },
  prefixChars: string,
  suffixChars: string,
) {
  const document = editor.document;
  const visibleLines = getVisibleLineNumbers(editor);

  let text = '';
  const posMap: PosEntry[] = [];

  // カレント行より前の情報
  for (const line of visibleLines) {
    if (line >= lineInfo.line) break;
    const lt = document.lineAt(line).text;
    for (let col = 0; col < lt.length; col++) {
      text += lt[col];
      posMap.push({ line, col, isSynthetic: false });
    }
  }

  const prefixStartIndex = text.length; // prefixの開始位置
  // カレント行のプレフィックス
  for (const ch of prefixChars) {
    text += ch;
    posMap.push({ line: -1, col: -1, isSynthetic: true });
  }

  const currentLineStartIndex = text.length;
  const cursorIndex = currentLineStartIndex + lineInfo.col; // カーソル位置
  // カレント行
  for (let col = 0; col < lineInfo.text.length; col++) {
    text += lineInfo.text[col];
    posMap.push({ line: lineInfo.line, col, isSynthetic: false });
  }

  const suffixStartIndex = text.length; // suffixの開始位置
  // カレント行のサフィックス
  for (const ch of suffixChars) {
    text += ch;
    posMap.push({ line: -1, col: -1, isSynthetic: true });
  }

  const linesBelowStartIndex = text.length; // カレント行の次の行の開始位置
  // カレント行より後の情報
  for (const line of visibleLines) {
    if (line <= lineInfo.line) continue;
    const lt = document.lineAt(line).text;
    for (let col = 0; col < lt.length; col++) {
      text += lt[col];
      posMap.push({ line, col, isSynthetic: false });
    }
  }

  return { text, posMap, cursorIndex, prefixStartIndex, currentLineStartIndex, suffixStartIndex, linesBelowStartIndex };
}

/** 画面に見えている行番号を返す（折りたたみで隠れた行は含まない） */
function getVisibleLineNumbers(editor: vscode.TextEditor): number[] {
  const lineCount = editor.document.lineCount;
  const lineSet = new Set<number>();
  // 折りたたみして見えない行はrangeに含まれない（折りたたみして見える最初の１行は含まれる）
  for (const range of editor.visibleRanges) {
    const start = range.start.line;
    const end = Math.min(range.end.line, lineCount - 1);
    for (let line = start; line <= end; line++) {
      lineSet.add(line);
    }
  }
  return [...lineSet].sort((a, b) => a - b); // 昇順
}

export async function getSurroundByInput({
  isSamePair,
  prefixChars = '',
  suffixChars = '',
  leftInputChar,
  rightInputChar,
  textObjectPrefix,
}: {
  isSamePair: boolean;
  prefixChars?: string;
  suffixChars?: string;
  leftInputChar?: string;
  rightInputChar?: string;
  textObjectPrefix?: string;
}): Promise<OperationRange | null> {
  const editor = getActiveEditor();
  const lineInfo = getLineInfo();

  const { text, posMap, cursorIndex, prefixStartIndex, currentLineStartIndex, suffixStartIndex, linesBelowStartIndex } =
    buildVisibleBuffer(editor, lineInfo, prefixChars, suffixChars);

  const cursorRange = new vscode.Range(lineInfo.line, lineInfo.col, lineInfo.line, lineInfo.col + 1);
  let ranges;
  if (isSamePair) {
    ranges = scanSamePairRangesMultiLine(text, cursorIndex, posMap);
  } else {
    const leftRanges = scanCharRangesMultiLine(text, cursorIndex, 0, -1, posMap);
    const rightRanges = scanCharRangesMultiLine(text, cursorIndex + 1, text.length, 1, posMap);
    ranges = {
      one: [...leftRanges.one, ...rightRanges.one],
      two: [...leftRanges.two, ...rightRanges.two],
      three: [...leftRanges.three, ...rightRanges.three],
      other: [...leftRanges.other, ...rightRanges.other],
    };
  }

  const oneDeco = vscode.window.createTextEditorDecorationType({ color: 'rgba(235, 43, 62, 0.97)' });
  const twoDeco = vscode.window.createTextEditorDecorationType({ color: 'rgba(83, 244, 9, 0.81)' });
  const threeDeco = vscode.window.createTextEditorDecorationType({
    color: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(50, 65, 230, 0.6)',
  });
  const otherDeco = vscode.window.createTextEditorDecorationType({ color: 'rgba(255, 255, 255, 0.8)' });
  const cursorDeco = vscode.window.createTextEditorDecorationType(CURSOR_HIGHLIGHT_STYLE);

  editor.setDecorations(oneDeco, ranges.one);
  editor.setDecorations(twoDeco, ranges.two);
  editor.setDecorations(threeDeco, ranges.three);
  editor.setDecorations(otherDeco, ranges.other);
  editor.setDecorations(cursorDeco, [cursorRange]);

  const { leftChar, rightChar } = await getPairChars(isSamePair, leftInputChar, rightInputChar);

  editor.setDecorations(oneDeco, []);
  editor.setDecorations(twoDeco, []);
  editor.setDecorations(threeDeco, []);
  editor.setDecorations(otherDeco, []);
  editor.setDecorations(cursorDeco, []);

  oneDeco.dispose();
  twoDeco.dispose();
  threeDeco.dispose();
  otherDeco.dispose();
  cursorDeco.dispose();

  const result = getSurroundRangeByCountPair(text, cursorIndex, leftChar, rightChar);
  if (!result) return null;

  const shift = textObjectPrefix === 'i' ? 1 : 0;
  const boundaries = { prefixStartIndex, currentLineStartIndex, suffixStartIndex, linesBelowStartIndex };

  const leftPos = resolveIndexToPosition(result.leftIndex + shift, boundaries, posMap, lineInfo);
  const rightPos = resolveIndexToPosition(result.rightIndex - shift, boundaries, posMap, lineInfo);

  return {
    startLine: leftPos.line,
    startCol: leftPos.col,
    endLine: rightPos.line,
    endCol: rightPos.col,
    mode: 'char',
  };
}

//
// カレント行のみ
//

function scanSamePairRanges(
  text: string,
  cursorCol: number,
  prefixLen: number,
  suffixLen: number,
  lineNum: number,
): {
  one: vscode.Range[];
  two: vscode.Range[];
  three: vscode.Range[];
  other: vscode.Range[];
} {
  const one: vscode.Range[] = [];
  const two: vscode.Range[] = [];
  const three: vscode.Range[] = [];
  const other: vscode.Range[] = [];

  // 左方向探索
  const leftCountMap = new Map<string, number>(); // char, count
  const leftPending = new Map<string, { count: number; col: number }[]>(); // char, {count, col}
  for (let col = cursorCol; col >= 0; col--) {
    const char = text[col];
    const count = (leftCountMap.get(char) ?? 0) + 1;
    leftCountMap.set(char, count);
    if (col < prefixLen) continue;
    if (!leftPending.has(char)) leftPending.set(char, []);
    leftPending.get(char)!.push({ count, col });
  }

  // 右方向探索
  const colToCount = new Array(text.length).fill(-1);
  for (let col = cursorCol + 1; col < text.length - suffixLen; col++) {
    const char = text[col];
    const queue = leftPending.get(char);
    if (!queue || queue.length === 0) continue;
    const partner = queue.shift()!;
    colToCount[col] = partner.count;
    colToCount[partner.col] = partner.count;
  }

  // 配色構築
  for (let col = prefixLen; col < text.length - suffixLen; col++) {
    const count = colToCount[col];
    const range = new vscode.Range(lineNum, col - prefixLen, lineNum, col - prefixLen + 1);
    if (count === 1) one.push(range);
    else if (count === 2) two.push(range);
    else if (count === 3) three.push(range);
    else other.push(range);
  }

  return { one, two, three, other };
}

/**
 * テキストをスキャンして文字の出現回数ごとに色分けしたRangeを返す
 * @param text カレント行のテキスト
 * @param startCol スキャン開始col
 * @param endCol スキャン終了col（左スキャン時は0、右スキャン時はtext.length）
 * @param step 1 = 右方向, -1 = 左方向
 * @param lineNum  行番号
 * @param prefixLength textの先頭に追加した補助文字列の長さ
 * @returns 出現回数ごとに色分けされたRange
 */
function scanCharRanges(
  text: string,
  startCol: number,
  endCol: number,
  step: 1 | -1,
  lineNum: number,
  prefixLength: number,
): {
  one: vscode.Range[];
  two: vscode.Range[];
  three: vscode.Range[];
  other: vscode.Range[];
} {
  const countMap = new Map<string, number>();
  const one: vscode.Range[] = [];
  const two: vscode.Range[] = [];
  const three: vscode.Range[] = [];
  const other: vscode.Range[] = [];

  const inBounds = step === 1 ? (col: number) => col < endCol : (col: number) => col >= endCol;
  for (let col = startCol; inBounds(col); col += step) {
    const char = text[col];
    const count = (countMap.get(char) ?? 0) + 1;
    countMap.set(char, count);
    const range = new vscode.Range(lineNum, col - prefixLength, lineNum, col + 1 - prefixLength);
    if (count === 1) one.push(range);
    else if (count === 2) two.push(range);
    else if (count === 3) three.push(range);
    else other.push(range);
  }

  return { one, two, three, other };
}

/**
 * 現在行のカーソル位置を起点として、２つの入力で囲まれた範囲を返す
 * @param isSamePair trueの場合、囲みの開始文字と終端文字が同じになる
 * @param prefixChars textの先頭に加える文字列
 * @param surfixChars textの末尾に加える文字列
 * @param leftInputChar 左側の囲み文字を指定（例："2{", "$"）
 * @param rightInputChar 右側の囲み文字を指定（例："2}", "$"）
 * @param textObjectPrefix 'i'または'a'
 * @returns 見つかった場合は囲みの範囲、見つからない場合は null
 *   - leftCol 開始文字のcol
 *   - rightCol 終端文字のcol
 */
export async function getLineSurroundByInput({
  isSamePair,
  prefixChars = '',
  suffixChars = '',
  leftInputChar,
  rightInputChar,
  textObjectPrefix,
}: {
  isSamePair: boolean;
  prefixChars?: string;
  suffixChars?: string;
  leftInputChar?: string;
  rightInputChar?: string;
  textObjectPrefix?: string;
}): Promise<OperationRange | null> {
  const editor = getActiveEditor();
  const lineInfo = getLineInfo();
  const lineText = prefixChars + lineInfo.text + suffixChars;
  const lineNum = lineInfo.line;
  const prefixLen = prefixChars.length;
  const suffixLen = suffixChars.length;
  const cursorCol = lineInfo.col + prefixLen;

  const visibleRanges = buildVisibleLineRanges(getVisibleLineNumbers(editor), lineNum, editor.document);
  const cursorRange = new vscode.Range(lineNum, lineInfo.col, lineNum, lineInfo.col + 1);
  let ranges;
  if (isSamePair) {
    ranges = scanSamePairRanges(lineText, cursorCol, prefixLen, suffixLen, lineNum);
  } else {
    const leftRanges = scanCharRanges(lineText, cursorCol, prefixLen, -1, lineNum, prefixLen);
    const rightRanges = scanCharRanges(lineText, cursorCol + 1, lineText.length - suffixLen, 1, lineNum, prefixLen);
    ranges = {
      one: [...leftRanges.one, ...rightRanges.one],
      two: [...leftRanges.two, ...rightRanges.two],
      three: [...leftRanges.three, ...rightRanges.three],
      other: [...leftRanges.other, ...rightRanges.other],
    };
  }

  // デコレーションスタイルの設定
  const visibleDeco = vscode.window.createTextEditorDecorationType({ color: 'rgba(255, 255, 255, 0.4)' });
  const oneDeco = vscode.window.createTextEditorDecorationType({ color: 'rgba(235, 43, 62, 0.97)' });
  const twoDeco = vscode.window.createTextEditorDecorationType({ color: 'rgba(83, 244, 9, 0.81)' });
  const threeDeco = vscode.window.createTextEditorDecorationType({
    color: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(50, 65, 230, 0.6)',
  });
  const otherDeco = vscode.window.createTextEditorDecorationType({ color: 'rgba(255, 255, 255, 0.8)' });
  const cursorDeco = vscode.window.createTextEditorDecorationType(CURSOR_HIGHLIGHT_STYLE);

  // デコレーションを適用
  editor.setDecorations(visibleDeco, visibleRanges);
  editor.setDecorations(oneDeco, ranges.one);
  editor.setDecorations(twoDeco, ranges.two);
  editor.setDecorations(threeDeco, ranges.three);
  editor.setDecorations(otherDeco, ranges.other);
  editor.setDecorations(cursorDeco, [cursorRange]);

  // ユーザーの入力を待つ
  const { leftChar, rightChar } = await getPairChars(isSamePair, leftInputChar, rightInputChar);

  // デコレーションを解除
  editor.setDecorations(visibleDeco, []);
  editor.setDecorations(oneDeco, []);
  editor.setDecorations(twoDeco, []);
  editor.setDecorations(threeDeco, []);
  editor.setDecorations(otherDeco, []);
  editor.setDecorations(cursorDeco, []);

  visibleDeco.dispose();
  oneDeco.dispose();
  twoDeco.dispose();
  threeDeco.dispose();
  otherDeco.dispose();
  cursorDeco.dispose();

  const result = getSurroundRangeByCountPair(lineText, cursorCol, leftChar, rightChar);
  if (!result) return null;
  const shift = textObjectPrefix === 'i' ? 1 : 0;
  const leftCol = result.leftIndex + shift < prefixLen ? 0 : result.leftIndex + shift - prefixLen;
  const rightCol =
    result.rightIndex - shift - prefixLen >= lineInfo.text.length - 1
      ? lineInfo.text.length - 1
      : result.rightIndex - shift - prefixLen;
  return { startLine: lineNum, startCol: leftCol, endLine: lineNum, endCol: rightCol, mode: 'char' };
}
