import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['.venv/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser,
    },
  },
];
