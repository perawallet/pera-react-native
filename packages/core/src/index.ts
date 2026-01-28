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

export const name = '@perawallet/wallet-core'

export * from '@perawallet/wallet-core-accounts'
export * from '@perawallet/wallet-core-assets'
export * from '@perawallet/wallet-core-blockchain'
export * from '@perawallet/wallet-core-config'
export * from '@perawallet/wallet-core-contacts'
export * from '@perawallet/wallet-core-currencies'
export * from '@perawallet/wallet-core-kms'
export * from '@perawallet/wallet-core-platform-integration'
export * from '@perawallet/wallet-core-polling'
export * from '@perawallet/wallet-core-security'
export * from '@perawallet/wallet-core-settings'
export * from '@perawallet/wallet-core-shared'
export * from '@perawallet/wallet-core-swaps'
export * from '@perawallet/wallet-core-walletconnect'

export const registerDataStores = () => {
    registerAccountsStore()
    registerAssetsStore()
    registerBlockchainStore()
    registerContactsStore()
    registerCurrenciesStore()
    registerKeyManagerStore()
    registerDeviceStore()
    registerRemoteConfigStore()
    registerPollingStore()
    registerSecurityStore()
    registerSettingsStore()
    registerSwapsStore()
    registerWalletConnectStore()
}

