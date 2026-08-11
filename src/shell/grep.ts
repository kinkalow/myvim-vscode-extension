import * as vscode from 'vscode';
import * as path from 'path';
import { DEFAULT_EXCLUDE_DIRS, DEFAULT_EXCLUDE_EXTENSIONS } from '@utils/config/search';
import { validateIncludes } from '@utils/validation/args';
import { pathHelper } from '@utils/pathHelper/PathHelper';
import { shellHelper } from '@utils/shellHelper/ShellHelper';
import { terminalHelper } from '@utils/shellHelper/TerminalHelper';
import { quickPickHelper } from '@utils/ui/QuickPickHelper';
import { fileHelper } from '@utils/fileHelper/FileHelper';
import { osHelper } from '@utils/osHelper/OsHelper';

// grep結果の1行をパースした型
interface GrepResult {
  label: string; // QuickPickのラベル
  description: string; // QuickPickのdescription
  filePath: string; // 絶対パス
  line: number; // 行番号
  col: number; // 列番号
}

/** grepコマンドを実行する */
async function runGrep(
  targetRoot: string,
  pattern: string,
  excludeDirs: string[],
  excludeExts: string[],
): Promise<string | null> {
  const args = [
    '-rnI',
    '--color=never',
    ...excludeDirs.map((d) => `--exclude-dir=${d}`),
    ...excludeExts.map((e) => `--exclude=*.${e}`),
    pattern,
    '.',
  ];
  const grepPath = osHelper.isWindows() ? pathHelper.findShellPath('grep.exe') : 'grep';
  const result = await shellHelper.execute(grepPath, args, { cwd: targetRoot });
  return result.stdout;
}

/** grepの各行を解析し、行番号や列番号、ファイルパス、テキストを取得する */
function parseGrepLine(raw: string, pattern: string, targetRoot: string): GrepResult | null {
  const stripped = raw.replace(/^\.[\\/]/, '');
  const match = stripped.match(/^([^:]+):(\d+):(.*)$/);
  if (!match) return null;

  const [, relOrAbsPath, lineStr, text] = match;
  const lineNumber = parseInt(lineStr, 10) - 1;
  const filePath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(targetRoot, relOrAbsPath);
  const rel = path.relative(targetRoot, filePath);

  // textからpatternの列番号を取得
  let col = 0;
  try {
    const colMatch = text.match(new RegExp(pattern));
    if (colMatch?.index !== undefined) {
      col = colMatch.index;
    }
  } catch {}

  return {
    label: text.trim(),
    description: `$(file-code) ${rel}:${lineStr}`,
    filePath,
    line: lineNumber,
    col,
  };
}

/** ワークスペースルートからgrep検索を行う
 * 結果はterminalもしくはquickPickで表示する
 * quickPickを選んだときは、絞り込みや選択してファイルを開くことができる
 */
export async function grep(args: { mode: 'terminal' | 'quickPick'; subDir?: string } = { mode: 'terminal' }): Promise<void> {
  if (!validateIncludes(args.mode, ['terminal', 'quickPick'], 'mode')) return;

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  if (workspaceRoot === '') return;
  const targetRoot = args.subDir ? path.normalize(path.join(workspaceRoot, args.subDir)) : workspaceRoot;

  const pattern = await vscode.window.showInputBox({ prompt: '検索パターンを入力' });
  if (!pattern) return;

  if (args.mode === 'terminal') {
    const excludeDirs = DEFAULT_EXCLUDE_DIRS.map((dir) => `--exclude-dir="${dir}"`).join(' ');
    const excludeExtensions = DEFAULT_EXCLUDE_EXTENSIONS.map((ext) => `--exclude="*.${ext}"`).join(' ');
    const grepCmd = `grep -rnI --color=always ${excludeDirs} ${excludeExtensions} "${pattern}"`;
    const command = ` cd "${targetRoot}" && ${grepCmd}`;
    await terminalHelper.run(command);
    return;
  }

  // arg.mode === 'quickPick'

  let results: GrepResult[] = [];
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `grep "${pattern}" 実行中...`,
      cancellable: false,
    },
    async () => {
      const raw = await runGrep(targetRoot, pattern, DEFAULT_EXCLUDE_DIRS, DEFAULT_EXCLUDE_EXTENSIONS);
      if (raw === null) return;
      const lines = raw.split('\n').filter(Boolean);
      results = lines.map((l) => parseGrepLine(l, pattern, targetRoot)).filter((r): r is GrepResult => r !== null);
    },
  );
  if (results.length === 0) {
    vscode.window.showInformationMessage('一致する結果がありませんでした');
    return;
  }

  const picks = await quickPickHelper.pick(results, {
    placeHolder: `${results.length} 件の結果 — ファイル名・行番号・テキストで絞り込み`,
    canSelectMany: true,
  });
  if (!picks) return;
  for (const p of picks) await fileHelper.openFile(p.filePath, { line: p.line, col: p.col, openMode: 'current' });
}
