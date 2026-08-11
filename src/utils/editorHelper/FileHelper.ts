import * as vscode from 'vscode';

export class FileHelper {
  constructor(private readonly editor: vscode.TextEditor) {}

  /** カレントファイルの拡張子を取得する */
  getExtension(): string {
    const fileName = this.editor.document.fileName;
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return ext;
  }
}
