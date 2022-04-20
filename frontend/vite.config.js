/* eslint-env node */
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const path = require('path');

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './tests'),
    },
  },
  test: {
    globals: true,
    reporters: ['default', 'junit'],
    mockClear: true,
  },
});
