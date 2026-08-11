import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';
import { getLineSurroundByPattern } from '@utils/operation/range/surround/pattern';
import { getTextInRange } from '@utils/editor/document';
import { alnumPattern, standardPattern, extendedWordPattern, bigWordPattern } from '@utils/config/patterns';

// ---------------------------------------------------------------
// Word Pattern
// ---------------------------------------------------------------

let wordPattern: string;
let DEFAULT_WORD_PATTERN = standardPattern;

function setWordPattern(pattern: string): void {
  wordPattern = pattern;
}

function getWordPattern(): string {
  return wordPattern;
}

// ---------------------------------------------------------------
// Decoration type
// ---------------------------------------------------------------

const highlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
  border: '1px solid',
  borderColor: new vscode.ThemeColor('editor.wordHighlightBorder'),
});

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------

// ハイライト機能が ON のエディタ
// const activeEditors = new Map<string, Map<vscode.ViewColumn, vscode.TextEditor>>();
const activeEditors = new Map<string, vscode.TextEditor>();

// エディタごとのキャッシュ
interface EditorCache {
  word: string; // 現在デコ中の単語（空 = デコなし）
  lastVisibleRange: vscode.Range | null; // 表示領域
}
const editorCache = new Map<vscode.TextEditor, EditorCache>();

let isAllMode = false; // 全グループ対象かどうか
let activeListeners: vscode.Disposable[] = []; // イベント（onDidChange...）
let isJumping = false; // 他のグループに移動したか

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function getVisibleRange(editor: vscode.TextEditor): vscode.Range {
  const ranges = editor.visibleRanges;
  return new vscode.Range(ranges[0].start, ranges[ranges.length - 1].end);
}

function rangeEqual(a: vscode.Range, b: vscode.Range): boolean {
  return a.start.isEqual(b.start) && a.end.isEqual(b.end);
}

function getWordUnderCursor({ editor }: { editor?: vscode.TextEditor } = {}): string {
  const pattern = getWordPattern();
  const surroundRange = editor ? getLineSurroundByPattern(pattern, { editor }) : getLineSurroundByPattern(pattern);
  return surroundRange ? getTextInRange(surroundRange, { editor }) : '';
}

function getCursorWordRange(): vscode.Range | null {
  const pattern = getWordPattern();
  const surroundRange = getLineSurroundByPattern(pattern);
  if (!surroundRange) return null;
  return new vscode.Range(
    new vscode.Position(surroundRange.startLine, surroundRange.startCol),
    new vscode.Position(surroundRange.endLine, surroundRange.endCol),
  );
}

// ---------------------------------------------------------------
// Match search
// ---------------------------------------------------------------

function findAllMatchesInVisibleRange(editor: vscode.TextEditor, word: string, visibleRange: vscode.Range): vscode.Range[] {
  if (!word) return [];
  const text = editor.document.getText(visibleRange);
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = getWordPattern() === alnumPattern ? new RegExp(`${escaped}`, 'g') : new RegExp(`\\b${escaped}\\b`, 'g');
  const ranges: vscode.Range[] = [];
  const baseOffset = editor.document.offsetAt(visibleRange.start);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = editor.document.positionAt(baseOffset + m.index);
    const end = editor.document.positionAt(baseOffset + m.index + m[0].length);
    ranges.push(new vscode.Range(start, end));
  }
  return ranges;
}

function findAllMatchesInDocument(editor: vscode.TextEditor, word: string): vscode.Range[] {
  if (!word) return [];
  const text = editor.document.getText();
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'g');
  const ranges: vscode.Range[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = editor.document.positionAt(m.index);
    const end = editor.document.positionAt(m.index + m[0].length);
    ranges.push(new vscode.Range(start, end));
  }
  return ranges;
}

// ---------------------------------------------------------------
// Decoration apply / erase
// ---------------------------------------------------------------

