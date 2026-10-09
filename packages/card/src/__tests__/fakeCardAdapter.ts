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
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    cardChainAdapters,
    type CardAutoDrawOperations,
    type CardChainAdapter,
} from '../chain-adapter'

type FakeCardAdapterOverrides = Partial<
    Omit<CardChainAdapter, 'withdrawal' | 'useAutoDraw'>
> & {
    withdrawal?: Partial<CardChainAdapter['withdrawal']>
    autoDraw?: Partial<CardAutoDrawOperations>
}

export const fakeCardAdapter = ({
    withdrawal,
    autoDraw,
    ...overrides
}: FakeCardAdapterOverrides = {}): CardChainAdapter => {
    // One object for the adapter's lifetime, so hooks see stable operations.
    const autoDrawOperations: CardAutoDrawOperations = {
        enableAutoDraw: vi.fn(async () => undefined),
        disableAutoDraw: vi.fn(async () => undefined),
        ...autoDraw,
    }
    return {
        chainId: LEGACY_CHAIN_ID,
        settlementAsset: vi.fn(() => '31566704'),
        delegationApprovalRequest: vi.fn(params => ({
            path: '/v1/delegation/chain/post-approval',
            data: { ...params },
        })),
        getAssetBalance: vi.fn(async () => 0n),
        awaitConfirmation: vi.fn(async () => undefined),
        buildManualDeposit: vi.fn(async () => []),
        fundingSourceEligibility: vi.fn(() => ({
            canFund: true,
            canProveOwnership: true,
            canAutoDraw: true,
        })),
        describeError: vi.fn(() => null),
        transactionUrl: vi.fn(() => null),
        useAutoDraw: () => autoDrawOperations,
        ...overrides,
        withdrawal: {
            buildRequest: vi.fn(async () => []),
            buildWithdraw: vi.fn(async () => []),
            buildCancel: vi.fn(async () => []),
            getPending: vi.fn(async () => null),
            getWaitTimeSeconds: vi.fn(async () => null),
            ...withdrawal,
        },
    }
}

export const registerFakeCardAdapter = (
    overrides: FakeCardAdapterOverrides = {},
): CardChainAdapter => {
    const adapter = fakeCardAdapter(overrides)
    cardChainAdapters.reset()
    cardChainAdapters.register(adapter)
    return adapter
}
