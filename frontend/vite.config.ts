/// <reference types="vitest" />
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';

const source_directory = path.resolve(__dirname, 'src');
const test_directory = path.resolve(__dirname, 'tests');
const test_output_directory = path.resolve(test_directory, 'output');

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': source_directory,
      '~': test_directory,
    },
  },
  test: {
    globals: true,
    reporters: ['default', 'junit'],
    outputFile: path.resolve(test_output_directory, 'junit.xml'),
    mockClear: true,
    environment: 'jsdom',
    coverage: {
      all: true,
      src: source_directory,
      reportDir: path.resolve(test_output_directory, 'coverage'),
    },
  },
});
