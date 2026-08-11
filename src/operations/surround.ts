import * as vscode from 'vscode';
import {
  getSurroundByPair,
  getSurroundByPairs,
  getLineSurroundByPattern,
  getTagRanges,
} from '@utils/operation/range/surround/index';
import { alnumPattern, standardPattern, extendedWordPattern, bigWordPattern } from '@utils/config/patterns';
import { DELETION_HIGHLIGHT_DURATION } from '@utils/config/highlight';
import { EditorHelper } from '@utils/editorHelper/EditorHelper';
import { registerRepeatableCommand } from '@utils/repeat';
import { invokeWithVimCount } from '@utils/vimcount';
import { DEFAULT_SURROUND_PAIRS } from '@utils/operation/range/surround/constants';
import { chooseKeyFromQuickPick } from '@utils/ui/input';
import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';

const REPLACE_HIGHLIGHT_STYLE = {
  backgroundColor: 'rgba(24, 156, 244, 0.94)',
  border: 'rgba(255, 255, 255, 0.8)',
};

/** カーソル位置を起点として囲み記号を別の囲み記号に置換する */
export async function addLineSurroundImpl(
  count: number,
  args: {
    surroundChar: string;
    repeatCount?: number;
    lastCount?: number;
    isInsertMode?: boolean;
  },
): Promise<void> {
  const { surroundChar, repeatCount = 0, lastCount = args.lastCount ?? 1, isInsertMode = args.isInsertMode ?? false } = args;
  if (repeatCount === 0)
    registerRepeatableCommand(({ repeatCount }) => addLineSurroundImpl(count, { ...args, repeatCount, lastCount }));
  const [open, close] = [surroundChar, DEFAULT_SURROUND_PAIRS[surroundChar]];
  const helper = new EditorHelper();
  let range;
  if (count === 1) range = getLineSurroundByPattern(standardPattern, { isInsertMode });
  else if (count === 2) range = getLineSurroundByPattern(extendedWordPattern, { isInsertMode });
  else if (count === 3) range = getLineSurroundByPattern(bigWordPattern, { isInsertMode });
  else if (count === 4) range = getLineSurroundByPattern(alnumPattern, { isInsertMode });
  else {
    vscode.window.showErrorMessage(`countは1から4`);
    return;
  }
  if (!range) return;
  const { startLine, startCol, endLine, endCol } = range;
  const newText = open + helper.document.getTextInRange(startLine, startCol, endLine, endCol) + close;
  await helper.edit.replaceRange(range, newText);
  helper.decoration.flash(startLine, startCol, startLine, startCol, { style: REPLACE_HIGHLIGHT_STYLE });
  helper.decoration.flash(endLine, endCol + 2, endLine, endCol + 2, { style: REPLACE_HIGHLIGHT_STYLE });
  const { line, col } = helper.cursor.get();
  helper.cursor.set(line, col + 1);
}
export async function addLineSurround(args: { surroundChar: string; isInsertMode?: boolean }): Promise<void> {
  await invokeWithVimCount(addLineSurroundImpl, args);
}

/** カーソル位置を起点として指定囲み記号を削除する */
async function deleteSpecificSurroundImpl(
  count: number,
  args: {
    surroundChar: string;
    repeatCount?: number;
    lastCount?: number;
    isInsertMode?: boolean;
    ignoreFirstQuote?: boolean;
    ignoreQuotedRanges?: boolean;
  },
): Promise<void> {
  const {
    surroundChar,
    repeatCount = 0,
    lastCount = args.lastCount ?? 1,
    isInsertMode = args.isInsertMode ?? false,
    ignoreFirstQuote = args.ignoreFirstQuote ?? false,
    ignoreQuotedRanges = args.ignoreQuotedRanges ?? true,
  } = args;
  if (repeatCount === 0)
    registerRepeatableCommand(({ repeatCount }) => deleteSurroundImpl(count, { ...args, lastCount: count, repeatCount }));
  else count = lastCount;
  const [open, close] = [surroundChar, DEFAULT_SURROUND_PAIRS[surroundChar]];
  const range = getSurroundByPair(open, close, 'a', { nth: count, isInsertMode, ignoreFirstQuote, ignoreQuotedRanges });
  if (!range) return;
  const { startLine, startCol, endLine, endCol } = range;
  const helper = new EditorHelper();
  helper.decoration.flash(startLine, startCol, startLine, startCol, {
    style: REPLACE_HIGHLIGHT_STYLE,
    duration: DELETION_HIGHLIGHT_DURATION,
  });
  await helper.decoration.flash(endLine, endCol, endLine, endCol, {
    style: REPLACE_HIGHLIGHT_STYLE,
    duration: DELETION_HIGHLIGHT_DURATION,
  });
  await helper.edit.replace(endLine, endCol, endLine, endCol, '');
  await helper.edit.replace(startLine, startCol, startLine, startCol, '');
}
export async function deleteSpecificSurround(args: {
  surroundChar: string;
  isInsertMode?: boolean;
  ignoreFirstQuote?: boolean;
  ignoreQuotedRanges?: boolean;
}): Promise<void> {
  await invokeWithVimCount(deleteSpecificSurroundImpl, args);
}

