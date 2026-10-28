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
import {
    type TransactionNative,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import {
    reviewerChainAdapters,
    type ReviewerChainAdapter,
} from '../chain-adapter'

export const fakeReviewerAdapter = (
    overrides: Partial<ReviewerChainAdapter> = {},
): ReviewerChainAdapter => ({
    chainId: LEGACY_CHAIN_ID,
    decoder: {
        decode: vi.fn(async () => ({
            totalFees: 0n,
            signableAddresses: [],
        })),
    },
    warnings: { detect: vi.fn(() => []) },
    policy: { autoApproveLocal: vi.fn(() => true) },
    createTransactionListItems: vi.fn(() => []),
    classifyRequestStructure: vi.fn(() => 'single' as const),
    aggregateTransactionWarnings: vi.fn(() => []),
    resolveAllSignerAddresses: vi.fn(() => []),
    getDelegatedUnsignableReason: vi.fn(() => null),
    decodeArbitraryDataForDisplay: vi.fn(() => ({ kind: 'hex', hex: '' })),
    reviewedAddresses: vi.fn(() => []),
    toTransactionNative: vi.fn(tx => tx as unknown as TransactionNative),
    ...overrides,
})

export const registerFakeReviewerAdapter = (
    overrides: Partial<ReviewerChainAdapter> = {},
): ReviewerChainAdapter => {
    const adapter = fakeReviewerAdapter(overrides)
    reviewerChainAdapters.reset()
    reviewerChainAdapters.register(adapter)
    return adapter
}
