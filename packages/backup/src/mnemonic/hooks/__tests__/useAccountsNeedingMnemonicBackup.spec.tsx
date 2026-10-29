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

// @vitest-environment jsdom
import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return { ...original, registerStore: vi.fn() }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: async () => null,
            setItem: async () => {},
            removeItem: async () => {},
        },
    }),
}))

const fundedByAddress: Record<string, string[]> = {}
const authorities = new Set<string>()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        accountFundedNetworksQueryOptions: (address: string | undefined) => ({
            queryKey: ['funded', address ?? ''],
            enabled: !!address,
            queryFn: async () => fundedByAddress[address as string] ?? [],
        }),
        useDelegationAuthorities: () => authorities,
    }
})

const mockCanBackUpMnemonic = vi.fn()
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-chain-shared')
        >()
    return {
        ...original,
        useChainCapability: (...args: unknown[]) =>
            mockCanBackUpMnemonic(...args),
    }
})

import { registerFakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import { useMnemonicBackupStore } from '../../store'
import { useAccountsNeedingMnemonicBackup } from '../useAccountsNeedingMnemonicBackup'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const local = (address: string): WalletAccount => ({
    id: address,
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address, keyPairId: `kp-${address}` } },
})

const render = (accounts: WalletAccount[]) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return renderHook(() => useAccountsNeedingMnemonicBackup(accounts, SCOPE), {
        wrapper,
    })
}

describe('useAccountsNeedingMnemonicBackup', () => {
    beforeEach(() => {
        registerFakeBackupAdapter()
        useMnemonicBackupStore.getState().resetState()
        for (const key of Object.keys(fundedByAddress)) {
            delete fundedByAddress[key]
        }
        authorities.clear()
        mockCanBackUpMnemonic.mockReset()
        mockCanBackUpMnemonic.mockReturnValue(true)
    })

    test('lists funded or delegated-to accounts not yet backed up, in order', async () => {
        fundedByAddress.A = ['mainnet']
        fundedByAddress.C = ['testnet']
        authorities.add('D')
        const accounts = [local('A'), local('B'), local('C'), local('D')]
        act(() => useMnemonicBackupStore.getState().markBackedUp('kp-C'))

        const { result } = render(accounts)

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.accounts.map(a => a.id)).toEqual(['A', 'D'])
    })

    test('is pending until funding is known', () => {
        const { result } = render([local('A')])

        expect(result.current.isPending).toBe(true)
        expect(result.current.accounts).toEqual([])
    })

    test('lists nothing when the chain has mnemonic backup off', async () => {
        fundedByAddress.A = ['mainnet']
        mockCanBackUpMnemonic.mockReturnValue(false)

        const { result } = render([local('A')])

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.accounts).toEqual([])
    })
})
