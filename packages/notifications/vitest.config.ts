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

import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            // These tests reference hooks from a different package
            '**/usePreferences.test.ts',
            '**/useSettings.test.ts',
        ],
        coverage: {
            provider: 'v8',
            exclude: [
                '**/node_modules/**',
                '**/dist/**',
                '**/__tests__/**',
                '**/models/**', // Type definitions and interfaces
                '**/index.ts', // Re-export files
                '**/endpoints.ts', // Raw API functions (tested via hooks)
                '**/*.config.ts', // Configuration files (vite, vitest)
                '**/eslint.config.js', // ESLint config
            ],
        },
    },
    resolve: {
        conditions: ['default'],
        alias: {
            '@test-utils': path.resolve(
                __dirname,
                '../platform-integration/src/test-utils',
            ),
        },
    },
})
