import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_EXCLUDE_DIRS, DEFAULT_EXCLUDE_FILES, DEFAULT_EXCLUDE_EXTENSIONS } from '@utils/config/search';

class FileSystemHelper {
  /** 簡易なバイナリ判定 */
  isBinaryFile(filePath: string, checkBytes = 8192): boolean {
    const buffer = Buffer.alloc(checkBytes);
    const fd = fs.openSync(filePath, 'r');
    try {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      for (const byte of buffer.subarray(0, bytesRead)) {
        // NUL (0x00) があればバイナリと判断
        if (byte === 0) return true;
      }
      return false;
    } finally {
      fs.closeSync(fd);
    }
  }

  /** dir内のファイルをrecursive=trueで再帰的に取得する */
  getFiles(dir: string, recursive: boolean, result: string[] = []): string[] {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true }); // withFileTypes=trueでDirentを返す
    } catch {
      return result;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive && !DEFAULT_EXCLUDE_DIRS.includes(entry.name)) {
          this.getFiles(fullPath, recursive, result);
        }
      } else if (
        entry.isFile() &&
        !DEFAULT_EXCLUDE_FILES.includes(entry.name) &&
        !DEFAULT_EXCLUDE_EXTENSIONS.includes(path.extname(entry.name).replace('.', '').toLowerCase()) &&
        !this.isBinaryFile(fullPath)
      ) {
        result.push(fullPath);
      }
    }
    return result;
  }
}

export const fileSystemHelper = new FileSystemHelper();
