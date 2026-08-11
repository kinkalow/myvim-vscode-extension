import * as vscode from 'vscode';
import { getOneChar } from '@utils/ui/input';

let statusBar: vscode.StatusBarItem;
let halfPageScroll = false;
let lineDecorationType: vscode.TextEditorDecorationType | undefined;
let cursorDecorationType: vscode.TextEditorDecorationType | undefined;
let onDidChangeActiveEditor: vscode.Disposable | undefined;
let onDidChangeSelection: vscode.Disposable | undefined;

// --- 登録 ---
export function registorHalfPageScroll(context: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(statusBar);
}

// ---- デコレーション作成・破棄 ----

function createDecorationTypes(color: string) {
  lineDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: color,
  });

  cursorDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.foreground'),
    color: new vscode.ThemeColor('editor.background'),
    fontWeight: 'bold',
  });
}

function disposeDecorationTypes() {
  lineDecorationType?.dispose();
  cursorDecorationType?.dispose();
  lineDecorationType = undefined;
  cursorDecorationType = undefined;
}

// ---- デコレーション適用・クリア ----

function clearDecorationOn(editor: vscode.TextEditor) {
  if (lineDecorationType) editor.setDecorations(lineDecorationType, []);
  if (cursorDecorationType) editor.setDecorations(cursorDecorationType, []);
}

function clearAllDecorations() {
  for (const editor of vscode.window.visibleTextEditors) {
    clearDecorationOn(editor);
  }
}

function applyDecorationsTo(editor: vscode.TextEditor) {
  if (!lineDecorationType || !cursorDecorationType) return;

  const cursor = editor.selection.active;
  const lineEnd = editor.document.lineAt(cursor.line).range.end;

  // 行全体をハイライト
  const lineRange = new vscode.Range(cursor.line, 0, cursor.line, lineEnd.character);
  editor.setDecorations(lineDecorationType, [lineRange]);

  // カーソル位置をハイライト
  const charEnd = cursor.character < lineEnd.character
    ? new vscode.Position(cursor.line, cursor.character + 1)
    : lineEnd;
  editor.setDecorations(cursorDecorationType, [new vscode.Range(cursor, charEnd)]);
}

function applyDecorations() {
  const editor = vscode.window.activeTextEditor;
  if (editor) applyDecorationsTo(editor);
}

// ---- スクロールモード ----

export async function enterHalfPageScroll(args: { direction: 'up' | 'down' | 'none' }) {
  const { direction = 'none' } = args;
  if (direction !== 'up' && direction !== 'down' && direction !== 'none') return;

  halfPageScroll = true;
  statusBar.text = '-- HALF PAGE SCROLL --';
  statusBar.show();

  const configHPS = vscode.workspace.getConfiguration('myvim-motion-halfPageScroll');
  const halfPageScrollColor = configHPS.get<string>('color') ?? '#ff000044';

  createDecorationTypes(halfPageScrollColor);
  applyDecorations();

  // カーソルが動くたびにハイライトを更新
  onDidChangeSelection = vscode.window.onDidChangeTextEditorSelection((e) => {
    if (e.textEditor === vscode.window.activeTextEditor) {
      applyDecorationsTo(e.textEditor);
    }
  });

  // グループ移動時は旧エディタをクリアして新エディタに適用
  onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
    clearAllDecorations();
    if (editor) applyDecorationsTo(editor);
  });

  if (direction === 'up') up();
  else if (direction === 'down') down();

  await inputLoop();
}

export function exitHalfPageScroll() {
  halfPageScroll = false;

  onDidChangeSelection?.dispose();
  onDidChangeSelection = undefined;
  onDidChangeActiveEditor?.dispose();
  onDidChangeActiveEditor = undefined;

  clearAllDecorations();
  disposeDecorationTypes();

  statusBar.hide();
}

// ---- キー入力ループ ----

async function inputLoop() {
  while (halfPageScroll) {
    const char = await getOneChar();
    switch (char) {
      case 'j': await down(); break;
      case 'k': await up(); break;
      default:
        exitHalfPageScroll();
        return;
    }
  }
}

// ---- 操作 ----

export async function down() {
  await vscode.commands.executeCommand('editorScroll', { to: 'down', by: 'halfPage', revealCursor: true });
  // await vscode.commands.executeCommand('cursorPageDown');
}

export async function up() {
  await vscode.commands.executeCommand('editorScroll', { to: 'up', by: 'halfPage', revealCursor: true });
  // await vscode.commands.executeCommand('cursorPageUp');
}