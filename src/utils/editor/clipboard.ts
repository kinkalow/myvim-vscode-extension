import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';

/**
 * 指定した範囲のテキストをクリップボードにコピーする
 * @param range コピー範囲
 */
export async function copyRangeToClipboard(range: {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}): Promise<void> {
  const editor = getActiveEditor();
  const start = new vscode.Position(range.startLine, range.startCol);
  const end = new vscode.Position(range.endLine, range.endCol + 1);
  const vscodeRange = new vscode.Range(start, end);
  const text = editor.document.getText(vscodeRange);
  await vscode.env.clipboard.writeText(text);
}

/**
 * 指定範囲をtextで置き換え、置き換え後の範囲を返す（実装）
 */
async function replaceRangeImpl(
  range: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  },
  text: string,
): Promise<{ startLine: number; startCol: number; endLine: number; endCol: number }> {
  const start = new vscode.Position(range.startLine, range.startCol);
  const end = new vscode.Position(range.endLine, range.endCol + 1);
  const vscodeRange = new vscode.Range(start, end);

  const editor = getActiveEditor();
  const success = await editor.edit((editBuilder) => {
    editBuilder.replace(vscodeRange, text);
  });
  if (!success) throw new Error('[エラー] クリップボードの内容で置き換えに失敗しました');

  // 置き換え後の範囲を計算
  const lines = text.split('\n');
  const endLine = range.startLine + lines.length - 1;
  const endCol = lines.length === 1 ? range.startCol + lines[0].length - 1 : lines[lines.length - 1].length - 1;

  return {
    startLine: range.startLine,
    startCol: range.startCol,
    endLine,
    endCol,
  };
}

/**
 * 指定範囲をtextの内容で置き換え、置き換え後の範囲を返す
 * @param range 置き換える範囲
 * @param text 置き換える文字列
 * @returns 置き換え後の範囲
 */
export async function replaceRangeWithText(
  range: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  },
  text: string,
): Promise<{ startLine: number; startCol: number; endLine: number; endCol: number }> {
  return await replaceRangeImpl(range, text);
}

/**
 * 指定範囲をクリップボードの内容で置き換え、置き換え後の範囲を返す
 * @param range 置き換える範囲
 * @returns 置き換え後の範囲
 */
export async function replaceRangeWithClipboard(range: {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}): Promise<{ startLine: number; startCol: number; endLine: number; endCol: number }> {
  const text = await vscode.env.clipboard.readText();
  return await replaceRangeImpl(range, text);
}
