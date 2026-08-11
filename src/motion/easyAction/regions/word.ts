import * as vscode from 'vscode';
import { RegionInfo } from '../type';
import { easyActionMaxVisibleCol } from '../config';
import { getActiveEditor } from '@utils/editor/editor';


function getRegions(pattern: RegExp): RegionInfo[] {
  const editor = getActiveEditor();
  const targets: RegionInfo[] = [];
  for (const visibleRange of editor.visibleRanges) {
    for (let lineNum = visibleRange.start.line; lineNum <= visibleRange.end.line; lineNum++) {
      const lineText = editor.document.lineAt(lineNum).text;
      const visibleText = lineText.slice(0, easyActionMaxVisibleCol);
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(visibleText)) !== null) {
        const start = new vscode.Position(lineNum, match.index);
        const end = new vscode.Position(lineNum, match.index + match[0].length);
        targets.push({
          line: lineNum,
          col: match.index,
          range: new vscode.Range(start, end),
        });
      }
    }
  }
  return targets;
}

export function getWordRegions(): RegionInfo[] {
  return getRegions(/[A-Za-z0-9_-]+/g);
}

// export function getSymbolRegions(): RegionInfo[] {
//   return getRegions(/["'([{<)]+/g);
// }
