import * as vscode from 'vscode';
import { waitForSelectionSettled } from '@utils/wait';

export class VimHelper {
  constructor(private readonly editor: vscode.TextEditor) {}

  async remap(command: string | string[], options?: { wait?: 'before' | 'after' | 'both' }): Promise<void> {
    if (options?.wait === 'before' || options?.wait === 'both') await waitForSelectionSettled();

    let tokens: string[];
    if (typeof command === 'string') {
      tokens = [];
      let i = 0;
      while (i < command.length) {
        if (command[i] === '<') {
          const end = command.indexOf('>', i);
          if (end === -1) throw new Error('[エラー] vimRemapの<に対応する>が見つかりません');
          tokens.push(command.slice(i, end + 1));
          i = end + 1;
          continue;
        }
        tokens.push(command[i]);
        i++;
      }
    } else {
      tokens = command;
    }

    await vscode.commands.executeCommand('vim.remap', { after: tokens });

    if (options?.wait === 'after' || options?.wait === 'both') await waitForSelectionSettled();
  }
}
