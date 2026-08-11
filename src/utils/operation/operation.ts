import * as vscode from 'vscode';
import {
  getSurroundByArguments,
  getSurroundByClass,
  getLineSurroundByEdge,
  getSurroundByFunction,
  getSurroundByPair,
  getSurroundByPairs,
  getSurroundByInput,
  getLineSurroundByInput,
  getLineSurroundByPattern,
  getLineSurroundByCamelCase,
  getSurroundByIndent,
  getSurroundByParagraph,
  getSurroundByTag,
} from './range/surround/index';
import { OperationRange, Mode, Operator, TextObject } from './operationType';
import { putHighlightStyle, yankHighlightStyle } from './operationConfig';
import { getRangeByKey, getCountLineRange } from './range/key';
import { getRangeByWordMotion } from './range/wordMotion';
import { textPatterns } from '@utils/config/patterns';
import { onInsertEnterFromC, getInsertText } from '@utils/repeat';
import { EditorHelper } from '@utils/editorHelper/EditorHelper';
import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';
import { yankStock } from '@utils/yankStock';

/**
 * count+textObjに対するアクション範囲を返す
 * @param textObj テキストオブジェクト
 * @param count 10yyなどのオペレーションの前の数値
 * @returns アクション範囲を返す
 *   - startLine 開始行
 *   - startCol 開始列
 *   - endLine 終了行
 *   - endCol 終了列
 *   - mode char | line | block
 */
export async function getOperationRange(textObj: string, count: number): Promise<OperationRange | null> {
  let range;
  // is, it
  // NOTE: ^`はgetOneChar未対応
  // prettier-ignore
  if      (textObj === "a" ) range = getSurroundByPairs('i', { nth: count });
  else if (textObj === "ia") range = getSurroundByPairs('i', { nth: count });
  else if (textObj === "iA") range = getSurroundByPairs('i', { nth: count, ignoreQuotedRanges: false });
  else if (textObj === 'ic') range = getSurroundByClass(count, 'i');
  else if (textObj === 'if') range = getSurroundByFunction(count, 'i');
  else if (textObj === 'im') range = await getLineSurroundByInput({ isSamePair: false, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'i' });
  else if (textObj === 'iM') range = await getSurroundByInput({ isSamePair: false, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'i' });
  else if (textObj === 'in') range = await getLineSurroundByInput({ isSamePair: true, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'i' });
  else if (textObj === 'iN') range = await getSurroundByInput({ isSamePair: true, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'i' });
  else if (textObj === "it") range = getSurroundByTag('i', { nth: count });
  else if (textObj === 'i2') range = getSurroundByPair('"', '"', 'i', { nth: count, ignoreQuotedRanges: false });
  else if (textObj === 'i"') range = getSurroundByPair('"', '"', 'i', { nth: count });
  else if (textObj === "i6") range = getSurroundByPair("'", "'", 'i', { nth: count, ignoreQuotedRanges: false });
  else if (textObj === "i'") range = getSurroundByPair("'", "'", 'i', { nth: count });
  else if (textObj === 'i(') range = getSurroundByPair('(', ')', 'i', { nth: count });
  else if (textObj === 'i@') range = getSurroundByPair('`', '`', 'i', { nth: count, ignoreQuotedRanges: false });
  else if (textObj === 'i`') range = getSurroundByPair('`', '`', 'i', { nth: count });
  else if (textObj === 'i[') range = getSurroundByPair('[', ']', 'i', { nth: count });
  else if (textObj === 'i{') range = getSurroundByPair('{', '}', 'i', { nth: count });
  else if (textObj === 'i,') range = getSurroundByArguments('i');
  else if (textObj === 'i<') range = getSurroundByPair('<', '>', 'i', { nth: count });
  else if (textObj === "oa") range = getSurroundByPairs('a', { nth: count });
  else if (textObj === "oA") range = getSurroundByPairs('a', { nth: count, ignoreQuotedRanges: false });
  else if (textObj === 'oc') range = getSurroundByClass(count, 'a');
  else if (textObj === 'of') range = getSurroundByFunction(count, 'a');
  else if (textObj === 'om') range = await getLineSurroundByInput({ isSamePair: false, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'a' });
  else if (textObj === 'oM') range = await getSurroundByInput({ isSamePair: false, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'a' });
  else if (textObj === 'on') range = await getLineSurroundByInput({ isSamePair: true, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'a' });
  else if (textObj === 'oN') range = await getSurroundByInput({ isSamePair: true, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'a' });
  else if (textObj === "ot") range = getSurroundByTag('a', { nth: count });
  else if (textObj === 'o2') range = getSurroundByPair('"', '"', 'a', { nth: count, ignoreQuotedRanges: false });
  else if (textObj === 'o"') range = getSurroundByPair('"', '"', 'a', { nth: count });
  else if (textObj === "o6") range = getSurroundByPair("'", "'", 'a', { nth: count, ignoreQuotedRanges: false });
  else if (textObj === "o'") range = getSurroundByPair("'", "'", 'a', { nth: count });
  else if (textObj === 'o(') range = getSurroundByPair('(', ')', 'a', { nth: count });
  else if (textObj === 'o@') range = getSurroundByPair('`', '`', 'a', { nth: count, ignoreQuotedRanges: false });
  else if (textObj === 'o`') range = getSurroundByPair('`', '`', 'a', { nth: count });
  else if (textObj === 'o[') range = getSurroundByPair('[', ']', 'a', { nth: count });
  else if (textObj === 'o{') range = getSurroundByPair('{', '}', 'a', { nth: count });
  else if (textObj === 'o,') range = getSurroundByArguments('a');
  else if (textObj === 'o<') range = getSurroundByPair('<', '>', 'a', { nth: count });
  else if (textObj === 'ie') range = getLineSurroundByPattern(textPatterns['alnum']);
  else if (textObj === 'iI') range = getSurroundByIndent({ outerLevel: count });
  else if (textObj === 'il') range = getLineSurroundByEdge('trimBoth');
  else if (textObj === 'ip') range = getSurroundByParagraph();
  else if (textObj === "ir") range = getLineSurroundByCamelCase();
  else if (textObj === 'iw') range = getLineSurroundByPattern(textPatterns['standard']);
  else if (textObj === 'iW') range = getLineSurroundByPattern(textPatterns['bigWord']);
  else if (textObj === 'm' ) range = await getLineSurroundByInput({ isSamePair: false, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'a' });
  else if (textObj === 'M' ) range = await getSurroundByInput({ isSamePair: false, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'a' });
  else if (textObj === 'n' ) range = await getLineSurroundByInput({ isSamePair: true, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'a' });
  else if (textObj === 'N' ) range = await getSurroundByInput({ isSamePair: true, prefixChars: '@ ', suffixChars: ' @', textObjectPrefix: 'a' });
  else if (textObj === 'y' ) range = getCountLineRange(count, 'down');
  else if (textObj === 'Y' ) range = getCountLineRange(count, 'up');
  else if (textObj === '0' ) range = getLineSurroundByEdge('startToLeftOfCursor');
  else if (textObj === '$' ) range = getLineSurroundByEdge('cursorToEnd');
  else if (textObj === '^' ) range = getLineSurroundByEdge('trimStartToLeftOfCursor');
  else if (textObj === ' ' ) range = getLineSurroundByPattern('\\S');
  else if (textObj === ',' ) range = getSurroundByArguments('a');
  else if (textObj === 'A' ) range = getRangeByKey('A', count);
  else if (textObj === 'gg') range = getRangeByKey('gg', count);
  else if (textObj === 'G' ) range = getRangeByKey('G', count);
  else if (textObj === 'h' ) range = getRangeByKey('h', count);
  else if (textObj === 'j' ) range = getRangeByKey('j', count);
  else if (textObj === 'k' ) range = getRangeByKey('k', count);
  else if (textObj === 'l' ) range = getRangeByKey('l', count);
  else if (textObj === 'b' ) range = getRangeByWordMotion(count, 'A-Za-z0-9_', 'b');
  else if (textObj === 'B' ) range = getRangeByWordMotion(count, '\\S', 'b');
  else if (textObj === 'w' ) range = getRangeByWordMotion(count, 'A-Za-z0-9_', 'w');
  else if (textObj === 'W' ) range = getRangeByWordMotion(count, '\\S', 'w');
  else return null;

  if (!range) return null;
  return range;
}

