import * as vscode from 'vscode';
import { EditorHelper } from '@utils/editorHelper/EditorHelper';
import { OperationRange } from '@utils/operation/operationType';
import { DEFAULT_INDENT_MAP, INDENT_SENSITIVE_LANGUAGES } from '@utils/config/indent';

// -----------------------------------------------------------------------
// インデント幅の自動検出
// -----------------------------------------------------------------------

/**
 * ファイルの先頭N行を調べてインデント幅を自動検出する
 * 行と行のインデント差（0を除く）で最も多い値を返す
 */
function detectIndentFromLines(helper: EditorHelper, scanLines: number): number {
  const totalLines = Math.min(helper.editor.document.lineCount, scanLines);

  // 各行のインデント幅を計算
  const indentCounts: number[] = [];
  for (let i = 0; i < totalLines; i++) {
    const lineText = helper.document.getLineText(i);
    if (isWhitespaceLine(lineText)) continue;
    const tabSpaces = ' '.repeat(4); // QUESTION: タブサイズを４としているが、どう決めればいいか
    const expanded = lineText.replace(/\t/g, tabSpaces);
    let indent = 0;
    while (indent < expanded.length && expanded[indent] === ' ') indent++;
    indentCounts.push(indent);
  }

  // 行間のインデント差を計算
  const diffs: number[] = [];
  for (let i = 1; i < indentCounts.length; i++) {
    const diff = Math.abs(indentCounts[i] - indentCounts[i - 1]);
    if (diff > 0) diffs.push(diff);
  }

  if (diffs.length === 0) return 2; // デフォルト

  // 最も多いdiffを返す
  const freqMap = new Map<number, number>();
  for (const d of diffs) {
    freqMap.set(d, (freqMap.get(d) ?? 0) + 1);
  }
  let maxFreq = 0;
  let detectedIndent = 2;
  for (const [indent, freq] of freqMap.entries()) {
    if (freq > maxFreq) {
      maxFreq = freq;
      detectedIndent = indent;
    }
  }
  return detectedIndent;
}

/** ファイルの拡張子からデフォルトのインデント幅を返す */
function getIndentByLanguageId(helper: EditorHelper): number | null {
  return DEFAULT_INDENT_MAP[helper.editor.document.languageId] ?? null;
}

/** インデント幅を取得する */
function getIndentWidth(helper: EditorHelper, scanLines: number): number {
  return getIndentByLanguageId(helper) ?? detectIndentFromLines(helper, scanLines);
}

// -----------------------------------------------------------------------
// 行のインデント幅を取得
// -----------------------------------------------------------------------

function getLineIndent(tabSize: number, lineText: string): number {
  const tabSpaces = ' '.repeat(tabSize);
  const expanded = lineText.replace(/\t/g, tabSpaces);
  let indent = 0;
  while (indent < expanded.length && expanded[indent] === ' ') indent++;
  return indent;
}

// -----------------------------------------------------------------------
// 空白行判定
// -----------------------------------------------------------------------

function isWhitespaceLine(lineText: string): boolean {
  return /^\s*$/.test(lineText);
}

// -----------------------------------------------------------------------
// エントリーポイント
// -----------------------------------------------------------------------

/**
 * カレント行のインデントを基準に、そのインデント以上に深い行の範囲を返す
 * @param outerLevel カレントインデントよりも外側のインデントも検索範囲に含める。数値が大きくなるほどインデントがより浅さくなる
 * @param scanLines インデント自動検出に使う行数
 * @param skipWhitespaceLines カレントインデントが0でない場合、空行や空白からなる行で検索をストップするかどうか
 */
export function getSurroundByIndent(
  args: {
    outerLevel?: number;
    scanLines?: number;
    skipWhitespaceLines?: boolean;
  } = {},
): OperationRange | null {
  const { outerLevel = 1, scanLines = 100, skipWhitespaceLines = false } = args;

  const helper = new EditorHelper();
  const currentLineText = helper.getCurrentLineText();

  if (isWhitespaceLine(currentLineText)) return null;

  const indentWidth = getIndentWidth(helper, scanLines);
  const tabSize = indentWidth;
  const currentIndent = getLineIndent(tabSize, currentLineText);
  const targetIndent = Math.max(0, currentIndent - (outerLevel - 1) * indentWidth);

  // targetLineは上下方向に探索するための基準ライン
  let targetLine = helper.cursor.get().line;
  if (outerLevel !== 1) {
    for (let line = targetLine - 1; line >= 0; line--) {
      const lineText = helper.document.getLineText(line);
      const indent = getLineIndent(tabSize, lineText);
      if (isWhitespaceLine(lineText)) continue;
      if (indent < targetIndent) break;
      if (indent > targetIndent) continue;
      targetLine = line;
      if (targetIndent === 0) break;
    }
  }

  // targetIndentが0の場合: 空行が現れるまでを範囲とする
  if (targetIndent === 0) {
    let startLine = targetLine;
    let endLine = targetLine;

    // 上方向に空行が現れるまで探索
    for (let line = targetLine - 1; line >= 0; line--) {
      const lineText = helper.document.getLineText(line);
      const indent = getLineIndent(tabSize, lineText);
      if (isWhitespaceLine(lineText) || indent > 0) break;
      startLine = line;
    }

    // 下方向に空行が現れるまで探索
    let reachedEndIndentZero = false;
    let hasEnteredDeeper = false;
    for (let line = targetLine + 1; line < helper.editor.document.lineCount; line++) {
      const lineText = helper.document.getLineText(line);
      const indent = getLineIndent(tabSize, lineText);

      if (isWhitespaceLine(lineText)) {
        if (hasEnteredDeeper) continue;
        break;
      }

      if (indent === 0) {
        if (hasEnteredDeeper) reachedEndIndentZero = true;
        hasEnteredDeeper = false;
      } else hasEnteredDeeper = true;

      if (reachedEndIndentZero) {
        if (indent !== 0 || INDENT_SENSITIVE_LANGUAGES.includes(helper.editor.document.languageId)) break;
      }

      endLine = line;
    }

    return {
      startLine,
      startCol: 0,
      endLine,
      endCol: helper.document.getLineText(endLine).length,
      mode: 'line',
    };
  }

  // targetIndentが0より大きい場合: targetIndent以上の行を対象
  let startLine = targetLine;
  let endLine = targetLine;

  // 上方向にtargetIndentより浅い行が現れるまで探索
  for (let line = targetLine - 1; line >= 0; line--) {
    const lineText = helper.document.getLineText(line);
    if (skipWhitespaceLines && isWhitespaceLine(lineText)) break;
    const indent = getLineIndent(tabSize, lineText);
    if (indent < targetIndent) {
      if (isWhitespaceLine(lineText)) continue;
      break;
    }
    startLine = line;
  }

  // 下方向にtargetIndentより浅い行が現れるまで探索
  for (let line = targetLine + 1; line < helper.editor.document.lineCount; line++) {
    const lineText = helper.document.getLineText(line);
    if (skipWhitespaceLines && isWhitespaceLine(lineText)) break;
    const indent = getLineIndent(tabSize, lineText);
    if (indent < targetIndent) {
      if (isWhitespaceLine(lineText)) continue;
      break;
    }
    endLine = line;
  }

  return {
    startLine,
    startCol: 0,
    endLine,
    endCol: helper.document.getLineText(endLine).length,
    mode: 'line',
  };
}
