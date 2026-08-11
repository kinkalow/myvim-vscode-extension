import * as vscode from 'vscode';
import { OpenModes, openModes } from '@utils/fileHelper/FileHelper';
import { open } from 'fs';

export interface QuickPickOptions {
  placeHolder?: string;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
}

class QuickPickHelper {
  private _fileOpenMode: OpenModes | null = null;

  get fileOpenMode(): OpenModes | null {
    return this._fileOpenMode;
  }

  /**
   * QuickPickを表示して選択結果を返す
   */
  async pick<T extends vscode.QuickPickItem>(
    items: T[],
    options?: {
      initialValue?: string; // 検索バーに入力させる最初の文字列
      placeHolder?: string; // 検索バーに表示するプレスホルダー
      canSelectMany?: boolean; // 選択候補は複数選ぶことを可能にするかどうか
      matchFromStart?: boolean; // 検索候補の開始文字からマッチするものを選ぶ
      matchOnDescription?: boolean; // descriptionも検索候補に加えるか
      matchOnDetail?: boolean; // Detailも検索候補に加えるか
      acceptWhenOneMatch?: boolean; // マッチしたものが1つになった時点で即座にアクセプトするかどうか
      spaceSeparatedAndMatch?: boolean; // 検索バーでスペース区切りにした各単語で絞り込むかどうか
      fileOpenModeTriggerChar?: string; // ファイルの開き方を設定するモードに移るための入力文字
    },
  ): Promise<T[] | undefined> {
    this._fileOpenMode = null;
    let isTemporarilyHidden: boolean = false;
    return new Promise((resolve) => {
      const qp = vscode.window.createQuickPick<T>();
      qp.value = options?.initialValue ?? '';
      qp.placeholder = options?.placeHolder;
      qp.canSelectMany = options?.canSelectMany ?? true;
      qp.matchOnDescription = false;
      qp.matchOnDetail = false;
      qp.items = items;

      const match = (text: string | undefined, keyword: string): boolean => {
        if (!text) return false;
        return options?.matchFromStart ? text.startsWith(keyword) : text.includes(keyword);
      };

      // '^' プレフィックス用
      const matchesStartsWith = (item: T, keyword: string): boolean => {
        if (item.label.startsWith(keyword)) return true;
        if (options?.matchOnDescription && item.description?.startsWith(keyword)) return true;
        if (options?.matchOnDetail && item.detail?.startsWith(keyword)) return true;
        return false;
      };

      // '$' サフィックス用
      const matchesEndsWith = (item: T, keyword: string): boolean => {
        if (item.label.endsWith(keyword)) return true;
        if (options?.matchOnDescription && item.description?.endsWith(keyword)) return true;
        if (options?.matchOnDetail && item.detail?.endsWith(keyword)) return true;
        return false;
      };

      // 通常マッチ
      const matchesKeyword = (item: T, keyword: string): boolean => {
        if (match(item.label, keyword)) return true;
        if (options?.matchOnDescription && match(item.description, keyword)) return true;
        if (options?.matchOnDetail && match(item.detail, keyword)) return true;
        return false;
      };

      qp.onDidChangeValue(async (value) => {
        if (value === '') {
          qp.items = items;
          return;
        }

        if (value.slice(-1) === options?.fileOpenModeTriggerChar) {
          isTemporarilyHidden = true;
          const quickPick = new QuickPickHelper();
          const picked = await quickPick.pick(
            openModes.map((openMode) => ({
              label: openMode,
            })),
            {
              placeHolder: 'ファイルの開き方を選択',
              acceptWhenOneMatch: true,
              canSelectMany: false,
              spaceSeparatedAndMatch: true,
              matchFromStart: true,
            },
          );
          isTemporarilyHidden = false;
          qp.show();
          qp.value = value.slice(0, -1);
          if (picked) this._fileOpenMode = picked[0].label;
          return;
        }

        let filtered: T[];
        if (options?.spaceSeparatedAndMatch) {
          const keywords = value.split(' ').filter((k) => k.length > 0);
          filtered = items.filter((item) =>
            keywords.every((keyword) => {
              if (keyword.startsWith('^')) {
                const rest = keyword.slice(1);
                return rest.length === 0 ? true : matchesStartsWith(item, rest);
              }
              if (keyword.endsWith('$')) {
                const rest = keyword.slice(0, -1);
                return rest.length === 0 ? true : matchesEndsWith(item, rest);
              }
              return matchesKeyword(item, keyword);
            }),
          );
        } else {
          filtered = items.filter((item) => matchesKeyword(item, value));
        }
        // VS Codeの標準のあいまい検索をスキップさせる
        // VS Codeの標準のあいまい検索を行うと、候補にa bとあったとき、b aの検索で候補が消えてしまう
        // ここでの設定はそのようなあいまい検索をスキップさせるためのものである
        filtered.forEach((item) => {
          (item as any).alwaysShow = true;
        });
        qp.items = filtered;

        if (options?.acceptWhenOneMatch && filtered.length === 1) {
          qp.hide();
          resolve([filtered[0]]);
          return;
        }
      });

      qp.onDidAccept(() => {
        if (isTemporarilyHidden) return;
        qp.hide();
        // canSelectManyをtrueにして、エンターで候補を選択したとき、qp.selectedItemsが空になる
        // qp.activeItemsにはエンターで選択した候補が出力される
        resolve([...new Map([...qp.selectedItems, ...qp.activeItems].map((item) => [JSON.stringify(item), item])).values()]);
      });

      qp.onDidHide(() => {
        if (isTemporarilyHidden) return;
        qp.dispose();
        resolve(undefined);
      });

      qp.show();
    });
  }
}

export const quickPickHelper = new QuickPickHelper();
