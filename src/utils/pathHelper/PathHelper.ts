import * as path from 'path';
import * as fs from 'fs';
import {
  VIEWER_RESULT_FILE_PATH,
  SHELL_CANDIDATE_PATHS,
  KEYBINDINGS_JSON_PATH,
  POWERSHELL_PROFILE_PATH,
  POWERSHELL_HISTORY_PATH,
  SETTINGS_JSON_PATH,
  AUTOHOTKEY2_PATH,
  MARKDOWN_MEMO_ROOT_PATH,
  SNIPPETS_DIR,
} from '@utils/config/path';
import { osHelper } from '@utils/osHelper/OsHelper';

const PATH_MAP = {
  autothotkey2: AUTOHOTKEY2_PATH,
  keybindings: KEYBINDINGS_JSON_PATH,
  pwshProfile: POWERSHELL_PROFILE_PATH,
  pwshHistory: POWERSHELL_HISTORY_PATH,
  settings: SETTINGS_JSON_PATH,
  // ディレクトリ
  memo: MARKDOWN_MEMO_ROOT_PATH,
  snippets: SNIPPETS_DIR,
} as const;
export const pathKeys = Object.keys(PATH_MAP);
export type PathKeys = keyof typeof PATH_MAP;

class PathHelper {
  public getPath(key: PathKeys): string {
    return PATH_MAP[key];
  }

  findShellPath(command: string): string {
    for (const dir of SHELL_CANDIDATE_PATHS) {
      const fullPath = path.join(dir, command);
      if (fs.existsSync(fullPath)) return fullPath;
    }
    throw new Error(`[エラー] "${command}"が見つかりません。Git for Windowsをインストールしてください`);
  }

  getSeparator(): string {
    return osHelper.isWindows() ? '\\' : '/';
  }

  // Grepなどの結果を表示する
  getViewerResultFilePath(): string {
    return VIEWER_RESULT_FILE_PATH;
  }

  isSamePath(path1: string, path2: string): boolean {
    const p1 = this.normalize(path1);
    const p2 = this.normalize(path2);
    if (process.platform === 'win32') {
      return p1.toLowerCase() === p2.toLowerCase();
    }
    return p1 === p2;
  }

  normalize(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  resolve(
    baseDir: string,
    filePath: string,
    { preserveTrailingSlash = false }: { preserveTrailingSlash?: boolean } = {},
  ): string {
    const hasTrailingSlash = filePath.endsWith('/') || filePath.endsWith('\\');
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
    // let normalizedPath = this.normalize(absolutePath);
    let normalizedPath = absolutePath;
    if (preserveTrailingSlash && hasTrailingSlash && !normalizedPath.endsWith('/')) {
      normalizedPath += '/';
    }
    return normalizedPath;
  }

  toRelativePath(filePath: string, rootPath: string): string {
    return this.normalize(filePath.replace(rootPath, '')).replace(/^\//, '');
  }
}

export const pathHelper = new PathHelper();
