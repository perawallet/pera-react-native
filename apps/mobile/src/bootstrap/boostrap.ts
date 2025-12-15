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
    return async () => {
        logger.debug('Bootstrapping')
        //Important - this has to happen first so all subsequent services can use the platform services
        await registerPlatformServices(platformServices)

        // TODO: This is a mess - we should find a more elegant solution here...
        // the issue is that we have to initialize the state stores after setting up the platform services
        // which configure the persistence layer.
        await initDeviceStore()
        await initAccountsStore()
        await initAssetsStore()
        await initBlockchainStore()
        await initContactsStore()
        await initCurrenciesStore()
        await initPollingStore()
        await initSettingsStore()
        await initSwapsStore()

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

        debugLog('Bootstrapped')

        return {
            platformServices,
            token: notificationResults.token,
        }
    }
}
