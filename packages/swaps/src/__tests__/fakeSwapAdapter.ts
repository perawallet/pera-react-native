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
    broadcasterChainAdapters,
    type BroadcasterChainAdapter,
} from '@perawallet/wallet-core-signing'
import { swapChainAdapters, type SwapChainAdapter } from '../chain-adapter'

export const FAKE_NATIVE_ASSET_ID = 'native'
export const FAKE_RECEIVE_ASSET_ID = 'receive'

export const fakeSwapAdapter = (
    overrides: Partial<SwapChainAdapter> = {},
): SwapChainAdapter => ({
    chainId: scopeForLegacyNetwork('mainnet').chainId,
    nativeAssetId: FAKE_NATIVE_ASSET_ID,
    defaultReceiveAssetId: FAKE_RECEIVE_ASSET_ID,
    swapExplorerUrl: vi.fn(),
    executeSwap: vi.fn(),
    supportsCosignedSwaps: true,
    ...overrides,
})

export const registerFakeSwapAdapter = (
    overrides: Partial<SwapChainAdapter> = {},
): SwapChainAdapter => {
    const adapter = fakeSwapAdapter(overrides)
    swapChainAdapters.reset()
    swapChainAdapters.register(adapter)
    return adapter
}

// Registered on the real registry: the setup file loads the signing package
// before any spec's `vi.mock` of it could apply.
export const registerFakeBroadcaster = (
    submit: BroadcasterChainAdapter['submit'] = vi.fn(),
): BroadcasterChainAdapter['submit'] => {
    broadcasterChainAdapters.reset()
    broadcasterChainAdapters.register({
        chainId: scopeForLegacyNetwork('mainnet').chainId,
        submit,
    } as BroadcasterChainAdapter)
    return submit
}
