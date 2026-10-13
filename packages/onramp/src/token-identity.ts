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

import type { ChainId, ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { rampChainAdapters } from './chain-adapter'
import type { RampPair, RampTokenIdentity } from './models'

export type RampTokenAsset = {
    chainId: ChainId
    /** In the chain's own asset-id encoding. */
    assetId: string
    isNative: boolean
}

// A CAIP-19 id is `<caip2>/<asset namespace>:<reference>`, and a CAIP-2 id
// never contains '/'.
const caip2Of = (caip19: string): string => caip19.split('/')[0]

/**
 * The wallet chain a ramp token lives on: null for fiat, for a chain the
 * wallet doesn't run, and for one it runs without registering.
 */
export const rampTokenChainId = (
    token: RampTokenIdentity,
): Nullable<ChainId> => {
    if (token.caip19 !== undefined) {
        return getProvider().chains.byCaip2(caip2Of(token.caip19))?.chainId ?? null
    }
    return (
        rampChainAdapters
            .list()
            .find(adapter => adapter.rampNetworkIds.includes(token.network.id))
            ?.chainId ?? null
    )
}

/**
 * The asset a ramp token arrives as on `scope`. Null when the token lives on
 * another chain, its chain has no ramp adapter, or it has no asset on that
 * network.
 */
export const rampTokenAsset = (
    token: RampTokenIdentity,
    scope: ChainScope,
): Nullable<RampTokenAsset> => {
    if (rampTokenChainId(token) !== scope.chainId) return null
    if (!rampChainAdapters.has(scope.chainId)) return null
    const adapter = rampChainAdapters.get(scope.chainId)
    const assetId = adapter.toAssetId(token, scope)
    if (assetId === null) return null
    return {
        chainId: scope.chainId,
        assetId,
        isNative: adapter.isNativeToken(token),
    }
}

/**
 * Whether Fund offers the pair. A source on a chain the wallet runs is left
 * out: the user swaps from that chain in Swap instead.
 */
export const isOfferedRampPair = (pair: RampPair): boolean => {
    const chainId = rampTokenChainId(pair.sourceToken)
    if (chainId === null) return true
    const { chains } = getProvider()
    return !chains.has(chainId) || chains.isSwitchedOff(chainId)
}
