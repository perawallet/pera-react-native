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

import {
    FirebaseCrashlyticsTypes,
    getCrashlytics,
    setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics'
import {
    fetchAndActivate,
    FirebaseRemoteConfigTypes,
    getRemoteConfig,
    setConfigSettings,
    setDefaults,
} from '@react-native-firebase/remote-config'
import {
    FirebaseMessagingTypes,
    getMessaging,
    getToken,
    onMessage,
    registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging'
import {
    FirebaseAnalyticsTypes,
    getAnalytics,
    logEvent as logEventGA,
} from '@react-native-firebase/analytics'
import { Platform } from 'react-native'
import notifee, {
    AndroidImportance,
    AuthorizationStatus,
    EventType,
    NotificationAndroid,
} from '@notifee/react-native'
import {
    CrashReportingService,
    NotificationsInitResult,
    RemoteConfigDefaults,
    RemoteConfigKey,
    RemoteConfigService,
    AnalyticsService,
} from '@perawallet/wallet-core-platform-integration'
import { config } from '@perawallet/wallet-core-config'

export class RNFirebaseService
    implements
        CrashReportingService,
        RemoteConfigService,
        CrashReportingService,
        AnalyticsService
{
    remoteConfig: FirebaseRemoteConfigTypes.Module | null = null
    messaging: FirebaseMessagingTypes.Module | null = null
    analytics: FirebaseAnalyticsTypes.Module | null = null
    crashlytics: FirebaseCrashlyticsTypes.Module | null = null

    async initializeRemoteConfig() {
        this.remoteConfig = await getRemoteConfig()
        await setConfigSettings(this.remoteConfig, {
            minimumFetchIntervalMillis: config.remoteConfigRefreshTime,
        })

        await setDefaults(this.remoteConfig, RemoteConfigDefaults)

        try {
            await fetchAndActivate(this.remoteConfig)
        } catch {
            // ignore fetch errors, rely on cached/default values
        }
    }

    getStringValue(key: RemoteConfigKey, fallback?: string): string {
        try {
            if (!this.remoteConfig) {
                return fallback ?? ''
            }
            return this.remoteConfig.getValue(key).asString()
        } catch {
            return fallback ?? ''
        }
    }
    getBooleanValue(key: RemoteConfigKey, fallback?: boolean): boolean {
        try {
            if (!this.remoteConfig) {
                return fallback ?? false
            }
            return this.remoteConfig.getValue(key).asBoolean()
        } catch {
            return fallback ?? false
        }
    }
    getNumberValue(key: RemoteConfigKey, fallback?: number): number {
        try {
            if (!this.remoteConfig) {
                return fallback ?? 0
            }
            return this.remoteConfig.getValue(key).asNumber()
        } catch {
            return fallback ?? 0
        }
    }

    async initializeNotifications(): Promise<NotificationsInitResult> {
        // Allow user to opt into notifications
        const settings = await notifee.requestPermission()

        if (settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED) {
            return {
                token: undefined,
                unsubscribe: () => {},
            }
        }

        // Android notification channel
        if (Platform.OS === 'android') {
            await notifee.createChannel({
                id: 'default',
                name: 'Default',
                importance: AndroidImportance.DEFAULT,
                vibration: true,
            })
        }

        // FCM registration + token
        let token: string | undefined
        try {
            this.messaging = await getMessaging()
            registerDeviceForRemoteMessages(this.messaging)
            token = await getToken(this.messaging)
        } catch {
            // noop
        }

        // Foreground message handler (show a local notification)
        const unsubscribeOnMessage = this.messaging
            ? onMessage(this.messaging, async remoteMessage => {
                  const title =
                      remoteMessage.notification?.title ?? 'Notification'
                  const body = remoteMessage.notification?.body ?? undefined

                  await notifee.displayNotification({
                      title,
                      body,
                      data: remoteMessage.data,
                      android: Platform.select({
                          android: { channelId: 'default' },
                          ios: undefined,
                      }) as NotificationAndroid,
                  })
              })
            : () => {}

        // Foreground notification events
        const unsubscribeNotifeeForeground = notifee.onForegroundEvent(
            async ({ type }) => {
                switch (type) {
                    case EventType.ACTION_PRESS:
                    case EventType.PRESS:
                        // TODO: Handle taps or actions using deeplink parser when we have it
                        break
                    default:
                        break
                }
            },
        )

        return {
            token,
            unsubscribe: () => {
                unsubscribeOnMessage?.()
                unsubscribeNotifeeForeground()
            },
        }
    }

    initializeCrashReporting(): void {
        this.crashlytics = getCrashlytics()
        setCrashlyticsCollectionEnabled(this.crashlytics, true)
    }

    recordNonFatalError(error: unknown): void {
        if (error instanceof Error) {
            this.crashlytics?.recordError(error)
        } else {
            this.crashlytics?.recordError(new Error(String(error)))
        }
    }

    initializeAnalytics(): void {
        this.analytics = getAnalytics()
    }

    logEvent(key: string, payload?: Record<string, unknown>): void {
        if (this.analytics) {
            logEventGA<string>(this.analytics, key, payload)
        }
    }
}
