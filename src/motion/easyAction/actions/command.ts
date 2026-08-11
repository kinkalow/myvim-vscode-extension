import * as vscode from 'vscode';
import { Mode, RegionInfo } from '../type';
import { chooseKeyFromInput } from '@utils/ui/input';
import { saveCursorPosition, restoreCursorPosition } from '@utils/editor/cursor';
import { copyRangeToClipboard, replaceRangeWithClipboard } from '@utils/editor/clipboard';
import { deleteRange } from '@utils/editor/deletion';
import { highlightTemporarily } from '@utils/decoration/highlight';
import { textObjects, TextObject } from '@utils/operation/operationType';
import { getOperationRange } from '@utils/operation/operation';
import { getActiveEditor } from '@utils/editor/editor';

// cとjはヒント位置に移動。それ以外は元の位置に戻る
const operators = ['c', 'd', 'j', 'p', 'S', 'y'] as const; // i,o,m,n,y,Y,' 'は使えない
type Operator = (typeof operators)[number];
const actionKeys = [
  ...operators.filter((operator) => operator !== 'j').flatMap((operator) => textObjects.map((target) => operator + target)),
  'j',
];

/**
 * ヒント位置をハイライトするためのDecorationTypeを作成する
 */
function createHighlightDecoration(): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: '#ff000088',
    border: '1px solid #ff0000',
  });
}

/**
 * 選択したヒント位置をハイライトして、ユーザーからの入力を待ち、その入力に対応するアクションをヒント位置で実行する
 */
export async function executeCommands(
  mode: Mode,
  mainOperator: Operator,
  region: RegionInfo,
  textObject?: TextObject,
): Promise<void> {
  const editor = getActiveEditor();

  let input;
  if (textObject) {
    input = { key: textObject, number: 1 };
  } else {
    // ヒント位置をハイライト
    const highlightPos = new vscode.Position(region.line, region.col);
    const highlightPosPlus1 = new vscode.Position(region.line, region.col + 1);
    const highlightRange = new vscode.Range(highlightPos, highlightPosPlus1);
    const decoration = createHighlightDecoration();
    editor.setDecorations(decoration, [highlightRange]);
    // アクションキーを選択
    const newActionKeys = actionKeys.concat(textObjects); // ia, iwなどを追加。mainOperatorの省略のため
    input = await chooseKeyFromInput(newActionKeys);
    // ヒントのハイライトを消す
    editor.setDecorations(decoration, []);
    decoration.dispose();
    // アクションキーの調整
    if (!input.key) return;
  }

  const command = textObjects.includes(input.key as TextObject) ? mainOperator + input.key : input.key; // 省略したmainOperatorを追加
  const count = input.number;
  const inputOperator = command[0];

  //
  // ヒント位置に移動してアクションを実行
  //

  const savedPos = saveCursorPosition();

  // ヒント位置に移動
  let pos = new vscode.Position(region.line, region.col);
  editor.selection = new vscode.Selection(pos, pos);

  // アクション範囲を取得
  const range = await getOperationRange(command.slice(1), count);

  if (inputOperator === 'j') return;

  // 元の位置に戻る
  if (inputOperator !== 'c') restoreCursorPosition(savedPos);

  if (!range) return;

  if (['p', 'S', 'y'].includes(inputOperator)) highlightTemporarily(range);
  if (['c', 'd', 'p', 'y'].includes(inputOperator)) await copyRangeToClipboard(range);
  //
  if (['c', 'd'].includes(inputOperator)) {
    await deleteRange(range);
    if (mode === 'n' && inputOperator === 'c') await vscode.commands.executeCommand('vim.remap', { after: ['i'] });
  } else if (inputOperator === 'S') {
    // const text = getTextInRange(range);
    await replaceRangeWithClipboard(range);
    // await vscode.env.clipboard.writeText(text);
  } else if (inputOperator === 'p') {
    if (mode === 'n') await vscode.commands.executeCommand('vim.remap', { after: ['m', '`', 'i', '<C-v>', '<Esc>', '`', '`'] });
    else if (mode === 'i') await vscode.commands.executeCommand('vim.remap', { after: ['<C-v>'] });
  }
}

export async function executeYank(mode: Mode, region: RegionInfo, textObject?: TextObject): Promise<void> {
  executeCommands(mode, 'y', region, textObject);
}

export async function executePaste(mode: Mode, region: RegionInfo, textObject?: TextObject): Promise<void> {
  executeCommands(mode, 'p', region, textObject);
}
