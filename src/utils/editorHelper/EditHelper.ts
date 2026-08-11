import * as vscode from 'vscode';
import { OperationRange } from '@utils/operation/operationType';

export class EditHelper {
  constructor(private readonly editor: vscode.TextEditor) {}

  /** 指定範囲のテキストを削除する */
  async delete(startLine: number, startCol: number, endLine: number, endCol: number): Promise<void> {
    const vscodeRange = new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol + 1));
    await this.editor.edit((editBuilder) => {
      editBuilder.delete(vscodeRange);
    });
  }
  async deleteRange(range: OperationRange): Promise<void> {
    this.delete(range.startLine, range.startCol, range.endLine, range.endCol);
  }

  async insert(line: number, col: number, text: string): Promise<void> {
    const vscodePos = new vscode.Position(line, col);
    await this.editor.edit((editBuilder) => {
      editBuilder.insert(vscodePos, text);
    });
  }

  /** 置換の実装 */
  async replace(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    text: string,
  ): Promise<{ startLine: number; startCol: number; endLine: number; endCol: number }> {
    const start = new vscode.Position(startLine, startCol);
    const end = new vscode.Position(endLine, endCol + 1);
    const vscodeRange = new vscode.Range(start, end);
    const success = await this.editor.edit((editBuilder) => {
      editBuilder.replace(vscodeRange, text);
    });
    if (!success) throw new Error('[エラー] クリップボードの内容で置き換えに失敗しました');
    // 置換後の範囲計算
    const lines = text.split('\n');
    const newEndLine = startLine + lines.length - 1;
    const newEndCol = lines.length === 1 ? startCol + lines[0].length - 1 : lines[lines.length - 1].length - 1;
    return { startLine, startCol, endLine: newEndLine, endCol: newEndCol };
  }
  /** Rangeの範囲をtextで置き換え、置換後の範囲を返す。【注意】返り値は範囲を修正しただけでmodeは変更していない */
  async replaceRange(range: OperationRange, text: string): Promise<OperationRange> {
    const replaced = await this.replace(range.startLine, range.startCol, range.endLine, range.endCol, text);
    return { ...replaced, mode: range.mode };
  }
  /** Rangeの範囲をクリップボードのテキストで置き換え、置換後の範囲を返す。【注意】返り値は範囲を修正しただけでmodeは変更していない */
  async replaceRangeWithClipboard(range: OperationRange): Promise<OperationRange> {
    const text = await vscode.env.clipboard.readText();
    return await this.replaceRange(range, text);
  }
}
