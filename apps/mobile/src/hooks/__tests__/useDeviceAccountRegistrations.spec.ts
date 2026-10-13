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

import { act } from '@testing-library/react'
import { renderHook } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNotificationsStore } from '@perawallet/wallet-core-messages'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    registerAlgorandAccountsAdapter,
    registerAlgorandDeviceAdapter,
} from '@test-utils/algorandAccountsAdapter'
import { allCapabilities } from '@test-utils/chain-fixtures'

// The mobile-wide vitest setup mocks `@perawallet/wallet-core-accounts` with a
// fixed empty-store double (RootComponent et al. don't need the real store to
// test their own logic). This hook's whole job is projecting the *real*
// accounts store, so restore the actual implementation here.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return { ...actual }
})

import { useDeviceAccountRegistrations } from '../useDeviceAccountRegistrations'

type SeedAccount = Pick<WalletAccount, 'id' | 'custody'> & {
    address: string
    keyPairId?: string
}

const toWalletAccount = ({
    address,
    keyPairId,
    ...account
}: SeedAccount): WalletAccount => ({
    ...account,
    chains: { algorand: { address, ...(keyPairId ? { keyPairId } : {}) } },
})

const seedAccounts = (accounts: SeedAccount[]) => {
    useAccountsStore.getState().setAccounts(accounts.map(toWalletAccount))
}

const seedDisabledAccounts = (addresses: string[]) => {
    addresses.forEach(address =>
        useNotificationsStore
            .getState()
            .setAccountNotificationEnabled(address, false),
    )
}

describe('useDeviceAccountRegistrations', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        registerAlgorandDeviceAdapter()
        useAccountsStore.getState().resetState()
        useNotificationsStore.getState().resetState()
    })

    it('projects the wallet accounts onto registration entries', () => {
        seedAccounts([
            {
                id: '1',
                address: 'QADDR',
                custody: { kind: 'local', seed: 'quantum' },
                keyPairId: 'kp',
            },
            { id: '2', address: 'WADDR', custody: { kind: 'watch' } },
        ])

        const { result } = renderHook(() => useDeviceAccountRegistrations())

        expect(result.current).toEqual([
            {
                address: 'QADDR',
                accountType: 'quantum',
                rank: 6,
                receiveNotifications: true,
            },
            {
                address: 'WADDR',
                accountType: 'watch',
                rank: 1,
                receiveNotifications: true,
            },
        ])
    })

    it('reflects muted addresses', () => {
        seedAccounts([
            {
                id: '1',
                address: 'ADDR_A',
                custody: { kind: 'local', seed: null },
                keyPairId: 'kp',
            },
        ])
        seedDisabledAccounts(['ADDR_A'])

        const { result } = renderHook(() => useDeviceAccountRegistrations())

        expect(result.current[0].receiveNotifications).toBe(false)
    })

    // Whether a chain's accounts register is the device registry's call: a
    // developer override that turns notifications off must not empty the payload.
    it('registers every Algorand account while the chain has notifications off', () => {
        const { chains } = getProvider()
        chains.reset()
        chains.register(algorandDescriptor, allCapabilities(false))
        expect(chains.capabilities(LEGACY_CHAIN_ID).notifications).toBe(false)
        seedAccounts([
            { id: '1', address: 'WADDR', custody: { kind: 'watch' } },
        ])

        const { result } = renderHook(() => useDeviceAccountRegistrations())

        expect(result.current.map(entry => entry.address)).toEqual(['WADDR'])
    })

    it('recomputes when the accounts or the muted addresses change', () => {
        seedAccounts([
            { id: '1', address: 'ADDR_A', custody: { kind: 'watch' } },
        ])
        const { result } = renderHook(() => useDeviceAccountRegistrations())

        act(() => {
            seedAccounts([
                { id: '1', address: 'ADDR_A', custody: { kind: 'watch' } },
                { id: '2', address: 'ADDR_B', custody: { kind: 'watch' } },
            ])
        })
        act(() => {
            seedDisabledAccounts(['ADDR_B'])
        })

        expect(result.current).toEqual([
            expect.objectContaining({
                address: 'ADDR_A',
                receiveNotifications: true,
            }),
            expect.objectContaining({
                address: 'ADDR_B',
                receiveNotifications: false,
            }),
        ])
    })

    it('returns an empty array when no accounts exist', () => {
        seedAccounts([])

        const { result } = renderHook(() => useDeviceAccountRegistrations())

        expect(result.current).toEqual([])
    })
})
