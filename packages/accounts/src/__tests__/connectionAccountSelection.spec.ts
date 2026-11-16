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
import type { WalletAccount } from '../models'
import {
    accountsSigningOnAll,
    firstHeldAccountOf,
    firstPreferredAccountId,
} from '../connectionAccountSelection'

// Signability resolves through chain adapters; here an account signs on a
// chain exactly when it has an address there.
vi.mock('../signer-resolution', () => ({
    signingAddressesOn: (
        account: { chains: Record<string, { address: string }> },
        _accounts: unknown,
        chainIds: readonly string[],
    ) => chainIds.flatMap(chainId => account.chains[chainId]?.address ?? []),
}))

vi.mock('../utils', () => ({
    findAccountByAddressOn: (
        accounts: { chains: Record<string, { address: string }> }[],
        chainId: string,
        address: string,
    ) =>
        accounts.find(
            account =>
                account.chains[chainId]?.address.toLowerCase() ===
                address.toLowerCase(),
        ),
}))

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-chain-contract')
        >()
    return {
        ...actual,
        addressCodecs: {
            has: (chainId: string) => chainId === 'ethereum',
            get: () => ({
                isValid: (address: string) => address.startsWith('0x'),
            }),
        },
    }
})

const account = (id: string, chains: Record<string, string>): WalletAccount =>
    ({
        id,
        chains: Object.fromEntries(
            Object.entries(chains).map(([chainId, address]) => [
                chainId,
                { address },
            ]),
        ),
    }) as unknown as WalletAccount

describe('accountsSigningOnAll', () => {
    const both = account('both', { ethereum: '0xA', base: '0xA' })
    const ethOnly = account('eth-only', { ethereum: '0xB' })
    const algo = account('algo', { algorand: 'ALGO' })

    it('keeps only accounts that sign on every requested chain, in input order', () => {
        const candidates = accountsSigningOnAll(
            [ethOnly, algo, both],
            [ethOnly, algo, both],
            ['ethereum', 'base'],
        )

        expect(candidates.map(({ id }) => id)).toEqual(['both'])
    })

    it('keeps every signer when one chain is requested', () => {
        const candidates = accountsSigningOnAll(
            [both, algo, ethOnly],
            [both, algo, ethOnly],
            ['ethereum'],
        )

        expect(candidates.map(({ id }) => id)).toEqual(['both', 'eth-only'])
    })

    it('is empty when no chain is requested', () => {
        expect(accountsSigningOnAll([both], [both], [])).toEqual([])
    })
})

describe('firstPreferredAccountId', () => {
    const first = account('first', { ethereum: '0x1' })
    const second = account('second', { ethereum: '0x2' })
    const third = account('third', { ethereum: '0x3' })
    const candidates = [first, second, third]

    it('takes the first preferred id that is a candidate', () => {
        expect(firstPreferredAccountId(candidates, ['third', 'second'])).toBe(
            'third',
        )
    })

    it('skips preferred ids that are missing or not candidates', () => {
        expect(
            firstPreferredAccountId(candidates, [null, 'gone', 'second']),
        ).toBe('second')
    })

    it('falls back to the first candidate', () => {
        expect(firstPreferredAccountId(candidates, [undefined])).toBe('first')
    })

    it('is null without candidates', () => {
        expect(firstPreferredAccountId([], ['first'])).toBeNull()
    })
})

describe('firstHeldAccountOf', () => {
    const one = account('one', { ethereum: '0xAa' })
    const two = account('two', { ethereum: '0xBb' })

    it('is the account of the first address of the chain, past addresses of other chains', () => {
        expect(
            firstHeldAccountOf(['ALGO', '0xbb', '0xaa'], [one, two], 'ethereum')
                ?.id,
        ).toBe('two')
    })

    // The dApp keeps using the first address; showing a later one as active
    // would misstate what it sees.
    it('is null once the first address of the chain left the wallet, even when a later one is held', () => {
        expect(
            firstHeldAccountOf(['0xGONE', '0xaa'], [one, two], 'ethereum'),
        ).toBeNull()
    })

    it('is null for a connection holding no address on the chain', () => {
        expect(firstHeldAccountOf(['ALGO'], [one], 'ethereum')).toBeNull()
    })
})
