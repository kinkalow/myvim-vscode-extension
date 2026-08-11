import * as vscode from 'vscode';
import * as path from 'path';
import { SNIPPETS_DIR } from '@utils/config/path';

export function getSnippetPath(): string | null {
  const snippetDir = SNIPPETS_DIR;

  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;

  const snippetMap: Record<string, string> = {
    bash: 'bash.json',
    c: 'c.json',
    cpp: 'cpp.json',
    csharp: 'csharp.json',
    css: 'css.json',
    'django-html': 'html.json',
    go: 'go.json',
    html: 'html.json',
    java: 'java.json',
    javascript: 'javascript.json',
    javascriptreact: 'javascriptreact.json',
    json: 'jsonc.json',
    jsonc: 'jsonc.json',
    julia: 'julia.json',
    less: 'less.json',
    markdown: 'markdown.json',
    php: 'php.json',
    python: 'python.json',
    r: 'r.json',
    rust: 'rust.json',
    scss: 'scss.json',
    shellscript: 'shellscript.json',
    sql: 'sql.json',
    typescript: 'typescript.json',
    typescriptreact: 'typescriptreact.json',
    vim: 'vim.json',
    vue: 'vue.json',
    xml: 'xml.json',
    yaml: 'yaml.json',
  };

  const languageId = editor.document.languageId;
  const snippetName = snippetMap[languageId];
  if (!snippetName) {
    vscode.window.showErrorMessage(`languageId（${languageId}）とスニペットファイルの対応表を定義する必要がある`);
    return null;
  }

  const snippetPath = path.join(snippetDir, snippetName);

  return snippetPath;
}
