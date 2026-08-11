import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';

export function getTextInRange(
  range: { startLine: number; startCol: number; endLine: number; endCol: number },
  { editor }: { editor?: vscode.TextEditor } = {},
): string {
  const newEditor = editor ?? getActiveEditor();
  const text = newEditor.document.getText(new vscode.Range(range.startLine, range.startCol, range.endLine, range.endCol + 1));
  return text;
}