function applyDecorations(editor: vscode.TextEditor, word: string): void {
  const visibleRange = getVisibleRange(editor);
  const cache = editorCache.get(editor);

  // 単語も visible range も変わっていなければスキップ
  if (cache && cache.word === word && cache.lastVisibleRange !== null && rangeEqual(visibleRange, cache.lastVisibleRange)) {
    return;
  }

  const matches = word ? findAllMatchesInVisibleRange(editor, word, visibleRange) : [];
  editor.setDecorations(highlightDecoration, matches);
  editorCache.set(editor, { word, lastVisibleRange: visibleRange });
}

function eraseDecorations(editor: vscode.TextEditor): void {
  editor.setDecorations(highlightDecoration, []);
  editorCache.delete(editor);
}

// ---------------------------------------------------------------
// updateHighlight: カーソル移動のたびに呼ばれる
// ---------------------------------------------------------------

function updateHighlight(editor: vscode.TextEditor): void {
  const path = editor.document.uri.fsPath;
  const viewColumn = getViewColumn(editor);
  if (!activeEditors.has(createEditorKey(path, viewColumn))) return;
  const word = getWordUnderCursor();
  applyDecorations(editor, word);
}

// ---------------------------------------------------------------
// OFF helpers
// ---------------------------------------------------------------

function deactivateEditor(path: string, viewColumn: vscode.ViewColumn): void {
  const editor = activeEditors.get(createEditorKey(path, viewColumn));
  if (!editor) return;
  activeEditors.delete(createEditorKey(path, viewColumn));
  eraseDecorations(editor);
}

function deactivateAll(): void {
  for (const editor of activeEditors.values()) {
    eraseDecorations(editor);
  }
  activeEditors.clear();
}

// ---------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------

