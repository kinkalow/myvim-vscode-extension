import * as vscode from 'vscode';
import { OperationRange } from '@utils/operation/operationType';
import { TextObjectPrefix } from '../type';

const DEF_REGEX = /^(\s*)(async\s+def|def)\s+\w+\s*\(/;

interface PyFunctionRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

function getIndent(line: string): number {
  const match = line.match(/^[ \t]*/);
  return match ? match[0].length : 0;
}

function isBlankOrComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0 || trimmed.startsWith('#');
}

//
// カレント行からnth番目の関数のみ探索
//

/** fromLine から左方向に探索し、nth番目のdefを返す */
function findPyFunctionRange(lines: string[], fromLine: number, nth: number, cursorCol: number): PyFunctionRange | null {
  let count = 0;
  let i;
  let indent;
  for (i = fromLine; i >= 0; i--) {
    const match = lines[i].match(DEF_REGEX);
    if (!match) {
      continue;
    }
    indent = match[1].length;
    if (i === fromLine && indent > cursorCol) continue;
    count += 1;
    if (count >= nth) break;
  }
  if (i === -1) return null;
  if (indent === undefined) return null;

  let startLine = i;
  let endLine = startLine;
  for (i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (isBlankOrComment(line)) continue; // 空行またはコメントならスキップ
    if (getIndent(line) <= indent) break; // 関数の終端
    endLine = i;
  }

  // 直前に連続するデコレータ(@...)があれば範囲に含める
  while (startLine > 0 && lines[startLine - 1].trim().startsWith('@')) {
    startLine--;
  }

  return { startLine, startCol: indent, endLine, endCol: lines[endLine].length - 1 };
}

export function getFunctionRangeForPython(
  nth: number,
  textObjectPrefix: TextObjectPrefix,
  editor: vscode.TextEditor,
): OperationRange | null {
  const document = editor.document;
  const cursorLine = editor.selection.active.line;
  const cursorCol = editor.selection.active.character;

  const lineCount = document.lineCount;
  const lines: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(document.lineAt(i).text);
  }

  let searchFromLine = cursorLine;
  const found = findPyFunctionRange(lines, searchFromLine, nth, cursorCol);
  if (found === null) return null;

  return {
    ...found,
    mode: textObjectPrefix === 'i' ? 'char' : 'line',
  };
}

//
// 関数をすべて探索
//

function collectPyFunctionRanges(lines: string[]): PyFunctionRange[] {
  const ranges: PyFunctionRange[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(DEF_REGEX);
    if (!match) {
      continue;
    }
    const indent = match[1].length;

    let endLine = i;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (isBlankOrComment(line)) continue; // 空行またはコメントならスキップ
      if (getIndent(line) <= indent) break; // 関数の終端
      endLine = j;
    }

    // 直前に連続するデコレータ(@...)があれば範囲に含める
    let startLine = i;
    while (startLine > 0 && lines[startLine - 1].trim().startsWith('@')) {
      startLine--;
    }

    ranges.push({ startLine, startCol: indent, endLine, endCol: lines[endLine].length - 1 });
  }

  return ranges;
}

export function getFunctionRangeUsingPython2(
  nth: number,
  textObjectPrefix: TextObjectPrefix,
  editor: vscode.TextEditor,
): OperationRange | null {
  const document = editor.document;
  const cursorLine = editor.selection.active.line;

  const lines: string[] = [];
  for (let i = 0; i < document.lineCount; i++) {
    lines.push(document.lineAt(i).text);
  }

  const allRanges = collectPyFunctionRanges(lines);
  const enclosing = allRanges.filter((r) => r.startLine <= cursorLine);

  const target = enclosing[nth > 0 ? nth - 1 : 0];
  if (!target) {
    return null;
  }

  return {
    startLine: target.startLine,
    startCol: target.startCol,
    endLine: target.endLine,
    endCol: target.endCol,
    mode: textObjectPrefix === 'i' ? 'char' : 'line',
  };
}
