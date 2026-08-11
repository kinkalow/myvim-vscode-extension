// 除外ディレクト
// binとobjはC#で除外したい
export const DEFAULT_EXCLUDE_DIRS = ['.git', '.next', '.vscode', 'dist', '__pycache__', 'node_modules', 'out', 'bin', 'obj'];
// 除外ファイル
export const DEFAULT_EXCLUDE_FILES = ['.gitignore', '.vscodeignore', '.vscode-test.mjs', 'esbuild.js', 'eslint.config.mjs', 'LICENCE'];
// 除外拡張子
export const DEFAULT_EXCLUDE_EXTENSIONS = ['bin', 'dat', 'dll', 'exe', 'jpg', 'json', 'pdf', 'png', 'vsix', 'zip'];