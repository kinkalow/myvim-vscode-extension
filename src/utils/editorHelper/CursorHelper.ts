import * as vscode from 'vscode';
import { waitForSelectionSettled } from '@utils/wait';

export class CursorHelper {
  constructor(private readonly editor: vscode.TextEditor) {}

  /** カーソルの位置を返す */
  get(): { line: number; col: number } {
    const pos = this.editor.selection.active;
    return { line: pos.line, col: pos.character };
  }

  /** カーソルの位置を(line, col)に移動する。deferred=trueでselection変更中は待機する
   * @param wait カーソル移動の前や後でselectionの変更を待つ。before, after, bothが選べる
   * @param moveToPreviousChar (line, col)の１文字手前に移動する
   * @param revealIfOutsideViewport 表示領域外なら中央に表示をする
   */
  async set(
    line: number,
    col: number,
    options?: { wait?: 'before' | 'after' | 'both'; moveToPreviousChar?: boolean; revealIfOutsideViewport?: boolean },
  ): Promise<void> {
    if (options?.wait === 'before' || options?.wait === 'both') await waitForSelectionSettled();
    if (options?.moveToPreviousChar) {
      // (line, col)の手前位置を取得
      if (col > 0) {
        col--;
      } else if (line > 0) {
        line--;
        col = this.editor.document.lineAt(line).text.length;
      }
    }

    const pos = new vscode.Position(line, col);
    this.editor.selection = new vscode.Selection(pos, pos);

    if (options?.revealIfOutsideViewport) {
      // 表示領域外なら中央表示
      const isVisible = this.editor.visibleRanges.some((range) => range.contains(pos));
      if (!isVisible) {
        this.editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    }
    if (options?.wait === 'after' || options?.wait === 'both') await waitForSelectionSettled();
  }
}
