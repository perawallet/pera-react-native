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

import { vi } from 'vitest'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import type { ExecuteSwapParams } from '@perawallet/wallet-core-swaps'
import { swapContractTests } from '@perawallet/wallet-core-swaps/testing'
import { algorandSwapAdapter } from '../adapter'

swapContractTests(() => algorandSwapAdapter, {
    params: {
        quote: {
            quoteIdStr: 'quote-1',
            fetchedAt: Date.now(),
            assetIn: { assetId: '0' },
            assetOut: { assetId: '31566704' },
        },
        isCancelled: () => false,
    } as unknown as ExecuteSwapParams,
    makeContext: () => ({
        scope: scopeForLegacyNetwork('testnet'),
        assetOptInMinBalance: 100_000n,
        deviceId: null,
        addSignRequest: vi.fn(),
        prepareTransactions: vi.fn(),
        updateSwapStatus: vi.fn(),
        registerHandoff: vi.fn(),
    }),
})
