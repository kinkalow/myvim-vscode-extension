import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor';
import { searchHistory } from '@utils/SearchHistory';

/** Insert Mode用。選択検索文字列を挿入する */
export async function insertSearchMatch(): Promise<void> {
  const searchText = searchHistory.get();
  if (!searchText) return;

  const editor = getActiveEditor();
  const position = editor.selection.active;
  await editor.edit((editBuilder) => {
    editBuilder.insert(position, searchText);
  });

  const newPosition = position.translate(0, searchText.length);
  editor.selection = new vscode.Selection(newPosition, newPosition);
}
