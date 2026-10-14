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

import { describe, expect, it } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { groupAddressesByScope } from '../service/scope-groups'

const selectScope = (chainId: ChainId) => ({
    chainId,
    networkId: chainId === 'algorand' ? 'testnet' : 'sepolia',
})

describe('groupAddressesByScope', () => {
    it('keeps Algorand-only entries in one group, in account order', () => {
        const groups = groupAddressesByScope(
            [
                { chainId: 'algorand', address: 'ADDR1' },
                { chainId: 'algorand', address: 'ADDR2' },
            ],
            selectScope,
        )

        expect(groups).toEqual([
            {
                scope: { chainId: 'algorand', networkId: 'testnet' },
                addresses: ['ADDR1', 'ADDR2'],
            },
        ])
    })

    it('puts an account with entries on two chains in each chain scope once', () => {
        const groups = groupAddressesByScope(
            [
                { chainId: 'algorand', address: 'ADDR1' },
                { chainId: 'ethereum', address: '0xabc' },
                { chainId: 'algorand', address: 'ADDR2' },
            ],
            selectScope,
        )

        expect(groups).toEqual([
            {
                scope: { chainId: 'algorand', networkId: 'testnet' },
                addresses: ['ADDR1', 'ADDR2'],
            },
            {
                scope: { chainId: 'ethereum', networkId: 'sepolia' },
                addresses: ['0xabc'],
            },
        ])
    })

    it('keeps an address held twice on one scope once', () => {
        const groups = groupAddressesByScope(
            [
                { chainId: 'algorand', address: 'ADDR1' },
                { chainId: 'algorand', address: 'ADDR1' },
            ],
            selectScope,
        )

        expect(groups).toEqual([
            {
                scope: { chainId: 'algorand', networkId: 'testnet' },
                addresses: ['ADDR1'],
            },
        ])
    })

    it('returns no group when there are no entries', () => {
        expect(groupAddressesByScope([], selectScope)).toEqual([])
    })
})
