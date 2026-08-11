import * as vscode from 'vscode';
import { getOneChar } from '@utils/ui/input';
import { areGroupSizesEqual, GroupResizer } from '@utils/group';

let windowMode = false;
let curMode = 'move';
let statusBar: vscode.StatusBarItem;
let moveModeColor: string;
let resizeModeColor: string;
let lineDecorationType: vscode.TextEditorDecorationType | undefined;
let cursorDecorationType: vscode.TextEditorDecorationType | undefined;
let savedLayout: unknown = null;

// --- 登録 ---

export function registerWindowMode(context: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(statusBar);
}

// --- デコレーション作成・破棄 ---

function createDecorationTypes() {
  const lineColor = curMode === 'move' ? moveModeColor : resizeModeColor;

  lineDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: lineColor,
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

// --- デコレーション適用・クリア ---

/** editorのデコレーションをクリア */
function clearDecorationOn(editor: vscode.TextEditor) {
  if (lineDecorationType) editor.setDecorations(lineDecorationType, []);
  if (cursorDecorationType) editor.setDecorations(cursorDecorationType, []);
}

/** 全visibleEditorをクリア */
function clearAllDecorations() {
  for (const editor of vscode.window.visibleTextEditors) {
    clearDecorationOn(editor);
  }
}

/** editorにハイライトを適用する */
function applyDecorationsTo(editor: vscode.TextEditor, prevEditor?: vscode.TextEditor) {
  if (!lineDecorationType || !cursorDecorationType) return;

  if (prevEditor && prevEditor !== editor) {
    clearDecorationOn(prevEditor);
  }

  const cursor = editor.selection.active;
  const lineEnd = editor.document.lineAt(cursor.line).range.end;

  // 行全体をハイライト
  const lineRange = new vscode.Range(cursor.line, 0, cursor.line, lineEnd.character);
  editor.setDecorations(lineDecorationType, [lineRange]);

  // カーソル位置をハイライト
  const charEnd = cursor.character < lineEnd.character ? new vscode.Position(cursor.line, cursor.character + 1) : lineEnd;
  const cursorRange = new vscode.Range(cursor, charEnd);
  editor.setDecorations(cursorDecorationType, [cursorRange]);
}

/** アクティブエディタにデコレーションを適用 */
function applyDecorations() {
  const editor = vscode.window.activeTextEditor;
  if (editor) applyDecorationsTo(editor);
}

// --- カーソルスタイル ---

function applyEditorOptions(editor: vscode.TextEditor) {
  editor.options = {
    ...editor.options,
    cursorStyle: curMode === 'move' ? vscode.TextEditorCursorStyle.Block : vscode.TextEditorCursorStyle.Underline,
  };
}

function restoreEditorOptions(editor: vscode.TextEditor) {
  editor.options = {
    ...editor.options,
    cursorStyle: vscode.TextEditorCursorStyle.Block,
  };
}

// --- ウィンドウモードの入口と出口 ---

export async function enterWindowMode() {
  windowMode = true;
  curMode = 'move';

  const configMode = vscode.workspace.getConfiguration('myvim-window-windowMode');
  moveModeColor = configMode.get<string>('moveModeColor') ?? '#ff000044';
  resizeModeColor = configMode.get<string>('resizeModeColor') ?? '#00ff0044';

  createDecorationTypes();

  statusBar.text = '-- WINDOW MODE [MOVE] --';
  statusBar.show();

  const initialEditor = vscode.window.activeTextEditor;
  if (initialEditor) {
    applyDecorationsTo(initialEditor);
    applyEditorOptions(initialEditor);
  }

  await inputLoop();
}

function exit() {
  windowMode = false;

  clearAllDecorations();
  disposeDecorationTypes();

  const editor = vscode.window.activeTextEditor;
  if (editor) restoreEditorOptions(editor);

  statusBar.hide();
}

// --- モード切替 ---

function switchMode() {
  if (curMode === 'move') {
    curMode = 'resize';
    statusBar.text = '-- WINDOW MODE [RESIZE] --';
  } else {
    curMode = 'move';
    statusBar.text = '-- WINDOW MODE [MOVE] --';
  }

  // Mode変更によりハイライトが変わるので作り直す
  disposeDecorationTypes();
  createDecorationTypes();
  applyDecorations();
  const editor = vscode.window.activeTextEditor;
  if (editor) applyEditorOptions(editor);
}

// --- キー入力ループ ---

async function inputLoop() {
  const resizer = new GroupResizer();
  while (windowMode) {
    const char = await getOneChar();

    switch (char) {
      case 'h':
        await left(resizer);
        break;
      case 'H':
        await reverseLeft(resizer);
        break;
      case 'j':
        await down(resizer);
        break;
      case 'J':
        await reverseDown(resizer);
        break;
      case 'k':
        await up(resizer);
        break;
      case 'K':
        await reverseUp(resizer);
        break;
      case 'l':
        await right(resizer);
        break;
      case 'L':
        await reverseRight(resizer);
        break;
      case 'q':
      case ';':
      case ' ':
      case '':
        exit();
        return;
      case 'm':
        await goPreviousTab();
        break;
      case 'n':
        await goNextTab();
        break;
      case 'i':
        await toggleMaximizeOrRestore();
        break;
      case 'o':
        switchMode();
        break;
      case 'u':
        await toggleEvenOrRestore();
        break;
      default:
        break;
    }

    if (windowMode) {
      applyDecorations();
    }
  }
}

// --- 移動・リサイズ操作 ---

async function moveToGroup(focusCmd: string): Promise<void> {
  const prevEditor = vscode.window.activeTextEditor;
  await vscode.commands.executeCommand(focusCmd);
  // await new Promise<void>((resolve) => setTimeout(resolve, 50));
  const nextEditor = vscode.window.activeTextEditor;
  if (nextEditor) {
    applyDecorationsTo(nextEditor, prevEditor ?? undefined);
    applyEditorOptions(nextEditor);
  } else if (prevEditor) {
    applyDecorationsTo(prevEditor);
  }
}

async function up(resizer: GroupResizer) {
  if (curMode === 'move') {
    await moveToGroup('workbench.action.focusAboveGroup');
    return;
  }
  if (await resizer.hasUpGroup()) await resizer.growUp();
  else await resizer.shrinkDown();
}
async function reverseUp(resizer: GroupResizer) {
  if (curMode === 'move') {
    await moveToGroup('workbench.action.focusAboveGroup');
    return;
  }
  if (await resizer.hasUpGroup()) await resizer.shrinkUp();
  else await resizer.growDown();
}

async function down(resizer: GroupResizer) {
  if (curMode === 'move') {
    await moveToGroup('workbench.action.focusBelowGroup');
    return;
  }
  if (await resizer.hasDownGroup()) await resizer.growDown();
  else await resizer.shrinkUp();
}
async function reverseDown(resizer: GroupResizer) {
  if (curMode === 'move') {
    await moveToGroup('workbench.action.focusBelowGroup');
    return;
  }
  if (await resizer.hasDownGroup()) await resizer.shrinkDown();
  else await resizer.growUp();
}

async function left(resizer: GroupResizer) {
  if (curMode === 'move') {
    await moveToGroup('workbench.action.focusLeftGroup');
    return;
  }
  if (await resizer.hasLeftGroup()) await resizer.growLeft();
  else await resizer.shrinkRight();
}
async function reverseLeft(resizer: GroupResizer) {
  if (curMode === 'move') {
    await moveToGroup('workbench.action.focusLeftGroup');
    return;
  }
  if (await resizer.hasLeftGroup()) await resizer.shrinkLeft();
  else await resizer.growRight();
}

async function right(resizer: GroupResizer) {
  if (curMode === 'move') {
    await moveToGroup('workbench.action.focusRightGroup');
    return;
  }
  if (await resizer.hasRightGroup()) await resizer.growRight();
  else await resizer.shrinkLeft();
}
async function reverseRight(resizer: GroupResizer) {
  if (curMode === 'move') {
    await moveToGroup('workbench.action.focusRightGroup');
    return;
  }
  if (await resizer.hasRightGroup()) await resizer.shrinkRight();
  else await resizer.growLeft();
}

async function toggleMaximizeOrRestore() {
  await vscode.commands.executeCommand('workbench.action.toggleMaximizeEditorGroup');
}

async function toggleEvenOrRestore() {
  const isEven = await areGroupSizesEqual();
  if (!isEven) {
    savedLayout = await vscode.commands.executeCommand('vscode.getEditorLayout');
    await vscode.commands.executeCommand('workbench.action.evenEditorWidths'); // 均等サイズにする
  } else {
    if (savedLayout) {
      await vscode.commands.executeCommand('vscode.setEditorLayout', savedLayout); // 元のレイアウトに戻す
    }
  }
}

// --- タブ ----

async function goNextTab() {
  await vscode.commands.executeCommand('workbench.action.nextEditorInGroup');
}

async function goPreviousTab() {
  await vscode.commands.executeCommand('workbench.action.previousEditorInGroup');
}
