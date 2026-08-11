import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';

/**
 * 指定範囲のテキストを削除する
 * @param range 削除範囲
 */
export async function deleteRange(range: {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}): Promise<void> {
  const { startLine, startCol, endLine, endCol } = range;
  const editor = getActiveEditor();
  const vscodeRange = new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol + 1));
  await editor.edit((editBuilder) => {
    editBuilder.delete(vscodeRange);
  });
}
