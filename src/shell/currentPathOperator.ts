import { getActiveEditor } from '@utils/editor/editor';
import { FILE_OPERATOR_BUFFER_PATH } from '@utils/config/path';
import { PathOperator, CommandType } from '@utils/pathOperator';
import { validateIncludes } from '@utils/validation/args';

const actions = ['close', 'complete', 'execute', 'open'];
type Action = (typeof actions)[number];

export async function run(args: { action: Action; command?: CommandType }): Promise<void> {
  if (!validateIncludes(args.action, actions, 'action')) return;
  if (args.action === 'close') await pathOperator.close();
  else if (args.action === 'complete') await pathOperator.complete();
  else if (args.action === 'execute') await pathOperator.execute();
  else if (args.action === 'open') {
    const rootPath = getActiveEditor().document.uri.fsPath;
    const command = args.command ?? '';
    await pathOperator.open(rootPath, command);
  }
}

const pathOperator = new PathOperator(FILE_OPERATOR_BUFFER_PATH);
