import { EditorHelper } from '@utils/editorHelper/EditorHelper';
import { OperationRange } from '@utils/operation/operationType';

function isWhitespaceLine(lineText: string): boolean {
  return /^\s*$/.test(lineText);
}

/**
 * カレント行を基準に、空白行で囲まれた範囲を返す
 */
export function getSurroundByParagraph(): OperationRange | null {
  const helper = new EditorHelper();

  const currentLineText = helper.getCurrentLineText();
  if (isWhitespaceLine(currentLineText)) return null;

  let currentLine = helper.cursor.get().line;
  let startLine = currentLine;
  let endLine = currentLine;

  // 上方向に探索
  for (let line = currentLine - 1; line >= 0; line--) {
    const lineText = helper.document.getLineText(line);
    if (isWhitespaceLine(lineText)) break;
    startLine = line;
  }

  // 下方向に探索
  for (let line = currentLine + 1; line < helper.editor.document.lineCount; line++) {
    const lineText = helper.document.getLineText(line);
    if (isWhitespaceLine(lineText)) break;
    endLine = line;
  }

  return {
    startLine,
    startCol: 0,
    endLine,
    endCol: helper.document.getLineText(endLine).length,
    mode: 'line',
  };
}
