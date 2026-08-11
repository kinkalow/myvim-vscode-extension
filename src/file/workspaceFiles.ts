import * as vscode from 'vscode';
import { DEFAULT_EXCLUDE_DIRS } from '@utils/config/search';
import { quickPickHelper } from '@utils/ui/QuickPickHelper';
import { fileHelper, OpenModes } from '@utils/fileHelper/FileHelper';
import { invokeWithVimCount } from '@utils/vimcount';
import { waitForSelectionSettled } from '@utils/wait';

async function openImpl(count: number) {
  let openMode: OpenModes = 'current';
  if (count === 2) openMode = 'split';
  else if (count === 3) openMode = 'vsplit';
  else if (count === 4) openMode = 'firstGroup';

  const excludePattern = `{${DEFAULT_EXCLUDE_DIRS.map((dir) => `**/${dir}/**`).join(',')}}`;
  const candidateFiles = await vscode.workspace.findFiles('**/*', excludePattern);
  const pickedFiles = await quickPickHelper.pick(
    candidateFiles
      .sort((a, b) => a.fsPath.localeCompare(b.fsPath))
      .map((file) => ({
        label: vscode.workspace.asRelativePath(file, false),
        details: file.fsPath,
      })),
    {
      placeHolder: `開くファイルを選択（${candidateFiles.length}件）`,
      fileOpenModeTriggerChar: '>',
      acceptWhenOneMatch: true,
      canSelectMany: true,
      spaceSeparatedAndMatch: true,
    },
  );
  if (!pickedFiles) return;
  const newOpenMode = quickPickHelper.fileOpenMode ?? openMode;

  for (let i = 0; i < pickedFiles.length; i++) {
    await fileHelper.openFile(pickedFiles[i].details, { openMode: newOpenMode });
  }
}
export async function open(): Promise<void> {
  await invokeWithVimCount(openImpl);
}
