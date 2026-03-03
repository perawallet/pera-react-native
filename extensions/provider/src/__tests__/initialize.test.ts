/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initializeDataStores, clearDataStores } from '../initialize'
import {
    initAccountsStore,
    clearAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    initBlockchainStore,
    clearBlockchainStore,
} from '@perawallet/wallet-core-blockchain'
import {
    initContactsStore,
    clearContactsStore,
} from '@perawallet/wallet-core-contacts'
import {
    initSigningStore,
    clearSigningStore,
} from '@perawallet/wallet-core-signing'
import {
    initCurrenciesStore,
    clearCurrenciesStore,
} from '@perawallet/wallet-core-currencies'
import {
    initKeyManagerStore,
    clearKeyManagerStore,
} from '@perawallet/wallet-core-kms'
import {
    initNotificationsStore,
    clearNotificationsStore,
} from '@perawallet/wallet-core-messages'
import {
    initPollingStore,
    clearPollingStore,
} from '@perawallet/wallet-core-polling'
import {
    initSecurityStore,
    clearSecurityStore,
} from '@perawallet/wallet-core-security'
import {
    initSettingsStore,
    clearSettingsStore,
} from '@perawallet/wallet-core-settings'
import { initSwapsStore, clearSwapsStore } from '@perawallet/wallet-core-swaps'
import {
    initWalletConnectStore,
    clearWalletConnectStore,
} from '@perawallet/wallet-core-walletconnect'

// Mock all dependencies
vi.mock('@perawallet/wallet-core-accounts', () => ({
    initAccountsStore: vi.fn(),
    clearAccountsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    initBlockchainStore: vi.fn(),
    clearBlockchainStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-contacts', () => ({
    initContactsStore: vi.fn(),
    clearContactsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    initSigningStore: vi.fn(),
    clearSigningStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-currencies', () => ({
    initCurrenciesStore: vi.fn(),
    clearCurrenciesStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-kms', () => ({
    initKeyManagerStore: vi.fn(),
    clearKeyManagerStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-messages', () => ({
    initNotificationsStore: vi.fn(),
    clearNotificationsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-polling', () => ({
    initPollingStore: vi.fn(),
    clearPollingStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-security', () => ({
    initSecurityStore: vi.fn(),
    clearSecurityStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-settings', () => ({
    initSettingsStore: vi.fn(),
    clearSettingsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-swaps', () => ({
    initSwapsStore: vi.fn(),
    clearSwapsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    initWalletConnectStore: vi.fn(),
    clearWalletConnectStore: vi.fn(),
}))

describe('initializeDataStores', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls all store initialization functions', () => {
        initializeDataStores()

        expect(initAccountsStore).toHaveBeenCalled()
        expect(initBlockchainStore).toHaveBeenCalled()
        expect(initContactsStore).toHaveBeenCalled()
        expect(initCurrenciesStore).toHaveBeenCalled()
        expect(initKeyManagerStore).toHaveBeenCalled()
        expect(initNotificationsStore).toHaveBeenCalled()
        expect(initPollingStore).toHaveBeenCalled()
        expect(initSecurityStore).toHaveBeenCalled()
        expect(initSettingsStore).toHaveBeenCalled()
        expect(initSigningStore).toHaveBeenCalled()
        expect(initSwapsStore).toHaveBeenCalled()
        expect(initWalletConnectStore).toHaveBeenCalled()
    })
})

describe('clearDataStores', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls all store clear functions', () => {
        clearDataStores()

        expect(clearAccountsStore).toHaveBeenCalled()
        expect(clearBlockchainStore).toHaveBeenCalled()
        expect(clearContactsStore).toHaveBeenCalled()
        expect(clearCurrenciesStore).toHaveBeenCalled()
        expect(clearKeyManagerStore).toHaveBeenCalled()
        expect(clearNotificationsStore).toHaveBeenCalled()
        expect(clearPollingStore).toHaveBeenCalled()
        expect(clearSecurityStore).toHaveBeenCalled()
        expect(clearSettingsStore).toHaveBeenCalled()
        expect(clearSigningStore).toHaveBeenCalled()
        expect(clearSwapsStore).toHaveBeenCalled()
        expect(clearWalletConnectStore).toHaveBeenCalled()
    })
})
