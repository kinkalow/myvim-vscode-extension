import { OperationRange } from '@utils/operation/operationType';
import { getLineInfo } from '@utils/editor/line';

/**
 * カーソル位置のキャメルケースパーツの範囲を返す
 * @param text      行のテキスト
 * @param cursorCol カーソルのcol位置
 * @returns { startLine, startCol, endLine, endCol } | null
 */
export function getLineSurroundByCamelCase(): OperationRange | null {
  const lineInfo = getLineInfo();
  const text = lineInfo.text;
  const line = lineInfo.line;
  const cursorCol = lineInfo.col;

  const camelPartRegex = /([A-Z][a-z]*|[a-z]+)/g;
  let match: RegExpExecArray | null;

  while ((match = camelPartRegex.exec(text)) !== null) {
    const leftCol = match.index;
    const rightCol = match.index + match[0].length - 1;
    if (cursorCol >= leftCol && cursorCol <= rightCol) {
      return {
        // text: match[0],
        // cursorCol,
        startLine: line,
        startCol: leftCol,
        endLine: line,
        endCol: rightCol,
        mode: 'char',
      };
    }
  }

  return null;
}
