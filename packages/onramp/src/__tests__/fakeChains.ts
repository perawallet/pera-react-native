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

import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'

/** A placeholder id: the closed `ChainId` union has no neutral member, and ramp code must work for any chain. */
export const FAKE_CHAIN_ID = 'fake' as ChainId

export const FAKE_SCOPE: ChainScope = {
    chainId: FAKE_CHAIN_ID,
    networkId: 'mainnet',
}

export type FakeChainParams = {
    chainId: ChainId
    caip2: string
    onramp?: boolean
    /** The chain's native asset id; `'0'` unless set. */
    nativeAssetId?: string
    /** The chain's id unless set. */
    displayName?: string
}

/** Registers a chain carrying only what ramp code reads: its id, name, one network, its native asset and `onramp`. */
export const registerFakeChain = ({
    chainId,
    caip2,
    onramp = true,
    nativeAssetId = '0',
    displayName = chainId,
}: FakeChainParams): void => {
    const descriptor = {
        id: chainId,
        displayName,
        nativeAsset: { ref: { chainId, assetId: nativeAssetId } },
        networks: [
            {
                id: 'mainnet',
                tier: 'mainnet',
                displayName: chainId,
                isDefaultForTier: true,
                caip2,
                status: 'active',
            },
        ],
    } as unknown as ChainDescriptor
    const capabilities = Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [
            capability,
            capability === 'onramp' ? onramp : false,
        ]),
    ) as ChainCapabilities
    getProvider().chains.register(descriptor, capabilities)
}
