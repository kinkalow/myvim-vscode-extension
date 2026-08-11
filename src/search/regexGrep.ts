import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { waitForSelectionSettled } from '@utils/wait';
import { fileViewerOperatior } from '@utils/ui/FileViewerOperator';
import { pathHelper } from '@utils/pathHelper/PathHelper';
import { getActiveEditor } from '@utils/editor';
import { getLineSurroundByPattern } from '@utils/operation/range/surround/pattern';
import { textPatterns, TextPatternName } from '@utils/config/patterns';
import { getTextInRange } from '@utils/editor/document';
import { fileSystemHelper } from '@utils/fileSystemHelper/FileSystemHelper';
// import { REGEXGREP_VIEWER_FILE_PATH } from '@utils/config/path';

// -----------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------

export interface GrepOptions {
  dir: string; // 検索対象ディレクトリ
  recursive: boolean; // 再帰的に検索するか
  excludeDirs?: string[]; // 除外するディレクトリ名リスト
  pattern: string; // 検索パターン（文字列 or 正規表現文字列）
  useRegex?: boolean; // 正規表現として扱うか
  caseSensitive?: boolean; // 大文字小文字を区別するか
}

export interface GrepMatch {
  filePath: string;
  line: number;
  col: number;
  text: string; // 行全体のテキスト
  matchText: string; // マッチした部分
}

// -----------------------------------------------------------------------
// ディレクトリ種別の定義
// -----------------------------------------------------------------------

export type DirScope =
  | 'project' // プロジェクトルート（workspaceフォルダ）
  | 'current' // カレントファイルと同じディレクトリのみ
  | 'currentFile' // カレントファイルのみ
  | 'currentRecursive' // カレントファイルのディレクトリ以下すべて
  | 'custom'; // カスタムパス指定

/** DirScopeからGrepOptionsのdir/recursiveを解決する */
function resolveDirFromScope(
  scope: DirScope,
  customDir?: string,
  projectSubDir?: string,
): { dir: string; recursive: boolean } | null {
  const editor = vscode.window.activeTextEditor;

  switch (scope) {
    case 'project': {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('[エラー] ワークスペースが開かれていません');
        return null;
      }
      const workspacePath = workspaceFolders[0].uri.fsPath;
      const targetDir = projectSubDir ? path.join(workspacePath, projectSubDir) : workspacePath;
      return { dir: targetDir, recursive: true };
    }
    case 'current': {
      if (!editor) {
        vscode.window.showErrorMessage('[エラー] アクティブなエディタがありません');
        return null;
      }
      const currentDir = path.dirname(editor.document.uri.fsPath);
      return { dir: currentDir, recursive: false };
    }
    case 'currentFile': {
      return { dir: '', recursive: false };
    }
    case 'currentRecursive': {
      if (!editor) {
        vscode.window.showErrorMessage('[エラー] アクティブなエディタがありません');
        return null;
      }
      const currentDir = path.dirname(editor.document.uri.fsPath);
      return { dir: currentDir, recursive: true };
    }
    case 'custom': {
      if (!customDir) {
        vscode.window.showErrorMessage('[エラー] カスタムディレクトリが指定されていません');
        return null;
      }
      return { dir: customDir, recursive: true };
    }
  }
}

/** Node.js fsを使ったgrep実装（任意ディレクトリ対応） */
async function grepWithFs(options: GrepOptions): Promise<GrepMatch[]> {
  const { dir, recursive, pattern, useRegex = true, caseSensitive = true } = options;

  let regex: RegExp;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    const regexPattern = useRegex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(regexPattern, flags);
  } catch {
    vscode.window.showErrorMessage(`[エラー] 無効な正規表現: ${pattern}`);
    return [];
  }

  let files;
  if (dir === '') {
    // カレントファイル対象
    files = [getActiveEditor().document.uri.fsPath];
  } else {
    files = fileSystemHelper.getFiles(dir, recursive);
  }

  const matches: GrepMatch[] = [];

  for (const filePath of files) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue; // バイナリなど読めないものはスキップ
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lineText)) !== null) {
        matches.push({
          filePath,
          line: i,
          col: match.index,
          text: lineText,
          matchText: match[0],
        });
      }
    }
  }

  return matches;
}

// -----------------------------------------------------------------------
// 結果表示
// -----------------------------------------------------------------------

