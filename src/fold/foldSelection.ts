import * as vscode from 'vscode';
import { getSelectionLineRange } from '@utils/editor/line';

/**
 * 選択領域を折り畳む。Visulモードで使用 
 */
export async function foldSelection(): Promise<void> {
  const range = getSelectionLineRange();
  const startLine = range.startLine;
  const endLine = range.endLine;
  if (startLine === endLine) return;
  const lineCount = endLine - startLine;
  await vscode.commands.executeCommand('vim.remap', {
    after: ['<Esc>', ...`${startLine + 1}`, 'G', 'z', 'f', ...`${lineCount}`, 'j'],
  });
}
