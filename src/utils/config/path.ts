import * as os from 'os';
import * as path from 'path';
import { osHelper } from '@utils/osHelper/OsHelper';

export const VIEWER_RESULT_FILE_PATH = path.join(os.homedir(), 'tmp', 'vscode', '__ResultViewer__'); // Grepなどの結果を表示するファイル
// export const REGEXGREP_VIEWER_FILE_PATH = path.join(os.homedir(), 'tmp', 'vscode', '__RegexGrepViewer__'); // Grepの結果を表示するファイル
export const PATH_COMPLETER_BUFFER_PATH = path.join(os.homedir(), 'tmp', 'vscode', '__PathCompleter__'); // ファイルパスなどを補完するためのファイル
export const QUICKRUN_SELECTION_BASENAME_PATH = path.join(os.homedir(), 'tmp', 'vscode', 'quickrun', '__QuickRun__'); // QuickRunの選択範囲を保存するためのファイルのベースネーム
export const FILE_OPERATOR_BUFFER_PATH = path.join(os.homedir(), 'tmp', 'vscode', '__FileOperator__'); // FileOperatorを操作するためのバッファ
export const MARKDOWN_MEMO_BUFFER_PATH = path.join(os.homedir(), 'tmp', 'vscode', '__MarkdownMemo__'); // Markdownメモを操作するためのバッファ

//
// Os依存
//

export let SHELL_CANDIDATE_PATHS = ['C:\\Program Files\\Git\\usr\\bin', 'C:\\Program Files (x86)\\Git\\usr\\bin'];
// // pathHelperで取得できるリスト
export let AUTOHOTKEY2_PATH = path.join(os.homedir(), 'Desktop', 'home', 'config', 'autohotkey', 'AutoHotKey2.ahk');
export let KEYBINDINGS_JSON_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'keybindings.json');
export let MARKDOWN_MEMO_ROOT_PATH = path.join(os.homedir(), 'Desktop', 'my_win_dev', 'memo');
// prettier-ignore
export let POWERSHELL_HISTORY_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'PowerShell', 'PSReadLine', 'ConsoleHost_history.txt');
export let POWERSHELL_PROFILE_PATH = path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
export let SETTINGS_JSON_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
export let SNIPPETS_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'snippets');

if (osHelper.isWSL()) {
  const { execSync } = require('child_process');
  const winUserProfile = execSync('cmd.exe /c "echo %USERPROFILE%"', { stdio: [] }).toString().trim();
  const winHomeDir = execSync(`wslpath "${winUserProfile}"`).toString().trim();

  SHELL_CANDIDATE_PATHS = [];
  AUTOHOTKEY2_PATH = AUTOHOTKEY2_PATH.replace(os.homedir(), winHomeDir);
  KEYBINDINGS_JSON_PATH = path.join(os.homedir(), '.vscode-server', 'data', 'Machine', 'keybindings.json');
  MARKDOWN_MEMO_ROOT_PATH = MARKDOWN_MEMO_ROOT_PATH.replace(os.homedir(), winHomeDir);
  POWERSHELL_HISTORY_PATH = POWERSHELL_HISTORY_PATH.replace(os.homedir(), winHomeDir);
  POWERSHELL_PROFILE_PATH = POWERSHELL_PROFILE_PATH.replace(os.homedir(), winHomeDir);
  SETTINGS_JSON_PATH = path.join(os.homedir(), '.vscode-server', 'data', 'Machine', 'settings.json');
  SNIPPETS_DIR = SNIPPETS_DIR.replace(os.homedir(), winHomeDir);
}
