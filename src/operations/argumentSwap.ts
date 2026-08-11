import * as vscode from 'vscode';
import { getLineInfo } from '@utils/editor/line';
import { getOneChar } from '@utils/ui/input';
import { getAllArgs, getArgumentPairs } from '@utils/operation/range/surround/argument';
import { DEFAULT_MAX_SEARCH_LINES } from '@utils/operation/range/surround/constants';
import { ArgumentSurroundCharInfo as CharInfo, ArgumentSurroundInfo as ArgInfo } from '@utils/operation/range/surround/type';
import { setCursorPosition } from '@utils/editor/cursor';
import { getActiveEditor } from '@utils/editor/editor';
import { getTextInRange } from '@utils/editor/document';
import { waitForSelectionSettled } from '@utils/wait';

// foo(aaa, bbb, ccc)
//           ^ カーソル
//
// 起動 -> bbb がハイライト
// h -> aaaと交換 -> foo(bbb, aaa, ccc)  currentIndex=0 (bbbの位置)
// l -> 右と交換  -> foo(aaa, ccc, bbb)  currentIndex=2 (bbbの位置)
// j -> 左を選択  -> aaa がハイライト    currentIndex=0
// k -> 右を選択  -> ccc がハイライト    currentIndex=2
// q -> 終了

interface ArgSwapOptions {
  wrap: boolean; // 循環するかどうか（デフォルト: true）
}

const DEFAULT_OPTIONS: ArgSwapOptions = {
  wrap: true,
};

const bracketPairs = { open: ['(', '[', '{', '<'], close: [')', ']', '}', '>'] };

// ハイライト用のDecorationType
let currentHighlightDecoration: vscode.TextEditorDecorationType | null = null;
let otherHighlightDecoration: vscode.TextEditorDecorationType | null = null;

/**
 * ハイライトをクリアする
 */
function clearHighlight(): void {
  const editor = getActiveEditor();
  if (currentHighlightDecoration) {
    editor.setDecorations(currentHighlightDecoration, []);
    currentHighlightDecoration.dispose();
    currentHighlightDecoration = null;
  }
  if (otherHighlightDecoration) {
    editor.setDecorations(otherHighlightDecoration, []);
    otherHighlightDecoration.dispose();
    otherHighlightDecoration = null;
  }
}

/**
 * 指定したArgumentをハイライトする
 */
function highlightArg(args: ArgInfo[], currentIndex: number): void {
  const editor = getActiveEditor();
  clearHighlight();

  // 選択中のArgument
  currentHighlightDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(238, 255, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.8)',
  });

  // 非選択のArgument
  otherHighlightDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(243, 238, 238, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.8)',
  });

  const currentRange = new vscode.Range(
    new vscode.Position(args[currentIndex].innerStart.line, args[currentIndex].innerStart.col),
    new vscode.Position(args[currentIndex].innerEnd.line, args[currentIndex].innerEnd.col + 1),
  );
  editor.setDecorations(currentHighlightDecoration, [currentRange]);

  // 非選択のArgumentのRange一覧
  const otherRanges = args
    .filter((_, i) => i !== currentIndex)
    .map(
      (arg) =>
        new vscode.Range(
          new vscode.Position(arg.innerStart.line, arg.innerStart.col),
          new vscode.Position(arg.innerEnd.line, arg.innerEnd.col + 1),
        ),
    );
  editor.setDecorations(otherHighlightDecoration, otherRanges);
}

/**
 * カーソル位置から現在のArgumentのインデックスを取得する
 */
function getCurrentArgIndex(args: ArgInfo[], cursorLine: number, cursorCol: number): number {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const isAfterOuterStart =
      cursorLine > arg.outerStart.line || (cursorLine === arg.outerStart.line && cursorCol >= arg.outerStart.col);
    const isBeforeOuterEnd =
      cursorLine < arg.outerEnd.line || (cursorLine === arg.outerEnd.line && cursorCol <= arg.outerEnd.col);
    if (isAfterOuterStart && isBeforeOuterEnd) return i;
  }
  return 0;
}

