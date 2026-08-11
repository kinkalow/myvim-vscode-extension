import * as vscode from 'vscode';
import { EditorHelper } from '@utils/editorHelper/EditorHelper';
import { searchHistory } from '@utils/SearchHistory';

interface MatchQuickPickItem extends vscode.QuickPickItem {
  line: number;
  col: number;
  index: number;
}

async function slashImpl(helper: EditorHelper, args: { displayCandidates?: boolean } = {}): Promise<void> {
  const { displayCandidates = false } = args;

  const quickPick = vscode.window.createQuickPick();
  quickPick.keepScrollPosition = true;
  // quickPick.matchOnDescription = false;
  // quickPick.matchOnDetail = false;

  const cursorPos = helper.cursor.get();
  let savedItemIndex = 0;
  let lastEvent = '';
  let decorations: vscode.TextEditorDecorationType[];
  const searchStyle: vscode.DecorationRenderOptions = helper.config.getHighlightStyle('search');
  // const searchStyle = { backgroundColor: 'rgba(132, 223, 226, 0.4)', border: 'rgba(255, 255, 255, 0.8)' };
  const cursorDecoration = helper.decoration.highlight(cursorPos.line, cursorPos.col, cursorPos.line, cursorPos.col, {
    style: helper.config.getHighlightStyle('cursor'),
  });

  return new Promise((resolve) => {
    // 入力する度に発火
    quickPick.onDidChangeValue(async () => {
      // ハイライト削除
      if (decorations) helper.decoration.clear(decorations);

      if (quickPick.value === '') {
        quickPick.items = [];
        return;
      }

      // 入力のquickPick.valueにマッチするテキストを取得
      const matches = helper.search.find(cursorPos.line, cursorPos.col, quickPick.value, { rejectUnescapedSymbols: ['|'] }); // NOTE: '|'にエスケープされていないとフリーズする
      if (matches.length === 0) {
        quickPick.items = [];
        return;
      }

      if (displayCandidates) {
        // matchesのlineとcolの位置から行末までのテキストを取得してitemsに設定
        quickPick.items = matches.map((m, i) => {
          const lineText = helper.editor.document.lineAt(m.startLine).text;
          const textToEnd = lineText.substring(m.startCol); // col位置から行末まで
          return {
            label: textToEnd,
            description: `${m.startLine + 1}:${m.startCol + 1}:[${matches.length}]`,
            alwaysShow: true, // trueの場合、表示リスト(matches)からquickPick.valueを使ってフィルタリングしない
            index: i,
            line: m.startLine,
            col: m.startCol,
          };
        });
      }

      // カーソルを移動＋ハイライト
      const ranges = helper.editor.visibleRanges;
      let highlightLineNumber = 100;
      if (ranges.length > 0) {
        const topStartLine = ranges[0].start.line;
        const bottomEndLine = ranges[ranges.length - 1].end.line;
        highlightLineNumber = bottomEndLine - topStartLine + 1;
        highlightLineNumber = highlightLineNumber % 2 === 0 ? highlightLineNumber : highlightLineNumber + 1;
      }
      let { startLine, startCol, endLine, endCol } = matches[0];
      const startHighlightLine = startLine - highlightLineNumber;
      const endHighlightLine = startLine + highlightLineNumber;
      helper.revealIfOutsideViewPort(startLine, startCol);
      decorations = [];
      for ({ startLine, startCol, endLine, endCol } of matches) {
        if (startLine >= startHighlightLine && endLine <= endHighlightLine) {
          decorations.push(helper.decoration.highlight(startLine, startCol, endLine, endCol, { style: searchStyle }));
        }
      }
      lastEvent = 'changeValue';
      // let { startLine, startCol, endLine, endCol } = matches[0];
      // helper.revealIfOutsideViewPort(startLine, startCol);
      // decorations = [];
      // for ({ startLine, startCol, endLine, endCol } of matches) {
      //   decorations.push(helper.decoration.highlight(startLine, startCol, endLine, endCol, { style: searchStyle }));
      // }
      // lastEvent = 'changeValue';
    });

    if (displayCandidates) {
      // 入力する度に発火。候補の選択を変更したときも発火
      quickPick.onDidChangeActive(async (items) => {
        if (items.length === 0) return;
        const item = items[0] as MatchQuickPickItem;
        if (item.index === savedItemIndex) return;
        helper.revealIfOutsideViewPort(item.line, item.col);
        // await helper.cursor.set(item.line, item.col, { revealIfOutsideViewport: true });
        savedItemIndex = item.index;
        lastEvent = 'changeActive';
      });
    }

    // 候補選択時に発火
    quickPick.onDidAccept(async () => {
      quickPick.hide();
      helper.decoration.clear(cursorDecoration);
      if (decorations) helper.decoration.clear(decorations);
      const matches = helper.search.findFromCursor(quickPick.value, { rejectUnescapedSymbols: ['|'] }); // NOTE: '|'にエスケープされていないとフリーズする
      if (matches.length === 0) return;
      const index = lastEvent === 'changeValue' ? 0 : savedItemIndex;
      await helper.cursor.set(matches[index].startLine, matches[index].startCol, {
        wait: 'both',
        moveToPreviousChar: true,
        revealIfOutsideViewport: true,
      });
      await helper.vim.remap(['<C-a>', '|', '/', ...quickPick.value, '<CR>']); // quickPick.valueの代わりにmatch[0].textを使用するとエスケープされない文字が変えるからNG
      searchHistory.push(matches[index].text);
      resolve();
    });

    // キャンセル時に発火
    quickPick.onDidHide(async () => {
      helper.decoration.clear(cursorDecoration);
      if (decorations) helper.decoration.clear(decorations);
      resolve();
    });

    quickPick.show();
  });
}

/** Vimのslashの代替
 * @param: displayCandidates 検索入力時に候補を出力するかどうか
 */
export function slash(args: { displayCandidates?: boolean } = {}): void {
  const helper = new EditorHelper();
  // FIXME: nohは関数を終了しないと反映されないため、slashImplをawaitなしで実行
  // FIXME: しかしこの方法はquickPickを呼び出す前に入力コマンドがあると想定外の挙動になる
  helper.vim.remap(':noh<CR>', { wait: 'after' });
  slashImpl(helper, args);
}
