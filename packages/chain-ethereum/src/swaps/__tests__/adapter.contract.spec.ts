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
import { Decimal } from 'decimal.js'
import type { ExecuteSwapParams } from '@perawallet/wallet-core-swaps'
import { swapContractTests } from '@perawallet/wallet-core-swaps/testing'
import { testChainContext } from '../../__tests__/context'
import { ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { createEvmSwapAdapter } from '../adapter'

const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const ROUTER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const scope = evmScopeOf(ETHEREUM)

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    getOpenSubmissionAttempts: async () => [],
}))

vi.mock('../../blockchain/utils/createEvmClient', () => ({
    createEvmClient: () => ({
        getBalance: async () => 10n ** 18n,
        estimateFeesPerGas: async () => ({
            maxFeePerGas: 1n,
            maxPriorityFeePerGas: 1n,
        }),
    }),
}))

vi.mock('../../transfer/fees', async importOriginal => ({
    ...(await importOriginal<typeof import('../../transfer/fees')>()),
    readEvmFeePresets: async () => ({
        presets: { normal: { maxFeePerGas: 1n, maxPriorityFeePerGas: 1n } },
    }),
}))

const createAdapter = () =>
    createEvmSwapAdapter(testChainContext(), ETHEREUM, {
        routeContractsOf: () => [ROUTER],
    })

swapContractTests(createAdapter, {
    params: {
        quote: {
            quoteId: 'quote-1',
            fetchedAt: Date.now(),
            expiresAt: null,
            request: {
                sourceAsset: {
                    ...scope,
                    assetId: ETHEREUM.nativeAsset.assetId,
                },
                sourceAmount: new Decimal(1),
                sourceAddress: SENDER,
            },
            assetIn: { assetId: ETHEREUM.nativeAsset.assetId },
            assetOut: { assetId: '31566704' },
            fees: [],
        },
        onProgress: vi.fn(),
        isCancelled: () => false,
    } as unknown as ExecuteSwapParams,
    makeContext: () => ({
        scope,
        deviceId: null,
        addSignRequest: vi.fn(),
        createOrder: vi.fn(),
        reportOrder: vi.fn(),
        registerHandoff: vi.fn(),
        onOrderSubmitting: vi.fn(),
        onOrderRejected: vi.fn(),
    }),
})