/**
 * 2つの引数のテキストを入れ替える
 * charsを使って実際の編集範囲を特定する
 */
async function swapArgs(args: ArgInfo[], indexA: number, indexB: number): Promise<void> {
  const argA = args[Math.min(indexA, indexB)];
  const argB = args[Math.max(indexA, indexB)];

  const textA = getTextInRange({
    startLine: argA.innerStart.line,
    startCol: argA.innerStart.col,
    endLine: argA.innerEnd.line,
    endCol: argA.innerEnd.col,
  });
  const textB = getTextInRange({
    startLine: argB.innerStart.line,
    startCol: argB.innerStart.col,
    endLine: argB.innerEnd.line,
    endCol: argB.innerEnd.col,
  });

  // const textA = argA.text;
  // const textB = argB.text;

  // 後ろから置換（前を先に変えると位置がずれるため）
  const editor = getActiveEditor();
  await editor.edit((editBuilder) => {
    const rangeB = new vscode.Range(
      new vscode.Position(argB.innerStart.line, argB.innerStart.col),
      new vscode.Position(argB.innerEnd.line, argB.innerEnd.col + 1),
    );
    const rangeA = new vscode.Range(
      new vscode.Position(argA.innerStart.line, argA.innerStart.col),
      new vscode.Position(argA.innerEnd.line, argA.innerEnd.col + 1),
    );
    editBuilder.replace(rangeB, textA);
    editBuilder.replace(rangeA, textB);
  });
}

/**
 * インデックスを循環させる
 */
function wrapIndex(index: number, length: number, wrap: boolean): number {
  if (wrap) return (index + length) % length;
  return Math.max(0, Math.min(index, length - 1));
}

/**
 * (line, col)の位置から２回左に進んだ位置を返す
 * col=0の場合は１つ上の行末に移動する
 */
function moveTwoLeft(line: number, col: number, moveCount = 0): { line: number; col: number } | null {
  const document = getActiveEditor().document;
  if (moveCount < 2 && line === 0 && col === 0) return null;
  if (col === 0) return moveTwoLeft(line - 1, document.lineAt(line - 1).text.length, moveCount);
  if (moveCount < 2) return moveTwoLeft(line, col - 1, moveCount + 1);
  return {line, col};
}

/** (line,col)からstep文字進んだときの(line,col)を返す */
function getPositionAfterStep(line: number, col: number, step: number): { line: number; col: number } | null {
  const document = getActiveEditor().document;
  let remainingStep = step;
  while (remainingStep > 0) {
    const lineText = document.lineAt(line).text;
    const charsLeftInLine = lineText.length - col; // (line,col)から行末までの文字数
    if (remainingStep < charsLeftInLine) {
      // 同じ行内で収まる
      col += remainingStep;
      break;
    } else {
      // 行末を超える
      remainingStep -= charsLeftInLine;
      line++;
      col = 0;
      if (line >= document.lineCount) return null;
    }
  }
  return { line, col };
}

function getInitialArguments(
  maxSearchLines: number,
): { open: string; close: string; separator: string; args: ArgInfo[]; chars: CharInfo[] } | null {
  // 囲み記号ペアを取得
  const argumentPairs = getArgumentPairs(maxSearchLines);
  if (!argumentPairs || argumentPairs.length === 0) return null;

  let open, close, separator, result;
  for ([open, close, separator] of argumentPairs) {
    result = getAllArgs(open, close, separator, { maxSearchLines, additionalNestPairs: bracketPairs });
    if (!result) continue;
    break;
  }
  if (!result) return null;
  if (!open || !close || !separator) return null;
  const { args, chars } = result;
  if (args.length === 0) return null;
  return { open, close, separator, args, chars };
}

