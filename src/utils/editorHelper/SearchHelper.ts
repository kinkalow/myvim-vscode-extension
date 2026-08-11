import * as vscode from 'vscode';
import { PatternMatch } from './type';

export class SearchHelper {
  private hasUnescapedSymbols(pattern: string, symbols: string[]): boolean {
    const symbolSet = new Set(symbols);
    for (let i = 0; i < pattern.length; i++) {
      if (!symbolSet.has(pattern[i])) continue;
      let backslashCount = 0;
      for (let j = i - 1; j >= 0 && pattern[j] === '\\'; j--) {
        backslashCount++;
      }
      if (backslashCount % 2 === 0) {
        return true;
      }
    }
    return false;
  }

  constructor(private readonly editor: vscode.TextEditor) {}

  /** 指定位置(line, col)から最終行に向かって、その後先頭行から指定位置手前に進み、patternにマッチする位置とテキストを全て返す
   * @param pattern $^*()+[\|./?の記号を検索したいときエスケープ必要
   * @param isFirstMatchOnly trueの場合、最初にpatternにマッチしたものが見つかった時点で検索を終了する
   * @param rejectUnescapedSymbols この配列に含まれる文字がpattern内でエスケープされずに使われている場合、空配列を返す
   */
  find(
    line: number,
    col: number,
    pattern: string,
    {
      isFirstMatchOnly = false,
      rejectUnescapedSymbols = [],
    }: { isFirstMatchOnly?: boolean; rejectUnescapedSymbols?: string[] } = {},
  ): PatternMatch[] {
    if (this.hasUnescapedSymbols(pattern, rejectUnescapedSymbols)) {
      return [];
    }

    const document = this.editor.document;
    const cursorPos = new vscode.Position(line, col);
    const patternRegExp = new RegExp(pattern, 'g');

    const matches: PatternMatch[] = [];
    const collectMatches = (
      startLine: number,
      startCol: number,
      endLine: number,
      endCol?: number, // 終了列（省略時は行末まで）
    ) => {
      for (let line = startLine; line <= endLine; line++) {
        const lineText = document.lineAt(line).text;
        patternRegExp.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = patternRegExp.exec(lineText)) !== null) {
          const col = match.index;
          if (line === startLine && col < startCol) continue;
          if (endCol !== undefined && line === endLine && col >= endCol) continue;
          matches.push({ startLine: line, startCol: col, endLine: line, endCol: col + match[0].length - 1, text: match[0] });
          if (isFirstMatchOnly) return;
        }
      }
    };

    // カーソル位置から最終行まで検索
    collectMatches(cursorPos.line, cursorPos.character, document.lineCount - 1);
    if (isFirstMatchOnly && matches.length !== 0) return matches;

    // 先頭行からカーソル位置手前まで検索
    collectMatches(0, 0, cursorPos.line, cursorPos.character);

    return matches;
  }

  /** カーソル位置から最終行に向かって、その後先頭行からカーソル位置手前に進み、patternにマッチする位置とテキストを全て返す
   * @param pattern $^*()+[\|./?の記号を検索したいときエスケープ必要
   * @param isFirstMatchOnly trueの場合、最初にpatternにマッチしたものが見つかった時点で検索を終了する
   * @param rejectUnescapedSymbols この配列に含まれる文字がpattern内でエスケープされずに使われている場合、空配列を返す
   */
  findFromCursor(
    pattern: string,
    {
      isFirstMatchOnly = false,
      rejectUnescapedSymbols = [],
    }: { isFirstMatchOnly?: boolean; rejectUnescapedSymbols?: string[] } = {},
  ) {
    const cursorPos = this.editor.selection.active;
    return this.find(cursorPos.line, cursorPos.character, pattern, { isFirstMatchOnly, rejectUnescapedSymbols });
  }
}