function ensureListeners(): void {
  if (activeListeners.length > 0) return;

  activeListeners = [
    // カーソル移動のたびに呼ばれる
    vscode.window.onDidChangeTextEditorSelection((event) => {
      // e.kind = 1: 上下移動（normalモードの場合。insert/visualモードではこれが3になる）
      // e.kind = 2: クリック
      // e.kind = 3: 左右移動
      // e.kind = undefined: 他グループ移動やグループ内移動
      if (!event.kind) return;
      const editor = event.textEditor;
      const path = editor.document.uri.fsPath;
      const viewColumn = getViewColumn(editor);
      const key = createEditorKey(path, viewColumn);
      const oldEditor = activeEditors.get(key);
      if (!oldEditor) return;
      if (editor !== oldEditor) {
        deactivateEditor(path, viewColumn);
        activeEditors.set(key, editor);
      }
      if (event.textEditor)
        if (isJumping) {
          isJumping = false;
          return;
        }
      if (!event.selections[0].isEmpty) {
        // visualモードで範囲選択中はデコを消す（activeEditors には残す）
        applyDecorations(editor, '');
        return;
      }
      updateHighlight(editor);
    }),

    // for (const [groupIndex, group] of vscode.window.tabGroups.all.entries()) {
    //   for (const tab of group.tabs) {
    //     if (tab.input instanceof vscode.TabInputText) {
    //       console.log(`group=${groupIndex + 1}, active=${group.isActive}, path=${tab.input.uri.fsPath}`);
    //     }
    //   }
    // }
    vscode.window.tabGroups.onDidChangeTabs((event) => {
      if (event.opened.length > 0) {
        // ファイルを開いたとき
        for (const tab of event.opened) {
          if (tab.input instanceof vscode.TabInputText) {
            const newViewColumn = Number(tab.group.viewColumn);
            let isNewGroup = false;
            for (const [groupIndex, group] of vscode.window.tabGroups.all.entries()) {
              if (groupIndex + 1 === newViewColumn) {
                if (group.tabs.length === 1) isNewGroup = true;
                break;
              }
            }
            if (isNewGroup) {
              for (const key of [...activeEditors.keys()]) {
                const [oldPath, oldViewColumn] = splitEditorKey(key);
                if (newViewColumn <= oldViewColumn) {
                  const oldEditor = activeEditors.get(key);
                  const newKey = createEditorKey(oldPath, oldViewColumn + 1);
                  activeEditors.set(newKey, oldEditor!);
                  activeEditors.delete(key);
                }
              }
            }
          }
        }
      } else if (event.closed.length > 0) {
        // ファイルを閉じたとき
        for (const tab of event.closed) {
          if (tab.input instanceof vscode.TabInputText) {
            const closedPath = tab.input.uri.fsPath;
            const closedViewColumn = tab.group.viewColumn;
            const closedKey = createEditorKey(closedPath, closedViewColumn);
            const editor = activeEditors.get(closedKey);
            if (editor) deactivateEditor(closedPath, closedViewColumn);
            let isGroupDeleted = false;
            for (const [groupIndex, group] of vscode.window.tabGroups.all.entries()) {
              // if (groupIndex + 1 === closedViewColumn) {
              //   if (group.tabs.length === 1) isGroupDeleted = true;
              //   break;
              // }
              // ファイルを閉じたとき、閉じる前のグループ数が表示される
              // しかしそのグループ内のタブ数（group.tabs.length）は閉じた後の表示になる
              // そのため、すべてのグループのタブ数が１以上であればグループは閉じていない
              if (group.tabs.length === 0) isGroupDeleted = true;
            }
            if (isGroupDeleted) {
              for (const key of [...activeEditors.keys()]) {
                const [oldPath, oldViewColumn] = splitEditorKey(key);
                if (closedViewColumn <= oldViewColumn) {
                  const oldEditor = activeEditors.get(key);
                  const newKey = createEditorKey(oldPath, oldViewColumn - 1);
                  activeEditors.set(newKey, oldEditor!);
                  activeEditors.delete(key);
                }
              }
            }
          }
        }
      }
    }),

    // グループ移動のたびに呼ばれる
    vscode.window.onDidChangeActiveTextEditor((newEditor) => {
      if (!newEditor) return;
      const path = newEditor.document.uri.fsPath;
      const viewColumn = Number(newEditor.viewColumn);
      const key = createEditorKey(path, viewColumn);
      if (isAllMode) {
        activeEditors.set(key, newEditor);
        applyDecorations(newEditor, getWordUnderCursor());
      } else {
        const oldEditor = activeEditors.get(key);
        if (!oldEditor) return;
        activeEditors.set(key, newEditor);
        applyDecorations(newEditor, getWordUnderCursor());
      }
    }),

    // 表示領域が変更したときに呼ばれる（スクロールも含む）
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      if (!activeEditors.has(e.textEditor.document.uri.fsPath)) return;
      const cache = editorCache.get(e.textEditor);
      if (cache) {
        editorCache.set(e.textEditor, { ...cache, lastVisibleRange: null });
      }
      applyDecorations(e.textEditor, cache?.word ?? getWordUnderCursor());
    }),

    // テキスト変更したとき呼ばれる（insertモードで文字入力など）
    vscode.workspace.onDidChangeTextDocument((e) => {
      for (const [editor, cache] of editorCache) {
        if (editor.document === e.document) {
          editorCache.set(editor, { ...cache, lastVisibleRange: null });
        }
      }
    }),
  ];
}

function disposeListeners(): void {
  activeListeners.forEach((d) => d.dispose());
  activeListeners = [];
}

// ---------------------------------------------------------------
// Public: toggleHighlightCurrent
// ---------------------------------------------------------------

function setHighlightActive(active: boolean) {
  vscode.commands.executeCommand('setContext', 'myvim-search-cursorWordHighlight.highlightActive', active);
}

function getViewColumn(editor: vscode.TextEditor) {
  const viewColumn = editor.viewColumn;
  if (!viewColumn) throw new Error('[エラー] viewColumnがundefined');
  return viewColumn;
}

function createEditorKey(path: string, viewColumn: number) {
  return `${path}\0${viewColumn}`;
}

function splitEditorKey(key: string): [string, number] {
  const [path, viewColumn] = key.split('\0');
  return [path, Number(viewColumn)];
}

