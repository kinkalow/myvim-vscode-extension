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

interface FindResult {
  label: string; // QuickPickのラベル
  filePath: string; // 絶対パス
  line: number; // 行番号
  col: number; // 列番号
}

/** findコマンドを実行する */
async function runFind(
  targetRoot: string,
  pattern: string,
  excludeDirs: string[],
  excludeExts: string[],
): Promise<string | null> {
  const sep = pathHelper.getSeparator();
  const excludeDirArgs = excludeDirs.flatMap((d) => ['-not', '-path', `*${sep}${d}${sep}*`]);
  const excludeExtArgs = excludeExts.flatMap((e) => ['-not', '-name', `*.${e}`]);
  const patternArg = pattern ? ['-name', `*${pattern}*`] : [];
  const args = ['.', '-type', 'f', ...excludeDirArgs, ...excludeExtArgs, ...patternArg];
  const findPath = osHelper.isWindows() ? pathHelper.findShellPath('find.exe') : 'find';
  const result = await shellHelper.execute(findPath, args, { cwd: targetRoot });
  return result.stdout;
}

/** findの各行を解析し、ファイルパスを取得する */
function parseFindLine(raw: string, targetRoot: string): FindResult | null {
  const stripped = raw.replace(/^\.[\\/]/, '').trim();
  if (!stripped) return null;
  const filePath = path.isAbsolute(stripped) ? stripped : path.join(targetRoot, stripped);
  const rel = path.relative(targetRoot, filePath);
  return {
    label: rel,
    filePath,
    line: 0,
    col: 0,
  };
}

/** ワークスペースルートからgrep検索を行う
 * 結果はterminalもしくはquickPickで表示する
 * quickPickを選んだときは、絞り込みや選択してファイルを開くことができる
 */
export async function find(args: { mode: 'terminal' | 'quickPick'; subDir?: string } = { mode: 'terminal' }): Promise<void> {
  if (!validateIncludes(args.mode, ['terminal', 'quickPick'], 'mode')) return;

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  if (workspaceRoot === '') return;
  const targetRoot = args.subDir ? path.normalize(path.join(workspaceRoot, args.subDir)) : workspaceRoot;

  let pattern;
  if (args.mode === 'terminal') pattern = await vscode.window.showInputBox({ prompt: 'ファイル名を入力' });
  if (!pattern) pattern = '';

  if (args.mode === 'terminal') {
    const excludeDirs = DEFAULT_EXCLUDE_DIRS.map((dir) => `-not -path "*/${dir}/*"`).join(' ');
    const excludeExtensions = DEFAULT_EXCLUDE_EXTENSIONS.map((ext) => `-not -name "*.${ext}"`).join(' ');
    const patternArg = pattern ? `-name "*${pattern}*"` : '';
    const findCmd = `find . -type f ${excludeDirs} ${excludeExtensions} ${patternArg}`;
    const command = ` cd "${targetRoot}" && ${findCmd}`;
    await terminalHelper.run(command);
    return;
  }

  // arg.mode === 'quickPick'

  let results: FindResult[] = [];
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `find "${pattern}" 実行中...`,
      cancellable: false,
    },
    async () => {
      const raw = await runFind(targetRoot, pattern, DEFAULT_EXCLUDE_DIRS, DEFAULT_EXCLUDE_EXTENSIONS);
      if (raw === null) return;
      const lines = raw.split('\n').filter(Boolean);
      results = lines.map((l) => parseFindLine(l, targetRoot)).filter((r): r is FindResult => r !== null);
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
