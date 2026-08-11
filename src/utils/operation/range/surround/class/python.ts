import * as vscode from 'vscode';
import { OperationRange } from '@utils/operation/operationType';
import { TextObjectPrefix } from '../type';

const CLASS_REGEX = /^(\s*)class\s+\w+/;

interface PyClassRange {
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
// カレント行からnth番目のクラスのみ探索
//

/** fromLine から左方向に探索し、nth番目のclassを返す */
function findPyClassRange(lines: string[], fromLine: number, nth: number, cursorCol: number): PyClassRange | null {
  let count = 0;
  let i;
  let indent;
  for (i = fromLine; i >= 0; i--) {
    const match = lines[i].match(CLASS_REGEX);
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
    if (getIndent(line) <= indent) break; // クラスの終端
    endLine = i;
  }

  // 直前に連続するデコレータ(@...)があれば範囲に含める
  while (startLine > 0 && lines[startLine - 1].trim().startsWith('@')) {
    startLine--;
  }

  return { startLine, startCol: indent, endLine, endCol: lines[endLine].length - 1 };
}

export function getClassRangeForPython(
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

  const searchFromLine = cursorLine;
  const found = findPyClassRange(lines, searchFromLine, nth, cursorCol);
  if (found === null) return null;

  return {
    ...found,
    mode: textObjectPrefix === 'i' ? 'char' : 'line',
  };
}