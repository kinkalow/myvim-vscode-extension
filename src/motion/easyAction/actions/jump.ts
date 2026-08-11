import * as vscode from 'vscode';
import { RegionInfo } from '../type';
import { setCursorPositionDeferred } from '@utils/editor/cursor';
import { getActiveEditor } from '@utils/editor/editor';

/**
 * 選択したHintの位置に移動する
 */
export function executeJump(target: RegionInfo): void {
  // const editor = getActiveEditor();
  // const targetPos = new vscode.Position(target.line, target.col);
  // editor.selection = new vscode.Selection(targetPos, targetPos);
  // editor.revealRange(new vscode.Range(targetPos, targetPos));
  setCursorPositionDeferred(target.line, target.col);
  // カーソル移動時に必要ならスクロールする
  const editor = getActiveEditor();
  const pos = new vscode.Position(target.line, target.col);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.Default);
}
