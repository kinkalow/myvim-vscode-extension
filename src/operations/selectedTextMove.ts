import * as vscode from 'vscode';
import { getActiveEditor } from '@utils/editor/editor';
import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';
import { validateIncludes } from '@utils/validation/args';
import { VisualLineRange, VisualRange, getVisualRange } from '@utils/visualModeHelper/visualMode';

const validDirection = ['h', 'j', 'k', 'l'] as const;
type Direction = (typeof validDirection)[number];

// -----------------------------------------------------------------------
// range2のテキストを構築
// -----------------------------------------------------------------------
function buildRange2Text(range2Lines: VisualLineRange[]): string {
  const editor = getActiveEditor();
  return range2Lines
    .map((l) => {
      const lineText = editor.document.lineAt(l.line).text;
      return lineText.substring(l.startCol, l.endCol + 1);
    })
    .join('\n');
}

// -----------------------------------------------------------------------
// スペース補填
// -----------------------------------------------------------------------
async function padSpacesForRange2(range2Lines: VisualLineRange[]): Promise<void> {
  const editor = getActiveEditor();
  const doc = editor.document;
  const totalLines = doc.lineCount;

  // range2が最終行を超えたていたら改行を追加
  await editor.edit((editBuilder) => {
    const maxLine = Math.max(...range2Lines.map((l) => l.line));
    if (maxLine >= totalLines) {
      const shortage = maxLine - totalLines + 1;
      const lastLine = doc.lineAt(totalLines - 1);
      const lastLineEnd = lastLine.range.end; // 最終行の末尾
      editBuilder.insert(lastLineEnd, '\n'.repeat(shortage)); // 最終行の末尾に\nを追加する
    }
  });

  // range2がテキストの枠をはみでていたら、はみ出た領域に空白を追加
  await editor.edit((editBuilder) => {
    const doc2 = editor.document;
    for (const r2 of range2Lines) {
      const lineText = r2.line < doc2.lineCount ? doc2.lineAt(r2.line).text : '';
      if (lineText.length <= r2.endCol) {
        const shortage = r2.endCol - lineText.length + 1;
        const lineEnd = new vscode.Position(r2.line, lineText.length); // 末尾の位置
        editBuilder.insert(lineEnd, ' '.repeat(shortage)); // 末尾の位置からr2.endColまで空白を追加
      }
    }
  });
}

// -----------------------------------------------------------------------
// range2 の構築
// -----------------------------------------------------------------------
async function buildRange2(range1: VisualRange, direction: Direction): Promise<VisualRange | null> {
  // NOTE: 2行以上のVisual Charに対応していない
  const lines = range1.lines;
  if (lines.length === 0) return null;

  const mode = visualModeHelper.getLastMode();
  if (mode === 'line') return buildRange2ForVisualLine(lines, direction);
  if (mode === 'char' && lines.length >= 2) return null;

  let range2Lines: VisualLineRange[];
  switch (direction) {
    case 'h': {
      if (lines[0].startCol <= 0) return null;
      range2Lines = lines.map((l, i) => ({
        line: lines[i].line,
        startCol: lines[i].startCol - 1,
        endCol: lines[i].startCol - 1,
      }));
      break;
    }
    case 'j': {
      const bottomLine = lines[lines.length - 1];
      range2Lines = [
        {
          line: bottomLine.line + 1,
          startCol: bottomLine.startCol,
          endCol: bottomLine.endCol,
        },
      ];
      break;
    }
    case 'k': {
      const topLine = lines[0];
      if (topLine.line <= 0) return null;
      range2Lines = [
        {
          line: topLine.line - 1,
          startCol: topLine.startCol,
          endCol: topLine.endCol,
        },
      ];
      break;
    }
    case 'l': {
      range2Lines = lines.map((l, i) => ({
        line: lines[i].line,
        startCol: lines[i].endCol + 1,
        endCol: lines[i].endCol + 1,
      }));
      break;
    }
  }

  await padSpacesForRange2(range2Lines);
  const text = buildRange2Text(range2Lines);

  return {
    mode: range1.mode,
    lines: range2Lines,
    text,
  };
}

function buildRange2ForVisualLine(lines: VisualLineRange[], direction: Direction): VisualRange | null {
  const editor = getActiveEditor();
  let range2Lines: VisualLineRange[];
  switch (direction) {
    case 'h': {
      return null;
    }
    case 'j': {
      const bottomLine = lines[lines.length - 1];
      range2Lines = [
        {
          line: bottomLine.line + 1,
          startCol: 0,
          endCol: editor.document.lineAt(bottomLine.line + 1).text.length - 1,
        },
      ];
      break;
    }
    case 'k': {
      const topLine = lines[0];
      if (topLine.line <= 0) return null;
      range2Lines = [
        {
          line: topLine.line - 1,
          startCol: 0,
          endCol: editor.document.lineAt(topLine.line - 1).text.length - 1,
        },
      ];
      break;
    }
    case 'l': {
      return null;
    }
  }
  const text = buildRange2Text(range2Lines);
  return {
    mode: 'line',
    lines: range2Lines,
    text,
  };
}

