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

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { useKnownAddresses } from '../useKnownAddresses'

type FakeAccount = {
    name?: string
    isWatch?: boolean
    chains: Record<string, { address: string }>
}

const mocks = vi.hoisted(() => ({
    accounts: [] as FakeAccount[],
    contacts: [] as { name: string; addresses: Record<string, string> }[],
    counterparties: [] as { address: string; hasBeenPaid: boolean }[],
    counterpartiesQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAllAccounts: () => mocks.accounts,
    chainAccountOf: (account: FakeAccount, chainId: string) =>
        account.chains[chainId],
    canSignWith: (account: FakeAccount) => !account.isWatch,
}))

vi.mock('@perawallet/wallet-core-contacts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-contacts')
    >()),
    useContactsStore: (
        select: (state: { contacts: typeof mocks.contacts }) => unknown,
    ) => select({ contacts: mocks.contacts }),
}))

vi.mock('@perawallet/wallet-core-transactions', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-transactions')
    >()),
    useTrustedCounterpartiesQuery: (params: unknown) => {
        mocks.counterpartiesQuery(params)
        return {
            data: mocks.counterparties,
            isPending: false,
            hasSenderHistory: true,
        }
    },
}))

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

describe('useKnownAddresses', () => {
    beforeAll(() => {
        registerEthereumChain()
    })

    beforeEach(() => {
        mocks.counterpartiesQuery.mockClear()
        mocks.accounts = [
            { name: 'Main', chains: { ethereum: { address: '0xOWN' } } },
            {
                name: 'Exchange',
                isWatch: true,
                chains: { ethereum: { address: '0xWATCHED' } },
            },
            { name: 'Algo only', chains: { algorand: { address: 'ALGO' } } },
        ]
        mocks.contacts = [
            { name: 'Alice', addresses: { evm: '0xALICE' } },
            { name: 'Bob', addresses: { algorand: 'BOB' } },
        ]
        mocks.counterparties = [
            { address: '0xPAYEE', hasBeenPaid: true },
            { address: '0xPAYER', hasBeenPaid: false },
        ]
    })

    it("lists the chain's wallet, contact and history addresses by source", () => {
        const { result } = renderHook(() =>
            useKnownAddresses({
                scope: ETHEREUM,
                senderAddress: '0xOWN',
                isEnabled: true,
            }),
        )

        expect(result.current.knownAddresses).toEqual([
            { address: '0xOWN', source: 'own-account', name: 'Main' },
            {
                address: '0xWATCHED',
                source: 'watched-account',
                name: 'Exchange',
            },
            { address: '0xALICE', source: 'contact', name: 'Alice' },
            { address: '0xPAYEE', source: 'history', isInboundOnly: false },
            { address: '0xPAYER', source: 'history', isInboundOnly: true },
        ])
    })

    it('reads the history of the accounts it can sign for only', () => {
        renderHook(() =>
            useKnownAddresses({
                scope: ETHEREUM,
                senderAddress: '0xOWN',
                isEnabled: false,
            }),
        )

        expect(mocks.counterpartiesQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddresses: ['0xOWN'],
                isEnabled: false,
            }),
        )
    })
})
