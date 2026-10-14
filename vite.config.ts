/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Lets dist/index.html work when opened straight from disk (file://), as the wiki promises.
 * Browsers refuse to load `<script type="module">` (and `crossorigin` assets) from file:// URLs,
 * so the build emits a single classic IIFE script loaded with `defer` instead.
 */
function openFromDisk(): Plugin {
  return {
    name: 'open-from-disk',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(/<script type="module" crossorigin/g, '<script defer')
          .replace(/ crossorigin(?=[ >])/g, ''),
    },
  };
}

export default defineConfig({
  // Relative base so the build works on GitHub Pages (/ProjectForecaster/) and when opened from disk.
  base: './',
  plugins: [react(), openFromDisk()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    modulePreload: false,
    rolldownOptions: {
      output: { format: 'iife' },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    css: false,
    server: {
      deps: {
        inline: [/@cloudscape-design/],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
