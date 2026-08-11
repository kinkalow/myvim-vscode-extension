import * as vscode from 'vscode';
import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';
import { getOnePrintableChar } from '@utils/ui/input';
import { getActiveEditor } from '@utils/editor';

// 整形した文字の位置をハイライトする
const alignDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(0, 255, 225, 0.82)',
});

// 指定キーの後に押された囲み文字ペアの中身を、次の1回の整形だけ無視する
let IGNORE_TRIGGER_KEY = 'i';

// 整形で無視する囲みの定義
// 例：IGNORE_TRIGGER_KEYを押した後に(を入力すると、(...)の中身は無視して整形する
const BRACKET_PAIRS: Record<string, { open: string; close: string }> = {
  '(': { open: '(', close: ')' },
  ')': { open: '(', close: ')' },
  '[': { open: '[', close: ']' },
  ']': { open: '[', close: ']' },
  '<': { open: '<', close: '>' },
  '>': { open: '<', close: '>' },
  '{': { open: '{', close: '}' },
  '}': { open: '{', close: '}' },
};

interface SurroundRange {
  start: number;
  end: number;
}

function getQuoteRanges(fromCol: number, lineText: string): SurroundRange[] {
  const ranges: SurroundRange[] = [];
  let i = fromCol;
  while (i < lineText.length) {
    const ch = lineText[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const start = i;
      i++;
      while (i < lineText.length && lineText[i] !== quote) {
        if (lineText[i] === '\\') i++;
        i++;
      }
      const end = i < lineText.length ? i : lineText.length - 1;
      ranges.push({ start, end });
      i++; // quoteの次の文字
      continue;
    }
    i++;
  }
  return ranges;
}

/** 指定した開き/閉じ文字ペアの区間リストを返す */
function getBracketRanges(fromCol: number, lineText: string, openChar: string, closeChar: string): SurroundRange[] {
  const ranges: SurroundRange[] = [];
  let i = fromCol;
  let depth = 0;
  let start = -1;
  while (i < lineText.length) {
    const ch = lineText[i];
    if (ch === openChar) {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === closeChar) {
      if (depth > 0) {
        depth--;
        if (depth === 0) {
          ranges.push({ start, end: i });
        }
      }
    }
    i++;
  }
  return ranges;
}

function isInsideSurround(ranges: SurroundRange[], col: number): boolean {
  return ranges.some((r) => r.start <= col && col <= r.end);
}

/** fromCol 以降で、クォート(と指定があれば囲み文字)の外にある最初の targetChar の位置を返す */
function findAlignChar(
  lineText: string,
  targetChar: string,
  fromCol: number,
  bracketPair: { open: string; close: string } | null,
): number | null {
  const quoteRanges = getQuoteRanges(fromCol, lineText);
  const bracketRanges = bracketPair ? getBracketRanges(fromCol, lineText, bracketPair.open, bracketPair.close) : [];
  for (let col = fromCol; col < lineText.length; col++) {
    if (lineText[col] === targetChar && !isInsideSurround(quoteRanges, col) && !isInsideSurround(bracketRanges, col)) {
      return col;
    }
  }
  return null;
}

async function alignSelectionByChar(
  editor: vscode.TextEditor,
  startLine: number,
  targetChar: string,
  searchFromCols: number[],
  bracketPair: { open: string; close: string } | null,
): Promise<vscode.Range[]> {
  const document = editor.document;

  const positions: (number | null)[] = [];
  let maxCol = -1;
  for (let idx = 0; idx < searchFromCols.length; idx++) {
    const line = startLine + idx;
    const lineText = document.lineAt(line).text;
    const col = findAlignChar(lineText, targetChar, searchFromCols[idx], bracketPair);
    positions.push(col);
    if (col !== null && col > maxCol) {
      maxCol = col;
    }
  }
  if (maxCol === -1) return []; // どの行にも見つからなかった

  // 空白を加えて整形
  await editor.edit((editBuilder) => {
    for (let idx = 0; idx < positions.length; idx++) {
      const line = startLine + idx;
      const col = positions[idx];
      if (col === null) continue;
      const padCount = maxCol - col;
      if (padCount > 0) {
        editBuilder.insert(new vscode.Position(line, col), ' '.repeat(padCount));
      }
    }
  });

  // 検索開始位置を更新
  const highlightRanges: vscode.Range[] = [];
  for (let idx = 0; idx < positions.length; idx++) {
    if (positions[idx] !== null) {
      searchFromCols[idx] = maxCol + 1;
      const line = startLine + idx;
      // 整形後、揃えた文字の位置(maxCol)をハイライト対象として記録する
      highlightRanges.push(new vscode.Range(new vscode.Position(line, maxCol), new vscode.Position(line, maxCol + 1)));
    }
  }

  return highlightRanges;
}

/** 指定行内のテキストを整形する */
export async function startAlignMode(): Promise<void> {
  const editor = getActiveEditor();
  const selection = visualModeHelper.getVisualSelection();
  let startLine, endLine;
  if (selection) {
    startLine = selection.startLine;
    endLine = selection.endLine;
  } else {
    const currentLine = editor.selection.active.line;
    for (let line = currentLine; line >= 0; line--) {
      if (editor.document.lineAt(line).text.trim() === '') {
        startLine = line;
        break;
      }
    }
    if (!startLine) startLine = 0;
    for (let line = currentLine; line < editor.document.lineCount; line++) {
      if (editor.document.lineAt(line).text.trim() === '') {
        endLine = line;
        break;
      }
    }
    if (!endLine) endLine = editor.document.lineCount - 1;
  }

  // 各行ごとの検索開始列(最初は全部0)
  const searchFromCols: number[] = new Array(endLine - startLine + 1).fill(0);
  // 整形した文字の位置をハイライトする
  const highlightRanges: vscode.Range[] = [];
  // IGNORE_TRIGGER_KEYが押された直後の1回だけ有効な、無視する囲み文字ペア
  let pendingBracketPair: { open: string; close: string } | null = null;

  try {
    while (true) {
      const char = await getOnePrintableChar();
      if (char === '') break;

      if (char === IGNORE_TRIGGER_KEY) {
        // 次の1文字で無視する囲み文字ペアを決定する
        const bracketChar = await getOnePrintableChar();
        if (bracketChar === '') break;
        const pair = BRACKET_PAIRS[bracketChar];
        if (pair) pendingBracketPair = pair;
        continue;
      }

      const newRanges = await alignSelectionByChar(editor, startLine, char, searchFromCols, pendingBracketPair);
      highlightRanges.push(...newRanges);
      editor.setDecorations(alignDecorationType, highlightRanges);

      pendingBracketPair = null;
    }
  } finally {
    editor.setDecorations(alignDecorationType, []);
  }
}
