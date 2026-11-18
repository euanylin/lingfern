import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['backup/**', 'private/**', 'dist/**', 'node_modules/**', 'worker-configuration.d.ts', 'output/**', 'test-results/**', '.wrangler/**', 'public/tree-parser/udpipe-v1.js', 'public/tree-parser/charniak-v1.js', 'public/tree-parser/ort-wasm-1.31.1.js', 'public/tree-parser/tokenizers-0.2.0.js'] },
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts', 'src/**/*.tsx'], languageOptions: { parserOptions: { project: './tsconfig.json' } }, rules: { '@typescript-eslint/no-floating-promises': 'error' } },
);
