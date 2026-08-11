import * as vscode from 'vscode';

export const openModes = ['current', 'firstGroup', 'split', 'vsplit'] as const;
export type OpenModes = (typeof openModes)[number];

interface OpenFileOptions {
  line?: number;
  col?: number;
  openMode?: OpenModes;
}

class FileHelper {
  async openFile(path: string, options: OpenFileOptions = {}) {
    const { openMode = 'current' } = options;
    const document = await vscode.workspace.openTextDocument(path);

    let line = options.line;
    let col = options.col;
    if (options.line && !options.col) col = 0;
    else if (!options.line && options.col) line = 0;
    let selection = null;
    if (line !== undefined && col !== undefined) {
      selection = new vscode.Range(line, col, line, col);
    }

    if (openMode === 'firstGroup') {
      const editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.One,
        preview: false,
      });
      // const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
      if (selection !== null) {
        editor.selection = new vscode.Selection(selection.start, selection.end);
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
      }
    } else if (openMode === 'split') {
      if (selection === null) {
        await vscode.window.showTextDocument(document, { preview: false });
        await vscode.commands.executeCommand('workbench.action.moveEditorToBelowGroup');
      }else{
        await vscode.commands.executeCommand('workbench.action.newGroupBelow');
        const editor = await vscode.window.showTextDocument(document);
        editor.selection = new vscode.Selection(selection.start, selection.end);
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
      }
    } else if (openMode === 'vsplit') {
      if (selection === null) {
        await vscode.window.showTextDocument(document, { preview: false });
        await vscode.commands.executeCommand('workbench.action.moveEditorToRightGroup');
      } else {
        await vscode.commands.executeCommand('workbench.action.newGroupRight');
        const editor = await vscode.window.showTextDocument(document);
        editor.selection = new vscode.Selection(selection.start, selection.end);
        editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
      }
    } else {
      if (selection === null) await vscode.window.showTextDocument(document, { preview: false });
      else await vscode.window.showTextDocument(document, { selection, preview: false });
    }
  }
}

export const fileHelper = new FileHelper();