/** カーソル位置を起点として囲み記号を削除する */
async function deleteSurroundImpl(
  count: number,
  args: {
    repeatCount?: number;
    lastCount?: number;
    isInsertMode?: boolean;
    ignoreFirstQuote?: boolean;
    ignoreQuotedRanges?: boolean;
  },
): Promise<void> {
  const {
    repeatCount = 0,
    lastCount = args.lastCount ?? 1,
    isInsertMode = args.isInsertMode ?? false,
    ignoreFirstQuote = args.ignoreFirstQuote ?? false,
    ignoreQuotedRanges = args.ignoreQuotedRanges ?? true,
  } = args;
  if (repeatCount === 0)
    registerRepeatableCommand(({ repeatCount }) => deleteSurroundImpl(count, { ...args, lastCount: count, repeatCount }));
  else count = lastCount;
  const range = getSurroundByPairs('a', { nth: count, isInsertMode, ignoreFirstQuote, ignoreQuotedRanges });
  if (!range) return;
  const { startLine, startCol, endLine, endCol } = range;
  const helper = new EditorHelper();
  helper.decoration.flash(startLine, startCol, startLine, startCol, {
    style: REPLACE_HIGHLIGHT_STYLE,
    duration: DELETION_HIGHLIGHT_DURATION,
  });
  await helper.decoration.flash(endLine, endCol, endLine, endCol, {
    style: REPLACE_HIGHLIGHT_STYLE,
    duration: DELETION_HIGHLIGHT_DURATION,
  });
  await helper.edit.replace(endLine, endCol, endLine, endCol, '');
  await helper.edit.replace(startLine, startCol, startLine, startCol, '');
}
export async function deleteSurround(
  args: { isInsertMode?: boolean; ignoreFirstQuote?: boolean; ignoreQuotedRanges?: boolean } = {},
): Promise<void> {
  await invokeWithVimCount(deleteSurroundImpl, args);
}

/** カーソル位置を起点として囲みタグを削除する */
async function deleteTagSurroundImpl(
  count: number,
  args: {
    repeatCount?: number;
    lastCount?: number;
    isInsertMode?: boolean;
  },
): Promise<void> {
  const { repeatCount = 0, lastCount = args.lastCount ?? 1, isInsertMode = args.isInsertMode ?? false } = args;
  if (repeatCount === 0)
    registerRepeatableCommand(({ repeatCount }) => deleteTagSurroundImpl(count, { ...args, repeatCount, lastCount }));
  const ranges = getTagRanges('a', { nth: count });
  if (!ranges) return;
  const { startLine: openStartLine, startCol: openStartCol, endLine: openEndLine, endCol: openEndCol } = ranges[0];
  const { startLine: closeStartLine, startCol: closeStartCol, endLine: closeEndLine, endCol: closeEndCol } = ranges[1];
  const helper = new EditorHelper();
  helper.decoration.flash(openStartLine, openStartCol, openEndLine, openEndCol, {
    style: REPLACE_HIGHLIGHT_STYLE,
    duration: DELETION_HIGHLIGHT_DURATION,
  });
  await helper.decoration.flash(closeStartLine, closeStartCol, closeEndLine, closeEndCol, {
    style: REPLACE_HIGHLIGHT_STYLE,
    duration: DELETION_HIGHLIGHT_DURATION,
  });
  await helper.edit.replace(closeStartLine, closeStartCol, closeEndLine, closeEndCol, '');
  await helper.edit.replace(openStartLine, openStartCol, openEndLine, openEndCol, '');
}
export async function deleteTagSurround(args: { isInsertMode?: boolean } = {}): Promise<void> {
  await invokeWithVimCount(deleteTagSurroundImpl, args);
}

/** カーソル位置を起点として囲み記号を別の囲み記号に置換する */
async function replaceSurroundImpl(
  count: number,
  args: {
    surroundChar: string;
    repeatCount?: number;
    lastCount?: number;
    isInsertMode?: boolean;
  },
): Promise<void> {
  const { surroundChar, repeatCount = 0, lastCount = args.lastCount ?? 1, isInsertMode = args.isInsertMode ?? false } = args;
  if (repeatCount === 0)
    registerRepeatableCommand(({ repeatCount }) => replaceSurroundImpl(count, { ...args, repeatCount, lastCount }));
  const [open, close] = [surroundChar, DEFAULT_SURROUND_PAIRS[surroundChar]];
  const range = getSurroundByPairs('a', { nth: count, isInsertMode });
  if (!range) return;
  const { startLine, startCol, endLine, endCol } = range;
  const helper = new EditorHelper();
  await helper.edit.replace(startLine, startCol, startLine, startCol, open);
  await helper.edit.replace(endLine, endCol, endLine, endCol, close);
  helper.decoration.flash(startLine, startCol, startLine, startCol, { style: REPLACE_HIGHLIGHT_STYLE });
  helper.decoration.flash(endLine, endCol, endLine, endCol, { style: REPLACE_HIGHLIGHT_STYLE });
}
export async function replaceSurround(args: { surroundChar: string; isInsertMode?: boolean }): Promise<void> {
  await invokeWithVimCount(replaceSurroundImpl, args);
}

