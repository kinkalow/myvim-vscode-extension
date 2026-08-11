import * as vscode from 'vscode';

/**
 * editor.selectionsの情報を表示する
 */
export function printSelection(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const selections = editor.selections;

  const info = selections
    .map((s, i) => {
      const selectedText = editor.document.getText(s);
      return [
        `--- selection[${i}] ---`,
        `anchor:  line=${s.anchor.line}, char=${s.anchor.character}`,
        `active:  line=${s.active.line}, char=${s.active.character}`,
        `start:   line=${s.start.line}, char=${s.start.character}`,
        `end:     line=${s.end.line}, char=${s.end.character}`,
        `isEmpty: ${s.isEmpty}`,
        `text:    "${selectedText.replace(/\n/g, '\\n')}"`,
      ].join('\n');
    })
    .join('\n');

  vscode.window.showInformationMessage(info);
}
