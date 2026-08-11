import * as vscode from 'vscode';

export function validateBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    vscode.window.showErrorMessage(`[エラー] ${label} は true か false を指定してください`);
    return false;
  }
  return true;
}

export function validateString(value: unknown, label: string): boolean {
  if (typeof value !== 'string') {
    vscode.window.showErrorMessage(`[エラー] ${label}は文字列を指定してください`);
    return false;
  }
  return true;
}

export function validateIncludes(value: string, validValues: readonly string[], label: string): boolean {
  if (value === undefined || !validValues.includes(value)) {
    vscode.window.showErrorMessage(`[エラー] ${label}は次から選択: ${validValues.join(', ')}`);
    return false;
  }
  return true;
}

export function validateTextObj(textObjectPrefix: string, label: string ) {
  if (!textObjectPrefix || (textObjectPrefix !== 'i' && textObjectPrefix !== 'a')) {
    vscode.window.showErrorMessage(`[エラー] ${label} は 'i' か 'a' を指定してください`);
    return false;
  }
  return true;
}
