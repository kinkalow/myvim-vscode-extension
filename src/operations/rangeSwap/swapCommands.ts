import * as vscode from 'vscode';
import { calcNewSwapRange, highlightSwapRange, legacyRangeToSwapRange, isLineBasedSelection } from './swapUtils';
import { swapRegionHighlightStyle1, swapRegionHighlightStyle2 } from './swapConfig';
import { textObjects } from '@utils/operation/operationType';
import { getOperationRange } from '@utils/operation/operation';
import { chooseKeyFromInput } from '@utils/ui/input';
import { getTextInRange } from '@utils/editor/document';
import { registerRepeatableCommand } from '@utils/repeat';
import { getVisualRange, VisualRange } from '@utils/visualModeHelper/visualMode';
import { swapSelections } from './swapCore';

// ----------------------------------------------------------------------
// 領域保存
// ----------------------------------------------------------------------

let savedRange: VisualRange | null = null;

export function getSavedRange(): VisualRange | null {
  return savedRange;
}

// ----------------------------------------------------------------------
// Normal mode
// ----------------------------------------------------------------------

type TextObjInput = {
  textObj: string;
  count: number;
};

async function getTextObj(): Promise<TextObjInput | null> {
  const result = await chooseKeyFromInput(textObjects);
  if (result.key === '') return null;
  return { textObj: result.key, count: result.number };
}

async function getSwapLegacyRange(
  textObjInput: TextObjInput,
): Promise<{ startLine: number; startCol: number; endLine: number; endCol: number } | null> {
  const range = await getOperationRange(textObjInput.textObj, textObjInput.count);
  if (!range) return null;
  return range;
}

export async function saveRange(): Promise<void> {
  const textObj = await getTextObj();
  if (textObj === null) return;
  const legacyRange = await getSwapLegacyRange(textObj);
  if (legacyRange === null) return;
  const text = getTextInRange(legacyRange);
  const isLineBased = isLineBasedSelection({ ...legacyRange, text });
  savedRange = legacyRangeToSwapRange({ ...legacyRange, text }, isLineBased);
  highlightSwapRange(savedRange, swapRegionHighlightStyle1);
  registerRepeatableCommand(() => swapRange(textObj));
}

export async function swapRange(textObjArg?: TextObjInput): Promise<void> {
  if (!savedRange) return;
  const textObj = textObjArg ?? (await getTextObj());
  if (textObj === null) return;
  const legacyRange = await getSwapLegacyRange(textObj);
  if (legacyRange === null) return;
  const text = getTextInRange(legacyRange);
  const isLineBased = isLineBasedSelection({ ...legacyRange, text });
  const currentRange = legacyRangeToSwapRange({ ...legacyRange, text }, isLineBased);
  const savedRangeBeforeSwap = savedRange;
  await swapSelections(savedRange, currentRange);
  savedRange = calcNewSwapRange(savedRangeBeforeSwap, currentRange);
  const newRange = calcNewSwapRange(currentRange, savedRangeBeforeSwap);
  highlightSwapRange(savedRange!, swapRegionHighlightStyle1);
  highlightSwapRange(newRange, swapRegionHighlightStyle2);
}

// ----------------------------------------------------------------------
// Visual mode
// ----------------------------------------------------------------------

export async function saveRangeVisual(): Promise<void> {
  const range = getVisualRange();
  if (!range) return;
  savedRange = range;
  highlightSwapRange(range, swapRegionHighlightStyle1);
  await vscode.commands.executeCommand('vim.remap', { after: ['<Esc>'] });
}

export async function SwapRangeVisual(): Promise<void> {
  if (!savedRange) return;
  const range = getVisualRange();
  if (!range) return;
  const savedRangeBeforeSwap = savedRange;
  await swapSelections(savedRange, range);
  savedRange = calcNewSwapRange(savedRangeBeforeSwap, range);
  const newRange = calcNewSwapRange(range, savedRangeBeforeSwap);
  highlightSwapRange(savedRange!, swapRegionHighlightStyle1);
  highlightSwapRange(newRange, swapRegionHighlightStyle2);
  await vscode.commands.executeCommand('vim.remap', { after: ['<Esc>'] });
}
