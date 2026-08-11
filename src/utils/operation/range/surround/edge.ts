import { EdgeType } from './type';
import { getLineInfo } from '@utils/editor/line';
import { OperationRange } from '@utils/operation/operationType';

/**
 * 指定したEdgeTypeに応じた行内の範囲を返す
 * @param edgeType 範囲の種類
 *   - line                   : 行全体 (行頭〜行末)
 *   - trimStart              : スペースを除いた先頭〜行末
 *   - trimEnd                : 行頭〜スペースを除いた末尾
 *   - trimBoth               : 両端のスペースを除いた範囲
 *   - startToCursor          : 行頭〜カーソル位置
 *   - startToLeftOfCursor    : 行頭〜カーソル位置の左側
 *   - trimStartToCursor      : スペースを除いた先頭〜カーソル位置
 *   - trimStartToLeftOfCursor: スペースを除いた先頭〜カーソル位置の左側
 *   - cursorToTrimEnd        : カーソル位置〜スペースを除いた末尾
 *   - cursorToEnd            : カーソル位置〜行末
 * @returns { startLine, startCol, endLine, endCol, mode } | null
 */
export function getLineSurroundByEdge(edgeType: EdgeType): OperationRange | null {
  const { text, line, col } = getLineInfo();
  const trimStartCol = text.search(/\S/);
  const trimEndCol = text.trimEnd().length - 1;
  const mode = 'char';

  switch (edgeType) {
    case 'line':
      return { startLine: line, startCol: 0, endLine: line, endCol: text.length, mode };

    case 'trimStart':
      if (trimStartCol === -1) return null;
      return { startLine: line, startCol: trimStartCol, endLine: line, endCol: text.length, mode };

    case 'trimEnd':
      return { startLine: line, startCol: 0, endLine: line, endCol: trimEndCol, mode };

    case 'trimBoth':
      if (trimStartCol === -1) return null;
      return { startLine: line, startCol: trimStartCol, endLine: line, endCol: trimEndCol, mode };

    case 'startToLeftOfCursor':
      return { startLine: line, startCol: 0, endLine: line, endCol: col === 0 ? 0 : col - 1, mode };

    case 'startToCursor':
      return { startLine: line, startCol: 0, endLine: line, endCol: col, mode };

    case 'trimStartToLeftOfCursor':
      if (trimStartCol === -1) return null;
      return { startLine: line, startCol: trimStartCol, endLine: line, endCol: col === 0 ? 0 : col - 1, mode };

    case 'trimStartToCursor':
      if (trimStartCol === -1) return null;
      return { startLine: line, startCol: trimStartCol, endLine: line, endCol: col, mode };

    case 'cursorToTrimEnd':
      return { startLine: line, startCol: col, endLine: line, endCol: trimEndCol, mode };

    case 'cursorToEnd':
      return { startLine: line, startCol: col, endLine: line, endCol: text.length, mode };
  }
}
