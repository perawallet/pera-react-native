/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { resolve } from 'path'
import { defineLibraryConfig } from '@perawallet/wallet-core-devtools/vite/library'

export default defineConfig(
    defineLibraryConfig({
        root: __dirname,
        entry: {
            index: resolve(__dirname, 'src/index.ts'),
            // Own entry so content scripts (every https page) get the
            // dependency-free codec and never the handler graph.
            wire: resolve(__dirname, 'src/wire.ts'),
            // Same reason for the service worker: the gate reaches only
            // the two cap subpaths, so an MV3 bundle stays free of the
            // signing and blockchain barrels.
            bounds: resolve(__dirname, 'src/bounds.ts'),
        },
    }),
)
