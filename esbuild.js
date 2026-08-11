const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['src/extension.ts'],
    bundle: true, // 全ファイルを out/extension.js 1ファイルにまとめる
    outfile: 'out/extension.js',
    external: ['vscode', 'typescript'],
    format: 'cjs',
    platform: 'node',
    alias: {
      '@utils': './src/utils',
    },
    // breakpointに必要
    sourcemap: true,
    sourcesContent: true,
  })
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    if (err.errors && err.errors.length > 0) {
      for (const e of err.errors) {
        const file = e.location?.file ?? 'unknown';
        const line = e.location?.line ?? -999;
        const col = e.location?.column ?? -999;
        console.error(`${file}(${line},${col}): error TS0000: ${e.text}`); // この出力をtask.jsonで設定したproblemMatcherが受け取る
      }
    } else {
      console.error(err);
    }
    process.exit(1);
  });