/** カーソル位置を起点として指定囲み記号を別の指定囲み記号に置換する */
async function replaceSpecificSurroundImpl(
  count: number,
  args: {
    repeatCount?: number;
    lastCount?: number;
    surroundChar?: string;
    newSurroundChar?: string;
    isInsertMode?: boolean;
  },
): Promise<void> {
  const { repeatCount = 0, lastCount = 1, isInsertMode = args.isInsertMode ?? false } = args;

  const surroundChars = Object.keys(DEFAULT_SURROUND_PAIRS);
  const surroundCombinations = surroundChars.flatMap((left) =>
    surroundChars.filter((right) => right !== left).map((right) => `${left}${right}`),
  );

  let surroundChar, newSurroundChar;
  if (args.surroundChar && args.newSurroundChar) {
    surroundChar = args.surroundChar;
    newSurroundChar = args.newSurroundChar;
  } else {
    const pick = await chooseKeyFromQuickPick(surroundCombinations);
    if (pick.key === '') return;
    surroundChar = pick.key[0];
    newSurroundChar = pick.key[1];
  }

  if (repeatCount === 0)
    registerRepeatableCommand(({ repeatCount }) =>
      replaceSpecificSurroundImpl(count, { ...args, repeatCount, lastCount, surroundChar, newSurroundChar }),
    );

  const [open, close] = [surroundChar, DEFAULT_SURROUND_PAIRS[surroundChar]];
  const range = getSurroundByPair(open, close, 'a', { nth: count, isInsertMode });
  if (!range) return;
  const { startLine, startCol, endLine, endCol } = range;

  const helper = new EditorHelper();
  const [newOpen, newClose] = [newSurroundChar, DEFAULT_SURROUND_PAIRS[newSurroundChar]];
  await helper.edit.replace(startLine, startCol, startLine, startCol, newOpen);
  await helper.edit.replace(endLine, endCol, endLine, endCol, newClose);
  helper.decoration.flash(startLine, startCol, startLine, startCol, { style: REPLACE_HIGHLIGHT_STYLE });
  helper.decoration.flash(endLine, endCol, endLine, endCol, { style: REPLACE_HIGHLIGHT_STYLE });
}
export async function replaceSpecificSurround(args: { isInsertMode?: boolean } = {}): Promise<void> {
  await invokeWithVimCount(replaceSpecificSurroundImpl, args);
}

//
// Visual Mode Only
//

interface VisualSelection {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

/** Visualモードで選択領域の周りに囲み記号を加える */
export async function addSurroundToVisualSelection(args: { surroundChar: string }): Promise<void> {
  const { surroundChar } = args;
  const mode = visualModeHelper.getLastMode();
  const selection = visualModeHelper.getVisualSelection();
  if (!selection) return;
  const { startLine, startCol, endLine, endCol } = selection;
  const helper = new EditorHelper();
  const [open, close] = [surroundChar, DEFAULT_SURROUND_PAIRS[surroundChar]];
  if (mode === 'char') {
    await helper.edit.insert(startLine, startCol, open);
    await helper.edit.insert(endLine, endCol + 1, close);
    helper.decoration.flash(startLine, startCol, startLine, startCol, { style: REPLACE_HIGHLIGHT_STYLE });
    helper.decoration.flash(endLine, endCol + 1, endLine, endCol + 1, { style: REPLACE_HIGHLIGHT_STYLE });
  } else if (mode === 'line') {
    for (let i = startLine; i <= endLine; i++) {
      const length = helper.document.getLineText(i).length;
      await helper.edit.insert(i, length, close);
      await helper.edit.insert(i, 0, open);
      helper.decoration.flash(i, 0, i, 0, { style: REPLACE_HIGHLIGHT_STYLE });
      helper.decoration.flash(i, length + 1, i, length + 1, { style: REPLACE_HIGHLIGHT_STYLE });
    }
  } else if (mode === 'block') {
    for (let i = startLine; i <= endLine; i++) {
      await helper.edit.insert(i, endCol + 1, close);
      await helper.edit.insert(i, startCol, open);
      helper.decoration.flash(i, startCol, i, startCol, { style: REPLACE_HIGHLIGHT_STYLE });
      helper.decoration.flash(i, endCol + 2, i, endCol + 2, { style: REPLACE_HIGHLIGHT_STYLE });
    }
  }
  await helper.vim.remap('<Esc>');
  // QUESTION: Visualモードではカーソル位置が正しくない？
  // const { line, col } = helper.cursor.get();
  // if (line === startLine) await helper.cursor.set(line, col + 1, { wait: 'both' });
}
