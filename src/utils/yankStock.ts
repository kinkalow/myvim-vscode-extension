import * as vscode from 'vscode';
import { quickPickHelper } from '@utils/ui/QuickPickHelper';

class YankStock {
  private readonly maxSize: number;
  private readonly items: string[] = [];

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  clear(): void {
    this.items.length = 0;
  }

  async copyToClipboard(index: number): Promise<boolean> {
    const text = this.get(index);
    if (text === undefined) return false;
    await vscode.env.clipboard.writeText(text);
    return true;
  }

  get(index: number): string | undefined {
    return this.items[index];
  }

  getAll(): readonly string[] {
    return this.items;
  }

  push(text: string): void {
    if (text.length === 0) return;
    this.items.unshift(text);
    if (this.items.length > this.maxSize) {
      this.items.pop();
    }
  }

  // async quickPickMany(): Promise<string[] | null> {
  //   const items = await quickPickHelper.pick(
  //     this.items.map((item, index) => ({ label: `${index + 1} ${item}` })),
  //     { canSelectMany: false },
  //   );
  //   if (!items) return null;
  //   return items.map((item) => item.label.replace(/^\d+\s/, ''));
  // }

  // async quickPickOne(): Promise<string | null> {
  //   const item = await quickPickHelper.pick(
  //     this.items.map((item, index) => ({ label: `${index + 1} ${item}` })),
  //     { canSelectMany: false },
  //   );
  //   if (!item) return null;
  //   return item[0].label.replace(/^\d+\s/, '');
  // }

  get size(): number {
    return this.items.length;
  }
}

export const yankStock = new YankStock(9);
