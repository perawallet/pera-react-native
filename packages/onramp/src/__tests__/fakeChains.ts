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
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type FakeChainParams = {
    chainId: ChainId
    caip2: string
    onramp?: boolean
}

/** Registers a chain carrying only what ramp code reads: its id, one network and `onramp`. */
export const registerFakeChain = ({
    chainId,
    caip2,
    onramp = true,
}: FakeChainParams): void => {
    const descriptor = {
        id: chainId,
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
