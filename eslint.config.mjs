import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import * as pluginImportX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import { configs } from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['src/components/ui/**/*']),
  eslint.configs.recommended,
  configs.recommended,
  prettierConfig,
  pluginImportX.flatConfigs.recommended,
  pluginImportX.flatConfigs.typescript,
  reactHooks.configs.flat.recommended,
  {
    ignores: ['eslint.config.mjs', 'src/components/ui/**/*'],
    rules: {
      'no-unused-vars': 'off',
      'import/no-named-as-default-member': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import/default': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
);
