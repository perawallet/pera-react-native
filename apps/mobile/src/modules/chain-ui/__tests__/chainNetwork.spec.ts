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

import { describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { chainNetworkOf } from '../chainNetwork'

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ ethereum: 'Ethereum' })[chainId],
    getChainDescriptor: () => ({
        networks: [{ id: 'sepolia', displayName: 'Sepolia' }],
    }),
}))

describe('chainNetworkOf', () => {
    it('names a known chain and network', () => {
        expect(
            chainNetworkOf({
                chainId: 'ethereum',
                networkId: 'sepolia',
            } as ChainScope),
        ).toEqual({ chain: 'Ethereum', network: 'Sepolia' })
    })

    it('falls back to the raw network id when the chain does not list it', () => {
        expect(
            chainNetworkOf({
                chainId: 'ethereum',
                networkId: 'devnet',
            } as ChainScope),
        ).toEqual({ chain: 'Ethereum', network: 'devnet' })
    })
})
