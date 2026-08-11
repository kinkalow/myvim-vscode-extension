import * as vscode from 'vscode';
import { SELECTION_SETTLE_DELAY_MS } from '@utils/config/editor';

/**
 * selection変更がquietMsの間発生しなかったら終了
 */
export function waitForSelectionSettled(delayMs = SELECTION_SETTLE_DELAY_MS): Promise<void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout;
    const disposable = vscode.window.onDidChangeTextEditorSelection(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        disposable.dispose();
        resolve();
      }, delayMs);
    });
    timer = setTimeout(() => {
      disposable.dispose();
      resolve();
    }, delayMs);
  });
}
