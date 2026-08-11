import * as vscode from 'vscode';
import { EditorHelper } from '@utils/editorHelper/EditorHelper';

/** suggestWidgetを閉じてVimコマンドを実行する */
export async function closeSuggestWidgetThenRemap(
  keys: string | string[],
): Promise<void> {
  await vscode.commands.executeCommand('hideSuggestWidget');
  const helper = new EditorHelper();
  await helper.vim.remap(keys);
}

/**
 * サジェストウィジェットを非表示にしてvimコマンドを実行する
 * @param args.keys vim のキー列（例: ["Delete"]）
 */
// export async function hideSuggestAndRemap(args: any): Promise<void> {
//   if (!args || !args.keys) return;

//   let keys: string[] = [];

//   if (Array.isArray(args.keys)) {
//     keys = args.keys;
//   } else if (typeof args.keys === 'string') {
//     const trimmed = args.keys.trim();
//     if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
//       try {
//         const parsed = JSON.parse(trimmed);
//         keys = Array.isArray(parsed) ? parsed : [trimmed];
//       } catch {
//         keys = [args.keys];
//       }
//     } else {
//       keys = [args.keys];
//     }
//   }

//   await vscode.commands.executeCommand('hideSuggestWidget');
//   await vscode.commands.executeCommand('vim.remap', { after: keys });
// }