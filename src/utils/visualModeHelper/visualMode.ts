import { getActiveEditor } from '@utils/editor/editor';
import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';

export type VisualMode = 'char' | 'line' | 'block';

export interface VisualLineRange {
  line: number; // 行番号
  startCol: number; // 開始列番号
  endCol: number; // 終了列番号
}

export interface VisualRange {
  mode: VisualMode; // visualモード
  lines: VisualLineRange[]; // 複数の行番号と列番号
  text: string; // linesに対応するテキスト
}

/**
 * Visualの選択範囲の情報を返す
 * @returns VisualRange | null
 *   - mode: Visualモード
 *   - lines: 選択範囲の情報 {line: 行番号、startCol: 開始列番号、endCol: 終了列番号}
 *   - text: 選択範囲のテキスト
 */
export function getVisualRange(): VisualRange | null {
  const editor = getActiveEditor();
  const mode = visualModeHelper.getLastMode();

  const selections = editor.selections;
  if (selections.length === 0) return null;
  const sel = selections[0];
  if (sel.isEmpty) return null;

  const startLine = sel.start.line;
  const endLine = sel.end.line;
  const text = editor.document.getText(sel);

  if (mode === 'char') {
    const lines: VisualLineRange[] = [];
    for (let line = startLine; line <= endLine; line++) {
      const lineText = editor.document.lineAt(line).text;
      const startCol = line === startLine ? sel.start.character : 0;
      const endCol = line === endLine ? sel.end.character - 1 : Math.max(0, lineText.length - 1);
      lines.push({ line, startCol, endCol });
    }
    return { mode, lines, text };
  } else if (mode === 'line') {
    const lines: VisualLineRange[] = [];
    for (let line = startLine; line <= endLine; line++) {
      const lineText = editor.document.lineAt(line).text;
      lines.push({ line, startCol: 0, endCol: Math.max(0, lineText.length - 1) });
    }
    return { mode, lines, text };
  } else {
    const lines: VisualLineRange[] = selections
      .filter((sel) => !sel.isEmpty)
      .map((sel) => ({
        line: sel.start.line,
        startCol: sel.start.character,
        endCol: sel.end.character - 1,
      }))
      .sort((a, b) => a.line - b.line);
    if (lines.length === 0) return null;
    const text = lines.map((l) => editor.document.lineAt(l.line).text.substring(l.startCol, l.endCol + 1)).join('\n');
    return { mode, lines, text };
  }
}

//
//
//

export type SelectionProcedure = 'current' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * 現在のカーソル位置から、Visualモードの選択手順（方向）を分類する関数
 */
export function classifySelectionProcedure(
  currentLine: number,
  currentCol: number,
  range: VisualRange,
): SelectionProcedure | null {
  if (!range.lines || range.lines.length === 0) {
    return null;
  }

  const topLine = range.lines[0].line;
  const bottomLine = range.lines[range.lines.length - 1].line;
  const topLeftCol = range.lines[0].startCol;
  const topRightCol = range.lines[0].endCol;
  const bottomLeftCol = range.lines[range.lines.length - 1].startCol;
  const bottomRightCol = range.lines[range.lines.length - 1].endCol;

  switch (range.mode) {
    case 'line': {
      return 'current';
    }

    case 'char': {
      if (currentLine === topLine && currentCol === topLeftCol) return 'top-left';
      if (currentLine === bottomLine && currentCol === bottomRightCol) return 'bottom-right';
      return null;
    }

    case 'block': {
      if (currentLine === topLine && currentCol === topLeftCol) return 'top-left';
      if (currentLine === topLine && currentCol === topRightCol) return 'top-right';
      if (currentLine === bottomLine && currentCol === bottomLeftCol) return 'bottom-left';
      if (currentLine === bottomLine && currentCol === bottomRightCol) return 'bottom-right';
      return null;
    }
  }
}