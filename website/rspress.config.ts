import { defineConfig } from '@rspress/core';
import * as path from 'node:path';

// GitHub Pages serves project sites under /<repo>/; keep dev/preview at root.
const base = process.env.GITHUB_ACTIONS === 'true' ? '/duckling/' : '/';

export default defineConfig({
  base,
  root: path.join(__dirname, 'docs'),
  title: 'Duckling',
  description:
    'Lightweight desktop app for browsing parquet/csv/json files and databases, with a built-in SQL editor and analysis tools.',
  lang: 'en',
  icon: '/logo.svg',
  logo: {
    light: `${base}duckling-light.png`,
    dark: `${base}duckling-dark.png`,
  },
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'Duckling',
      description:
        'Lightweight desktop app for browsing parquet/csv/json files and databases, with a built-in SQL editor and analysis tools.',
    },
    {
      lang: 'zh',
      label: '简体中文',
      title: 'Duckling',
      description:
        '轻量级桌面应用，用于快速浏览 parquet/csv/json 文件与数据库数据，内置 SQL 编辑器与分析工具。',
    },
  ],
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/l1xnan/Duckling',
      },
    ],
  },
});
