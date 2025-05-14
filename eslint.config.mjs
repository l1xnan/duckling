import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import * as pluginImportX from 'eslint-plugin-import-x';
import { globalIgnores } from 'eslint/config';
import tseslint, { configs } from 'typescript-eslint';

export default tseslint.config(
  globalIgnores(['src/components/ui/**/*']),
  eslint.configs.recommended,
  configs.recommended,
  prettierConfig,
  pluginImportX.flatConfigs.recommended,
  pluginImportX.flatConfigs.typescript,
  {
    ignores: ['eslint.config.mjs', 'src/components/ui/**/*'],
    rules: {
      'no-unused-vars': 'off',
      'import/no-named-as-default-member': 'off',
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
