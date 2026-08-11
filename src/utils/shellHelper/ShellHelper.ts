import * as vscode from 'vscode';
import { spawn } from 'child_process';

interface ShellResult {
  command: string;
  args: string[];
  cwd?: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

class ShellHelper {
  /** コマンドを実行して結果を取得する */
  async execute(command: string, args: string[], { cwd }: { cwd?: string } = {}): Promise<ShellResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { cwd });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      proc.stdout.on('data', (data: Buffer) => {
        stdoutChunks.push(data);
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderrChunks.push(data);
      });

      proc.on('close', (exitCode) => {
        resolve({
          command,
          args,
          cwd,
          stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
          stderr: Buffer.concat(stderrChunks).toString('utf-8'),
          exitCode: exitCode ?? -1,
        });
      });

      proc.on('error', reject);
    });
  }

  /* コマンドを実行し、正常終了ならstdoutを返す。異常終了ならnull */
  async executeAndGetStdout(command: string, args: string[], { cwd }: { cwd?: string } = {}): Promise<string | null> {
    const result = await this.execute(command, args, { cwd });
    if (result.exitCode !== 0) {
      vscode.window.showErrorMessage(`[エラー] exitCode=${result.exitCode}\n${result.stderr}`);
      return null;
    }
    return result.stdout;
  }
}

export const shellHelper = new ShellHelper();
