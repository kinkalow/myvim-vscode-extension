// editor.edit後にVS Codeや拡張機能がselectionを変更する場合がある
// この処理を終了させてから次の処理を行いたいため、イベントの発生を監視し、
// 発生するたびに待機時間をリセットしてquietMsの間変化がなければ終了する
export const SELECTION_SETTLE_DELAY_MS = 50;