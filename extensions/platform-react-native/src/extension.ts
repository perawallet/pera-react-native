/*
 Copyright 2022-2026 Pera Wallet, LDA
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
    PlatformExtension,
    PushNotificationInitResult,
} from '@perawallet/wallet-extension-platform'

import { platformServices } from './resources'

export type ReactNativePlatformExtension = PlatformExtension

/**
 * wallet-provider Extension that provides all React Native platform service
 * implementations on the provider instance.
 *
 * Services are module-level singletons created in `resources.ts`.
 * The returned `initialize()` method performs async initialization
 * (Firebase, push notifications) and should be called after the provider
 * is mounted.
 */
export const WithReactNativePlatformExtension = (
    _provider: unknown,
): ReactNativePlatformExtension => {
    const initialize = async (): Promise<PushNotificationInitResult> => {
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

        return {
            token: notificationResults.token,
            unsubscribe: notificationResults.unsubscribe,
        }
    }

    return {
        ...platformServices,
        initialize,
    }
}
