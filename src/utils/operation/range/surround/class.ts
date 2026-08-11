import * as vscode from 'vscode';
import { OperationRange } from '@utils/operation/operationType';
import { getActiveEditor } from '@utils/editor';
import { getClassRangeForCpp, getClassRangeForJavaScript, getClassRangeForPython } from './class/index';
import { TextObjectPrefix } from './type';

const LANGUAGEID_TO_FUNCTIONFILE: Record<string, string> = {
  c: 'cpp',
  cpp: 'cpp',
  javascript: 'javascript',
  javascriptreact: 'javascript',
  typescript: 'javascript',
  typescriptreact: 'javascript',
  python: 'python',
};

export function getSurroundByClass(count: number, textObjectPrefix: TextObjectPrefix): OperationRange | null {
  const editor = getActiveEditor();
  const languageId = editor.document.languageId;
  const functionName = LANGUAGEID_TO_FUNCTIONFILE[languageId];
  if (functionName === 'cpp') return getClassRangeForCpp(count, textObjectPrefix, editor);
  else if (functionName === 'javascript') return getClassRangeForJavaScript(count, textObjectPrefix, editor);
  else if (functionName === 'python') return getClassRangeForPython(count, textObjectPrefix, editor);
  return null;
}
