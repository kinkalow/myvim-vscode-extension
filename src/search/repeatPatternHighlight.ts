import * as vscode from 'vscode';
import { getTextInRange } from '@utils/editor/document';
import { getLineSurroundByPattern } from '@utils/operation/range/surround/pattern';
import { validateIncludes } from '@utils/validation/args';
import {
  textPatterns as highlightPatterns,
  TextPatternName as HighlightPatternName,
  alnumPattern,
  standardPattern,
  extendedWordPattern,
  bigWordPattern,
} from '@utils/config/patterns';
import { registerRepeatableCommand } from '@utils/repeat';
import { isSameRange } from '@utils/operation/range/surround/utils';
import { OperationRange } from '@utils/operation/operationType';
import { searchHistory  } from '@utils/SearchHistory';

async function highlight(range: OperationRange, useWordBoundary: boolean = true) {
  const text = getTextInRange(range);
  const moveBeforeWord = range.startCol === 0 ? ['<Bs>'] : [...Array.from(`${range.startCol - 1}|`)];
  const startBoundary = useWordBoundary ? ['\\', '<'] : [''];
  const endBoundary = useWordBoundary ? ['\\', '>'] : [''];
  await vscode.commands.executeCommand('vim.remap', {
    after: ['m', 'Z', ...moveBeforeWord, '<C-a>', '|', '/', ...startBoundary, ...Array.from(text), ...endBoundary, '<CR>', '`', 'Z'],
  });
  searchHistory.push(text);
}

/**
 * カーソル下のpatternにマッチする文字列をハイライトする
 * @param pattern 検索用のパターン（例：[A-Za-z0-9]）
 * @returns
 */
export async function highlightPattern(pattern: HighlightPatternName): Promise<void> {
  if (!validateIncludes(pattern, Object.keys(highlightPatterns), 'pattern')) return;
  const regExpPattern = highlightPatterns[pattern];
  const range = getLineSurroundByPattern(regExpPattern);
  if (!range) return;
  await highlight(range);
}

/**
 * カーソル下のpatternにマッチする文字列をハイライトする
 * リピート入力ごとにpatternが変わるため、ハイライト領域も変化する
 */
let previousPattern = '';
export async function highlightRepeatPattern(repeatCount: number = 0): Promise<void> {
  if (repeatCount === 0)
    registerRepeatableCommand(({ repeatCount }) => highlightRepeatPattern(repeatCount), { usePositionMatch: true });
  const patterns = [standardPattern, extendedWordPattern, bigWordPattern, alnumPattern] as const;
  if (repeatCount === 0) {
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const range = getLineSurroundByPattern(pattern);
      if (range === null) continue;
      await highlight(range, pattern !== alnumPattern);
      previousPattern = pattern;
      return;
    }
  } else {
    const baseIndex = repeatCount % patterns.length;
    const previousRange = getLineSurroundByPattern(previousPattern)!;
    for (let offset = 0; offset < patterns.length; offset++) {
      const pattern = patterns[(baseIndex + offset) % patterns.length];
      const range = getLineSurroundByPattern(pattern);
      if (!range) continue;
      if (
        !isSameRange(range, previousRange) ||
        (previousPattern !== alnumPattern && pattern === alnumPattern) ||
        (previousPattern === alnumPattern && pattern !== alnumPattern)
      ) {
        await highlight(range, pattern !== alnumPattern);
        previousPattern = pattern;
        return;
      }
    }
  }
}
