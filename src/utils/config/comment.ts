export interface CommentStyle {
  line?: string;
  block?: [string, string];
}

export const COMMENT_STYLE_MAP: Record<string, CommentStyle> = {
  // --- スラッシュ系 (//, /* */) ---
  javascript: { line: '//', block: ['/*', '*/'] },
  typescript: { line: '//', block: ['/*', '*/'] },
  typescriptreact: { line: '//', block: ['/*', '*/'] },
  javascriptreact: { line: '//', block: ['/*', '*/'] },
  java: { line: '//', block: ['/*', '*/'] },
  c: { line: '//', block: ['/*', '*/'] },
  cpp: { line: '//', block: ['/*', '*/'] },
  csharp: { line: '//', block: ['/*', '*/'] },
  go: { line: '//', block: ['/*', '*/'] },
  rust: { line: '//', block: ['/*', '*/'] },
  swift: { line: '//', block: ['/*', '*/'] },
  kotlin: { line: '//', block: ['/*', '*/'] },
  dart: { line: '//', block: ['/*', '*/'] },
  scala: { line: '//', block: ['/*', '*/'] },
  php: { line: '//', block: ['/*', '*/'] },
  groovy: { line: '//', block: ['/*', '*/'] },
  'objective-c': { line: '//', block: ['/*', '*/'] },
  'objective-cpp': { line: '//', block: ['/*', '*/'] },
  jsonc: { line: '//', block: ['/*', '*/'] },
  proto: { line: '//', block: ['/*', '*/'] },
  zig: { line: '//' },
  less: { line: '//', block: ['/*', '*/'] },
  scss: { line: '//', block: ['/*', '*/'] },
  stylus: { line: '//', block: ['/*', '*/'] },
  shaderlab: { line: '//', block: ['/*', '*/'] },

  // --- ハッシュ系 (#) ---
  python: { line: '#' },
  shellscript: { line: '#' },
  ruby: { line: '#' },
  yaml: { line: '#' },
  toml: { line: '#' },
  perl: { line: '#' },
  r: { line: '#' },
  elixir: { line: '#' },
  graphql: { line: '#' },
  makefile: { line: '#' },
  dockerfile: { line: '#' },
  gitconfig: { line: '#' },
  properties: { line: '#' },
  tcl: { line: '#' },
  cmake: { line: '#' },
  julia: { line: '#', block: ['#=', '=#'] },
  nim: { line: '#', block: ['#[', ']#'] },
  coffeescript: { line: '#', block: ['###', '###'] },

  // --- ダッシュ系 (--) ---
  lua: { line: '--', block: ['--[[', ']]'] },
  sql: { line: '--' },
  haskell: { line: '--', block: ['{-', '-}'] },
  ada: { line: '--' },

  // --- HTML/XML系 (<!-- -->) ---
  html: { block: ['<!--', '-->'] },
  xml: { block: ['<!--', '-->'] },
  svg: { block: ['<!--', '-->'] },
  markdown: { block: ['<!--', '-->'] },
  vue: { block: ['<!--', '-->'] },
  svelte: { block: ['<!--', '-->'] },
  astro: { block: ['<!--', '-->'] },

  // --- セミコロン系 (;) ---
  clojure: { line: ';' },
  lisp: { line: ';' },
  scheme: { line: ';' },
  ini: { line: ';' },

  // --- 特殊系 ---
  css: { block: ['/*', '*/'] },
  powershell: { line: '#', block: ['<#', '#>'] },
  bat: { line: 'REM ' },
  fortran: { line: '!' },
  vim: { line: '"' },
  erlang: { line: '%' },
  latex: { line: '%' },
  tex: { line: '%' },
  matlab: { line: '%', block: ['%{', '%}'] },
  fsharp: { line: '//', block: ['(*', '*)'] },
  ocaml: { block: ['(*', '*)'] },
  pascal: { line: '//', block: ['{', '}'] },
  vb: { line: "'" },
  handlebars: { block: ['{{!--', '--}}'] },
  razor: { block: ['@*', '*@'] },
};
