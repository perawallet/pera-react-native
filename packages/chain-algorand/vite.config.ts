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
            'blockchain/index': resolve(__dirname, 'src/blockchain/index.ts'),
            'signing/index': resolve(__dirname, 'src/signing/index.ts'),
            'accounts/index': resolve(__dirname, 'src/accounts/index.ts'),
            'assets/index': resolve(__dirname, 'src/assets/index.ts'),
            'transactions/index': resolve(
                __dirname,
                'src/transactions/index.ts',
            ),
            'swaps/index': resolve(__dirname, 'src/swaps/index.ts'),
            'asa-inbox/index': resolve(__dirname, 'src/asa-inbox/index.ts'),
            'nfd/index': resolve(__dirname, 'src/nfd/index.ts'),
            'fee-delegation/index': resolve(
                __dirname,
                'src/fee-delegation/index.ts',
            ),
            'multisig/index': resolve(__dirname, 'src/multisig/index.ts'),
            'card/index': resolve(__dirname, 'src/card/index.ts'),
            'onramp/index': resolve(__dirname, 'src/onramp/index.ts'),
            'ledger/index': resolve(__dirname, 'src/ledger/index.ts'),
            'backup/index': resolve(__dirname, 'src/backup/index.ts'),
            'connect/index': resolve(__dirname, 'src/connect/index.ts'),
        },
    }),
)
