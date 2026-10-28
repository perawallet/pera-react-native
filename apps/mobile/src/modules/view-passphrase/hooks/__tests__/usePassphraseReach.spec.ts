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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { usePassphraseReach } from '../usePassphraseReach'

type Option = { chainId: string; isEnabled: boolean; address?: string }

const mocks = vi.hoisted(() => ({
    accounts: [] as unknown[],
    seedChains: [] as string[],
    switchedOff: [] as string[],
    optionsByAccount: new Map<string, Option[]>(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountsStore: (select: (state: { accounts: unknown[] }) => unknown) =>
        select({ accounts: mocks.accounts }),
    findAccountByAddressOn: (
        accounts: WalletAccount[],
        _chainId: string,
        address: string,
    ) => accounts.find(account => account.chains.algorand?.address === address),
    hdDiscoveryChains: () => mocks.seedChains,
    accountChainOptions: (
        account: WalletAccount,
        isOn: (chainId: string) => boolean,
    ) =>
        (mocks.optionsByAccount.get(account.id) ?? []).filter(option =>
            isOn(option.chainId),
        ),
}))

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-contract')
    >()),
    addressCodecs: {
        get: (chainId: string) => ({
            truncate: (address: string) => `${chainId}:${address}`,
        }),
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ algorand: 'Algorand', ethereum: 'Ethereum', base: 'Base' })[
            chainId
        ],
    useSwitchedOffChainIds: () => mocks.switchedOff,
}))

const hdAccount = (
    id: string,
    keyIndex: number,
    chains: WalletAccount['chains'],
): WalletAccount => ({
    id,
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex } },
    chains,
})

const ROOT = hdAccount('root', 0, {
    algorand: { address: 'ALGO-ROOT' },
    ethereum: { address: '0xroot' },
})

describe('usePassphraseReach', () => {
    beforeEach(() => {
        mocks.accounts = [ROOT]
        mocks.seedChains = ['algorand', 'ethereum', 'base']
        mocks.switchedOff = []
        mocks.optionsByAccount = new Map([
            [
                'root',
                [
                    {
                        chainId: 'algorand',
                        isEnabled: true,
                        address: 'ALGO-ROOT',
                    },
                    {
                        chainId: 'ethereum',
                        isEnabled: true,
                        address: '0xroot',
                    },
                    { chainId: 'base', isEnabled: false, address: '0xroot' },
                ],
            ],
        ])
    })

    it('reports every seed network and one truncated address per enabled chain for an HD account on two chains', () => {
        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-ROOT' }),
        )

        expect(result.current).toEqual({
            isMultiNetwork: true,
            networkNames: ['Algorand', 'Ethereum', 'Base'],
            linkedAddresses: [
                {
                    chainId: 'algorand',
                    displayName: 'Algorand',
                    address: 'algorand:ALGO-ROOT',
                },
                {
                    chainId: 'ethereum',
                    displayName: 'Ethereum',
                    address: 'ethereum:0xroot',
                },
            ],
        })
    })

    it('is multi-network for an HD account enabled on Algorand alone, listing only that address', () => {
        const solo = hdAccount('solo', 0, { algorand: { address: 'ALGO-SOLO' } })
        mocks.accounts = [solo]
        mocks.optionsByAccount.set('solo', [
            { chainId: 'algorand', isEnabled: true, address: 'ALGO-SOLO' },
            { chainId: 'ethereum', isEnabled: false },
        ])

        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-SOLO' }),
        )

        expect(result.current.isMultiNetwork).toBe(true)
        expect(result.current.linkedAddresses).toEqual([
            {
                chainId: 'algorand',
                displayName: 'Algorand',
                address: 'algorand:ALGO-SOLO',
            },
        ])
    })

    it('lists a sibling at keyIndex 1 by its own addresses, not the root wallet account', () => {
        const sibling = hdAccount('sibling', 1, {
            algorand: { address: 'ALGO-SIB' },
            ethereum: { address: '0xsib' },
        })
        mocks.accounts = [ROOT, sibling]
        mocks.optionsByAccount.set('sibling', [
            { chainId: 'algorand', isEnabled: true, address: 'ALGO-SIB' },
            { chainId: 'ethereum', isEnabled: true, address: '0xsib' },
        ])

        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-SIB' }),
        )

        expect(result.current.linkedAddresses.map(row => row.address)).toEqual(
            ['algorand:ALGO-SIB', 'ethereum:0xsib'],
        )
    })

    it('leaves out a chain that is switched off', () => {
        mocks.switchedOff = ['ethereum']

        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-ROOT' }),
        )

        expect(
            result.current.linkedAddresses.map(row => row.chainId),
        ).toEqual(['algorand'])
    })

    it('is single-network when the seed reaches one chain only', () => {
        mocks.seedChains = ['algorand']

        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-ROOT' }),
        )

        expect(result.current).toEqual({
            isMultiNetwork: false,
            networkNames: [],
            linkedAddresses: [],
        })
    })

    it('is single-network for an Algo25 account', () => {
        mocks.accounts = [
            {
                id: 'algo25',
                custody: { kind: 'local', seed: null },
                chains: { algorand: { address: 'ALGO-25' } },
            },
        ]

        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-25' }),
        )

        expect(result.current.isMultiNetwork).toBe(false)
    })

    it('is single-network for a quantum account', () => {
        mocks.accounts = [
            {
                id: 'quantum',
                custody: { kind: 'local', seed: 'quantum' },
                chains: { algorand: { address: 'ALGO-PQ' } },
            },
        ]

        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-PQ' }),
        )

        expect(result.current.isMultiNetwork).toBe(false)
    })

    it('returns safe defaults for an address no account holds', () => {
        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'UNKNOWN' }),
        )

        expect(result.current).toEqual({
            isMultiNetwork: false,
            networkNames: [],
            linkedAddresses: [],
        })
    })
})
