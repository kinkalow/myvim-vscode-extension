class TextHelper {
  /** 正規表現の特殊文字をエスケープする */
  escapeRegex(text: string): string {
    const regexChars = new Set(['$', '^', '*', '(', ')', '+', '[', '\\', '|', '.', '/', '?']);
    let result = '';
    for (const char of text) {
      if (regexChars.has(char)) result += '\\';
      result += char;
    }
    return result;
  }
}

export const textHelper = new TextHelper();