/**
 * 引数を交換・選択するメイン関数
 * h: 左の引数と交換
 * i: 内側の引数に変更
 * j: 右の引数を選択
 * k: 左の引数を選択
 * l: 右の引数と交換
 * o: 外側の引数に変更
 * q / Escape: 終了
 */
export async function interactiveArgumentSwap(
  options: ArgSwapOptions = DEFAULT_OPTIONS,
  maxSearchLines: number = DEFAULT_MAX_SEARCH_LINES,
): Promise<void> {
  const result = getInitialArguments(maxSearchLines);
  if (result === null) return;
  let { open, close, separator, args, chars } = result;

  // 現在のArgumentインデックスを特定
  const lineInfo = getLineInfo();
  const cursorLine = lineInfo.line;
  const cursorCol = lineInfo.col;
  let currentIndex = getCurrentArgIndex(args, cursorLine, cursorCol);

  try {
    while (true) {
      highlightArg(args, currentIndex);
      setCursorPosition(args[currentIndex].innerStart.line, args[currentIndex].innerStart.col);

      const key = await getOneChar();

      // キャンセル
      if (!key || key === 'q') break;

      let startNestLevel = 0;
      switch (key) {
        case 'h': {
          // 左の引数と交換
          const targetIndex = wrapIndex(currentIndex - 1, args.length, options.wrap);
          startNestLevel = args[targetIndex].text[0] === open ? 1 : 0;
          if (targetIndex !== currentIndex) {
            await swapArgs(args, currentIndex, targetIndex);
            currentIndex = targetIndex;
          }
          break;
        }
        case 'i': {
          // 内側の引数を選択
          const arg = args[currentIndex];
          const argText = arg.text;
          for (let i = 0; i < argText.length - 1; i++) {
            const newOpen = argText[i];
            if (bracketPairs.open.includes(newOpen)) {
              const pos = getPositionAfterStep(arg.innerStart.line, arg.innerStart.col, i);
              if (pos === null) break; // ここにはたどり着かない
              setCursorPosition(pos.line, pos.col);
              const refreshed = getInitialArguments(maxSearchLines);
              if (refreshed === null) continue;
              ({ open, close, separator, args, chars } = refreshed);
              currentIndex = 0;
              break;
            }
          }
          break;
        }
        case 'j': {
          // 右の引数を選択
          currentIndex = wrapIndex(currentIndex + 1, args.length, options.wrap);
          break;
        }
        case 'k': {
          // 左の引数を選択
          currentIndex = wrapIndex(currentIndex - 1, args.length, options.wrap);
          break;
        }
        case 'l': {
          // 右の引数と交換
          const targetIndex = wrapIndex(currentIndex + 1, args.length, options.wrap);
          startNestLevel = args[targetIndex].text[0] === open ? 1 : 0;
          if (targetIndex !== currentIndex) {
            await swapArgs(args, currentIndex, targetIndex);
            currentIndex = targetIndex;
          }
          break;
        }
        case 'o': {
          // 外側の引数を選択
          // １回左へ移動すると囲み開始位置、２回目で囲みの外側
          let pos = moveTwoLeft(args[0].outerStart.line, args[0].outerStart.col);
          if (pos === null) continue;
          setCursorPosition(pos.line, pos.col);
          const refreshed = getInitialArguments(maxSearchLines);
          if (refreshed === null) continue;
          const savedLine = args[currentIndex].innerStart.line;
          const savedCol = args[currentIndex].innerStart.col;
          ({ open, close, separator, args, chars } = refreshed);
          currentIndex = getCurrentArgIndex(args, savedLine, savedCol);
        }
        default:
          break;
      }

      if (key !== 'j' && key !== 'k') {
        const refreshed = getAllArgs(open, close, separator, {
          maxSearchLines,
          startNestLevel,
          additionalNestPairs: bracketPairs,
        });
        if (!refreshed) break;
        args = refreshed.args;
        chars = refreshed.chars;
        if (args.length === 0) break;
      }
    }
  } finally {
    clearHighlight();
  }
}
