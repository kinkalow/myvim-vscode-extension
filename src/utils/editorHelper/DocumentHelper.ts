import * as vscode from 'vscode';
import { OperationRange } from '@utils/operation/operationType';

export class DocumentHelper {
  constructor(private readonly editor: vscode.TextEditor) {}

  /** カレント行を起点として空行で囲まれた範囲を返す
   * returnRangeがtrueで行番号だけでなく列番号も返す
   */
  findBlankLineBoundaries(): { startLine: number; endLine: number } {
    const editor = this.editor;
    const document = editor.document;
    const currentLine = editor.selection.active.line;
    let startLine = currentLine;
    while (startLine > 0 && editor.document.lineAt(startLine - 1).text.trim() !== '') startLine--;
    let endLine = currentLine;
    while (endLine < document.lineCount && editor.document.lineAt(endLine + 1).text.trim() !== '') endLine++;
    return { startLine, endLine };
  }

  /** line番号のテキストを返す */
  getLineText(line: number): string {
    return this.editor.document.lineAt(line).text;
  }

  /** 範囲内のテキストを返す */
  getTextInRange(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    { mode = 'char' }: { mode?: 'char' | 'line' | 'block' } = {},
  ): string {
    if (mode === 'char') {
      return this.editor.document.getText(new vscode.Range(startLine, startCol, endLine, endCol + 1));
    }
    if (mode === 'line') {
      return this.editor.document.getText(
        new vscode.Range(startLine, 0, endLine, this.editor.document.lineAt(endLine).text.length),
      );
    }
    // block mode
    const minLine = Math.min(startLine, endLine);
    const maxLine = Math.max(startLine, endLine);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol) + 1;
    const texts: string[] = [];
    for (let line = minLine; line <= maxLine; line++) {
      const lineText = this.editor.document.lineAt(line).text;
      texts.push(lineText.padEnd(maxCol).slice(minCol, maxCol));
    }
    return texts.join('\n');
  }
  getTextFromRange(range: OperationRange): string {
    return this.getTextInRange(range.startLine, range.startCol, range.endLine, range.endCol, { mode: range.mode });
  }
}
