import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';

export async function substituteUnderCursor() {
  const editor = getActiveEditor();

  // カーソル下の単語を取得
  const position = editor.selection.active;
  const wordRange = editor.document.getWordRangeAtPosition(position);
  if (!wordRange) return;
  const word = editor.document.getText(wordRange);

  // :%s/\<word\>/word/gc の文字列を作成
  const substituteCmd = `:%s/\\<${word}\\>/${word}/gc`;

  // VSCodeVimのコマンドラインに入力
  await vscode.commands.executeCommand('vim.remap', {
    after: substituteCmd.split('').concat(['<left>', '<left>', '<left>']),
  });
}
