import * as vscode from 'vscode';

/**
 * ヒントの対象となる位置情報
 * - line, col: ヒントを表示する位置
 * - range: アクション対象の範囲（コピーやジャンプなどに使用）
 */
export interface RegionInfo {
  line: number;
  col: number;
  range: vscode.Range; // アクションの対象範囲
}

/**
 * アクションの種類
 * - jump: カーソルをHintの位置に移動
 * - yank: カーソルをHintの位置に移動してyankし、元の位置に戻る
 */
export const actionKinds = ['jump', 'paste', 'yank'] as const;
export type ActionKind = (typeof actionKinds)[number];

/**
 * ターゲットの種類
 * - word:   単語
 * - symbol: 囲み文字 ( [ { " ' ` <
 */
export const hints = ['twoChar', 'symbol', 'word'] as const;
export type HintKind = (typeof hints)[number];


/**
 * n: normal
 * i: insert
 */
export const modes = ['n', 'i'] as const;
export type Mode = (typeof modes)[number];