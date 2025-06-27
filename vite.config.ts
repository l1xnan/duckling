/// <reference types="vitest/config" />
import path from 'path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// import react from '@vitejs/plugin-react-oxc';
import jotaiDebugLabel from 'jotai/babel/plugin-debug-label';
import jotaiReactRefresh from 'jotai/babel/plugin-react-refresh';
import { viteStaticCopy } from 'vite-plugin-static-copy';

import { defineConfig } from 'vite';
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      babel: {
        presets: ['jotai/babel/preset'],
        plugins: [jotaiDebugLabel, jotaiReactRefresh],
      },
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/web-tree-sitter/tree-sitter.wasm',
          dest: '',
        },
      ],
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
    target:
      process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari15',
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        // 动态覆盖 WASM 文件规则
        assetFileNames: (assetInfo) => {
          const isWasm = assetInfo.names?.[0]?.endsWith('.wasm');
          return isWasm
            ? 'assets/[name].[ext]' // WASM 无哈希
            : 'assets/[name]-[hash].[ext]'; // 其他文件带哈希
        },
        manualChunks: {
          // 将 web-tree-sitter 单独打包为一个 chunk
          'web-tree-sitter': ['web-tree-sitter'],
        },
        // advancedChunks: {
        //   groups: [
        //     { name: 'web-tree-sitter', test: /node_modules\/web-tree-sitter/ },
        //   ],
        // },
      },
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
