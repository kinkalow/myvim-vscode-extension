import * as path from 'path';
import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor';
import { terminalHelper } from '@utils/shellHelper/TerminalHelper';
import { quickPickHelper } from '@utils/ui/QuickPickHelper';

/** 現在のファイルの名前を変更 */
export async function startTerminal(command: string, { stayTerminal = true }: { stayTerminal?: boolean } = {}): Promise<void> {
  const editor = getActiveEditor();
  const filePath = editor.document.uri.fsPath;
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const terminal = terminalHelper.getTerminal();

  // 置換
  let newCommand = command.replace('$filename', fileName).replace('$dirname', dir);

  if (stayTerminal) {
    terminal.show();
    terminal.sendText(`\u001be\u001bq cd ${dir}`);
    if (newCommand !== '') terminal.sendText(newCommand, false);
  } else {
    // コマンド実行後もとのアクティブエディタに戻る
    await terminalHelper.run(newCommand);
  }
}

export async function run(args: { command: string }): Promise<void> {
  let { command } = args;

  if (command === '') {
    const commands = ['bat', 'cp', 'diff', 'fd', 'ls', 'mkdir', 'mv', 'rm', 'rmdir', 'pwd', 'rg', 'touch', 'workspace'];
    const item = await quickPickHelper.pick(
      commands.map((command) => ({ label: command })),
      { acceptWhenOneMatch: true, canSelectMany: false, matchFromStart: true },
    );
    if (!item) return;
    command = item[0].label;
  }

  if (command === 'bat') startTerminal(' bat ');
  else if (command === 'cp') startTerminal(' cp $filename ');
  else if (command === 'diff') startTerminal(' diff $filename ');
  else if (command === 'fd') startTerminal(' fd ');
  else if (command === 'ls') startTerminal(' cd $dirname', { stayTerminal: false });
  else if (command === 'mkdir') startTerminal(' mkdir ');
  else if (command === 'mv') startTerminal(' mv $filename ');
  else if (command === 'pwd') startTerminal(' pwd');
  else if (command === 'rg') startTerminal(' rg --no-heading ');
  else if (command === 'rm') startTerminal(' rm ');
  else if (command === 'rmdir') startTerminal(' rmdir ');
  else if (command === 'touch') startTerminal(' touch ');
  else if (command === 'workspace') {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) startTerminal(`cd "${workspaceFolder.uri.fsPath}"`, { stayTerminal: false });
  }
}
