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
import { cardChainAdapters, type CardChainAdapter } from '../chain-adapter'

type FakeCardAdapterOverrides = Partial<
    Omit<CardChainAdapter, 'withdrawal' | 'autoDraw'>
> & {
    withdrawal?: Partial<CardChainAdapter['withdrawal']>
    autoDraw?: Partial<CardChainAdapter['autoDraw']>
}

export const fakeCardAdapter = ({
    withdrawal,
    autoDraw,
    ...overrides
}: FakeCardAdapterOverrides = {}): CardChainAdapter => ({
    chainId: scopeForLegacyNetwork('mainnet').chainId,
    resolveEscrowChainConfig: vi.fn(() => ({
        assetId: '31566704',
        killswitchAppId: '222',
        mainAppId: '111',
    })),
    compileAutoDrawProgram: vi.fn(async () => new Uint8Array([1])),
    delegationApprovalRequest: vi.fn(params => ({
        path: '/v1/delegation/chain/post-approval',
        data: { ...params },
    })),
    delegatorProgramRequest: vi.fn(params => ({
        path: '/v1/delegation/chain/delegator-lsig',
        data: { ...params },
    })),
    getAssetBalance: vi.fn(async () => 0n),
    awaitConfirmation: vi.fn(async () => undefined),
    ...overrides,
    withdrawal: {
        buildRequest: vi.fn(async () => []),
        buildWithdraw: vi.fn(async () => []),
        buildCancel: vi.fn(async () => []),
        getPending: vi.fn(async () => null),
        getWaitTimeSeconds: vi.fn(async () => null),
        ...withdrawal,
    },
    autoDraw: {
        isConfigured: vi.fn(() => true),
        buildEnable: vi.fn(async () => []),
        buildKill: vi.fn(async () => []),
        isEnabled: vi.fn(async () => false),
        ...autoDraw,
    },
})

export const registerFakeCardAdapter = (
    overrides: FakeCardAdapterOverrides = {},
): CardChainAdapter => {
    const adapter = fakeCardAdapter(overrides)
    cardChainAdapters.reset()
    cardChainAdapters.register(adapter)
    return adapter
}
