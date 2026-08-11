import * as vscode from 'vscode';
import { validateIncludes } from '@utils/validation/args';
import { visualModeHelper, VisualMode, VisualModes } from '@utils/visualModeHelper/VisualModeHelper';

export async function enterVisualMode(args: { mode: VisualMode }) {
  const { mode } = args;
  if (!validateIncludes(mode, VisualModes, 'mode')) return;
  visualModeHelper.setLastMode(mode);
  const vimMapping = visualModeHelper.getVimMapping(mode, {returnType: 'array'});
  await vscode.commands.executeCommand('vim.remap', { after: vimMapping });
}
