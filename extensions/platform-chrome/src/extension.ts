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
    PlatformExtension,
    PushNotificationInitResult,
} from '@perawallet/wallet-extension-platform'
import { platformServices } from './resources'

export type ChromePlatformExtension = PlatformExtension

export const WithChromePlatformExtension = (
    _provider: unknown,
): ChromePlatformExtension => {
    const initialize = async (): Promise<PushNotificationInitResult> => {
        await Promise.allSettled([
            platformServices.crashReporting.initializeCrashReporting(),
            platformServices.remoteConfig.initializeRemoteConfig(),
            platformServices.analytics.initializeAnalytics(),
        ])
        return platformServices.pushNotification.initializeNotifications()
    }

    return {
        ...platformServices,
        initialize,
    }
}
