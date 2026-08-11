import * as vscode from 'vscode';

/**
 * vscode.window.activeTextEditorを返す
 */
export function getActiveEditor(): vscode.TextEditor {
  const editor = vscode.window.activeTextEditor;
  if (!editor) throw new Error('アクティブなエディタが見つかりません');
  return editor;
}