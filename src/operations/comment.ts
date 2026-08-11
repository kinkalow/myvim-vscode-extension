import * as vscode from 'vscode';
import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';
import { COMMENT_STYLE_MAP, CommentStyle } from '@utils/config/comment';
import { getActiveEditor } from '@utils/editor';

interface CommentSegment {
  startLine: number;
  endLine: number;
  isCommented: boolean;
}

function isLineCommented(lineText: string, commentStyle: CommentStyle): boolean {
  const trimmed = lineText.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (commentStyle.line && trimmed.startsWith(commentStyle.line)) {
    return true;
  }
  // NOTE: 複数行のコメントに対応していない
  if (commentStyle.block) {
    const [open, close] = commentStyle.block;
    if (trimmed.startsWith(open) && trimmed.endsWith(close)) {
      return true;
    }
  }
  return false;
}

function getCommentSegments(
  document: vscode.TextDocument,
  startLine: number,
  endLine: number,
  commentStyle: CommentStyle,
): CommentSegment[] {
  const segments: CommentSegment[] = [];

  let currentStart = startLine;
  let currentState: boolean | null = null;

  for (let line = startLine; line <= endLine; line++) {
    const text = document.lineAt(line).text;
    const trimmed = text.trim();

    // 空行は直前の状態を維持したまま同じグループに含める
    // グループなしの場合にはコメントしない
    const commented: boolean | null = trimmed.length === 0 ? (currentState ?? false) : isLineCommented(text, commentStyle);

    if (currentState === null) {
      currentState = commented;
      currentStart = line;
    } else if (commented !== currentState) {
      segments.push({ startLine: currentStart, endLine: line - 1, isCommented: currentState });
      currentState = commented;
      currentStart = line;
    }
  }

  if (currentState !== null) {
    segments.push({ startLine: currentStart, endLine, isCommented: currentState });
  }

  return segments;
}

/**
 * コメントありの行は外して、コメントなしの行は加える
 * Visual Modeで使用
 */
export async function toggleCommentPerLine(): Promise<void> {
  const editor = getActiveEditor();
  const result = visualModeHelper.getVisualSelection();
  if (!result) return;
  const { startLine, endLine } = result;

  const document = editor.document;
  const commentStyle = COMMENT_STYLE_MAP[document.languageId];
  if (!commentStyle) {
    vscode.window.showWarningMessage(`言語 "${document.languageId}" のコメント設定が未対応です`);
    await vscode.commands.executeCommand('editor.action.commentLine');
    return;
  }

  const segments = getCommentSegments(document, startLine, endLine, commentStyle);

  // 行番号がズレないよう、下から処理する
  const sortedSegments = [...segments].sort((a, b) => b.startLine - a.startLine);
  for (const segment of sortedSegments) {
    const startPos = new vscode.Position(segment.startLine, 0);
    const endPos = new vscode.Position(segment.endLine, 1); // 0にするとendlineが含まれない
    editor.selection = new vscode.Selection(startPos, endPos); // Visual Modeに関係なくblock単位のコメントとして認識しない
    if (segment.isCommented) {
      await vscode.commands.executeCommand('editor.action.removeCommentLine');
    } else {
      await vscode.commands.executeCommand('editor.action.addCommentLine');
    }
  }

  await vscode.commands.executeCommand('vim.remap', { after: ['<Esc>'] });
}

/**
 * 全体のセレクションから判断してコメントを加えるか外すかを選択する
 * Visual Modeで使用
 */
export async function toggleCommentBySelection(): Promise<void> {
  const editor = getActiveEditor();
  const result = visualModeHelper.getVisualSelection();
  if (!result) return;
  const { startLine, endLine } = result;
  const commentStyle = COMMENT_STYLE_MAP[editor.document.languageId];
  if (!commentStyle) {
    vscode.window.showWarningMessage(`言語 "${editor.document.languageId}" のコメント設定が未対応です`);
    await vscode.commands.executeCommand('editor.action.commentLine');
    return;
  }
  const startPos = new vscode.Position(startLine, 0);
  const endPos = new vscode.Position(endLine, 1);
  editor.selection = new vscode.Selection(startPos, endPos);
  await vscode.commands.executeCommand('editor.action.commentLine');
  await vscode.commands.executeCommand('vim.remap', { after: ['<Esc>'] });
}
