import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';
import { OperationRange } from '@utils/operation/operationType';

interface TagPair {
  name: string;
  openStart: number;
  openEnd: number;
  closeStart: number;
  closeEnd: number;
}

/** void(自己終了)タグの一覧 */
// prettier-ignore
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

interface TagToken {
  type: 'open' | 'close' | 'void';
  name: string;
  start: number; // offset (タグ全体の '<' 位置)
  end: number; // offset (タグ全体の '>' の位置)
}

// タグの正規表現
const TAG_REGEX = /<(\/)?([a-zA-Z][a-zA-Z0-9:-]*)([^<>]*?)(\/)?>/g;

/** ドキュメントをトークン化する */
function tokenizeTags(text: string): TagToken[] {
  const tokens: TagToken[] = [];
  let match: RegExpExecArray | null;

  TAG_REGEX.lastIndex = 0;
  while ((match = TAG_REGEX.exec(text)) !== null) {
    const [full, closingSlash, tagName, , selfClosingSlash] = match;
    const name = tagName.toLowerCase();
    const start = match.index;
    const end = start + full.length - 1;

    let type: TagToken['type'];
    if (closingSlash) {
      type = 'close';
    } else if (selfClosingSlash || VOID_TAGS.has(name)) {
      type = 'void'; // <input ...> や <br/> はペア対象外
    } else {
      type = 'open';
    }

    tokens.push({ type, name, start, end });
  }

  return tokens;
}

/** タグのopenとcloseのペアを構築する */
function buildTagPairs(tokens: TagToken[]): TagPair[] {
  interface StackEntry {
    name: string;
    openStart: number;
    openEnd: number;
  }

  const stack: StackEntry[] = [];
  const pairs: TagPair[] = [];

  for (const token of tokens) {
    if (token.type === 'void') {
      continue; // ペア対象外なので無視
    }

    if (token.type === 'open') {
      stack.push({ name: token.name, openStart: token.start, openEnd: token.end });
      continue;
    }

    // type === 'close'
    // 対応する開きタグをスタックの上から探す
    const idx = [...stack].reverse().findIndex((e) => e.name === token.name);
    if (idx === -1) {
      continue; // 対応する開きタグが無い閉じタグは無視
    }
    const stackIdx = stack.length - 1 - idx; // stackに保存したopenのインデックス

    const [entry] = stack.splice(stackIdx, 1); // closeに対応するopenを取り出す
    stack.length = stackIdx; // 不要タグ削除。例えば<a><b></a>の場合<b>を削除

    pairs.push({
      name: entry.name,
      openStart: entry.openStart,
      openEnd: entry.openEnd,
      closeStart: token.start,
      closeEnd: token.end,
    });
  }

  return pairs;
}

/** カーソル位置から左に進んでタグが現れた順番で並び替える */
function sortTag(pairs: TagPair[], cursorOffset: number): TagPair[] {
  const filtering = pairs.filter((p) => p.openStart <= cursorOffset);
  filtering.sort((a, b) => b.openStart - a.openStart);
  return filtering;
}

/** offsetをlineとcolに変換し、タグのRangeを返す */
function makeRange(document: vscode.TextDocument, startOffset: number, endOffset: number): OperationRange {
  const start = document.positionAt(startOffset);
  const end = document.positionAt(endOffset);
  return {
    startLine: start.line,
    startCol: start.character,
    endLine: end.line,
    endCol: end.character,
    mode: 'char',
  };
}

/** カーソル位置を起点として左側に進み、見つかったタグの範囲（openとclose）を返す */
export function getSurroundByTag(textObject: 'a' | 'i', { nth = 1 }: { nth?: number } = {}): OperationRange | null {
  const editor = getActiveEditor();
  const document = editor.document;
  const cursorOffset = document.offsetAt(editor.selection.active);

  const text = document.getText();
  const tokens = tokenizeTags(text);
  const pairs = buildTagPairs(tokens);

  const enclosing = sortTag(pairs, cursorOffset);

  const target = enclosing[nth - 1];

  if (!target) return null;

  if (textObject === 'a') {
    return makeRange(document, target.openStart, target.closeEnd);
  } else {
    return makeRange(document, target.openEnd + 1, target.closeStart - 1);
  }
}

/** カレント位置を基準としてnth番目のタグの位置を返す */
export function getTagRanges(textObject: 'a' | 'i', { nth = 1 }: { nth?: number } = {}): OperationRange[] | null {
  const editor = getActiveEditor();
  const document = editor.document;
  const cursorOffset = document.offsetAt(editor.selection.active);

  const text = document.getText();
  const tokens = tokenizeTags(text);
  const pairs = buildTagPairs(tokens);

  const enclosing = sortTag(pairs, cursorOffset);

  const target = enclosing[nth - 1];

  if (!target) return null;

  const openRange = makeRange(document, target.openStart, target.openEnd);
  const closeRange = makeRange(document, target.closeStart, target.closeEnd);
  return [openRange, closeRange];
}
