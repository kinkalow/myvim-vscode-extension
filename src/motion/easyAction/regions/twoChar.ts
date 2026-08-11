import * as vscode from 'vscode';
import { RegionInfo } from '../type';
import { easyActionMaxVisibleCol } from '../config';
import { getActiveEditor } from '@utils/editor/editor';
import { getOnePrintableChar } from '@utils/ui/input';

/**
 * ユーザーから2文字入力を受け取り、表示領域内でマッチする位置を返す
 * easymotionの2文字検索に相当する
 */
export async function getTwoCharMatchRegions(): Promise<RegionInfo[]> {
  const editor = getActiveEditor();

  const char1 = await getOnePrintableChar();
  if (!char1) return [];
  const char2 = await getOnePrintableChar();
  if (!char2) return [];

  const searchStr = char1 + char2;
  const targets: RegionInfo[] = [];
  for (const visibleRange of editor.visibleRanges) {
    for (let lineNum = visibleRange.start.line; lineNum <= visibleRange.end.line; lineNum++) {
      const lineText = editor.document.lineAt(lineNum).text;
      const visibleText = lineText.slice(0, easyActionMaxVisibleCol);
      let index = visibleText.indexOf(searchStr);
      while (index !== -1) {
        const start = new vscode.Position(lineNum, index);
        const end = new vscode.Position(lineNum, index + searchStr.length);
        targets.push({
          line: lineNum,
          col: index,
          range: new vscode.Range(start, end),
        });
        index = visibleText.indexOf(searchStr, index + 1);
      }
    }
  }

  return targets;
}