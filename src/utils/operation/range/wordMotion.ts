import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';
import { OperationRange } from '@utils/operation/operationType';

function buildAlternatingPattern(wordCharClass: string, count: number, firstIsWord: boolean, firstChar: string): RegExp {
  if (/\s/.test(firstChar)) {
    if (count === 1) return new RegExp(/^(\s+)\S/);
    count -= 1;
  }
  const wordUnit = `[${wordCharClass}]+\\s*`;
  const nonWordUnit = `[^${wordCharClass}]+\\s*`;
  let useWord = firstIsWord;
  let pattern = useWord ? wordUnit : nonWordUnit + wordUnit;
  for (let i = 1; i < count; i++) {
    pattern += nonWordUnit + wordUnit;
  }
  pattern = `^(${pattern.replace(/\\s\*$/, '')})\\s*`;
  return new RegExp(pattern);
}

/**
 * カーソル位置からwordCharCLassにマッチする先頭（b）/末尾（w）までの範囲を返す
 * a b <cursor> c d
 *     **********   w  wordCharClass='A-Za-z0-9_'
 *     ************ w2
 *   **********     b
 * ************     b2
 */
export function getRangeByWordMotion(count: number, wordCharClass: string, motion: 'b' | 'w'): OperationRange {
  const editor = getActiveEditor();
  const document = editor.document;
  const position = editor.selection.active;
  const cursorLine = position.line;
  const cursorCol = position.character;
  // const cursorLineOriginal = position.line;
  // const cursorLine =
  //   motion === 'b' && position.character === 0 && cursorLineOriginal !== 0 ? cursorLineOriginal - 1 : cursorLineOriginal;
  // const cursorCol =
  //   motion === 'w'
  //     ? position.character
  //     : position.character === 0
  //       ? cursorLineOriginal === 0
  //         ? 0
  //         : document.lineAt(cursorLineOriginal - 1).text.length - 1
  //       : position.character - 1;
  const cursorPos = new vscode.Position(position.line, position.character);
  const anchorPos = new vscode.Position(cursorLine, Math.max(cursorCol, 0));
  const anchorOffset = document.offsetAt(anchorPos);

  const text = document.getText();
  // textを画面に見える部分だけにする
  // if (motion === 'w') {
  //   const text = document.getText();
  // } else {
  //   const visibleRanges = editor.visibleRanges;
  //   const activeVisibleRange =
  //     visibleRanges.find((r) => r.start.line <= cursorLine && cursorLine <= r.end.line) ?? visibleRanges[0];
  //   const visibleStartLine = activeVisibleRange.start.line;
  //   const visibleEndLine = Math.min(activeVisibleRange.end.line, document.lineCount - 1);
  //   const rangeStart = new vscode.Position(visibleStartLine, 0);
  //   const rangeEnd = new vscode.Position(visibleEndLine, document.lineAt(visibleEndLine).text.length);
  //   const visibleTextRange = new vscode.Range(rangeStart, rangeEnd);
  //   const text = document.getText(visibleTextRange);
  // }

  const safeCount = count > 0 ? count : 1;
  const wordTestRegex = new RegExp(`[${wordCharClass}]`);

  let targetOffset: number;

  if (motion === 'w') {
    const forward = text.slice(anchorOffset);
    const firstChar = forward[0];
    const firstIsWord = firstChar !== undefined && wordTestRegex.test(firstChar);
    let regex = buildAlternatingPattern(wordCharClass, safeCount, firstIsWord, firstChar);
    let match = regex.exec(forward);
    targetOffset = match ? anchorOffset + match[1].length - 1 : text.length;
  } else {
    // QUESTION: reversedを作っているので巨大なファイルの場合、低速なるか？
    const backward = text.slice(0, anchorOffset + 1);
    const reversed = [...backward].reverse().join('');
    const firstChar = reversed[0];
    const firstIsWord = firstChar !== undefined && wordTestRegex.test(firstChar);
    let regex = buildAlternatingPattern(wordCharClass, safeCount, firstIsWord, firstChar);
    let match = regex.exec(reversed);
    const matchLen = match ? match[1].length - 1 : reversed.length;
    targetOffset = anchorOffset - matchLen;
  }

  targetOffset = Math.max(0, Math.min(targetOffset, text.length));
  const targetPos = document.positionAt(targetOffset);

  const [from, to] = motion === 'w' ? [cursorPos, targetPos] : [targetPos, cursorPos];

  return {
    startLine: from.line,
    startCol: from.character,
    endLine: to.line,
    endCol: to.character,
    mode: 'char',
  };
}
