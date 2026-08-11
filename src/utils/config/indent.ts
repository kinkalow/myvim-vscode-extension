// ファイルタイプ別デフォルトインデント幅
export const DEFAULT_INDENT_MAP: Record<string, number> = {
  // --- 2スペース系 ---
  javascript: 2,
  typescript: 2,
  javascriptreact: 2,
  typescriptreact: 2,
  json: 2,
  jsonc: 2,
  html: 2,
  xml: 2,
  svg: 2,
  css: 2,
  scss: 2,
  sass: 2,
  less: 2,
  vue: 2,
  svelte: 2,
  yaml: 2,
  ruby: 2,
  erb: 2,
  elixir: 2,
  ocaml: 2,
  markdown: 2,
  toml: 2,
  graphql: 2,

  // --- 4スペース系 ---
  python: 4,
  java: 4,
  kotlin: 4,
  csharp: 4,
  c: 4,
  cpp: 4,
  rust: 4,
  php: 4,
  swift: 4,
  r: 4,
  lua: 4,

  // --- タブ / 4スペース系（タブ幅を4として扱う） ---
  shellscript: 4,
  makefile: 4,
  go: 4,
};

export const INDENT_SENSITIVE_LANGUAGES: string[] = [
  'python',
  'yaml',
  'nim',
  'coffeescript',
  'pug',
  'jade',
  'haml',
  'slim',
  'sass',
];