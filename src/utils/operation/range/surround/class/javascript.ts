import { OperationRange } from '@utils/operation/operationType';
import * as vscode from 'vscode';
import * as ts from 'typescript';
import { TextObjectPrefix } from '../type';

function getScriptKindFromLanguageId(languageId: string): ts.ScriptKind {
  switch (languageId) {
    case 'typescript':
      return ts.ScriptKind.TS;
    case 'typescriptreact':
      return ts.ScriptKind.TSX;
    case 'javascript':
      return ts.ScriptKind.JS;
    case 'javascriptreact':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.TS;
  }
}

export function getClassRangeForJavaScript(
  nth: number,
  textObjectPrefix: TextObjectPrefix,
  editor: vscode.TextEditor,
): OperationRange | null {
  const document = editor.document;
  const cursorOffset = document.offsetAt(editor.selection.active);
  const text = document.getText();

  // AST作成
  const sourceFile = ts.createSourceFile(
    document.fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    getScriptKindFromLanguageId(document.languageId),
  );

  // クラスを表すノードを探索
  const classNodes: (ts.ClassDeclaration | ts.ClassExpression)[] = [];
  function visit(node: ts.Node): void {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      classNodes.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const enclosing = classNodes
    .filter((n) => n.getStart(sourceFile) <= cursorOffset)
    .sort((a, b) => b.getStart(sourceFile) - a.getStart(sourceFile));

  const target = enclosing[nth - 1];
  if (!target) {
    return null;
  }

  // クラスの開始位置と終了位置
  const startPos = sourceFile.getLineAndCharacterOfPosition(target.getStart(sourceFile));
  const endPos = sourceFile.getLineAndCharacterOfPosition(target.getEnd());

  return {
    startLine: startPos.line,
    startCol: startPos.character,
    endLine: endPos.line,
    endCol: endPos.character,
    mode: textObjectPrefix === 'i' ? 'char' : 'line',
  };
}