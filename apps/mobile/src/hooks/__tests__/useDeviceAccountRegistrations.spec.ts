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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNotificationsStore } from '@perawallet/wallet-core-messages'

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

type SeedAccount = Pick<WalletAccount, 'id' | 'address' | 'type'> &
    Partial<WalletAccount>

const seedAccounts = (accounts: SeedAccount[]) => {
    useAccountsStore.getState().setAccounts(accounts as WalletAccount[])
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
        useAccountsStore.getState().resetState()
        useNotificationsStore.getState().resetState()
    })

    it('projects the wallet accounts onto registration entries', () => {
        seedAccounts([
            {
                id: '1',
                address: 'QADDR',
                type: AccountTypes.quantum,
                keyPairId: 'kp',
            },
            { id: '2', address: 'WADDR', type: AccountTypes.watch },
        ])

        const { result } = renderHook(() => useDeviceAccountRegistrations())

        expect(result.current).toEqual([
            {
                address: 'QADDR',
                accountType: 'quantum',
                receiveNotifications: true,
            },
            {
                address: 'WADDR',
                accountType: 'watch',
                receiveNotifications: true,
            },
        ])
    })

    it('reflects muted addresses', () => {
        seedAccounts([
            {
                id: '1',
                address: 'ADDR_A',
                type: AccountTypes.algo25,
                keyPairId: 'kp',
            },
        ])
        seedDisabledAccounts(['ADDR_A'])

        const { result } = renderHook(() => useDeviceAccountRegistrations())

        expect(result.current[0].receiveNotifications).toBe(false)
    })

    it('returns an empty array when no accounts exist', () => {
        seedAccounts([])

        const { result } = renderHook(() => useDeviceAccountRegistrations())

        expect(result.current).toEqual([])
    })
})
