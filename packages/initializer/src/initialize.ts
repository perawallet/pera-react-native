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
