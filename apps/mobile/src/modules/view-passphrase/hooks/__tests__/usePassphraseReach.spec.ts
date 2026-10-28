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
    registry: [] as { id: string; family: string }[],
    switchedOff: [] as string[],
    optionsByAccount: new Map<string, Option[]>(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountsStore: (select: (state: { accounts: unknown[] }) => unknown) =>
        select({ accounts: mocks.accounts }),
    findAccountByAnyChainAddress: (
        accounts: WalletAccount[],
        address: string,
    ) =>
        accounts.find(account =>
            Object.values(account.chains).some(
                entry => entry?.address === address,
            ),
        ),
    accountChainOptions: (
        account: WalletAccount,
        isOn: (chainId: string) => boolean,
    ) =>
        (mocks.optionsByAccount.get(account.id) ?? []).filter(option =>
            isOn(option.chainId),
        ),
}))

const descriptorOf = (id: string) => {
    const entry = mocks.registry.find(chain => chain.id === id)!
    return {
        id,
        family: entry.family,
        signing: {
            schemes: ['scheme'],
            derivationPaths: { scheme: () => 'm/0' },
            rawKeySchemes: [],
        },
    }
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            list: () => mocks.registry.map(({ id }) => descriptorOf(id)),
            has: (id: string) => mocks.registry.some(chain => chain.id === id),
            get: (id: string) => ({ descriptor: descriptorOf(id) }),
            isSwitchedOff: (id: string) => mocks.switchedOff.includes(id),
        },
    }),
}))

vi.mock('@modules/chain-ui', () => ({
    chainUiFor: (family: string) => ({
        passphraseCompatibilityKey:
            family === 'unknown' ? undefined : `compatibility.${family}`,
    }),
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
        ({ algorand: 'Algorand', ethereum: 'Ethereum', base: 'Base' })[chainId],
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
        mocks.registry = [
            { id: 'algorand', family: 'algorand' },
            { id: 'ethereum', family: 'evm' },
            { id: 'base', family: 'evm' },
        ]
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
            compatibilityKeys: ['compatibility.algorand', 'compatibility.evm'],
        })
    })

    it('is multi-network for an HD account enabled on Algorand alone, listing only that address', () => {
        const solo = hdAccount('solo', 0, {
            algorand: { address: 'ALGO-SOLO' },
        })
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

        expect(result.current.linkedAddresses.map(row => row.address)).toEqual([
            'algorand:ALGO-SIB',
            'ethereum:0xsib',
        ])
    })

    it('still names and lists a chain whose kill switch is on, since the words still control its funds', () => {
        mocks.registry = [
            { id: 'algorand', family: 'algorand' },
            { id: 'ethereum', family: 'evm' },
        ]
        mocks.switchedOff = ['ethereum']

        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-ROOT' }),
        )

        expect(result.current.isMultiNetwork).toBe(true)
        expect(result.current.networkNames).toEqual(['Algorand', 'Ethereum'])
        expect(result.current.linkedAddresses.map(row => row.chainId)).toEqual([
            'algorand',
            'ethereum',
        ])
    })

    it('gives one explainer paragraph per reached family that has one', () => {
        mocks.registry = [
            { id: 'algorand', family: 'algorand' },
            { id: 'other', family: 'unknown' },
        ]

        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-ROOT' }),
        )

        expect(result.current.compatibilityKeys).toEqual([
            'compatibility.algorand',
        ])
    })

    it('is single-network when the seed reaches one chain only', () => {
        mocks.registry = [{ id: 'algorand', family: 'algorand' }]
        mocks.optionsByAccount.set('root', [
            { chainId: 'algorand', isEnabled: true, address: 'ALGO-ROOT' },
        ])
        mocks.accounts = [
            hdAccount('root', 0, { algorand: { address: 'ALGO-ROOT' } }),
        ]

        const { result } = renderHook(() =>
            usePassphraseReach({ address: 'ALGO-ROOT' }),
        )

        expect(result.current).toEqual({
            isMultiNetwork: false,
            networkNames: [],
            linkedAddresses: [],
            compatibilityKeys: [],
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
            compatibilityKeys: [],
        })
    })
})
