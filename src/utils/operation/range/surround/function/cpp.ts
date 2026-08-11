import * as vscode from 'vscode';
import { OperationRange } from '@utils/operation/operationType';
import { TextObjectPrefix } from '../type';

/** 空白・タブ・改行・行コメント・ブロックコメントを読み飛ばした位置を返す */
function skipWhitespaceAndComments(text: string, index: number): number {
  let i = index;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      i += 2;
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

/**
 * openIndex（開き文字の位置）からcloseCharの位置までを探索し、closeCharの位置を返す
 * 探索中、openCharが途中で現れたら、その回数＋１回分だけcloseCharを呼びださないといけない
 * quoteの間のopenCharとcloseCharは無視する
 */
function findMatchingCloser(text: string, openIndex: number, openChar: string, closeChar: string): number {
  let depth = 0;
  let i = openIndex;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '/' && text[i + 1] === '/') {
      i += 2;
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }

    if (ch === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }

    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
    i++;
  }

  return -1;
}

/**
 * 関数引数の終端')' の直後から、関数本体を開く '{' を探す
 * 途中、const, noexcept, override, throw(...), 属性 [[...]], 初期化子リストx(a)等がきても読み飛ばす（'['と'(' は対応する閉じまで読み飛ばす）
 * '{' が見つかればそれが本体開始
 * 先に ';' が見つかれば関数宣言とみなす
 *
 * 制約: 初期化子リストで波括弧初期化（例: f(): a{1} {...}）を使うケースは非対応。a{の{が関数本体と判断してしまう
 */
function findBodyOpenBrace(text: string, fromIndex: number): number | null {
  let i = fromIndex;

  while (i < text.length) {
    i = skipWhitespaceAndComments(text, i);
    if (i >= text.length) return null;

    const ch = text[i];

    if (ch === '{') {
      return i;
    }
    if (ch === ';') {
      return null; // 関数宣言
    }
    if (ch === '(' || ch === '[') {
      const closeChar = ch === '(' ? ')' : ']';
      const closeIdx = findMatchingCloser(text, i, ch, closeChar);
      if (closeIdx === -1) return null; // 壊れたコード
      i = closeIdx + 1;
      continue;
    }
    if (ch === '}' || ch === ')' || ch === ']') {
      return null; // 壊れたコード。開き記号の前に閉じ記号が呼ばれている
    }

    i++;
  }

  return null;
}

/** 関数領域を探索 */
function verifyCandidate(text: string, typeStart: number, parenIndex: number): { startOffset: number; endOffset: number } | null {
  const closeParenIndex = findMatchingCloser(text, parenIndex, '(', ')'); // 関数引数終端)の位置
  if (closeParenIndex === -1) return null;

  const openBraceIndex = findBodyOpenBrace(text, closeParenIndex + 1); // 関数開始{の位置
  if (openBraceIndex === null) return null;

  const closeBraceIndex = findMatchingCloser(text, openBraceIndex, '{', '}'); // 関数終端}の位置
  if (closeBraceIndex === -1) return null;

  return { startOffset: typeStart, endOffset: closeBraceIndex };
}

/** 関数型名の前(テンプレート宣言など)まで開始位置を広げる */
function extendToDeclStart(text: string, typeStart: number): number {
  let i = typeStart;
  // 識別子・スコープ演算子・テンプレート・ポインタ/参照・区切り・空白・改行を許す
  const allowedChar = /[A-Za-z0-9_:<>*&,\s]/;
  while (i > 0 && allowedChar.test(text[i - 1])) {
    i--;
  }
  // 先頭の空白・改行を取り除く
  while (i < typeStart && /\s/.test(text[i])) {
    i++;
  }
  return i;
}

export function getFunctionRangeForCpp(
  nth: number,
  textObjectPrefix: TextObjectPrefix,
  editor: vscode.TextEditor,
): OperationRange | null {
  const document = editor.document;
  const cursorOffset = document.offsetAt(editor.selection.active);
  const text = document.getText();

  const CANDIDATE_REGEX = /[ \t]*(\S.*?)\s+([A-Za-z_~][A-Za-z0-9_]*)\s*\(/dg;
  const CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch']);

  const candidates: { name: string; typeStart: number; parenIndex: number }[] = [];
  let match: RegExpExecArray | null;
  // CANDIDATE_REGEX.lastIndex = 0; // 検索開始位置を0に設定
  while ((match = CANDIDATE_REGEX.exec(text)) !== null) {
    const name = match[2];
    if (CONTROL_KEYWORDS.has(name)) continue;
    const parenIndex = match.index + match[0].length - 1; // (の位置
    const typeStart = match.indices![1]![0]; // 型の最初の文字
    candidates.push({ name, typeStart, parenIndex });
  }

  let count = 0;

  for (let i = candidates.length - 1; i >= 0; i--) {
    // 後ろから検索
    const candidate = candidates[i];
    if (candidate.typeStart > cursorOffset) continue; // カーソルの後ろに型名の最初の文字があれば無視

    const range = verifyCandidate(text, candidate.typeStart, candidate.parenIndex);
    if (!range) continue;

    // if (cursorOffset < range.startOffset || cursorOffset > range.endOffset) continue;

    count++;
    if (count < nth) continue;

    const declStart = extendToDeclStart(text, range.startOffset);
    const startPos = document.positionAt(declStart);
    const endPos = document.positionAt(range.endOffset);

    return {
      startLine: startPos.line,
      startCol: startPos.character,
      endLine: endPos.line,
      endCol: endPos.character,
      mode: textObjectPrefix === 'i' ? 'char' : 'line',
    };
  }

  return null;
}