// 前回のデコレーションを保持
let prevFilePathDeco: vscode.TextEditorDecorationType | null = null;
let prevMatchDeco: vscode.TextEditorDecorationType | null = null;
let prevLineNumDeco: vscode.TextEditorDecorationType | null = null;

interface GrepBufferDecorationState {
  filePathLineNums: number[];
  matchRangeInfos: { line: number; col: number; length: number }[];
  lineNumRangeInfos: { line: number; endCol: number }[];
  lines: string[];
}
let grepBufferDecorationState: GrepBufferDecorationState;
let activeEditorListener: vscode.Disposable | null = null;
let grepBufferListener: vscode.Disposable | null = null;

async function showResultsInFile(matches: GrepMatch[], pattern: string, caseSensitive: boolean): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // ファイルごとにGerpのマッチした行をグループ化
  const grouped = new Map<string, GrepMatch[]>();
  for (const m of matches) {
    if (!grouped.has(m.filePath)) grouped.set(m.filePath, []);
    grouped.get(m.filePath)!.push(m);
  }

  // lines: GrepのViewerに表示するテキスト
  const lines: string[] = [`Grep: "${pattern}"  ${matches.length}件マッチ / ${grouped.size}ファイル`, ''];
  fileViewerOperatior.clear();

  // デコレーション用
  const filePathLineNums: number[] = []; // Viewerに表示するファイルパスが何行にあるかを保存する
  const matchRangeInfos: { line: number; col: number; length: number }[] = []; // Grepでマッチしたpatternの位置
  const lineNumRangeInfos: { line: number; endCol: number }[] = []; // 行番号部分

  for (const [filePath, fileMatches] of grouped.entries()) {
    const relPath = workspaceRoot ? pathHelper.toRelativePath(filePath, workspaceRoot) : filePath;

    filePathLineNums.push(lines.length);
    lines.push(relPath); // ファイルパス

    for (const m of fileMatches) {
      const prefix = `${m.line + 1}:${m.col + 1}  `;
      const trimmedText = m.text.trim();
      const lineText = `${prefix}${trimmedText}`;

      // patternのマッチ位置を計算
      const newText = caseSensitive ? trimmedText : trimmedText.toLowerCase();
      const matchText = m.matchText.trim();
      let searchFrom = 0;
      while (true) {
        const idx = newText.indexOf(matchText, searchFrom);
        if (idx === -1) break;
        matchRangeInfos.push({
          line: lines.length,
          col: prefix.length + idx,
          length: matchText.length,
        });
        searchFrom = idx + 1;
      }

      lineNumRangeInfos.push({ line: lines.length, endCol: prefix.length });
      lines.push(lineText); // 行:列 テキスト
      fileViewerOperatior.set(lines.length - 1, { path: m.filePath, line: m.line, col: m.col, text: trimmedText });
    }
    lines.push('');
  }

  const content = lines.join('\n');

  // ファイルに書き出す
  // const resultPath = REGEXGREP_VIEWER_FILE_PATH;
  const resultPath = pathHelper.getViewerResultFilePath();
  const dir = path.dirname(resultPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(resultPath, content, 'utf-8');

  // ファイルを開く
  const uri = vscode.Uri.file(resultPath);
  // 既に開いているエディタを探す
  const existingEditor = vscode.window.visibleTextEditors.find((e) => pathHelper.isSamePath(e.document.uri.fsPath, resultPath));

  let editor: vscode.TextEditor;
  if (existingEditor) {
    // 既に開いていればそれを使う
    editor = existingEditor;
    await vscode.window.showTextDocument(existingEditor.document, {
      viewColumn: existingEditor.viewColumn,
      preview: false,
    });
  } else {
    // 開いていなければ横に新規で開く
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.commands.executeCommand('workbench.action.newGroupBelow');
    editor = await vscode.window.showTextDocument(doc, {
      preview: false,
    });
  }

  // QUESTION: 待機しないと？プレンテキストと反映されないときがある
  await waitForSelectionSettled();
  await vscode.languages.setTextDocumentLanguage(editor.document, 'myvim-search-regexGrep.buffer');

  grepBufferDecorationState = { filePathLineNums, matchRangeInfos, lineNumRangeInfos, lines };
  await applyGrepBufferDecorations(editor);

  // このイベントはGrep結果でファイルを開いて再びGrep結果に戻るとデコが消えてしまう現象を回避するためのものである
  activeEditorListener?.dispose();
  activeEditorListener = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (!editor) return;
    if (pathHelper.isSamePath(getActiveEditor().document.uri.fsPath, pathHelper.getViewerResultFilePath())) {
      await applyGrepBufferDecorations(editor);
    }
  });

  // ファイルを閉じたときのイベントを設定
  grepBufferListener?.dispose();
  grepBufferListener = vscode.window.tabGroups.onDidChangeTabs((event) => {
    if (event.closed.length > 0) {
      for (const tab of event.closed) {
        if (tab.input instanceof vscode.TabInputText) {
          const closedPath = tab.input.uri.fsPath;
          if (pathHelper.isSamePath(closedPath, pathHelper.getViewerResultFilePath())) {
            activeEditorListener?.dispose();
            grepBufferListener?.dispose();
            activeEditorListener = null;
            grepBufferListener = null;
          }
        }
      }
    }
  });

  // QUESTION: 待機しないと？カーソル位置が移動しないときがある
  await waitForSelectionSettled();
  const pos = new vscode.Position(0, 0);
  editor.selection = new vscode.Selection(pos, pos);
}

