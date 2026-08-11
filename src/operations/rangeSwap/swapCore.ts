import * as vscode from 'vscode';
import { swapRegionHighlightStyle1, swapRegionHighlightStyle2, swapOverlapHighlightStyle } from './swapConfig';
import { swapRangeStartLine, swapRangeEndLine, getLineRangeAt, highlightSwapRange } from './swapUtils';
import { getActiveEditor } from '@utils/editor/editor';
import { highlightTemporarily } from '@utils/decoration/highlight';
import { VisualRange } from '@utils/visualModeHelper/visualMode';

// ----------------------------------------------------------------------
// 行数バリデーション
// ----------------------------------------------------------------------

/**
 * 行数チェック
 */
function validateLineCount(rangeA: VisualRange, rangeB: VisualRange): string | null {
  if (rangeA.mode === 'line' && rangeB.mode === 'line') return null;
  const la = rangeA.lines.length;
  const lb = rangeB.lines.length;
  if (la !== lb) {
    return `[エラー] 行数が異なるため交換できません（A: ${la}行, B: ${lb}行）`;
  }
  return null;
}

// ----------------------------------------------------------------------
// 重なりチェック
// ----------------------------------------------------------------------

export function isOverlapping(a: VisualRange, b: VisualRange): boolean {
  const aStart = swapRangeStartLine(a);
  const aEnd = swapRangeEndLine(a);
  const bStart = swapRangeStartLine(b);
  const bEnd = swapRangeEndLine(b);

  // 行単位で重なっていないか確認
  if (aEnd < bStart) return false;
  if (bEnd < aStart) return false;

  // 重なっている領域があるので、列単位で確認
  for (const la of a.lines) {
    const lb = getLineRangeAt(b, la.line); // bの中でla.lineと同じ行があるか
    if (lb === undefined) continue;
    // lb=la.lineなので列単位で確認
    const overlap = la.startCol <= lb.endCol && lb.startCol <= la.endCol;
    if (overlap) return true;
  }
  return false;
}

function highlightOverlappingRange(a: VisualRange, b: VisualRange) {
  let overlapRanges: { startLine: number; startCol: number; endLine: number; endCol: number }[] = [];
  for (const la of a.lines) {
    const lb = getLineRangeAt(b, la.line);
    if (!lb) continue;
    const overlapStart = Math.max(la.startCol, lb.startCol);
    const overlapEnd = Math.min(la.endCol, lb.endCol);
    if (overlapStart <= overlapEnd) {
      overlapRanges.push({ startLine: la.line, startCol: overlapStart, endLine: la.line, endCol: overlapEnd });
    }
  }
  if (overlapRanges.length > 0) {
    highlightSwapRange(a, swapRegionHighlightStyle1);
    highlightSwapRange(b, swapRegionHighlightStyle2);
    overlapRanges.map((range) => {
      highlightTemporarily(range, { style: swapOverlapHighlightStyle });
    });
  }
}

// ----------------------------------------------------------------------
// line-line同士のswap
// ----------------------------------------------------------------------

async function swapLineModeRanges(rangeA: VisualRange, rangeB: VisualRange): Promise<void> {
  const editor = getActiveEditor();

  // fistが先頭のrange、secondが後頭のrange
  const aStart = swapRangeStartLine(rangeA);
  const bStart = swapRangeStartLine(rangeB);
  const [first, second] = aStart <= bStart ? [rangeA, rangeB] : [rangeB, rangeA];

  // fistLines（secondLines）に先頭（後頭）のオリジナルテキスト
  const firstLines = first.lines.map((l) => editor.document.lineAt(l.line).text);
  const secondLines = second.lines.map((l) => editor.document.lineAt(l.line).text);

  const firstStart = swapRangeStartLine(first);
  const firstEnd = swapRangeEndLine(first);
  const secondStart = swapRangeStartLine(second);
  const secondEnd = swapRangeEndLine(second);

  await editor.edit((editBuilder) => {
    // 後頭のrangeを置換テキストに入れ替える
    const secondVscodeRange = new vscode.Range(
      new vscode.Position(secondStart, 0),
      new vscode.Position(secondEnd, editor.document.lineAt(secondEnd).text.length),
    );
    editBuilder.replace(secondVscodeRange, firstLines.join('\n'));
    // 先頭のrangeを置換テキストに入れ替える
    const firstVscodeRange = new vscode.Range(
      new vscode.Position(firstStart, 0),
      new vscode.Position(firstEnd, editor.document.lineAt(firstEnd).text.length),
    );
    editBuilder.replace(firstVscodeRange, secondLines.join('\n'));
  });
}

// ----------------------------------------------------------------------
// line-line以外のswap
// ----------------------------------------------------------------------

/**
 * 置換テキストを構築
 */
function buildSwappedLineText(
  originalText: string,
  occupantsOnThisLine: Array<{ startCol: number; endCol: number; newText: string }>,
): string {
  if (occupantsOnThisLine.length === 0) return originalText;

  // 列番号起点で昇順に並べる
  const sorted = [...occupantsOnThisLine].sort((a, b) => a.startCol - b.startCol);

  let result = '';
  let cursor = 0;
  // laとlbの行番号が一致する場合、prefixla=1b [lbの置換テキスト] prefixla=1b [laの置換テキスト] suffix1a=1b
  // 行番号が一致しない場合、prefix1a [1bの置換テキスト] suffix1a。lbも同様
  for (const occ of sorted) {
    // 昇順に並べたものから取り出す
    result += originalText.substring(cursor, occ.startCol); // prefix
    result += occ.newText; // 置換テキスト
    cursor = occ.endCol + 1;
  }
  result += originalText.substring(cursor); // suffix
  return result;
}

