// import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';
import * as vscode from 'vscode';

/** タブ文字を、tabSizeに応じたスペースに展開する */
function expandTabs(text: string, tabSize: number): string {
  let result = '';
  let visualCol = 0;
  for (const ch of text) {
    if (ch === '\t') {
      const spacesToAdd = tabSize - (visualCol % tabSize);
      result += ' '.repeat(spacesToAdd);
      visualCol += spacesToAdd;
    } else {
      result += ch;
      visualCol += 1;
    }
  }
  return result;
}

/** タブ文字をスペースに展開したときの現在の位置を取得する */
function getVisualColumn(text: string, charIndex: number, tabSize: number): number {
  let visualCol = 0;
  for (let i = 0; i < charIndex; i++) {
    if (text[i] === '\t') {
      visualCol += tabSize - (visualCol % tabSize);
    } else {
      visualCol++;
    }
  }
  return visualCol;
}

/** textをタブ展開して求めたvisualCol（列位置）が、タブ展開していないtextでどの位置なのかを特定する */
function getCharacterFromVisualColumn(text: string, visualCol: number, tabSize: number): number | null {
  let currentVisualCol = 0;
  for (let charIndex = 0; charIndex < text.length; charIndex++) {
    if (currentVisualCol === visualCol) return charIndex;
    if (currentVisualCol >= visualCol) return charIndex;
    if (text[charIndex] === '\t') currentVisualCol += tabSize - (currentVisualCol % tabSize);
    else currentVisualCol++;
  }
  return null;
}

// col未満の行が連続して続いた後にcol以上の行が来たらそこまで進む
// col未満の行がずっと続いて最終行まで来たらそこで止まる
function findTargetLine(
  editor: vscode.TextEditor,
  startLine: number,
  col: number,
  direction: 'up' | 'down',
  tabSize: number,
): number {
  const lineCount = editor.document.lineCount;
  let line = startLine + (direction === 'down' ? 1 : -1);
  let lastValidLine = line;
  while (direction === 'down' ? line < lineCount : line >= 0) {
    const rawText = editor.document.lineAt(line).text;
    const text = expandTabs(rawText, tabSize);
    if (text.length > col) {
      const char = text[col];
      if (char !== ' ') {
        return line;
      }
      lastValidLine = line;
    }
    line += direction === 'down' ? 1 : -1;
  }
  return lastValidLine;
}

/**
 * 現在の列番号を維持したまま上/下方向を探し、その列が空白でもタブでもない最初の行へ移動
 * NOTE: visualモードの設定は複雑
 *   visualモードで開始位置から移動したとき、移動後の現在のカーソル位置を取得できない
 *   editor.selection.active/anchor.lineは常にvisualモードの開始位置である
 *   この部分を現在のカーソル位置を取得できるものとして作っているため問題が起きる
 *   回避方法として、visualのマッピングでは単にEscで抜けて、normalモードのマッピングを呼び出す
 *   呼び出されたnormalマッピングでgvを実行してvisualモードに移り、この関数を呼び出す。(gvでvisualモードになるが実際はnormalモードとして扱われる）
 *   Escで抜けnormalを呼び出すことでカーソル位置が更新される
 */
async function moveToNonWhitespace(args: { mode: 'n' | 'v'; direction: 'up' | 'down' }): Promise<void> {
  const { mode, direction } = args;
  if (mode !== 'n' && mode !== 'v') return;

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const line = editor.selection.active.line;
  if (direction === 'up' && line === 0) return;
  if (direction === 'down' && line === editor.document.lineCount - 1) return;
  let charIndex = editor.selection.active.character;
  // if(mode === 'v') charIndex -= 1; // visualモードからこの関数を呼び出すときコメントを外す。normalモードでgvしてこの関数を呼び出す場合外さなくて良い
  const text = editor.document.lineAt(line).text;
  const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4;
  const visualCol = getVisualColumn(text, charIndex, tabSize);

  const nextLine = direction === 'up' ? line - 1 : line + 1;
  const nextLineText = expandTabs(editor.document.lineAt(nextLine).text, tabSize);
  const isColOutsideAtNextLine = isColOutsideText(nextLineText, charIndex);
  const startLine = isColOutsideAtNextLine ? nextLine : findBoundaryLine(editor, nextLine, visualCol, direction, tabSize, true);

  const targetLine = findTargetLine(editor, startLine, visualCol, direction, tabSize);
  const targetText = editor.document.lineAt(targetLine).text;
  const col = getCharacterFromVisualColumn(targetText, visualCol, tabSize);
  if (col === null) return;

  if (mode === 'n') {
    const newPos = new vscode.Position(targetLine, col);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos));
  } else {
    await vscode.commands.executeCommand('vim.remap', {
      after: [...Array.from(`${targetLine + 1}`), 'G', ...Array.from(`${col + 1}`), '|', '<Esc>', 'g', 'v'],
    });
  }
}

