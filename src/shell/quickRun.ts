import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getActiveEditor } from '@utils/editor';
import { terminalHelper } from '@utils/shellHelper/TerminalHelper';
import { quickPickHelper } from '@utils/ui/QuickPickHelper';
import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';
import { QUICKRUN_SELECTION_BASENAME_PATH } from '@utils/config/path';
import { LANGUAGEID_TO_EXTENSION } from '@utils/config/extension';
import { osHelper } from '@utils/osHelper/OsHelper';

/** 言語IDから実行コマンドのマップ
 *  実行コマンドは直近に用いたもので上書きされる */
const runners: Map<string, string> = new Map([
  ['c', 'clang'],
  ['cpp', 'clang++'],
  ['csharp', 'dotnet'],
  ['javascript', 'node'],
  ['python', 'python'],
  ['typescript', 'tsx'],
]);

/** ```<languageId> ... ```で囲まれたテキストとlanguageIdを返す */
function parseCodeFence(rawText: string): { text: string; languageId: string | null } {
  const lines = rawText.split('\n');
  const firstLine = lines[0];

  const fenceMatch = firstLine.trim().match(/^```\s*(\S*)$/);
  if (!fenceMatch) return { text: rawText, languageId: null };

  const languageId = fenceMatch[1].length > 0 ? fenceMatch[1] : null;

  let contentLines;
  const lastLine = lines[lines.length - 1];
  if (lastLine !== undefined && lastLine.trim() === '```') {
    contentLines = lines.slice(1, -1);
  } else {
    contentLines = lines.slice(1);
  }

  return {
    text: contentLines.join('\n'),
    languageId,
  };
}

/** filePathに対してrunnerに基づいて実行 */
async function runCommand(filePath: string, runner: string) {
  const dirPath = path.dirname(filePath);
  const fileName = path.basename(filePath);
  let prefix;
  if (osHelper.isWindows()) prefix = ` Clear-Host && Set-Location "${dirPath}" && `;
  else prefix = ` clear && cd "${dirPath}" && `;
  const command = `echo "[${runner}]" && __my_quickrun_${runner} ${fileName}`;
  await terminalHelper.run(prefix + command);
}

/** 選択テキストからlanguageIdを抽出した場合におけるrunnerとextensionを返す */
function getRunnerAndExtensionForSelection(languageId: string): { runner: string; extension: string } | null {
  let runner, extension;
  // 特別処理
  if (languageId === 'csharp') {
    runner = 'dotnet-script';
    extension = 'csx';
  } else {
    // 一般処理
    runner = runners.get(languageId);
    if (!runner) return null;
    extension = LANGUAGEID_TO_EXTENSION[languageId];
    if (!extension) {
      vscode.window.showErrorMessage(`[エラー] 言語ID（${languageId}）から拡張子を識別することができませんでした`);
      return null;
    }
  }
  return { runner, extension };
}

/** 選択領域のテキストをファイルに保存する */
function createQuickrunSeletionFile(extension: string, text: string): string {
  let filePath = QUICKRUN_SELECTION_BASENAME_PATH;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  filePath += `.${extension}`;
  fs.writeFileSync(filePath, text, 'utf-8');
  return filePath;
}

/** Normal/Visualモード。ファイル/選択範囲に対してコンパイル・実行 */
export async function run(): Promise<void> {
  const editor = getActiveEditor();
  let languageId = editor.document.languageId;

  let filePath, runner;
  const visualSelection = visualModeHelper.getVisualSelection();
  if (visualSelection) {
    // Visual Mode
    const result = parseCodeFence(visualSelection.text);
    languageId = result.languageId ?? languageId;
    const text = result.text;

    const runnerAndExt = getRunnerAndExtensionForSelection(languageId);
    if (runnerAndExt === null) return;
    runner = runnerAndExt.runner;

    filePath = createQuickrunSeletionFile(runnerAndExt.extension, text);

    await vscode.commands.executeCommand('vim.remap', { after: ['Esc'] });
  } else {
    // Normal Mode
    filePath = editor.document.uri.fsPath;
    runner = runners.get(languageId);
    if (!runner) return;
    await vscode.commands.executeCommand('workbench.action.files.save');
  }

  runCommand(filePath, runner);
}

