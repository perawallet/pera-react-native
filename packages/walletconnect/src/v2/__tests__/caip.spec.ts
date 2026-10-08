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
import type { WalletConnectSupport } from '../../shared/chainSupport'
import { parseCaip10Account, parseCaip10AccountIn } from '../caip'

const MAINNET_CHAIN_ID = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'

describe('parseCaip10Account', () => {
    const ADDRESS = 'A'.repeat(58)

    it('splits an account into its chain id and bare address', () => {
        expect(parseCaip10Account(`${MAINNET_CHAIN_ID}:${ADDRESS}`)).toEqual({
            chainId: MAINNET_CHAIN_ID,
            address: ADDRESS,
        })
    })

    it('refuses a bare chain id', () => {
        expect(parseCaip10Account(MAINNET_CHAIN_ID)).toBeNull()
    })

    it('refuses a bare address', () => {
        expect(parseCaip10Account(ADDRESS)).toBeNull()
    })

    it('refuses an account with an empty segment', () => {
        expect(parseCaip10Account(`algorand::${ADDRESS}`)).toBeNull()
        expect(parseCaip10Account(`${MAINNET_CHAIN_ID}:`)).toBeNull()
    })

    it('refuses a fourth segment rather than guessing which part is the address', () => {
        expect(
            parseCaip10Account(`${MAINNET_CHAIN_ID}:${ADDRESS}:extra`),
        ).toBeNull()
    })
})

describe('parseCaip10AccountIn', () => {
    const ADDRESS = 'A'.repeat(58)

    // A minimal support double: only `networkForCaip2ChainId` is read.
    const support = (knownChainId: string): WalletConnectSupport => ({
        namespace: 'algorand',
        caip2ChainIdFor: () => null,
        networkForCaip2ChainId: caip2 =>
            caip2 === knownChainId ? 'mainnet' : null,
        toWireResult: () => null,
        emptySignaturesFor: () => ({}),
    })

    it('accepts an account on a chain id the support recognises', () => {
        expect(
            parseCaip10AccountIn(
                support(MAINNET_CHAIN_ID),
                `${MAINNET_CHAIN_ID}:${ADDRESS}`,
            ),
        ).toEqual({ chainId: MAINNET_CHAIN_ID, address: ADDRESS })
    })

    it('refuses a foreign namespace, which a namespace key does not constrain', () => {
        // `namespaces.<key>.accounts` can list an `eip155:1:0x…` under a key
        // this chain owns, and that address must not land in the approved list.
        expect(
            parseCaip10AccountIn(support(MAINNET_CHAIN_ID), 'eip155:1:0xabc'),
        ).toBeNull()
    })

    it('refuses a chain id the support has no network for', () => {
        expect(
            parseCaip10AccountIn(
                support(MAINNET_CHAIN_ID),
                `algorand:${'z'.repeat(32)}:${ADDRESS}`,
            ),
        ).toBeNull()
    })
})