function getCharUnderCursor(helper: EditorHelper): string {
  const pos = helper.editor.selection.active;
  const char = helper.editor.document.getText(new vscode.Range(pos, pos.translate(0, 1)));
  return char;
}
// NOTE: mappingに登録して<C-o>uを実行したときと通常に打ち込んでundoしたときの挙動が違うので実装難しい
async function triggerVimUndoBoundary(helper: EditorHelper, mode: Mode): Promise<void> {
  return;
  if (mode === 'n') {
    // await vscode.commands.executeCommand('vim.remap', { after: [''] });
    const char = getCharUnderCursor(helper);
    await helper.vim.remap(['r', char], { wait: 'after' });
  } else if (mode === 'i') {
    const char = getCharUnderCursor(helper);
    if (char !== '') await helper.vim.remap(['<C-o>', 'r', char], { wait: 'after' });
    // await helper.vim.remap(' <Left><Del>', {'wait': 'after'});
  }
}

function getRangePosition(range: OperationRange) {
  let startPos, endPos;
  if (range.mode === 'line') {
    startPos = `${range.startLine + 1}G`;
    endPos = `${range.endLine + 1}G`;
  } else {
    startPos = `${range.startLine + 1}G${range.startCol + 1}|`;
    endPos = `${range.endLine + 1}G${range.endCol + 1}|`;
  }
  return { startPos, endPos };
}

