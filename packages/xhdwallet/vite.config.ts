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

import { defineConfig } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'
import pkg from './package.json' assert { type: 'json' }

const { dependencies = {}, peerDependencies = {} } = pkg as {
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
}

const directDependencies = [
    ...Object.keys(dependencies),
    ...Object.keys(peerDependencies),
]

const nodeExternals = Array.from(
    new Set([...builtinModules, ...builtinModules.map(mod => `node:${mod}`)]),
)

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            formats: ['es', 'cjs'],
            name: '@perawallet/wallet-core-xhdwallet',
            fileName: format => `index.${format}.js`,
        },
        rollupOptions: {
            external: [...directDependencies, ...nodeExternals],
        },
        emptyOutDir: false,
        sourcemap: true,
        target: 'esnext',
    },
})
