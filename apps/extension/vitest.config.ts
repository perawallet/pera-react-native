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
import react from '@vitejs/plugin-react'
import path from 'path'

// The extension owns the web-only platform shims (web-shims/) and their specs.
// Those specs render through react-native-web exactly as the shipped web bundle
// does, so `react-native` aliases to react-native-web here too. Scope the run
// to web-shims/ and src/content/ so vitest never tries to execute the Playwright
// e2e/ specs (they share the .spec suffix but are driven by @playwright/test,
// not vitest).
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: [
            {
                find: 'react-native',
                replacement: path.resolve(
                    __dirname,
                    './node_modules/react-native-web',
                ),
            },
        ],
    },
    optimizeDeps: {
        esbuildOptions: {
            loader: {
                '.js': 'jsx',
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        include: [
            'web-shims/**/*.spec.{js,jsx,ts,tsx}',
            'src/content/**/*.test.{ts,tsx}',
            'src/background/**/*.test.{ts,tsx}',
        ],
    },
})