/** コンパイル方法を変えて実行 */
export async function quickPick(): Promise<void> {
  const editor = getActiveEditor();
  const languageId = editor.document.languageId;

  let supportRunners: string[] = [];
  if (languageId === 'c') supportRunners = osHelper.isWindows() ? ['gcc', 'clang', 'cl'] : ['gcc', 'clang'];
  else if (languageId === 'cpp') supportRunners = osHelper.isWindows() ? ['g++', 'clang++', 'cl'] : ['g++', 'clang++'];
  else if (languageId === 'csharp') supportRunners = ['dotnet', 'dotnet-script'];
  else {
    vscode.window.showErrorMessage(`[エラー] ${languageId}に対するQuickRun（quickPick版）を実装していません`);
  }

  if (supportRunners) {
    const pick = await quickPickHelper.pick(
      supportRunners.map((runner) => ({ label: runner })),
      { canSelectMany: false, acceptWhenOneMatch: true, matchFromStart: true },
    );
    if (!pick) return;
    runners.set(languageId, pick[0].label);
  }

  run();
}

//
// ```languageId ～ ```までのコードを実行
//

/**
 * カレント行から上方向に ```languageId を探し、見つかったらそこから下方向に閉じる ``` を探して、その間のテキストとlanguageIdを返す
 * @param editor 対象のエディタ
 * @param maxSearchLines 上方向に検索する最大行数(省略時は0行目まで全部検索)
 * @returns 見つかった場合はtextとlanguageId、見つからない場合はnull
 */
function findEnclosingCodeFence(
  editor: vscode.TextEditor,
  maxSearchLines?: number,
): {
  text: string;
  languageId: string;
} | null {
  const document = editor.document;
  const cursorLine = editor.selection.active.line;
  const FENCE_OPEN_REGEX = /^```\s*(\S*)$/;
  const FENCE_CLOSE_REGEX = /^```\s*$/;
  const searchLimitLine = maxSearchLines !== undefined ? Math.max(0, cursorLine - maxSearchLines) : 0;

  // カレント行から上方向(カレント行を含む)に開きフェンスを探す
  let openLine = -1;
  let languageId = document.languageId;
  for (let line = cursorLine; line >= searchLimitLine; line--) {
    const lineText = document.lineAt(line).text.trim();
    const match = lineText.match(FENCE_OPEN_REGEX);
    if (match) {
      openLine = line;
      if (match[1].length > 0) languageId = match[1];
      break;
    }
  }
  if (openLine === -1) return null;

  // 開きフェンスの次の行から下方向に閉じフェンスを探す
  let closeLine = -1;
  for (let line = openLine + 1; line < document.lineCount; line++) {
    const lineText = document.lineAt(line).text.trim();
    if (FENCE_CLOSE_REGEX.test(lineText)) {
      closeLine = line;
      break;
    }
  }
  if (closeLine === -1) return null;

  // openLineの次の行から、closeLineの手前までがコード本文
  const contentLines: string[] = [];
  for (let line = openLine + 1; line < closeLine; line++) {
    contentLines.push(document.lineAt(line).text);
  }

  return {
    text: contentLines.join('\n'),
    languageId,
  };
}

/** Markdownのコードフェンスで囲まれたコードを実行する */
export function runCodeFence(): void {
  const editor = getActiveEditor();
  const fenceResult = findEnclosingCodeFence(editor);
  if (!fenceResult) return;
  const runnerAndExt = getRunnerAndExtensionForSelection(fenceResult.languageId);
  if (runnerAndExt === null) return;
  const filePath = createQuickrunSeletionFile(runnerAndExt.extension, fenceResult.text);
  runCommand(filePath, runnerAndExt.runner);
}
