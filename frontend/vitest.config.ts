import path from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig, { source_directory, test_output_directory } from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      reporters: ['default', 'junit'],
      outputFile: path.resolve(test_output_directory, 'junit.xml'),
      mockReset: true,
      environment: 'jsdom',
      coverage: {
        all: true,
        src: [source_directory],
        include: [
          'src/actions/**',
          'src/components/**',
          'src/composables/**',
          'src/directives/**',
          'src/router/**',
          'src/services/**',
          'src/stores/**',
          'src/utils/**',
          'src/valdiation/**',
          'src/views/**',
          'src/types/uint-256.ts',
          'src/types/token-amount.ts',
          '!**/types.ts',
        ],
      },
    },
  }),
);
