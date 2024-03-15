module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  env: {
    node: true,
  },
  plugins: ['@typescript-eslint', 'prettier', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // 'import/order': [
    //   'error',
    //   {
    //     // 对导入模块进行分组，分组排序规则如下
    //     groups: [
    //       'builtin', // 内置模块
    //       'external', // 外部模块
    //       'parent', //父节点依赖
    //       'sibling', //兄弟依赖
    //       'internal', //内部引用
    //       'index', // index文件
    //       'type', //类型文件
    //       'unknown',
    //     ],
    //     //通过路径自定义分组
    //     pathGroups: [
    //       {
    //         pattern: '@/**', // 把@开头的应用放在external分组后面
    //         group: 'external',
    //         position: 'after',
    //       },
    //     ],
    //     // 是否开启独特组，用于区分自定义规则分组和其他规则分组
    //     distinctGroup: true,
    //     // 每个分组之间换行
    //     'newlines-between': 'always',
    //     // 相同分组排列规则 按字母升序排序
    //     alphabetize: { order: 'asc', caseInsensitive: true },
    //   },
    // ],
    'sort-imports': [
      'error',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true, // don"t want to sort import lines, use eslint-plugin-import instead
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: true,
      },
    ],
  },
};
