interface QuoteRange {
  start: number; // クォート文字の開始位置もしくは内側の開始位置
  end: number; // クォート文字の終了位置もしくは内側の終了位置
}

/** Quotes（"'）で囲まれた範囲を返す
 * [制約] textの最初のquoteを開始とする
 * @param inside trueの場合、quoteの開始位置と終了位置の内側を返す
 */
export function getQuoteRanges(text: string, { inside = false }: { inside?: boolean } = {}): QuoteRange[] {
  const ranges: QuoteRange[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    // if (ch === '"' || ch === "'" || ch === '`') {
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++; // エスケープの次の1文字も読み飛ばす
        i++;
      }
      const end = i < text.length ? i : text.length - 1;
      if (inside) {
        if (start + 1 !== end) {
          ranges.push({ start: start + 1, end: end - 1 });
        }
      } else {
        ranges.push({ start, end });
      }
      i++;
      continue;
    }
    i++;
  }
  return ranges;
}

/** col がどれかのクォート区間に入っていれば、その区間を返す */
export function findQuoteRangeAt(ranges: QuoteRange[], col: number): QuoteRange | undefined {
  return ranges.find((r) => r.start <= col && col <= r.end);
}

/** textのcolの位置が３つのQuotes（"'`）の終端位置であるかどうかを返す
 * [制約] textの最初のquoteを開始とする
 */
export function isExtendedQuotesEnd(text: string, col: number): boolean {
  if(text.length <= col) return false;
  let i = 0;
  while (i <= col) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i <= col && text[i] !== quote) {
        if (text[i] === '\\') i++; // エスケープの次の1文字も読み飛ばす
        i++;
      }
      if (i === col) return true;
      continue;
    }
    i++;
  }
  return false;
}
