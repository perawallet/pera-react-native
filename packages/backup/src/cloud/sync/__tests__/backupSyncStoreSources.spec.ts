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

// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

type Listener<S> = (state: S) => void

const mocks = vi.hoisted(() => ({
    accountListeners: [] as Listener<{ accounts: unknown[] }>[],
    contactListeners: [] as Listener<{ contacts?: unknown[] }>[],
    unsubscribe: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: { getState: () => ({ network: 'testnet' }) },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => ({ accounts: [{ address: 'ADDR1' }] }),
        subscribe: (listener: Listener<{ accounts: unknown[] }>) => {
            mocks.accountListeners.push(listener)
            return mocks.unsubscribe
        },
    },
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContactsStore: {
        getState: () => ({ contacts: undefined }),
        subscribe: (listener: Listener<{ contacts?: unknown[] }>) => {
            mocks.contactListeners.push(listener)
            return mocks.unsubscribe
        },
    },
}))

import { createBackupSyncStoreSources } from '../backupSyncStoreSources'

describe('createBackupSyncStoreSources', () => {
    it('reads the network and accounts, and an unset contact list as empty', () => {
        const sources = createBackupSyncStoreSources()

        expect(sources.getNetwork()).toBe('testnet')
        expect(sources.listAccounts()).toEqual([{ address: 'ADDR1' }])
        expect(sources.listContacts()).toEqual([])
    })

    it('hands subscribers the changed list and returns the store unsubscribe', () => {
        const sources = createBackupSyncStoreSources()
        const onAccounts = vi.fn()
        const onContacts = vi.fn()

        const unsubscribe = sources.subscribeAccounts(onAccounts)
        sources.subscribeContacts(onContacts)
        mocks.accountListeners[0]?.({ accounts: [{ address: 'ADDR2' }] })
        mocks.contactListeners[0]?.({})

        expect(onAccounts).toHaveBeenCalledWith([{ address: 'ADDR2' }])
        expect(onContacts).toHaveBeenCalledWith([])
        expect(unsubscribe).toBe(mocks.unsubscribe)
    })
})
