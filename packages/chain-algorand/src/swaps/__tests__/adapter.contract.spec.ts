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
import type { ExecuteSwapParams } from '@perawallet/wallet-core-swaps'
import { swapContractTests } from '@perawallet/wallet-core-swaps/testing'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandSwapAdapter } from '../adapter'

// The adapter resolves these from remote config, which this suite doesn't set up.
vi.mock('../quantumSwapGate', () => ({
    isAlgorandQuantumSwapEnabled: () => false,
}))
// No ledger storage here: no earlier attempt is open.
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    getOpenSubmissionAttempts: async () => [],
}))
vi.mock('../../blockchain', async importOriginal => ({
    ...(await importOriginal<typeof import('../../blockchain')>()),
    getMinimumFeeConfig: () => ({ assetMbr: 100_000n }),
}))

swapContractTests(() => algorandSwapAdapter, {
    params: {
        quote: {
            quoteId: 'quote-1',
            fetchedAt: Date.now(),
            expiresAt: null,
            request: { sourceAddress: 'SENDER' },
            assetIn: { assetId: '0' },
            assetOut: { assetId: '31566704' },
            fees: [],
        },
        onProgress: vi.fn(),
        isCancelled: () => false,
    } as unknown as ExecuteSwapParams,
    makeContext: () => ({
        scope: { chainId: ALGORAND_CHAIN_ID, networkId: 'testnet' } as const,
        deviceId: null,
        addSignRequest: vi.fn(),
        createOrder: vi.fn(),
        reportOrder: vi.fn(),
        registerHandoff: vi.fn(),
        onOrderSubmitting: vi.fn(),
    }),
})
