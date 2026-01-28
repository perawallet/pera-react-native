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
import { registerDataStores } from '../initialize'
import { registerAccountsStore } from '@perawallet/wallet-core-accounts'
import { registerAssetsStore } from '@perawallet/wallet-core-assets'
import { registerBlockchainStore } from '@perawallet/wallet-core-blockchain'
import { registerContactsStore } from '@perawallet/wallet-core-contacts'
import { registerCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { registerKeyManagerStore } from '@perawallet/wallet-core-kms'
import {
    registerDeviceStore,
    registerRemoteConfigStore,
} from '@perawallet/wallet-core-platform-integration'
import { registerPollingStore } from '@perawallet/wallet-core-polling'
import { registerSecurityStore } from '@perawallet/wallet-core-security'
import { registerSettingsStore } from '@perawallet/wallet-core-settings'
import { registerSwapsStore } from '@perawallet/wallet-core-swaps'
import { registerWalletConnectStore } from '@perawallet/wallet-core-walletconnect'

// Mock all dependencies
vi.mock('@perawallet/wallet-core-accounts', () => ({
    registerAccountsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-assets', () => ({
    registerAssetsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    registerBlockchainStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-contacts', () => ({
    registerContactsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-currencies', () => ({
    registerCurrenciesStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-kms', () => ({
    registerKeyManagerStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    registerDeviceStore: vi.fn(),
    registerRemoteConfigStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-polling', () => ({
    registerPollingStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-security', () => ({
    registerSecurityStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-settings', () => ({
    registerSettingsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-swaps', () => ({
    registerSwapsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    registerWalletConnectStore: vi.fn(),
}))

describe('registerDataStores', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls all store registration functions', () => {
        registerDataStores()

        expect(registerAccountsStore).toHaveBeenCalled()
        expect(registerAssetsStore).toHaveBeenCalled()
        expect(registerBlockchainStore).toHaveBeenCalled()
        expect(registerContactsStore).toHaveBeenCalled()
        expect(registerCurrenciesStore).toHaveBeenCalled()
        expect(registerKeyManagerStore).toHaveBeenCalled()
        expect(registerDeviceStore).toHaveBeenCalled()
        expect(registerRemoteConfigStore).toHaveBeenCalled()
        expect(registerPollingStore).toHaveBeenCalled()
        expect(registerSecurityStore).toHaveBeenCalled()
        expect(registerSettingsStore).toHaveBeenCalled()
        expect(registerSwapsStore).toHaveBeenCalled()
        expect(registerWalletConnectStore).toHaveBeenCalled()
    })
})
