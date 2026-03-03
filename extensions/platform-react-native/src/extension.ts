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

import type {
    PlatformServices,
    PushNotificationInitResult,
} from '@perawallet/wallet-extension-platform'
import {
    initDeviceStore,
    initRemoteConfigStore,
} from '@perawallet/wallet-extension-platform'
import { initNetworkStore } from '@perawallet/wallet-extension-network'
import { logger } from '@perawallet/wallet-core-shared'

import { RNFirebaseService } from './services/firebase'
import { RNBiometricsService } from './services/biometrics'
import { RNSecureStorageService } from './services/secure-storage'
import { RNKeyValueStorageService } from './services/key-value-storage'
import { RNDeviceInfoStorageService } from './services/device'

export type ReactNativePlatformExtension = PlatformServices & {
    initialize: () => Promise<PushNotificationInitResult>
}

/**
 * wallet-provider Extension that creates all React Native platform service
 * implementations and makes them available on the provider instance.
 *
 * Services are created synchronously during provider construction.
 * The returned `initialize()` method performs async initialization
 * (Firebase, push notifications) and should be called after the provider
 * is mounted.
 */
export const WithReactNativePlatformExtension = (
    _provider: unknown,
): ReactNativePlatformExtension => {
    const firebaseService = new RNFirebaseService()
    const keyValueStorage = new RNKeyValueStorageService()

    const services: PlatformServices = {
        analytics: firebaseService,
        biometrics: new RNBiometricsService(),
        crashReporting: firebaseService,
        pushNotification: firebaseService,
        remoteConfig: firebaseService,
        secureStorage: new RNSecureStorageService(),
        keyValueStorage,
        deviceInfo: new RNDeviceInfoStorageService(),
    }

    // Initialize stores synchronously during provider construction
    initNetworkStore()
    initDeviceStore(keyValueStorage)
    initRemoteConfigStore(keyValueStorage)

    const initialize = async (): Promise<PushNotificationInitResult> => {
        logger.debug('Initializing platform services')

        const crashlyticsInit =
            services.crashReporting.initializeCrashReporting()
        const remoteConfigInit = services.remoteConfig.initializeRemoteConfig()
        const analyticsInit = services.analytics.initializeAnalytics()

        await Promise.allSettled([
            crashlyticsInit,
            remoteConfigInit,
            analyticsInit,
        ])

        const notificationResults =
            await services.pushNotification.initializeNotifications()

        logger.debug('Platform services initialized')

        return {
            token: notificationResults.token,
            unsubscribe: notificationResults.unsubscribe,
        }
    }

    return {
        ...services,
        initialize,
    }
}
