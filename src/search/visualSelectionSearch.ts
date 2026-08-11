import { visualModeHelper } from '@utils/visualModeHelper/VisualModeHelper';
import { EditorHelper } from '@utils/editorHelper/EditorHelper';
import { textHelper } from '@utils/textHelper/TextHelper';
import { searchHistory } from '@utils/SearchHistory';

/** VisualMode専用
 * 現在選択している範囲をスラッシュでハイライトする
 */
export async function visualSelectionSearch(): Promise<void> {
  const lastVisualMode = visualModeHelper.getLastMode();
  const helper = new EditorHelper();

  const visualSelection = visualModeHelper.getVisualSelection();
  if (!visualSelection) return;
  if (visualSelection.startLine !== visualSelection.endLine && lastVisualMode === 'block') return;

  const textEscaped = textHelper.escapeRegex(visualSelection.text);
  await helper.vim.remap(['<Esc>', 'm', 'Z',  '`', '<', '<Bs>', '<C-a>', '|', '/', ...textEscaped, '<Cr>', '`', 'Z']);
  searchHistory.push(visualSelection.text);
}
