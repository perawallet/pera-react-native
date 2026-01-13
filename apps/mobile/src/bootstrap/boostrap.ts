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

import { initAccountsStore } from '@perawallet/wallet-core-accounts'
import { RNDeviceInfoStorageService } from '../platform/device'
import { RNFirebaseService } from '../platform/firebase'
import { RNKeyValueStorageService } from '../platform/key-value-storage'
import { RNSecureStorageService } from '../platform/secure-storage'
import {
    registerPlatformServices,
    initDeviceStore,
} from '@perawallet/wallet-core-platform-integration'
import { logger } from '@perawallet/wallet-core-shared'
import { initAssetsStore } from '@perawallet/wallet-core-assets'
import { initBlockchainStore } from '@perawallet/wallet-core-blockchain'
import { initContactsStore } from '@perawallet/wallet-core-contacts'
import { initCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { initPollingStore } from '@perawallet/wallet-core-polling'
import { initSettingsStore } from '@perawallet/wallet-core-settings'
import { initSwapsStore } from '@perawallet/wallet-core-swaps'
import { initKeyManagerStore } from '@perawallet/wallet-core-kms'
import { initWalletConnectStore } from '@perawallet/wallet-core-walletconnect'
import { initRemoteConfigStore } from '@perawallet/wallet-core-platform-integration'
import { useCallback } from 'react'

const firebaseService = new RNFirebaseService()
const platformServices = {
    analytics: firebaseService,
    crashReporting: firebaseService,
    notification: firebaseService,
    remoteConfig: firebaseService,
    secureStorage: new RNSecureStorageService(),
    keyValueStorage: new RNKeyValueStorageService(),
    deviceInfo: new RNDeviceInfoStorageService(),
}

export const useBootstrapper = () => {
    return useCallback(async () => {
        logger.debug('Bootstrapping')
        //Important - this has to happen first so all subsequent services can use the platform services
        await registerPlatformServices(platformServices)

        // Initialize the data stores.  The issue is that the underlying persistence layer is configured
        // in the platform services, so we have to initialize the data stores after that.
        const inits = []
        inits.push(initDeviceStore())
        inits.push(initAccountsStore())
        inits.push(initAssetsStore())
        inits.push(initBlockchainStore())
        inits.push(initContactsStore())
        inits.push(initCurrenciesStore())
        inits.push(initPollingStore())
        inits.push(initSettingsStore())
        inits.push(initSwapsStore())
        inits.push(initKeyManagerStore())
        inits.push(initWalletConnectStore())
        inits.push(initRemoteConfigStore())
        await Promise.allSettled(inits)

        const crashlyticsInit =
            platformServices.crashReporting.initializeCrashReporting()
        const remoteConfigInit =
            platformServices.remoteConfig.initializeRemoteConfig()
        const analyticsInit = platformServices.analytics.initializeAnalytics()

        await Promise.allSettled([
            crashlyticsInit,
            remoteConfigInit,
            analyticsInit,
        ])

        const notificationResults =
            await platformServices.notification.initializeNotifications()

        logger.debug('Bootstrapping completed')

        return {
            platformServices,
            token: notificationResults.token,
        }
    }, [])
}
