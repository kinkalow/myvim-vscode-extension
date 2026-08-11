import * as vscode from 'vscode';
import { RegionInfo } from '../type';
import { easyActionMaxVisibleCol } from '../config';
import { getActiveEditor } from '@utils/editor/editor';

const SYMBOL_PAIRS: { [key: string]: string } = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>',
  '"': '"',
  "'": "'",
  '`': '`',
};

/**
 * 表示領域内の全囲み文字を返す
 * - range は囲みの内側（symbolを含まない）
 * - outerRange は囲みの外側（symbolを含む）
 */
export interface SymbolRegionInfo extends RegionInfo {
  outerRange: vscode.Range; // symbolを含む外側のrange
  openChar: string;
  closeChar: string;
}

/**
 * 表示領域内の全囲み文字ペアを返す
 */
export function getSymbolRegions(): SymbolRegionInfo[] {
  const editor = getActiveEditor();
  const targets: SymbolRegionInfo[] = [];
  const openChars = Object.keys(SYMBOL_PAIRS);

  for (const visibleRange of editor.visibleRanges) {
    for (let lineNum = visibleRange.start.line; lineNum <= visibleRange.end.line; lineNum++) {
      const lineText = editor.document.lineAt(lineNum).text;
      const visibleText = lineText.slice(0, easyActionMaxVisibleCol);

      for (let col = 0; col < visibleText.length; col++) {
        const char = visibleText[col];
        if (!openChars.includes(char)) continue;

        // FIXME: 入れ子構造を考慮していない。各行ごとにペアがあるか検索しているだけ
        const closeChar = SYMBOL_PAIRS[char];
        const closeCol = visibleText.indexOf(closeChar, col + 1);
        if (closeCol === -1) continue;

        const innerStart = new vscode.Position(lineNum, col + 1);
        const innerEnd = new vscode.Position(lineNum, closeCol);
        const outerStart = new vscode.Position(lineNum, col);
        const outerEnd = new vscode.Position(lineNum, closeCol + 1);

        targets.push({
          line: lineNum,
          col, // 開き記号の位置にヒント表示
          range: new vscode.Range(innerStart, innerEnd), // 内側（symbolなし）
          outerRange: new vscode.Range(outerStart, outerEnd), // 外側（symbolあり）
          openChar: char,
          closeChar,
        });
      }
    }
  }

  return targets;
}
