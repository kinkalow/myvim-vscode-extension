import * as vscode from 'vscode';
import { OperationRange } from '@utils/operation/operationType';

export class ClipboardHelper {
  constructor(private readonly editor: vscode.TextEditor) {}

  /** 指定範囲のテキストをクリップボードにコピーする */
  async copy(startLine: number, startCol: number, endLine: number, endCol: number): Promise<void> {
    const editor = this.editor;
    const start = new vscode.Position(startLine, startCol);
    const end = new vscode.Position(endLine, endCol + 1);
    const vscodeRange = new vscode.Range(start, end);
    const text = editor.document.getText(vscodeRange);
    await vscode.env.clipboard.writeText(text);
  }
  async copyRange(range: OperationRange): Promise<void> {
    this.copy(range.startLine, range.startCol, range.endLine, range.endCol);
  }

}
