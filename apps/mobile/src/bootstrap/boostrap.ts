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

import { RNBiometricsService } from '../platform/biometrics'
import { RNDeviceInfoStorageService } from '../platform/device'
import { RNFirebaseService } from '../platform/firebase'
import { RNKeyValueStorageService } from '../platform/key-value-storage'
import { RNSecureStorageService } from '../platform/secure-storage'
import type { PlatformServices } from '@perawallet/wallet-core-platform-extension'
import { DataStoreRegistry, logger } from '@perawallet/wallet-core-shared'
import { registerDataStores } from '@perawallet/wallet-core-initializer'
import { useCallback } from 'react'

const firebaseService = new RNFirebaseService()
export const platformServices: PlatformServices = {
    analytics: firebaseService,
    biometrics: new RNBiometricsService(),
    crashReporting: firebaseService,
    pushNotification: firebaseService,
    remoteConfig: firebaseService,
    secureStorage: new RNSecureStorageService(),
    keyValueStorage: new RNKeyValueStorageService(),
    deviceInfo: new RNDeviceInfoStorageService(),
}

export const useBootstrapper = () => {
    return useCallback(async () => {
        logger.debug('Bootstrapping')
        // Register remaining data stores with DataStoreRegistry
        // (DeviceStore and RemoteConfigStore are initialized by PeraWalletProvider)
        registerDataStores()

        // Initialize remaining stores (they resolve services via getProvider(),
        // which is already set by PeraWalletProvider before this effect runs)
        await DataStoreRegistry.initializeAll()

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
            await platformServices.pushNotification.initializeNotifications()

        logger.debug('Bootstrapping completed')

        return {
            token: notificationResults.token,
        }
    }, [])
}
