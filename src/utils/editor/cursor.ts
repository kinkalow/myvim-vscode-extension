import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';
import { getLineInfo } from '@utils/editor/line';
import { waitForSelectionSettled } from '@utils/wait';

/**
 * カーソルが現在行の行末にあるかを返す
 */
export function isEndOfLine(): boolean {
  const editor = getActiveEditor();
  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line);
  return position.character >= line.text.length;
}

/**
 * カーソルが現在行の先頭にあるかを返す
 */
export function isStartOfLine(): boolean {
  const editor = getActiveEditor();
  const position = editor.selection.active;
  return position.character === 0;
}

// --------------------------------------------------------------------------------------------------
// カーソル位置を移動する
// --------------------------------------------------------------------------------------------------

export function setCursorPosition(line: number, col: number): void {
  const editor = getActiveEditor();
  const pos = new vscode.Position(line, col);
  editor.selection = new vscode.Selection(pos, pos);
}

export async function setCursorPositionDeferred(line: number, col: number): Promise<void> {
  await waitForSelectionSettled();
  setCursorPosition(line, col);
}

export async function setCursorPositionByVimRemap(line: number, col: number): Promise<void> {
  await vscode.commands.executeCommand('vim.remap', { after: [createCursorMoveCommand(line, col)] });
}

export function createCursorMoveCommand(line: number, col: number): string[] {
  const currentLine = getLineInfo().line;
  const distanceLine = Math.abs(currentLine - line);
  const lineCommand = currentLine - line === 0 ? '' : currentLine - line > 0 ? `${distanceLine}k` : `${distanceLine}j`;
  const colCommand = `${col + 1}|`;
  const command = [...lineCommand, ...colCommand];
  return command;
}

// --------------------------------------------------------------------------------------------------
// カーソル位置の保存と復元
// --------------------------------------------------------------------------------------------------

export function saveCursorPosition(): { editor: vscode.TextEditor; line: number; col: number } {
  const info = getLineInfo();
  return { editor: info.editor, line: info.line, col: info.col };
}

export function restoreCursorPosition(savedPosition: { editor: vscode.TextEditor; line: number; col: number }): void {
  const pos = new vscode.Position(savedPosition.line, savedPosition.col);
  savedPosition.editor.selection = new vscode.Selection(pos, pos);
}
