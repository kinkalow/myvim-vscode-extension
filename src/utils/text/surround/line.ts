/**
 * countChar（例: "2a", "a", "34\n"）をパースして count と char に分解する
 * @param countChar 数値+文字（例: "2a"）または文字のみ（例: "a"）または数値+\n（例: "34\n"）
 * @returns count: 何番目か（数値省略時は1）, char: 対象文字
 *   - count 数値（例: "2a"の2、"34\n"の3）
 *   - char 文字（例: "2a"のa、"34\n"の4）
 */
function parseCountChar(countChar: string): { count: number; char: string } {
  let match = countChar.match(/^(\d*)(\d)\n$/);
  if (!match) match = countChar.match(/^(\d*)(.+)$/);
  if (!match) return { count: 1, char: countChar };
  const count = match[1] === '' ? 1 : parseInt(match[1], 10);
  const char = match[2];
  return { count, char };
}

/**
 * text の cursorCol を起点として leftChar と rightChar で囲まれた範囲を返す
 * @param text カレント行のテキスト
 * @param cursorIndex カーソルのcol位置
 * @param leftChar 左側の指定（例: "2(", "(", "34"）
 * @param rightChar 右側の指定（例: "b", "5b"）
 * @returns 見つかった場合は囲みの範囲、見つからない場合は null
 *   - leftIndex 開始文字のcol
 *   - rightIndex 終端文字のcol
 */
export function getSurroundRangeByCountPair(
  text: string,
  cursorIndex: number,
  leftChar: string,
  rightChar: string,
): { leftIndex: number; rightIndex: number } | null {
  const left = parseCountChar(leftChar);
  const right = parseCountChar(rightChar);

  // 左側: カーソル位置を含む左方向にcount番目のcharを探す
  let leftCount = 0;
  let leftIndex = -1;
  for (let index = cursorIndex; index >= 0; index--) {
    if (text[index] === left.char) {
      leftCount++;
      if (leftCount === left.count) {
        leftIndex = index;
        break;
      }
    }
  }
  if (leftIndex === -1) return null;

  // 右側: カーソルから右方向にcount番目のcharを探す
  let rightCount = 0;
  let rightIndex = -1;
  for (let index = cursorIndex + 1; index < text.length; index++) {
    if (text[index] === right.char) {
      rightCount++;
      if (rightCount === right.count) {
        rightIndex = index;
        break;
      }
    }
  }
  if (rightIndex === -1) return null;

  return {  leftIndex,  rightIndex };
}
