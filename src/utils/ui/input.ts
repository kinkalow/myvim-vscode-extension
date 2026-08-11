import * as vscode from 'vscode';
import { EditorHelper } from '@utils/editorHelper/EditorHelper';

let charResolver: ((char: string) => void) | null = null;

/**
 * 1文字の入力を受け取り、その文字を返す
 */
export async function getOneChar(): Promise<string> {
  await vscode.commands.executeCommand('setContext', 'myvim-utils-ui-input.getOneChar.active', true);
  let char = await new Promise<string>((resolve) => {
    charResolver = resolve;
  });
  await vscode.commands.executeCommand('setContext', 'myvim-utils-ui-input.getOneChar.active', false);
  return char;
}

export function registerGetOneChar(context: vscode.ExtensionContext) {
  let typeCharCommand = vscode.commands.registerCommand('myvim-utils-ui-input.getOneChar.waiting', (char: string) => {
    if (charResolver) charResolver(char); // 待機中の getOneCharに文字を渡す
  });
  context.subscriptions.push(typeCharCommand);
}

/**
 * 1文字の入力を受け取り、その文字を返す
 */
export function getOnePrintableChar(): Promise<string> {
  return new Promise((resolve) => {
    const box = vscode.window.createInputBox();
    let resolved = false;
    const finish = (value: string) => {
      if (resolved) return;
      resolved = true;
      box.dispose();
      resolve(value);
    };
    box.onDidChangeValue((value) => {
      if (value.length > 0) {
        finish(value[0]);
      }
    });
    box.onDidAccept(() => {
      finish('enter');
    });
    box.onDidHide(() => {
      finish('');
    });
    box.show();
  });
}
// export function getOnePrintableChar(): Promise<string> {
//   return new Promise((resolve) => {
//     const box = vscode.window.createInputBox();
//     box.onDidChangeValue((value) => {
//       if (value.length > 0) {
//         box.hide();
//         resolve(value[0]);
//       }
//     });
//     box.onDidHide(() => {
//       box.dispose();
//       resolve('');
//     });
//     box.show();
//   });
// }

/**
 * 入力文字列がkeysに含まれていたらその文字列を返す。含まれない場合空文字列を返す
 * @param keys 受け付けるキーのリスト
 * @returns
 *   - key 数値を除く入力文字列または空文字列
 *   - number 入力数値。入力ない場合1を返す
 */
export async function chooseKeyFromInput(keys: readonly string[]): Promise<{ key: string; number: number }> {
  let bufferKey = '';
  let bufferNumber = '';
  while (true) {
    const char = await getOneChar();
    // Escでキャンセル
    if (char === '') {
      bufferKey = '';
      bufferNumber = '';
      break;
    }
    if (/^\d$/.test(char)) {
      bufferNumber += char;
      continue;
    }
    bufferKey += char;
    //　候補がみつかった
    if (keys.includes(bufferKey)) break;
    //　候補が存在するか
    const hasCandidates = keys.some((key) => key.startsWith(bufferKey));
    if (!hasCandidates) {
      bufferKey = '';
      bufferNumber = '';
      break;
    }
  }
  const number = bufferNumber === '' ? 1 : parseInt(bufferNumber, 10);
  return { key: bufferKey, number };
}


export async function chooseKeyFromQuickPick(keys: readonly string[]): Promise<{ key: string; number: number }> {
  const helper = new EditorHelper(); // NOTE: ここでEditorHelperを呼び出すほどではない
  const cursorPos = helper.cursor.get();
  const cursorDecoration = helper.decoration.highlight(cursorPos.line, cursorPos.col, cursorPos.line, cursorPos.col, {
    style: helper.config.getHighlightStyle('cursor'),
  });

  const quickPick = vscode.window.createQuickPick();
  quickPick.items = [];
  return new Promise((resolve) => {
    let result: { key: string; number: number } | null = null;

    quickPick.onDidChangeValue((value) => {
      if (!value) return;
      const cleanValue = value.replace(/\d/g, '');
      if (cleanValue === '') return;
      const numberStr = value.replace(/\D/g, '');
      const count = numberStr ? parseInt(numberStr, 10) : 1;
      const matchedKeys = keys.filter((key) => key.startsWith(cleanValue));

      if (matchedKeys.length === 0) {
        result = { key: '', number: 1 };
        quickPick.hide();
      }

      if (matchedKeys.length === 1) {
        result = { key: matchedKeys[0], number: count };
        quickPick.hide();
      }
    });

    quickPick.onDidHide(async () => {
      helper.decoration.clear(cursorDecoration);
      const output = result ?? { key: '', number: 1 };
      resolve(output);
      quickPick.dispose();
    });

    quickPick.show();
  });
}