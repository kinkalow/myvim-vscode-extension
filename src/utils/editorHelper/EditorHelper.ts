import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor';
import {
  ClipboardHelper,
  ConfigHelper,
  CursorHelper,
  DocumentHelper,
  EditHelper,
  FileHelper,
  DecorationHelper,
  SearchHelper,
  VimHelper,
} from './index';
import { waitForSelectionSettled } from '@utils/wait';
import { SELECTION_SETTLE_DELAY_MS } from '@utils/config/editor';

export class EditorHelper {
  readonly editor: vscode.TextEditor;

  readonly clipboard: ClipboardHelper;
  readonly config: ConfigHelper;
  readonly cursor: CursorHelper;
  readonly decoration: DecorationHelper;
  readonly document: DocumentHelper;
  readonly edit: EditHelper;
  readonly file: FileHelper;
  readonly search: SearchHelper;
  readonly vim: VimHelper;

  constructor(editor?: vscode.TextEditor) {
    this.editor = editor ?? getActiveEditor();

    this.clipboard = new ClipboardHelper(this.editor);
    this.config = new ConfigHelper(this.editor);
    this.cursor = new CursorHelper(this.editor);
    this.decoration = new DecorationHelper(this.editor);
    this.document = new DocumentHelper(this.editor);
    this.file = new FileHelper(this.editor);
    this.edit = new EditHelper(this.editor);
    this.search = new SearchHelper(this.editor);
    this.vim = new VimHelper(this.editor);
  }

  /** カレントラインのテキストを返す */
  getCurrentLineText(): string {
    const line = this.editor.selection.active.line;
    return this.editor.document.lineAt(line).text;
  }

  /** 表示領域外なら中央に表示する */
  revealIfOutsideViewPort(line: number, col: number): void {
    const pos = new vscode.Position(line, col);
    const isVisible = this.editor.visibleRanges.some((range) => range.contains(pos));
    if (!isVisible) {
      this.editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }
  }

  /** selection変更終了まで待機 */
  async waitForSelectionSettled(delayMs = SELECTION_SETTLE_DELAY_MS): Promise<void> {
    await waitForSelectionSettled(delayMs);
  }
}
