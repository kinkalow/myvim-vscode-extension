import * as vscode from 'vscode';

/** テキストを削除するときのハイライト時間 */
export const DELETION_HIGHLIGHT_DURATION = 200;

/** カーソル */
export const CURSOR_HIGHLIGHT_STYLE: vscode.DecorationRenderOptions = {
  color: 'rgba(0, 0, 0, 0.4)',
  backgroundColor: new vscode.ThemeColor('editorCursor.foreground'),
  border: `1px solid ${new vscode.ThemeColor('editorCursor.background')}`,
};

/** 検索時 */
export const SEARCH_HIGHLIGHT_STYLE: vscode.DecorationRenderOptions = {
  backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
  border: `1px solid ${new vscode.ThemeColor('editor.findMatchHighlightBorder')}`,
};
