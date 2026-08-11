import * as vscode from 'vscode';
import { RegionInfo } from '../type';
import { SymbolRegionInfo } from '../regions/symbol';

/**
 * ターゲットのrangeのテキストをクリップボードにコピーする（移動なし）
 */
export async function executeCopyRange(
  editor: vscode.TextEditor,
  region: RegionInfo,
): Promise<void> {
  const text = editor.document.getText(region.range);
  await vscode.env.clipboard.writeText(text);
}

/**
 * 囲みの内側をクリップボードにコピーする（symbolを含まない・移動なし）
 */
export async function executeCopyInner(
  editor: vscode.TextEditor,
  region: SymbolRegionInfo,
): Promise<void> {
  const text = editor.document.getText(region.range); // rangeは内側
  await vscode.env.clipboard.writeText(text);
}

/**
 * 囲みの外側をクリップボードにコピーする（symbolを含む・移動なし）
 */
export async function executeCopyOuter(
  editor: vscode.TextEditor,
  region: SymbolRegionInfo,
): Promise<void> {
  const text = editor.document.getText(region.outerRange); // outerRangeは外側
  await vscode.env.clipboard.writeText(text);
}
