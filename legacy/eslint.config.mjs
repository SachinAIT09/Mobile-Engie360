// ESLint flat config, same rule set as the Hydro One demo: ESLint + typescript-eslint recommended,
// React hooks with the React Compiler rules, and Vite fast-refresh constraints.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'tests/e2e/shots/**']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { parserOptions: { warnOnUnsupportedTypeScriptVersion: false } },
  },
  { files: ['src/**'], languageOptions: { globals: globals.browser } },
  { files: ['tests/**', '*.config.{ts,mjs}', 'scripts/**'], languageOptions: { globals: globals.node } },
  { files: ['**/*.mjs'], extends: [js.configs.recommended], languageOptions: { sourceType: 'module', globals: globals.node } },
  // Playwright fixtures take a destructuring pattern as their first parameter, even when empty.
  { files: ['tests/**'], rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] } },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
]);
