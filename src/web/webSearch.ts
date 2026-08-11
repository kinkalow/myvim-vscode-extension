import * as vscode from 'vscode';
import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';
// import { exec } from 'child_process';

/** 選択したテキストでWeb検索。Visual Modeで使用 */
export async function search(): Promise<void> {
  const visualSelection = visualModeHelper.getVisualSelection();
  if (visualSelection) {
    const selectedText = visualSelection.text.replace('\n', ' ');
    const query = encodeURIComponent(selectedText);
    const url = `https://www.google.com/search?q=${query}`;
    await vscode.env.openExternal(vscode.Uri.parse(url));
    await vscode.commands.executeCommand('vim.remap', { after: ['<Esc>'] });
  } else {
    const url = `https://www.google.com/search`;
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }
}

// async function openGoogleSearch(query?: string) {
//   const url = `https://www.google.com/search${query ? `?q=${query}` : ''}`;
//   const platform = process.platform;
//   let command = '';
//   if (platform === 'win32') {
//     command = `start "" "${url}"`;
//   } else if (platform === 'darwin') {
//     command = `open "${url}"`;
//   } else {
//     command = `xdg-open "${url}"`;
//   }
//   exec(command, (error) => {
//     if (error) {
//       vscode.window.showErrorMessage(`ブラウザを開けませんでした: ${error.message}`);
//     }
//   });
// }