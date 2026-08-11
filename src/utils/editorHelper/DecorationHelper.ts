import * as vscode from 'vscode';
import { DEFAULT_HIGHLIGHT_STYLE } from './config';
import { VisualMode } from './type';
import { OperationRange } from '@utils/operation/operationType';
import { sleep } from '@utils/async/sleep';

export class DecorationHelper {
  constructor(private readonly editor: vscode.TextEditor) {}

  /** 指定範囲のテキストをハイライトする */
  highlight(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    { mode = 'char', style = DEFAULT_HIGHLIGHT_STYLE }: { mode?: VisualMode; style?: vscode.DecorationRenderOptions } = {},
  ): vscode.TextEditorDecorationType {
    const decoration = vscode.window.createTextEditorDecorationType(style);
    let vscodeRanges;
    if (mode === 'block') {
      vscodeRanges = Array.from(
        { length: endLine - startLine + 1 },
        (_, i) => new vscode.Range(new vscode.Position(startLine + i, startCol), new vscode.Position(startLine + i, endCol + 1)),
      );
    } else {
      vscodeRanges = [new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol + 1))];
    }
    this.editor.setDecorations(decoration, vscodeRanges);
    return decoration;
  }

  /** 指定範囲のテキストを一時的にハイライトする */
  async flash(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    {
      mode = 'char',
      duration = 1000,
      style = DEFAULT_HIGHLIGHT_STYLE,
    }: { mode?: VisualMode; duration?: number; style?: vscode.DecorationRenderOptions } = {},
  ): Promise<void> {
    const decoration = this.highlight(startLine, startCol, endLine, endCol, { mode, style });
    await sleep(duration);
    this.editor.setDecorations(decoration, []);
    decoration.dispose();
  }
  async flashRange(
    range: OperationRange,
    { duration = 1000, style = DEFAULT_HIGHLIGHT_STYLE }: { duration?: number; style?: vscode.DecorationRenderOptions } = {},
  ): Promise<void> {
    this.flash(range.startLine, range.startCol, range.endLine, range.endCol, { mode: range.mode, duration, style });
  }

  /** ハイライトを削除する */
  clear(decoration: vscode.TextEditorDecorationType | vscode.TextEditorDecorationType[]): void {
    if (Array.isArray(decoration)) {
      for (const dec of decoration) {
        this.editor.setDecorations(dec, []);
        dec.dispose();
      }
    } else {
      this.editor.setDecorations(decoration, []);
      decoration.dispose();
    }
  }
}
