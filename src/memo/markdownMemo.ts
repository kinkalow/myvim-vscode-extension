import * as path from 'path';
import * as vscode from 'vscode';
import { MARKDOWN_MEMO_BUFFER_PATH, MARKDOWN_MEMO_ROOT_PATH } from '@utils/config/path';
import { PathOperator, CommandType } from '@utils/pathOperator';
import { getActiveEditor } from '@utils/editor/editor';
import { validateIncludes } from '@utils/validation/args';
import { quickPickHelper } from '@utils/ui/QuickPickHelper';
import { fileSystemHelper } from '@utils/fileSystemHelper/FileSystemHelper';
import { fileHelper } from '@utils/fileHelper/FileHelper';
import { textPatterns, TextPatternName } from '@utils/config/patterns';
import { getLineSurroundByPattern } from '@utils/operation/range/surround/pattern';
import { getTextInRange } from '@utils/editor/document';

const actions = ['close', 'complete', 'execute', 'open', 'quickPick'];
type Action = (typeof actions)[number];

async function quickPick(cursorWordPattern?: TextPatternName) {
  const editor = getActiveEditor();
  const languageId = editor.document.languageId;
  const rootPath = path.join(MARKDOWN_MEMO_ROOT_PATH, languageId);
  const candidateFiles = fileSystemHelper.getFiles(rootPath, true);
  const cursorWord = getWordUnderCursor(cursorWordPattern);
  const pickedFiles = await quickPickHelper.pick(
    candidateFiles.map((path) => ({
      label: path.slice(rootPath.length + 1).replace(/\.[^.]+$/, ''),
      details: path,
    })),
    {
      acceptWhenOneMatch: true,
      canSelectMany: true,
      spaceSeparatedAndMatch: true,
      initialValue: cursorWord,
    },
  );
  if (!pickedFiles) return;
  for (let i = 0; i < pickedFiles.length; i++) {
    fileHelper.openFile(pickedFiles[i].details, { openMode: 'split' });
  }
}

function getWordUnderCursor(cursorWordPattern?: TextPatternName): string {
  let word = '';
  if (cursorWordPattern) {
    const range = getLineSurroundByPattern(textPatterns[cursorWordPattern]);
    word = range ? getTextInRange(range) : '';
  }
  return word;
}

/**
 * markdown用のメモを操作するためのメイン関数
 *  @param command action='open'のみ使用。sp、vsなどを選択する
 *  @param cursorWordPattern カーソル下のパターンでマッチした単語を検索キーに与える
 */
export async function run(args: { action: Action; command?: CommandType; cursorWordPattern?: TextPatternName }): Promise<void> {
  if (!validateIncludes(args.action, actions, 'action')) return;
  if (args.cursorWordPattern && !validateIncludes(args.cursorWordPattern, Object.keys(textPatterns), 'cursorWordPattern')) return;

  if (args.action === 'close') await pathOperator.close();
  else if (args.action === 'complete') await pathOperator.complete();
  else if (args.action === 'execute') await pathOperator.execute();
  else if (args.action === 'open') {
    const editor = getActiveEditor();
    const languageId = editor.document.languageId;
    const rootPath = path.join(MARKDOWN_MEMO_ROOT_PATH, languageId);
    const cursorWord = getWordUnderCursor(args.cursorWordPattern);
    const prefixPath = cursorWord ? cursorWord : '';
    await pathOperator.open(rootPath, 'sp', { prefixPath });
  } else if (args.action === 'quickPick') await quickPick(args.cursorWordPattern);
}

const pathOperator = new PathOperator(MARKDOWN_MEMO_BUFFER_PATH);
