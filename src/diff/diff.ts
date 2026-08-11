import * as vscode from 'vscode';
import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';
import { validateIncludes } from '@utils/validation/args';
import { invokeWithVimCount } from '@utils/vimcount';
import { EditorHelper } from '@utils/editorHelper';
import { OperationRange } from '@utils/operation/operationType';

const DIFF_TEXT_HIGHLIGHT = {
  backgroundColor: 'rgba(47, 255, 0, 0.4)',
  border: 'rgba(255, 255, 255, 0.8)',
};

class InMemoryContentProvider implements vscode.TextDocumentContentProvider {
  private contents = new Map<string, string>(); // ファイルuriとdiffのテキストを保存
  setContent(uri: vscode.Uri, content: string): void {
    this.contents.set(uri.toString(), content);
  }
  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? '';
  }
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>(); // ファイルの中身が書き換わったことをVS Codeに知らせる
  readonly onDidChange = this._onDidChange.event;
}

const SCHEME = 'myvim-diff-diffSelections';
const provider = new InMemoryContentProvider();

async function diff(text1: string, text2: string): Promise<void> {
  const uri1 = vscode.Uri.parse(`${SCHEME}:/selection1.txt?${Date.now()}-1`);
  const uri2 = vscode.Uri.parse(`${SCHEME}:/selection2.txt?${Date.now()}-2`);
  provider.setContent(uri1, text1);
  provider.setContent(uri2, text2);
  await vscode.commands.executeCommand('vscode.diff', uri1, uri2, 'Diff (Selections)');
}

/** 独自の仮想ファイルシステムを登録し、不要になったら自動で片付ける仕組み
 * これによりdiffで比較する際、ファイルに保存しなくて済む
 */
export function registerDiff(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider));
}

/** Normalモードでは空行で囲まれた範囲のテキストを返す
 * Visualモードでは選択領域のテキストを返す
 */
async function getDiffText() {
  const visusalSelection = visualModeHelper.getVisualSelection();
  const helper = new EditorHelper();
  let text, range: OperationRange;
  if (visusalSelection) {
    await helper.vim.remap('<Esc>', {wait: 'after'});
    const mode = visualModeHelper.getLastMode();
    range = { ...visusalSelection, mode };
    text = visusalSelection.text;
  } else {
    const { startLine, endLine } = helper.document.findBlankLineBoundaries();
    const endCol = helper.document.getLineText(endLine).length - 1;
    range = { startLine, startCol: 0, endLine, endCol, mode: 'line' };
    text = helper.document.getTextFromRange(range);
  }
  helper.decoration.flashRange(range, { style: DIFF_TEXT_HIGHLIGHT });
  return text;
}

let diffText1: string = '';
let diffText2: string = '';

async function saveDiffText1() {
  diffText1 = await getDiffText();
}

async function saveDiffText2() {
  diffText2 = await getDiffText();
}

async function saveDiffText1AndDiff() {
  diffText1 = await getDiffText();
  diff(diffText1, diffText2);
}

async function saveDiffText2AndDiff() {
  diffText2 = await getDiffText();
  diff(diffText1, diffText2);
}

function diffSavedText() {
  diff(diffText1, diffText2);
}

export async function actionImpl(count: number, args: { action: string }) {
  validateIncludes(
    args.action,
    ['saveDiffText1', 'saveDiffText2', 'saveDiffText1AndDiff', 'saveDiffText2AndDiff', 'diffSavedText'],
    'action',
  );
  if (args.action === 'saveDiffText1') await saveDiffText1();
  else if (count === 4 || args.action === 'saveDiffText2') await saveDiffText2();
  else if (count === 3 || args.action === 'saveDiffText1AndDiff') await saveDiffText1AndDiff();
  else if (count === 2 || args.action === 'saveDiffText2AndDiff') await saveDiffText2AndDiff();
  else if (count === 5 || args.action === 'diffSavedText') diffSavedText();
}

export async function action(args: { action: string }): Promise<void> {
  await invokeWithVimCount(actionImpl, args);
}
