import * as vscode from 'vscode';
import { getLineInfo } from '@utils/editor/line';
import { getTextInRange } from '@utils/editor/document';

interface RepeatState {
  action: ({ repeatCount}: { repeatCount: number}) => Promise<void>;
  registeredAt: number; // 登録時刻（ミリ秒）
  line: number;
  col: number;
  insertText: string;
  repeatCount: number;
  usePositionMatch: boolean;
}

let lastAction: RepeatState | null = null;

const TIMEOUT_MS = 300 * 1000; // 5分

/**
 * リピート可能なアクションを登録する
 * @param action repeatCountを受け取り実行する処理
 */
export function registerRepeatableCommand(
  action: ({ repeatCount}: { repeatCount: number }) => Promise<void>,
  { usePositionMatch = false }: { usePositionMatch?: boolean } = {},
): void {
  const lineInfo = getLineInfo();
  lastAction = {
    action,
    registeredAt: Date.now(),
    line: lineInfo.line,
    col: lineInfo.col,
    insertText: '',
    usePositionMatch,
    repeatCount: 0,
  };
}

/**
 * 空にする
 */
export function clearRepeatState() {
  lastAction = null;
}

/**
 * vim標準のリピートを実行する
 */
export async function executeNormalRepeat(): Promise<void> {
  await vscode.commands.executeCommand('vim.remap', { after: ['<C-a>', '|', '.'] });
}

/**
 * 最後に登録したアクションを再実行する
 * 登録からTIMEOUT_MS以上経過している場合は通常のリピートを実行する
 * カーソル位置(line, col)が前回から移動していない場合のみrepeatCountを加算する。
 * 移動している場合はrepeatCountをリセットする。
 */
export async function repeatLastCommand(): Promise<void> {
  if (!lastAction) {
    await executeNormalRepeat();
    return;
  }

  const elapsed = Date.now() - lastAction.registeredAt;
  if (elapsed > TIMEOUT_MS) {
    await executeNormalRepeat();
    return;
  }

  const lineInfo = getLineInfo();
  const isSamePosition = lineInfo.line === lastAction.line && lineInfo.col === lastAction.col;
  if (lastAction.usePositionMatch) {
    lastAction.repeatCount = isSamePosition ? lastAction.repeatCount + 1 : 0;
  } else {
    lastAction.repeatCount += 1;
  }

  await lastAction.action({ repeatCount: lastAction.repeatCount });
  // if (lastAction.insertText !== '') {
  //   // ここはcオペレータによる文字を挿入する部分である
  //   // lastAction.actionは選択文字を削除するところまでしか行わないので、ここでtextを挿入する
  //   await vscode.env.clipboard.writeText(lastAction.insertText);
  //   await vscode.commands.executeCommand('vim.remap', { after: ['<C-v>', '<Esc>'] });
  // }

  // 実行後の位置を記録（次回比較用）
  const newLineInfo = getLineInfo();
  lastAction.line = newLineInfo.line;
  lastAction.col = newLineInfo.col;
  lastAction.registeredAt = Date.now();
}

// -------------------------------------------------------------------------------------------
// Operation cによるテキスト変更を再現するための関数
// -------------------------------------------------------------------------------------------

interface InsertRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

let insertRange: InsertRange | null = null;

export async function onInsertEnterFromC(line: number, col:number): Promise<void> {
  if (lastAction === null) return;
  if (lastAction.repeatCount !== 0) return;
  insertRange = {
    startLine: line,
    startCol: col,
    endLine: line,
    endCol: col,
  };
}

export async function onInsertLeaveFromC(): Promise<void> {
  if (insertRange === null) return;
  if (lastAction === null) return;
  const lineInfo = getLineInfo();
  insertRange.endLine = lineInfo.line;
  insertRange.endCol = lineInfo.col - 1;
  lastAction.insertText = insertRange.startLine === insertRange.endLine ? getTextInRange(insertRange) : '';
  insertRange = null;
}

export function getInsertText(): string {
  return lastAction === null ? '' : lastAction.insertText;
}
