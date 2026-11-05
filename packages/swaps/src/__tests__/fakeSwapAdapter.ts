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
    broadcasterChainAdapters,
    type BroadcasterChainAdapter,
} from '@perawallet/wallet-core-signing'
import { Decimal } from 'decimal.js'
import { swapChainAdapters, type SwapChainAdapter } from '../chain-adapter'
import { fakeCaip2Of, fakeRouterAssetId } from './fakeRouterChains'

export const FAKE_NATIVE_ASSET_ID = 'native'
export const FAKE_RECEIVE_ASSET_ID = 'receive'

export const fakeSwapAdapter = (
    overrides: Partial<SwapChainAdapter> = {},
): SwapChainAdapter => ({
    chainId: 'algorand',
    nativeAssetId: FAKE_NATIVE_ASSET_ID,
    defaultReceiveAssetId: FAKE_RECEIVE_ASSET_ID,
    swapExplorerUrl: vi.fn(),
    executeSwap: vi.fn(),
    supportsCosignedSwaps: true,
    toRouterAssetId: (assetId, scope) => fakeRouterAssetId(scope, assetId),
    fromRouterAssetId: (routerAssetId, scope) => {
        const prefix = `${fakeCaip2Of(scope)}/token:`
        return routerAssetId.startsWith(prefix)
            ? routerAssetId.slice(prefix.length)
            : null
    },
    maxAmountFeeReserve: new Decimal(1000),
    holdingReserve: () => new Decimal(0),
    estimateSourceCost: async () => null,
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

/** Adds a second swap chain next to the default one, for cross-chain rows. */
export const registerSecondFakeSwapAdapter = (): SwapChainAdapter => {
    const adapter = fakeSwapAdapter({ chainId: 'ethereum' })
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
        chainId: 'algorand',
        submit,
    } as BroadcasterChainAdapter)
    return submit
}
