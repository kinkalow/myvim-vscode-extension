import { clearRepeatState, executeNormalRepeat } from '@utils/repeat';

export async function executeOriginalRepeat() {
  clearRepeatState();
  executeNormalRepeat();
}