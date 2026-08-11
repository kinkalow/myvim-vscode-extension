import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getActiveEditor } from '@utils/editor/editor';
import { pathHelper } from '@utils/pathHelper/PathHelper';
import { validateIncludes } from '@utils/validation/args';
import { fileHelper } from '@utils/fileHelper/FileHelper';

// -----------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------

const FILES_PER_ROW = 3; // 1行に表示するファイル数
const BLANK_LINE_AT = 4;
const AUTO_COMPLETE_DELAY_MS = 200; // 自動補完の実行前の待機時間
const commands = ['cd', 'cp', 'diff', 'mkdir', 'mv', 'rm', 'touch'].concat(['filer', 'open']).concat(['sp', 'vs']).concat(['']);
let isAutoCompleteEnabled = false;

// -----------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------

export type CommandType = (typeof commands)[number];
let commandDecoration: vscode.TextEditorDecorationType | null = null;
let dirDecoration: vscode.TextEditorDecorationType | null = null;
let changeDisposable: vscode.Disposable | undefined;
let changeActiveEditor: vscode.Disposable | undefined;

type SplitResult = {
  parts: string[];
  partIndex: number;
  partOffset: number;
};

// -----------------------------------------------------------------------
// クラス
// -----------------------------------------------------------------------

export class PathOperator {
  constructor(private readonly bufferPath: string) {
    this.bufferPath = bufferPath;
  }
  // -----------------------------------------------------------------------
  // ファイルリスト取得
  // -----------------------------------------------------------------------

