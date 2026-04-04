import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    dedupe: ['vscode'],
    alias: {
      vscode: path.resolve(
        __dirname,
        '../../packages/web-editor-component/node_modules/@codingame/monaco-vscode-extension-api',
      ),
    },
  },
});
