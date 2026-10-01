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
import {
    reviewerChainAdapters,
    type ReviewerChainAdapter,
} from '../chain-adapter'

export const fakeReviewerAdapter = (
    overrides: Partial<ReviewerChainAdapter> = {},
): ReviewerChainAdapter => ({
    chainId: scopeForLegacyNetwork('mainnet').chainId,
    analyze: vi.fn(async () => ({
        totalFees: 0n,
        transactionSummaries: [],
        warnings: [],
        signableAddresses: [],
        riskLevel: 'low' as const,
    })),
    createTransactionListItems: vi.fn(() => []),
    classifyRequestStructure: vi.fn(() => 'single' as const),
    aggregateTransactionWarnings: vi.fn(() => []),
    resolveAllSignerAddresses: vi.fn(() => []),
    getRekeyedUnsignableReason: vi.fn(() => null),
    decodeArbitraryDataForDisplay: vi.fn(() => ({ kind: 'hex', hex: '' })),
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
