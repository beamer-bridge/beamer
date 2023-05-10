/// <reference types="vitest" />
import vue from '@vitejs/plugin-vue';
import { execSync } from 'child_process';
import path from 'path';
import { defineConfig } from 'vite';

export const source_directory = path.resolve(__dirname, 'src');
export const test_directory = path.resolve(__dirname, 'tests');
export const test_output_directory = path.resolve(test_directory, 'output');
export const config_directory = path.resolve(__dirname, 'config');

// Release Info
const semanticVersion = process.env.npm_package_version;
const version = execSync('git describe --tags', { encoding: 'utf-8' }).trim();
const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
const REPOSITORY = 'https://github.com/beamer-bridge/beamer';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': source_directory,
      '~': test_directory,
      config: config_directory,
    },
  },
  define: {
    APP_RELEASE: {
      SEMANTIC_VERSION: semanticVersion,
      VERSION: version,
      COMMIT_HASH: commitHash,
      REPOSITORY,
    },
    'process.env': process.env,
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
    },
  },
});