async function applyGrepBufferDecorations(editor: vscode.TextEditor): Promise<void> {
  const { filePathLineNums, matchRangeInfos, lineNumRangeInfos, lines } = grepBufferDecorationState;

  // デコレーションのクリア
  prevFilePathDeco?.dispose();
  prevMatchDeco?.dispose();
  prevLineNumDeco?.dispose();
  prevFilePathDeco = null;
  prevMatchDeco = null;
  prevLineNumDeco = null;

  // デコレーションを作成して適用
  prevFilePathDeco = vscode.window.createTextEditorDecorationType({
    color: '#c792ea', // ファイルパス
    fontWeight: 'bold',
  });
  prevMatchDeco = vscode.window.createTextEditorDecorationType({
    color: '#f44747', // マッチ部分
    fontWeight: 'bold',
  });
  prevLineNumDeco = vscode.window.createTextEditorDecorationType({
    color: '#858585', // 行番号：列番号
  });

  // QUESTION: 待機しないと？デコレーションが反映されないときがある
  await waitForSelectionSettled();
  editor.setDecorations(
    prevFilePathDeco,
    filePathLineNums.map((lineNum) => new vscode.Range(lineNum, 0, lineNum, lines[lineNum].length)),
  );
  editor.setDecorations(
    prevMatchDeco,
    matchRangeInfos.map(({ line, col, length }) => new vscode.Range(line, col, line, col + length)),
  );
  editor.setDecorations(
    prevLineNumDeco,
    lineNumRangeInfos.map(({ line, endCol }) => new vscode.Range(line, 0, line, endCol)),
  );
}

// -----------------------------------------------------------------------
// エントリポイント
// -----------------------------------------------------------------------

/* grepのメイン関数 */
export async function regexGrep(args: {
  scope: DirScope; // 検索対象のディレクトリをどれにするか
  useRegex?: boolean; // 正規表現を使用するかどうか
  caseSensitive?: boolean; // 大文字・小文字を区別するかどうか
  customDir?: string; // 任意のディレクトリをgrepの検索ディレクトリとする
  projectSubDir?: string; // projectのサブディレクトリをgrepの検索ディレクトリとする
  cursorWordPattern?: TextPatternName; // カーソルの下の単語をgrepの検索キーとして与える
}): Promise<void> {
  const { scope, useRegex = true, caseSensitive = true, customDir, projectSubDir, cursorWordPattern = '' } = args;

  // ディレクトリを解決
  const dirInfo = resolveDirFromScope(scope, customDir, projectSubDir);
  if (!dirInfo) return;

  // パターン入力
  let pattern;
  if (cursorWordPattern === '') {
    pattern = await vscode.window.showInputBox({
      prompt: '検索パターンを入力',
      placeHolder: useRegex ? '正規表現を入力' : '検索文字列を入力',
    });
  } else {
    const range = getLineSurroundByPattern(textPatterns[cursorWordPattern]);
    if (!range) return;
    pattern = getTextInRange(range);
  }
  if (!pattern) return;

  // 検索実行
  const matches = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `"${pattern}" を検索中...`,
      cancellable: false,
    },
    async () => {
      return grepWithFs({
        dir: dirInfo.dir,
        recursive: dirInfo.recursive,
        pattern,
        useRegex,
        caseSensitive,
      });
    },
  );

  // 結果表示
  showResultsInFile(matches, pattern, caseSensitive);
}
