import { VIM_COUNT_DEBOUNCE_DELAY_MS } from '@utils/config/vim';

let callCount = 0;
let debounceTimer: NodeJS.Timeout | null = null;

export async function invokeWithVimCount<T extends unknown[]>(
  main: (count: number, ...args: T) => Promise<void>,
  ...args: T
): Promise<void> {
  callCount++;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    const finalCount = callCount;
    callCount = 0;
    debounceTimer = null;

    await main(finalCount, ...args);
  }, VIM_COUNT_DEBOUNCE_DELAY_MS);
}