/** 選択範囲に対してoperatorを実行する */
export async function operateOnRange(
  mode: Mode,
  operator: Operator,
  range: OperationRange | null,
  repeatCount: number,
  {
    helper = new EditorHelper(), // TODO: helperは必ず呼び出し側から渡すべき
    textObject,
  }: { helper?: EditorHelper; textObject?: TextObject } = {},
) {
  if (range === null) return;

  if (mode === 'n') {
    if (operator === 'y') {
      // QUESTION: visual modeを使わずにline認識でyankできる方法はあるか
      if (range.mode === 'line' || range.mode === 'block') {
        const mapping = visualModeHelper.getVimMapping(range.mode);
        let { startPos, endPos } = getRangePosition(range);
        await helper.vim.remap(`mZ${startPos}${mapping}${endPos}<C-a>|y\`Z`);
      } else {
        await helper.clipboard.copyRange(range);
        helper.decoration.flashRange(range, { style: yankHighlightStyle });
      }
      const text = helper.document.getTextFromRange(range);
      yankStock.push(text);
    } else if (operator === 'p') {
      const replacedRange = await helper.edit.replaceRangeWithClipboard(range);
      helper.decoration.flashRange(replacedRange, { style: putHighlightStyle });
    } else if (operator === 'd') {
      if (range.mode === 'line' || range.mode === 'block') {
        const mapping = visualModeHelper.getVimMapping(range.mode);
        let { startPos, endPos } = getRangePosition(range);
        await helper.vim.remap(`${startPos}${mapping}${endPos}d`);
      } else {
        await triggerVimUndoBoundary(helper, mode);
        await helper.clipboard.copyRange(range);
        await helper.edit.deleteRange(range);
        await helper.cursor.set(range.startLine, range.startCol, { wait: 'before' });
      }
    } else if (operator === 'c') {
      if (repeatCount === 0) {
        // await triggerVimUndoBoundary(helper, mode);
        await helper.cursor.set(range.startLine, range.startCol, { wait: 'after' });
        await helper.clipboard.copyRange(range);
        await helper.edit.deleteRange(range);
        onInsertEnterFromC(range.startLine, range.startCol);
        await helper.vim.remap('i');

        // バグ？: 相対カーソル移動（2kなど）を使用した後、16|などの列移動を行うとカレント行の16|に移動する
        //       : undoでもとに戻らない
        //  問題 : remapで完結させるとonInsertEnterFromCが呼び出せない
        // const charUnderCursor = getCharUnderCursor();
        // const curLine = getLineInfo().line;
        // const toStartCommand = curLine === range.startLine ? '' : `${Math.abs(curLine - range.startLine)}${curLine > range.startLine ? 'k' : 'j'}`;
        // const toEndCommand = range.endLine === range.startLine ? '' : `${Math.abs(range.endLine - range.startLine)}${range.endLine > range.startLine ? 'j' : 'k'}`;
        // prettier-ignore
        // await vscode.commands.executeCommand('vim.remap', {
        //   after: [ 'r', charUnderCursor, ...`${range.startLine + 1}G`, ...`${range.startCol + 1}|`, '<C-a>', '|', 'v',
        //                                  ...`${range.endLine + 1}G`, ...`${range.endCol + 1}|`, 'c' ]
        //   after: [ 'r', charUnderCursor, ...toStartCommand, ...`${range.startCol + 1}|`, '<C-a>', '|', 'v',
        //                                  ...toEndCommand, ...`${range.endCol + 1}|`, 'c' ]
        // });
      } else {
        // await triggerVimUndoBoundary(helper, mode);
        await helper.clipboard.copyRange(range);
        const afterText = getInsertText();
        const rangeAfterReplace = await helper.edit.replaceRange(range, afterText);
        await helper.cursor.set(rangeAfterReplace.endLine, rangeAfterReplace.endCol, { wait: 'before' });
      }
    }
  } else if (mode === 'i') {
    if (operator === 'y') {
      helper.decoration.flashRange(range, { style: yankHighlightStyle });
      await helper.clipboard.copyRange(range);
    } else if (operator === 'p') {
      await triggerVimUndoBoundary(helper, mode);
      const replacedRange = await helper.edit.replaceRangeWithClipboard(range);
      helper.decoration.flashRange(replacedRange, { style: putHighlightStyle });
    } else {
      await triggerVimUndoBoundary(helper, mode);
      await helper.clipboard.copyRange(range);
      await helper.edit.deleteRange(range);
      if (operator === 'd') await helper.vim.remap('<Esc>', { wait: 'after' });
      await helper.cursor.set(range.startLine, range.startCol);
    }
  } else {
    const visualMode = range.mode === 'char' && range.startLine === range.endLine ? 'block' : range.mode;
    visualModeHelper.setLastMode(visualMode);
    const mapping = visualModeHelper.getVimMapping(range.mode);
    // QUESTION: 相対カーソル移動にすべきか
    let { startPos, endPos } = getRangePosition({ ...range, mode: visualMode });
    await helper.vim.remap(`<Esc>${startPos}${mapping}${endPos}`);
  }
}
