import * as vscode from 'vscode';
import { sleep } from '@utils/async/sleep';

/**
 * 指定範囲をハイライトする
 * @param range ハイライト範囲
 * @param isBlock ブロック範囲かどうか
 * @param duration ハイライト表示時間（ミリ秒）デフォルト1000ms
 * @param style デコレーションスタイル
 */
export async function highlightTemporarily(
  range: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  },
  {
    isBlock = false,
    duration = 1000,
    style = {
      backgroundColor: 'rgba(236, 38, 91, 0.4)',
      border: 'rgba(255, 255, 255, 0.8)',
    },
  }: { isBlock?: boolean; duration?: number; style?: vscode.DecorationRenderOptions } = {},
): Promise<void> {
  const { startLine, startCol, endLine, endCol } = range;

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const decoration = vscode.window.createTextEditorDecorationType(style);
  let vscodeRanges;
  if (isBlock) {
    vscodeRanges = Array.from(
      { length: endLine - startLine + 1 },
      (_, i) => new vscode.Range(new vscode.Position(startLine + i, startCol), new vscode.Position(startLine + i, endCol + 1))
    );
  } else {
    vscodeRanges = [new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol + 1))];
  }
  editor.setDecorations(decoration, vscodeRanges);
  await sleep(duration);
  editor.setDecorations(decoration, []);
  decoration.dispose();
}
