import { osHelper } from '@utils/osHelper/OsHelper';
// Vimカウントは、短時間に同じ関数が呼び出された回数をカウントとして扱う
// この値は、最後の関数呼び出しから新しい呼び出しがないことを待つ時間（ms）
// 指定した時間が経過すると、目的の関数を実行する
export let VIM_COUNT_DEBOUNCE_DELAY_MS = 30;
if(osHelper.isWSL()) VIM_COUNT_DEBOUNCE_DELAY_MS = 70;