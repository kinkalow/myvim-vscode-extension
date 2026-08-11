import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor';
import { openModes, OpenModes, fileHelper } from '@utils/fileHelper/FileHelper';
import { validateIncludes } from '@utils/validation/args';
import { highlightTemporarily } from '@utils/decoration/highlight';
import { yankHighlightStyle } from '@utils/operation/operationConfig';

interface FileLocation {
  path: string;
  line?: number;
  col?: number;
  text?: string; // TODO: QuickPickで使用しようかな
}

class FileViewerOperator {
  private readonly displayedLineToLocation = new Map<number, FileLocation>();

  clear(): void {
    this.displayedLineToLocation.clear();
  }

  set(viewerLine: number, location: FileLocation): void {
    this.displayedLineToLocation.set(viewerLine, location);
  }

  get(viewerLine: number): FileLocation | undefined {
    return this.displayedLineToLocation.get(viewerLine);
  }

  async openFile(viewerLine: number, { openMode = 'current' }: { openMode?: OpenModes } = {}): Promise<void> {
    const location = this.get(viewerLine);
    if (!location) return;
    const line = location.line ?? 0;
    const col = location.col ?? 0;
    await fileHelper.openFile(location.path, { line, col, openMode });
  }

  // async yankText(viewerLine: number): Promise<void> {
  //   const location = this.get(viewerLine);
  //   if (location && location.text) {
  //     await vscode.env.clipboard.writeText(location.text);
  //   }
  // }
}

export const fileViewerOperatior = new FileViewerOperator();

export async function run(args: { action: 'openFile' | 'yankText'; openMode?: OpenModes }): Promise<void> {
  if (!validateIncludes(args.action, ['openFile', 'yankText'], 'action')) return;
  if (args.openMode && !validateIncludes(args.openMode, openModes, 'openMode')) return;

  if (args.action === 'openFile') {
    // カレント行に対応するファイルを開く
    const line = getActiveEditor().selection.active.line;
    await fileViewerOperatior.openFile(line, args.openMode ? { openMode: args.openMode } : {});
  } else if (args.action === 'yankText') {
    // カレント行のテキスト部分をクリップボードにコピーしてハイライトする
    const editor = getActiveEditor();
    const line = editor.selection.active.line;
    const location = fileViewerOperatior.get(line);
    if (location && location.text) {
      const text = location.text;
      await vscode.env.clipboard.writeText(text);
      const lineText = editor.document.lineAt(line).text;
      const startCol = lineText.indexOf(text);
      if (startCol !== -1) {
        const endCol = startCol + text.length;
        const range = { startLine: line, startCol, endLine: line, endCol };
        highlightTemporarily(range, { style: yankHighlightStyle });
      }
    }
  }
}
