import { getActiveEditor } from '@utils/editor/editor';
import { visualModeManager } from '@utils/VisualModeManager';

export const VisualModes = ['char', 'line', 'block'] as const;
export type VisualMode = (typeof VisualModes)[number];

interface VisualSelection {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  text: string;
}

class VisualModeHelper {
  private keyMap: Record<VisualMode, string[]> = {
    char: ['<C-a>', '|', 'v'],
    line: ['<C-a>', '|', 'V'],
    block: ['<C-a>', '|', '<C-v>'],
  };

  setLastMode(mode: VisualMode): void {
    visualModeManager.setLastMode(mode);
  }

  getLastMode(): VisualMode {
    return visualModeManager.getLastMode();
  }

  getVimMapping(mode: VisualMode, { returnType = 'string' }: { returnType?: 'string' | 'array' } = {}): string | string[] {
    const keys = this.keyMap[mode];
    return returnType === 'string' ? keys.join('') : keys;
  }

  getLastVimMapping({ returnType = 'string' }: { returnType?: 'string' | 'array' } = {}): string | string[] {
    return this.getVimMapping(visualModeManager.getLastMode(), { returnType });
  }

  /** 選択範囲の開始位置と終了位置およびテキストを返す */
  getVisualSelection(): VisualSelection | null {
    const editor = getActiveEditor();
    const document = editor.document;
    const selections = editor.selections;
    if (selections.length === 0) return null;
    const isBlock = selections.length > 1;
    if (isBlock) {
      const startLine = Math.min(...selections.map((s) => s.start.line));
      const endLine = Math.max(...selections.map((s) => s.end.line));
      const startCol = Math.min(...selections.map((s) => s.start.character));
      const endCol = Math.max(...selections.map((s) => s.end.character)) - 1;
      const text = selections.map((s) => document.getText(s)).join('\n');
      return { startLine, startCol, endLine, endCol, text };
    }
    const selection = selections[0];
    if (selection.isEmpty) return null;
    return {
      startLine: selection.start.line,
      startCol: selection.start.character,
      endLine: selection.end.line,
      endCol: selection.end.character - 1,
      text: document.getText(selection),
    };
  }
}

export const visualModeHelper = new VisualModeHelper();
