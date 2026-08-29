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
    PlatformInitResult,
} from '@perawallet/wallet-extension-platform'
import { logger, withTimeout } from '@perawallet/wallet-core-shared'

import { platformServices } from './resources'
// Imported directly (not via the ./services barrel) so this module's graph
// stays free of the expo-backed services — extension.test.ts stubs
// ./resources and must not transitively load expo.
import { initializeSslPinningService } from './services/ssl-pinning/ssl-pinning.service'

export type ReactNativePlatformExtension = PlatformExtension

// Outer bound on push-notification init. Must exceed the inner 5s FCM token
// timeout so the inner degradation wins for a token hang; this outer bound
// only bites when an earlier step (e.g. a hung permission request) stalls.
const NOTIFICATIONS_INIT_TIMEOUT_MS = 8000

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
    const initialize = async (): Promise<PlatformInitResult> => {
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

        // After remote config so the SSL-pinning flag decisions see the
        // freshest activated value. Never throws — pinning is best-effort
        // hardening and must not break startup.
        await initializeSslPinningService({
            remoteConfig: platformServices.remoteConfig,
            analytics: platformServices.analytics,
            crashReporting: platformServices.crashReporting,
        })

        // Started, deliberately NOT awaited: FCM/APNs registration is bounded
        // at NOTIFICATIONS_INIT_TIMEOUT_MS, and awaiting it here held the splash
        // for that whole window on a slow or offline start. Bootstrap
        // only needs the services above; the token is consumed whenever it
        // arrives. Resolves with no token rather than rejecting, so no caller
        // has to guard it.
        const notifications = withTimeout(
            platformServices.pushNotification.initializeNotifications(),
            NOTIFICATIONS_INIT_TIMEOUT_MS,
            'push notification initialization',
        )
            .then(result => ({
                token: result.token,
                unsubscribe: result.unsubscribe,
            }))
            .catch((error: unknown) => {
                logger.warn(
                    'Push notification initialization timed out or failed; continuing without a token',
                    { error },
                )

                return {
                    token: undefined,
                    unsubscribe: () => {},
                }
            })

        return { notifications }
    }

    return {
        ...platformServices,
        initialize,
    }
}
