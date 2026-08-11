import * as vscode from 'vscode';
import { chooseKeyFromInput, chooseKeyFromQuickPick } from '@utils/ui/input';
import { textObjects, TextObject } from '@utils/operation/operationType';
import { getOperationRange, operateOnRange } from '@utils/operation/operation';
import { invokeWithVimCount } from '@utils/vimcount';
import { registerRepeatableCommand } from '@utils/repeat';
import { yankStock } from '@utils/yankStock';
import { quickPickHelper } from '@utils/ui/QuickPickHelper';
import { getActiveEditor } from '@utils/editor';

const modes = ['i', 'n', 'v'] as const;
const operators = ['p'] as const;
type Operator = (typeof operators)[number];
type Mode = (typeof modes)[number];

/**
 * yankストックに保存したテキストでtextObjectの範囲を置換する
 */
async function replaceWithYankStockImpl(
  count: number,
  args: {
    mode: Mode;
    operator: Operator;
    repeatCount?: number;
    lastCount?: number;
    lastTextObject?: TextObject;
  },
): Promise<void> {
  const { mode, operator, repeatCount = 0, lastTextObject, lastCount } = args;
  const copied = await yankStock.copyToClipboard(count === 1 ? 1 : count - 1);
  if (!copied) return;
  let textObject: string;
  let operationCount: number;
  if (lastTextObject && lastCount) {
    textObject = lastTextObject;
    operationCount = lastCount;
  } else {
    const result = await chooseKeyFromQuickPick([...textObjects, ...textObjects.map((t) => `@${t}`)]);
    textObject = result.key;
    operationCount = result.number;
    if (textObject === '') return;
    else if (textObject[0] === '@') {
      const number = await quickPick();
      if (number === null) return;
      textObject = textObject.slice(1);
      const copied = await yankStock.copyToClipboard(number === 1 ? 1 : number - 1);
      if (!copied) return;
    }
  }
  const range = await getOperationRange(textObject!, operationCount!);
  if (range === null) return;
  if (repeatCount === 0)
    registerRepeatableCommand(({ repeatCount }) =>
      replaceWithYankStockImpl(count, { ...args, repeatCount, lastTextObject: textObject as TextObject, lastCount: operationCount }),
    );
  operateOnRange(mode, operator, range, repeatCount);
}

async function quickPick(): Promise<number | null> {
  const items = yankStock.getAll();
  const item = await quickPickHelper.pick(
    items.map((item, index) => ({ label: `${index + 1}`, description: `${item}` })),
    { canSelectMany: false, acceptWhenOneMatch: true },
  );
  if (!item) return null;
  return Number(item[0].label);
}

export async function replaceWithYankStock(args: { mode: Mode; operator: Operator }): Promise<void> {
  await invokeWithVimCount(replaceWithYankStockImpl, args);
}

/**
 * yankストックに保存したテキストを貼り付ける
 * Insert Modeで使用
 */
export async function pasteFromYankStock(): Promise<void> {
  const text = await getTextFromYankStock();
  if (text === null) return;
  const editor = getActiveEditor();
  const position = editor.selection.active;
  await editor.edit((editBuilder) => {
    editBuilder.insert(position, text);
  });
}

async function getTextFromYankStock(): Promise<string | null> {
  const items = yankStock.getAll();
  const item = await quickPickHelper.pick(
    items.map((item, index) => ({ label: `${index + 1}`, description: `${item}` })),
    { canSelectMany: false, acceptWhenOneMatch: true },
  );
  if (!item) return null;
  return item[0].description;
}
