import { pathHelper, pathKeys, PathKeys } from '@utils/pathHelper/PathHelper';
import { fileHelper, openModes, OpenModes } from '@utils/fileHelper/FileHelper';
import { validateIncludes } from '@utils/validation/args';
import { getSnippetPath } from './snippets';

/** keyに対応するファイルをopenModeで指定したモードで開く */
export function open(args:{key: PathKeys, openMode: OpenModes}) {
  if (!validateIncludes(args.key, pathKeys, 'key')) return;
  if (!validateIncludes(args.openMode, openModes, 'openMode')) return;
  let path;
  if (args.key === 'snippets') path = getSnippetPath();
  else path = pathHelper.getPath(args.key);
  if (!path) return;
  fileHelper.openFile(path, { openMode: args.openMode });
}