// export async function downToNonWhitespace(args: { mode: 'n' | 'v' }) {
//   await moveToNonWhitespace({ ...args, direction: 'down' });
// }
// export async function upToNonWhitespace(args: { mode: 'n' | 'v' }) {
//   await moveToNonWhitespace({ ...args, direction: 'up' });
// }

//
// 「先頭から非空白文字」または「行末を超えた位置」にあればその行はスキップする
//

/** colが「行頭から非空白文字の手前まで」または「行末を超えた位置」にあるかを判定する */
function isColOutsideText(text: string, col: number): boolean {
  const match = text.match(/\S/);
  const indentWidth = match ? match.index! : text.length;
  if (col < indentWidth) return true;
  if (col >= text.length) return true;
  return false;
}

/**
 * 現在行からdirection方向へ、colが「非空白文字前の空白部分」または「行末を超えた位置」を満たさない最初の行を探す
 * 見つかればその行を返す。見つからずファイル端まで達したら、最後に到達した行を返す。
 */
function findBoundaryLine(
  editor: vscode.TextEditor,
  startLine: number,
  col: number,
  direction: 'up' | 'down',
  tabSize: number,
  outside: boolean,
): number {
  const lineCount = editor.document.lineCount;
  let line = startLine + (direction === 'down' ? 1 : -1);
  let lastLine = editor.selection.active.line;
  while (direction === 'down' ? line < lineCount : line >= 0) {
    const rawText = editor.document.lineAt(line).text;
    const text = expandTabs(rawText, tabSize);
    lastLine = line;
    if (outside) {
      if (isColOutsideText(text, col)) return line;
    } else {
      if (!isColOutsideText(text, col)) return line;
    }
    line += direction === 'down' ? 1 : -1;
  }
  return lastLine;
}

/**
 * 現在の列を維持したまま上/下方向を探し、その列が「インデント部分でない」かつ「行末を超えていない」行へ移動する
 */
async function moveToTextBoundary(args: { mode: 'n' | 'v'; direction: 'up' | 'down' }): Promise<void> {
  const { mode, direction } = args;
  if (mode !== 'n' && mode !== 'v') return;

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const line = editor.selection.active.line;
  if (direction === 'up' && line === 0) return;
  if (direction === 'down' && line === editor.document.lineCount - 1) return;
  const charIndex = editor.selection.active.character;
  const text = editor.document.lineAt(line).text;
  const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4;
  const visualCol = getVisualColumn(text, charIndex, tabSize);

  const nextLine = direction === 'up' ? line - 1 : line + 1;
  const nextLineText = expandTabs(editor.document.lineAt(nextLine).text, tabSize);
  const isColOutsideAtNextLine = isColOutsideText(nextLineText, charIndex);
  const startLine = isColOutsideAtNextLine ? nextLine : findBoundaryLine(editor, nextLine, visualCol, direction, tabSize, true);

  const targetLine = findBoundaryLine(editor, startLine, visualCol, direction, tabSize, false);
  const targetText = editor.document.lineAt(targetLine).text;
  const col = getCharacterFromVisualColumn(targetText, visualCol, tabSize);
  if (col === null) return;

  if (mode === 'n') {
    const newPos = new vscode.Position(targetLine, col);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos));
  } else {
    await vscode.commands.executeCommand('vim.remap', {
      after: [...Array.from(`${targetLine + 1}`), 'G', ...Array.from(`${col + 1}`), '|', '<Esc>', 'g', 'v'],
    });
  }
}

// export async function downToBoundary(args: { mode: 'n' | 'v' }) {
//   await moveToTextBoundary({ ...args, direction: 'down' });
// }
// export async function upToBoundary(args: { mode: 'n' | 'v' }) {
//   await moveToTextBoundary({ ...args, direction: 'up' });
// }

export async function down(args: { mode: 'n' | 'v' }) {
  // await moveToNonWhitespace({ ...args, direction: 'down' });
  await moveToTextBoundary({ ...args, direction: 'down' });
}
export async function up(args: { mode: 'n' | 'v' }) {
  // await moveToNonWhitespace({ ...args, direction: 'up' });
  await moveToTextBoundary({ ...args, direction: 'up' });
}
