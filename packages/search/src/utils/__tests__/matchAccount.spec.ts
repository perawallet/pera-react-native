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

import { describe, expect, test } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { matchAccount } from '../matchAccount'

const CHAINS = [
    { id: 'algorand', displayName: 'Algorand' },
    { id: 'ethereum', displayName: 'Ethereum' },
    { id: 'base', displayName: 'Base' },
    { id: 'bsc', displayName: 'BNB Chain' },
    { id: 'arbitrum', displayName: 'Arbitrum One' },
    { id: 'avalanche', displayName: 'Avalanche C-Chain' },
    { id: 'polygon', displayName: 'Polygon' },
] as const

const ETH = CHAINS[1]
const BASE = CHAINS[2]

const makeAccount = (
    chains: WalletAccount['chains'],
    name?: string,
): WalletAccount => ({
    id: 'acc',
    name,
    custody: { kind: 'local', seed: null },
    chains,
})

const TWO_CHAIN = makeAccount(
    {
        algorand: {
            address: 'G5EAWABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDE2WVGE',
        },
        ethereum: { address: '0xC3D7aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5300' },
    },
    'ETH',
)

describe('matchAccount', () => {
    test('an EVM address match picks that chain', () => {
        expect(matchAccount(TWO_CHAIN, '0xc3', CHAINS)).toEqual({
            account: TWO_CHAIN,
            chainId: 'ethereum',
        })
    })

    test('an Algorand address match picks the Algorand chain', () => {
        expect(matchAccount(TWO_CHAIN, 'g5eaw', CHAINS)?.chainId).toBe(
            'algorand',
        )
    })

    test('a network name matches no account', () => {
        expect(matchAccount(makeAccount(TWO_CHAIN.chains), 'eth', CHAINS)).toBe(
            undefined,
        )
        expect(
            matchAccount(makeAccount(TWO_CHAIN.chains), 'ethereum', CHAINS),
        ).toBeUndefined()
    })

    test('a name-only match carries no chain', () => {
        expect(matchAccount(TWO_CHAIN, 'etz', CHAINS)).toBeUndefined()
        const named = makeAccount({ algorand: { address: 'ALGO' } }, 'Savings')

        expect(matchAccount(named, 'sav', CHAINS)).toEqual({
            account: named,
            chainId: undefined,
        })
    })

    test('a filter turns a name match into that chain', () => {
        const named = makeAccount(
            {
                algorand: { address: 'ALGO' },
                ethereum: { address: '0xAAAA' },
            },
            'Savings',
        )

        expect(matchAccount(named, 'sav', CHAINS, 'ethereum')).toEqual({
            account: named,
            chainId: 'ethereum',
        })
    })

    test('a filter leaves out an account that is not on that chain', () => {
        const named = makeAccount({ algorand: { address: 'ALGO' } }, 'Savings')

        expect(matchAccount(named, 'sav', CHAINS, 'ethereum')).toBeUndefined()
    })

    test('a filter ignores a match on another chain', () => {
        expect(matchAccount(TWO_CHAIN, 'g5eaw', CHAINS, 'ethereum')).toBe(
            undefined,
        )
        expect(matchAccount(TWO_CHAIN, 'base', CHAINS, 'ethereum')).toBe(
            undefined,
        )
    })

    test('a filter on a chain the account is on keeps an address match on it', () => {
        const onBase = makeAccount({ base: { address: '0xBA5E' } })

        expect(matchAccount(onBase, '0xba', [ETH, BASE], 'base')?.chainId).toBe(
            'base',
        )
    })
})
