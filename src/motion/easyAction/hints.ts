import * as vscode from 'vscode';
import { getOneChar } from '@utils/ui/input';
import { RegionInfo } from './type';
import { getActiveEditor } from '@utils/editor/editor';

const HINT_KEYS = 'jklhnmuioypasdfgqwertzxcvb';

/**
 * ヒント数（count）に応じてヒント文字列を生成する
 * 26個以下なら1文字、それ以上なら2文字（aa, ab, ...）
 * 最大26*26*26=17576種類のヒントを生成
 */
export function generateHints(count: number): string[] {
  const hints: string[] = [];
  if (count <= HINT_KEYS.length) {
    for (let i = 0; i < count; i++) {
      hints.push(HINT_KEYS[i]);
    }
  } else if (count <= HINT_KEYS.length * HINT_KEYS.length) {
    outer: for (const c1 of HINT_KEYS) {
      for (const c2 of HINT_KEYS) {
        hints.push(c1 + c2);
        if (hints.length >= count) break outer;
      }
    }
  } else if (count <= HINT_KEYS.length * HINT_KEYS.length * HINT_KEYS.length) {
    outer: for (const c1 of HINT_KEYS) {
      for (const c2 of HINT_KEYS) {
        for (const c3 of HINT_KEYS) {
          hints.push(c1 + c2 + c3);
          if (hints.length >= count) break outer;
        }
      }
    }
  } else {
    vscode.window.showErrorMessage(`[エラー] ヒントの表示件数（${count}）が上限を超えました`);
    throw new Error(`[エラー] ヒントの表示件数（${count}）が上限を超えました`);
  }
  return hints;
}

/**
 * ヒント文字列にDecorationを適用する
 * @param prefix すでに入力されたヒント文字列（残りの部分だけ表示）
 */
function applyHintDecorations(
  editor: vscode.TextEditor,
  hintEntries: { hint: string; line: number; col: number }[],
  prefix: string,
): vscode.TextEditorDecorationType[] {
  const decorationTypes: vscode.TextEditorDecorationType[] = [];

  // for (const entry of hintEntries) {
  //   if (!entry.hint.startsWith(prefix)) continue;
  //   const displayText = entry.hint.slice(prefix.length);
  //   if (!displayText) continue;
  //   const pos = new vscode.Position(entry.line, entry.col);
  //   const range = new vscode.Range(pos, pos.translate(0, displayText.length)); // ヒント文字数分（上書きしたい領域）のRangeを作る
  //   const decorationType = vscode.window.createTextEditorDecorationType({
  //     color: 'transparent', // 元のテキストを透明にして隠す（文字の幅自体は維持される）
  //     before: {
  //       contentText: displayText,
  //       color: '#000000',
  //       backgroundColor: '#fabd2f',
  //       fontWeight: 'bold',
  //       border: '1px solid #d79921',
  //       margin: `0 -${displayText.length}ch 0 0`, // ネガティブマージンで、ズレた右側のテキストを元の位置に引き戻す。chは等幅フォントの1文字幅を表す
  //     },
  //   });
  //   editor.setDecorations(decorationType, [range]);
  //   decorationTypes.push(decorationType);
  // }

  for (const entry of hintEntries) {
    if (!entry.hint.startsWith(prefix)) continue;
    const displayText = entry.hint.slice(prefix.length);
    if (!displayText) continue;

    const firstChar = displayText[0];
    const restChars = displayText.slice(1);
    const pos = new vscode.Position(entry.line, entry.col);

    // 1文字目
    const firstRange = new vscode.Range(pos, pos.translate(0, 1));
    const firstDecoration = vscode.window.createTextEditorDecorationType({
      color: 'transparent',
      before: {
        contentText: firstChar,
        color: '#000000',
        backgroundColor: '#fabd2f',
        fontWeight: 'bold',
        border: '0px solid transparent; position: relative; z-index: 9999; outline: 2px solid #d79921;',
        margin: `0 -1ch 0 0`,
      },
    });
    editor.setDecorations(firstDecoration, [firstRange]);
    decorationTypes.push(firstDecoration);

    // 2文字目以降
    if (restChars.length > 0) {
      const restRange = new vscode.Range(pos.translate(0, 1), pos.translate(0, 1 + restChars.length));
      const restDecoration = vscode.window.createTextEditorDecorationType({
        color: 'transparent',
        before: {
          contentText: restChars,
          color: '#000000',
          backgroundColor: '#e6ae2c',
          fontWeight: 'bold',
          border: '0px solid transparent; position: relative; z-index: 9999;',
          margin: `0 -${restChars.length}ch 0 0`,
        },
      });
      editor.setDecorations(restDecoration, [restRange]);
      decorationTypes.push(restDecoration);
    }
  }

  return decorationTypes;
}

/**
 * 全Decorationを削除してdisposeする
 */
export function clearDecorations(editor: vscode.TextEditor, decorationTypes: vscode.TextEditorDecorationType[]): void {
  for (const d of decorationTypes) {
    editor.setDecorations(d, []);
    d.dispose();
  }
}

/**
 * 表示領域にヒントを表示してユーザーの入力を待ち、選択された領域情報を返す
 */
export async function pickRegion(regions: RegionInfo[]): Promise<RegionInfo | null> {
  if (regions.length === 0) return null;
  if (regions.length === 1) return regions[0];

  const hints = generateHints(regions.length);
  const hintEntries = regions.map((region, i) => ({
    hint: hints[i],
    line: region.line,
    col: region.col,
  }));
  const actualMaxLen = hints.reduce((m, h) => Math.max(m, h.length), 1);

  const editor = getActiveEditor();
  let prefix = '';
  while (prefix.length < actualMaxLen) {
    const decorationTypes = applyHintDecorations(editor, hintEntries, prefix);
    const char = await getOneChar();
    clearDecorations(editor, decorationTypes);

    // Escでキャンセル
    if (!char) return null;

    const nextPrefix = prefix + char;
    const matched = hintEntries.filter((e) => e.hint.startsWith(nextPrefix));
    if (matched.length === 0) return null; // マッチなし -> キャンセル
    if (matched.length === 1 || nextPrefix.length >= actualMaxLen) {
      // ヒントを選択 -> アクション
      return regions[hintEntries.indexOf(matched[0])];
    }

    prefix = nextPrefix;
  }

  return null;
}
