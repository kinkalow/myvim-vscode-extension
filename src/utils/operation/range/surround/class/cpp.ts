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
 * クラス名の直後から、クラス本体を開く '{' を探す
 * 継承リスト（例: public Base1, private Base2<int> 等）は読み飛ばす
 * '{' が見つかればそれが本体開始
 * 先に ';' が見つかればクラス宣言とみなす
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
      return null; // クラス宣言
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

/** クラス領域を探索 */
function verifyClassCandidate(text: string, keywordStart: number, nameEnd: number): { startOffset: number; endOffset: number } | null {
  const openBraceIndex = findBodyOpenBrace(text, nameEnd); // クラス開始{の位置
  if (openBraceIndex === null) return null;

  const closeBraceIndex = findMatchingCloser(text, openBraceIndex, '{', '}'); // クラス終端}の位置
  if (closeBraceIndex === -1) return null;

  return { startOffset: keywordStart, endOffset: closeBraceIndex };
}

/** class/struct キーワードの前(テンプレート宣言など)まで開始位置を広げる */
function extendToDeclStart(text: string, keywordStart: number): number {
  let i = keywordStart;
  // 識別子・スコープ演算子・テンプレート・空白・改行を許す
  const allowedChar = /[A-Za-z0-9_:<>*&,\s]/;
  while (i > 0 && allowedChar.test(text[i - 1])) {
    i--;
  }
  // 先頭の空白・改行を取り除く
  while (i < keywordStart && /\s/.test(text[i])) {
    i++;
  }
  return i;
}

export function getClassRangeForCpp(
  nth: number,
  textObjectPrefix: TextObjectPrefix,
  editor: vscode.TextEditor,
): OperationRange | null {
  const document = editor.document;
  const cursorOffset = document.offsetAt(editor.selection.active);
  const text = document.getText();

  const CANDIDATE_REGEX = /\b(class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)/dg;

  const candidates: { keywordStart: number; nameEnd: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = CANDIDATE_REGEX.exec(text)) !== null) {
    const keywordStart = match.index;
    const nameEnd = match.indices![2]![1]; // 識別子の直後の位置
    candidates.push({ keywordStart, nameEnd });
  }

  let count = 0;

  for (let i = candidates.length - 1; i >= 0; i--) {
    // 後ろから検索
    const candidate = candidates[i];
    if (candidate.keywordStart > cursorOffset) continue; // カーソルより後ろのclassキーワードは無視

    const range = verifyClassCandidate(text, candidate.keywordStart, candidate.nameEnd);
    if (!range) continue;

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