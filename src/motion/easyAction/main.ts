import * as vscode from 'vscode';
import { Mode, ActionKind, HintKind, modes, hints, actionKinds } from './type';
import { pickRegion } from './hints';
import { getWordRegions } from './regions/word';
import { getSymbolRegions} from './regions/symbol';
import { getTwoCharMatchRegions } from './regions/twoChar';
import { executeJump } from './actions/jump';
import { executePaste, executeYank } from './actions/command';
import { validateIncludes } from '@utils/validation/args';
import { TextObject, textObjects } from '@utils/operation/operationType';

/**
 * motion のエントリーポイント
 * @param hintType 対象の種類: word, symbol
 * @param actionKind 実行するアクション: jump, copyWord, copyRange, yankInner, yankOuter
 * @param textObject ヒント選択後に入力するtextObject。例：ia, oaなど
 */
export async function easyAction(args: { mode: Mode; hintKind: HintKind; actionKind: ActionKind, textObject?: TextObject }): Promise<void> {
  const { mode, hintKind, actionKind, textObject } = args;
  if (!validateIncludes(mode, modes, 'mode')) return;
  if (!validateIncludes(hintKind, hints, 'hint')) return;
  if (!validateIncludes(actionKind, actionKinds, 'action')) return;
  if (textObject && !validateIncludes(textObject, textObjects, 'textObject')) return;

  let regions;
  if (hintKind === 'word') regions = getWordRegions();
  else if (hintKind === 'twoChar') regions = await getTwoCharMatchRegions();
  else if (hintKind === 'symbol') regions = getSymbolRegions();
  else {
    vscode.window.showErrorMessage(`[エラー] hintKindは次から指定: word, symbol`);
    return;
  }
  if(!regions) return;

  const selected = await pickRegion(regions);
  if (!selected) return;

  switch (actionKind) {
    case 'jump':
      await executeJump(selected);
      break;

    case 'paste':
      await executePaste(mode, selected, textObject);
      break;

    case 'yank':
      await executeYank(mode, selected, textObject);
      break;
  }
}
