import * as vscode from 'vscode';

import { CURSOR_HIGHLIGHT_STYLE, SEARCH_HIGHLIGHT_STYLE } from '@utils/config/highlight';

const HIGHLIGHT_STYLES = {
  cursor: CURSOR_HIGHLIGHT_STYLE,
  search: SEARCH_HIGHLIGHT_STYLE,
} as const;

export type HighlightStyleName = keyof typeof HIGHLIGHT_STYLES;

export class ConfigHelper {
  constructor(private readonly editor: vscode.TextEditor) {}

  getHighlightStyle(styleName: HighlightStyleName): vscode.DecorationRenderOptions {
    return HIGHLIGHT_STYLES[styleName];
  }
}
