import { getActiveEditor } from '@utils/editor/editor';
import { OperationRange } from '@utils/operation/operationType';

export function getRangeByKey(
  key: 'A' | 'gg' | 'G' | 'h' | 'j' | 'k' | 'l',
  count: number,
): { startLine: number; startCol: number; endLine: number; endCol: number; mode: 'char' | 'line' | 'block' } {
  const editor = getActiveEditor();
  const doc = editor.document;
  const currentLine = editor.selection.active.line;
  const currentCol = editor.selection.active.character;
  const lastLine = doc.lineCount - 1;
  switch (key) {
    case 'A':
      return {
        startLine: 0,
        startCol: 0,
        endLine: lastLine,
        endCol: doc.lineAt(lastLine).text.length - 1,
        mode: 'line',
      };

    case 'gg':
      return {
        startLine: 0,
        startCol: 0,
        endLine: currentLine,
        endCol: doc.lineAt(currentLine).text.length - 1,
        mode: 'line',
      };

    case 'G':
      return {
        startLine: currentLine,
        startCol: 0,
        endLine: lastLine,
        endCol: doc.lineAt(lastLine).text.length - 1,
        mode: 'line',
      };

    case 'h': {
      return {
        startLine: currentLine,
        startCol: Math.max(0, currentCol - count),
        endLine: currentLine,
        endCol: Math.max(0, currentCol - 1),
        mode: 'char',
      };
    }

    case 'j': {
      return {
        startLine: currentLine,
        startCol: 0,
        endLine: currentLine + count - 1,
        endCol: doc.lineAt(currentLine + count - 1).text.length - 1,
        mode: 'line',
      };
    }

    case 'k': {
      return {
        startLine: currentLine - count,
        startCol: 0,
        endLine: currentLine - 1,
        endCol: doc.lineAt(currentLine - 1).text.length - 1,
        mode: 'line',
      };
    }

    case 'l': {
      return {
        startLine: currentLine,
        startCol: currentCol,
        endLine: currentLine,
        endCol: Math.min(currentCol + count - 1, doc.lineAt(currentLine).text.length - 1),
        mode: 'char',
      };
    }
  }
}

/**
 * カレント行を含めた指定行数分の範囲を返す
 * @param count     カレント行を含めた行数
 * @param direction 'up' = カレント行から上方向, 'down' = カレント行から下方向
 * @returns { startLine, startCol, endLine, endCol, mode }
 */
export function getCountLineRange(count: number, direction: 'up' | 'down'): OperationRange {
  const editor = getActiveEditor();
  const currentLine = editor.selection.active.line;
  const lastLine = editor.document.lineCount - 1;

  let startLine: number;
  let endLine: number;

  if (direction === 'down') {
    startLine = currentLine;
    endLine = Math.min(currentLine + count - 1, lastLine);
  } else {
    startLine = Math.max(currentLine - count + 1, 0);
    endLine = currentLine;
  }

  let endCol = editor.document.lineAt(endLine).text.length - 1;
  if (endCol < 0) endCol = 0;

  return { startLine, startCol: 0, endLine, endCol, mode: 'line' };
}