  /** dirディレクトリ内のファイルを取得してsort */
  private getFileList(dir: string): { name: string; isDir: boolean }[] {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries
        .map((e) => ({ name: e.name, isDir: e.isDirectory() }))
        .sort((a, b) => {
          // ディレクトリを先頭に、次にファイル名でソート
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      return [];
    }
  }

  /** 1行にFILES_PER_ROW個のファイルを表示できるように変換する */
  private formatFileList(files: { name: string; isDir: boolean }[]): string {
    const rows: string[] = [];
    for (let i = 0; i < files.length; i += FILES_PER_ROW) {
      const chunk = files.slice(i, i + FILES_PER_ROW);
      const row = chunk.map((f) => (f.isDir ? `${f.name}/` : f.name).padEnd(30)).join('  '); // ファイル間を30+2とする
      rows.push(row.trimEnd());
    }
    return rows.join('\n');
  }

  // -----------------------------------------------------------------------
  // File Operatorファイルの作成・更新
  // -----------------------------------------------------------------------

  /** fileOperatorファイルの内容を構築する */
  private buildContent(command: CommandType, sourcePath: string, prefixPath: string): string {
    const currentDir = fs.statSync(sourcePath).isDirectory() ? sourcePath : path.dirname(sourcePath);
    let files = this.getFileList(currentDir);
    if (prefixPath)
      files = files.filter((f) => {
        const name = f.isDir ? `${f.name}/` : f.name;
        return name.startsWith(prefixPath);
      });
    const fileListStr = this.formatFileList(files);

    const line1 = currentDir.replace(' ', '\ ');
    const line2 =
      command === ''
        ? ''
        : ['filer', 'open', 'sp', 'touch', 'vs'].includes(command) // ファイルの場合
          ? prefixPath === ''
            ? `${command} `
            : `${command} ${prefixPath}`
          : fs.statSync(sourcePath).isDirectory() // ディレクトリの場合
            ? ''
            : prefixPath === ''
              ? `${command} ${path.basename(sourcePath).replace(' ', '\ ')}`
              : `${command} ${prefixPath}`;
    const lines3 = Array(BLANK_LINE_AT - 1).fill('');
    const line4 = '';
    const line5 = fileListStr;

    return [line1, line2, ...lines3, line4, line5].join('\n');
  }

  /** fileOperatorファイルを開いてデコレーションを適用する */
  private async openFileOperator(command: CommandType, sourcePath: string, prefixPath: string): Promise<void> {
    // ディレクトリ作成
    const dir = path.dirname(this.bufferPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ファイル書き込み
    const content = this.buildContent(command, sourcePath, prefixPath);
    fs.writeFileSync(this.bufferPath, content, 'utf-8');

    // ファイルを開く
    const uri = vscode.Uri.file(this.bufferPath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
    });
    await vscode.languages.setTextDocumentLanguage(doc, 'myvim-shell-fileOperator.buffer');

    // デコレーションを適用
    this.applyDecorations(editor);

    // カーソル位置を2行目の最終行に移動
    const lineText = editor.document.lineAt(1).text;
    const pos = new vscode.Position(1, lineText.length); // NOTE: Insertのときも考慮してpositionをlengthにする
    editor.selection = new vscode.Selection(pos, pos);
  }

  /** ディレクトリ名を緑色でデコレーションする */
  private applyDecorations(editor: vscode.TextEditor): void {
    // 前のデコレーションをクリア
    if (commandDecoration) {
      editor.setDecorations(commandDecoration, []);
      commandDecoration.dispose();
    }
    if (dirDecoration) {
      editor.setDecorations(dirDecoration, []);
      dirDecoration.dispose();
    }

    commandDecoration = vscode.window.createTextEditorDecorationType({
      color: '#c9c94e',
      fontWeight: 'bold',
    });
    dirDecoration = vscode.window.createTextEditorDecorationType({
      color: '#4ec94e',
      fontWeight: 'bold',
    });

    const doc = editor.document;

    const commandLine = BLANK_LINE_AT + 1;
    const range = new vscode.Range(commandLine, 0, commandLine, doc.lineAt(commandLine).text.length);
    editor.setDecorations(commandDecoration, [range]);

    const ranges: vscode.Range[] = [];
    for (let i = BLANK_LINE_AT + 2; i < doc.lineCount; i++) {
      const lineText = doc.lineAt(i).text;
      // ディレクトリ（/で終わる）を探す
      const dirRegex = /(\S+\/)/g;
      let match: RegExpExecArray | null;
      while ((match = dirRegex.exec(lineText)) !== null) {
        ranges.push(new vscode.Range(i, match.index, i, match.index + match[0].length));
      }
    }
    editor.setDecorations(dirDecoration, ranges);
  }

  // -----------------------------------------------------------------------
  // 補完ロジック
  // -----------------------------------------------------------------------

  /** 現在のディレクトリとプレフィックスを解析する */
  private parseDestPath(
    destText: string, // ターゲットテキスト
    sourceDir: string,
  ): {
    currentDir: string;
    prefix: string;
  } {
    if (!destText) {
      return { currentDir: sourceDir, prefix: '' };
    }

    // パスを解析
    const normalized = destText.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');

    if (lastSlash === -1) {
      // スラッシュなし -> sourceDir内で補完
      return { currentDir: sourceDir, prefix: normalized };
    }

    const dirPart = normalized.substring(0, lastSlash + 1);
    const filePart = normalized.substring(lastSlash + 1);

    // 絶対パスか相対パスかを判定
    let resolvedDir: string;
    if (path.isAbsolute(dirPart)) {
      resolvedDir = dirPart;
    } else {
      resolvedDir = path.resolve(sourceDir, dirPart); // ディレクトリのスラッシュ取り除かれる
    }

    return { currentDir: resolvedDir, prefix: filePart };
  }

  /** 共通プレフィックスを計算する */
  private commonPrefix(strs: string[]): string {
    if (strs.length === 0) return '';
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
      while (!strs[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (!prefix) return '';
      }
    }
    return prefix;
  }

  // -----------------------------------------------------------------------
  // エントリポイント
  // -----------------------------------------------------------------------

  /** fileOperatorを起動する
   * @param path 対象ファイルパスまたはディレクトリ
   * @param command 実行したいコマンド
   */
  async open(path: string, command: CommandType, { prefixPath = '' }: { prefixPath?: string } = {}): Promise<void> {
    if (!validateIncludes(command, commands, 'command')) return;
    await this.openFileOperator(command, path, prefixPath);
    await this.startAutoComplete();
  }

  // -----------------------------------------------------------------------
  // 自動補完
  // -----------------------------------------------------------------------

  private async updateCompletion(): Promise<void> {
    const editor = getActiveEditor();
    const curLine = editor.selection.active.line;
    if (curLine !== 1) return;

    const curCol = editor.selection.active.character;
    const sourceDir = editor.document.lineAt(0).text.replace('\ ', ' ');
    const lineText = editor.document.lineAt(1).text;

    const { parts, partIndex, partOffset } = this.splitLineWithEscapedSpace(lineText, curCol);

    if (partIndex === 0) {
      const prefix = parts[partIndex].slice(0, partOffset);
      await this.updateFileList(editor, sourceDir, prefix, partIndex);
    } else {
      const destText = parts[partIndex].slice(0, partOffset);
      const { currentDir, prefix } = this.parseDestPath(destText, sourceDir);
      await this.updateFileList(editor, currentDir, prefix, partIndex);
    }
  }

  private async executeAutoComplete() {
    changeDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
      changeDisposable?.dispose();
      changeDisposable = undefined;
      if (!isAutoCompleteEnabled) return;
      await new Promise((res) => setTimeout(res, AUTO_COMPLETE_DELAY_MS)); // NOTE: これがないとカーソル位置が正しく読み取れない
      await this.updateCompletion();
      await this.executeAutoComplete();
    });
  }

  private async startAutoComplete(): Promise<void> {
    if (!isAutoCompleteEnabled) {
      await this.executeAutoComplete();
      changeActiveEditor = vscode.window.onDidChangeActiveTextEditor(() => {
        this.disposeAutoComplete();
      });
    }
    isAutoCompleteEnabled = true;
  }

  private disposeAutoComplete() {
    changeDisposable?.dispose();
    changeDisposable = undefined;
    changeActiveEditor?.dispose();
    changeActiveEditor = undefined;
    isAutoCompleteEnabled = false;
  }

  // -----------------------------------------------------------------------
  // Tab補完
  // -----------------------------------------------------------------------

  private async updateFileList(editor: vscode.TextEditor, targetDir: string, prefix: string, partIndex: number): Promise<void> {
    const doc = editor.document;
    let newContent;
    // if (partIndex === -1) {
    //   const allFiles = this.getFileList(targetDir);
    //   const fileListStr = this.formatFileList(allFiles);
    //   newContent = `${commands.join(' ')}\n${fileListStr}`;
    // } else
    if (partIndex === 0) {
      // prefixでフィルタ
      const commandList = prefix
        ? commands.filter((c) => {
            return c.startsWith(prefix);
          })
        : commands;
      const allFiles = this.getFileList(targetDir);
      const fileListStr = this.formatFileList(allFiles);
      newContent = `${commandList.filter((c) => c !== '').join(' ')}\n${fileListStr}`;
    } else {
      // ファイルリストを取得してprefixでフィルタ
      const allFiles = this.getFileList(targetDir);
      const files = prefix
        ? allFiles.filter((f) => {
            const name = f.isDir ? `${f.name}/` : f.name;
            return name.startsWith(prefix);
          })
        : allFiles;
      const fileListStr = this.formatFileList(files);
      newContent = `\n${fileListStr}`;
    }

    const listStartLine = BLANK_LINE_AT + 1;
    const listStartPos = new vscode.Position(listStartLine, 0);
    const listEndPos = doc.lineAt(doc.lineCount - 1).range.end;

    await editor.edit((editBuilder) => {
      if (listStartLine >= doc.lineCount) {
        editBuilder.insert(listEndPos, newContent);
      } else {
        editBuilder.replace(new vscode.Range(listStartPos, listEndPos), newContent);
      }
    });

    this.applyDecorations(editor);
  }

  private splitLineWithEscapedSpace(text: string, cursorCol: number): SplitResult {
    const parts: string[] = [];

    let current = '';
    let index = -1;
    let offset = -1;

    let currentPartIndex = 0;
    let currentLogicalPos = 0;
    for (let i = 0; i < text.length; i++) {
      if (i === cursorCol) {
        index = currentPartIndex;
        offset = currentLogicalPos;
      }

      const ch = text[i];
      if (ch === '\\' && i + 1 < text.length && text[i + 1] === ' ') {
        // エスケープした空白の場合
        current += ' ';
        currentLogicalPos++;
        i++;
      } else if (ch === ' ') {
        // 普通の空白の場合
        parts.push(current);
        current = '';
        currentPartIndex++;
        currentLogicalPos = 0;
      } else {
        // 空白以外の場合
        current += ch;
        currentLogicalPos++;
      }
    }

    // カーソルが末尾の場合
    if (cursorCol === text.length) {
      index = currentPartIndex;
      offset = currentLogicalPos;
    }

    parts.push(current);

    return { parts, partIndex: index, partOffset: offset };
  }

  /** Tabキーで補完する */
  private async completeImpl(): Promise<void> {
    const editor = getActiveEditor();
    if (!pathHelper.isSamePath(editor.document.uri.fsPath, this.bufferPath)) return;

    const doc = editor.document;
    const sourceDir = doc.lineAt(0).text.replace('\ ', ' ');
    const lineText = doc.lineAt(1).text;
    const curCol = editor.selection.active.character;
    const { parts, partIndex, partOffset } = this.splitLineWithEscapedSpace(lineText, curCol);

    let common = '';
    let offset = 0;

    if (partIndex === 0) {
      // command補完
      const prefix = parts[0].slice(0, partOffset);
      const matched = commands.filter((c) => c !== '').filter((c) => c.startsWith(prefix));
      if (matched.length === 0) return;

      common = this.commonPrefix(matched);

      if (common && common !== prefix) {
        parts[0] = common;
        offset = common.length - prefix.length;
      }

      const commandMatchOffset = commands.filter((c) => c !== '').filter((c) => c === common).length === 1 ? 1 : 0;
      offset += commandMatchOffset;

      await this.updateFileList(editor, sourceDir, prefix, 0);
    } else {
      // path補完（path1, path2, ...）
      const destText = parts[partIndex].slice(0, partOffset);
      const { currentDir, prefix } = this.parseDestPath(destText, sourceDir);

      const files = this.getFileList(currentDir);
      const matched = files.filter((f) => {
        const name = f.isDir ? `${f.name}/` : f.name;
        return name.startsWith(prefix);
      });
      if (matched.length === 0) return;

      const names = matched.map((f) => (f.isDir ? `${f.name}/` : f.name));
      common = this.commonPrefix(names);

      if (common && common !== prefix) {
        const lastSlash = destText.lastIndexOf('/');
        const dirPart = lastSlash === -1 ? '' : destText.slice(0, lastSlash + 1);
        const newPart = dirPart + common;
        parts[partIndex] = newPart.replaceAll(' ', '\ ');
        // prefixから補完された部分でスペースの個数を数える
        // これはスペースの個数だけ\が加わるのでその数だけoffsetに加える必要がある
        const added = common.slice(prefix.length);
        const spaceCount = (added.match(/ /g) ?? []).length;
        offset = added.length + spaceCount;
      }

      // ファイルマッチの場合、スペースとオフセットを追加
      const matchNames = names.filter((n) => n.startsWith(common));
      if (matchNames.length === 1) {
        if (!matchNames[0].endsWith('/') && partIndex === parts.length - 1) {
          parts.push('');
          offset += 1;
        }
      }

      // 補完候補を表示
      // 補完結果がディレクトリの場合、そのディレクトリ内のファイルなどを表示 -> listDirはcurrentDirよりも１つ深い層のディレクトリ
      // 補完結果が途中マッチである場合、候補は現在のディレクトリ内から補完
      const completedPart = parts[partIndex].replaceAll('\ ', ' ');
      const completedIsDir = completedPart.endsWith('/');
      let newPrefix = prefix;
      let targetDir;
      if (completedIsDir) {
        targetDir = pathHelper.resolve(sourceDir, completedPart);
        newPrefix = '';
      } else {
        targetDir = currentDir;
      }
      await this.updateFileList(editor, targetDir, newPrefix, partIndex);
    }

    // 2行目を新しいラインに置き換える
    if (offset !== 0) {
      const newLine =
        parts[0] +
        ' ' +
        parts
          .slice(1)
          .map((x) => x.replaceAll(' ', '\ '))
          .join(' ');

      await editor.edit((editBuilder) => {
        editBuilder.replace(new vscode.Range(1, 0, 1, lineText.length), newLine);
      });
    }

    // カーソルを補完後の位置に移動
    const newPos = new vscode.Position(1, curCol + offset);
    editor.selection = new vscode.Selection(newPos, newPos);
  }

  async complete(): Promise<void> {
    await this.completeImpl();
    await this.startAutoComplete();
  }

  // -----------------------------------------------------------------------
  // Enter実行
  // -----------------------------------------------------------------------

  /** Enterキーでコマンドを実行する */
  async execute(): Promise<void> {
    const editor = getActiveEditor();
    const doc = editor.document;
    await doc.save();

    if (!pathHelper.isSamePath(editor.document.uri.fsPath, this.bufferPath)) return;

    let line1Text = doc.lineAt(0).text.trim().replace('\\ ', ' ');
    const line2Text = doc.lineAt(1).text.trim().replace('\\ ', ' ');

    if (!fs.statSync(line1Text).isDirectory()) return;

    let { parts } = this.splitLineWithEscapedSpace(line2Text, 0); // 0はdummy

    const command = parts[0];
    if (!command) return;
    if (!commands.includes(command)) {
      vscode.window.showErrorMessage(`${command}が存在しません`);
      return;
    }

    // pathの調整
    if (['cp', 'diff', 'mv'].includes(command)) {
      for (let i = 2; i < parts.length; i++) {
        if (parts[i] === '.') {
          parts[i] = path.basename(parts[i]);
        }
      }
    }
    const paths = parts
      .slice(1)
      .filter((p) => p !== '')
      .map((p) => (path.isAbsolute(p) ? p : path.join(line1Text, p)));
    if (['cp', 'mv'].includes(command)) {
      for (let i = 1; i < paths.length; i++) {
        if (fs.existsSync(paths[i]) && fs.statSync(paths[i]).isDirectory()) {
          paths[i] = path.join(paths[i], path.basename(paths[0]));
        }
      }
    }

    // ファイルの存在確認
    if (['rm'].includes(command)) {
      const notFoundPath = paths.find((p) => !fs.existsSync(p));
      if (notFoundPath) {
        vscode.window.showErrorMessage(`${notFoundPath}が存在しません`);
        return;
      }
    } else if (['diff'].includes(command)) {
      const notFoundPath = paths.slice(0, 2).find((p) => !fs.existsSync(p));
      if (notFoundPath) {
        vscode.window.showErrorMessage(`${notFoundPath}が存在しません`);
        return;
      }
    }
    if (['cd', 'cp', 'mv'].includes(command)) {
      if (!fs.existsSync(paths[0])) {
        vscode.window.showErrorMessage(`${paths[0]}が存在しません`);
        return;
      }
      for (let i = 1; i < paths.length; i++) {
        const path = paths[i];
        if (fs.existsSync(path)) {
          const answer = await vscode.window.showWarningMessage(
            `${path}は存在します。上書きしますか？`,
            { modal: true },
            'はい',
            'いいえ',
          );
          if (answer !== 'はい') return;
          await this.remove([path], { skipConfirmation: true });
        }
      }
    }
    if (['touch'].includes(command)) {
      for (let i = 0; i < paths.length; i++) {
        if (fs.existsSync(paths[i])) {
          vscode.window.showErrorMessage(`${paths[i]}が存在します`);
          return;
        }
      }
    }
    if (['sp', 'vs'].includes(command)) {
      for (let i = 0; i < paths.length; i++) {
        if (!fs.existsSync(paths[i])) {
          const answer = await vscode.window.showWarningMessage(
            `${paths[i]}は存在しません。作成しますか？`,
            { modal: true },
            'はい',
            'いいえ',
          );
          if (answer !== 'はい') return;
        }
      }
    }

    if (command === 'cd') {
      await editor.edit((editBuilder) => {
        editBuilder.replace(new vscode.Range(0, 0, 0, line1Text.length), paths[0]);
      });
      line1Text = paths[0];
    } else if (command === 'cp') {
      paths.slice(1).forEach((p) => fs.cpSync(paths[0], p, { recursive: true }));
    } else if (command === 'mkdir') {
      paths.forEach((p) => fs.mkdirSync(p, { recursive: true }));
    } else if (command === 'mv') {
      fs.renameSync(paths[0], paths[1]);
    } else if (command === 'rm') {
      const result = await this.remove(paths);
      if (result === 'cancel') return;
    } else if (command === 'touch') {
      for (let i = 0; i < paths.length; i++) {
        fs.writeFileSync(paths[i], '');
      }
    }

    await editor.edit((editBuilder) => {
      editBuilder.insert(new vscode.Position(1, 0), '\n');
    });
    await editor.edit((editBuilder) => {
      editBuilder.replace(new vscode.Range(BLANK_LINE_AT, 0, BLANK_LINE_AT, doc.lineAt(BLANK_LINE_AT).text.length), '');
    });

    const newPos = new vscode.Position(1, 0);
    editor.selection = new vscode.Selection(newPos, newPos);
    await this.updateFileList(editor, line1Text, '', 0);
    await doc.save();

    if (command === 'diff') {
      await vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(paths[0]), vscode.Uri.file(paths[1]), 'Diff');
    } else if (command === 'filer') {
      const targetPath = line1Text;
      const uri = vscode.Uri.file(targetPath);
      await vscode.env.openExternal(uri);
    } else if (command === 'open') {
      const fileUris = await vscode.window.showOpenDialog({
        defaultUri: vscode.Uri.file(line1Text), // 対象ファイルを開く
        canSelectFiles: true, // ファイルを選択可能にする
        canSelectFolders: false, // フォルダの選択は不可にする
        canSelectMany: true, // 複数選択を可能にする
        openLabel: 'ファイルを開く', // ボタンのテキスト
      });
      if (fileUris && fileUris.length > 0) {
        for (const uri of fileUris) {
          try {
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document, { preview: false });
          } catch (error) {
            throw new Error(`ファイルを開けませんでした: ${uri.fsPath}`);
          }
        }
      }
    } else if (command === 'sp') {
      for (let i = 0; i < paths.length; i++) if (!fs.existsSync(paths[i])) fs.writeFileSync(paths[i], '');
      await this.close();
      for (const p of paths) await fileHelper.openFile(p, { openMode: 'split' });
    } else if (command === 'vs') {
      for (let i = 0; i < paths.length; i++) if (!fs.existsSync(paths[i])) fs.writeFileSync(paths[i], '');
      await this.close();
      for (const p of paths) await fileHelper.openFile(p, { openMode: 'vsplit' });
    }
  }

  private async remove(paths: string[], { skipConfirmation = false }: { skipConfirmation?: boolean } = {}): Promise<string> {
    let answer;
    if (!skipConfirmation) {
      answer = await vscode.window.showWarningMessage(
        `${paths.length} 個のファイルをゴミ箱へ移動しますか？`,
        { modal: true },
        'はい',
        'いいえ',
      );
      if (answer !== 'はい') return 'cancel';
    }
    await Promise.all(
      paths.map((p) =>
        vscode.workspace.fs.delete(vscode.Uri.file(p), {
          recursive: true,
          useTrash: true,
        }),
      ),
    );
    return 'deleted';
  }

  // -----------------------------------------------------------------------
  // 閉じる
  // -----------------------------------------------------------------------

  async close(): Promise<void> {
    this.disposeAutoComplete();
    const editor = getActiveEditor();
    await editor.document.save();
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  }
}
