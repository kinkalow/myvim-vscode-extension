import { OperationRange } from '@utils/operation/operationType';

/**
 * range1とrange2の範囲が同じかどうかを調べる
 * @param range1 囲み範囲（getSurroundBy***やgetLineSurroundBy***の関数の返り値）
 * @param range2 囲み範囲（getSurroundBy***やgetLineSurroundBy***の関数の返り値）
 * @returns 範囲が同じならtrueを返す
 */
export function isSameRange(range1: OperationRange | undefined, range2: OperationRange | undefined): boolean {
  if (!range1 || !range2) return false;
  return (
    range1.startLine === range2.startLine &&
    range1.startCol === range2.startCol &&
    range1.endLine === range2.endLine &&
    range1.endCol === range2.endCol &&
    range1.mode === range2.mode
  );
}
