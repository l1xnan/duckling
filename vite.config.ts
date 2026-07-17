/// <reference types="vitest/config" />
import path from 'path';

import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

import { defineConfig } from 'vite';
// https://vitejs.dev/config/
export default defineConfig({
  experimental: {
    bundledDev: true,
  },
  plugins: [
    tailwindcss(),
    react(),
    lingui(),
    babel({
      presets: [linguiTransformerBabelPreset()],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
    },
  },
  test: {
    // Vitest configuration options
    globals: true, // Use global APIs like describe, it, expect
    environment: 'node', // Important for tree-sitter which needs Node APIs
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 5173,
    strictPort: true,
  },
  // 3. to make use of `TAURI_DEBUG` and other env variables
  // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari15',
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'oxc' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,

    rolldownOptions: {
      external: (id) => {
        if (id.startsWith('@shikijs/langs')) {
          return !id.includes('json') && !id.includes('sql');
        }
        return false;
      },
    },
  },
  worker: {
    format: 'es',
  },
});
