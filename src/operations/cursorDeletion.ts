import * as vscode from 'vscode';
import { isEndOfLine } from '@utils/editor/cursor';

/**
 * カーソル左側に向かって削除
 * 1. まず空白をすべて削除
 * 2. 次にpatternにマッチする文字を後方から連続して削除（他の文字に出会ったらストップ）
 * 2. もしpattern以外の文字から始まったら、pattern以外を削除。もし空白に出会ったらそこでストップ
 */
export async function deleteBackWord(args: { pattern: string }): Promise<void> {
  const { pattern } = args;

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line);
  const text = line.text;
  const col = position.character;

  if (col === 0) return;

  const regex = new RegExp(pattern);
  const reSpace = /\s/;

  let deleteStart = col;

  // Step 1: 空白を後方から削除
  while (deleteStart > 0 && reSpace.test(text[deleteStart - 1])) {
    deleteStart--;
  }

  if (deleteStart > 0) {
    const charBeforeCursor = text[deleteStart - 1];
    if (regex.test(charBeforeCursor)) {
      // Step 2: patternにマッチする文字を後方から削除
      while (deleteStart > 0 && regex.test(text[deleteStart - 1])) {
        deleteStart--;
      }
    } else {
      // Step 3: pattern以外の文字を後方から削除（空白に出会ったらストップ）
      while (deleteStart > 0 && !regex.test(text[deleteStart - 1]) && !reSpace.test(text[deleteStart - 1])) {
        deleteStart--;
      }
    }
  }

  const deleteCount = col - deleteStart;
  if (deleteCount === 0) return;

  await vscode.commands.executeCommand('hideSuggestWidget');

  const padding = isEndOfLine() ? ' ' : '';
  await vscode.commands.executeCommand('vim.remap', {
    after: [padding, '<Esc>', ...Array.from(`${col + 1}`), '|', 'd', ...Array.from(`${deleteStart + 1}`), '|', 'i'],
  });
}

/**
 * カーソル右側に向かって削除
 * 1. まず空白をすべて削除
 * 2. 次にpatternにマッチする文字を連続して削除（他の文字に出会ったらストップ）
 * 3. もしpattern以外の文字から始まったら、pattern以外を削除。もし空白に出会ったらそこでストップ
 */
export async function deleteForwardWord(args: { pattern: string }): Promise<void> {
  const { pattern } = args;

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line);
  const text = line.text;
  const col = position.character;

  if (col >= text.length) return;

  const regex = new RegExp(pattern);
  const reSpace = /\s/;

  let deleteEnd = col;

  // Step 1: 空白を前方から削除
  while (deleteEnd < text.length && reSpace.test(text[deleteEnd])) {
    deleteEnd++;
  }

  if (deleteEnd < text.length) {
    const charAtCursor = text[deleteEnd];
    if (regex.test(charAtCursor)) {
      // Step 2: patternにマッチする文字を前方から削除
      while (deleteEnd < text.length && regex.test(text[deleteEnd])) {
        deleteEnd++;
      }
    } else {
      // Step 3: pattern以外の文字を前方から削除（空白に出会ったらストップ）
      while (deleteEnd < text.length && !regex.test(text[deleteEnd]) && !reSpace.test(text[deleteEnd])) {
        deleteEnd++;
      }
    }
  }

  const deleteCount = deleteEnd - col;
  if (deleteCount === 0) return;

  await vscode.commands.executeCommand('hideSuggestWidget');

  const eolAdjust = deleteEnd === text.length ? '<Right>' : '';
  await vscode.commands.executeCommand('vim.remap', {
    after: ['<Esc>', ...Array.from(`${col + 1}`), '|', 'd', ...Array.from(`${deleteEnd + 1}`), '|', 'i', eolAdjust],
  });
}
