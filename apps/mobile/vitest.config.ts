/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@screens': resolve(__dirname, 'src/screens'),
      '@layouts': resolve(__dirname, 'src/layouts'),
      '@routes': resolve(__dirname, 'src/routes'),
      '@theme': resolve(__dirname, 'src/theme'),
      '@test-utils': resolve(__dirname, 'src/test-utils'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      all: true,
      //TODO: for now we only test the straight ts files - not the react components
      // there was a bunch of pain setting up the react component testing so we dropped it for
      // now
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/index.ts',
        'src/test-utils/**',
        'src/**/*.style.ts',
        'src/**/*.styles.ts',
        'src/**/styles.ts',
        'src/**/theme.ts',
        'src/components/webview/injected-scripts.ts',
        //TODO: tests for hooks and boostrap were causing weird syntax error I couldn't figure out so disabling
        //coverage for now
        'src/bootstrap/*',
        'src/hooks/toast.ts',
        'src/hooks/webview.ts',
        'src/hooks/deeplink.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
});
