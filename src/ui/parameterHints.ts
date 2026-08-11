import * as vscode from 'vscode';
import { EditorHelper } from '@utils/editorHelper/EditorHelper';

/** パラメータヒントを閉じてVimコマンドを実行する */
export async function closeParameterHintsThenRemap(
  keys: string | string[],
): Promise<void> {
  await vscode.commands.executeCommand('closeParameterHints');
  const helper = new EditorHelper();
  await helper.vim.remap(keys);
}