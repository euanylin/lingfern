import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['backup/**', 'private/**', 'dist/**', 'node_modules/**', 'worker-configuration.d.ts', 'output/**', 'test-results/**', '.wrangler/**'] },
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts', 'src/**/*.tsx'], languageOptions: { parserOptions: { project: './tsconfig.json' } }, rules: { '@typescript-eslint/no-floating-promises': 'error' } },
);
