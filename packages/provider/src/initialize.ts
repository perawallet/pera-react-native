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
} from '@perawallet/wallet-core-notifications'
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
import {
    initSigningStore,
    clearSigningStore,
} from '@perawallet/wallet-core-signing'
import { initSwapsStore, clearSwapsStore } from '@perawallet/wallet-core-swaps'
import {
    initWalletConnectStore,
    clearWalletConnectStore,
} from '@perawallet/wallet-core-walletconnect'

/**
 * Initializes all data stores synchronously.
 * DeviceStore and RemoteConfigStore are excluded — they are initialized
 * by the WithPlatformServicesExtension during provider construction.
 */
export const initializeDataStores = () => {
    initAccountsStore()
    initBlockchainStore()
    initContactsStore()
    initCurrenciesStore()
    initKeyManagerStore()
    initNotificationsStore()
    initPollingStore()
    initSecurityStore()
    initSettingsStore()
    initSigningStore()
    initSwapsStore()
    initWalletConnectStore()
}

/**
 * Clears persisted data and resets state for all data stores.
 */
export const clearDataStores = () => {
    clearAccountsStore()
    clearBlockchainStore()
    clearContactsStore()
    clearCurrenciesStore()
    clearKeyManagerStore()
    clearNotificationsStore()
    clearPollingStore()
    clearSecurityStore()
    clearSettingsStore()
    clearSigningStore()
    clearSwapsStore()
    clearWalletConnectStore()
}