/**
 * 行同士以外の置換
 */
async function swapNonLineModeRanges(rangeA: VisualRange, rangeB: VisualRange): Promise<void> {
  const editor = getActiveEditor();

  type Occupant = { startCol: number; endCol: number; newText: string };
  const occupantsByLine = new Map<number, Occupant[]>();
  const originalTextByLine = new Map<number, string>();

  // line行のオリジナルテキストを返す
  const getOriginalLineText = (line: number): string => {
    if (!originalTextByLine.has(line)) {
      originalTextByLine.set(line, editor.document.lineAt(line).text);
    }
    return originalTextByLine.get(line)!;
  };

  // lineのstartColからendColに置換テキストを設定する
  const addOccupant = (line: number, startCol: number, endCol: number, newText: string) => {
    if (!occupantsByLine.has(line)) occupantsByLine.set(line, []);
    occupantsByLine.get(line)!.push({ startCol, endCol, newText });
    getOriginalLineText(line);
  };

  // ---- laとlbの行番号が一致するときのoccupantsByLine[iaとibのline]を構築 ----

  const usedA = new Set<number>(); // rangeA.lines のインデックス
  const usedB = new Set<number>(); // rangeB.lines のインデックス

  for (let ia = 0; ia < rangeA.lines.length; ia++) {
    const la = rangeA.lines[ia];
    const ib = rangeB.lines.findIndex((lb, idx) => lb.line === la.line && !usedB.has(idx)); // Bのindexを返す。それに対応する行はlaと同じであり、かつ未検索である
    if (ib === -1) continue; // laと同じ行がない。またはすでに調べた
    const lb = rangeB.lines[ib];

    // --- laとlbは同じ行 ---

    const aOriginalLineText = getOriginalLineText(la.line); // la行のテキスト
    const bOriginalLineText = getOriginalLineText(lb.line); // lb行のテキスト
    const aRangeText = aOriginalLineText.substring(la.startCol, la.endCol + 1); // laの置換に対応するテキスト
    const bRangeText = bOriginalLineText.substring(lb.startCol, lb.endCol + 1); // lbの置換に対応するテキスト

    addOccupant(la.line, la.startCol, la.endCol, bRangeText); // occupantsByLine[la]にlbの置換テキストを加えて構築
    addOccupant(lb.line, lb.startCol, lb.endCol, aRangeText); // occupantsByLine[lb]にlaの置換テキストを加えて構築

    usedA.add(ia);
    usedB.add(ib);
  }

  // ---- laとlbの行番号が一致しないときのoccupantsByLine[iaとibのline]を構築 ----

  const remainingA = rangeA.lines.filter((_, idx) => !usedA.has(idx)); // 行番号が一致しなかったindexが格納される
  const remainingB = rangeB.lines.filter((_, idx) => !usedB.has(idx));

  for (let i = 0; i < remainingA.length; i++) {
    const la = remainingA[i];
    const lb = remainingB[i];

    const aOriginalLineText = getOriginalLineText(la.line);
    const bOriginalLineText = getOriginalLineText(lb.line);
    const aRangeText = aOriginalLineText.substring(la.startCol, la.endCol + 1);
    const bRangeText = bOriginalLineText.substring(lb.startCol, lb.endCol + 1);

    addOccupant(la.line, la.startCol, la.endCol, bRangeText);
    addOccupant(lb.line, lb.startCol, lb.endCol, aRangeText);
  }

  // 確保したoccupantsByLineを用いてline行の置換テキストを構築
  type LineEdit = { line: number; newText: string };
  const edits: LineEdit[] = [];
  for (const [line, occupants] of occupantsByLine.entries()) {
    const originalText = originalTextByLine.get(line)!;
    const newText = buildSwappedLineText(originalText, occupants); // newTextにline行の置換テキストが入る
    edits.push({ line, newText });
  }

  // 行番号を降順に並び替えて、後方から置換行を入れ替える
  edits.sort((x, y) => y.line - x.line);
  await editor.edit((editBuilder) => {
    for (const { line, newText } of edits) {
      const lineRange = new vscode.Range(
        new vscode.Position(line, 0),
        new vscode.Position(line, editor.document.lineAt(line).text.length),
      );
      editBuilder.replace(lineRange, newText);
    }
  });
}

// ----------------------------------------------------------------------
// エントリポイント
// ----------------------------------------------------------------------

export async function swapSelections(rangeA: VisualRange, rangeB: VisualRange): Promise<void> {
  // rangeAとrangeBが重なっていればエラー
  if (isOverlapping(rangeA, rangeB)) {
    highlightOverlappingRange(rangeA, rangeB);
    vscode.window.showErrorMessage('[エラー] 交換する範囲が重なっています');
    return;
  }

  // rangeAとrangeBが同じ行数でなければエラー（line-lineは除く）
  const lineCountError = validateLineCount(rangeA, rangeB);
  if (lineCountError) {
    vscode.window.showErrorMessage(lineCountError);
    return;
  }

  // 行同士の置換
  if (rangeA.mode === 'line' && rangeB.mode === 'line') {
    await swapLineModeRanges(rangeA, rangeB);
    return;
  }

  // 行同士以外の置換
  await swapNonLineModeRanges(rangeA, rangeB);
}