export function toggleHighlightCurrent(pattern: string = DEFAULT_WORD_PATTERN): void {
  const editor = getActiveEditor();
  const viewColumn = getViewColumn(editor);
  const path = editor.document.uri.fsPath;

  if (activeEditors.get(createEditorKey(path, viewColumn))) {
    // ON -> OFF
    deactivateEditor(path, viewColumn);
    if (activeEditors.size === 0) {
      disposeListeners();
      isAllMode = false;
      setHighlightActive(false);
    }
    return;
  }

  // OFF -> ON
  setWordPattern(pattern);
  const word = getWordUnderCursor();
  if (!word) return;
  activeEditors.set(createEditorKey(path, viewColumn), editor);
  applyDecorations(editor, word);
  setHighlightActive(true);
  ensureListeners();
}

// ---------------------------------------------------------------
// Public: toggleHighlightAll
// ---------------------------------------------------------------

export function toggleHighlightAll(pattern: string = DEFAULT_WORD_PATTERN): void {
  const editor = getActiveEditor();

  if (activeEditors.size > 0) {
    // 1つでもハイライト中のエディタがあれば全部消す
    isAllMode = false;
    disposeListeners();
    deactivateAll();
    setHighlightActive(false);
    return;
  }

  // 全エディタがハイライトなし -> 全体モード ON
  setWordPattern(pattern);
  const word = getWordUnderCursor();
  if (!word) return;

  isAllMode = true;
  const viewColumn = getViewColumn(editor);
  const path = editor.document.uri.fsPath;
  activeEditors.set(createEditorKey(path, viewColumn), editor);
  applyDecorations(editor, word);
  setHighlightActive(true);
  ensureListeners();
}

// ---------------------------------------------------------------
// ジャンプ
// ---------------------------------------------------------------

function findNextJumpTarget(
  allRanges: vscode.Range[],
  cursor: vscode.Position,
  cursorWordRange: vscode.Range | null,
  forward: boolean,
): vscode.Range | null {
  if (allRanges.length === 0) return null;
  const candidates = allRanges.filter((r) => cursorWordRange === null || !r.intersection(cursorWordRange));
  console.log(candidates);
  if (candidates.length === 0) return null;
  if (forward) {
    // return candidates.find((r) => r.start.isAfter(cursor)) ?? candidates[0];
      const found = candidates.find((r) => r.start.isAfter(cursor));
  console.log('cursor:', cursor, 'found:', found);
  return found ?? candidates[0];
  } else {
    return [...candidates].reverse().find((r) => r.end.isBefore(cursor)) ?? candidates[candidates.length - 1];
  }
}

function performJump(editor: vscode.TextEditor, word: string, range: vscode.Range): void {
  isJumping = true;
  editor.selection = new vscode.Selection(range.start, range.start);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  editorCache.set(editor, { word, lastVisibleRange: null });
  applyDecorations(editor, word);
}

export function jumpToNextMatch(): void {
  const editor = getActiveEditor();
  const cache = editorCache.get(editor);
  if (!cache?.word) return;
  const target = findNextJumpTarget(
    findAllMatchesInDocument(editor, cache.word),
    editor.selection.active,
    getCursorWordRange(),
    true,
  );
  if (target) performJump(editor, cache.word, target);
}

export function jumpToPrevMatch(): void {
  const editor = getActiveEditor();
  const cache = editorCache.get(editor);
  if (!cache?.word) return;
  const target = findNextJumpTarget(
    findAllMatchesInDocument(editor, cache.word),
    editor.selection.active,
    getCursorWordRange(),
    false,
  );
  if (target) performJump(editor, cache.word, target);
}

// ---------------------------------------------------------------
// 検索パターンの変更
// ---------------------------------------------------------------

export function changeSearchPattern() {
  const patterns = [standardPattern, extendedWordPattern, bigWordPattern, alnumPattern];
  const currentWordPattern = getWordPattern();
  const index = patterns.findIndex((p) => p === currentWordPattern);
  const nextIndex = (index + 1) % patterns.length;
  vscode.window.showInformationMessage(`現在の検索パターン：${patterns[nextIndex]}`);
  setWordPattern(patterns[nextIndex]);
  updateHighlight(getActiveEditor());
}
