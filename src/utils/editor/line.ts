import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';

/**
 * 現在の行と列の情報を返す
 * @returns
 *   - editor 現在のアクティブエディタ
 *   - text 現在行のテキスト
 *   - line 現在の行数
 *   - col カーソル位置の列番号
 */
export function getLineInfo({ editor }: { editor?: vscode.TextEditor } = {}): {
  editor: vscode.TextEditor;
  text: string;
  line: number;
  col: number;
} {
  const newEditor = editor ?? getActiveEditor();
  const position = newEditor.selection.active;
  const line = position.line;
  return {
    editor: newEditor,
    text: newEditor.document.lineAt(line).text,
    line,
    col: position.character,
  };
}

/**
 * 選択領域のstartとendの行数を返す
 * @returns { startLine, endLine }
 */
export function getSelectionLineRange(): { startLine: number; endLine: number } {
  const editor = getActiveEditor();
  const selections = editor.selections;
  const startLine = Math.min(...selections.map((s) => s.start.line));
  const endLine = Math.max(...selections.map((s) => s.end.line));
  return { startLine, endLine };
}
