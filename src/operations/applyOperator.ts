import * as vscode from 'vscode';
import { chooseKeyFromInput, chooseKeyFromQuickPick } from '@utils/ui/input';
import { textObjects, TextObject } from '@utils/operation/operationType';
import { getOperationRange, operateOnRange } from '@utils/operation/operation';
import { invokeWithVimCount } from '@utils/vimcount';
// import { highlightTemporarily } from '@utils/decoration/highlight';
import { registerRepeatableCommand } from '@utils/repeat';

const modes = ['i', 'n', 'v'] as const;
const operators = ['c', 'd', 'p', 'y'] as const;
type Operator = (typeof operators)[number];
type Mode = (typeof modes)[number];

async function applyOperatorImpl(
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
  let textObject, newCount;
  if (lastTextObject && lastCount) {
    textObject = lastTextObject;
    newCount = lastCount;
  } else if (lastTextObject) {
    textObject = lastTextObject;
    newCount = count;
  } else {
    // await vscode.commands.executeCommand('setContext', 'myvim-operations-applyOperator.applyOperatorImpl', true);
    // const result = await chooseKeyFromInput(textObjects);
    // await vscode.commands.executeCommand('setContext', 'myvim-operations-applyOperator.applyOperatorImpl', false);
    const result = await chooseKeyFromQuickPick(textObjects);
    textObject = result.key;
    newCount = result.number === 1 ? count : result.number;
    if (textObject === '') return;
  }
  const range = await getOperationRange(textObject, newCount);
  if (range === null) return;
  if (repeatCount === 0)
    registerRepeatableCommand(({ repeatCount }) =>
      applyOperatorImpl(count, { ...args, repeatCount, lastTextObject: textObject as TextObject, lastCount: newCount }),
    );
  operateOnRange(mode, operator, range, repeatCount);
}

export async function applyOperator(args: {
  mode: Mode;
  operator: Operator;
  repeatCount?: number;
  lastTextObject?: TextObject;
}): Promise<void> {
  await invokeWithVimCount(applyOperatorImpl, args);
}
