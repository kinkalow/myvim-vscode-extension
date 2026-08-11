class SearchHistory {
  private static readonly MAX_HISTORY = 10;
  private readonly history: string[] = [];

  /**
   * 検索テキストを履歴に追加する
   * 同じテキストが既にある場合は先頭に移動する
   * 最大MAX_HISTORY件まで保持する
   */
  push(text: string): void {
    if (!text) return;
    // 同じテキストがあれば削除
    const existingIndex = this.history.indexOf(text);
    if (existingIndex !== -1) {
      this.history.splice(existingIndex, 1);
    }
    // 先頭に追加
    this.history.unshift(text);
    // 最大件数を超えたら末尾を捨てる
    if (this.history.length > SearchHistory.MAX_HISTORY) {
      this.history.pop();
    }
  }

  /** 最新の検索テキストを返す */
  getLatest(): string | null {
    return this.history[0] ?? null;
  }

  /** 履歴をインデックスで取得する */
  get(index: number = 0): string | null {
    return this.history[index] ?? null;
  }

  /** 検索履歴を全件返す */
  getAll(): string[] {
    return [...this.history];
  }

  /** 検索履歴をクリアする */
  clear(): void {
    this.history.length = 0;
  }

  /** 履歴の件数を返す*/
  count(): number {
    return this.history.length;
  }
}

export const searchHistory = new SearchHistory();