// -----------------------------------------------------------------------
// textMoveのコアロジック
// -----------------------------------------------------------------------
async function textMoveImpl(rangeA: VisualRange, rangeB: VisualRange, direction: Direction): Promise<void> {
  // NOTE: 2行以上のVisual Charに対応していない
  const mode = visualModeHelper.getLastMode();
  if (mode === 'line') return textMoveImplForVisualLine(rangeA, rangeB, direction);

  const editor = getActiveEditor();

  const textAArray = rangeA.text.split('\n');
  const textBArray = rangeB.text.split('\n');

  await editor.edit((editBuilder) => {
    if (direction === 'h') {
      for (let i = 0; i < rangeA.lines.length; i++) {
        const currentLine = rangeA.lines[i];
        const vscRange = new vscode.Range(
          new vscode.Position(currentLine.line, currentLine.startCol - 1),
          new vscode.Position(currentLine.line, currentLine.endCol + 1),
        );
        editBuilder.replace(vscRange, textAArray[i] + textBArray[i]);
      }
    } else if (direction === 'j') {
      const firstLine = rangeA.lines[0];
      const startLine = firstLine.line;
      const startCol = firstLine.startCol;
      const endCol = firstLine.endCol;
      const shiftedTexts = [textBArray[0], ...textAArray];
      for (let i = 0; i < shiftedTexts.length; i++) {
        const vscodeRange = new vscode.Range(
          new vscode.Position(startLine + i, startCol),
          new vscode.Position(startLine + i, endCol + 1),
        );
        editBuilder.replace(vscodeRange, shiftedTexts[i]);
      }
    } else if (direction === 'k') {
      const firstLine = rangeA.lines[0];
      const startLine = firstLine.line;
      const startCol = firstLine.startCol;
      const endCol = firstLine.endCol;
      const shiftedTexts = [...textAArray, textBArray[0]];
      for (let i = 0; i < shiftedTexts.length; i++) {
        const vscodeRange = new vscode.Range(
          new vscode.Position(startLine - 1 + i, startCol),
          new vscode.Position(startLine - 1 + i, endCol + 1),
        );
        editBuilder.replace(vscodeRange, shiftedTexts[i]);
      }
    } else if (direction === 'l') {
      for (let i = 0; i < rangeA.lines.length; i++) {
        const currentLine = rangeA.lines[i];
        const vscRange = new vscode.Range(
          new vscode.Position(currentLine.line, currentLine.startCol),
          new vscode.Position(currentLine.line, currentLine.endCol + 2),
        );
        editBuilder.replace(vscRange, textBArray[i] + textAArray[i]);
      }
    }
  });
}

async function textMoveImplForVisualLine(rangeA: VisualRange, rangeB: VisualRange, direction: Direction): Promise<void> {
  const editor = getActiveEditor();
  await editor.edit((editBuilder) => {
    if (direction === 'j') {
      const startLine = rangeA.lines[0].line;
      const startCol = 0;
      const endLine = rangeB.lines[0].line;
      const endCol = rangeB.lines[0].endCol;
      const vscodeRange = new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol + 1));
      editBuilder.replace(vscodeRange, `${rangeB.text}\n${rangeA.text}`);
    } else if (direction === 'k') {
      const startLine = rangeB.lines[0].line;
      const startCol = 0;
      const endLine = rangeA.lines[rangeA.lines.length - 1].line;
      const endCol = rangeA.lines[rangeA.lines.length - 1].endCol;
      const vscodeRange = new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol + 1));
      editBuilder.replace(vscodeRange, `${rangeA.text}\n${rangeB.text}`);
    }
  });
}

// -----------------------------------------------------------------------
// エントリポイント
// -----------------------------------------------------------------------
export async function move(args: { direction: Direction }): Promise<void> {
  const { direction } = args;
  validateIncludes(direction, validDirection, 'direction');

  let range1 = getVisualRange();
  if (range1 === null) return;
  const range2 = await buildRange2(range1, direction);
  if (range2 === null) return;

  await textMoveImpl(range1, range2, direction);
  if (direction === 'h') {
    range1.lines.forEach((l) => {
      l.startCol -= 1;
      l.endCol -= 1;
    });
  } else if (direction === 'j') {
    range1.lines.forEach((l) => {
      l.line += 1;
    });
  } else if (direction === 'k') {
    range1.lines.forEach((l) => {
      l.line -= 1;
    });
  } else if (direction === 'l') {
    range1.lines.forEach((l) => {
      l.startCol += 1;
      l.endCol += 1;
    });
  }

  const firstLine = range1.lines[0];
  const lastLine = range1.lines[range1.lines.length - 1];
  const lineDiff = lastLine.line - firstLine.line;
  const targetCol = lastLine.endCol + 1;
  const afterKeys: string[] = [];
  afterKeys.push('<Esc>');
  afterKeys.push(...`${firstLine.line + 1}G${firstLine.startCol + 1}|`);
  afterKeys.push(...visualModeHelper.getLastVimMapping({ returnType: 'array' }));
  if (lineDiff > 0) afterKeys.push(...String(lineDiff), 'j');
  afterKeys.push(...String(targetCol), '|');
  await vscode.commands.executeCommand('vim.remap', { after: afterKeys });
}
