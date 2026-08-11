import * as vscode from 'vscode';

import { substituteUnderCursor } from './commands/substitution';

import { action as actionForDiff, registerDiff } from './diff/diff';

import { open as openForFile } from './file/fileOpen';
import { open as openForworkspaceFiles } from './file/workspaceFiles';

import { foldSelection } from './fold/foldSelection';

import { run as runForMarkdownMemo } from './memo/markdownMemo';

import { enterVisualMode } from './modes/visualMode';
import { onInsertLeave } from './modes/onInsertLeave';

import { registorHalfPageScroll, enterHalfPageScroll } from './motion/halfPageScroll';
import { easyAction } from './motion/easyAction/main';
import { down as downForMoveToNonWhitespace, up as upForMoveToNonWhitespace } from './motion/moveToNonWhitespace';

import { applyOperator } from './operations/applyOperator';
import { interactiveArgumentSwap } from './operations/argumentSwap';
import { toggleCommentPerLine, toggleCommentBySelection } from './operations/comment';
import { deleteBackWord, deleteForwardWord } from './operations/cursorDeletion';
import { saveRange, swapRange, saveRangeVisual, SwapRangeVisual } from './operations/rangeSwap/swapCommands';
import { move as moveSelectedText } from './operations/selectedTextMove';
import {
  addLineSurround,
  deleteSurround,
  deleteTagSurround,
  deleteSpecificSurround,
  replaceSurround,
  replaceSpecificSurround,
  addSurroundToVisualSelection,
} from './operations/surround';
import { replaceWithYankStock, pasteFromYankStock } from './operations/yankStock';
import { startAlignMode } from './operations/align';

import {
  toggleHighlightCurrent,
  toggleHighlightAll,
  jumpToNextMatch,
  jumpToPrevMatch,
  changeSearchPattern,
} from './search/cursorWordHighlight';
import { insertSearchMatch } from './search/InsertSearchMatch';
import { regexGrep } from './search/regexGrep';
import { highlightPattern, highlightRepeatPattern } from './search/repeatPatternHighlight';
import { slash } from './search/slash';
import { visualSelectionSearch } from './search/visualSelectionSearch';

import { run as runForCurrentPathOperator } from './shell/currentPathOperator';
import { find } from './shell/find';
import { grep } from './shell/grep';
import { run as commandRun } from './shell/commands';
import { run as runForQuickRun, quickPick as quickPickForQuickRun, runCodeFence } from './shell/quickRun';

import { executeOriginalRepeat } from './repeat/executeOriginalRepeat';

import { closeParameterHintsThenRemap } from './ui/parameterHints';
import { closeSuggestWidgetThenRemap } from './ui/suggestWidget';

import { repeatLastCommand } from './utils/repeat';
import { registerGetOneChar } from './utils/ui/input';
import { run as runForFileViewerOperator } from './utils/ui/FileViewerOperator';

import { search as searchForWebSearch } from './web/webSearch';

import { registerWindowMode, enterWindowMode } from './window/windowMode';

//
// For debug
//

export async function runProductionExtension() {
  // .vscode/lauch.jsonのRun Production Extensionを起動する
  await vscode.debug.startDebugging(vscode.workspace.workspaceFolders?.[0], 'Production');
}

//
//
//

