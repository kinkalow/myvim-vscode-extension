import * as vscode from 'vscode';
import { OperationRange } from '@utils/operation/operationType';
import { getActiveEditor } from '@utils/editor';
import { getFunctionRangeForJavaScript, getFunctionRangeForPython, getFunctionRangeForCpp } from './function/index';
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

export function getSurroundByFunction(count: number, textObjectPrefix: TextObjectPrefix): OperationRange | null {
  const editor = getActiveEditor();
  const languageId = editor.document.languageId;
  const functionName = LANGUAGEID_TO_FUNCTIONFILE[languageId];
  if (functionName === 'cpp') return getFunctionRangeForCpp(count, textObjectPrefix, editor);
  else if (functionName === 'javascript') return getFunctionRangeForJavaScript(count, textObjectPrefix, editor);
  else if (functionName === 'python') return getFunctionRangeForPython(count, textObjectPrefix, editor);
  return null;
}
