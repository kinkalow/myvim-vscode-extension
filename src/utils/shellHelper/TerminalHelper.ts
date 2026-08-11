import * as vscode from 'vscode';
import { TERMINAL_SEND_DELAY_MS } from '@utils/config/terminal';
import { sleep } from '@utils/async/sleep';
import { getActiveEditor } from '@utils/editor';

class TerminalHelper {
  private readonly terminalName = 'pwsh';

  getTerminal(): vscode.Terminal {
    return vscode.window.terminals.find((t) => t.name === this.terminalName) ?? vscode.window.createTerminal(this.terminalName);
  }

  async run(commands: string | string[], { stayTerminal = false }: { stayTerminal?: boolean } = {}): Promise<void> {
    const terminal = this.getTerminal();

    terminal.show();
    if (typeof commands === 'string') {
      terminal.sendText(`\u001be\u001bq${commands}`);
    } else {
      terminal.sendText('\u001be\u001b');
      for (const command of commands) terminal.sendText(command);
    }

    if (!stayTerminal) {
      await sleep(TERMINAL_SEND_DELAY_MS);
      const editor = getActiveEditor();
      await vscode.window.showTextDocument(editor.document, {
        viewColumn: editor.viewColumn,
        preview: false,
      });
    }
  }
}

export const terminalHelper = new TerminalHelper();