export function activate(context: vscode.ExtensionContext) {
  registerDiff(context);
  registorHalfPageScroll(context);
  registerGetOneChar(context);
  registerWindowMode(context);
  context.subscriptions.push(
    vscode.commands.registerCommand('myvim-commands-substitution.substituteUnderCursor', substituteUnderCursor),
    //
    vscode.commands.registerCommand('myvim-diff-diff.action', actionForDiff),
    //
    vscode.commands.registerCommand('myvim-file-fileOpen.open', openForFile),
    vscode.commands.registerCommand('myvim-file-workspaceFiles.open', openForworkspaceFiles),
    //
    vscode.commands.registerCommand('myvim-editor-fold.foldSelection', foldSelection),
    //
    vscode.commands.registerCommand('myvim-memo-markdownMemo.run', runForMarkdownMemo),
    //
    vscode.commands.registerCommand('myvim-modes-visualMode.enterVisualMode', enterVisualMode),
    vscode.commands.registerCommand('myvim-modes-onInsertLeave.onInsertLeave', onInsertLeave),
    //
    vscode.commands.registerCommand('myvim-motion-easyAction-main.easyAction', easyAction),
    vscode.commands.registerCommand('myvim-motion-halfPageScroll.enterHalfPageScroll', enterHalfPageScroll),
    vscode.commands.registerCommand('myvim-motion-moveToNonWhitespace.down', downForMoveToNonWhitespace),
    vscode.commands.registerCommand('myvim-motion-moveToNonWhitespace.up', upForMoveToNonWhitespace),
    //
    vscode.commands.registerCommand('myvim-operations-align.startAlignMode', startAlignMode),
    vscode.commands.registerCommand('myvim-operations-applyOperator.applyOperator', applyOperator),
    vscode.commands.registerCommand('myvim-operations-argumentSwap.interactiveArgumentSwap', interactiveArgumentSwap),
    vscode.commands.registerCommand('myvim-operations-cursorDeletion.deleteBackWord', deleteBackWord),
    vscode.commands.registerCommand('myvim-operations-comment.toggleCommentBySelection', toggleCommentBySelection),
    vscode.commands.registerCommand('myvim-operations-comment.toggleCommentPerLine', toggleCommentPerLine),
    vscode.commands.registerCommand('myvim-operations-cursorDeletion.deleteForwardWord', deleteForwardWord),
    vscode.commands.registerCommand('myvim-operations-rangeSwap.saveRange', saveRange),
    vscode.commands.registerCommand('myvim-operations-rangeSwap.swapRange', swapRange),
    vscode.commands.registerCommand('myvim-operations-rangeSwap.saveRangeVisual', saveRangeVisual),
    vscode.commands.registerCommand('myvim-operations-rangeSwap.swapRangeVisual', SwapRangeVisual),
    vscode.commands.registerCommand('myvim-operations-selectedTextMove.move', moveSelectedText),
    vscode.commands.registerCommand('myvim-operations-surround.addLineSurround', addLineSurround),
    vscode.commands.registerCommand('myvim-operations-surround.addSurroundToVisualSelection', addSurroundToVisualSelection),
    vscode.commands.registerCommand('myvim-operations-surround.deleteSpecificSurround', deleteSpecificSurround),
    vscode.commands.registerCommand('myvim-operations-surround.deleteSurround', deleteSurround),
    vscode.commands.registerCommand('myvim-operations-surround.replaceSpecificSurround', replaceSpecificSurround),
    vscode.commands.registerCommand('myvim-operations-surround.replaceSurround', replaceSurround),
    vscode.commands.registerCommand('myvim-operations-surround.deleteTagSurround', deleteTagSurround),
    vscode.commands.registerCommand('myvim-operations-yankStock.pasteFromYankStock', pasteFromYankStock),
    vscode.commands.registerCommand('myvim-operations-yankStock.replaceWithYankStock', replaceWithYankStock),
    //
    vscode.commands.registerCommand('myvim-repeat-executeOriginalRepeat.executeOriginalRepeat', executeOriginalRepeat),
    //
    vscode.commands.registerCommand('myvim-search-cursorWordHighlight.changeSearchPattern', changeSearchPattern),
    vscode.commands.registerCommand('myvim-search-cursorWordHighlight.jumpToNextMatch', jumpToNextMatch),
    vscode.commands.registerCommand('myvim-search-cursorWordHighlight.jumpToPrevMatch', jumpToPrevMatch),
    vscode.commands.registerCommand('myvim-search-cursorWordHighlight.toggleHighlightAll', toggleHighlightAll),
    vscode.commands.registerCommand('myvim-search-cursorWordHighlight.toggleHighlightCurrent', toggleHighlightCurrent),
    vscode.commands.registerCommand('myvim-search-insertSearchMatch.insertSearchMatch', insertSearchMatch),
    vscode.commands.registerCommand('myvim-search-regexGrep.regexGrep', regexGrep),
    vscode.commands.registerCommand('myvim-search-repeatPatternHighlight.highlightPattern', highlightPattern),
    vscode.commands.registerCommand('myvim-search-repeatPatternHighlight.highlightRepeatPattern', highlightRepeatPattern),
    vscode.commands.registerCommand('myvim-search-slash.slash', slash),
    vscode.commands.registerCommand('myvim-search-visualSelectionSearch.visualSelectionSearch', visualSelectionSearch),
    //
    vscode.commands.registerCommand('myvim-shell-commands.run', commandRun),
    vscode.commands.registerCommand('myvim-shell-currentPathOperator.run', runForCurrentPathOperator),
    vscode.commands.registerCommand('myvim-shell-find.find', find),
    vscode.commands.registerCommand('myvim-shell-grep.grep', grep),
    vscode.commands.registerCommand('myvim-shell-quickRun.run', runForQuickRun),
    vscode.commands.registerCommand('myvim-shell-quickRun.quickPick', quickPickForQuickRun),
    vscode.commands.registerCommand('myvim-shell-quickRun.runCodeFence', runCodeFence),
    // vscode.commands.registerCommand('myvim-shell-grep.jumpFromShellResult', jumpFromShellResult),
    //
    vscode.commands.registerCommand('myvim-ui-parameterHints.closeParameterHintsThenRemap', closeParameterHintsThenRemap),
    vscode.commands.registerCommand('myvim-ui-suggestWidget.closeSuggestWidgetThenRemap', closeSuggestWidgetThenRemap),
    //
    vscode.commands.registerCommand('myvim-utils-repeat.repeatLastCommand', repeatLastCommand),
    vscode.commands.registerCommand('myvim-utils-ui-FileViewerOperation.run', runForFileViewerOperator),
    //
    vscode.commands.registerCommand('myvim-utils-ui-webSearch.search', searchForWebSearch),
    //
    vscode.commands.registerCommand('myvim-window-windowMode.enterWindowMode', enterWindowMode),
    //
    vscode.commands.registerCommand('myvim.runProductionExtension', runProductionExtension),
  );
}

export function deactivate() {}
