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

// Import store packages to trigger self-registration with DataStoreRegistry
import '@perawallet/wallet-core-accounts'
import '@perawallet/wallet-core-assets'
import '@perawallet/wallet-core-blockchain'
import '@perawallet/wallet-core-contacts'
import '@perawallet/wallet-core-currencies'
import '@perawallet/wallet-core-kms'
import '@perawallet/wallet-core-polling'
import '@perawallet/wallet-core-security'
import '@perawallet/wallet-core-settings'
import '@perawallet/wallet-core-swaps'
import '@perawallet/wallet-core-walletconnect'

import { RNBiometricsService } from '../platform/biometrics'
import { RNDeviceInfoStorageService } from '../platform/device'
import { RNFirebaseService } from '../platform/firebase'
import { RNKeyValueStorageService } from '../platform/key-value-storage'
import { RNSecureStorageService } from '../platform/secure-storage'
import { registerPlatformServices } from '@perawallet/wallet-core-platform-integration'
import { logger } from '@perawallet/wallet-core-shared'
import { useCallback } from 'react'

const firebaseService = new RNFirebaseService()
const platformServices = {
    analytics: firebaseService,
    biometrics: new RNBiometricsService(),
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
        // Register platform services and initialize data stores
        await registerPlatformServices(platformServices)

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
