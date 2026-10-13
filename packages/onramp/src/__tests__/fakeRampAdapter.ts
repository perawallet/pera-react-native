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
import { rampChainAdapters, type RampChainAdapter } from '../chain-adapter'

export const fakeRampAdapter = (
    overrides: Partial<RampChainAdapter> = {},
): RampChainAdapter => ({
    chainId: scopeForLegacyNetwork('mainnet').chainId,
    destinationTokenIds: ['NATIVE', 'STABLE'],
    isNativeToken: vi.fn(token => token.id === 'NATIVE'),
    toAssetId: vi.fn(token => (token.id === 'NATIVE' ? '0' : token.id)),
    ...overrides,
})

export const registerFakeRampAdapter = (
    overrides: Partial<RampChainAdapter> = {},
): RampChainAdapter => {
    const adapter = fakeRampAdapter(overrides)
    rampChainAdapters.reset()
    rampChainAdapters.register(adapter)
    return adapter
}
