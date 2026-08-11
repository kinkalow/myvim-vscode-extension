import * as vscode from 'vscode';

import { getActiveEditor } from '@utils/editor/editor';
import { highlightTemporarily } from '@utils/decoration/highlight';
import { VisualRange, VisualLineRange } from '@utils/visualModeHelper/visualMode';

// ----------------------------------------------------------------------
// Visualモードの行ベースかどうかを判定
// ----------------------------------------------------------------------

export function isLineBasedSelection(range: { startLine: number; endLine: number; text: string }): boolean {
  const editor = getActiveEditor();

  let startLine: number, endLine: number, selectedText: string;
  if (range) {
    startLine = range.startLine;
    endLine = range.endLine;
    selectedText = range.text;
  } else {
    const selection = editor.selection;
    if (selection.isEmpty) return false;
    startLine = selection.start.line;
    endLine = selection.end.line;
    selectedText = editor.document.getText(selection);
  }

  const lineTexts: string[] = [];
  for (let line = startLine; line <= endLine; line++) {
    lineTexts.push(editor.document.lineAt(line).text);
  }
  const fullLineText = lineTexts.join('\n');

  return selectedText === fullLineText;
}

// ----------------------------------------------------------------------
// legacyRangeからSwapRangeへの変換
// ----------------------------------------------------------------------

export function legacyRangeToSwapRange(
  range: { startLine: number; startCol: number; endLine: number; endCol: number; text: string },
  isLineBased: boolean,
): VisualRange {
  const { startLine, startCol, endLine, endCol, text } = range;
  const editor = getActiveEditor();

  if (isLineBased) {
    const lines: VisualLineRange[] = [];
    for (let line = startLine; line <= endLine; line++) {
      const lineText = editor.document.lineAt(line).text;
      lines.push({ line, startCol: 0, endCol: Math.max(0, lineText.length - 1) });
    }
    return { mode: 'line', lines, text };
  }

  const lines: VisualLineRange[] = [];
  for (let line = startLine; line <= endLine; line++) {
    const lineText = editor.document.lineAt(line).text;
    const sCol = line === startLine ? startCol : 0;
    const eCol = line === endLine ? endCol : Math.max(0, lineText.length - 1);
    lines.push({ line, startCol: sCol, endCol: eCol });
  }
  return { mode: 'char', lines, text };
}
// ----------------------------------------------------------------------
// 保存領域計算
// ----------------------------------------------------------------------

function calcNewSavedRangeForLineMode(saved: VisualRange, current: VisualRange): VisualRange {
  const savedStart = swapRangeStartLine(saved);
  const currentEnd = swapRangeEndLine(current);
  let startLine;
  if (savedStart > currentEnd) {
    startLine = saved.lines[0].line + saved.lines.length - current.lines.length;
  } else {
    startLine = saved.lines[0].line;
  }
  return {
    mode: 'line',
    lines: current.lines.map((l, i) => ({ line: startLine + i, startCol: l.startCol, endCol: l.endCol })),
    text: current.text,
  };
}

export function calcNewSwapRange(saved: VisualRange, current: VisualRange): VisualRange {
  if (saved.mode === 'line' && current.mode === 'line') {
    return calcNewSavedRangeForLineMode(saved, current);
  }

  const savedStart = swapRangeStartLine(saved);
  const currentStart = swapRangeStartLine(current);
  const savedStartCol = swapRangeStartCol(saved);
  const currentStartCol = swapRangeStartCol(current);

  const currentIsFirst = currentStart < savedStart || (currentStart === savedStart && currentStartCol < savedStartCol);

  if (currentIsFirst) {
    // currentがsavedより前方にある場合
    return {
      ...saved,
      lines: current.lines.map((c, i) => ({
        line: c.line,
        startCol: c.startCol,
        endCol: c.startCol + saved.lines[i].endCol - saved.lines[i].startCol,
      })),
    };
  }

  // currentがsavedより後方にある場合
  const newLines = current.lines.map((cLine, i) => {
    const sLine = saved.lines.find((s) => s.line === cLine.line);
    if (!sLine) {
      // currentとsavedが重ならない場合
      return { ...cLine, endCol: cLine.startCol + saved.lines[i].endCol - saved.lines[i].startCol };
    }
    // 重なる場合
    const cWidth = cLine.endCol - cLine.startCol + 1;
    const sWidth = sLine.endCol - sLine.startCol + 1;
    const newStartCol = cLine.startCol + cWidth - sWidth;
    return { line: cLine.line, startCol: newStartCol, endCol: newStartCol + sWidth - 1 };
  });

  return { ...saved, lines: newLines };
}

// ----------------------------------------------------------------------
// SwapRangeのHelper
// ----------------------------------------------------------------------

// --- SwapRangeの先頭と終端の行番号と列番号 ---
export function swapRangeStartLine(r: VisualRange): number {
  return r.lines[0].line;
}
export function swapRangeStartCol(r: VisualRange): number {
  return r.lines[0].startCol;
}
export function swapRangeEndLine(r: VisualRange): number {
  return r.lines[r.lines.length - 1].line;
}
export function swapRangeEndCol(r: VisualRange): number {
  return r.lines[r.lines.length - 1].endCol;
}

// --- line行のSwapLineRangeを取得（なければundefined）---
export function getLineRangeAt(r: VisualRange, line: number): VisualLineRange | undefined {
  return r.lines.find((l) => l.line === line);
}

// ----------------------------------------------------------------------
// HighlightのHelper
// ----------------------------------------------------------------------

export function highlightSwapRange(range: VisualRange, style: vscode.DecorationRenderOptions) {
  highlightTemporarily(
    {
      startLine: swapRangeStartLine(range),
      startCol: swapRangeStartCol(range),
      endLine: swapRangeEndLine(range),
      endCol: swapRangeEndCol(range),
    },
    { isBlock: range.mode === 'block' ? true : false, style },
  );
}
