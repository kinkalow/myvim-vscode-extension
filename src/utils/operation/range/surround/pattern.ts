import * as vscode from 'vscode';
import { getLineInfo } from '@utils/editor/line';
import { OperationRange } from '@utils/operation/operationType';

/**
 * 現在行のカーソル位置からpatternにマッチする囲みの文字列と範囲を返す
 * @params pattern 検索用のパターン。RegExpの引数（例: [A-Za-z0-9]）
 * @param isInsertMode インサートモードかどうか
 * @returns { startLine, startCol, endLine, endCol, mode } | null
 */
export function getLineSurroundByPattern(
  pattern: string,
  { isInsertMode = false,  editor }: { isInsertMode?: boolean, editor?: vscode.TextEditor } = {},
): OperationRange | null {
  const lineInfo = editor ? getLineInfo({editor}) : getLineInfo();
  const line = lineInfo.line;
  const lineText = lineInfo.text;
  const cursorCol = isInsertMode ? Math.max(0, lineInfo.col - 1) : lineInfo.col;

  const regex = new RegExp(pattern);
  if (!regex.test(lineText[cursorCol])) return null;

  let leftCol = cursorCol;
  let rightCol = cursorCol;
  while (leftCol > 0 && regex.test(lineText[leftCol - 1])) leftCol--;
  while (rightCol < lineText.length - 1 && regex.test(lineText[rightCol + 1])) rightCol++;

  return {
    startLine: line,
    startCol: leftCol,
    endLine: line,
    endCol: rightCol,
    mode: 'char',
  };
}
